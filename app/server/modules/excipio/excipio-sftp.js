var _ = require('underscore');
var config = require('config');
var fs = require('fs');
var request = require('request');
var sftp_download_semaphore = require('semaphore')(1);
var ssh2 = require('ssh2');
var winston = require('winston');
var zlib = require('zlib');
var excipio_utils = require('./excipio-utils');
var nodeUtils = require('../node-utils');

var excipio_sftp = (function () {
    var retryCount = 0;
    var external_interface = {
        connect:                function(onready, onerror) { connect(onready, onerror); },
        close:                  function(conn) { close(conn); },
        send:                   function(conn, filename, xmlString, callback2) { send(conn, filename, xmlString, callback2); },
        read:                   function(conn, type, callback2) { read(conn, type, callback2); },
        copyRemoteFileToSFTP:   function(conn, inStream, filename, callback2){ copyRemoteFileToSFTP(conn, inStream, filename, callback2); },

        // combination methods
        sendFileContentsToSFTP: function(filename, xmlString, callback2) { sendFileContentsToSFTP(filename, xmlString, callback2); },
        getRetryCount : function(){ return retryCount;}
    };

    var to_storecheck_root = '/excipio/to_storecheck';

    function connect(onready, onerror) {
            winston.log('debug', 'sftp connection connecting');

        try {
            var sftp_connection = new ssh2();
            sftp_connection.on('ready', function() {
                if(onready) {
                    onready(sftp_connection);
                }
            });

            sftp_connection.on('error', function(err) {
                if(onerror) {
                    retryCount++;
                    onerror(err);
                }
            });
            sftp_connection.on('connect',
                function () {
                    //winston.log('debug', 'sftp connection connected');
                    retryCount = 0;
                }
            );
            sftp_connection.on('end',
                function () {
                    //winston.log('debug', 'sftp connection closed');
                }
            );

            sftp_connection.connect({
                host: config.sftp.host,
                port: config.sftp.port,
                username: config.sftp.username,
                privateKey: fs.readFileSync(config.sftp.privateKey),
                //retry : 3,
                //wait : 500,
                readyTimeout : 100000
            });
        } catch(ex) {
            retryCount++;
            onerror(ex);
        }
    }

    function close(sftp_connection) {
        //winston.debug('closing SFTP connection');

        try {
            sftp_connection.end();
        } catch(ex) {
            winston.error('exception thrown while closing SFTP connection: ' + ex);
        }
    }

    // sends any string over an active sftp connection
    function send(sftp_connection, filename, xmlString, callback2) {
        var encoding = 'ucs2';

        try {
            sftp_connection.sftp(function (err_sftp, sftp) {
                if (err_sftp) {
                    callback2('SFTP error: ' + err_sftp);
                    return;
                }

                var writeOptions = { encoding: encoding }; // utf16le = ucs2
                var writeStream = sftp.createWriteStream(filename, writeOptions);

                // the transfer had an error
                writeStream.on('error',
                    function(err_ws) {
                        callback2('SFTP writeStream error: ' + err_ws);
                    }
                );

                // the transfer finished
                writeStream.on('close',
                    function () {
                        sftp.end();
                        callback2(null, filename);
                    }
                );

                var buffer_ucs2 = new Buffer(xmlString, encoding);

                // gzipBuffer is a better alternative to:
                // zlib.gzip(buffer_ucs2, function (err, data) {

                gzipBuffer(buffer_ucs2.toString(encoding),  function (err, data) {
                    winston.info('sending ' + filename + ' over SFTP');

                    writeStream.write(data);
                    writeStream.end();
                });
            });
        } catch(ex) {
            callback2(ex);
        }
    }

    // gzip a buffer, and preserve the encoding
    function gzipBuffer(inputBuffer, callback2) {

        //encoding: 'ucs2'
        var gzipStream = zlib.createGzip({
            level: 9 // maximum compression
        });

        var buffers=[], nread=0;

        gzipStream.on('error', function(err) {
            gzipStream.removeAllListeners();
            gzipStream=null;

            callback2(err);
        });

        gzipStream.on('data', function(chunk) {
            buffers.push(new Buffer(chunk));
            nread += chunk.length;
        });

        gzipStream.on('end', function() {
            var buffer;
            switch (buffers.length) {
                case 0: // no data.  return empty buffer
                    buffer = new Buffer(0);
                    break;
                case 1: // only one chunk of data.  return it.
                    buffer = buffers[0];
                    break;
                default: // concatenate the chunks of data into a single buffer.
                    buffer = Buffer.concat(buffers);
                    break;
            }

            gzipStream.removeAllListeners();
            gzipStream=null;

            // do something with `buffer` here!
            callback2(null, buffer);
        });

        // and finally, give it data to compress
        gzipStream.write(inputBuffer);
        gzipStream.end();
    }

    // sends any string over an active sftp connection
    function copyRemoteFileToSFTP(sftp_connection, url, filename, callback2) {
        //winston.debug('beginning SFTP pipe');

        try {
            sftp_connection.sftp(function (err_sftp, sftp) {
                if(err_sftp) {
                    callback2('SFTP error: ' + err_sftp);
                    return;
                }
                var full_path = "/excipio/from_storecheck/" + filename;
                winston.debug('writing to SFTP at ' + full_path);

                var writeStream = sftp.createWriteStream(full_path);

                writeStream.on('error',
                    function(err_ws) {
                        winston.error('SFTP writeStream error' + err_ws);
                        callback2(err_ws);
                        //semaphore.leave();
                    }
                );

                // what to do when transfer finishes
                writeStream.on('close',
                    function () {
                        sftp.end();
                        callback2(null, true);
                    }
                );

                request(url).pipe(writeStream);
                //writeStream.end();
            });
        } catch(ex) {
            winston.error('SFTP writeStream error' + ex);
            callback2(ex);
        }
    }

    function sendFileContentsToSFTP(filename, xmlString, callback2) {

        try {
            excipio_sftp.connect(function(connection) {
                excipio_sftp.send(connection, filename, xmlString, function(err) { // err, success
                    excipio_sftp.close(connection);
                    if(err) {
                        winston.log('error', 'an error occurred while sending to sftp: ' + err);
                        callback2(err);
                        return;
                    }

                    winston.info('file "' + filename + '" was sent to remote SFTP');
                    callback2(null, filename);
                });
            }, function(err) {
                winston.log('error', 'an error occurred while connecting to sftp: ' + err);
                callback2(err);
            });
        } catch(ex) {
            winston.error('exception occurred while sending file contents to SFTP');
            callback2(ex);
        }
    }

    function _listFiles(sftp, callback2) {
        var file_list = [];

        try {
            sftp.opendir('/excipio/to_storecheck', function (err, handle) {
                if (err) {
                    callback2(err);
                    return;
                }
                _appendFiles(handle);
            });
        } catch(ex) {
            winston.error('exception occurred while listing files via SFTP: ' + ex);
            callback2(ex);
        }


        function _appendFiles(handle) {

            try {
                sftp.readdir(handle, function (err, list) {
                    if (err) {
                        callback2(err);
                        return;
                    }
                    if (list === false) {
                        callback2(null, file_list);
                        return;
                    }

                    file_list = file_list.concat(_.pluck(list, 'filename'));

                    nodeUtils.recursiveWrapper(function() { _appendFiles(handle); });
                });
            } catch(ex) {
                winston.error('exception occurred while reading SFTP directory: ' + ex);
                callback2(ex);
            }
        }
    }

    function read(sftp_connection, type, callback2) {
        sftp_download_semaphore.take(function() {

            try {
                sftp_connection.sftp(function (err_sftp, sftp) {
                    if (err_sftp) {
                        sftp_download_semaphore.leave();
                        callback2('SFTP error: ' + err_sftp, null);
                        return;
                    }

                    winston.debug('listing contents of excipio import directory on the SFTP server');

                    _listFiles(sftp, function(err_list, list) {
                        if(err_list) {
                            sftp_download_semaphore.leave();
                            callback2(err_list);
                            return;
                        }

                        winston.debug(list.length + ' files were listed in the excipio import directory on the SFTP server');

                        var move_context = {
                            sftp: sftp,
                            type: type,
                            list: list
                        };
                        _moveFilesFromSFTP(move_context, function (err_import, res_import) {
                            if(err_import != null) {
                                sftp.end();
                                winston.error('An error occurred while processing SFTP import: ' + err_import);
                                sftp_download_semaphore.leave();
                                return;
                            }
                            sftp_download_semaphore.leave();
                            callback2(err_import, res_import);
                        });
                    });
                });
            } catch(ex) {
                winston.error('exception occurred while processing SFTP read: ' + ex);
                sftp_download_semaphore.leave();
            }
        });
    }

    // this operation copies the files in the supplied list to the correct local folder
    // options = { sftp, type, list }
    function _moveFilesFromSFTP(context, callback2) {
        if(context.list.length == 0) {
            if(_.isUndefined(context.processed_files)) {
                callback2(null, context);
                return;
            }
            callback2(null, context.processed_files);
            return;
        }

        var file = context.list.shift();

        if(_matchesFilter(context.type, file)) { // if matches type filter
            winston.debug('found a file that matches excipio import filter "' + context.type + '": ' + file);
            var full_filename = to_storecheck_root + '/' + file;

            // TODO: we should really be piping this to a fileoutput stream so we don't keep the whole file in memory

            try {
                var readStream = context.sftp.createReadStream(full_filename, read_options);
                var body_buffer = new Buffer(0);
                readStream.on('data',
                    function (chunk) {
                        body_buffer = Buffer.concat([body_buffer, chunk]);
                    }
                );

                readStream.on('end',
                    function () {
                        // write the file to the proper data folder (TODO: check result)
                        var destination_filename = excipio_utils.getLocalFolderFromFilename(file) + file;

                        // maybe use https://github.com/mooz/node-icu-charset-detector
                        try {
                            fs.writeFileSync(destination_filename, body_buffer, {encoding: 'UCS2'});
                        } catch(ex) {
                            callback2('failed to write locally: ' + ex);
                            return;
                        }

                        context.sftp.unlink(full_filename, function(err_unlink) { //, unlink_result
                            if(err_unlink != null) {
                                callback2(err_unlink);
                                return;
                            }

                            if(_.isUndefined(context.processed_files)) {
                                context.processed_files = [];
                            }
                            context.processed_files.push(file);
                            nodeUtils.recursiveWrapper(function() { _moveFilesFromSFTP(context, callback2); });
                        });
                    }
                );

                readStream.on('error',
                    function(err) {
                        winston.error('while moving files from SFTP: ' + err);
                        callback2(err);
                    }
                );
            } catch(ex) {
                winston.error('exception occurred while moving files from SFTP: ' + ex);
                callback2(ex);
            }

        } else {
            winston.debug('during excipio import, ignored ' + file);
            nodeUtils.recursiveWrapper(function() { _moveFilesFromSFTP(context, callback2); });
        }
    }

    var read_options = {
        flags: 'r',
        encoding: null,
        mode: 0666,
        bufferSize: 64 * 1024
    };

    function _matchesFilter(type, filename) {
        if(type == 'template') {
            return _isInTemplateLoad(filename);
        } else if(type == 'pos') {
            return _isInPOSLoad(filename);
        } else if(type == 'general') {
            return _isInGeneralLoad(filename);
        }
        return !_isInTemplateLoad(filename) && !_isInPOSLoad(filename) && !_isSystemDirectory(filename);
    }

    function _isInTemplateLoad(filename) {
        return filename.indexOf(excipio_utils.FILE_PREFICES.AUDIT_GRIDS) != -1 ||
            filename.indexOf(excipio_utils.FILE_PREFICES.AUDIT_GRID_TRANSLATIONS) != -1;
    }

    function _isInPOSLoad(filename) {
        return filename.indexOf('Addr_') != -1;
    }

    function _isInGeneralLoad(filename) {
        return filename.indexOf('A53') != -1 || // admin areas
            filename.indexOf('A57') != -1  ||   // customer platforms
            filename.indexOf('A59') != -1  ||   // customers
            filename.indexOf('A52') != -1  ||   // danone platforms
            filename.indexOf('C73') != -1  ||   // factories
            filename.indexOf('C91') != -1  ||   // production lines
            filename.indexOf('A48') != -1  ||   // region of sales
            filename.indexOf('Prod') != -1 ||   // products
            filename.indexOf('A12') != -1 ||    // NOT PROCESSED
            filename.indexOf('A50') != -1 ||    // NOT PROCESSED
            filename.indexOf('A54') != -1 ||    // NOT PROCESSED
            filename.indexOf('A56') != -1;      // NOT PROCESSED

    }

    function _isSystemDirectory(filename) {
        return filename == '.' || filename == '..';
    }

    return external_interface;

}());

module.exports = excipio_sftp;