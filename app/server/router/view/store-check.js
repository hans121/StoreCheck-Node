var _ = require('underscore');
var async = require('async');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var RC = require('../router-common');
var nodeUtils = require('../../modules/node-utils');
var formatter = require('../../modules/view-formatter');

var AccessManager = require('../../modules/access-manager');
var AuditAssignmentModule = require('../../modules/model/audit-assignment');
var AuditTeamModule = require('../../modules/model/audit-team');
var ProductModule = require('../../modules/model/hierarchy/product');
var SampleModule = require('../../modules/model/sample');
var StoreCheckModule = require('../../modules/model/store-check');
var TemplateModule = require('../../modules/model/template');
var VisitModule = require('../../modules/model/visit');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/store-checks/view', _handleStoreChecksView, true);

    RC.addHandler(app, 'get', '/store-check/view/create', _handleStoreChecksCreateView, true);

    RC.addHandler(app, 'get', '/store-check/view/:id', _handleStoreCheckView, true);

    RC.addHandler(app, 'get', '/store-check/:sid/product/:pid/samples/view', _handleStoreCheckProductSamplesView, true);
};

// === REQUEST HANDLERS

function _handleStoreChecksView(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        RC.listStoreChecks(req, res, caller, ["active"], RC.viewErrorCallbacks, function(active_store_checks){
            RC.listStoreChecks(req, res, caller, ["closed"], RC.viewErrorCallbacks, function(closed_store_checks) {

                var storecheck_ids = active_store_checks.map(function(check) {return check._id.toHexString();});
                AuditAssignmentModule.distinct('storecheck_id', {
                    organization: caller.active_organization,
                    storecheck_id: { $in: storecheck_ids },
                    state: 'active'
                }, {}, function(e, result) {
                    if(e) {
                        callback(e);
                        return;
                    }

                    // TODO: don't even make distinct call if they don't have access
                    // not a security as it happens server-side, but why pay performance penalties unnecessarily?
                    if(RC.userHasAccess(caller, "audit-assignment", "r")) {
                        for(var i=0; i<active_store_checks.length; i++) {
                            active_store_checks[i].assignment_ids = [];
                            for(var j=0; j<result.length; j++) {
                                if(result[j] == active_store_checks[i]._id.toHexString()) {
                                    active_store_checks[i].assignment_ids.push(result[j]);
                                }
                            }
                        }
                    }

                    RC.render(req, res,'store-check-list', {
                        active_store_checks : !active_store_checks ? [] : active_store_checks,
                        closed_store_checks : !closed_store_checks ? [] : closed_store_checks,
                        formatter: formatter,
                        read_only: !RC.userHasAccess(caller, 'store-check', 'u'),
                        caller: req.session.user,
                        access: AccessManager,
                        path: req.path
                    });
                });
            });
        });
    });
}

function _handleStoreChecksCreateView(req, res) {
    RC.ensureHasAccess(req, res, 'store-check', 'c', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        // get unassigned teams
        // get a list of active assignments

        AuditTeamModule.listByOrganizationsAndExcludeStatuses(caller.organizations, ["inactive"], function(error, teams) {
            RC.render(req, res, 'store-check-create', {
                formatter: formatter,
                caller: caller,
                path: req.path,
                teams: teams
            });
        });
    });
}

function _handleStoreCheckView(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        var id = req.params['id'];
        if(!nodeUtils.isValidId(id)) {
            RC.render500(req, res, RC.getInvalidIdMessage());
            return;
        }

        var storecheck;

        async.series({
            store_check: function(callback) {
                RC.getByIdIfAuthorized(req, res, id, 'store-check', StoreCheckModule, RC.viewErrorCallbacks, function(storecheck_result) {
                    storecheck = storecheck_result;
                    callback(null, storecheck);
                });
            },

            active_assignment: function(callback) {
                getActiveAssignmentForStoreCheck(storecheck._id.toHexString(), caller.organizations, function(err_assignment, assignment) {
                    callback(err_assignment, assignment);
                });
            },

            audit_teams: function(callback) {
                AuditTeamModule.find({}, function(error_teams, teams) {                    
                    callback(error_teams, teams);
                });
            },

            used_products: function(callback) {
                // get the products from the sample types
                var product_ids = StoreCheckModule.getDistinctSampleKeyValues(storecheck, 'product_id');
                ProductModule.listByIds(product_ids, function(err_used_products, used_products) {
                    callback(err_used_products, used_products);
                });
            },

            products: function(callback) {
                RC.getScopedStaticList(req, res, 'product', 'products', ProductModule, {}, RC.viewErrorCallbacks, function(products) {
                    callback(null, products);
                });
            },

            templates: function(callback) {
                if(_.findWhere(caller.roles, 'admin') || _.findWhere(caller.roles, 'exec')) {
                    TemplateModule.list(true, function(err_templates, templates) {
                        callback(err_templates, templates);
                    });
                    return;
                }

                TemplateModule.listByOrganizations(caller.organizations, function(err_templates, templates) {
                    callback(err_templates, templates);
                });
            }

        }, function(err_series, series_result) {

            RC.render(req, res, 'store-check', {
                storecheck : storecheck,
                teams: series_result.audit_teams,
                assignment: series_result.active_assignment,
                used_products: series_result.used_products,
                products: series_result.products,
                templates: series_result.templates,
                visits : [],
                caller: caller,
                read_only: !RC.userHasAccess(caller, 'store-check', 'u') || storecheck.state == 'closed',
                path: req.path
            });
        });
    });
}

function _handleStoreCheckProductSamplesView(req, res) {
    RC.ensureHasAccess(req, res, 'product', 'r', RC.viewErrorCallbacks, function(caller) { // TODO: review access requirement
        RC.logRequest(req, true, caller);

        var pid = req.param('pid');
        var sid = req.param('sid');

        _getSampleIdsFromStoreCheckAndProduct(req, res, sid, pid, RC.viewErrorCallbacks, function(sample_ids) {
            var url = '/samples/';
            _.each(sample_ids, function(sample_id, sample_index) {
                url += (sample_index > 0 ? ',' + sample_id : sample_id);
            });
            if(sample_ids.length > 0) {
                res.redirect(url + '/view');
                return;
            }

            RC.render(req, res, 'sample-list', {
                samples: JSON.stringify([]),
                formatter: formatter,
                caller: caller,
                path: '/samples/view',
                title: 'Sample List'
            });
        });
    });
}

// === HELPERS

function _getSampleIdsFromStoreCheckAndProduct(req, res, storecheck_id, product_id, errorCallbacks, resultCallback) {
    VisitModule.collection.find({ store_check_id: storecheck_id, "samples.product_id": product_id }, { "samples.id": 1, "samples.product_id": 1 }).toArray(function(err_samples, visits) {
        if(err_samples == null && visits != null) {

            var sample_ids = [];
            _.each(visits, function(visit) {
                _.each(visit.samples, function(sample) {
                    if(sample.product_id == product_id) {
                        sample_ids.push(sample.id);
                    }
                });
            });

            // get unique lists, convert to objectId
            resultCallback(_.uniq(sample_ids));
        } else if(err_samples != null) {
            errorCallbacks.on500(req, res, err_samples);
        } else {
            errorCallbacks.on404(req,res);
        }
    });
}

function getActiveAssignmentForStoreCheck(storecheck_id, organizations, callback) {
    AuditAssignmentModule.findOne({
        storecheck_id: storecheck_id,
        organization: { $in: organizations },
        state: "active"
    }, callback);
}