var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');
var formatter = require('../../modules/view-formatter');

var RC = require('../router-common');
var AM = require('../../modules/access-manager');

var PointOfSaleModule = require('../../modules/model/hierarchy/point-of-sale');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/points-of-sale/view', _handlePointsOfSaleView, true);

    RC.addHandler(app, 'get', '/point-of-sale/view/create', _handlePointOfSaleCreateView, true);

    RC.addHandler(app, 'get', '/point-of-sale/view/:id', _handlePointOfSaleView, true);
};

// === REQUEST HANDLERS

function _handlePointsOfSaleView(req, res) {
    RC.ensureHasAccess(req, res, 'pos', 'l', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        RC.render(req, res, 'pos-list', {
            caller: caller,
            path: req.path,
            access: AM
        });
    });
}

function _handlePointOfSaleCreateView(req, res) {
    RC.ensureHasAccess(req, res, 'pos', 'c', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        RC.render(req, res, 'pos-create', {
            caller: caller,
            path: req.path
        });
    });
}

function _handlePointOfSaleView(req, res) {
    RC.ensureHasAccess(req, res, 'pos', 'r', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        var id = req.param('id');
        RC.getByIdIfAuthorized(req, res, id, 'pos', PointOfSaleModule, RC.viewErrorCallbacks, function(item) {
            RC.render(req, res, 'pos', {
                pos : item,
                caller: caller,
                path: req.path
            });
        });
    });
}