var _ = require('underscore');
var async = require('async');
var config = require('config');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var formatter = require('../../modules/view-formatter');
var nodeUtils = require('../../modules/node-utils');
var schema = require('../../modules/model/schema/schema');

var Common = require('../router-common');
var ActionAuditModule = require('../../modules/action-audit');
var RegionOfSalesModule = require('../../modules/model/hierarchy/region-of-sales');

module.exports = function(app) {

    Common.addHandler(app, 'post', '/region-of-sales/reload', _handleReloadRegionOfSales);

    Common.addHandler(app, 'get', '/region-of-sales', _handleGetRegionsOfSales);
};

// === REQUEST HANDLERS

function _handleGetRegionsOfSales(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        var query = {};

        if(!_.isUndefined(req.query.name_substring)) {
            query = _.extend(query, { description: {$regex : ".*" + req.query.name_substring + ".*", $options: 'i'}});
        }
        if(!_.isUndefined(req.query.code_substring)) {
            query = _.extend(query, { code: {$regex : ".*" + req.query.code_substring + ".*", $options: 'i'}});
        }
        if(!nodeUtils.isUserGlobal(caller)) {
            query.organization = {$in: caller.organizations};
        }
        RegionOfSalesModule.find(query, function(err, customer_list) {
            customer_list.sort(function(a, b) { return (a.description < b.description ? -1 : (a.description == b.description ? 0 : 1)); });
            res.send(customer_list, 200);
        });
    });
}

function _handleReloadRegionOfSales(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') != -1) {
            RegionOfSalesModule.readFiles(req.files.files, function() {
                ActionAuditModule.report(req.session.user, 'reload', 'region-of-sales/hierarchy');
                res.send({result: 'ok'}, 200);
            });
        } else {
            Common.serviceErrorCallbacks.on404(req, res);
        }
    });
}