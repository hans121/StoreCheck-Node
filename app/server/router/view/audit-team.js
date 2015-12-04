var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');
var _ = require('underscore');

var formatter = require('../../modules/view-formatter');
var nodeUtils = require('../../modules/node-utils');
var RC = require('../router-common');
var RoleList = require('../../modules/role-list');

var AM = require('../../modules/account-manager');
var AuditAssignmentModule = require('../../modules/model/audit-assignment');
var AuditTeamModule = require('../../modules/model/audit-team');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/audit-teams/view', _handleAuditTeamsView, true);

    RC.addHandler(app, 'get', '/audit-team/view/create', _handleAuditTeamCreateView, true);

    RC.addHandler(app, 'get', '/audit-team/view/:id', _handleAuditTeamView, true);
};

// === REQUEST HANDLERS

function _handleAuditTeamsView(req, res) {
    RC.ensureHasAccess(req, res, 'audit-team', 'l', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        var onLoadedAll = function(assignments, users, teams) {
            teams.forEach(function (item) {
                if(!Array.isArray(item.members)) {
                    item.members = [];
                }
                var memberNames = AuditTeamModule.getMemberNames(users, item.members);
                item.members = item.members.map(function (id, i) { return { _id: id, name: memberNames[i] }; });
            });

            RC.render(req, res, 'audit-team-list', {
                assignments : assignments,
                teams : teams,
                formatter: formatter,
                caller: caller,
                path: req.path
            });
        };

        if(nodeUtils.isUserGlobal(caller)) {
            AuditAssignmentModule.list(function(error, assignments) {
                AM.getAllUsersWithRole('auditor', function(error, users) { // Note that these are for server-side display processing, but probably should be scoped to org
                    AM.getAllUsersWithRole('supervisor', function(error, supervisors) {
                        _.each(supervisors, function(supervisor) {
                            users.push(supervisor);
                        });
                        AuditTeamModule.list(function(err, teams) {
                            onLoadedAll(assignments, users, teams);
                        });
                    });
                });
            });
            return;
        }

        if(!_.isUndefined(caller.organizations) && !_.isNull(caller.organizations)) {
            AuditAssignmentModule.listByOrganizationsAndExcludeStatuses(caller.organizations, ["inactive"], function(error, assignments) {
                AM.getAllUsersWithRole('auditor', function(error, users) { // Note that these are for server-side display processing, but probably should be scoped to org
                    AM.getAllUsersWithRole('supervisor', function(error, supervisors) {
                        _.each(supervisors, function(supervisor) {
                            users.push(supervisor);
                        });
                        AuditTeamModule.listByOrganizationsAndExcludeStatuses(caller.organizations, ["inactive"], function(err, teams) {
                            onLoadedAll(assignments, users, teams);
                        });
                    });
                });
            });
            return;
        }

        res.redirect('/');
    });
}

function _handleAuditTeamCreateView(req, res) {
    RC.ensureHasAccess(req, res, 'audit-team', 'c', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        RC.render(req, res, 'audit-team-create', {
            caller: caller,
            path: req.path
        });
    });
}

function _handleAuditTeamView(req, res) {
    RC.getByIdIfAuthorized(req, res, req.param('id'), 'audit-team', AuditTeamModule, RC.viewErrorCallbacks, function(team, caller) {
        RC.logRequest(req, true, caller);

        var _onLoadedAll = function(users, auditteam, members, roles) {
            if(auditteam != null) {
                if(!Array.isArray(auditteam.members)) {
                    auditteam.members = [];
                }
                auditteam.members = users.filter(function (e) { return auditteam.members.indexOf(e._id.toHexString()) != -1; });
                users = users.filter(function (e) { return members.indexOf(e._id.toHexString()) === -1 }); //  && e.state != 'inactive'

                RC.render(req, res, 'audit-team', {
                    team : auditteam,
                    unassigned_users : users,
                    caller: caller,
                    path: req.path,
                    roles: roles,
                    canViewRole: true,
                    canEditRole: true
                });
            } else {
                RC.render404(req, res);
            }
        };

        var userMapFunction = function(user) {
            return _.pick(user, '_id', 'name', 'roles', 'email', 'user', 'state');
        };

        var roles = [];
        for(var roleIndex in RoleList) {
            if(RC.userHasAccess(caller, RoleList[roleIndex].short, 'c')) {
                roles.push(RoleList[roleIndex]);
            }
        }

        if(nodeUtils.isUserGlobal(caller)) {
            AuditTeamModule.getAllMembers(undefined, function (error, members) {
                AM.getAllUsersWithRole('auditor', function(error, users) {
                    AM.getAllUsersWithRole('supervisor', function(error, supervisors) {
                        _.each(supervisors, function(supervisor) {
                            users.push(supervisor);
                        });
                        users = users.map( userMapFunction );
                        _onLoadedAll(users, team, members, roles);
                    });
                });
            });
            return;
        }

        if(!_.isUndefined(caller.organizations) && !_.isNull(caller.organizations)) {
            AuditTeamModule.getAllMembers(caller.organizations, function (error, members) {
                AM.getAllUsersWithRoleInOrganizations('auditor', caller.organizations, function(error, users) {
                    AM.getAllUsersWithRoleInOrganizations('supervisor', caller.organizations, function(error, supervisors) {
                        _.each(supervisors, function(supervisor) {
                            users.push(supervisor);
                        });
                        users = users.map( userMapFunction );
                        _onLoadedAll(users, team, members, roles);
                    });
                });
            });
            return;
        }

        res.redirect('/');
    });
}