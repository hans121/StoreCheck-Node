var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');
var formatter = require('../../modules/view-formatter');

var nodeUtils = require('../../modules/node-utils');
var RC = require('../router-common');

var AuditAssignmentModule = require('../../modules/model/audit-assignment');
var AuditTeamModule = require('../../modules/model/audit-team');
var StoreCheckModule = require('../../modules/model/store-check');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/audit-assignment/view/create', _handleCreateAuditAssignmentView, true);

    RC.addHandler(app, 'get', '/audit-assignments/view', _handleAuditAssignmentView, true);
};

// === REQUEST HANDLERS

function _handleCreateAuditAssignmentView(req, res) {
    RC.ensureHasAccess(req, res, 'audit-assignment', 'c', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        RC.getScopedList(req, res, 'audit-team', AuditTeamModule, ["active"], RC.viewErrorCallbacks, function(auditteams) {
            RC.getScopedList(req, res, 'store-check', StoreCheckModule, ["active"], RC.viewErrorCallbacks, function(storechecks) {
                RC.render(req, res, 'audit-assignment-create', {
                    teams : auditteams ? auditteams : [],
                    storechecks: storechecks,
                    caller: caller,
                    path: req.path
                });
            });
        });
    });
}

function _handleAuditAssignmentView(req, res) {
    RC.ensureHasAccess(req, res, 'audit-team', 'l', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        var statuses = ["active"];
        if(nodeUtils.isUserGlobal(caller)) {
            statuses.push("inactive");
        }
        RC.getScopedList(req, res, 'audit-assignment', AuditAssignmentModule, ["active"], RC.viewErrorCallbacks, function(assignments) {
            RC.render(req, res, 'audit-assignment-list', {
                assignments : assignments,
                formatter: formatter,
                caller: caller,
                path: req.path
            });
        });
    });
}