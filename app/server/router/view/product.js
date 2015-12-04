var winston = require('winston');
var ObjectId = require('mongodb').ObjectID;
var moment = require('moment');

var RC = require('../router-common');
var nodeUtils = require('../../modules/node-utils');

var ProductModule = require('../../modules/model/hierarchy/product');
var SampleModule = require('../../modules/model/sample');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/product/view/create', _handleProductCreateView, true);

    RC.addHandler(app, 'get', '/products/view', _handleProductsView, true);

    RC.addHandler(app, 'get', '/product/view/:id', _handleProductView, true);

};

// === REQUEST HANDLERS

function _handleProductCreateView(req, res) {
    RC.ensureHasAccess(req, res, 'product', 'c', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        RC.render(req, res, 'product-create', {
            caller: caller,
            path: req.path
        });
    });
}

function _handleProductsView(req, res) {
    RC.ensureHasAccess(req, res, 'product', 'l', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        RC.getScopedStaticList(req, res, 'product', 'products', ProductModule, {}, RC.viewErrorCallbacks, function(products) {
            RC.render(req, res, 'product-list', {
                products : products,
                caller: caller,
                path: req.path
            });
        });
    });
}

function _handleProductView(req, res) {
    RC.ensureHasAccess(req, res, 'product', 'l', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        var id = req.params['id'];
        RC.getByIdIfAuthorized(req, res, id, 'product', ProductModule, RC.viewErrorCallbacks, function(item) {
            RC.render(req, res, 'product', {
                product : item,
                caller: caller,
                path: req.path
            });
        });
    });
}