var _ = require('underscore');
var async = require('async');
var config = require('config');
var crypto = require('crypto');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var formatter = require('../../modules/view-formatter');
var nodeUtils = require('../../modules/node-utils');
var schema = require('../../modules/model/schema/schema');

var Common = require('../router-common');
var ActionAuditModule = require('../../modules/action-audit');
var AM = require('../../modules/account-manager');
var AuditTeamModule = require('../../modules/model/audit-team');
var EM = require('../../modules/email-dispatcher');
var OrganizationModule = require('../../modules/model/organization');

module.exports = function(app) {

    Common.addHandler(app, 'post', '/user', _handleUpdateUser);

    Common.addHandler(app, 'post', '/', _handleLogin);

    Common.addHandler(app, 'put', '/user', _handleCreateUser);

    // public signup (disabled on site at present)
    Common.addHandler(app, 'post', '/signup', _handleSignup);

    Common.addHandler(app, 'post', '/lost-password', _handleLostPassword);

    Common.addHandler(app, 'get', '/reset-password', _handleGetResetPassword);

    Common.addHandler(app, 'post', '/reset-password', _handleResetPassword);

    Common.addHandler(app, 'delete', '/user/:id', _handleDeleteUser);

    Common.addHandler(app, 'post', '/user/:id', _handleUpdateUserState);

};

// === REQUEST HANDLER

function _handleUpdateUser(req, res){
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        var user = req.param('user');

        if(user) {
            winston.log('debug', 'began processing a POST /user request from user=' + caller.name + ' to update user with username=' + user);

            var validation = schema.validate(req.body, schema.updateUserSchema);
            if(validation.errors.length > 0) {
                winston.log('warn', 'a POST /user request from user=' + caller.name + ' had validation errors: ' + validation.errors);
                res.send(validation.errors, 500);
                return;
            }

            var data = {};

            async.series({

                check_access: function(callback) {
                    Common.canAccessUserByName(req, user, 'u', function(canAccess) {
                        if (!canAccess) {
                            Common.render404(req, res);
                            return;
                        }

                        callback();
                    });
                },

                user_data: function(callback) {
                    data = {
                        user 		: req.param('user'),
                        name 		: req.param('name'),
                        email 		: req.param('email'),
                        pass        : req.param('pass'),
                        version     : schema.currentVersion
                    };
                    callback();
                },

                set_role: function(callback) {
                    var role = req.param('role');
                    if(typeof role != 'undefined' && (Common.userHasAccess(caller, 'user/role', 'u') || Common.userHasAccess(caller, role, 'c'))) {
                        data.roles = [];
                        data.roles.push(role);
                    }
                    callback();
                },

                organization: function(callback) {

                    // get organization.  Admins may add users without one
                    var orgId = req.param('organization');
                    if(!orgId || orgId.trim().length == 0) {
                        if(nodeUtils.isUserGlobal(caller)) {
                            data.organizations = [];
                            data.active_organization = null;
                        }
                        callback();
                        return;
                    }

                    if(!nodeUtils.isValidId(orgId)) {
                        res.send('invalid format for organization id', 500);
                        return;
                    }

                    if(!nodeUtils.isUserGlobal(caller) && caller.organizations.indexOf(orgId) == -1) {
                        res.send('insufficient access to organization, or it does not exist', 500);
                        return;
                    }

                    if(Common.userHasAccess(caller, 'user/organization', 'u')) {
                        data.active_organization = orgId;
                        data.organizations = [orgId];

                        OrganizationModule.findOneById(orgId, Common.queryResultHandler(req, res, Common.serviceErrorCallbacks, function(org) {
                            data.active_organization_name = org.code + " " + org.name;
                            callback();
                        }));
                    } else {
                        callback();
                    }
                },

                do_update: function(callback) {
                    AM.updateAccount(data, function(err_update, update_result) {
                        callback(err_update, update_result);
                    });
                }

            }, function(err_async, async_result) {
                if(err_async != null) {
                    Common.pushMessage(req, 'error', 'Failed to update user account info');
                    res.send('error-updating-account', 400);
                    return;
                }

                ActionAuditModule.report(caller, 'update', 'user', user);
                winston.log('debug', 'user update processed for user=' + caller.name);
                Common.pushMessage(req, 'success', 'Successfully updated user account info');
                res.send({result: 'ok'}, 200);
            });

            return;

        }

        if (req.param('logout') == 'true'){
            winston.log('debug', 'logout requested for user=' + caller.name);
            res.clearCookie('user');
            res.clearCookie('pass');
            req.session.destroy(function(e){ res.send({result: 'ok'}, 200); });

            return;
        }

        Common.on500(req, res, 'user not provided');
    });
}

function _handleLogin(req, res){
    var user = req.param('user');
    var pass = req.param('pass');

    AM.manualLogin(user, pass, function(e, o) {
        if(e != null || o == null) {
            winston.log('debug', 'sign-in failed for user with username=' + user);
            res.send(e, 400);
            return;
        }

        if(o.state != 'active') {
            res.send('user is inactive', 500);
            return;
        }

        req.session.user = o;
        if (req.param('remember-me') == 'true'){
            res.cookie('user', o.user, { maxAge: config.site.maxCookieAge });
            res.cookie('pass', o.pass, { maxAge: config.site.maxCookieAge });
        }
        winston.log('debug', 'sign-in processed for user=' + req.session.user.name);
        res.send(o, 200);
    });
}

function _handleCreateUser(req, res){
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        winston.log('debug', 'began processing a PUT /user request from user=' + caller.name);

        if(!Common.userHasAccess(caller, 'user', 'c')) {
            Common.render404(req, res);
            return;
        }

        var validation = schema.validate(req.body, schema.createUserSchema);
        if(validation.errors.length > 0) {
            winston.log('warn', 'a PUT /user request from user=' + caller.name + ' had validation errors: ' + validation.errors);
            Common.pushMessage(req, 'error', 'Failed to create user because the request had format errors');
            res.send(validation.errors, 500);
            return;
        }

        var user = req.param('user');
        if(typeof(user) == 'undefined') {
            Common.render404(req, res);
            return;
        }

        var data = {
            user 		: req.param('user'),
            name 		: req.param('name'),
            email 		: req.param('email'),
            pass		: req.param('pass'),
            state       : "active",
            version     : schema.currentVersion
        };

        async.series({

            account_data: function(callback) {
                var role = req.param('role');
                if(!_.isUndefined(role) && Common.userHasAccess(caller, 'user/role', 'c')) {
                    data.roles = [];
                    data.roles.push(role);

                    if(!Common.userHasAccess(caller, role, 'c')) {
                        winston.log('debug', 'invalid role "' + role + '" specified when creating a user from a PUT /user request from user=' + caller.name);
                        Common.pushMessage(req, 'error', 'Failed to create user because the role ' + role + ' is invalid');
                        callback('invalid role');
                        return;
                    }
                }
                var orgId = req.param('organization');
                if(_.isUndefined(orgId) || orgId.trim().length == 0) {
                    if(!nodeUtils.isUserGlobal(caller)) {
                        data.active_organization = caller.active_organization;
                        data.active_organization_name = caller.active_organization_name;
                        data.organizations = [caller.active_organization];
                        callback();
                        return;
                    }
                    data.active_organization = null;
                    data.active_organization_name = "";
                    data.organizations = [];
                    callback();
                    return;
                }

                if(!nodeUtils.isValidId(orgId)) {
                    res.send('invalid format for organization id', 500);
                    return;
                }

                if(!nodeUtils.isUserGlobal(caller) && caller.organizations.indexOf(orgId) == -1) {
                    res.send('insufficient access to organization, or it does not exist', 500);
                    return;
                }

                if(Common.userHasAccess(caller, 'user/organization', 'u')) {
                    data.active_organization = orgId;
                    data.organizations = [orgId];

                    OrganizationModule.findOneById(orgId, function(err, org) {
                        if(err == null && org != null) {
                            data.active_organization_name = _getOrganizationDisplayName(org);
                            callback();
                        } else {
                            winston.log('debug', 'invalid organization id=' + orgId + ' specified when creating a user from a PUT /user request from user=' + caller.name);
                            Common.pushMessage(req, 'error', 'Failed to create user because the organization wit id=' + orgId + ' is invalid');
                            res.send('invalid organization', 500);
                            callback('invalid organization');
                        }
                    });
                    return;
                } else {
                    callback('insufficient access to provide organization for user');
                }
            },

            accounts: function(callback) {
                AM.addNewAccount(data, callback);
            }

        }, function(err, results) {
            if(err != null) {
                Common.pushMessage(req, 'error', 'Failed to create user.  Reason: ' + err);
                res.send(err, 400);
                return;
            }
            Common.pushMessage(req, 'success', 'Successfully created user');
            var team = req.param('team');
            if(_.isUndefined(team)) {
                ActionAuditModule.report(caller, 'create', 'user', user);
                winston.log('debug', 'successfully created a user from a PUT /user request from user=' + caller.name);
                res.send(results.accounts[0]._id, 200);
                return;
            }

            AuditTeamModule.addMemberToTeam(results.accounts[0]._id.toHexString(), team, function(err) {
                if(err != null) {
                    ActionAuditModule.report(caller, 'create', 'user', user);
                    winston.log('debug', 'successfully created a user from a PUT /user request from user=' + caller.name + ' but failed to add to the specified team');
                    Common.pushMessage(req, 'error', 'Failed to add user to audit team');
                    res.send('created, but could not add to team', 200);
                } else {
                    ActionAuditModule.report(caller, 'create', 'user', user);
                    ActionAuditModule.report(caller, 'create', 'audit-assignment', user + ' to team ' + team);
                    winston.log('debug', 'successfully created a user from a PUT /user request from user=' + caller.name + ' and added them to auditor team id=' + team);
                    Common.pushMessage(req, 'success', 'Successfully added user to audit team');
                    res.send(results.accounts[0]._id.toHexString(), 200);
                }
            });
        });
    });
}

function _handleSignup(req, res){
    winston.log('debug', 'began processing a POST /signup request');

    AM.addNewAccount({
        name 	:            req.param('name'),
        email 	:            req.param('email'),
        user 	:            req.param('user'),
        pass	:            req.param('pass'),
        roles   :            [ "auditor" ],
        language:            "en",
        organizations:       [],
        active_organization: null,
        version:             schema.currentVersion
    }, function(e){
        if(e) {
            res.send(e, 400);
            return;
        }
        res.send({result: 'ok'}, 200);
    });
}

function _handleLostPassword(req, res){
    winston.log('debug', 'began processing a POST /lost-password request');

    AM.getAccountByEmail(req.param('email'), function(o){
        if(o == null) {
            res.send('email-not-found', 500);
            return;
        }
        crypto.randomBytes(48, function(ex, buf) {
            var token = buf.toString('hex');
            o.reset_token = token;

            AM.updateAccount(o, function(e, user) {
                if(user == null) {
                    res.send('could not save reset token', 500);
                    return;
                }
                EM.semaphore.take(function() {
                    EM.reconnect(function(err, connected) {
                        if(err) {
                            EM.semaphore.leave();
                            res.send('could not send email', 500);
                            return;
                        }
                        EM.dispatchResetPasswordLink(o, token, function(e, m){
                            EM.semaphore.leave();
                            if(e != null) {
                                res.send('email-server-error', 500);
                                return;
                            }
                            res.send({result: 'ok'}, 200);
                        });
                    });
                });
            });
        });
    });
}

function _handleGetResetPassword(req, res) {
    winston.log('debug', 'began processing a GET /reset-password request');

    var email = req.query["e"];
    var passH = req.query["p"];
    AM.validateResetLink(email, passH, function(e){
        AM.getAccountByEmail(email, function(o){
            if(o == null) {
                Common.render404(req, res);
                return;
            }

            if(o.reset_token != req.query["token"]) {
                Common.render500(req, res, 'we were not expecting a password reset for this user');
                return;
            }

            if (e != 'ok'){
                res.redirect('/');
                return;
            }

            // save the user's email in a session instead of sending to the client //
            req.session.reset = { email:email, passHash:passH };
            res.render('reset', { title : 'Reset Password' });
        });
    });
}

function _handleResetPassword(req, res) {
    winston.log('debug', 'began processing a POST /reset-password request');

    var nPass = req.param('pass');
    
    if(!req.session.reset || !req.session.reset.email) {
        res.send('password reset request not valid', 500);
        return;
    }

    // retrieve the user's email from the session to lookup their account and reset password
    var email = req.session.reset.email;

    // destroy the session immediately after retrieving the stored email
    req.session.destroy();
    AM.updatePassword(email, nPass, function(e, o){
        if (o){
            winston.log('debug', 'reset password processed from a POST /reset-password request');
            res.send({result: 'ok'}, 200);
        }	else{
            winston.log('warn', 'a POST /reset-password failed, message=' + e);
            res.send('unable to update password', 400);
        }
    });
}

function _handleDeleteUser(req, res){
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        var id = req.param('id');
        if(!nodeUtils.isValidId(id)) {
            Common.pushMessage(req, 'error', 'Failed to delete user, because the supplied id ' + id + ' was not valid');
            res.send('invalid id specified', 500);
            return;
        }

        Common.canAccessUser(req, id, 'd', function(canAccess) {
            if(!canAccess) {
                Common.pushMessage(req, 'error', 'Failed to delete user, because you do not have sufficient access');
                res.send('insufficient access to delete user', 503);
                return;
            }

            AuditTeamModule.removeMemberFromTeams(id, function(err, item) {
                AM.deleteAccount(id, function(e, obj){
                    if(e) {
                        winston.log('warn', 'failed to delete (could not find) a user with id=' + id + ' from a DELETE /user request from user=' + caller.name);
                        Common.pushMessage(req, 'error', 'Failed to delete user, because it could not be found');
                        res.send('record not found', 404);
                        return;
                    }

                    if(caller._id == id) {
                        res.clearCookie('user');
                        res.clearCookie('pass');
                        req.session.destroy(function(e){
                            ActionAuditModule.report(caller, 'delete', 'user', id);
                            winston.log('debug', 'successfully deleted a user from a DELETE /user request from user=' + caller.name);
                            Common.pushMessage(req, 'success', 'Successfully deleted your account');
                            res.send({result: 'ok'}, 200);
                        });
                    } else {
                        ActionAuditModule.report(caller, 'delete', 'user', id);
                        winston.log('debug', 'successfully deleted a user from a DELETE /user request from user=' + caller.name);
                        Common.pushMessage(req, 'success', 'Successfully deleted user');
                        res.send({result: 'ok'}, 200);
                    }
                });
            });
        });
    });
}

function _handleUpdateUserState(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        var id = req.param('id');
        if(!nodeUtils.isValidId(id)) {
            Common.pushMessage(req, 'error', 'Failed to update user state to"' + req.query["state"] + ' because the specified id was invalid');
            res.send('invalid id specified', 500);
            return;
        }

        Common.canAccessUser(req, id, 'u', function(canAccess) {
            if(!canAccess) {
                Common.pushMessage(req, 'error', 'Failed to update user state to"' + req.query["state"] + ' because the record was not found');
                res.send('record not found', 404);
                return;
            }

            if(req.query["state"] != null) {
                AM.updateStatus(id, req.query["state"], function(err, doc) {
                    if(err == null) {
                        ActionAuditModule.report(caller, 'update', 'user/state', id + ' state set to ' + req.query["state"]);
                        Common.pushMessage(req, 'success', 'Successfully updated user state to"' + req.query["state"] + '"');
                        res.send(doc, 200);
                    } else{
                        Common.pushMessage(req, 'error', 'Failed to update user state to"' + req.query["state"] + '" Reason: ' + err);
                        res.send(err, 400);
                    }
                });
            } else {
                // TODO: move user/update to here
                res.send('not implemented - use POST /user with an _id in the body', 400);
            }
        });
    });
}

// === HELPERS

function _getOrganizationDisplayName(organization) {
    return organization.code + " " + organization.name;
}
