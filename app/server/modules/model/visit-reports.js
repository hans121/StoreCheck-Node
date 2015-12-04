var _ = require('underscore');
var async = require('async');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var db = require('./../database/dynamic-database');
var sample_collection = db.db.collection('sample');
var visit_reports = db.db.collection('visit-report');
var visit_collection = db.db.collection('visit');
var dbUtils = require('../database/database-utils');
var nodeUtils = require('../node-utils');

var categorySpecific = require('../category-specific');

var index_keys = [
    //{ storecheck_id: 1, organization: 1, pos_id: 1, auditor_name: 1 }
];

module.exports = {
    generateReportsForSamples: _generateReportsForSamples,
    generateReports: _generateReports,
    generateReport: _generateVisitReport
};

dbUtils.addStandardMethods(module.exports, visit_reports, index_keys);

module.exports.reports = visit_reports;

var root_visit_fields = {
    _id: 1,
    organization: 1,
    store_check_id: 1,
    pos_id: 1,
    auditor_name: 1
};

function _generateReports(callback2) {
    nodeUtils.processMatchingCollectionItems(visit_collection, 500, {}, root_visit_fields, _generateReportAsMutator, callback2);
}

function _generateReportAsMutator(visits, callback2) {
    var async_tasks = [];

    var visit_ids = _.pluck(visits, '_id');

    visits.forEach(function(visit) {
        async_tasks.push(function(async_callback) {

            _generateVisitReport(visit._id, function(err_report, report) {
                if(err_report) {
                    async_callback(err_report);
                    return;
                }

                if(!report.answers || report.answers.length == 0) {
                    async_callback();
                    return;
                }

                var data = {
                    organization: visit.organization,
                    storecheck: visit.store_check_id,
                    pos: visit.pos_id,
                    auditor_name: visit.auditor_name
                };

                data.answers = report.answers;
                data.sample_count = report.sample_count;

                visit_reports.update(
                    {
                        visit: visit._id.toHexString()
                    },
                    {
                        $set: data
                    },
                    {
                        upsert: true
                    },
                    function(err_upsert) {
                        async_callback(err_upsert);
                    }
                );
            });
        });
    });

    // update the batch mutator key for each storecheck
    async_tasks.push(function(async_callback) {
        visit_collection.update(
            {
                _id: {$in: visit_ids}
            },
            {
                $set: {
                    batch_update_time: new Date()
                }
            },
            {
                multi: true
            },
            function(err_update) {
                async_callback(err_update);
            }
        )
    });

    async.series(async_tasks, callback2);
}

function _generateVisitReport(visit_id, callback2) {

    // we'll want to go all the way down to the answers
    var unwind_questions = { $unwind: '$questions' };
    var unwind_answers = { $unwind: '$questions.answers' };

    // limit results to the supplied visit
    var visit_match = {
        $match: {
            "visit_id": visit_id.toHexString()
        }
    };

    // we only want questions that are chosen from a list of choices
    var filter_question_types = {
        $match: {
            "questions.category_specific": {
                $in: [
                    categorySpecific.CategorySpecific.LIST_MULTIPLE_CHOICES,
                    categorySpecific.CategorySpecific.RADIO_CHOICES,
                    categorySpecific.CategorySpecific.LIST_CHOICES
                ]
            }
        }
    };

    // we only want the answers given by the auditor
    var filter_only_chosen_answers = {
        $match: {
            "questions.answers.value": "true"
        }
    };

    var group_samples = {
        "$group": {
            "_id": "$questions.answers.code",
            "count": {"$sum": 1},
            "l1_seq": {"$first": "$questions.level1_sequence"},
            "l2_seq": {"$first": "$questions.level2_sequence"},
            "l3_seq": {"$first": "$questions.level3_sequence"},
            "l4_seq": {"$first": "$questions.level4_sequence"},
            "l5_seq": {"$first": "$questions.level5_sequence"},
            "seq": {"$first": "$questions.answers.sequence"},
            "conformance": {"$first": "$questions.answers.weight"},
            "l0": {
                $addToSet: {"lang": "$template_info.language", "text": "$questions.answers.text"}
            },
            "l5": {
                $addToSet: {"lang": "$template_info.language", "text": "$questions.level5_description2"}
            },
            "samples": {
                $addToSet: {
                    "id": "$_id",
                    "state": "$state",
                    "pc": "$product_info.code"
                } // , "auditor": "$visit_info.auditor_name"
            }
        }
    };

    sample_collection.aggregate(
        [
            visit_match,
            unwind_questions,
            filter_question_types,
            unwind_answers,
            filter_only_chosen_answers,
            group_samples
        ],
        {
            allowDiskUse: true
        },
        function(err_aggregate, aggregate_result) {

            if(err_aggregate) {
                winston.error('while generating report for visit ' + visit_id + ': ' + err_aggregate);
                callback2(err_aggregate);
                return;
            }

            if(!aggregate_result) {
                callback2(null, {
                    sample_count: 0,
                    answers: []
                });
                return;
            }

            if(aggregate_result.length > 0) {
                aggregate_result.sort(_questionSortFunction);

                aggregate_result.forEach(function(result, index) {
                    result.index = index;
                    delete result.l1_seq;
                    delete result.l2_seq;
                    delete result.l3_seq;
                    delete result.l4_seq;
                    delete result.l5_seq;
                    delete result.seq;
                });
            }

            sample_collection.find({"visit_id": visit_id.toHexString()}).count(function(err_count, count) {
                if(err_count) {
                    callback2(err_count);
                    return;
                }
                callback2(null, {
                    sample_count: count,
                    answers: aggregate_result
                });
            });
        }
    );
}

function _generateReportsForSamples(sample_hex_ids, callback2) {
    nodeUtils.processMatchingCollectionItems(visit_collection, 500, {"samples.id": {$in: sample_hex_ids}}, root_visit_fields, _generateReportAsMutator, callback2);
}

function _questionSortFunction(a, b) {
    var aTuple = [parseInt(a.l1_seq, 10), parseInt(a.l2_seq, 10), parseInt(a.l3_seq, 10), parseInt(a.l4_seq, 10), parseInt(a.l5_seq, 10), parseInt(a.seq, 10)];
    var bTuple = [parseInt(b.l1_seq, 10), parseInt(b.l2_seq, 10), parseInt(b.l3_seq, 10), parseInt(b.l4_seq, 10), parseInt(b.l5_seq, 10), parseInt(b.seq, 10)];

    for (var i = 0; i < aTuple.length; i++) {
        if (aTuple[i] < bTuple[i]) {
            return -1;
        } else if (aTuple[i] > bTuple[i]) {
            return 1;
        }
    }

    return 0;
}

setInterval(function() {
    _generateReports(function(err_reports) {
        if(err_reports) {
            winston.error('while generating reports: ' + err_reports);
        }
    });
}, 30 * 60 * 1000); // 30 minutes (minutes from seconds) * (seconds from ms)