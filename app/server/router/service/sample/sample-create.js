var _ = require('underscore');
var async = require('async');
var winston = require('winston');

var Common = require('../../router-common');
var formatter = require('../../../modules/view-formatter');
var nodeUtils = require('../../../modules/node-utils');
var schema = require('../../../modules/model/schema/schema');

var ActionAuditModule = require('../../../modules/action-audit');
var FactoryModule = require('../../../modules/model/hierarchy/factory');
var OrganizationModule = require('../../../modules/model/organization');
var PointOfSaleModule = require('../../../modules/model/hierarchy/point-of-sale');
var ProductionLineModule = require('../../../modules/model/hierarchy/production-line');
var ProductModule = require('../../../modules/model/hierarchy/product');
var SampleModule = require('../../../modules/model/sample');
var StoreCheckModule = require('../../../modules/model/store-check');
var TemplateModule = require('../../../modules/model/template');
var VisitModule = require('../../../modules/model/visit');

module.exports = {
    rawCreateSample: _rawCreateSample,
    getCreateSampleDependencies: _getCreateSampleDependencies
};

function _rawCreateSample(req, res, values, deps, metacopy_target, callback2) {
    var tasks = [], samples, metacopy, sample_name = values.name;
    var caller = req.session.user;

    tasks.push(function(callback) {
        // here, we could decide a good name for the sample, if it was not provided
        if(_.isUndefined(sample_name)) {
            _getBestSampleNameForVisit(deps.visit, function(err, best_sample_name) {
                if(!_.isUndefined(best_sample_name) && best_sample_name != null) {
                    sample_name = best_sample_name;
                }
                callback();
            });
        } else {
            callback();
        }
    });

    // if the sample is copied from another sample, do that copy
    if(typeof(metacopy_target) != 'undefined') {
        tasks.push(function(callback) {
            Common.getByIdIfAuthorized(req, res, metacopy_target, 'sample', SampleModule, Common.serviceErrorCallbacks, function(metacopy_result) {
                metacopy = metacopy_result;
                callback();
            });
        });
    }

    // build full sample record and insert it
    tasks.push(function(callback) {
        var best_by_date = values.best_by_date && values.best_by_date.length > 0 ? formatter.formatDate(values.best_by_date) : (typeof(metacopy) != 'undefined' ? metacopy.best_by_date : "");
        var batch_code = values.batch_code && values.batch_code.length > 0 ? values.batch_code : (typeof(metacopy) != 'undefined' ? metacopy.batch_code : "");

        var newSample = {
            name:                   sample_name,
            best_by_date:           best_by_date,
            creation_time:          formatter.getCurrentUtcTimeString(),
            update_time:            formatter.getCurrentUtcTimeString(),
            batch_code:             batch_code,
            active:                 true,
            note:                   (values && values.note ? values.note : ""),
            state:                  "draft",
            factory_code:           deps.factory == null ? (typeof(metacopy) != 'undefined' ? metacopy.factory_code : "") : deps.factory.code,
            production_line_code:   deps.production_line == null ? (typeof(metacopy) != 'undefined' ? metacopy.production_line_code : "") : deps.production_line.code,
            template_id:            deps.template._id.toHexString(),
            template_info:          {
                "name":             deps.template.name,
                "language":         deps.template.records[0].language,
                "t03_code":         deps.template.records[0].t03_code,
                "t03_description":  deps.template.records[0].t03_description,
                "t01_code":         deps.template.records[0].t01_code
            },
            product_id:             deps.product._id.toHexString(),
            product_info:           {
                name: deps.product.description3,
                code: deps.product.code
            },
            visit_id:               deps.visit._id.toHexString(),
            visit_info:             {
                auditor_name:               deps.visit.auditor_name,
                pos_name:                   deps.visit.pos_name,
                pos_id:                     deps.visit.pos_id,
                date_of_visit:              deps.visit.date_of_visit,
                date_of_visit_timestamp:    formatter.formattedDateToTimestamp(deps.visit.date_of_visit),
                store_check_id:             deps.visit.store_check_id,
                store_check_name:           deps.storecheck.name
            },
            image_count:            0,
            organization:           deps.template.organization,
            version:                schema.currentVersion
        };

        // attempt to get the int representation of the name, if able
        try {
            var name_as_int = parseInt(sample_name);
            if(!isNaN(name_as_int)) {
                newSample.name = name_as_int;
            }
        } catch(ex) {}

        if(deps.factory != null) {
            newSample.factory_id = deps.factory._id.toHexString();
        }
        if(deps.production_line != null) {
            newSample.production_line_id = deps.production_line._id.toHexString();
        }
        if(typeof(metacopy) != 'undefined') {
            newSample.factory_id = metacopy.factory_id;
            newSample.production_line_id = metacopy.production_line_id;
        }

        newSample.questions = deps.questions;

        SampleModule.processSampleConformances(newSample, deps.organization.settings);

        SampleModule.insert(newSample, function(samples_result) {
            if(samples_result && samples_result[0]) {
                samples = samples_result;
                deps.visit.samples.push({
                    id: samples[0]._id.toHexString(),
                    template_id: deps.template._id.toHexString(),
                    product_id:  deps.product._id.toHexString()
                });

                callback();
            } else {
                winston.log('warn', 'a POST /sample/create request from user=' + caller.name + ' failed because no samples were inserted');
                Common.pushMessage(req, 'error', 'Failed to create sample');
                callback2('Fact sheet not added', null);
            }
        });
    });

    // push the sample into the visit it belongs to
    tasks.push(function(callback) {
        VisitModule.update({
            query: { _id : deps.visit._id },
            value: {
                $push: {
                    samples: {
                        id: samples[0]._id.toHexString(),
                        template_id: deps.template._id.toHexString(),
                        product_id:  deps.product._id.toHexString()
                    }
                }
            }
        }, function(e) {
            if(e) {
                ActionAuditModule.report(caller, 'create', 'sample', '"' + sample_name + '" for visit "' + deps.visit.pos_name + ' ' + deps.visit.date_of_visit + '"');
                winston.log('debug', 'a POST /sample/create request from user=' + caller.name + ' has succeeded');
                Common.pushMessage(req, 'success', 'Successfully created sample ' + sample_name);
                callback();
            } else {
                winston.log('warn', 'a POST /sample/create request from user=' + caller.name + ' failed when adding the sample to a visit');
                Common.pushMessage(req, 'error', 'Failed to add visit to sample while creating sample');
                callback2('Failed to add visit to sample while creating sample', null);
            }
        });
    });

    // make sure the template is locked
    tasks.push(function(callback) {
        TemplateModule.update({
            query: { _id : deps.template._id },
            value: { $set: { read_only: true } }
        }, function(e) {
            if(e) {
                ActionAuditModule.report(caller, 'update', 'template/read-only', deps.template._id.toHexString());
                callback();
            } else {
                winston.log('warn', 'a POST /sample/create request from user=' + caller.name + ' failed when adding the sample to a visit');
                Common.pushMessage(req, 'error', 'Failed to add visit to sample while creating sample');
                callback2('Failed to add visit to sample while creating sample', null);
            }
        });
    });

    async.series(tasks, function(err, results) {
        callback2(err, err == null ? samples[0]._id.toHexString() : null);
    });
}

function _getCreateSampleDependencies(req, res, values, callback2) {
    var tasks = {}, product, caller = req.session.user, template, visit, pos;

    tasks.visit = function(callback) {
        Common.getByIdIfAuthorized(req, res, values.visit_id, 'visit', VisitModule, Common.serviceErrorCallbacks, function(visit_result) {
            visit = visit_result;
            callback(null, visit_result);
        });
    };

    /*
    tasks.pos = function(callback) {
        if(!visit || !visit.pos_id || !nodeUtils.isValidId(visit.pos_id)) {
            callback();
            return;
        }

        PointOfSaleModule.collection.findOne({_id: ObjectID(visit.pos_id)}, function(err_pos, pos_result) {
            if(err_pos) {
                callback(err_pos);
                return;
            }
            pos = pos_result;
            callback(pos_result);
        });
    };
*/
    tasks.storecheck = function(callback) {
        if(!visit || !visit.store_check_id) {
            callback();
            return;
        }
        Common.getByIdIfAuthorized(req, res, visit.store_check_id, 'store-check', StoreCheckModule, Common.serviceErrorCallbacks, function(storecheck_result) {
            callback(null, storecheck_result);
        });
    };

    tasks.product = function(callback) {
        Common.getByIdIfAuthorized(req, res, values.product_id, 'product', ProductModule, Common.serviceErrorCallbacks, function(product_result) {
            product = product_result;
            callback(null, product_result);
        });
    };

    tasks.factory = function(callback) {

        // get the factory, using sources in the following priority:
        // 1. the factory specified in the request by id
        // 2. the factory specified in the request by code
        // 2. the product's default factory
        if (nodeUtils.isValidId(values.factory_id)) {
            FactoryModule.findOneById(values.factory_id, function (err_factory, factory_result) {
                callback(null, factory_result);
            });
            return;
        }

        if (!_.isUndefined(values.factory_code)) {

            // NOTE: factories are no longer organization-scoped, so we aren't using "scoped" query
            Common.getStaticList('factories', FactoryModule, { code: values.factory_code }, function (err_factories, factories) {
                callback(err_factories, factories && factories.length > 0 ? factories[0] : null);
            });
            return;
        }

        // if we grabbed a product and weren't provided a factory id, use the product's default factory if able
        if (!_.isUndefined(product) && !_.isUndefined(product.default_factory)) {
            Common.getStaticList('factories', FactoryModule, {
                code: product.default_factory
            }, Common.queryResultHandler(req, res, Common.viewErrorCallbacks, function (factories) { // TODO: switch to more traditional result handling here
                callback(null, factories && factories != null && factories.length > 0 ? factories[0] : null);
            }));
            return;
        }

        callback(null, null);
    };

    tasks.production_line = function(callback) {
        if(nodeUtils.isValidId(values.production_line_id)) {
            ProductionLineModule.findOneById(values.production_line_id, function (err_prod_line, production_line_result) {
                callback(null, production_line_result);
            });
            return;
        }

        if (!_.isUndefined(values.factory_code)) {

            // NOTE: factories are no longer organization-scoped, so we aren't using "scoped" query
            Common.getStaticList('production-lines', ProductionLineModule, { code: values.production_line_code }, function (err_lines, lines) {
                callback(err_lines, lines && lines.length > 0 ? lines[0] : null);
            });
            return;
        }

        // if we grabbed a product and weren't provided a factory id, use the product's default factory if able
        if(!_.isUndefined(product) && !_.isUndefined(product.e06_code)) {
            Common.getStaticList('production-lines', ProductionLineModule, {
                code: product.e06_code
            }, Common.queryResultHandler(req, res, Common.viewErrorCallbacks, function(production_lines) {
                callback(null, production_lines && production_lines != null && production_lines.length > 0 ? production_lines[0] : null);
            }));
            return;
        }

        callback(null, null);
    };

    tasks.template = function(callback) {
        Common.getByIdIfAuthorized(req, res, values.template_id, 'template', TemplateModule, Common.serviceErrorCallbacks, function(template_result) {
            template = template_result;
            callback(null, template_result);
        });
    };

    tasks.organization = function(callback) {
        OrganizationModule.findOneById(template.organization, function(err_organization, organization) {
            callback(err_organization, organization);
        });
    };

    tasks.questions = function(callback) {
        OrganizationModule.listByIds(caller.organizations, function(err_orgs, organizations) {
            var settings = _.pluck(_.filter(organizations, function(org) { return typeof(org.settings) != 'undefined'; }), 'settings');
            var l1_t02_templates = _.compact(_.flatten(_.pluck(settings, 'templates')));
            Common.getQuestionsForTemplate(template, l1_t02_templates, function(err, questions_result) {
                if(err) {
                    callback(err);
                    return;
                }
                if(!questions_result || questions_result.length == 0) {
                    winston.log('warn', 'a POST /sample/create request from user=' + caller.name + ' failed because no questions were found in the provided audit grid template id=' + values.template_id);
                    Common.pushMessage(req, 'error', 'Failed to update sample because no questions were found in the audit grid template');
                    callback2('No questions were found in the chosen audit grid', null);
                    return;
                }
                callback(null, questions_result);
            });
        });
    };

    async.series(tasks, callback2);
}

function _getBestSampleNameForVisit(visit, callbackErrAndData) {

    var sample_ids = VisitModule.getDistinctSampleKeyValues(visit, 'id');
    SampleModule.listByIds(sample_ids, function(err, samples) {
        if(err != null || samples.length == 0) {
            callbackErrAndData(null, '1');
            return;
        }

        var max_sample_int = 0, nextInt;
        samples.forEach(function(samp) {
            try {
                nextInt = parseInt(samp.name);
                if(nextInt > max_sample_int) {
                    max_sample_int = nextInt;
                }
            } catch(ex) {

            }
        });
        callbackErrAndData(null, max_sample_int + 1);
    });
}