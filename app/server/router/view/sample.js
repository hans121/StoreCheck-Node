var winston = require('winston');
var ObjectId = require('mongodb').ObjectID;
var moment = require('moment');
var async = require('async');
var _ = require('underscore');

var RC = require('../router-common');
var nodeUtils = require('../../modules/node-utils');
var formatter = require('../../modules/view-formatter');
var category_specific = require('../../modules/category-specific');

var AccessModule = require('../../modules/access-manager');
var FactoryModule = require('../../modules/model/hierarchy/factory');
var OrganizationModule = require('../../modules/model/organization');
var ProductModule = require('../../modules/model/hierarchy/product');
var SampleModule = require('../../modules/model/sample');
var StoreCheckModule = require('../../modules/model/store-check');
var VisitModule = require('../../modules/model/visit');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/samples/view', _handleSamplesView, true);

    RC.addHandler(app, 'get', '/samples/:idlist/view/grid', _handleSamplesGridView, true);

    RC.addHandler(app, 'get', '/samples/:idlist/view', _handleViewSampleList, true);

    RC.addHandler(app, 'get', '/sample/view/:id', _handleSampleView, true);

    RC.addHandler(app, 'get', '/sample/view/:idList/defects', _handleSamplesDefectsView, true);

};

// === REQUEST HANDLERS

// view samples outside of idList scope
function _handleSamplesView(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        RC.render(req, res, 'sample-list', {
            caller: caller,
            path: req.path,
            title: caller.roles[0] == 'auditor' ? 'View Samples' : 'View & Release Samples'
        });
    });
}

function _handleSamplesGridView(req, res) {
    RC.ensureHasAccess(req, res, 'sample', 'r', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        var idListAsString = req.params['idlist'];
        if(idListAsString == null) {
            RC.viewErrorCallbacks.on500(req, res, 'no ids specified');
        } else {
            RC.getExtendedSamplesInfo(caller, idListAsString.split(','), req.param('questionId'), req, res, function(view_results) {
                RC.render(req, res, 'sample-grid', _.extend(view_results, {
                    moment: moment,
                    category_specific: category_specific,
                    caller: caller,
                    read_only: !RC.userHasAccess(caller, 'sample', 'u'),
                    path: req.path
                }));
            }, function(errors) {
                RC.viewErrorCallbacks.on500(res, res, errors);
            });
        }
    });
}

function _handleSampleView(req, res) {
    RC.ensureHasAccess(req, res, 'sample', 'r', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        var tasks = {}, visit, sample;
        tasks.sample = function(callback) {
            RC.getByIdIfAuthorized(req, res, req.params['id'], 'sample', SampleModule, RC.viewErrorCallbacks, function(sample_result) {
                sample = sample_result;
                callback(null, sample_result);
            });
        };

        tasks.visit = function(callback) {
            VisitModule.collection.findOne({_id: ObjectId(sample.visit_id)}, function(err_visit, visit_result) {
                if(err_visit) {
                    RC.viewErrorCallbacks.on500(req, res, err_visit);
                    return;
                }

                if(!visit_result) {
                    RC.viewErrorCallbacks.on404(req, res, 'visit not found');
                    return;
                }

                visit = visit_result;
                callback(null, visit_result);
            });
        };

        tasks.samples = function(callback) {
            if(!visit.samples) {
                callback(null, []);
                return;
            }

            var sample_ids = visit.samples.filter(function(e) {
                return e.product_id == sample.product_id && e.template_id == sample.template_id;
            }).map(function (e) { return e.id; });

            RC.getByIdsIfAuthorized(req, res, sample_ids, 'sample', SampleModule, RC.viewErrorCallbacks, function(samples_result) {
                callback(null, samples_result);
            });
        };

        tasks.storecheck = function(callback) {
            RC.getByIdIfAuthorized(req, res, visit.store_check_id, 'store-check', StoreCheckModule, RC.viewErrorCallbacks, function(storecheck_result) {
                callback(null, storecheck_result);
            });
        };

        tasks.product = function(callback) {
            RC.getByIdIfAuthorized(req, res, sample.product_id, 'product', ProductModule, RC.viewErrorCallbacks, function(product_result) {
                callback(null, product_result);
            });
        };

        tasks.factories = function(callback) {
            RC.getStaticList('factories', FactoryModule, { }, RC.queryNonFatalResultHandler(function(factories_result) { // TODO: improve, by making client call this
                callback(null, factories_result);
            }));
        };

        tasks.organization = function(callback) {
            OrganizationModule.findOneById(caller.active_organization, function(err_organization, organization) {
                callback(err_organization, organization);
            });
        };

        /*
         tasks.production_lines = function(callback) {
         RC.getStaticList('production-lines', ProductionLineModule, { hierarchy_level: "0" }, RC.queryNonFatalResultHandler(function(production_lines_result) {
         callback(null, production_lines_result);
         }));
         };
         */

        async.series(tasks, function(err, results) {
            RC.render(req, res, 'sample',
                _.extend(results, {
                    moment: moment,
                    caller: caller,
                    access: AccessModule,
                    read_only: !RC.userHasAccess(caller, 'sample', 'u'),
                    path: req.path
                })
            );
        });
    });
}

function _handleSamplesDefectsView(req, res) {
    RC.ensureHasAccess(req, res, 'sample', 'r', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        var sampleIdList = req.params['idList'], type = req.query['type'], from = req.query['from'];
        if(sampleIdList == null) {
            RC.viewErrorCallbacks.on500(req, res, 'no ids specified');
        } else if(type != 'non-conform' && type != 'alert') {
            RC.viewErrorCallbacks.on500(req, res, 'type must be one of ("non-conform" or "alert")');
        } else {
            sampleIdList = _.uniq(sampleIdList.split(','));
            RC.getByIdsIfAuthorized(req, res, sampleIdList, 'sample', SampleModule, RC.viewErrorCallbacks, function(samples) {
                var questions_for_sample, defects = {}, sample_data;

                var type_field = (type == 'non-conform' ? 'non_conform' : (type == 'alert' ? 'alerts' : type));
                _.each(samples, function(sample) {
                    _.each(sample[type_field], function(defect_id) {
                        defects[sample.template_info.t03_code + '_' + defect_id] = [];
                    });
                });

                // for each result, we need to find the questions for the given sample
                _.each(samples, function(sample) {

                    // here's where the t03/identity_id combo gets matched (implicitly)
                    questions_for_sample = _.filter(sample.questions, function(question) {
                        return _.indexOf(sample[type_field], question.identity_id) != -1;
                    });

                    if(questions_for_sample) {
                        sample_data = _.pick(sample, ["_id", "name", "best_by_date", "creation_time", "update_time", "batch_code",
                            "active", "note", "state", "factory_code", "production_line_code", "template_id", "template_info", "product_id",
                            "product_info", "visit_id", "visit_info", "non_conform", "alerts", "image_count", "image_urls"]);

                        _.each(questions_for_sample, function(question) {
                            SampleModule.deleteLevelCodes(question);
                            SampleModule.deleteExtraDescriptions(question);
                            SampleModule.deleteSequenceCodes(question);

                            question.sample = sample_data;
                            defects[sample.template_info.t03_code + '_' + question.identity_id].push(question);
                        });
                    }
                });

                RC.render(req, res, 'defects-by-type', {
                    defects: defects,
                    moment: moment,
                    caller: caller,
                    read_only: !RC.userHasAccess(caller, 'sample', 'r'),
                    path: req.path
                });
            });
        }
    });
}

function _handleViewSampleList(req, res) {
    RC.ensureHasAccess(req, res, 'sample', 'r', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        var idListAsString = req.params['idlist'];
        if(idListAsString == null) {
            RC.viewErrorCallbacks.on500(req, res, 'no ids specified');
        } else {
            var idList = idListAsString.split(',');
            idList = _.map(idList, function(id) { return ObjectId(id); });
            RC.renderSampleList(req, res, '/samples/view', caller.roles[0] == 'auditor' ? 'View Samples' : 'View & Release Samples', {_id: { $in: idList}}, caller);
        }
    });
}