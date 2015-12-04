var _ = require('underscore');
var async = require('async');
var ObjectId = require('mongodb').ObjectID;
var config = require('config');
var winston = require('winston');

var formatter = require('../../modules/view-formatter');
var nodeUtils = require('../../modules/node-utils');
var schema = require('../../modules/model/schema/schema');

var Common = require('../router-common');
var ActionAuditModule = require('../../modules/action-audit');
var DanonePlatformModule = require('../../modules/model/hierarchy/danone-platform');

module.exports = function(app) {

    Common.addHandler(app, 'post', '/danone-platforms/reload', _handleReloadDanonePlatform);

    Common.addHandler(app, 'get', '/danone-platforms', _handleGetDanonePlatforms);
};

// === REQUEST HANDLERS

function _handleReloadDanonePlatform(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') != -1) {
            DanonePlatformModule.readFiles(req.files.files, function() {
                ActionAuditModule.report(caller, 'reload', 'danone-platform/hierarchy');
                res.send({result: 'ok'}, 200);
            });
            return;
        }
        Common.serviceErrorCallbacks.on404(req, res);
    });
}

function _handleGetDanonePlatforms(req, res) {
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

        DanonePlatformModule.find(query, function(err, danone_platform_list) {
            danone_platform_list.sort(function(a, b) { return (a.description < b.description ? -1 : (a.description == b.description ? 0 : 1)); });
            res.send(danone_platform_list, 200);
        });
    });
}