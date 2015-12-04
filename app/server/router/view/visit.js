var _ = require('underscore');
var async = require('async');
var moment = require('moment');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var formatter = require('../../modules/view-formatter');
var nodeUtils = require('../../modules/node-utils');
var RC = require('../router-common');

var AccessManager = require('../../modules/access-manager');
var AccountManagerModule = require('../../modules/account-manager');
var PointOfSaleModule = require('../../modules/model/hierarchy/point-of-sale');
var ProductModule = require('../../modules/model/hierarchy/product');
var SampleModule = require('../../modules/model/sample');
var StoreCheckModule = require('../../modules/model/store-check');
var TemplateModule = require('../../modules/model/template');
var VisitModule = require('../../modules/model/visit');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/visit/:vid/product/:pid/samples/view', _handleVisitProductSamplesView, true);

    RC.addHandler(app, 'get', '/visit/view/create', _handleVisitViewCreate, true);

    RC.addHandler(app, 'get', '/visits/view', _handleVisitsView, true);

    RC.addHandler(app, 'get', '/visit/view/:id', _handleViewVisit, true);
};

// === REQUEST HANDLERS

function _handleVisitProductSamplesView(req, res) {
    RC.ensureHasAccess(req, res, 'visit', 'r', RC.viewErrorCallbacks, function(caller) { // TODO: review access requirement
        RC.logRequest(req, true, caller);

        var vid = req.param('vid');
        var pid = req.param('pid');

        RC.getByIdIfAuthorized(req, res, vid, 'visit', VisitModule, RC.viewErrorCallbacks, function(visit) {
            RC.getByIdIfAuthorized(req, res, pid, 'product', ProductModule, RC.viewErrorCallbacks, function(product) {

                SampleModule.collection.find({visit_id: vid, product_id: pid}, {_id: 1}).toArray(function(err, sample_ids) {
                    if(err != null) {
                        RC.viewErrorCallbacks.on500(req, res, err);
                    } else {
                        sample_ids = _.pluck(sample_ids, '_id');
                        var path = '/visit/' + vid + '/product/' + pid + '/samples/view';
                        RC.renderSampleList(req, res, path, caller.roles[0] == 'auditor' ? 'View Samples' : 'View & Release Samples', {_id: { $in: sample_ids}}, caller);
                    }
                });
            });
        });
    });
}

function _handleVisitViewCreate(req, res) {
    RC.ensureHasAccess(req, res, 'visit', 'c', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        var storeCheckId = req.query.storecheck;
        RC.getByIdIfAuthorized(req, res, storeCheckId, 'store-check', StoreCheckModule, RC.viewErrorCallbacks, function(sc) {
            RC.listProducts(req, res, RC.viewErrorCallbacks, function(prod) {
                var aud = { _id: req.session.user._id, name: req.session.user.name };

                RC.render(req, res, 'visit-create', {
                    aud: aud,
                    sc: sc,
                    prod: prod,
                    moment: moment,
                    caller: caller,
                    path: req.path
                });
            });
        });
    });
}

function _handleVisitsView(req, res) {
    //RC.ensureHasAccess(req, res, 'visit', 'l', RC.viewErrorCallbacks, function(caller) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.listStoreChecks(req, res, caller, ['active'], RC.viewErrorCallbacks, function(items) {
            RC.render(req, res, 'visit-list', {
                storecheck_id: req.param('store-check'),
                checks : items,
                caller: caller,
                path: req.path
            });
        });
    });
}

function _handleViewVisit(req, res) {
    RC.ensureHasAccess(req, res, 'visit', 'r', RC.viewErrorCallbacks, function(caller) {
        var id = req.params['id'];
        var loaded_visit, loaded_sc;
        RC.logRequest(req, true, caller);

        async.series({
            visit: function(callback_async) {
                RC.getByIdIfAuthorized(req, res, id, 'visit', VisitModule, RC.viewErrorCallbacks, function(visit) {
                    loaded_visit = visit;
                    callback_async(null, visit);
                });
            },

            sc: function(callback_async) {
                RC.getByIdIfAuthorized(req, res, loaded_visit.store_check_id, 'store-check', StoreCheckModule, RC.viewErrorCallbacks, function(sc) {
                    loaded_sc = sc;
                    callback_async(null, sc);
                });
            },

            pos: function(callback_async) {
                RC.getByIdIfAuthorized(req, res, loaded_visit.pos_id, 'pos', PointOfSaleModule, RC.viewErrorCallbacks, function(pos) {
                    callback_async(null, pos);
                });
            },

            products: function(callback_async) {
                var product_ids = StoreCheckModule.getDistinctSampleKeyValues(loaded_sc, 'product_id');
                RC.getByIdsIfAuthorized(req, res, product_ids, 'product', ProductModule, RC.viewErrorCallbacks, function(products) {
                    callback_async(null, products);
                });
            },

            templates: function(callback_async) {
                var template_ids = StoreCheckModule.getDistinctSampleKeyValues(loaded_sc, 'template_id');
                RC.getByIdsIfAuthorized(req, res, template_ids, 'template', TemplateModule, RC.viewErrorCallbacks, function(templates) {
                    callback_async(null, templates);
                });
            },

            user: function(callback_async) {
                AccountManagerModule.findOne({ '_id' : ObjectId(loaded_visit.auditor_id) }, function(err_user, user) {
                    callback_async(err_user, user);
                });
            }
        }, function(errors, results) {
            results.visit.myAud = {
                _id: results.user != null ? results.user._id : null,
                name: results.user != null ? results.user.name : 'erased user'
            };
            results.visit.mySc = results.sc;
            
            RC.render(req, res, 'visit', _.extend(results, {
                caller: caller,
                access: AccessManager,
                read_only: !RC.userHasAccess(caller, 'visit', 'u'),
                path: req.path
            }));
        });
    });
}