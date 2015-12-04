var _ = require('underscore');
var fs = require('fs');
var schema = require('../../modules/model/schema/schema');
var formatter = require('../../modules/view-formatter');
var ObjectId = require('mongodb').ObjectID;

var node_utils = require('../../modules/node-utils');

var ActionAuditModule = require('../../modules/action-audit');
var Common = require('../router-common');
var Database = require('../../modules/database/database');
var ProductModule = require('../../modules/model/hierarchy/product');
var ProductHierarchyModule = require('../../modules/model/hierarchy/product-hierarchy');
var StaticLoadModule = require('../../modules/static-loads');

module.exports = function(app) {

    // Creates a product
    //
    // Error conditions:
    //     - Caller isn't authorized to create products
    Common.addHandler(app, 'put', '/product', _handleCreateProduct);

    // Updates a product
    //
    // Error conditions:
    //
    Common.addHandler(app, 'post', '/product/:id', _handleUpdateProduct);

    // Reads product hierarchy files and puts them into the product-hierarchy static load table
    //
    // Error conditions:
    //     - Caller does not have product/hierarchy create access
    //     - There was an issue reading one or more files
    Common.addHandler(app, 'post', '/product-hierarchy/reload', _handleInitProductHierarchy);

    // === GET METHODS

    // Gets a product by ID
    //
    // Error conditions:
    //     - See RouterCommon.getByIdIfAuthorized (product)
    Common.addHandler(app, 'get', '/product/:id', function(req, res) {
        Common.getResourceById(req, res, 'get', '/product/:id', 'product', ProductModule);
    });

    Common.addHandler(app, 'get', '/products', _handleQueryProducts);

    //Common.addStandardQueryHandler(app, '/products', ProductModule, 'products', false);
};

// === REQUEST HANDLERS

function _handleCreateProduct(req, res) {
    Common.ensureHasAccess(req, res, 'product', 'c', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        // TODO: validate body
        req.body.version = schema.currentVersion;
        req.body.organization = caller.active_organization;
        ProductModule.insert(req.body, function(e) {
            if(e) {
                ActionAuditModule.report(caller, 'create', 'product', req.body.product_description);
                Common.pushMessage(req, 'success', 'Successfully created product');
                res.send(e[0]._id.toHexString(), 200);
            } else{
                Common.pushMessage(req, 'error', 'Failed to create product');
                res.send('no product was inserted', 400);
            }
        });
    });
}

function _handleUpdateProduct(req, res) {
    Common.getByIdIfAuthorized(req, res, req.param("id"), 'product', ProductModule, Common.serviceErrorCallbacks, function(product, caller) {
        Common.logRequest(req, true, caller);

        ProductModule.update({
            query: { _id : product._id },
            value: {
                $set: {
                    product_code:           req.body.product_code,
                    description:            req.body.description,
                    default_factory:        req.body.default_factory,
                    pickup:                 req.body.pickup,
                    flavor:                 req.body.flavor,
                    type:                   req.body.type,
                    format:                 req.body.format,
                    ean_13:                 req.body.ean_13,
                    global_brand:           req.body.global_brand,
                    version:                schema.currentVersion
                }
            }
        }, function(e){
            if(e) {
                ActionAuditModule.report(req.session.user, 'update', 'product', product.name);
                Common.pushMessage(req, 'success', 'Successfully updated product');
                res.send({result: 'ok'}, 200);
            }	else{
                Common.pushMessage(req, 'error', 'Failed to update product');
                res.send(e, 400);
            }
        });
    });
}

function _handleQueryProducts(req, res) {
    Common.ensureHasAccess(req, res, 'product', 'l', Common.serviceErrorCallbacks, function(caller) {

        StaticLoadModule.findLatest('products', function(err, static_object) {
            if (err || !static_object) {
                Common.on500(req, res, err);
                return;
            }

            var page = req.query['page'];
            var pageSize = req.query['pageSize'];

            var query = {}, sort_by = {};
            node_utils.buildTableQuery(req.query.sort, req.query.filter, {}, query, sort_by, []);

            var fields = {
                _id: 1,
                description3: 1,
                product_code: 1,
                flavor: 1,
                default_factory: 1,
                type: 1,
                ean_13: 1,
                organization_description: 1,
                organization: 1,
                active: 1
            };

            query.timestamp = static_object.timestamp;

            if (caller.organizations && caller.organizations.length > 0) {
                query.organization = {$in: caller.organizations};
            }

            Database.query(ProductModule.collection, {
                query: query,
                sort_by: sort_by,
                fields: fields,
                page: page,
                pageSize: pageSize
            }, function (err_query, query_results) {
                if (err_query) {
                    Common.on500(req, res, err_query);
                    return;
                }
                res.send(query_results, 200);
            });
        });
    });
}

// === PRODUCT HIERARCHY METHODS

function _handleInitProductHierarchy(req, res) {
    Common.ensureHasAccess(req, res, 'product/hierarchy', 'c', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        ProductHierarchyModule.removeAll(function(err) {
            var files = fs.readdirSync('data/products');
            files = _.map(files, function(file) {
                return 'data/products/' + file;
            });
            ProductHierarchyModule.readFiles(files, function(err_product, products) {
                ActionAuditModule.report(caller, 'create', 'product/hierarchy', 'init');

                ProductModule.process({}, function(err, added) {
                    if(err != null) {
                        res.send(err, 400);
                    } else {
                        ActionAuditModule.report(caller, 'create', 'product-hierarchy', 'process');
                        res.send({result: 'ok'}, 200);
                    }
                });
            });
        });
    });
}
