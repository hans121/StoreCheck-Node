var winston = require('winston');
var ObjectId = require('mongodb').ObjectID;
var moment = require('moment');

var RC = require('../router-common');
var nodeUtils = require('../../modules/node-utils');
var formatter = require('../../modules/view-formatter');
var RoleList = require('../../modules/role-list');

var OrganizationModule = require('../../modules/model/organization');
var Hierarchy5Module = require('../../modules/model/hierarchy/audit-grid-hierarchy-level5');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/organizations/view', _handleOrganizationsView, true);

    RC.addHandler(app, 'get', '/organization/view/create', _handleOrganizationCreateView, true);

    RC.addHandler(app, 'get', '/organization/view/:id', _handleOrganizationView, true);

    RC.addHandler(app, 'get', '/organization/settings/view', _handleOrganizationSettingsView, true);
};

// === REQUEST HANDLERS

function _handleOrganizationsView(req, res) {
    RC.ensureHasAccess(req, res, 'organization', 'l', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        OrganizationModule.list(function(err, orgs) {
            if(err == null) {
                RC.render(req, res, 'organization-list', {
                    orgs: orgs,
                    formatter: formatter,
                    caller: caller,
                    path: req.path
                });
            } else {
                res.send(err, 400);
            }
        });
    });
}

function _handleOrganizationCreateView(req, res) {
    RC.ensureHasAccess(req, res, 'organization', 'c', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        RC.render(req, res, 'organization-create', {
            caller: caller,
            path: req.path
        });
    });
}

function _handleOrganizationView(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        Hierarchy5Module.getLevel1T02Codes(function(err_level1, results_level1) {
            RC.getByIdIfAuthorized(req, res, req.param('id'), 'organization', OrganizationModule, RC.viewErrorCallbacks, function(item) {

                var roles = [];
                for(var roleIndex in RoleList) {
                    if(RC.userHasAccess(caller, RoleList[roleIndex].short, 'c')) {
                        roles.push(RoleList[roleIndex]);
                    }
                }

                RC.render(req, res, 'organization', {
                    roles: roles,
                    canEditRole: RC.userHasAccess(caller, 'user/role', 'u'),
                    org : item,
                    templates: results_level1,
                    caller: req.session.user,
                    canViewRole: RC.userHasAccess(caller, 'user/role', 'r'),
                    path: req.path
                });
            });
        });
    });
}

function _handleOrganizationSettingsView(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        if(!caller.active_organization || !nodeUtils.isValidId(caller.active_organization)) {
            RC.render500(req, res, 'no active organization');
            return;
        }

        OrganizationModule.findOneById(caller.active_organization, function(err_org, organization) {
            RC.render(req, res, 'organization-settings', {
                organization : organization,
                caller: req.session.user,
                path: req.path
            });
        });
    });
}