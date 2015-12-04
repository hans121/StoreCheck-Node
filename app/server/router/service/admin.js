var _ = require('underscore');
var async = require('async');
var config = require('config');
var fs = require('fs');
var moment = require('moment');
var ObjectId = require('mongodb').ObjectID;
var responseTime = require('node-response-time-tracking');
var winston = require('winston');

var node_server_monitor = require('node-server-monitor');

var AccountManager = require('../../modules/account-manager');
var ActionAuditModule = require('../../modules/action-audit');
var AuditAssignmentModule = require('../../modules/model/audit-assignment');
var CategorySpecific = require('../../modules/category-specific');
var Common = require('../router-common');
var ExcipioExportLogsDatabase = require('../../modules/excipio-export-log');
//var HierarchyModule5 = require('../../modules/model/hierarchy/audit-grid-hierarchy-level5');
var OrganizationModule = require('../../modules/model/organization');
var PointOfSaleModule = require('../../modules/model/hierarchy/point-of-sale');
var PointOfSaleHierarchyModule = require('../../modules/model/hierarchy/point-of-sale-hierarchy');
var ProductModule = require('../../modules/model/hierarchy/product');
var SampleModule = require('../../modules/model/sample');
var StaticLoadModule = require('../../modules/static-loads');
var StoreCheckModule = require('../../modules/model/store-check');
var StoreCheckLogsDatabase = require('../../modules/database/storecheck-logs-database');
var TemplateModule = require('../../modules/model/template');
var VisitModule = require('../../modules/model/visit');
var VisitReportModule = require('../../modules/model/visit-reports');

var adminUtils = require('../../utils/admin-utils');
var database_backup_job = require('../../modules/jobs/backup-databases');
var database_general = require('../../modules/database/database');
var nodeUtils = require('../../modules/node-utils');
var formatter = require('../../modules/view-formatter');
var schema = require('../../modules/model/schema/schema');
var posUtils = require('../../utils/pos-utils');
var sampleUtils = require('../../utils/sample-utils');

module.exports = function(app) {

    // admin management routes
    Common.addHandler(app, 'delete', '/admin/user-entered-data', _deleteUserEnteredData);

    Common.addHandler(app, 'delete', '/admin/all-data', _deleteAllData);

    Common.addHandler(app, 'post', '/admin/backup', _handleTakeBackup);

    Common.addHandler(app, 'post', '/admin/backup/restore', _handleRestoreFromBackup);

    Common.addHandler(app, 'post', '/admin/restart', _handleRestartServer);

    Common.addHandler(app, 'post', '/admin/samples/temperature-conformance', _updateSampleTemperatureConformance);

    Common.addHandler(app, 'delete', '/admin/excipio-exports', _handleDeleteExcipioExports);

    Common.addHandler(app, 'post', '/admin/database/:db', _handleModifyDatabase);

    Common.addHandler(app, 'post', '/admin/database/:db/collection/:collection', _handleModifyCollection);

    Common.addHandler(app, 'post', '/admin/user/become', _handleUserBecome);

    Common.addHandler(app, 'delete', '/admin/logs', _handleDeleteLogs);

    Common.addHandler(app, 'delete', '/admin/response-times', _handleResponseTimesDelete);

    //Common.addHandler(app, 'get', '/admin/fix-orphaned-pos', _handleFixOrphanedPOS);

    // temporary admin management routes (typically, to patch/upgrade data to newer code expectations)

    Common.addHandler(app, 'get', '/admin/pos/remove-empty', _handlePointOfSaleRemoveEmpty);

    Common.addHandler(app, 'get', '/admin/pos/process-a70', _handlePointOfSaleA70);

    Common.addHandler(app, 'get', '/admin/samples/sample-names-to-int', _updateSampleNamesToInt);

    Common.addHandler(app, 'get', '/admin/samples/compact-questions', _updateSampleCompactQuestions);

    Common.addHandler(app, 'get', '/admin/samples/reports', _updateSamplesReports);

    //Common.addHandler(app, 'get', '/admin/pos-clean', _handlePointOfSaleClean);

    // informational routes

    Common.addHandler(app, 'get', '/admin/system', _handleResourcesGet);

    Common.addHandler(app, 'get', '/admin/response-times', _handleResponseTimesGet);

    Common.addHandler(app, 'get', '/admin/visits/orphaned-pos', _handleGetOrphanedPOS);

    Common.addHandler(app, 'get', '/admin/pos/duplicates', _handleGetDuplicatePOS);

    Common.addHandler(app, 'get', '/admin/logs', _handleGetLogs);

    Common.addHandler(app, 'get', '/admin/images/unused', _handleGetUnusedImages);

    Common.addHandler(app, 'get', '/admin/excipio-exports', _handleGetExcipioExports);

    //Common.addHandler(app, 'get', '/admin/samples/sample-visit-dates', _updateSampleVisitDates);

    //Common.addHandler(app, 'get', '/admin/samples/store-check-names', _updateSampleStoreCheckNames);
};

// === HANDLERS

function _deleteUserEnteredData(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        ActionAuditModule.removeAll(function() { // err_audit, res_audit
            AuditAssignmentModule.removeAll(function() { // err_audit_ass, res_audit_ass
                StoreCheckModule.removeAll(function() { // err_storecheck, res_storecheck
                    TemplateModule.removeAll(function() { // err_template, res_template
                        VisitModule.removeAll(function() { // err_visit, res_visit
                            SampleModule.removeAll(function() { // err_sample, res_sample
                                ActionAuditModule.report(caller, 'delete', 'user-data');
                                res.send({result: 'ok'}, 200);
                            });
                        });
                    });
                });
            });
        });
    });
}

function _handleRestartServer(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            Common.on404(req, res);
            return;
        }

        winston.log('restarting server');
        var exec = require('child_process').exec;
        exec('PowerShell ./scripts/restart.ps1', function callback(error, stdout, stderr) {
            if(!error) {
                res.send('{result: "ok"}');
                return;
            }

            exec('cd scripts/bash', function callback(error, stdout, stderr) {
                exec('./node_kill_all.sh', function callback(error, stdout, stderr) {
                    exec('./node_start.sh', function callback(error, stdout, stderr) {
                        res.send('{result: "ok"}');
                    });
                });
            });
        });
    });
}

function _deleteAllData(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        adminUtils.deleteAllData(function(err) {
            if(err) {
                res.send(err, 500);
                return;
            }
            res.send({result: 'ok'}, 200);
        });
    });
}

function _handleResponseTimesGet(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        //Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        res.send({
            response_times: responseTime.response_times,
            long_requests: responseTime.long_requests,
            long_request_threshold: responseTime.long_request_threshold,
            longest_requests: responseTime.longest_requests
        }, 200);
    });
}

function _handleResponseTimesDelete(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        //Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        if(req.param('times') || req.param('all')) {
            responseTime.clearResponseTimes();
        }

        if(req.param('long-requests') || req.param('all')) {
            responseTime.clearLongRequests();
        }

        if(req.param('longest-requests') || req.param('all')) {
            responseTime.clearLongestRequests();
        }

        res.send({ result: 'ok' }, 200);
    });
}

function _handleResourcesGet(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        node_server_monitor.disk_monitor.getDiskSpace(config['system']['drives'], function(err, disk_result) {
            node_server_monitor.cpu_monitor.getCPUHistory(function (cpu_result) {
                node_server_monitor.system_info.getInfo(function(info) {
                    info.sftp = config['sftp']['username'] + '@' + config['sftp']['host'] + ':' + config['sftp']['port'];

                    res.send({
                        cpu: cpu_result,
                        disk: disk_result,
                        info: info,
                        database: node_server_monitor.mongo_database_monitor.stats
                    })
                });
            });
        });
    });
}

function _handleTakeBackup(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        nodeUtils.runInBackground(function() {
            database_backup_job.doWork();
        });

        res.send('{"result": "ok"}');
    });
}

function _handleRestoreFromBackup(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        var path = req.param('path', null);
        if(!path) {
            res.send('a path must be specified', 500);
            return;
        }

        if(!fs.existsSync(path)) {
            res.send('the provided path does not exist', 500);
            return;
        }

        nodeUtils.runInBackground(function() {
            winston.info('began restoration from backup at ' + path);
            adminUtils.restoreFromBackup(path, function() {
                winston.info('restoration from backup at ' + path + ' complete');
            });
        });

        res.send('{"result": "ok"}');
    });
}

function _handleModifyDatabase(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        var action = req.param('action', null);
        if(!action) {
            res.send('an action must be specified', 500);
            return;
        }

        if(action == 'repair') {

            // compact in background - it could take a long time
            nodeUtils.runInBackground(function() {
                adminUtils.repairDatabase(req.param('db'), function(err_compact) {
                    if(err_compact) {
                        winston.error('an error occurred while compacting collection: ' + err_compact);
                    }
                });
            });

            // fire off a 200
            res.send({result: 'ok'}, 200);
            return;
        }

        res.send('unknown action', 500);
    });
}

function _handleModifyCollection(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        var action = req.param('action', null);
        if(!action) {
            res.send('an action must be specified', 500);
            return;
        }

        if(action == 'compact') {

            // compact in background - it could take a long time
            nodeUtils.runInBackground(function() {
                adminUtils.compactCollection(req.param('db'), req.param('collection'), function(err_compact) {
                    if(err_compact) {
                        winston.error('an error occurred while compacting collection: ' + err_compact);
                    }
                });
            });

            // fire off a 200
            res.send({result: 'ok'}, 200);
            return;
        }

        res.send('unknown action', 500);
    });
}

function _handleUserBecome(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        var user = req.param('user');
        if(_.isUndefined(user)) {
            Common.serviceErrorCallbacks.on500(req, res, 'must define user');
            return;
        }

        AccountManager.findOne({user: user}, function(err_user, user_data) {
            if(err_user != null || user_data == null) {
                winston.log('debug', 'sign-in failed for user with username=' + user);
                res.send(e, 400); // tODO: use cb
                return;
            }

            req.session.user = user_data;
            res.cookie('user', user_data.user, { maxAge: config.site.maxCookieAge });
            res.cookie('pass', user_data.pass, { maxAge: config.site.maxCookieAge });
            //req.session.save();
            winston.log('debug', 'assume id processed for user=' + req.session.user.name);
            res.send({result: 'ok'}, 200);
        });
    });
}

function _handleDeleteLogs(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        StoreCheckLogsDatabase.logs.remove({}, function(err_remove) {
            if(err_remove) {
                res.send(err_remove, 500);
                return;
            }
            res.send({result: 'ok'}, 200);
        });
    });
}

function _handleGetLogs(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        var query = {}, sort_by = {};
        nodeUtils.buildTableQuery(req.query.sort, req.query.filter,req.query.filter_date, query, sort_by);

        var fields = {
            _id: 1,
            timestamp: 1,
            level: 1,
            hostname: 1,
            label: 1,
            message: 1
        };

        database_general.query(StoreCheckLogsDatabase.logs,
            {
                query: query,
                fields: fields,
                sort_by: sort_by,
                page: req.query['page'],
                pageSize: req.query['pageSize'],
                case_sensitive: true
            },
            function(err_query, query_result) {
                if(err_query) {
                    res.send(err_query, 500);
                    return;
                }
                res.send(query_result, 200);
            }
        );
    });
}

function _handleDeleteExcipioExports(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        ExcipioExportLogsDatabase.excipio_exports.remove({},
            function(err_remove, remove_result) {
                if(err_remove) {
                    res.send(err_remove, 500);
                    return;
                }
                res.send(remove_result, 200);
            }
        );
    });
}


function _handleGetUnusedImages(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        res.send('under construction', 500);
        return;
        
        nodeUtils.runInBackground(function() {
            nodeUtils.processMatchingCollectionItems(
                ActionAuditModule.collection,
                500,
                {resource: 'image'},
                {},
                function(audit_batch, callback2) {
                    var image_urls = _.pluck(audit_batch, 'details');
                    var ids = _.pluck(audit_batch, '_id');

                    SampleModule.collection.find({
                        'sample.questions.image_url': {
                            $in: image_urls
                        }
                    }, function(err_samples, sample_results) {
                        if(err_samples) {
                            callback2(err_samples);
                        }

                        var found_urls = [], image_urls_for_sample;
                        sample_results.forEach(function(sample) {
                            image_urls_for_sample = _.pluck(sample.questions, 'image_urls');

                            // add each to found_urls
                        });

                        // TODO: do a diff between found_urls and image_urls to get the list of images

                        ActionAuditModule.collection.update(
                            {
                                _id: {$in: ids}
                            },
                            {
                                $set: {
                                    batch_update_time: new Date()
                                }
                            },
                            {
                                multi: true
                            }, function(err_update) {
                                callback2(err_update);
                            }
                        );
                    });
                },
                function(err_batch) {
                    winston.info('completed batch processing!');
                    //
                }
            );
        });
        res.send({result: 'ok'}, 200);
    });
}

function _handleGetExcipioExports(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        var query = {}, sort_by = {};
        nodeUtils.buildTableQuery(req.query.sort, req.query.filter, {}, query, sort_by);

        var fields = {
            _id: 1,
            destination: 1,
            timestamp: 1,
            sftp_retries: 1,
            visits: 1
        };

        database_general.query(ExcipioExportLogsDatabase.excipio_exports,
            {
                query: query,
                fields: fields,
                sort_by: sort_by,
                page: req.query['page'],
                pageSize: req.query['pageSize'],
                case_sensitive: true
            },
            function(err_query, query_result) {
                if(err_query) {
                    res.send(err_query, 500);
                    return;
                }
                res.send(query_result, 200);
            }
        );
    });
}

function _handlePointOfSaleA70(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        nodeUtils.runInBackground(function() {
            winston.debug('began merging a70 records');
            PointOfSaleHierarchyModule.mergeRecordsWithA70(PointOfSaleModule, function(err_merge, merge_result) {
                winston.debug('finished merging a70 records');
            });
        });

        res.send('began', 200);
    });
}

function _handlePointOfSaleRemoveEmpty(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        nodeUtils.runInBackground(function() {
            winston.info('removing empty POS entries');
            PointOfSaleModule.collection.remove({
                a59_code: '',
                company_name: '',
                address1: '',
                city: '',
                country: '',
                a53_code: '',
                a50_code: ''
            }, function(err_pos, pos_results) {

                winston.info('removed ' + pos_results + ' blank POS entries');

                PointOfSaleModule.collection.remove({
                    a59_code: {$exists: false},
                    company_name: {$exists: false},
                    address1: {$exists: false},
                    city: {$exists: false},
                    country: {$exists: false},
                    a53_code: {$exists: false},
                    a50_code: {$exists: false}
                }, function(err_pos, pos_results) {

                    winston.info('removed ' + pos_results + ' empty POS entries');
                })
            });
        });
        res.send('began', 200);
    });
}

function _handlePointOfSaleClean(req, res) {
    nodeUtils.runInBackground(function() {
        StaticLoadModule.findLatest('point-of-sale', function(err_load, load_info) {
            if(err_load) {
                winston.error('an error occurred while cleaning old, unused points of sale');
                return;
            }

            nodeUtils.processEntireCollection(PointOfSaleModule.collection, function(pos_batch, callback2) {

                var tasks = [], delete_ids = [], update_ids = [];

                // move any entries from the current static load (or user-entered) to update_ids
                update_ids = _.filter(pos_batch, function(pos) {
                    return pos.source != 'import' || pos.timestamp == load_info.timestamp;
                });
                update_ids = _.map(update_ids, function(pos) { return pos._id.toHexString(); });

                // remove any other pos entries
                var remaining_ids = _.filter(pos_batch, function(pos) {
                    return pos.source == 'import' && pos.timestamp != load_info.timestamp;
                });
                remaining_ids = _.map(pos_batch, function(pos){ return pos._id.toHexString(); });

                tasks.push(function(callback) {

                    // look for visits using a pos in the list
                    VisitModule.collection.distinct('pos_id', {pos_id: {$in: remaining_ids}}, function(err_distinct, distinct_results) {
                        if(err_distinct) {
                            callback(err_distinct);
                            return;
                        }

                        if(distinct_results.length == 0) {
                            delete_ids = remaining_ids;
                            callback();
                            return;
                        }

                        delete_ids = _.difference(remaining_ids, distinct_results);
                        update_ids = update_ids.concat(_.intersection(remaining_ids, distinct_results));

                        callback();
                    });
                });

                tasks.push(function(callback) {
                    // for all ids not deleted, mark them as updated
                    update_ids = _.map(update_ids, function(id) { return ObjectId(id); });
                    PointOfSaleModule.collection.update({_id: {$in: update_ids}}, {batch_update_time: new Date()}, {multi: true}, callback);
                });

                tasks.push(function(callback) {
                    delete_ids = _.map(delete_ids, function(id) { return ObjectId(id); });
                    PointOfSaleModule.collection.remove({_id: {$in: delete_ids}}, callback);
                });

                async.series(tasks, function(err_tasks, task_results) {
                    callback2(err_tasks, task_results);
                });
            }, function(err_updates) {
                winston.info('unreferenced point of sale culling complete');
            });
        });
    });
    res.send('began', 200);
}

function _updateSampleVisitDates(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            res.send('not found', 404);
            return;
        }

        sampleUtils.updateSampleVisitDates();
        res.send('began', 200);
    });
}

function _updateSampleTemperatureConformance(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            res.send('not found', 404);
            return;
        }

        sampleUtils.updateSampleTemperatureConformance();
        res.send('began', 200);
    });
}

function _updateSampleProductDescriptions(req, res) {
    nodeUtils.runInBackground(function() {
        SampleModule.applyChangeToAllSamples(function(samples, callback2) { // mutator
            var tasks = [];
            _.each(samples, function(sample) {

                // if visit info or date of visit undefined, mark it as processed
                if(!sample.product_info || !sample.product_info.name) {
                    tasks.push(function(callback) {
                        SampleModule.collection.update({_id: sample._id}, {$set: { batch_update_time: new Date()}}, function(err_update, update_result) {
                            callback(err_update, update_result);
                        });
                    });
                }

                // otherwise, attempt to update the date_of_visit timestamp
                tasks.push(function(callback) {
                    ProductModule.collection.findOne({_id: ObjectId(sample.product_id)}, function(err_product, product) {
                        if(err_product || !product) {
                            winston.error('while updating sample product name, product ' + sample.product_id + ' could not be found');
                            SampleModule.collection.update({_id: sample._id}, {$set: {batch_update_time: new Date()}}, function(err_update, update_result) {
                                callback(err_update, update_result);
                            });
                            return;
                        }

                        sample.product_info.name = product.description3;
                        SampleModule.collection.update({_id: sample._id}, {$set: {product_info: sample.product_info, batch_update_time: new Date()}}, function(err_update, update_result) {
                            callback(err_update, update_result);
                        });
                    });
                });
            });
            async.series(tasks, function(err_tasks, task_results) {
                callback2(err_tasks, task_results);
            });
        }, function(err_updates) {
            winston.info('sample product name update complete');
        });
    });
    res.send('began', 200);
}

function _updateSampleStoreCheckNames(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            res.send('not found', 404);
            return;
        }

        nodeUtils.runInBackground(function () {
            SampleModule.applyChangeToAllSamples(function (samples, callback2) { // mutator
                var tasks = [];
                _.each(samples, function (sample) {

                    // if visit_info not defined, we're screwed on this sample
                    if (!sample.visit_info) {
                        return;
                    }

                    // then, attempt to update the storecheck name
                    tasks.push(function (callback) {
                        StoreCheckModule.collection.findOne({_id: ObjectId(sample.visit_info.store_check_id)}, function (err_storecheck, storecheck) {
                            if (err_storecheck || !storecheck) {
                                winston.error('while updating storecheck name on a sample, storecheck ' + sample.visit_info.store_check_id + ' could not be found');
                                SampleModule.collection.update({_id: sample._id}, {$set: {batch_update_time: new Date()}}, function (err_update, update_result) {
                                    callback(err_update, update_result);
                                });
                                return;
                            }

                            sample.visit_info.store_check_name = storecheck.name;
                            SampleModule.collection.update({_id: sample._id}, {$set: {visit_info: sample.visit_info, batch_update_time: new Date()}}, function (err_update, update_result) {
                                callback(err_update, update_result);
                            });
                        });
                    });
                });
                async.series(tasks, function (err_tasks, task_results) {
                    callback2(err_tasks, task_results);
                });
            }, function (err_updates) {
                winston.info('sample storecheck name update complete');
            });
        });
        res.send('began', 200);
    });
}

function _updateSamplesReports(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            res.send('not found', 404);
            return;
        }

        setTimeout(function() {
            VisitReportModule.generateReports(function(err_reports) {

            });
        }, 0);

        res.send('ok', 200);
    });
}

function _updateSampleCompactQuestions(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            res.send('not found', 404);
            return;
        }

        nodeUtils.runInBackground(function () {
            SampleModule.applyChangeToAllSamples(function (samples, callback2) { // mutator
                var tasks = [], errored_sample_ids = [];

                /*
                var properties = [
                    ['l1_desc', 'level1_description'],
                    ['l1_desc2', 'level1_description2'],
                    ['l1_desc3', 'level1_description3'],
                    ['l2_desc', 'level2_description'],
                    ['l2_desc2', 'level2_description2'],
                    ['l2_desc3', 'level2_description3'],
                    ['l3_desc', 'level3_description'],
                    ['l3_desc2', 'level3_description2'],
                    ['l3_desc3', 'level3_description3'],
                    ['l4_desc', 'level4_description'],
                    ['l4_desc2', 'level4_description2'],
                    ['l4_desc3', 'level4_description3'],
                    ['l5_desc', 'level5_description'],
                    ['l5_desc2', 'level5_description2'],
                    ['l5_desc3', 'level5_description3'], // 10% savings on samples with lx_description compacting
                    ['l1_code', 'level1_code'],
                    ['l2_code', 'level2_code'],
                    ['l3_code', 'level3_code'],
                    ['l4_code', 'level4_code'],
                    ['l5_code', 'level5_code'] // .1% savings on samples with lx_code compacting

                ];
                */

                _.each(samples, function (sample) {

                    // only for ones that are ints, update the name
                    try {
                        sample.questions.forEach(function(question) {
                            /*
                            properties.forEach(function(property_pair) {
                                if(question[property_pair[1]]) {
                                    question[property_pair[0]] = question[property_pair[1]];
                                    delete question[property_pair[1]];
                                }
                            });
                            */

                            if(question.answers) { // 598 from 684 = 13% savings
                                question.answers.forEach(function(answer) {
                                    delete answer.date_added;
                                    delete answer.date_changed;
                                    delete answer.observations;
                                });
                            }
                        });
                        // then, attempt to update the storecheck name
                        tasks.push(function (callback) {
                            SampleModule.collection.update({_id: sample._id}, {$set: {questions: sample.questions, batch_update_time: new Date()}}, function (err_update, update_result) {
                                callback(err_update, update_result);
                            });
                        });

                        return;
                    } catch(ex) {}

                    errored_sample_ids.push(sample._id);
                });

                async.series(tasks, function (err_tasks, task_results) {

                    if(errored_sample_ids.length > 0) {
                        SampleModule.collection.update({_id: {$in: errored_sample_ids}}, {$set: {batch_update_time: new Date()}}, function (err_update) { // , update_result
                            callback2(err_update, task_results);
                        });
                        return;
                    }

                    callback2(err_tasks, task_results);
                });
            }, function (err_updates) {
                winston.info('sample compact update complete');
            });
        });
        res.send('began', 200);
    });
}

function _updateSampleNamesToInt(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            res.send('not found', 404);
            return;
        }

        nodeUtils.runInBackground(function () {
            SampleModule.applyChangeToAllSamples(function (samples, callback2) { // mutator
                var tasks = [], non_integer_sample_ids = [];

                _.each(samples, function (sample) {

                    // only for ones that are ints, update the name
                    try {
                        var name_as_int = parseInt(sample.name);
                        if(!isNaN(name_as_int)) {
                            sample.name = name_as_int;

                            // then, attempt to update the storecheck name
                            tasks.push(function (callback) {
                                SampleModule.collection.update({_id: sample._id}, {$set: {name: sample.name, batch_update_time: new Date()}}, function (err_update, update_result) {
                                    callback(err_update, update_result);
                                });
                            });
                            return;
                        }
                    } catch(ex) {}

                    non_integer_sample_ids.push(sample._id);
                });

                async.series(tasks, function (err_tasks, task_results) {

                    if(non_integer_sample_ids.length > 0) {
                        SampleModule.collection.update({_id: {$in: non_integer_sample_ids}}, {$set: {batch_update_time: new Date()}}, function (err_update) { // , update_result
                            callback2(err_update, task_results);
                        });
                        return;
                    }

                    callback2(err_tasks, task_results);
                });
            }, function (err_updates) {
                winston.info('sample name update complete');
            });
        });
        res.send('began', 200);
    });
}

/*
function _updateWeightsOfSampleBatch(callback2) {
    SampleModule.collection.find({weight_update_time: {$exists: false}}).limit(500).toArray(function(err_find, samples) {
        if(err_find) {
            callback2(err_find);
            return;
        }

        if(!samples || samples.length == 0) {
            callback2(null);
            return;
        }

        _updateWeightsOfSamples(samples, function(err_update, update_result) {
            if(err_update) {
                callback2(err_update);
                return;
            }

            nodeUtils.recursiveWrapper(function() {
                _updateWeightsOfSampleBatch(callback2);
            });
        });
    });
}

function _updateWeightsOfSamples(samples, callback2) {
    // get a unique list of the templates used by these samples
    var template_ids = _.uniq(_.pluck(samples, 'template_id'));

    TemplateModule.listByIds(template_ids, function(err_templates, templates) {
        if(err_templates) {
            callback2(err_templates);
            return;
        }

        var update_tasks = [];

        // convert template ids to strings
        templates = _.map(templates, function(template) { template._id = template._id.toHexString(); return template; });

        // for each sample, go through the questions and make sure the weights match
        _.each(samples, function(sample) {
            var template = _.findWhere(templates, {_id: sample.template_id});
            var updated = false;

            if(_.isUndefined(template)) {
                winston.error('could not find template ' + sample.template_id);
                return;
            }

            // template.records[0].questions should have its weights clobber weights in the sample
            _.each(sample.questions, function(question) {
                var template_question = _.findWhere(template.records[0].questions, {identity_id: question.identity_id});

                if(_.isUndefined(template_question)) {
                    winston.error('could not find question ' + question.identity_id + ' for template ' + sample.template_id);
                    return;
                }

                _.each(question.answers, function(answer) {
                    var template_answer = _.findWhere(template_question.answers, {identity_id: answer.identity_id});

                    if(_.isUndefined(template_answer)) {
                        winston.error('could not find answer ' + answer.identity_id + ' for template ' + sample.template_id);
                        return;
                    }

                    // clobber, push task
                    updated = true;
                    answer.weight = template_answer.weight;
                });
            });

            if(updated) {
                // TODO: push update task
                update_tasks.push(function(callback) {
                    SampleModule.collection.update({_id: sample._id}, {$set: {questions: sample.questions, weight_update_time: new Date()}}, function(err_update, update_result) {
                        callback(err_update, update_result);
                    });
                });
            }
        });

        if(update_tasks.length > 0) {
            async.series(update_tasks, function(err_async, async_results) {
                callback2(err_async, async_results);
            });
            return;
        }

        callback2(null, null);
    });
}

function _ensureWeightsAccurate() {
    nodeUtils.runWhenDbLoaded(SampleModule, function() {
        _updateWeightsOfSampleBatch(function(err, result) {
            // TODO: log complete?
        });
    });
}

//_ensureWeightsAccurate();
*/

// THROWAWAY UPDATE METHODS
/*
function _handleRefreshT01(req, res) {
    Common.ensureUserInSession(req, res, Common.serviceErrorCallbacks.userNotInSession, function(caller) {
        if(caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.authFailed(req, res);
            return;
        }

        function _fillInT01CodeForTemplate(templates, callback) {
            if(templates.length == 0) {
                callback(null, []);
                return;
            }

            var template = templates.shift();

            winston.debug('updating template ' + template._id.toHexString() + ' without t01 code');

            //company_id, t03_code, timestamp, L1_t02_codes
            HierarchyModule5.findEntries(
                template.records[0].company_id,
                template.records[0].t03_code,
                template.records[0].timestamp_L5,
                undefined,
                function(err, L5_entries) {
                    if(err) {
                        callback(err);
                        return;
                    }
                    if(L5_entries.length == 0) {
                        winston.error('during t01 refresh, L5 entry not found');
                        //callback('L5 entry not found');

                        nodeUtils.recursiveWrapper(function() {
                            _fillInT01CodeForTemplate(templates, callback);
                        });
                        return;
                    }

                    template.records[0].t01_code = L5_entries[0].level1_t02_code;

                    TemplateModule.collection.update(
                        {_id: template._id},
                        {$set: {records: template.records}},
                        function(err_update) { // update_result
                            if(err_update) {
                                callback(err_update);
                                return;
                            }
                            winston.debug('successfully updated t01 code of template ' + template._id.toHexString());
                            nodeUtils.recursiveWrapper(function() {
                                _fillInT01CodeForTemplate(templates, callback);
                            });
                        }
                    );
                }
            );
        }

        winston.debug('looking for templates without t01 codes');

        // get all templates that don't have a records[0].t01_code
        TemplateModule.find({'records.t01_code': {$exists: false}}, function(err_templates, templates) {
            if(err_templates) {
                res.send(err_templates, 500);
                return;
            }

            winston.debug('updating ' + templates.length + ' templates without t01 codes');

            _fillInT01CodeForTemplate(templates, function(err_fill) { // err_fill, fill_results
                if(err_fill) {
                    winston.error('during t01 update: ' + err_fill);
                    res.send(err_fill, 500);
                    return;
                }
                _handleUpdateSamplesT01(req, res);
            });
        });
    });
}

function _handleUpdateSamplesT01(req, res) {
    Common.ensureUserInSession(req, res, Common.serviceErrorCallbacks.userNotInSession, function(caller) {
        if (caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.authFailed(req, res);
            return;
        }

        Common.logRequest(req, true, caller);

        SampleModule.collection.find({
            $or: [
                {'template_info.t01_code': {$exists: false}},
                {'template_info.t01_code': null}
            ]
        }).toArray(function (err_find, sample_results) {
            _doUpdateSamplesT01(sample_results, function (err_update, update_results) {
                if (err_update) {
                    res.send(err_update, 500);
                    return;
                }

                winston.debug('successfully completed t01 sample update');
                res.send(update_results, 200);
            });
        });
    });
}

function _doUpdateSamplesT01(samples, callback) {
    if(samples.length == 0) {
        callback(null, []);
        return;
    }

    var sample = samples.shift();

    winston.debug(samples.length + ' samples remaining for t01 update');

    TemplateModule.findOneById(sample.template_id, function(err_template, template) {
        if(err_template) {
            callback(err_template);
            return;
        }

        if(!template.records[0].t01_code) {
            winston.error('did not update sample(s) t01 for template ' + template._id.toHexString());
            nodeUtils.recursiveWrapper(function() { _doUpdateSamplesT01(samples, callback); });
            return;
        }

        SampleModule.collection.update(
            { _id: sample._id },
            {
                $set: {
                    'template_info.t01_code': template.records[0].t01_code
                }
            },
            function(err_update) {  // update_results
                if(err_update) {
                    callback(err_update);
                    return;
                }

                nodeUtils.recursiveWrapper(function() { _doUpdateSamplesT01(samples, callback); });
            }
        )
    });
}
*/

/*
function _handleEnsureUserHasState(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles[0] == 'admin') {
            var query = AM.collection.find({ state: { $exists: false}});

            query.each(function(err, user) {
                if(user == null) {
                    res.send({result: 'ok'}, 200);
                } else {
                    user.state = "active";
                    AM.save(user);
                }
            });
            query.close();
        } else {
            Common.viewErrorCallbacks.on404(req, res);
        }
    });
}
*/

/*
function _handleEnsureAuditTeamStatesExist(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            Common.viewErrorCallbacks.on404(req, res);
            return;
        }
        if(caller.roles[0] == 'admin') {
            var query = AuditTeamModule.collection.find({ state: { $exists: false}});

            query.each(function(err, team) {
                if (team == null) {
                    ActionAuditModule.report(caller, 'update', 'audit-teams/state', 'ensure');
                    res.send({result: 'ok'}, 200);
                } else {
                    team.state = "active";
                    AuditTeamModule.save(team);
                }
            });

            query.close();
        }
    });
}
 */

function _handleFixOrphanedPOS(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function (caller) {
        Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            res.send('not found', 404);
            return;
        }

        _fixMissingPOS(function(err_visits, visits) {
            if(err_visits) {
                res.send(err_visits, 500);
                return;
            }
            res.send(visits, 200);
        });
    });
}

function _handleFixOrphanedVisitPOS(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function (caller) {
        Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            res.send('not found', 404);
            return;
        }

        _fixVisitsWithOrphanedPOS(function(err_visits, visits) {
            if(err_visits) {
                res.send(err_visits, 500);
                return;
            }
            res.send(visits, 200);
        });
    });
}

function _getMissingPosIdsForVisits(callback2) {
    VisitModule.collection.distinct('pos_id', function(err_pos_id, pos_ids) {
        if(err_pos_id) {
            callback2(err_pos_id, []);
            return;
        }

        pos_ids = _.map(pos_ids, function(id) { return ObjectId(id);});
        PointOfSaleModule.collection.find({_id: {$in: pos_ids}}, {_id: 1}).toArray(function(err_pos, pos_for_visits) {
            var pos_results = _.flatten(_.pluck(pos_for_visits, '_id'));
            pos_results = _.map(pos_results, function(id) { return id.toHexString();});

            pos_ids = _.map(pos_ids, function(id) { return id.toHexString();});

            var missing = _.difference(pos_ids, pos_results);
            callback2(null, missing);
        });
    });
}

function _getVisitIdsWithOrphanedPOS(callback2) {
    _getMissingPosIdsForVisits(function(err_missing, missing) {
        if(err_missing) {
            callback2(err_missing);
            return;
        }

        if(missing.length == 0) {
            callback2(null, []);
            return;
        }

        VisitModule.collection.distinct('_id', {pos_id: {$in: missing}}, function(err_pos, missing_visit_list) {
            callback2(null, missing_visit_list);
        });
    });
}

function _fixVisitsWithOrphanedPOS(callback2) {
    _getVisitIdsWithOrphanedPOS(function(err_visit_ids, visit_ids) {
        if(err_visit_ids) {
            callback2(err_visit_ids);
            return;
        }

        // TODO: stuff
        VisitModule.collection.find({_id: {$in: visit_ids}}, {_id: 1, pos_name: 1, organization: 1}).toArray(function(err_visits, visit_metas) {

            var company_names = _.pluck(visit_metas, 'pos_name');
            PointOfSaleModule.collection.find({company_name: {$in: company_names}}, {_id: 1, organization: 1, company_name: 1})
                .sort({_id: -1})
                .toArray(function(err_pos, pos_metas) {
                    var tasks = [];

                    _.each(visit_metas, function(visit_info) {
                        tasks.push(function(callback) {
                            var pos_to_use = _.findWhere(pos_metas, {company_name: visit_info.pos_name, organization: visit_info.organization});

                            if(!pos_to_use) {
                                winston.error(visit_info.pos_name + ' not matched');
                                callback();
                                return;
                            }

                            // TODO: update visit, etc

                            callback();
                        });
                    });

                    async.series(tasks, function(err_tasks, tasks) {
                        callback2(null, []);
                    });
                }
            );
        });
    });
}

function _fixMissingPOS(callback2) {
    _getVisitIdsWithOrphanedPOS(function(err_visit_ids, visit_ids) {
        if(err_visit_ids) {
            callback2(err_visit_ids);
            return;
        }

        if(!visit_ids || visit_ids.length == 0) {
            callback2(null, []);
            return;
        }

        VisitModule.collection.find({_id: {$in: visit_ids}}, {_id: 1, pos_id: 1, pos_name: 1, organization: 1}).toArray(function(err_visits, visit_metas) {

            var company_names = _.pluck(visit_metas, 'pos_name');
            PointOfSaleModule.collection.find({company_name: {$in: company_names}})
                .sort({_id: -1})
                .toArray(function(err_pos, pos_metas) {
                    var tasks = [];

                    var visit_info = visit_metas[3];
                    //_.each(visit_metas, function(visit_info) {
                        tasks.push(function(callback) {
                            var pos_to_use = _.findWhere(pos_metas, {company_name: visit_info.pos_name, organization: visit_info.organization});

                            if(!pos_to_use) {
                                winston.error(visit_info.pos_name + ' not matched');
                                callback();
                                return;
                            }

                            console.log('adding pos ' + visit_info.pos_id + ' back with the info from ' + pos_to_use._id.toHexString());
                            console.log(JSON.stringify(pos_to_use));
                            pos_to_use._id = ObjectId(visit_info.pos_id);
                            // TODO: insert pos_to_use into PointOfSaleModule

                            PointOfSaleModule.collection.insert(pos_to_use, function(err_insert, insert_result) {
                                console.log(visit_info._id.toHexString() + ' should be fixed');
                                callback();
                            });
                        });
                    //});

                    async.series(tasks, function(err_tasks, tasks) {
                        callback2(null, []);
                    });
                }
            );
        });
    });
}

function _handleGetDuplicatePOS(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function (caller) {
        Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            res.send('not found', 404);
            return;
        }

        posUtils.getPosDuplicates(
            {
                imports_only: (req.param('imports-only', "false") == 'true')
            },
            function(err_dups, duplicates) {
                if(err_dups) {
                    res.send(err_dups);
                    return;
                }

                res.send(duplicates, 200);
            }
        );
    });
}

function _handleGetOrphanedPOS(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function (caller) {
        Common.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            res.send('not found', 404);
            return;
        }

        VisitModule.collection.distinct('pos_id', function(err_pos_id, pos_ids) {
            if(err_pos_id) {
                res.send(err_pos_id, 500);
                return;
            }

            pos_ids = _.map(pos_ids, function(id) { return ObjectId(id);});
            PointOfSaleModule.collection.find({_id: {$in: pos_ids}}).toArray(function(err_pos, pos) {

                var pos_results = _.flatten(_.pluck(pos, '_id'));

                pos_results = _.map(pos_results, function(id) { return id.toHexString();});
                pos_ids = _.map(pos_ids, function(id) { return id.toHexString();});

                var missing = _.difference(pos_ids, pos_results);

                if(missing.length == 0) {
                    res.send('none missing', 200);
                    return;
                }
                /*
                 VisitModule.collection.distinct('organization', {pos_id: {$in: missing}}, function(err_pos, missing_visit_list) {
                     console.log('query done');
                     res.send(missing_visit_list, 200);
                 });
*/
                VisitModule.collection.find({pos_id: {$in: missing}}).toArray(function(err_pos, missing_visit_list) {
                    if(err_pos) {
                        res.send(err_pos, 500);
                        return;
                    }
                    res.send(missing_visit_list, 200);
                });

/*
                VisitModule.collection.distinct('pos_name', {pos_id: {$in: missing}}, function(err_pos, missing_visit_list) {
                    PointOfSaleModule.collection.find({company_name: {$in: missing_visit_list}}).toArray(function(err_pos, pos) {
                        res.send(missing_visit_list.length, 200);
                    });
                 });
                 */
            });
        });
    });
}