var _ = require('underscore');
var async = require('async');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var config = require('config');
var formatter = require('../../modules/view-formatter');
var nodeUtils = require('../../modules/node-utils');
var schema = require('../../modules/model/schema/schema');

var Common = require('../router-common');
var ActionAuditModule = require('../../modules/action-audit');
var CustomerPlatformModule = require('../../modules/model/hierarchy/customer-platform');

module.exports = function(app) {

    Common.addHandler(app, 'post', '/customer-platforms/reload', _handleReloadCustomerPlatforms);

    Common.addHandler(app, 'get', '/customer-platforms', _handleGetCustomerPlatforms);
};

// === REQUEST HANDLERS

function _handleReloadCustomerPlatforms(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') != -1) {
            CustomerPlatformModule.readFiles(req.files.files, function() {
                ActionAuditModule.report(caller, 'reload', 'customer-platform/hierarchy');
                res.send({result: 'ok'}, 200);
            });
            return;
        }

        Common.serviceErrorCallbacks.on404(req, res);
    });
}

function _handleGetCustomerPlatforms(req, res) {
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

        CustomerPlatformModule.find(query, function(err, customer_platform_list) {
            customer_platform_list.sort(function(a, b) { return (a.description < b.description ? -1 : (a.description == b.description ? 0 : 1)); });
            res.send(customer_platform_list, 200);
        });
    });
}