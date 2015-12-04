var _ = require('underscore');
var async = require('async');
var fs = require('fs');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var categorySpecific = require('../../modules/category-specific');
var formatter = require('../../modules/view-formatter');
var nodeUtils = require('../../modules/node-utils');
var schema = require('../../modules/model/schema/schema');

var Common = require('../router-common');
var PointOfSaleModule = require('../../modules/model/hierarchy/point-of-sale');
var SampleModule = require('../../modules/model/sample');
var StoreCheckModule = require('../../modules/model/store-check');
var VisitReportModule = require('../../modules/model/visit-reports');
var VisitModule = require('../../modules/model/visit');

// there are effectively two types of reports:
// - supervisory report via /report/samples
// - cbu-scoped reports of defects/alerts

module.exports = function(app) {

    // Returns a structure containing information of many types
    //
    // Query params:
    //     - storecheck
    //     -
    //
    // Error conditions:
    //     -
    Common.addHandler(app, 'get', '/report/samples', function(req, res) {
        Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
            Common.logRequest(req, true, caller);

            _miniReport(req, res, caller);
        });
    });

    // Returns a structure containing information about how many defects have been reported per
    // point of sale.  It  uses a limit (currently at 1000)
    //
    // Query params:
    //     - from: zulu-string start-date (optional)
    //
    // Error conditions:
    //     -
    Common.addHandler(app, 'get', '/report/defects/pos', function(req, res) {
        Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
            Common.logRequest(req, true, caller);

            _reportDefectsByPos(req, res, caller, 'non-conform');
        });
    });

    // Returns a structure containing information about how many alerts have been reported per
    // point of sale.  It looks at the most recent samples, and uses a limit (currently at 1000)
    //
    // Query params:
    //     - from: zulu-string start-date (optional)
    //
    // Error conditions:
    //     -
    Common.addHandler(app, 'get', '/report/alerts/pos', function(req, res) {
        Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
            Common.logRequest(req, true, caller);

            _reportDefectsByPos(req, res, caller, 'alerts');
        });
    });

    // Returns a structure containing information about how many defects have been reported per
    // visit.  It uses a limit (currently at 1000)
    //
    // Query params:
    //     - from: zulu-string start-date (optional)
    //
    // Error conditions:
    //     -
    Common.addHandler(app, 'get', '/report/defects/visit', function(req, res) {
        Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
            Common.logRequest(req, true, caller);

            _reportDefectsByVisit(req, res, caller, 'non-conform');
        });
    });

    // Returns a structure containing information about how many alerts have been reported per
    // visit.  It uses a limit (currently at 1000)
    //
    // Query params:
    //     - from: zulu-string start-date (optional)
    //
    // Error conditions:
    //     -
    Common.addHandler(app, 'get', '/report/alerts/visit', function(req, res) {
        Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
            Common.logRequest(req, true, caller);

            _reportDefectsByVisit(req, res, caller, 'alerts');
        });
    });

    // Returns a structure containing information about how many defects have been reported per
    // item.  It uses a limit (currently at 1000)
    //
    // Query params:
    //     - from: zulu-string start-date (optional)
    //
    // Error conditions:
    //     -
    Common.addHandler(app, 'get', '/report/defects/item', function(req, res) {
        Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
            Common.logRequest(req, true, caller);

            _reportDefectsByItem(req, res, caller, 'non-conform');
        });
    });

    // Returns a structure containing information about how many alerts have been reported per
    // item.  It uses a limit (currently at 1000)
    //
    // Query params:
    //     - from: zulu-string start-date (optional)
    //
    // Error conditions:
    //     -
    Common.addHandler(app, 'get', '/report/alerts/item', function(req, res) {
        Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
            Common.logRequest(req, true, caller);

            _reportDefectsByItem(req, res, caller, 'alerts');
        });
    });

};

// === HELPERS

// visit filters: Store Check, POS, Auditor
// sample filters: Validation Status (Yes = Validated / No = In progress ), SKU
// "question" filters: Parameter, Item

function _miniReport(req, res, caller) {

    var organization = null;
    if(caller.roles.indexOf('admin') == -1 && caller.roles.indexOf('CBU') != -1) {
        organization = caller.active_organization;
    }

    var storecheck = req.query['storecheck'];
    var auditor = req.query['auditor'];
    var product = req.query['product'];
    var state = req.query['state'];
    var parameter = req.query['parameter'];
    var conformance = req.query['weight'];

    async.series({

        'aggregation_query': function(callback_async) {
            var pipeline = [];

            // apply any filters that can be done at the beginning of the pipeline
            if(storecheck || organization || auditor) {
                var early_match = {};

                // scope to storecheck if provided
                if(storecheck) {
                    early_match.storecheck = storecheck;
                }

                // scope to organization if needed
                if(organization) {
                    early_match.organization = organization;
                }

                // auditor is at the visit level, process that filter if needed
                if(auditor) {
                    early_match.auditor_name = auditor;
                }

                pipeline.push({$match: early_match});
            }

            // regardless, we need to unwind answers
            pipeline.push({$unwind: '$answers'});

            // if we need to filter on product, parameter, or conformance, we can do that before unwinding samples for the given answer
            if(parameter || conformance) {
                var mid_unwind_match = {};

                if(parameter) {
                    mid_unwind_match["answers._id"] = parameter;
                }

                // apply conformance filter
                if(conformance) {
                    var conformances = conformance.split(',');
                    if(conformances.length > 1) {
                        mid_unwind_match['answers.conformance'] = {$in: conformances};
                    } else {
                        mid_unwind_match['answers.conformance'] = conformance;
                    }
                }

                pipeline.push({$match: mid_unwind_match});
            }

            // we also need to unwind samples
            pipeline.push({$unwind: '$answers.samples'});

            // apply state filter
            if(product || state) {

                if(state) {
                    pipeline.push({$match: {'answers.samples.state': state}});
                }

                if(product) {
                    pipeline.push({$match: {'answers.samples.pc': product}});
                }
            }

            // group answers back together
            pipeline.push({
                $group: {
                    _id: "$answers._id",
                    "count": {"$sum": 1},
                    "conformance": {"$first": "$answers.conformance"},
                    "i": {"$first": "$answers.index"},
                    "l0": {"$first": "$answers.l0"},
                    "l5": {"$first": "$answers.l5"},
                    "samples": {
                        $addToSet: {
                            id: '$answers.samples.id',
                            state: '$answers.samples.state'
                        }
                    }
                }
            });

            VisitReportModule.reports.aggregate(
                pipeline,
                { allowDiskUse: true },
                function(err_reports, reports) {
                    if(err_reports) {
                        res.send(err_reports, 500);
                        return;
                    }

                    // TODO: sort questions by sequence, assign indices, then massage

                    var questions = {}, samples = {}, sample_id;
                    if(reports) {
                        reports.forEach(function (answer_record) {
                            answer_record.samples = answer_record.samples.map(function (sample_tuple) {
                                sample_id = sample_tuple.id.toHexString();
                                samples[sample_id] = 1;
                                return sample_id;
                            });
                            answer_record.conformance = SampleModule.getABCWeight(answer_record.conformance ? answer_record.conformance.toUpperCase() : 'A');
                            answer_record.descriptions = {};
                            answer_record.level5_descriptions = {};
                            if (answer_record.l0) {
                                answer_record.l0.forEach(function (translation) {
                                    answer_record.descriptions[translation.lang] = translation.text;
                                });
                            }
                            if(answer_record.l5) {
                                answer_record.l5.forEach(function (translation) {
                                    answer_record.level5_descriptions[translation.lang] = translation.text;
                                });
                            }
                            delete answer_record.l0;
                            delete answer_record.l5;

                            questions[answer_record._id] = answer_record;
                        });
                    }
                    res.send({
                        sample_count: Object.keys(samples).length,
                        questions: questions
                    }, 200);
                }
            );
        }
    });
}

function _miniReportV1(req, res, caller) {
    var find_query = {};

    var visit_ids, samples, item_map = {};

    async.series([

        // process storecheck filters
        function(callback) {
            Common.listVisitIds(req, res, Common.serviceErrorCallbacks, function(visible_visit_ids) {
                var storecheck_query = req.query['storecheck'];
                if(_.isUndefined(storecheck_query)) {
                    visit_ids = _.map(visible_visit_ids, function(id) { return id.toHexString();});
                    callback();
                    return;
                }

                // ensure can access storecheck and id is of valid format
                Common.getByIdIfAuthorized(req, res, storecheck_query, 'store-check', StoreCheckModule, Common.serviceErrorCallbacks, function(storecheck) {

                    // if we're restricting to storechecks, we are really restricting to visits
                    VisitModule.getVisitsForStoreCheck(storecheck_query, {_id: 1}, function(err_visits, storecheck_visit_ids) {
                        if(err_visits != null) {
                            callback(err_visits);
                            return;
                        }

                        // get ids as strings (TODO: only allow ones in visible_visit_ids?)
                        storecheck_visit_ids = _.pluck(storecheck_visit_ids, '_id');
                        visit_ids = _.map(storecheck_visit_ids, function(id) { return id.toHexString();});

                        callback();
                    });
                });
            });
        },

        // process auditor name filters on visits
        function(callback) {
            if(_.isUndefined(req.query['auditor'])) {
                callback();
                return;
            }

            VisitModule.collection.distinct('_id', {auditor_name: req.query['auditor']}, function(err_visits, auditor_visit_ids) {
                if(err_visits != null) {
                    callback(err_visits);
                    return;
                }

                auditor_visit_ids = _.map(auditor_visit_ids, function(id) { return id.toHexString();});

                // either use this as the filter, or use the intersection of existing filters
                if(_.isUndefined(visit_ids)) {
                    visit_ids = auditor_visit_ids;
                } else {
                    visit_ids = _.intersection(visit_ids, auditor_visit_ids);
                }

                callback();
            });
        },

        // apply all visit-based filters
        function(callback) {
            if(_.isUndefined(visit_ids)) {
                callback();
                return;
            }
            find_query.visit_id = {$in: visit_ids};
            callback();
        },

        /*
        // the VISIT param will limit to organization, so this only serves to slow the query
        // always limit to organization, except for with global users
        function(callback) {
            if(!nodeUtils.isUserGlobal(caller)) {
                find_query.organization = {$in: caller.organizations};
            }
            callback();
        },
        */

        // filter samples by product
        function(callback) {
            if(_.isUndefined(req.query['product'])) {
                callback();
                return;
            }

            find_query["product_info.code"] = req.query['product'];
            callback();
        },

        // filter samples by state
        function(callback) {
            if(_.isUndefined(req.query['state'])) {
                callback();
                return;
            }

            find_query["state"] = req.query['state'];
            callback();
        },

        // TODO: if conformity is selected, we could probably query by defect_count, alert_count, etc

        // after all visit and sample filters are found, get the samples
        function(callback) {
            samples = [];
            _doBigSampleQuery(find_query, samples, 300, function(err_samples, samples_results) {
                if(err_samples != null) {
                    callback(err_samples);
                    return;
                }
                samples = samples_results;
                callback();
            });
        },

        // filter by parameter (i.e. delete them from the resulting samples in memory)
        function(callback) {
            if(_.isUndefined(req.query['parameter'])) {
                callback();
                return;
            }

            var parameter = req.query['parameter'];
            _.each(samples, function(sample) {
                var question = _.findWhere(sample.questions, {level5_code: parameter});
                sample.questions = (question ? [question] : []);
            });

            callback();
        },

        // filter by item in memory
        function(callback) {
            if(_.isUndefined(req.query['item'])) {
                callback();
                return;
            }

            var parameter = req.query['item'];
            _.each(samples, function(sample) {

                // find the questionto which the "answer" belongs
                sample.questions = _.filter(sample.questions, function(question) {
                    var answer = _.findWhere(question.answers, {code: parameter});
                    return !_.isUndefined(answer);
                });

                // now, remove all answers besides the one we want
                _.each(sample.questions, function(question) {
                    question.answers = [_.findWhere(question.answers, {code: parameter})];
                });
            });

            callback();
        },

        // filter by weight: accept A,B,C or upper = CONFORM, NON-CONFORM, ALERT
        function(callback) {
            if(_.isUndefined(req.query['weight'])) {
                callback();
                return;
            }

            var parametersABC = _.map(req.query['weight'].split(','), function(param) { return SampleModule.getABCWeight(param.toUpperCase()); });

            var matched_samples = {};
            _.each(samples, function(sample) {
                _.each(sample.questions, function(question) {
                    var answer_result = [];
                    _.each(question.answers, function(answer) {
                        var cat_specific = categorySpecific.getQuestionType(question.category_specific);
                        if(cat_specific == "select" || cat_specific == "checkbox") {
                            if(parametersABC.indexOf(SampleModule.getABCWeight(answer.weight)) != -1 && answer.value == "true") {
                                matched_samples[sample._id.toHexString()] = sample;
                                answer_result.push(answer);
                            }
                        }
                    });
                    question.answers = answer_result;
                });
            });

            samples = [];
            var matched_sample_keys = _.keys(matched_samples);
            _.each(matched_sample_keys, function(sample_record) {
                samples.push(matched_samples[sample_record]);
            });

            callback();
        },

        // once filtered, make a distribution of item -> count
        function(callback) {
            // loop through remaining sample items
            _.each(samples, function(sample) {
                _.each(sample.questions, function(question) {

                    var cat_specific = categorySpecific.getQuestionType(question.category_specific);
                    if(cat_specific == "select" || cat_specific == "checkbox") {
                        _.each(question.answers, function(answer) {
                            if(_.isUndefined(item_map[answer.code])) {
                                item_map[answer.code] = {
                                    count: 0,
                                    descriptions: {},
                                    level5_descriptions: {},
                                    samples:[],
                                    level1_sequence: question.level1_sequence,
                                    level2_sequence: question.level2_sequence,
                                    level3_sequence: question.level3_sequence,
                                    level4_sequence: question.level4_sequence,
                                    level5_sequence: question.level5_sequence,
                                    conformance: SampleModule.getABCWeight(answer.weight)
                                };
                            }

                            if(answer.value == "true") {
                                item_map[answer.code].count++;
                                item_map[answer.code].samples.push(sample._id.toHexString());
                            }

                            // TODO: I hope this doesn't end up slowing us down for very little extra gain
                            item_map[answer.code].level5_descriptions[sample.template_info.language] = question.level5_description2;
                            item_map[answer.code].descriptions[sample.template_info.language] = answer.text;
                        });
                    }
                });
            });
            callback();
        },

        // sort all questions that remain in the samples that remain
        // they want something very specific: sorting across all samples/templates
        function(callback) {

            // we need to turn the item_map into an array
            var item_array = [];
            _.each(_.keys(item_map), function(key) {
                item_array.push({key: key, item: item_map[key]});
            });

            // then sort based on that item's question's sequence numbers
            item_array.sort(function(a, b) {
                return SampleModule.questionSortFunction(a.item, b.item);
            });

            // apply the index of each item in the array back to the item_map
            _.each(item_array, function(item, index) {
                item_map[item.key].index = index;
            });

            // OLD METHOD:
            //_.each(samples, function(sample) {
            //    SampleModule.sortQuestions(sample.questions);
            //});

            callback();
        }

    ], function(err_reports) { // , report_results
        if(err_reports != null) {
            Common.serviceErrorCallbacks.on500(req, res, err_reports);
            return;
        }

        res.send({
            sample_count: samples.length,
            questions: item_map
        }, 200);
    });
}

function _doTraditionalSampleQuery(find_query, callback2) {
    SampleModule.collection.find(
        find_query,
        {
            _id: 1,
            'questions.level1_sequence': 1,
            'questions.level2_sequence': 1,
            'questions.level3_sequence': 1,
            'questions.level4_sequence': 1,
            'questions.level5_sequence': 1,
            'questions.level5_description2': 1,
            'questions.category_specific': 1,
            'questions.answers.active': 1,
            'questions.answers.code': 1,
            'questions.answers.sequence': 1,
            'questions.answers.text': 1,
            'questions.answers.value': 1,
            'questions.answers.weight': 1,
            template_info: 1
        }
        //{limit: 1000, sort: [['_id',-1]]}
    ).toArray(function(err_samples, samples_results) {
        callback2(err_samples, samples_results);
    });
}

// the aggregation framework has a 16 MB limit on results, so
// for FRIGGIN GIANT result sets, we need to append multiple
// aggregation results together
function _doBigSampleQuery(find_query, samples_out, pageSize, callback2) {

    var extended_fields = {
        _id: 1,
        'questions.level1_sequence': 1,
        'questions.level2_sequence': 1,
        'questions.level3_sequence': 1,
        'questions.level4_sequence': 1,
        'questions.level5_sequence': 1,
        'questions.level5_description2': 1,
        'questions.category_specific': 1,
        'questions.answers': 1,
        template_info: 1
    };

    var aggregation_values = [];

    if(_.keys(find_query).length > 0) {
        aggregation_values.push({ $match: find_query });
    }

    SampleModule.collection.find(find_query).count(function(err_count, count) {
        if (err_count) {
            callback2(err_count);
            return;
        }

        SampleModule.collection.aggregate(
            [
                { $match: find_query },

                { $skip: samples_out.length },

                { $limit: pageSize },

                // pull apart "questions"
                { $unwind: '$questions' },

                // eliminate fields from "questions"
                { $project: extended_fields },

                // consolidate questions back into sample
                { $group: { _id: {_id: '$_id', template_info: '$template_info' }, questions: {$push: '$questions'}}},

                // rename properties
                { $project: {
                        _id: '$_id._id',
                        template_info: '$_id.template_info',
                        questions: '$questions'
                    }
                }
            ],
            {
                allowDiskUse: true
            }, function (err_samples, samples_results) {
                if (err_samples) {
                    callback2(err_samples);
                    return;
                }
                samples_out = samples_out.concat(samples_results);

                if(samples_out.length < count) {
                    nodeUtils.recursiveWrapper(function() { _doBigSampleQuery(find_query, samples_out, pageSize, callback2); });
                    return;
                }
                callback2(null, samples_out);
            }
        );
    });

    /*
    SampleModule.collection.find(find_query).count(function(err_count, count) {
        if(err_count) {
            callback2(err_count);
            return;
        }

        var aggregation_values = [
            { $match: find_query },
            //{ $unwind: "$questions" },
            { $project: fields }

        ];

        if(samples_out.length >= count) {
            callback2(null, samples_out);
            return;
        }

        //aggregation_values.push({ $sort: sort });
        aggregation_values.push({ $skip: samples_out.length });
        aggregation_values.push({ $limit: pageSize });

        SampleModule.collection.aggregate(
            aggregation_values,
            {
                allowDiskUse: true
            }, function(err_samples, samples_results) {
                if(err_samples) {
                    callback2(err_samples);
                    return;
                }
                _.each(samples_results, function(sample) {
                    sample.questions = _.map(sample.questions, function(question) {
                        return _.pick(question, question_field_list);
                    });
                });

                samples_out = samples_out.concat(samples_results);

                if(samples_out.length < count) {
                    nodeUtils.recursiveWrapper(function() { _doBigSampleQuery(find_query, samples_out, callback2); });
                    return;
                }
                callback2(null, samples_out);
            }
        );
    });
    */
}

function _reportDefectsByVisit(req, res, caller, type) {
    if(caller.roles[0] == 'admin' || caller.roles.indexOf('exec') != -1 || caller.roles[0] == 'CBU') {
        var query = {};
        if(caller.active_organization) {
            query.organization = { $in: caller.organizations };
        }
        if(type == 'non-conform') {
            query.non_conform = {$not: {$size: 0}};
        } else if(type == 'alerts') {
            query.alerts = {$not: {$size: 0}};
        } else {
            res.send('type must be one of "non-conform" or "alerts"', 400);
        }
        if(typeof(req.query['from']) != 'undefined') { query['answer_time'] = {$gte: req.query['from']}; }
        SampleModule.findWithOptions(
            query,
            {limit: 1000, sort: [['_id',-1]]},
            function(err, samples) {

                if(samples && samples.length > 0) {
                    var visit_distribution = {}, i;
                    _.each(samples, function(sample) {
                        var collectionOfInterest = sample.non_conform;
                        if(type == 'alerts') {
                            collectionOfInterest = sample.alerts;
                        }

                        if(typeof(visit_distribution[sample.visit_id]) == 'undefined') {
                            visit_distribution[sample.visit_id] = { count: collectionOfInterest.length, sample: sample };
                        } else {
                            visit_distribution[sample.visit_id].count += collectionOfInterest.length;
                        }
                    });

                    // get the unique list of visit ids from the samples
                    var visit_ids = _.keys(visit_distribution), pos_ids;

                    // get the visits for the samples
                    VisitModule.listByIds(visit_ids, function(err, visits) {
                        _.each(visits, function(visit) {
                            visit_distribution[visit._id.toHexString()].visit = {
                                name : visit.pos_name + ' ' + visit.date_of_visit,
                                date_of_visit : visit.date_of_visit,
                                pos_name : visit.pos_name,
                                state : visit.state
                            };
                        });

                        res.send({
                            visits_summary: visit_distribution,
                            processed_sample_count: samples.length
                        }, 200);
                    });

                } else {
                    res.send({}, 200);
                }
            }
        );
    } else {
        Common.serviceErrorCallbacks.on404(req, res);
    }
}

// type = 'non-conform' or 'alerts'
function _sampleDefectOrAlertCountsByVisit(caller, additional_queries, type, project_additional_properties, callback2) {
    var find_query = {}, type_property;

    if(caller.organizations) {
        find_query.organization = { $in: caller.organizations };
    }

    if(additional_queries) {
        _.keys(additional_queries).forEach(function(query_key) {
            find_query[query_key]  = additional_queries[query_key];
        });
    }

    if(type == 'non-conform') {
        type_property = 'non_conform';
        find_query.non_conform = {$not: {$size: 0}};
    } else if(type == 'alerts') {
        type_property = 'alerts';
        find_query.alerts = {$not: {$size: 0}};
    }

    var unwind_part = {};
    unwind_part['$unwind'] = '$' + type_property;

    var group_values = { _id: '$visit_id', count: {$sum: 1} };

    if(project_additional_properties.length > 0) {
        project_additional_properties.forEach(function(property) {
            group_values[property] = {$addToSet: '$' + property};
        });
    }

    SampleModule.collection.aggregate(
        [
            { $match: find_query },

            { $unwind: '$' + type_property },

            { $group: group_values}

        ],
        {
            allowDiskUse: true
        },
        callback2
    );
}

function _reportDefectsByPos(req, res, caller, type) {
    if(_.intersection(['admin', 'exec', 'CBU'], caller.roles).length == 0) {
        Common.serviceErrorCallbacks.on404(req, res);
        return;
    }

    if(['non-conform', 'alerts'].indexOf(type) == -1) {
        res.send('type must be one of "non-conform" or "alerts"', 400);
        return;
    }

    var start_time = new Date();

    var extra_query = {};

    if(typeof(req.query['from']) != 'undefined') { extra_query['answer_time'] = {$gte: req.query['from']}; }

    _sampleDefectOrAlertCountsByVisit(caller, extra_query, type, [], function(err_by_visit, visit_results) {

        if(err_by_visit) {
            Common.on500(req, res, err_by_visit);
            return;
        }

        var defects_by_visit = _.indexBy(visit_results, '_id');

        var visit_to_pos = {}, pos_count = {};

        async.series({

            visit_to_pos_mapping: function(callback) {

                var ids_as_objects = _.map(visit_results, function (visit) {
                    return ObjectId(visit._id);
                });

                // make the count be by pos_id instead of visit_id
                VisitModule.collection.find(
                    {
                        _id: {$in: ids_as_objects}
                    },
                    {
                        _id: 1,
                        pos_id: 1
                    }
                ).toArray(function (err_pos_id, pos_mapping) {
                    if (err_pos_id) {
                        Common.on500(req, res, err_pos_id);
                        return;
                    }

                    visit_to_pos = pos_mapping;

                    callback(null, visit_to_pos);
                });
            },

            pos_count: function(callback) {
                var visit_count;
                visit_to_pos.forEach(function (pos_map_item) {
                    visit_count = defects_by_visit[pos_map_item._id.toHexString()];

                    if (visit_count && visit_count.count) {
                        if (pos_count[pos_map_item.pos_id]) {
                            pos_count[pos_map_item.pos_id] += visit_count;
                        } else {
                            pos_count[pos_map_item.pos_id] = visit_count;
                        }
                    }
                });

                callback(null, pos_count);
            },

            pos_details: function(callback) {

                var pos_ids = _.map(_.keys(pos_count), function (pos_key) {
                    return ObjectId(pos_key);
                });

                PointOfSaleModule.collection.find({
                    _id: {$in: pos_ids}
                }, {
                    company_name: 1,
                    address1: 1,
                    city: 1,
                    country: 1,
                    latitude: 1,
                    longitude: 1
                }).toArray(function (err_pos, pos_info) {
                    if (err_pos) {
                        Common.on500(req, res, err_pos);
                        return;
                    }

                    // index results by id
                    var pos_without_oids = _.map(pos_info, function (pos) {
                        pos._id = pos._id.toHexString();
                        return pos;
                    });
                    pos_info = _.indexBy(pos_without_oids, '_id');

                    var pos_item, results = [];
                    _.each(_.keys(pos_count), function (pos_key) {
                        pos_item = pos_info[pos_key];

                        if(pos_item) {
                            pos_count[pos_key] = {
                                company_name: pos_item.company_name,
                                address1: pos_item.address1,
                                city: pos_item.city,
                                country: pos_item.country,
                                latitude: pos_item.latitude,
                                longitude: pos_item.longitude,
                                count: pos_count[pos_key].count
                            };
                        } else {
                            winston.error('POS not found while assessing reports: ' + pos_key)
                        }
                    });

                    res.send({
                        points_of_sale_summary: pos_count,
                        duration: ((new Date()).getTime() - start_time.getTime())
                    }, 200);
                });
            }

        }, function(err_async, async_result) {
            // unused
        });
    });

    /*

    if(caller.roles[0] == 'admin' || caller.roles.indexOf('exec') != -1 || caller.roles[0] == 'CBU') {
        var query = {};
        if(caller.organizations) {
            query.organization = { $in: caller.organizations };
        }
        if(type == 'non-conform') {
            query.non_conform = {$not: {$size: 0}};
        } else if(type == 'alerts') {
            query.alerts = {$not: {$size: 0}};
        } else {
            res.send('type must be one of "non-conform" or "alerts"', 400);
        }
        if(typeof(req.query['from']) != 'undefined') { query['answer_time'] = {$gte: req.query['from']}; }
        SampleModule.findWithOptions(
            query,
            {limit: 1000, sort: [['_id',-1]]},
            function(err, samples) {

                if(samples && samples.length > 0) {
                    var visit_distribution = {}, i;
                    _.each(samples, function(sample) {
                        var collectionOfInterest = sample.non_conform;
                        if(type == 'alerts') {
                            collectionOfInterest = sample.alerts;
                        }

                        if(typeof(visit_distribution[sample.visit_id]) == 'undefined') {
                            visit_distribution[sample.visit_id] = { count: collectionOfInterest.length, sample: sample };
                        } else {
                            visit_distribution[sample.visit_id].count += collectionOfInterest.length;
                        }
                    });

                    // get the unique list of visit ids from the samples
                    var visit_ids = _.keys(visit_distribution), pos_ids;

                    // get the visits for the samples
                    VisitModule.listByIds(visit_ids, function(err, visits) {

                        // get the points of sale from those visits
                        visit_ids = _.map(visit_ids, function(visit_id) {return ObjectId(visit_id);});
                        pos_ids = _.uniq(_.map(visits, function(visit){ return visit.pos_id; }));
                        PointOfSaleModule.listByIds(pos_ids, function(err_pos_ids, points_of_sale) {
                            var pos_distribution = {}, visit_conconf_count;
                            _.each(visits, function(visit) {
                                visit_conconf_count = visit_distribution[visit._id.toHexString()].count;
                                if(typeof(pos_distribution[visit.pos_id]) == 'undefined') {
                                    pos_distribution[visit.pos_id] = {
                                        count: visit_conconf_count,
                                        point_of_sale: points_of_sale.length == 0 ? [] : _.pick(_.find(points_of_sale, function(pos){
                                            return visit.pos_id == pos._id.toHexString();
                                        }), "company_id", "company_name", "address1", "city", "country", "PLZ Dolnoslaskie", "PLZ Carrefour", "latitude", "longitude")
                                    };
                                } else {
                                    pos_distribution[visit.pos_id].count += visit_conconf_count;
                                }
                            });

                            res.send({
                                points_of_sale_summary: pos_distribution,
                                processed_visits_count: visits.length,
                                processed_sample_count: samples.length
                            }, 200);
                        });
                    });
                } else {
                    res.send({}, 200);
                }
            }
        );
    } else {
        Common.serviceErrorCallbacks.on404(req, res);
    }
    */
}

function _reportDefectsByItem(req, res, caller, type) {
    if(caller.roles[0] == 'admin' || caller.roles.indexOf('exec') != -1 || caller.roles[0] == 'CBU') {

        var query = {};
        if(caller.organizations) {
            query.organization = { $in: caller.organizations };
            query.non_conform = {$not: {$size: 0}};
        }
        if(type == 'non-conform') {
            query.non_conform = {$not: {$size: 0}};
        } else if(type == 'alerts') {
            query.alerts = {$not: {$size: 0}};
        } else {
            res.send('type must be one of "non-conform" or "alerts"', 400);
        }
        if(typeof(req.query['from']) != 'undefined') { query['answer_time'] = {$gte: req.query['from']}; }
        SampleModule.findWithOptions(
            query,
            {limit: 1000, sort: [['_id',-1]]},
            function(err, samples) {
                var question_nonconforms = {};
                var product_nonconforms = {};
                var key;

                samples.forEach(function(sample) {
                    var collectionOfInterest = sample.non_conform;
                    if(type == 'alerts') {
                        collectionOfInterest = sample.alerts;
                    }

                    collectionOfInterest.forEach(function(non_conform_item) {
                        key = sample.template_info.t03_code + '_' + non_conform_item;
                        if(typeof(question_nonconforms[key]) == 'undefined') {
                            question_nonconforms[key] = {count: 1};

                            // attach the question to the map entry
                            sample.questions.forEach(function(question) {
                                if(question.identity_id == non_conform_item) {
                                    question_nonconforms[key].question = question;
                                }
                            });
                        } else {
                            question_nonconforms[key].count++;
                        }
                    });

                    if(typeof(product_nonconforms[sample.product_id]) == 'undefined') {
                        product_nonconforms[sample.product_id] = { count: 1, code: sample.product_info.code };
                    } else {
                        product_nonconforms[sample.product_id].count++;
                    }
                });

                res.send({
                    product_nonconforms: product_nonconforms,
                    question_nonconforms: question_nonconforms
                }, 200);
            });
    } else {
        Common.serviceErrorCallbacks.on404(req, res);
    }
}