var _ = require('underscore');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var db = require('./../database/dynamic-database');
var sample = db.db.collection('sample');

var categorySpecific = require('../category-specific');
var dbUtils = require('../database/database-utils');
var formatter = require('../view-formatter');
var nodeUtils = require('../node-utils');

var index_keys = [
    //{ visit_id: 1},
    { visit_id: 1, product_id: 1 }
];

module.exports = {
    getConformance: _getConformance,
    getDefects: _getDefects,
    getAlerts: _getAlerts,
    getImageCount: _getImageCount,
    getABCWeight: _getABCWeight,
    getApplicableTemperatureRanges: _getApplicableTemperatureRanges,
    getTemperatureConformance: _getTemperatureConformance,
    getTemperatureConformanceForQuestion: _getTemperatureConformanceForQuestion,
    isQuestionActive: _isQuestionActive,
    findAnswerInQuestions: _findAnswerInQuestions,

    answerQuestion: _answerQuestion,
    mergeQuestions: _mergeQuestions,
    processSampleConformances: _processSampleConformances,
    deleteExtraDescriptions: _deleteExtraDescriptions,
    deleteLevelCodes: _deleteLevelCodes,
    deleteSequenceCodes: _deleteSequenceCodes,
    questionSortFunction: _questionSortFunction,
    sortQuestions: _sortQuestions,
    tryHandleTemperatureSettings: _tryHandleTemperatureSettings,
    applyChangeToAllSamples: _applyChangeToAllSamples,

    answerQuestionInSamples: _answerQuestionInSamples,
    deleteSamples: _deleteSamples,
    updateStates: _updateStates
};

dbUtils.addStandardMethods(module.exports, sample, index_keys);


// IMPLEMENTATIONS

// gets conformance for a given question, based on the answer to that question
function _getConformance(sample_question, organization_settings) {
    var defects = _getDefects([sample_question], organization_settings);
    if(defects.length > 0) {
        return "non-conform";
    }

    var alerts = _getAlerts([sample_question], organization_settings);
    if(alerts.length > 0) {
        return "alert";
    }

    return "conform";
}

// gets a list of defects for a given sample
function _getDefects(questions, organization_settings) {
    var defect_array = [];
    _.each(questions, function(question) {
        if(categorySpecific.getQuestionType(question.category_specific) == "select") {
            _.each(question.answers, function (answer) {
                if (answer.value == "true" && (answer.weight == "NON-CONFORM" || answer.weight == "C")) {
                    defect_array.push(question.identity_id);
                }
            });
        } else if(categorySpecific.getQuestionType(question.category_specific) == "checkbox") {
            _.each(question.answers, function (answer) {
                if (answer.value == "true" && (answer.weight == "NON-CONFORM" || answer.weight == "C")) {
                    defect_array.push(question.identity_id);
                }
            });
        } else if(question.category_specific == categorySpecific.CategorySpecific.NUMERIC_VALUE) {

            /*
            if(question.temperature_conformance == 'non-conform') {
                defect_array.push(question.identity_id);
            }
            */
        }
    });
    return defect_array;
}

// given a list of answered questions, it applies them to a sample
// this returns the data via callback, does not save to database
// callback3 is (err, questions, sample)
function _mergeQuestions(id, questions, organization_settings, callback3) {
    sample.findOne({ _id : ObjectId(id) }, function(err, sample_results) {
        if(err || !sample_results) {
            callback3(err, null, null);
            return;
        }

        _mergeQuestionsIntoSample(sample_results, questions, organization_settings);

        callback3(null, sample_results.questions, sample_results);
    });
}

function _mergeQuestionsIntoSample(sample_to_modify, questions, organization_settings) {
    var question_type;

    // for each of the sample's questions (loaded from db)
    _.each(sample_to_modify.questions, function(sample_question) {

        // find every question from the "new questions" for that question (there should be only one)
        var answer_matches = _.where(questions, {identity_id: sample_question.identity_id});
        _.each(answer_matches, function(answer_match) {

            // modify the questions from the saved sample, applying the "answer" for each
            question_type = categorySpecific.getQuestionType(sample_question.category_specific);

            // for select-types, set default indicator and value
            if(question_type == "select") {
                _.each(sample_question.answers, function (answer) {
                    if (answer.identity_id == answer_match.answer) {
                        answer.value = "true";
                        answer.default_indicator = 1;
                    } else {
                        answer.value = "false";
                        answer.default_indicator = 0;
                    }
                });

            // for checkbox types, do the same thing, but it can apply to multiple answers
            } else if(question_type == "checkbox") {
                var answer_as_tokens = answer_match.answer.split(',');
                _.each(sample_question.answers, function (answer) {
                    if (answer_as_tokens.indexOf(answer.identity_id) != -1) {
                        answer.value = "true";
                        answer.default_indicator = 1;
                    } else {
                        answer.value = "false";
                        answer.default_indicator = 0;
                    }
                });

            // for anything else with an answer
            } else if(sample_question.answers.length > 0) {
                sample_question.answers[0].value = answer_match.answer;

            } else {
                winston.log('warn', 'An answer was given to question ' + sample_question.identity_id + ' with no place to put the answer');
            }

            // record any images
            if(answer_match.image_urls) {
                sample_question.image_urls = answer_match.image_urls;
            }
        });
    });

    _processSampleConformances(sample_to_modify, organization_settings);
}

function _processSampleConformances(sample, organization_settings) {
    var question_type;

    // for each of the sample's questions (loaded from db)
    _.each(sample.questions, function(sample_question) {

        // modify the questions from the saved sample, applying the "answer" for each
        question_type = categorySpecific.getQuestionType(sample_question.category_specific);

        // for select-types and checkbox types, use default conformance logic
        if(question_type == "select" || question_type == "checkbox") {
            sample_question.conformance = _getConformance(sample_question, organization_settings);

        // for anything else with an answer
        } else if(sample_question.answers.length > 0) {

            // specifically, for numerical inputs, treat it like a temperature
            if(sample_question.category_specific == categorySpecific.CategorySpecific.NUMERIC_VALUE) {
                sample_question.temperature_conformance = _getTemperatureConformanceForQuestion(sample, sample_question, organization_settings);
                sample_question.conformance = 'conform';
                //sample_question.conformance = sample_question.temperature_conformance ? sample_question.temperature_conformance : 'conform';
            }
        }
    });

    sample.non_conform = _getDefects(sample.questions, organization_settings);
    sample.alerts = _getAlerts(sample.questions, organization_settings);
}

// returns all alerts for the provided array of questions
function _getAlerts(questions, organization_settings) {
    var alert_array = [];

    _.each(questions, function(question) {
        if(categorySpecific.getQuestionType(question.category_specific) == "select") {
            _.each(question.answers, function (answer) {
                if (answer.value == "true" && (answer.weight == "ALERT" || answer.weight == "B")) {
                    alert_array.push(question.identity_id);
                }
            });
        } else if(categorySpecific.getQuestionType(question.category_specific) == "checkbox") {
            _.each(question.answers, function (answer) {
                if (answer.value == "true" && (answer.weight == "ALERT" || answer.weight == "B")) {
                    alert_array.push(question.identity_id);
                }
            });
        } else if(question.category_specific == categorySpecific.CategorySpecific.NUMERIC_VALUE) {

            /*
            if(question.temperature_conformance == 'alert') {
                alert_array.push(question.identity_id);
            }
            */
        }
    });
    return alert_array;
}

// returns the total number of images in a given sample
function _getImageCount(sample) {
    var img_count = 0;
    _.each(sample.questions, function(question) {
        img_count += (question.image_urls ? question.image_urls.length : 0);
    });
    return img_count;
}

// normalizes weight/conformance indicators to A/B/C format
function _getABCWeight(weight) {
    if(weight == 'A' || weight == 'B' || weight == 'C') {
        return weight;
    } else if(weight == 'NON-CONFORM') {
        return 'C';
    } else if(weight == "ALERT") {
        return 'B';
    } else if(weight == "CONFORM") {
        return 'A';
    }
    return weight == null ? '' : weight;
}

// returns any known temperature ranges defined for the organization that apply to a given sample and question
function _getApplicableTemperatureRanges(sample, sample_question, organization_settings) {
    return organization_settings.temperature_ranges.filter(function(setting) {
        return setting.code == sample_question.level5_code && setting.t03_code == sample.template_info.t03_code;
    });
}

// returns the A/B/C conformance for a given temperature, given the organization's temperature ranges definition
function _getTemperatureConformance(temperature, temperature_ranges) {
    if(!_.isUndefined(temperature_ranges['min_nonconform']) && temperature < temperature_ranges['min_nonconform'].value) {
        return 'C';
    }

    if(!_.isUndefined(temperature_ranges['conform']) && temperature <= temperature_ranges['conform'].value) {
        return 'A';
    }

    if(!_.isUndefined(temperature_ranges['alert']) && temperature <= temperature_ranges['alert'].value) {
        return 'B';
    }

    if(!_.isUndefined(temperature_ranges['max_nonconform']) && temperature > temperature_ranges['max_nonconform'].value) {
        return 'C';
    }

    return 'C';
}

// returns conformance for a question based on temperature alone
function _getTemperatureConformanceForQuestion(sample, sample_question, organization_settings) {
    if(_.isUndefined(sample_question.answers[0].value) || (sample_question.answers[0].value.trim()).length === 0) {
        return 'conform';
    }
    try {
        var float_value = parseFloat(sample_question.answers[0].value);

        if(!_.isNaN(float_value) && !_.isUndefined(organization_settings) && !_.isUndefined(organization_settings.temperature_ranges)) {
            var applicable_ranges = _getApplicableTemperatureRanges(sample, sample_question, organization_settings);
            if(applicable_ranges.length == 0) {
                return 'conform';
            }

            var ABC = _getTemperatureConformance(float_value, applicable_ranges[0]);

            if(ABC == 'A') {
                return 'conform';
            } else if(ABC == 'B') {
                return 'alert';
            }
            return 'non-conform';
        }
    } catch(ex) {
    }
    return undefined;
}

// applies the temperature settings for a given sample and question.  The key feature is that
// this method also takes care of setting a different answer in the sample based on the temperature
// conformance of the provided question (via "linked_code").  Does not save to database.
function _tryHandleTemperatureSettings(sample, sample_question, organization_settings) {

    // the question must have category-specific type of "NUMERIC_VALUE"
    if(sample_question.category_specific != categorySpecific.CategorySpecific.NUMERIC_VALUE) {
        return;
    }

    var floatValue = parseFloat(sample_question.answers[0].value);
    if(!_.isNaN(floatValue) && !_.isUndefined(organization_settings) && !_.isUndefined(organization_settings.temperature_ranges)) {
        var applicable_settings = _getApplicableTemperatureRanges(sample, sample_question, organization_settings);

        if(applicable_settings.length > 0) {

            // find the accurate classification (e.g. conform, etc)
            var classification = null;
            if(typeof(applicable_settings[0].min_nonconform) != 'undefined' && parseFloat(applicable_settings[0].min_nonconform.value) > floatValue) {
                classification = applicable_settings[0].min_nonconform;
            } else if(typeof(applicable_settings[0].conform) != 'undefined' && parseFloat(applicable_settings[0].conform.value) >= floatValue) {
                classification = applicable_settings[0].conform;
            } else if(typeof(applicable_settings[0].alert) != 'undefined' && parseFloat(applicable_settings[0].alert.value) >= floatValue) {
                classification = applicable_settings[0].alert;
            } else if(typeof(applicable_settings[0].max_nonconform) != 'undefined' && parseFloat(applicable_settings[0].max_nonconform.value) <= floatValue) {
                // var matched = $('[data-t03-code="' + applicable_settings[0].t03_code + '"][data-code="' + applicable_settings[0].max_nonconform.linked_code + '"]');
                classification = applicable_settings[0].max_nonconform;
            }

            if(classification != null) {
                var questionAndAnswer = _findAnswerInQuestions(sample.questions, classification.linked_code);
                if(!_.isUndefined(questionAndAnswer) && !_.isUndefined(questionAndAnswer.question) && !_.isUndefined(questionAndAnswer.answer)) {
                    // double-check question, answer in questionAndAnswer
                    _answerQuestion(sample, questionAndAnswer.question, questionAndAnswer.answer.identity_id, organization_settings);
                }
            }
        }
    }
}

// Takes care of answering a specific question in the sample
function _answerQuestion(sample, sample_question, answer_identity_or_value_to_set, organization_settings) {
    sample_question.answer_date = formatter.getCurrentUtcTimeString();

    switch(categorySpecific.getQuestionType(sample_question.category_specific)) {
        case "input":
        case "calendar":
            if(sample_question.answers.length > 0) {
                sample_question.answers[0].value = answer_identity_or_value_to_set;
            }

            if(sample_question.category_specific == categorySpecific.CategorySpecific.NUMERIC_VALUE) {
                sample_question.temperature_conformance = _getTemperatureConformanceForQuestion(sample, sample_question, organization_settings);
                //sample_question.conformance = sample_question.temperature_conformance ? sample_question.temperature_conformance : 'conform';
            }
            break;
        case "select":
            _.each(sample_question.answers, function(sample_answer) {
                if(sample_answer.identity_id == answer_identity_or_value_to_set) {
                    sample_answer.value = "true";
                } else {
                    sample_answer.value = "false";
                }
            });
            break;
        case "checkbox":
            var answers_as_tokens = answer_identity_or_value_to_set.split(',');
            _.each(sample_question.answers, function(sample_answer) {
                if(answers_as_tokens.indexOf(sample_answer.identity_id) != -1) {
                    sample_answer.value = "true";
                } else {
                    sample_answer.value = "false";
                }
            });
            break;
    }

    sample_question.conformance = _getConformance(sample_question, organization_settings);
}

// deletes properties in a given question that reference descriptions not used for rendering
function _deleteExtraDescriptions(question) {
    delete question.level1_description;
    delete question.level2_description;
    delete question.level3_description;
    delete question.level4_description;
    delete question.level5_description;
    delete question.level1_description3;
    delete question.level2_description3;
    delete question.level3_description3;
    delete question.level4_description3;
    delete question.level5_description3;
}

// deleted code properties in the question
function _deleteLevelCodes(question) {
    delete question.level1_code;
    delete question.level2_code;
    delete question.level3_code;
    delete question.level4_code;
    delete question.level5_code;
}

// deleted sequence codes in the question
function _deleteSequenceCodes(question) {
    delete question.level1_sequence;
    delete question.level2_sequence;
    delete question.level3_sequence;
    delete question.level4_sequence;
    delete question.level5_sequence;
}

function _findAnswerInQuestions(question_list, answer_code) {
    var answers = [], answer_sought = undefined;
    var question = _.find(question_list, function(question) {
        answers = _.where(question.answers, {code: answer_code});
        if(answers.length > 0) {
            answer_sought = answers[0];
            return true;
        }
        return false;
    });
    return {question: question, answer: answer_sought};
}

function _isQuestionActive(question) {
    for(var i=0; i<question.answers.length; i++) {
        if(question.answers[i].active == 'true') {
            return true;
        }
    }
    return false;
}

function _questionSortFunction(a, b) {
    var aTuple = [parseInt(a.level1_sequence, 10), parseInt(a.level2_sequence, 10), parseInt(a.level3_sequence, 10), parseInt(a.level4_sequence, 10), parseInt(a.level5_sequence, 10)];
    var bTuple = [parseInt(b.level1_sequence, 10), parseInt(b.level2_sequence, 10), parseInt(b.level3_sequence, 10), parseInt(b.level4_sequence, 10), parseInt(b.level5_sequence, 10)];

    for (var i = 0; i < aTuple.length; i++) {
        if (aTuple[i] < bTuple[i]) {
            return -1;
        } else if (aTuple[i] > bTuple[i]) {
            return 1;
        }
    }

    return 0;
}

function _sortQuestions(questions) {
    questions.sort(_questionSortFunction);

    _.each(questions, function(question) {
        question.answers.sort(function(a, b) {
            return (parseInt(a.sequence, 10) - parseInt(b.sequence, 10));
        });
    });
}

// sample_batch_mutator should be function(samples, callback2) and should set batch_update_time for updated samples
function _applyChangeToAllSamples(sample_batch_mutator, callback2) {

    sample.update({}, {$unset: {'batch_update_time': 1}}, {multi: true}, function(err_update) { // , update_count
        if(err_update) {
            callback2(err_update);
            return;
        }

        _applyChangeToRemainingSamples(sample_batch_mutator, callback2);
    });

    function _applyChangeToRemainingSamples(sample_batch_mutator, callback2) {
        // note that update_count = 0 is not an error
        sample.find({batch_update_time: {$exists: false}}).limit(500).toArray(function(err_find, samples) {
            if(err_find) {
                callback2(err_find);
                return;
            }

            if(!samples || samples.length == 0) {
                sample.update({}, {$unset: {'batch_update_time': 1}}, {multi: true}, function(err_update, update_count) {
                    callback2(err_update);
                });
                return;
            }

            winston.debug('applying sample batch mutator to ' + samples.length + ' samples');
            sample_batch_mutator(samples, function(err_complete, batch_result) {
                if(err_complete) {
                    callback2(err_complete);
                    return;
                }

                nodeUtils.recursiveWrapper(function() {
                    _applyChangeToRemainingSamples(sample_batch_mutator, callback2);
                });
            });
        });
    }
}

// Saves answers from the specified request into the questions of a given sample,
// calculates conformance, then updates the sample
//
// Error conditions:
//     - The specified sample is not found
//
// Params:
//     - data, which is a tuple of answers and question_id
// Notes:
//     - Recursive!
function _answerQuestionInSamples(data, samples, errors, successes, messages, organization_settings, callback2) {

    // this is the base case to stop recursion
    if(samples.length == 0) {

        // woot - 100% success
        if(errors.length == 0) {
            messages.push({title: 'success', text: 'Update sample responses'});
            callback2();
            return;
        }

        messages.push({type: 'error', message: 'Failed to update sample responses'});
        callback2(errors[0]);
        return;
    }

    var sample = samples.pop();
    _.each(sample.questions, function (sample_question) {
        if(sample_question.identity_id == data.question_id) {
            _.each(data.answers, function(req_answers) {
                if(req_answers.sample_id == sample._id) {
                    var answer_from_req = req_answers.answer; // represents an answer identity_id for choices, raw value for other types

                    if(typeof sample_question.answers != 'undefined') {
                        _answerQuestion(sample, sample_question, answer_from_req, organization_settings);
                        _tryHandleTemperatureSettings(sample, sample_question, organization_settings);
                    } else {
                        winston.log('warn', 'while handling POST /sample/images, sample with id=' + sample._id + ' has no answer structure to write to');
                    }
                }
            });
        }
    });

    module.exports.update({
        query: { _id : sample._id },
        value: {
            $set: {
                questions:     sample.questions,
                non_conform:   _getDefects(sample.questions, organization_settings),
                alerts:        _getAlerts(sample.questions, organization_settings),
                answer_time:   formatter.getCurrentUtcTimeString(),
                update_time:   formatter.getCurrentUtcTimeString()
            }
        }
    }, function(e) {
        if(e == 0) {
            errors.push(sample._id.toHexString());
        } else {
            successes.push(sample._id.toHexString());
        }

        // make a recursive call (setTimeout to flatten call stack)
        setTimeout(function() {
            _answerQuestionInSamples(data, samples, errors, successes, messages, organization_settings, callback2);
        }, 0);
    });
}

function _deleteSamples(idStringArray, callback2) {
    var objectIdArray = idStringArray.map(function(id) { return ObjectId(id); });

    sample.remove(
        {
            _id : {$in: objectIdArray},
            state: {$ne: "released"}
        },
        {
           multi: true
        },
        callback2
    );
}

// handles the database request for when a set of samples are to have their states changed
function _updateStates(sample_ids, additional_query_params, state, timestring, agent, callback2) {
    var data = { state: state };
    data[state + '_time'] = timestring;
    data[state + '_agent'] = agent;
    data.update_time = formatter.getCurrentUtcTimeString();

    additional_query_params._id = {$in: sample_ids };

    sample.update(
        additional_query_params,
        {
            $set: data
        },
        {
            multi: true
        },
        function(err_update, doc_count) {
            callback2(err_update, doc_count);
        }
    );
}