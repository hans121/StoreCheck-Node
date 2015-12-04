var _ = require('underscore');
var async = require('async');
var winston = require('winston');

var Common = require('../router-common');

var ActionAuditModule = require('../../modules/action-audit');
var AdminAreaModule = require('../../modules/model/hierarchy/admin-area');
var nodeUtils = require('../../modules/node-utils');

module.exports = function(app) {

    Common.addHandler(app, 'post', '/admin-area/reload', _reloadAdminAreas);

    Common.addHandler(app, 'get', '/admin-areas', _getAdminAreas);
};

function _reloadAdminAreas(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        AdminAreaModule.readFiles(req.files.files, function() {
            ActionAuditModule.report(req.session.user, 'reload', 'admin-area/hierarchy');
            res.send({result: 'ok'}, 200);
        });
    });
}

function _getAdminAreas(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        var query = { hierarchy_level: '0' };

        if(!_.isUndefined(req.query.name_substring)) {
            query = _.extend(query, { description: {$regex : ".*" + req.query.name_substring + ".*", $options: 'i'}});
        }
        if(!_.isUndefined(req.query.code_substring)) {
            query = _.extend(query, { code: {$regex : ".*" + req.query.code_substring + ".*", $options: 'i'}});
        }
        if(!nodeUtils.isUserGlobal(caller)) {
            query.organization = {$in: caller.organizations};
        }
        AdminAreaModule.find(query, function(err, customer_list) {
            customer_list.sort(function(a, b) { return (a.description < b.description ? -1 : (a.description == b.description ? 0 : 1)); });
            res.send(customer_list, 200);
        });
    });
}