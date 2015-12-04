var _ = require('underscore');
var async = require('async');
var config = require('config');
var fs = require('fs');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var ActionAuditModule = require('../../../modules/action-audit');
var OrganizationModule = require('../../../modules/model/organization');
var PointOfSaleModule = require('../../../modules/model/hierarchy/point-of-sale');
var ProductModule = require('../../../modules/model/hierarchy/product');

var SampleModule = require('../../../modules/model/sample');
var VisitModule = require('../../../modules/model/visit');

var category_specific = require('../../../modules/category-specific');
var Common = require('../../router-common');
var formatter = require('../../../modules/view-formatter');
var nodeUtils = require('../../../modules/node-utils');
var schema = require('../../../modules/model/schema/schema');

var xlsx_custom = require('../../../ext/xlsx');
var xlsx_util = require('../../../modules/xlsx-util');

module.exports = function(app) {

    // Exports a list of samples via excel xlsx format
    //
    // Error conditions:
    //     - Caller isn't authorized to read samples
    //     - No id list was provided
    //     - A provided id was not of a valid format
    //     - The samples are of differing templates
    Common.addHandler(app, 'get', '/samples/:idList/export', _handleExportSamplesXlsx);
};

// IMPORT XLSX

function _handleImportSamplesXlsx(req, res) {
    Common.ensureHasAccess(req, res, 'sample', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);
        if(_.isUndefined(req.files) || _.isUndefined(req.files.files)) {
            Common.serviceErrorCallbacks.on500(req, res, 'File list not received');
            return;
        }

        var file_list = "";
        _.each(req.files.files, function(file) {

            file_list += ((file_list.length > 0 ? ',' : '') + file.path);
            try {
                var fileBuffer = fs.readFileSync(file.path);
                var xlsx_data = xlsx_custom(fileBuffer.toString('base64'));
                _processSampleImportFileXlsx(req, res, xlsx_data);
            } catch(ex) {
                Common.serviceErrorCallbacks.on500(req, res, 'An error occurred: ' + ex);
            }

            //var xlsx_file = xlsx.parse(fs.readFileSync('C:/src/storecheck/docs/Business feedbacks 0512.xlsx'));
            //var fileBuffer = fs.readFileSync('C:/src/storecheck/docs/Business feedbacks 0512.xlsx');
        });

        ActionAuditModule.report(caller, 'import', 'samples', file_list);
    });
}

function _handleExportSamplesXlsx(req, res) {
    Common.ensureHasAccess(req, res, 'sample', 'r', Common.serviceErrorCallbacks, function(caller) {
        var idList = req.param('idList');
        if(idList == null) {
            winston.log('error', 'a POST /samples/:idList/export request from user=' + caller.name + ' failed because no sample ids were provided');
            Common.pushMessage(req, 'error', 'Failed to export samples.  An id list was not provided');
            Common.serviceErrorCallbacks.on500('An id list must be provided', 500);
            return;
        }

        var idArray = idList.split(',');
        var each_id_valid = _.every(idArray, function(id) { return nodeUtils.isValidId(id); });

        // check each id for validity
        if(!each_id_valid) {
            Common.pushMessage(req, 'error', 'Failed to update states for samples.  A provided sample id is not valid');
            Common.serviceErrorCallbacks.on500('Provided id is not valid', 500);
            return;
        }

        var sampleIdArray = _.map(idArray, function(id) { return ObjectId(id); });

        SampleModule.find({_id: {$in: sampleIdArray}}, function(err, samples) {
            if(err) {
                winston.log('error', 'a POST /samples/:idList/export request from user=' + caller.name + ' failed: ' + err);
                Common.pushMessage(req, 'error', 'Failed to export samples. Reason: ' + err);
                Common.serviceErrorCallbacks.on500(req, res, err);
                return;
            }

            if(samples == null || samples.length == 0) {
                winston.log('error', 'a POST /samples/:idList/export request from user=' + caller.name + ' failed: samples were not found');
                Common.pushMessage(req, 'error', 'Failed to export samples. The supplied samples were not found');
                Common.serviceErrorCallbacks.on404(req, res, 'no samples found');
                return;
            }

            var same_template = _.every(samples, function(sample) { return sample.template_id == samples[0].template_id; });
            if(!same_template) {
                winston.log('error', 'a POST /samples/:idList/export request from user=' + caller.name + ' failed because the specified samples were from different templates');
                Common.pushMessage(req, 'error', 'Failed to export samples because the specified samples were from different templates');
                Common.serviceErrorCallbacks.on500(req, res, 'The specified samples were from different templates');
                return;
            }

            _.each(samples, function(sample) {
                SampleModule.sortQuestions(sample.questions);
            });

            var worksheets = {
                worksheets: [
                    _buildSamplesSheet(samples),
                    _buildKeySheet(samples),
                    _buildAdminSheet(samples)
                ],
                creator: caller.user
            };

            var buffer = xlsx_custom(worksheets);
            if(!buffer.base64) {
                res.send(500);
            } else {
                buffer =  new Buffer(buffer.base64, 'base64');

                res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.status(200);
                res.send(buffer);
            }
        });
    });
}

// NOTE: assumes all samples are from same organization
function _processSampleImportFileXlsx(req, res, sampleFile) {
    if(sampleFile.worksheets.length < 3) {
        throw 'Could not find administrative worksheet';
    }

    var adminSheet = sampleFile.worksheets[2];
    if(adminSheet.data.length < 2) {
        throw 'Could not find sample ID row in administrative worksheet';
    }

    var sampleIdHexStrings = [];
    _.each(adminSheet.data[1], function(sampleIdCell, idIndex) {
        if(idIndex > 0) {
            sampleIdHexStrings.push(sampleIdCell.value);
        }
    });

    // load the samples referenced in the excel file
    Common.getByIdsIfAuthorized(req, res, sampleIdHexStrings, 'sample', SampleModule, Common.serviceErrorCallbacks, function(sample_records) {
        var sampleSheet = sampleFile.worksheets[0];

        // TODO: get organization, and pass the config to processSampleImportRow
        if(sample_records.length == 0) {
            res.send('no samples were found', 500);
            return;
        }

        // NOTE: assumes all samples are from same organization
        OrganizationModule.findOneById(sample_records[0].organization, function(err, organization) {

            var organization_settings = organization ? organization.settings : undefined;

            // for each row of excel data on the sample data worksheet
            _.each(sampleSheet.data, function(sampleRow, sampleRowIndex) {
                _processSampleImportRowXlsx(sample_records, sampleRow, sampleRowIndex, organization_settings);
            });

            // update the database with all of the samples we've just changed
            var update_tasks = {};
            _.each(sample_records, function(sample) {
                update_tasks[sample._id.toHexString()] = function(callback) {
                    SampleModule.processSampleConformances(sample, organization_settings);

                    SampleModule.update({
                        query: { _id: sample._id },
                        value: sample
                    }, function(update_count) {
                        callback(update_count == 1 ? null : 'no update', update_count == 1 ? sample : null);
                    });
                };
            });
            async.series(update_tasks, function(err, results) {
                res.send(results, 200);
            });
        });
    });
}

function _processSampleImportRowXlsx(sample_records, sampleRow, sampleRowIndex, organization_settings) {
    var questionText, nextAnswerText, question, answer;
    if(sampleRowIndex == 0) {
        questionText = sampleRow[0].value;
    } else {
        questionText = sampleRow[0].value;

        // update each sample with this row's data
        _.each(sample_records, function(sample, sample_index) {

            if(sampleRow[sample_index + 1]) {
                nextAnswerText = sampleRow[sample_index + 1].value;

                // find question in sample that matches questionText
                {
                    question = _.filter(sample.questions, function(question) {
                        return question.level5_description2.trim() == questionText.trim();
                    });
                    if(question.length == 0) {
                        throw 'Cannot find question ' + questionText + ' in sample';
                    }
                    question = question[0];
                }

                // apply the answer in nextAnswerText
                {
                    if(question.answers.length == 0) {
                        winston.error('No answers exist for question ' + question.identity_id + ' in sample ' + sample._id);
                        return; // effectively moves to the next question
                    } else if(question.answers.length > 1) {
                        answer = _.filter(question.answers, function(answer) {
                            return answer.text == nextAnswerText;
                        });
                        if(answer.length == 0) {
                            return;
                            //throw 'Cannot find answer ' + nextAnswerText + ' in sample';
                        }
                        nextAnswerText = answer[0].identity_id;
                    }
                    SampleModule.answerQuestion(sample, question, nextAnswerText, organization_settings);
                }
            }
        });
    }
}

function _buildKeySheet(samples) {
    // build the sheet of keys
    var keySheet = {
        "name":"Answers",
        "data": []
    };

    // NOTE: Assumes all samples have the same question structure
    // each question's answers occupy a row of the answers sheet
    _.each(samples[0].questions, function(question) {
        if(question.answers.length > 1) {
            var options = [];
            _.each(question.answers, function(answer) {
                options.push({"value": answer.text, "formatCode": xlsx_util.getFormatCodeFromWeight(answer.weight), autoWidth: true});
            });
            keySheet.data.push(options);
        } else {
            keySheet.data.push([]);
        }
    });

    return keySheet;
}

function _buildSamplesSheet(samples) {
    // build the primary sheet of samples with their answers
    var samplesSheet = {
        "name":"Samples",
        "data":[
            // each column: 1st cell is question, each following cell is a sample's answer
        ],
        "data_validation": [
            []
        ]
    };

    // build the header row
    var sampleNames = [{
        value: "Sample ID",
        bold: true
    }];
    _.each(samples, function(sample) {
        sampleNames.push({
            value: sample.name,
            hAlign: 'center'
        });
    });
    samplesSheet.data.push(sampleNames);

    // write the question for each sample
    _.each(samples[0].questions, function(question, question_index) {
        var question_entry = [
            {
                value: question.level5_description2,
                autoWidth: true,
                bold: true
            }
        ];
        var question_validations = [
            {}
        ];

        _.each(samples, function(sample) {
            // write the current answer for this question for each sample
            if(sample.questions[question_index].answers.length > 1) {
                var answer_for_question = _getChosenAnswerForQuestion(sample.questions[question_index]);
                question_entry.push({
                    value: (answer_for_question != null ? answer_for_question.text : ""),
                    formatCode: "General", //(answer_for_question != null ? xlsx_util.getFormatCodeFromWeight(answer_for_question.weight) : "General"),
                    autoWidth: true
                });

                question_validations.push({
                    type: 'list',
                    source: 'Answers!$' + 'A$' + (question_index + 1) + ':$' + xlsx_util.getCellLettersByIndex(question.answers.length - 1) + '$' + (question_index + 1)
                });
            } else {
                question_validations.push({type: 'any'});
            }
        });

        samplesSheet.data.push(question_entry);

        samplesSheet.data_validation.push(question_validations);
    });
    return samplesSheet;
}

function _getChosenAnswerForQuestion(question) {
    var chosen = null;
    _.each(question.answers, function(answer) {
        if(answer.value == "true" || answer.value == true) {
            chosen = answer;
        }
    });
    return chosen;
}

function _buildAdminSheet(samples) {

    // build the sheet of sample data that allows us to import it back into the app
    var adminSheet = {
        "name":"Administrative",
        "data":[
            // each column: 1st cell is question, each following cell is a sample's answer
        ]
    };

    var sampleIds = [{
        value: "Sample ID",
        autoWidth: true,
        bold: true
    }];
    var sampleNames = [{
        value: "Sample ID",
        autoWidth: true,
        bold: true
    }];
    _.each(samples, function(sample) {
        sampleIds.push({
            value: sample._id.toHexString(),
            formatCode: "General",
            autoWidth: true,
            hAlign: 'center'
        });
        sampleNames.push({
            value: sample.name,
            formatCode: "General",
            autoWidth: true,
            hAlign: 'center'
        });
    });
    adminSheet.data.push(sampleNames);
    adminSheet.data.push(sampleIds);

    return adminSheet;
}