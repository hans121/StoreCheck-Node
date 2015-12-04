var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var Common = require('../router-common');

var ActionAuditModule = require('../../modules/action-audit');
var AuditAssignmentModule = require('../../modules/model/audit-assignment');
var AuditTeamModule = require('../../modules/model/audit-team');
var StoreCheckModule = require('../../modules/model/store-check');
var nodeUtils = require('../../modules/node-utils');
var formatter = require('../../modules/view-formatter');
var schema = require('../../modules/model/schema/schema');

module.exports = function(app) {

    // Sets (creates or updates) the audit assignment for a given storecheck
    //
    // Error conditions:
    //     - The request did not pass schema validation
    //     - The caller does not have create audit assignment permissions
    //     - See RouterCommon.getByIdIfAuthorized (store check, audit team)
    //
    // Notes:
    //     - The created audit team will belong to the organization that is the caller's active organization
    Common.addHandler(app, 'put', '/audit-assignment', _handleCreateAuditAssignment);

    // Deletes an audit assignment
    //
    // Error conditions:
    //     - The supplied ID is not of a valid format
    //     - The caller does not have delete audit assignment permissions
    // TODO: check for references elsewhere and clean up?  Possibly limit to active audit assignments
    Common.addHandler(app, 'delete', '/audit-assignment/:id', _handleDeleteAuditAssignment);

    // Sets an audit assignment's state
    //
    // Query parameters:
    //     - state - the state to set for the given audit assignment ("active" or "inactive")
    //
    // Error conditions:
    //     - See RouterCommon.getByIdIfAuthorized (audit team)
    //     - The supplied state was not valid
    //     - The caller does not have update audit assignment permissions
    //     - A state was not provided
    Common.addHandler(app, 'post', '/audit-assignment/:id', _handleUpdateAuditAssignment);

    // Gets an audit assignment by ID
    //
    // Error conditions:
    //     - See RouterCommon.getByIdIfAuthorized (audit team)
    Common.addHandler(app, 'get', '/audit-assignment/:id', function(req, res) {
        Common.getResourceById(req, res, 'get', '/audit-assignment/:id', 'audit-assignment', AuditAssignmentModule);
    });
};

// === REQUEST HANDLERS

function _handleCreateAuditAssignment(req, res) {
    Common.ensureHasAccess(req, res, 'audit-assignment', 'c', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var validation = schema.validate(req.body, schema.createAuditAssignmentSchema);
        if(validation.errors.length > 0) {
            winston.log('warn', 'a POST /audit-assignment request from user=' + caller.name + ' had validation errors: ' + validation.errors);
            Common.pushMessage(req, 'error', 'Failed to update auditor team assignment because the request had format errors');
            res.send(validation.errors, 500);
            return;
        }

        var assignment = {
            team_id         : req.body.team_id,
            storecheck_id   : req.body.storecheck_id,
            organization    : req.session.user.active_organization,
            version         : schema.currentVersion,
            state           : 'active'
        };
        assignment.assignment_time = formatter.getCurrentUtcTimeString();

        // get the store check
        Common.getByIdIfAuthorized(req, res, req.body.storecheck_id, 'store-check', StoreCheckModule, Common.serviceErrorCallbacks, function(storecheck) {
            assignment.storecheck_name = storecheck.name;

            // get the auditor team check
            Common.getByIdIfAuthorized(req, res, req.body.team_id, 'audit-team', AuditTeamModule, Common.serviceErrorCallbacks, function(team) {
                assignment.team_name = team.name; // TODO: possibly take these out?  Nothing updates them when the team's info changes...
                AuditAssignmentModule.upsert({
                    query: { storecheck_id : req.body.storecheck_id },
                    value: assignment
                }, function(update_count, update_results) {
                    if(update_count) {
                        ActionAuditModule.report(caller, 'create', 'audit-assignment', 'team "' + team.name + '" to store check "' + storecheck.name + '"');
                        winston.log('debug', 'a POST /audit-assignment request from user=' + caller.name + ' has succeeded');
                        Common.pushMessage(req, 'success', 'Successfully assigned team "' + team.name + '" to store check "' + storecheck.name + '"');
                        res.send({result: 'ok'}, 200);
                    } else {
                        winston.log('warn', 'a POST /audit-assignment request from user=' + caller.name + ' failed, message=' + update_count);
                        Common.pushMessage(req, 'success', 'Failed to assign team "' + team.name + '" to store check "' + storecheck.name + '"');
                        res.send(update_count, 500);
                    }
                });
            });
        });
    });
}

function _handleUpdateAuditAssignment(req, res) {
    Common.ensureHasAccess(req, res, 'audit-assignment', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        if(req.query["state"] != null) {

            if(req.query["state"] == 'active' || req.query["state"] == "inactive") {

                // get the resource via a convenience method that does the necessary security checks and id validation
                Common.getByIdIfAuthorized(req, res, req.param('id'), 'audit-assignment', AuditAssignmentModule, Common.serviceErrorCallbacks, function(assignment) {
                    AuditAssignmentModule.update({
                        query: { _id : assignment._id },
                        value: {
                            $set : {
                                state: req.query["state"]
                            }
                        }
                    }, function(e){
                        if (e){
                            winston.log('debug', 'a POST /audit-assignment/:id request from user=' + caller.name + ' has succeeded');
                            Common.pushMessage(req, 'success', 'Successfully updated auditor team assignment state');
                            res.send({result: 'ok'}, 200);
                        } else{
                            winston.log('warn', 'a POST /audit-assignment/:id request from user=' + caller.name + ' failed, message=' + e);
                            Common.pushMessage(req, 'error', 'Failed to update auditor team assignment state');
                            res.send(e, 400);
                        }
                    });
                });
            } else {
                winston.log('warn', 'a POST /audit-assignment/:id request from user=' + caller.name + ' failed because the state was not recognized');
                Common.pushMessage(req, 'error', 'Failed to update auditor team assignment state');
                Common.serviceErrorCallbacks.on500(req, res, 'the specified action ' + req.query["action"] + ' was not recognized');
            }
        } else {

            /// TODO
            res.send('not implemented', 400);
        }
    });
}

function _handleDeleteAuditAssignment(req, res) {
    Common.ensureHasAccess(req, res, 'audit-assignment', 'd', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        // get the resource via a convenience method that does the necessary security checks and id validation
        Common.getByIdIfAuthorized(req, res, req.param('id'), 'audit-assignment', AuditAssignmentModule, Common.serviceErrorCallbacks, function(assignment) {
            AuditAssignmentModule.delete({
                _id : assignment._id
            }, function(e){
                if(e) {
                    winston.log('debug', 'a DELETE /audit-assignment request from user=' + caller.name + ' has succeeded');
                    Common.pushMessage(req, 'success', 'Successfully removed auditor team assignment');
                    res.send({result: 'ok'}, 200);
                    return;
                }
                winston.log('warn', 'a DELETE /audit-assignment request from user=' + caller.name + ' failed');
                Common.pushMessage(req, 'error', 'Failed to remove auditor team assignment');
                res.send(e, 400);
            });
        });
    });
}