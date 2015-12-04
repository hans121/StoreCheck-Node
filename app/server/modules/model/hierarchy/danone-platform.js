var db = require('./../../database/static-database');
var danone_platform = db.db.collection('danone-platform');
var dbUtils = require('../../database/database-utils');
var winston = require('winston');
var fs = require('fs');

var OrganizationModule = require('../organization');

var schema = require('./../schema/schema');

dbUtils.addStandardMethods(exports, danone_platform);

exports.readFiles = function(file_list, callback) {
    danone_platform.remove({}, function() {
        function readFiles(remaining_files) {
            var file = remaining_files.shift();
            readFile(file.path, function() {
                if(remaining_files.length == 0) {
                    callback();
                    return;
                }
                readFiles(remaining_files);
            });
        }
        readFiles(file_list);
    });
};

function readFile(path, onComplete) {

    fs.readFile(path, 'UCS2', function(err, data) {
        if (err) throw err;

        danone_platform.ensureIndex({ code: 1, description: 1, hierarchy_level: 1 }, {background: true}, function(err) {
            winston.log('debug', 'completed initiating ensureIndex of danone-platform container, err=' + err);
        });

        // read all of the lines
        var lines = data.split('\n');
        insertFromLines(path, lines, 1, function() {

            // move on to the next file
            onComplete();
        });

        winston.log('info', 'processing ' + lines.length + ' records.');
    });
}

function insertFromLines(path, lines, index, callback) {
    if(index == lines.length) {
        callback();
    } else {
        var lineItems = lines[index].split('\t');

        if(lineItems.length > 25) {

            var danone_platform_record = {};
            danone_platform_record.code = lineItems[2];
            danone_platform_record.hierarchy_level = lineItems[3];
            danone_platform_record.active = lineItems[5];
            danone_platform_record.description = lineItems[13];
            danone_platform_record.identity_id = lineItems[25].trim();
            danone_platform_record.version = schema.currentVersion;

            if(danone_platform_record.hierarchy_level == '0') {
                OrganizationModule.findOne({code: danone_platform_record.code.split(' ')[0]}, function(err, organization) {
                    if(organization) {
                        danone_platform_record.organization = organization._id.toHexString();
                    }
                    danone_platform.insert(danone_platform_record, {safe: true}, function(err) { // err, object
                        if(err != null) {
                            winston.log('error', 'while reading danone-platform file, path="' + path + '", explanation=' + err);
                        }
                        insertFromLines(path, lines, index + 1, callback);
                    });
                });
            } else {
                danone_platform.insert(danone_platform_record, {safe: true}, function(err) { // err, object
                    if(err != null) {
                        winston.log('error', 'while reading danone-platform file, path="' + path + '", explanation=' + err);
                    }
                    insertFromLines(path, lines, index + 1, callback);
                });
            }

        } else {
            winston.log('warn', 'while reading danone-platform file, line ' + (index + 1) + ' (1-indexed) did not have enough records to parse, path=' + path);
            insertFromLines(path, lines, index + 1, callback);
        }
    }
}
