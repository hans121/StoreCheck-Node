var _ = require('underscore');
var async = require('async');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var excipio_export = require('../../modules/excipio/excipio-export');
var schema = require('../../modules/model/schema/schema');
var formatter = require('../../modules/view-formatter');
var nodeUtils = require('../../modules/node-utils');
var xlsx_custom = require('../../ext/xlsx');
var xlsx_util = require('../../modules/xlsx-util');

var Common = require('../router-common');

var ActionAuditModule = require('../../modules/action-audit');
var AuditAssignmentModule = require('../../modules/model/audit-assignment');
var excipio_export = require('../../modules/excipio/excipio-export');
var PointOfSaleModule = require('../../modules/model/hierarchy/point-of-sale');
var ProductModule = require('../../modules/model/hierarchy/product');
var SampleModule = require('../../modules/model/sample');
var StoreCheckModule = require('../../modules/model/store-check');
var VisitModule = require('../../modules/model/visit');

module.exports = function(app) {

    // Creates a store check
    //
    // Error conditions:
    //     - Caller isn't authorized to create store checks
    //     - The request body fails validation against the schema
    //
    // Notes:
    //     - See _createStoreCheck
    Common.addHandler(app, 'put', '/store-check', _handleCreateStoreCheck);

    // Deletes a (non-closed) store check
    //
    // Error conditions:
    //     - Caller isn't authorized to delete store checks
    //     - See RouterCommon.getByIdIfAuthorized
    //     - The store check has been closed
    Common.addHandler(app, 'delete', '/store-check/:id', _handleDeleteStoreCheck);

    // Deletes the audit assignment for a (non-closed) store check
    //
    // Error conditions:
    //     - Caller isn't authorized to delete audit assignments
    //     - See RouterCommon.getByIdIfAuthorized(store-check)
    //     - The store check has been closed
    //
    // Notes:
    //     - Deleting an non-existent assignment is not an error (we want to let users clear assignments with this)
    Common.addHandler(app, 'delete', '/store-check/:id/audit-assignment', _handleDeleteStoreCheckAssignment);

    // Updates a (non-closed) store check in various ways: update, duplicate, update state
    //
    // Error conditions:
    //     - See getByIdIfAuthorized (store check)
    //     - An action was specified, but it was not recognized
    //     - The caller does not have access to update store checks
    //     - see _updateStoreCheckState
    //     - see _duplicateStoreCheck
    //     - see _updateStoreCheck
    //     - A duplicate action was specified, but a name was not provided
    //
    // Notes:
    //     - Acceptable parameters: state={state}, action={"duplicate"}
    //     - admins can use this to re-open store checks
    Common.addHandler(app, 'post', '/store-check/:id', _handleUpdateStoreCheck);

    Common.addHandler(app, 'post', '/store-check/:id/samples', _handleUpdateStoreCheckSamples);

    // === GET REQUESTS

    // Gets a store check by ID
    //
    // Error conditions:
    //     - See RouterCommon.getResourceById
    Common.addHandler(app, 'get', '/store-check/:id', function(req, res) {
        Common.getResourceById(req, res, 'get', '/store-check/:id', 'store-check', StoreCheckModule);
    });

    // Gets visits for a given store check
    //
    // Query parameters:
    //     - statuses (optional) - a comma-separated list of statuses of visits that are to be included in the results
    //
    // Error conditions:
    //     - User does not have visit "list" access or audit-team visit "list" access
    //     - The request body fails validation against the schema
    //     - the id passed in is not in the valid format
    Common.addHandler(app, 'get', '/store-check/:id/visits', _handleGetVisitsForStoreCheck);

    // Gets products for a given store check
    //
    // Error conditions:
    //     - User does not have product "list" access or store-check "read" access
    //     - The id passed in is not in the valid format
    Common.addHandler(app, 'get', '/store-check/:id/products', _handleGetProductsForStoreCheck);

    Common.addHandler(app, 'get', '/store-checks', _handleListStoreChecks);
};

// === REQUEST HANDLERS

function _handleCreateStoreCheck(req, res) {
    Common.ensureHasAccess(req, res, 'store-check', 'c', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var validation = schema.validate(req.body, schema.createStoreCheckSchema);
        if(validation.errors.length == 0) {
            _createStoreCheck(req, res, caller, req.param('name'), formatter.formatDate(req.param('reportDate')), req.param('notes'), req.param('type'), []);
        } else {
            if(validation.errors[0].uri.indexOf('name') != -1) {
                res.send('A name must be provided', 500);
                return;
            }

            if(validation.errors[0].uri.indexOf('reportDate') != -1) {
                res.send('A report date must be provided', 500);
                return;
            }

            winston.log('warn', 'a POST /store-check request from user=' + caller.name + ' had validation errors: ' + validation.errors);
            Common.pushMessage(req, 'error', 'Failed to create store check because the request had format errors');
            res.send(validation.errors, 500);
        }
    });
}

function _handleDeleteStoreCheck(req, res) {
    Common.ensureHasAccess(req, res, 'store-check', 'd', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        // get the resource via a convenience method that does the necessary security checks and id validation
        Common.getByIdIfAuthorized(req, res, req.param('id'), 'store-check', StoreCheckModule, Common.serviceErrorCallbacks, function(storecheck) {
            StoreCheckModule.delete({
                _id : storecheck._id,
                state: { $ne: "closed" }
            }, function(e){
                if(e) {
                    ActionAuditModule.report(caller, 'delete', 'store-check', '"' + storecheck.name + '" (' + storecheck._id.toHexString() + ')');
                    winston.log('debug', 'a DELETE /store-check request from user=' + caller.name + ' has succeeded');
                    Common.pushMessage(req, 'success', 'Store check "' + storecheck.name + '" was successfully deleted');
                    res.send({result: 'ok'}, 200);
                }	else{
                    winston.log('warn', 'a DELETE /store-check request from user=' + caller.name + ' failed');
                    Common.pushMessage(req, 'success', 'Failed to delete store check "' + storecheck.name + '"');
                    res.send(e, 400);
                }
            });
        });
    });
}

function _handleDeleteStoreCheckAssignment(req, res) {
    Common.ensureHasAccess(req, res, 'audit-assignment', 'd', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        // get the resource via a convenience method that does the necessary security checks and id validation
        Common.getByIdIfAuthorized(req, res, req.param('id'), 'store-check', StoreCheckModule, Common.serviceErrorCallbacks, function(storecheck) {
            if(storecheck.state == 'closed') {
                winston.log('debug', 'a DELETE /store-check/:id/audit-assignment request from user=' + caller.name + ' has failed because the store check was closed');
                Common.pushMessage(req, 'success', 'Successfully unassigned team from store check "' + storecheck.name + '"');
                Common.serviceErrorCallbacks.on500(req, res, 'the specified store check was closed');
            } else {
                AuditAssignmentModule.delete({ storecheck_id : storecheck._id.toHexString()}, function(e){
                    if(e == 0) {
                        // Deleting an already-deleted assignment shouldn't be an issue.  TODO: search first to see if there is one, so we know if an error happened

                        //winston.log('error', 'a DELETE /store-check/:id/audit-assignment request from user=' + caller.name + ' has failed');
                        //Common.pushMessage(req, 'error', 'Failed to unassign team from store check "' + storecheck.name + '"');
                        //res.send('audit-assignment not terminated', 500);
                        res.send({result: 'ok'}, 200);
                    } else {
                        ActionAuditModule.report(caller, 'delete', 'audit-assignment', '"' + storecheck.name + '" (' + storecheck._id.toHexString() + ') assignment cleared');
                        winston.log('debug', 'a DELETE /store-check/:id/audit-assignment request from user=' + caller.name + ' has succeeded');
                        Common.pushMessage(req, 'success', 'Successfully unassigned team from store check "' + storecheck.name + '"');
                        res.send({result: 'ok'}, 200);
                    }
                });
            }
        });
    });
}

function _handleUpdateStoreCheck(req, res) {
    Common.ensureHasAccess(req, res, 'store-check', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        // get the resource via a convenience method that does the necessary security checks and id validation
        Common.getByIdIfAuthorized(req, res, req.param('id'), 'store-check', StoreCheckModule, Common.serviceErrorCallbacks, function(storecheck) {
            if(storecheck.state != 'closed' || ((caller.roles.indexOf('admin') != -1 || caller.roles.indexOf('exec') != -1) && req.query['state'] == 'active')) {

                // setting state
                if(req.query["state"] != null) {
                    var state = req.query["state"];
                    _updateStoreCheckState(caller, req, res, storecheck, state);

                    // taking action
                } else if(req.query["action"] != null) {

                    if(req.query["action"] == "duplicate") {
                        if(typeof(req.body.name) != 'undefined') {
                            _createStoreCheck(req, res, caller, req.body.name, storecheck.reportDate, storecheck.notes, storecheck.type, storecheck.sample_types);
                        } else {
                            Common.serviceErrorCallbacks.on500(req, res, 'name must be specified');
                        }
                    } else {
                        Common.serviceErrorCallbacks.on500(req, res, 'the specified action ' + req.query["action"] + ' was not recognized');
                    }

                    // general update
                } else {
                    _updateStoreCheck(caller, req, res, storecheck);
                }
            } else {
                Common.serviceErrorCallbacks.on500(req, res, 'the specified store check has been closed');
            }
        });
    });
}

function _handleUpdateStoreCheckSamples(req, res) {
    Common.ensureHasAccess(req, res, 'store-check', 'r', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        // get the resource via a convenience method that does the necessary security checks and id validation
        var id = req.param('id');
        Common.getByIdIfAuthorized(req, res, id, 'store-check', StoreCheckModule, Common.serviceErrorCallbacks, function (storecheck) {
            if (req.param('action')) {

                // TODO: check action

                ActionAuditModule.report(caller, 'export', 'store-check', '"' + storecheck.name + '" (' + storecheck._id.toHexString() + ') samples exported');
                Common.pushMessage(req, 'success', 'Successfully started export of all samples for store check "' + storecheck.name + '"');

                nodeUtils.runInBackground(function() {
                    excipio_export.exportStoreCheck(id, caller.user, function(err_export, export_results) {
                        if(err_export) {
                            winston.error('an error occurred during excipio export of store check ' + id);
                            return;
                        }
                        winston.debug('excipio export of store check ' + id + ' compeleted');
                    });
                });
                res.send('{result: "began"}', 200);
                return;
            }
            Common.serviceErrorCallbacks.on500(req, res, 'unrecognized parameter');
        });
    });
}

function _handleGetVisitsForStoreCheck(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {

        // because we have two OR conditions for access, we manually check them
        if(Common.userHasAccess(caller, 'visit',  'l') || Common.userHasAccess(caller, 'audit-team/visit', 'l')) {
            Common.getByIdIfAuthorized(req, res, req.params['id'], 'store-check', StoreCheckModule, Common.serviceErrorCallbacks, function(storecheck) {
                Common.logRequest(req, true, caller);

                async.series({

                    visits: function(callback) {

                        // filter store checks by status if a status was provided as a query parameter
                        var statuses = req.query.statuses;
                        if(!statuses) {
                            VisitModule.getVisitsForStoreCheck(req.params['id'], undefined, function(err, items) {
                                callback(err, items);
                            });
                            return;
                        }

                        VisitModule.getVisitsForStoreCheckWithStatuses(req.params['id'], statuses.split(','), function(err, items) {
                            callback(err, items);
                        });
                    }

                }, function(err, results) {
                    if(err != null) {
                        res.send(err, 500);
                        return;
                    }
                    if(results == null || results.visits == null) {
                        res.send([], 200);
                        return;
                    }

                    _fillInPointOfSaleInfoForVisits(results.visits, function(err, visits_post_process) {
                        if(visits_post_process) {
                            res.send(visits_post_process, 200);
                        } else {
                            winston.log('warn', 'a GET /store-check/' + req.params['id'] + '/visits request from user=' + caller.name + ' failed');
                            res.send(err, 500);
                        }
                    });
                });
            });

        } else {
            Common.onAuthFailedForServiceMethod(req, res);
        }
    });
}

function _handleGetProductsForStoreCheck(req, res) {
    Common.ensureHasAccess(req, res, 'product', 'l', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        Common.getByIdIfAuthorized(req, res, req.params['id'], 'store-check', StoreCheckModule, Common.viewErrorCallbacks, function(storecheck) {
            if(typeof(storecheck.sample_types) != 'undefined' && storecheck.sample_types.length > 0) {
                var product_ids = storecheck.sample_types.map(function(sampleTuple) {return sampleTuple.product_id;});
                product_ids = product_ids.filter(function(e, i, a) { return product_ids.indexOf(e) == i; }); // product id set
                ProductModule.listByIds(product_ids, Common.queryResultHandler(req, res, Common.serviceErrorCallbacks, function(results) {
                    res.send(results, 200);
                }));
            } else {
                res.send([], 200);
            }
        });
    });
}

// TODO: allow for materialization from mongo
function _handleListStoreChecks(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.listStoreChecks(req, res, caller, ['active', 'closed'], exports.viewErrorCallbacks, function(storechecks) {
            // TODO: this is shitty mcshitshit without materialization.  Need RC.listStoreCheckIds but I have no time at all to work on this project.
            var query = {}, sort_by = {};
            nodeUtils.buildTableQuery(req.query.sort, req.query.filters, {}, query, sort_by, []);

            var storecheck_ids = _.pluck(storechecks, '_id');
            query._id = {$in: storecheck_ids};

            var limit = 2000;
            if(req.query.limit) {
                try {
                    limit = parseInt(req.query.limit);
                } catch(ex) {
                    winston.error('storecheck query limit could not be parsed as an int');
                }
            }

            StoreCheckModule.collection.find(query).limit(limit).sort(sort_by).toArray(function(err_storechecks, storechecks) {
                _applyMaterializationAndRespond(req, res, storechecks);
            });
        });
    });

    function _applyMaterializationAndRespond(req, res, storechecks) {
        // get materialization fields from req
        if(typeof(req.query['fields']) != 'undefined') {
            var field_values = req.query['fields'].split(',');

            res.send(_.map(storechecks, function(storecheck) {
                return _.pick(storecheck, field_values);
            }), 200);
            return;
        }

        res.send(storechecks, 200);
    }
}

// A helper that does no validation, but specializes in the details of creating a store check
//
// Error conditions:
//     - Something went wrong when using the mongo node driver
function _createStoreCheck(req, res, caller, name, reportDate, notes, type, sample_types) {
    var currentTimeString = formatter.getCurrentUtcTimeString();
    StoreCheckModule.insert({
        name 	        : name,
        reportDate	    : reportDate,
        notes           : notes,
        last_update_time: currentTimeString,
        creation_time   : currentTimeString,
        version         : schema.currentVersion,
        organization    : caller.active_organization,
        state           : "active",
        type            : type,
        sample_types    : sample_types
    }, function(e){
        if(e) {
            ActionAuditModule.report(caller, 'create', 'store-check', '"' + name + '" (' + e[0]._id.toHexString() + ')');
            winston.log('debug', 'a POST /store-check request from user=' + caller.name + ' has succeeded');
            Common.pushMessage(req, 'success', 'Store check "' + name + '" was created successfully');
            res.send(e[0]._id, 200);
        } else {
            winston.log('warn', 'a POST /store-check request from user=' + caller.name + ' failed');
            Common.pushMessage(req, 'error', 'Failed to create store check "' + name + '"');
            res.send(e, 400);
        }
    });
}

// A helper that does no validation, but specializes in the details of updating a store check
//
// Error conditions:
//     - Something went wrong when using the mongo node driver
function _updateStoreCheck(caller, req, res, storecheck) {
    var validation = schema.validate(req.body, schema.updateStoreCheckSchema);
    if(validation.errors.length == 0) {
        StoreCheckModule.update({
            query: { _id : storecheck._id },
            value: {
                $set : {
                    name 	        : req.param('name'),
                    reportDate	    : formatter.formatDate(req.param('reportDate')),
                    notes           : req.param('notes'),
                    type            : req.param('type'),
                    last_update_time: formatter.getCurrentUtcTimeString()
                }
            }
        }, function(e){
            if(!e) {
                winston.log('warn', 'a POST /store-check request from user=' + caller.name + ' failed');
                Common.pushMessage(req, 'error', 'Failed to update store check "' + req.param('name') + '"');
                res.send('Failed to update store check', 400);
                return;
            }

            SampleModule.collection.update({
                    'visit_info.store_check_id': storecheck._id.toHexString()
                },
                {
                    $set: { 'visit_info.store_check_name': req.param('name') }
                },
                {
                    multi: true
                }, function(err_update) { // update_result
                    if(err_update) {
                        winston.error('failed to update samples visit_info.store_check_name ' + err_update);
                    }
                    ActionAuditModule.report(caller, 'update', 'store-check', '"' + storecheck.name + '" (' + storecheck._id.toHexString() + ')');
                    winston.log('debug', 'a POST /store-check request from user=' + caller.name + ' has succeeded');
                    Common.pushMessage(req, 'success', 'Store check "' + req.param('name') + '" was updated successfully');
                    res.send({result: 'ok'}, 200);
                }
            );
        });
    } else {
        winston.log('warn', 'a POST /store-check request from user=' + caller.name + ' had validation errors: ' + validation.errors);
        res.send(validation.errors, 500);
    }
}

// A helper that does no validation, but specializes in the details of updating a store check's state.
// Will initiate an excipio export if a store check state is set to "released"
//
// Error conditions:
//     - Something went wrong when using the mongo node driver
//     - An error occurred while exporting to excipio
function _updateStoreCheckState(caller, req, res, storecheck, state) {
    var state_attribute = state + '_time';
    var set_value = { state: state };

    var currentTimeString = formatter.getCurrentUtcTimeString();
    set_value[state_attribute] = currentTimeString;
    set_value['last_update_time'] = currentTimeString;

    StoreCheckModule.collection.update(
        { _id : storecheck._id },
        { $set : set_value },
        function(err, update_count) {
            if(err || update_count == 0) {
                winston.log('error', 'a POST /store-check/' + storecheck._id.toHexString() + ' request from user=' + caller.name + ' failed, message=' + err);
                Common.pushMessage(req, 'error', 'Failed to update store check state to "' + state + '"');
                res.send(err, 400);
                return;
            }

            if(state != 'inactive' && state != 'closed') {
                winston.log('debug', 'a POST /store-check/' + storecheck._id.toHexString() + ' request from user=' + caller.name + ' has succeeded');
                Common.pushMessage(req, 'success', 'Updated store check state to "' + state + '"');
                res.send({result: 'ok'}, 200);
                return;
            }

            ActionAuditModule.report(caller, 'update', 'store-check/state',
                '"' + storecheck.name + '" (' + storecheck._id.toHexString() + ') set to ' + state);

            VisitModule.setVisitStatusesForStoreCheck(storecheck._id.toHexString(), 'submitted', function(err_visit_update) {
                if(err_visit_update != null) {
                    winston.error('failed to update status of visits for terminated store check');
                }

                if(update_count == 0) {
                    winston.warn('update storecheck state indicated that zero docs were updated while updating ' + storecheck._id.toHexString());
                }

                AuditAssignmentModule.setAssignmentStatusesForStoreCheck(storecheck._id.toHexString(), 'inactive', function(err_assignments, assignment_update_count) {
                    if(err_assignments != null) {
                        winston.error('failed to update status of visits for terminated store check');
                    }

                    if(state == 'closed') {
                        excipio_export.exportStoreCheck(storecheck._id.toHexString(), caller.user, function(err, success) {
                            if(err == null) {
                                winston.log('debug', 'a Successfully archived store check ' + storecheck._id.toHexString() + ' and released samples');
                                Common.pushMessage(req, 'success', 'Successfully archived store check and released samples');
                                res.send({result: 'ok'}, 200);
                            } else {
                                Common.pushMessage(req, 'error', 'Failed to publish excipio data for store check ' + storecheck._id.toHexString());
                                Common.serviceErrorCallbacks.on500(req, res, 'failed to publish store check ' + storecheck._id.toHexString() + ' samples to excipio');
                            }
                        });
                    } else {
                        winston.log('debug', 'a POST /store-check/' + storecheck._id.toHexString() + ' request from user=' + caller.name + ' has succeeded after updating audit assignment states');
                        Common.pushMessage(req, 'success', 'Updated store check state to "' + state + '"');
                        res.send({result: 'ok'}, 200);
                    }
                });
            });
        }
    );
}

function _fillInPointOfSaleInfoForVisits(visits, callback) {
    var pos_ids = _.uniq(_.pluck(visits, 'pos_id'));

    PointOfSaleModule.listByIds(pos_ids, function(err, pos_list) {
        if(err) {
            callback(err, null);
            return;
        }

        var pos;
        _.each(visits, function(visit) {
            pos = _.find(pos_list, function(pos) {
                return pos._id.toHexString() == visit.pos_id;
            });
            visit.pos = pos;
        });
        callback(null, visits);
    });
}