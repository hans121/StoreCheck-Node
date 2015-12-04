var schema = require('../../modules/model/schema/schema');
var formatter = require('../../modules/view-formatter');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var Common = require('../router-common');

var ActionAuditModule = require('../../modules/action-audit');
var AuditTeamModule = require('../../modules/model/audit-team');
var nodeUtils = require('../../modules/node-utils');

module.exports = function(app) {

    // Creates an audit team
    //
    // Error conditions:
    //     - The request did not pass schema validation
    //     - The caller does not have create audit team permissions
    //     - See RouterCommon.getByIdIfAuthorized for store check and audit team
    //
    // Notes:
    //     - The created audit team will belong to the organization that is the caller's active organization
    Common.addHandler(app, 'put', '/audit-team', _handleCreateAuditTeam);

    // Adds or removes a member to an audit team
    //
    // Query parameters:
    //     - action, which can be either "add" or "remove"
    //
    // Error conditions:
    //     - The request did not pass schema validation
    //     - The caller does not have update audit team permissions
    //     - See RouterCommon.getByIdIfAuthorized (audit-team)
    Common.addHandler(app, 'post', '/audit-team/member', _handleChangeAuditTeamMembership);

    // Deletes an audit team
    //
    // Error conditions:
    //     - See RouterCommon.getByIdIfAuthorized (audit-team)
    //     - The caller does not have delete audit team permissions
    Common.addHandler(app, 'delete', '/audit-team/:id', _handleDeleteAuditTeam);

    // Updates an audit team or audit team's state
    //
    // Query parameters:
    //     - state - [optional] the state to set for the given audit team ("active" or "inactive")
    //
    // Error conditions:
    //     - See RouterCommon.getByIdIfAuthorized (audit team)
    //     - The request did not pass schema validation
    //     - The supplied state was not valid (if state provided)
    //     - The caller does not have update audit team permissions
    //     - A state was not provided
    Common.addHandler(app, 'post', '/audit-team/:id', _handleUpdateAuditTeam);

    // Gets an audit team by ID
    //
    // Error conditions:
    //     - See RouterCommon.getByIdIfAuthorized (audit team)
    Common.addHandler(app, 'get', '/audit-team/:id', function(req, res) {
        Common.getResourceById(req, res, 'get', '/audit-team/:id', 'audit-team', AuditTeamModule);
    });
};

// === REQUEST HANDLERS

function _handleCreateAuditTeam(req, res) {
    Common.ensureHasAccess(req, res, 'audit-team', 'c', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        // TODO: enforce name uniqueness within organization
        var validation = schema.validate(req.body, schema.createAuditTeamSchema);
        if(validation.errors.length == 0) {
            AuditTeamModule.insert({
                name 	        : req.body.name,
                members 	    : req.body.members ? req.body.members : [],
                created	        : formatter.getCurrentUtcTimeString(),
                organization    : caller.active_organization,
                version         : schema.currentVersion,
                state           : "active"
            }, function(o){
                if(o) {
                    ActionAuditModule.report(caller, 'create', 'audit-team', req.body.name);
                    winston.log('debug', 'a PUT /audit-team request from user=' + caller.name + ' has succeeded');
                    Common.pushMessage(req, 'success', 'Successfully created auditor team');
                    res.send(o[0]._id, 200);
                } else {
                    winston.log('warn', 'a PUT /audit-team request from user=' + caller.name + ' failed');
                    Common.pushMessage(req, 'error', 'Failed to create auditor team');
                    res.send('an error occurred', 400);
                }
            });
        } else {
            winston.log('warn', 'a PUT /audit-team request from user=' + caller.name + ' had validation errors: ' + validation.errors);
            Common.pushMessage(req, 'error', 'Failed to create auditor team because the request had format errors');
            res.send(validation.errors, 500);
        }
    });
}

function _handleUpdateAuditTeam(req, res) {
    Common.ensureHasAccess(req, res, 'audit-team', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        // get the resource via a convenience method that does the necessary security checks and id validation
        Common.getByIdIfAuthorized(req, res, req.param('id'), 'audit-team', AuditTeamModule, Common.serviceErrorCallbacks, function(audit_team) {

            // if the update just changes the team's state
            if (req.query["state"] != null) {
                AuditTeamModule.update({
                    query: { _id : audit_team._id },
                    value: {
                        $set : {
                            state: req.query["state"]
                        }
                    }
                }, function(e) {
                    if(e) {
                        ActionAuditModule.report(caller, 'update', 'audit-team/state', 'set ' + audit_team.name + ' to ' + req.query["state"]);
                        winston.log('debug', 'a POST /audit-team/' + req.param('id') + ' request from user=' + caller.name + ' has succeeded');
                        Common.pushMessage(req, 'success', 'Successfully updated audit team state to "' + req.query["state"] + '"');
                        res.send({result: 'ok'}, 200);
                    } else {
                        winston.log('warn', 'a POST /audit-team/' + req.param('id') + ' request from user=' + caller.name + ' failed');
                        Common.pushMessage(req, 'error', 'Failed to update audit team state');
                        res.send('Failed to update audit team state', 400);
                    }
                });

                return;
            }

            // else, the update is intended to update the team's members
            var validation = schema.validate(req.body, schema.updateAuditTeamSchema);
            if(validation.errors.length == 0) {
                var toSet = { name: req.body.name };
                if(req.body.members) {
                    toSet.members = req.body.members;
                }
                AuditTeamModule.update({
                    query: { _id : audit_team._id },
                    value: {
                        $set : toSet
                    }
                }, function(e) {
                    if(e) {
                        ActionAuditModule.report(caller, 'update', 'audit-team', audit_team.name);
                        winston.log('debug', 'a POST /audit-team request from user=' + caller.name + ' has succeeded');
                        Common.pushMessage(req, 'success', 'Successfully updated auditor team');
                        res.send({result: 'ok'}, 200);
                    } else {
                        winston.log('warn', 'a POST /audit-team request from user=' + caller.name + ' failed');
                        Common.pushMessage(req, 'error', 'Failed to update auditor team');
                        res.send('failed to update audit team', 400);
                    }
                });

            } else {
                winston.log('warn', 'a POST /audit-team request from user=' + caller.name + ' had validation errors: ' + validation.errors);
                Common.pushMessage(req, 'error', 'Failed to update auditor team because the request had format errors');
                res.send(validation.errors, 500);
            }
        });
    });
}

function _handleChangeAuditTeamMembership(req, res) {
    Common.ensureHasAccess(req, res, 'audit-team', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        // TODO: schema, check user exists
        //var validation = schema.validate(req.body, schema.updateAuditTeamSchema);
        //if(validation.errors.length == 0) {

        // if it's an add action
        if(req.query["action"] == 'add') {
            if(nodeUtils.isValidId(req.param('memberId'))) {

                // get the resource via a convenience method that does the necessary security checks and id validation
                Common.getByIdIfAuthorized(req, res, req.param('id'), 'audit-team', AuditTeamModule, Common.serviceErrorCallbacks, function(audit_team) {
                    AuditTeamModule.update({
                        query: { _id : audit_team._id },
                        value: {
                            $addToSet : {
                                members : req.param('memberId')
                            }
                        }
                    }, function(e){
                        if(e) {
                            ActionAuditModule.report(caller, 'update', 'audit-team/member', 'add ' + req.param('memberId') + ' to team "' + audit_team.name + '"');
                            winston.log('debug', 'a POST /audit-team/member?action=add request from user=' + caller.name + ' has succeeded');
                            Common.pushMessage(req, 'success', 'Successfully added user to team');
                            res.send({result: 'ok'}, 200);
                        } else{
                            winston.log('warn', 'a POST /audit-team/member?action=add request from user=' + caller.name + ' failed, message=' + e);
                            Common.pushMessage(req, 'error', 'Failed to add user to team');
                            res.send(e, 400);
                        }
                    });
                });
            } else {
                winston.log('warn', 'a POST /audit-team request from user=' + caller.name + ' had invalid ids');
                Common.pushMessage(req, 'error', 'Failed to add auditor to team because the request had an invalid id');
                res.send('invalid ids', 500);
            }

            return;

        }

        // if the action is a remove action
        if(req.query["action"] == 'remove') {
            if(nodeUtils.isValidId(req.param('memberId'))) {

                // get the resource via a convenience method that does the necessary security checks and id validation
                Common.getByIdIfAuthorized(req, res, req.param('id'), 'audit-team', AuditTeamModule, Common.serviceErrorCallbacks, function(audit_team) {
                    AuditTeamModule.update({
                        query: { _id : audit_team._id },
                        value: {
                            $pull : {
                                members : req.param('memberId')
                            }
                        }
                    }, function(e){
                        if(e) {
                            ActionAuditModule.report(caller, 'update', 'audit-team/member', 'remove ' + req.param('memberId') + ' from team "' + audit_team.name + '"');
                            winston.log('debug', 'a POST /audit-team/member?action=remove request from user=' + caller.name + ' has succeeded');
                            Common.pushMessage(req, 'success', 'Successfully removed auditor from team');
                            res.send({result: 'ok'}, 200);
                        } else{
                            winston.log('warn', 'a POST /audit-team/member?action=remove request from user=' + caller.name + ' failed, message=' + e);
                            Common.pushMessage(req, 'error', 'Failed to remove auditor from team');
                            res.send(e, 400);
                        }
                    });
                });
            } else {
                winston.log('warn', 'a POST /audit-team request from user=' + caller.name + ' had invalid ids');
                Common.pushMessage(req, 'error', 'Failed to remove auditor from team because the request had an invalid id');
                res.send('invalid ids', 500);
            }

            return;
        }

        Common.on500(req, res, 'Unrecognized action');
    });
}

function _handleDeleteAuditTeam(req, res) {
    Common.ensureHasAccess(req, res, 'audit-team', 'd', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        Common.getByIdIfAuthorized(req, res, req.param('id'), 'audit-team', AuditTeamModule, Common.serviceErrorCallbacks, function(audit_team) {

            AuditTeamModule.collection.remove({
                _id : audit_team._id
            }, function(error_remove){
                if(error_remove) {
                    winston.log('warn', 'a DELETE /audit-team request from user=' + caller.name + ' failed, message=' + error_remove);
                    Common.pushMessage(req, 'error', 'Failed to delete audit team');
                    Common.on500(req, res, error_remove);
                    return;
                }

                ActionAuditModule.report(caller, 'delete', 'audit-team', audit_team.name);
                winston.log('debug', 'a DELETE /audit-team request from user=' + caller.name + ' has succeeded');
                Common.pushMessage(req, 'success', 'Successfully deleted audit team');
                res.send({result: 'ok'}, 200);
            });
        });
    });
}
