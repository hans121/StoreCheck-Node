var _ = require('underscore');
var async = require('async');
var config = require('config');
var fs = require('fs');
var moment = require('moment');
var winston = require('winston');

var db = require('./../database/static-database');
var dbUtils = require('./../database/database-utils');
var nodeUtils = require('./../node-utils');
var linereader = require('../../modules/file-line-reader');
var emailer = require('../../modules/email-dispatcher');

var excipio_sftp = require('./excipio-sftp');
var excipio_utils = require('./excipio-utils');

var ActionAuditModule = require('../action-audit');
var AdminAreaModule = require('../model/hierarchy/admin-area');
var CustomerModule = require('../model/hierarchy/customer');
var CustomerPlatformModule = require('../model/hierarchy/customer-platform');
var DanonePlatformModule = require('../model/hierarchy/danone-platform');
var FactoryHierarchyModule = require('../model/hierarchy/factory-hierarchy');
var FactoryModule = require('../model/hierarchy/factory');
var HierarchyProcessor = require('../model/hierarchy/hierarchy-processor');
var PointOfSaleModule = require('../model/hierarchy/point-of-sale');
var POSHierarchyModule = require('../model/hierarchy/point-of-sale-hierarchy');
var ProductionLineModule = require('../model/hierarchy/production-line');
var ProductionLineHierarchyModule = require('../model/hierarchy/production-line-hierarchy');
var ProductModule = require('../model/hierarchy/product');
var ProductHierarchyModule = require('../model/hierarchy/product-hierarchy');
var RegionOfSalesModule = require('../model/hierarchy/region-of-sales');
var TemplateL5 = require('../model/hierarchy/audit-grid-hierarchy-level5');
var TemplateTranslationL5 = require('../model/hierarchy/audit-grid-hierarchy-translation-level5');

module.exports = {
    import: _handleImport
};

function _handleImport(email_on_complete, filter, callback2) {

    winston.info('began excipio import of type ' + filter);

    excipio_sftp.connect(function(connection) {
        excipio_sftp.read(connection, filter, function(err_read) { // , read_result
            excipio_sftp.close(connection);

            if(err_read) {
                callback2(err_read);
                return;
            }

            if(filter == 'template') {
                winston.debug('completed SFTP move, and now beginning local template merge');
                nodeUtils.runInBackground(function() {
                    _mergeAndImportTemplateHierarchyDirectory('data/templates/hierarchy', 'data/_archive', function (err_merge) { // , merge_result
                        if (err_merge) {
                            winston.error('an error occurred while importing audit grid hierarchy: ' + err_merge);
                            return;
                        }
                        _reloadTemplateTranslations(email_on_complete, 'data/_archive', function () { // err_translations, translations_result
                            //callback2(err_merge, merge_result); // rerun template hierarchy processing!
                        });
                    });
                });
                callback2();
            } else if(filter == 'pos') {
                winston.debug('completed SFTP move, and now beginning local pos merge');
                nodeUtils.runInBackground(function() {
                    _mergeAndImportPosHierarchyDirectory('data/pos', 'data/_archive', function(err_merge, merge_result) {
                        if(email_on_complete && email_on_complete.trim().length > 0) {
                            emailer.semaphore.take(function() {
                                emailer.reconnect(function(err_reconnect) {
                                    if(err_reconnect) {
                                        emailer.semaphore.leave();
                                        return;
                                    }
                                    var body = 'Point of Sale Hierarchy Import Complete';
                                    emailer.send(email_on_complete, 'Point of Sale Hierarchy Import Complete', body, body);
                                    emailer.semaphore.leave();
                                });
                            });
                        }
                        winston.info('point of sale hierarchy import complete');
                    });
                });
                callback2();
            } else {
                winston.debug('beginning general merge');

                async.series({
                    'admin_area': function(callback) {
                        _mergeAndImportSingleHierarchy(AdminAreaModule, excipio_utils.FILE_PREFICES.ADMIN_AREAS, 'data/administrative_areas', 'data/_archive', function(err_merge, merge_result) {
                            callback(err_merge, merge_result);
                        });
                    },

                    'customer_platform': function(callback) {
                        _mergeAndImportSingleHierarchy(CustomerPlatformModule, excipio_utils.FILE_PREFICES.CUSTOMER_PLATFORMS, 'data/customer_platforms', 'data/_archive', function(err_merge, merge_result) {
                            callback(err_merge, merge_result);
                        });
                    },

                    'customer': function(callback) {
                        _mergeAndImportSingleHierarchy(CustomerModule, excipio_utils.FILE_PREFICES.CUSTOMERS, 'data/customers', 'data/_archive', function(err_merge, merge_result) {
                            callback(err_merge, merge_result);
                        });
                    },

                    'danone_platform': function(callback) {
                        _mergeAndImportSingleHierarchy(DanonePlatformModule, excipio_utils.FILE_PREFICES.DANONE_PLATFORMS, 'data/danone_platforms', 'data/_archive', function(err_merge, merge_result) {
                            callback(err_merge, merge_result);
                        });
                    },

                    'factory': function(callback) {
                        _mergeAndImportSingleHierarchy(FactoryHierarchyModule, excipio_utils.FILE_PREFICES.FACTORIES, 'data/factories', 'data/_archive', function(err_merge, merge_result) {

                            // TODO: this is a nasty block of code - should be moved
                            var params = {
                                static_load_name: 'factories',
                                hierarchyModule: FactoryHierarchyModule,
                                resultsModule: FactoryModule,
                                hierarchyQuery: { hierarchy_level: '0'},
                                recordPKs: ['company_id','category_id','code','identity_id','hierarchy_level'],
                                orgCodeFunction: function(item) {
                                    return item.code.split(' ')[0];
                                }
                            };

                            HierarchyProcessor.process(params,
                                function(err, added_count) {
                                    callback(err, added_count);
                                }
                            );

                        });
                    },

                    'product': function(callback) {
                        _mergeAndImportProductHierarchy('data/products', 'data/_archive', function(err_merge, merge_result) {

                            ProductModule.process({}, function(err_process, added) {
                                callback(err_process, added);
                            });
                        });
                    },

                    'production_line': function(callback) {
                        _mergeAndImportSingleHierarchy(ProductionLineHierarchyModule, excipio_utils.FILE_PREFICES.PRODUCTION_LINES, 'data/production_lines', 'data/_archive', function(err_merge) { // , merge_result
                            var params = {
                                static_load_name: 'production-lines',
                                hierarchyModule: ProductionLineHierarchyModule,
                                resultsModule: ProductionLineModule,
                                hierarchyQuery: { hierarchy_level: '0' },
                                recordPKs: ['company_id', 'category_id', 'hierarchy_level', 'identity_id'],
                                orgCodeFunction: function(item) {
                                    return item.code.split(' ')[0];
                                }
                            };

                            HierarchyProcessor.process(params, function(err, added_count) {
                                callback(err_merge, added_count);
                            });
                        });
                    },

                    'region_of_sales': function(callback) {
                        _mergeAndImportSingleHierarchy(RegionOfSalesModule, excipio_utils.FILE_PREFICES.REGIONS_OF_SALES, 'data/region_of_sales', 'data/_archive', function(err_merge, merge_result) {
                            callback(err_merge, merge_result);
                        });
                    }

                }, function(err_merge) { // , merge_results
                    if(email_on_complete && email_on_complete.trim().length > 0) {
                        emailer.semaphore.take(function() {
                            emailer.reconnect(function(err_reconnect) {
                                if(err_reconnect) {
                                    emailer.semaphore.leave();
                                    return;
                                }
                                var subject = 'General Hierarchy Import Complete';
                                var body = 'General Hierarchy Import Complete';
                                if(err_merge) {
                                    subject = 'General Hierarchy Merge Failed';
                                    body = err_merge;
                                }
                                emailer.send(email_on_complete, subject, body, body);
                                emailer.semaphore.leave();
                            });
                        });
                    }

                    winston.info('completed general hierarchy merge')
                });

                callback2();
            }
        });
    }, function(err) {
        winston.log('error', 'an error occurred while connecting to sftp: ' + err);
        callback2(err, null);
    });
}

// the product processor needs to be rewritten to match the interface of the other modules
// until that time, product import/processing gets its own method
function _mergeAndImportProductHierarchy(directory, archive_directory, callback2) {
    _mergeDirectorySingleFile(excipio_utils.FILE_PREFICES.PRODUCTS, directory, archive_directory, function(err_merge) { // , merge_result

        if(err_merge != null) {
            callback2(err_merge);
            return;
        }

        var filenames = fs.readdirSync(directory);
        if(filenames.length == 0) {
            callback2(null, null);
            return;
        }

        filenames = _.map(filenames, function(file) { return directory + '/' + file});
        ProductHierarchyModule.readFiles(filenames, function(err_product) { // , products
            if(err_product) {
                callback2(err_product);
                return;
            }

            ProductModule.process({}, function(err_process, process_results) {
                callback2(err_process, process_results);
            });
        });
    });
}

// does a merge of template hierarchy, which differs from every other merge in that
// t03 code (inside of the files) must be taken into account
function _mergeAndImportTemplateHierarchyDirectory(directory, archive_directory, callback2) {

    // list files
    var filenames = fs.readdirSync(directory);

    // make sure there are files to read
    if(filenames.length == 0) {
        callback2(null, null);
        return;
    }

    // build a collection of data about the files to merge
    var merge_context = { files: [] }, header_line, first_line, tokens;
    _.each(filenames, function(filename) {

        // limit files to ones that are named properly (as templates)
        if(filename.indexOf(excipio_utils.FILE_PREFICES.AUDIT_GRIDS) != -1) {

            // attempt to get the tokens we'll use from the filename
            var file_parts = filename.split('_');
            if(file_parts.length != 3) {
                winston.error('Template file ' + filename + ' was of the wrong name format');
            } else {

                // clear off any suffices from the final filename part
                file_parts[2] = file_parts[2].split('.')[0];

                // read the second line (if able) to determine which t03 code the file defines
                var reader = new linereader.FileLineReader(directory + '/' + filename, 'UCS2');
                if(reader.hasNextLine()) {
                    header_line = reader.nextLine();

                    if(reader.hasNextLine()) {
                        first_line = reader.nextLine();
                        tokens = first_line.split('\t');

                        if(tokens.length > 26) {

                            // use the parsed parts of the filename to determine timestamp
                            var timestamp = moment(file_parts[1] + file_parts[2], config['excipio_import']['fileTimestampFormat']);
                            merge_context.files.push({
                                filename: filename,
                                path: directory + '/' + filename,
                                timestamp: timestamp,
                                t03_code: tokens[26].trim()
                            });
                        }
                    }
                }
            }
        }
    });

    // move old versions to the archive folder, then kick off the load
    if(merge_context.files.length > 0) {

        // sort the files in merge_context, with the newest first
        merge_context.files.sort(_sortByTimestampDescending);

        // do the move!
        var current_files = [], match, archived_files = [];
        _.each(merge_context.files, function(file) {
            match = _.where(current_files, {t03_code: file.t03_code});
            if(match.length == 0) {
                current_files.push(file);
            } else {
                archived_files.push(file);
                fs.renameSync(directory + '/' + file.filename, archive_directory + '/' + file.filename);
            }
        });

        // so, if anything changed (TODO: check this later by uncommenting), reload the template hierarchies
        //if(archived_files.length > 0) {
        TemplateL5.reload(current_files, function(err_L5, L5_results) {
            // TODO: find which language hierarchy files exist, then reload them
            // TODO: ActionAuditModule
            callback2(err_L5, L5_results);
        });
        //}
    }
}

// POS hierarchy importer doesn't conform to the interface of the other modules (BLEH)
function _mergeAndImportPosHierarchyDirectory(directory, archive_directory, callback2) {
    _mergeDirectorySingleFile(excipio_utils.FILE_PREFICES.ADDRESS, directory, archive_directory, function(err_merge, merge_result) {

        if(err_merge) {
            callback2(err_merge);
            return;
        }

        if(merge_result == null) {
            callback2(null, null);
            return;
        }

        // we ALWAYS process the POS again, even if it's the same item (TODO: how would we be able to figure out otherwise without more info?)

        // process the remaining file
        winston.debug('began reading POS hierarchy');
        POSHierarchyModule.readHierarchyFiles([merge_result], function(err) { // , results
            if(err != null) {
                callback2(err);
                return;
            }
            winston.info('finished reading POS hierarchy files, and now processing POS records');

            //ActionAuditModule.report(caller, 'create', 'pos-hierarchy', 'init');
            POSHierarchyModule.process(PointOfSaleModule, function(err, result) {
                if(err != null) {
                    callback2(err);
                    return;
                }
                //ActionAuditModule.report(caller, 'create', 'pos-hierarchy', 'process');
                callback2(null, result);
            });
        });
    });
}

function _reloadTemplateTranslations(email_on_complete, archive_directory, callback2) {
    var directory = 'data/templates/language';
    var filenames = fs.readdirSync(directory);
    var files = [];

    if(!filenames) {
        callback2(null, null);
        return;
    }

    filenames = _.filter(filenames, function(filename) {
        return filename != 'README.md';
    });

    if(filenames.length == 0) {
        callback2(null, []);
        return;
    }

    files = _.map(filenames, function(file) { return {
        path: directory + '/' + file,
        filename: file
    }});

    TemplateTranslationL5.reloadAsJob(files, function(err_process) { // process_result
        if(err_process != null) {
            winston.error(err_process);
        } else {
            // move all files to archive, since this is an iterative import!!
            _.each(files, function(file) {
                fs.renameSync(file.path, archive_directory + '/' + file.filename);
            });

            winston.info('hierarchy translation complete');

            if(email_on_complete && email_on_complete.trim().length > 0) {
                emailer.semaphore.take(function() {
                    emailer.reconnect(function(err_reconnect) {
                        if(err_reconnect) {
                            emailer.semaphore.leave();
                            return;
                        }
                        var body = 'Audit Grid Hierarchy Import Complete';
                        emailer.send(email_on_complete, 'Audit Grid Hierarchy Import Complete', body, body);
                        emailer.semaphore.leave();
                    });
                });
            }

            //ActionAuditModule.report(undefined, 'reload', 'template/hierarchy-translation/5', 'completed: from ' + date + ' to ' + new Date());
            // job is complete, but user does not expect response
        }
    });

    callback2(null, files);
}

function _mergeDirectorySingleFile(file_prefix, directory, archive_directory, callback2) {
    var filenames = fs.readdirSync(directory), files = [];

    if(!filenames) {
        callback2(null, null);
        return;
    }

    filenames = _.filter(filenames, function(filename) {
        return filename != 'README.md';
    });

    // if there are no POS files, end processing
    if(filenames.length == 0) {
        callback2(null, null);
        return;
    }

    _.each(filenames, function(filename) {

        // limit files to ones that are named properly
        if(filename.indexOf(file_prefix) != -1) {
            var timestamp = _getTimestampStringFromName(filename);
            if(timestamp != null) {
                files.push({
                    filename: filename,
                    path: directory + '/' + filename,
                    timestamp: timestamp
                });
            }
        }
    });

    files.sort(_sortByTimestampDescending);

    var latest_file = files.shift();

    // move older files to archive
    _.each(files, function(file) {
        fs.renameSync(file.path, archive_directory + '/' + file.filename);
    });
    callback2(null, latest_file);
}

function _getTimestampStringFromName(filename) {
    // attempt to get the tokens we'll use from the filename
    var file_parts = filename.split('_');
    if(file_parts.length != 3) {
        winston.error('Template file ' + filename + ' was of the wrong name format');
        return null;
    }

    // clear off any suffices from the final filename part
    file_parts[2] = file_parts[2].split('.')[0];
    return moment(file_parts[1] + file_parts[2], config['excipio_import']['fileTimestampFormat']);
}

// no trailing / at end of directory
function _mergeAndImportSingleHierarchy(db_module, prefix, directory, archive_directory, callback2) {
    _mergeDirectorySingleFile(prefix, directory, archive_directory, function(err_merge_admin_areas) { //, admin_areas
        if(err_merge_admin_areas != null) {
            callback2(err_merge_admin_areas);
            return;
        }

        var filenames = fs.readdirSync(directory);

        if(!filenames) {
            callback2(null, null);
            return;
        }

        filenames = _.filter(filenames, function(filename) {
            return filename != 'README.md';
        });

        if(filenames.length == 0) {
            callback2(null, null);
            return;
        }

        filenames = _.map(filenames, function(file) { return {path: directory + '/' + file}});
        db_module.readFiles(filenames, function(err_admin_area, admin_area_results) {
            callback2(err_admin_area, admin_area_results);
        });
    });
}

function _sortByTimestampDescending(a, b) {
    if(a.timestamp > b.timestamp) {
        return -1;
    } else if(a.timestamp < b.timestamp) {
        return 1;
    }
    return 0;
}