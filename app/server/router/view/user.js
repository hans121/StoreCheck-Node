var moment = require('moment');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var RC = require('../router-common');
var nodeUtils = require('../../modules/node-utils');
var formatter = require('../../modules/view-formatter');
var RoleList = require('../../modules/role-list');

var AM = require('../../modules/account-manager');
var AccessManager = require('../../modules/access-manager');
var OrganizationModule = require('../../modules/model/organization');

var loginPrompt = 'Please login to your account';

module.exports = function(app) {

    RC.addHandler(app, 'get', '/', _handleSlashView, true);

    RC.addHandler(app, 'get', '/signup', _handleSignupView, true);

    RC.addHandler(app, 'get', '/reset', _handleResetView, true);

    RC.addHandler(app, 'get', '/users/view', _handleUsersView, true);

    RC.addHandler(app, 'get', '/user/view/create', _handleUserCreateView, true);

    RC.addHandler(app, 'get', '/user/view/:id', _handleUserView, true);
};

// === REQUEST HANDLERS

function _handleSlashView(req, res){
    // check if the user's credentials are saved in a cookie
    if (req.cookies.user == undefined || req.cookies.pass == undefined){
        res.render('login', { title: loginPrompt });
    } else {
        // attempt automatic login
        AM.autoLogin(req.cookies.user, req.cookies.pass, function(o){
            if (o != null){
                req.session.user = o;
                res.redirect('/home');
            }	else{
                res.render('login', { title: loginPrompt });
            }
        });
    }
}

function _handleResetView(req, res) {
    res.render('reset', {
        title: 'Reset Password',
        path: req.path
    });
}

function _handleSignupView(req, res) {
    res.render('signup', {
        title: 'Signup',
        path: req.path
    });
}

function _handleUserCreateView(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        if(RC.userHasAccess(caller, 'user', 'c')) {
            var canViewRole = RC.userHasAccess(caller, 'user/role', 'r');
            var isGlobal = nodeUtils.isUserGlobal(caller);
            var roles = [];
            for(var roleIndex in RoleList) {
                if(RC.userHasAccess(caller, RoleList[roleIndex].short, 'c')) {
                    roles.push(RoleList[roleIndex]);
                }
            }
            var canEditUserOrg = RC.userHasAccess(caller, 'user/organization', 'u');
            RC.listAuditTeams(caller, function(err, auditTeams) {
                OrganizationModule.listByStatuses(["active"], function(err, orgs) {
                    if(err == null) {

                        RC.render(req, res, 'user-create', {
                            roles: roles,
                            canViewRole: canViewRole,
                            canEditRole: roles.length > 1,
                            isGlobal: isGlobal,
                            canEditUserOrg: canEditUserOrg,
                            orgs: orgs,
                            caller: req.session.user,
                            auditTeams: auditTeams ? auditTeams : [],
                            path: req.path
                        });
                    } else {
                        res.send(err, 400);
                    }
                });
            });
        } else {
            RC.onAuthFailedForViewMethod(req, res);
        }
    });
}

function _handleUserView(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        var id = req.params['id'];
        RC.canAccessUser(req, id, 'u', function(canAccess) {
            if(!canAccess) {
                RC.onAuthFailedForViewMethod(req, res);
                return;
            }

            OrganizationModule.listByStatuses(["active"], function(err, orgs) {
                if(err != null) {
                    res.send(err, 500);
                    return;
                }

                AM.findOne({ '_id' : ObjectId(id) }, function(err, user) {
                    if(err != null) {
                        res.send(err, 500);
                        return;
                    }

                    var roles = [];
                    for(var roleIndex in RoleList) {
                        if(RC.userHasAccess(caller, RoleList[roleIndex].short, 'c')) {
                            roles.push(RoleList[roleIndex]);
                        }
                    }

                    RC.render(req, res, 'user', {
                        user: user,
                        caller: caller,
                        roles: roles,
                        canViewRole: RC.userHasAccess(caller, 'user/role', 'r'),
                        canEditRole: RC.userHasAccess(caller, 'user/role', 'u'),
                        isGlobal: nodeUtils.isUserGlobal(caller),
                        canEditUserOrg: RC.userHasAccess(caller, 'user/organization', 'u'),
                        orgs: orgs,
                        path: req.path
                    });
                });
            });
        });
    });
}

function _handleUsersView(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        var onLoadedAuditorsAndSupervisors = function(auditors, supervisors, visibility_text) {
            RC.render(req, res, 'user-list', {
                auditors : auditors ? auditors : [],
                supervisors: supervisors ? supervisors : [],
                formatter: formatter,
                role: AccessManager.getRole(caller),
                access: AccessManager,
                visibility_text: visibility_text,
                caller: caller,
                path: req.path
            });
        };

        winston.log('debug', 'getting appropriate user list page for user=' + caller.name);

        // can the caller view all/organization users
        if(RC.userHasAccess(caller, 'user', 'l')) {
            if(nodeUtils.isUserGlobal(caller)) {
                OrganizationModule.listByStatuses(["active"], function(e, orgs) {
                    var orgIdToName = {};
                    orgs.forEach(function (e) {
                        orgIdToName[e._id.toHexString()] = e.name;
                    });

                    AM.getAllRecords( function(e, accounts){
                        if(e != null) {
                            RC.viewErrorCallbacks.on404(req, res);
                            return;
                        }
                        accounts = accounts.map(function(acct) {
                            if(Array.isArray(acct.organizations)) {
                                acct.org_names = acct.organizations.map(function (org) { return orgIdToName[org]; });
                            }
                            return acct;
                        });

                        RC.render(req, res, 'user-list', {
                            isGlobal: true,
                            accts : accounts,
                            orgs: orgs,
                            caller: caller,
                            visibility_text: 'all users in the system',
                            path: req.path
                        });
                    });
                })
            } else if(caller.organizations) {
                AM.getAllUsersInOrganizations(caller.organizations, function(err, accounts) {
                    RC.render(req, res, 'user-list', {
                        isGlobal: false,
                        accts : accounts,
                        caller: caller,
                        visibility_text: 'all users in your organization',
                        path: req.path
                    });
                });
            } else {
                res.redirect('/');
            }

        } else if(RC.userHasAccess(caller, 'auditor', 'l') || RC.userHasAccess(caller, 'audit-team/auditor', 'l')) {
            RC.listUsersByRole(req, res, caller, 'auditor', RC.viewErrorCallbacks, function(auditors) {
                RC.listUsersByRole(req, res, caller, 'supervisor', {
                    userNotInSession: RC.onUserNotInSessionForViewMethod,
                    authFailed: function(req, res) {
                        onLoadedAuditorsAndSupervisors(auditors, [], _getVisibilityText(caller, 'all auditors', 'auditor'));
                    }
                }, function(supervisors) {
                    // TODO: getVisibilityText should also check supervisors perm
                    onLoadedAuditorsAndSupervisors(auditors, supervisors, _getVisibilityText(caller, 'all auditors and supervisors', 'auditor'));
                });
            });
        } else if(RC.userHasAccess(caller, 'supervisor', 'l') || RC.userHasAccess(caller, 'audit-team/supervisor', 'l')) {
            RC.listUsersByRole(req, res, caller, 'supervisor', RC.viewErrorCallbacks, function(err, supervisors) {
                onLoadedAuditorsAndSupervisors([], supervisors, _getVisibilityText(caller, 'all supervisors', 'supervisor'));
            });
        } else {
            RC.onAuthFailedForViewMethod(req, res);
        }
    });
}

// === HELPERS

function _getVisibilityText(caller, resource_text, permission) {
    if(nodeUtils.isUserGlobal(caller)) {
        return resource_text + ' in the system';
    }
    return resource_text + (RC.userHasAccess(caller, permission, 'l') ? ' in your organization' : ' on your team');
}