var _ = require('underscore');
var async = require('async');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var schema = require('../../modules/model/schema/schema');
var formatter = require('../../modules/view-formatter');
var nodeUtils = require('../../modules/node-utils');
var xlsx_custom = require('../../ext/xlsx');
var xlsx_util = require('../../modules/xlsx-util');

var Common = require('../router-common');

var ActionAuditModule = require('../../modules/action-audit');
var PointOfSaleModule = require('../../modules/model/hierarchy/point-of-sale');
var ProductModule = require('../../modules/model/hierarchy/product');
var SampleModule = require('../../modules/model/sample');
var StoreCheckModule = require('../../modules/model/store-check');
var TemplateModule = require('../../modules/model/template');
var VisitModule = require('../../modules/model/visit');

module.exports = function(app) {

    // Adds a (product_id, template_id) tuple (called a "sample type" internally)
    //
    // Error conditions:
    //     - The caller does not have access to update store checks
    //     - See RouterCommon.getByIdIfAuthorized, which applies to product, template, and store check
    Common.addHandler(app, 'put', '/store-check/:id/sample-type', _handleAddSampleType);

    // Removes the specified sample type from a given store check
    //
    // Error conditions:
    //     - The caller does not have access to update store checks
    //     - The specified id was not of a valid format
    //     - See RouterCommon.getByIdIfAuthorized (store check)
    //     - The specified store check was closed
    Common.addHandler(app, 'delete', '/store-check/:id/sample-type/:index', _handleRemoveSampleType);

    // Adds a (product_id, template_id) tuple (called a "sample type" internally)
    //
    // Error conditions:
    //     - The caller does not have access to update store checks
    //     - See RouterCommon.getByIdIfAuthorized, which applies to product, template, and store check
    Common.addHandler(app, 'post', '/store-check/:id/sample-type/:index/sales-volume', _handleSetSampleTypeSalesVolume);

    Common.addHandler(app, 'get', '/store-check/:id/sample-type/product/:product_id/template/:template_id/export', _handleStorecheckSampleTypeExport);
};

function _handleAddSampleType(req, res) {
    Common.ensureHasAccess(req, res, 'store-check', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var id = req.params['id'];
        Common.getByIdIfAuthorized(req, res, id, 'store-check', StoreCheckModule, Common.serviceErrorCallbacks, function(storecheck) {
            Common.getByIdIfAuthorized(req, res, req.body.product_id, 'product', ProductModule, Common.serviceErrorCallbacks, function(product) {
                Common.getByIdIfAuthorized(req, res, req.body.template_id, 'template', TemplateModule, Common.serviceErrorCallbacks, function(template) {
                    StoreCheckModule.update({
                        query: { _id : ObjectId(id) },
                        value: {
                            $addToSet : {
                                sample_types: {
                                    product_id: req.body.product_id,
                                    template_id: req.body.template_id
                                }
                            }
                        }
                    }, function(e){
                        if(e) {
                            ActionAuditModule.report(caller, 'update', 'store-check/sample-type', '"' + storecheck.name + '" (' + storecheck._id.toHexString() +  ') added a sample type');
                            Common.pushMessage(req, 'success', 'Successfully created sample type');
                            res.send({result: 'ok'}, 200);
                        } else {
                            winston.log('warn', 'a PUT /store-check/' + id + '/sample-type request from user=' + caller.name + ' failed, message=' + e);
                            Common.pushMessage(req, 'error', 'Failed to create sample type');
                            res.send(e, 400);
                        }
                    });
                });
            });
        });
    });
}

function _handleRemoveSampleType(req, res) {
    Common.ensureHasAccess(req, res, 'store-check', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var path = '/store-check/' + req.params['id'] + '/sample-type/' + req.params['index'];
        var id = req.params['id'], index = req.params['index'];
        Common.getByIdIfAuthorized(req, res, id, 'store-check', StoreCheckModule, Common.serviceErrorCallbacks, function(storecheck) {
            if(storecheck != null) {
                if(storecheck.state != 'closed') {
                    if(typeof(storecheck.sample_types) != 'undefined' && storecheck.sample_types.length > index) {
                        storecheck.sample_types.splice(index, 1);

                        StoreCheckModule.update({
                            query: { _id : ObjectId(id) },
                            value: {
                                $set : {
                                    sample_types: storecheck.sample_types
                                }
                            }
                        }, function(e){
                            if(e) {
                                ActionAuditModule.report(caller, 'delete', 'store-check/sample-type', '"' + storecheck.name + '" (' + storecheck._id.toHexString() + ') removed a sample type');
                                Common.pushMessage(req, 'success', 'Successfully removed sample type from store check');
                                res.send(e, 200);
                            } else{
                                winston.log('warn', 'a POST ' + path + ' request from user=' + caller.name + ' failed, message=' + e);
                                Common.pushMessage(req, 'error', 'Failed to remove sample from store check');
                                res.send(e, 400);
                            }
                        });
                    } else {
                        winston.log('error', 'a POST ' + path + ' request from user=' + caller.name + ' failed because the sample type could not be found');
                        Common.pushMessage(req, 'error', 'Failed to remove sample type from store check');
                        res.send('index not found', 500);
                    }
                } else {
                    winston.log('warn', 'a POST ' + path + ' request from user=' + caller.name + ' failed, store check was closed');
                    Common.pushMessage(req, 'error', 'Failed to remove sample type from store check because the store check was closed');
                    res.send('index not found', 500);
                }
            } else {
                winston.log('warn', 'a POST ' + path + ' request from user=' + caller.name + ' failed');
                res.send(e, 400);
            }
        });
    });
}

function _handleSetSampleTypeSalesVolume(req, res) {
    Common.ensureHasAccess(req, res, 'store-check', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var id = req.params['id'], index = req.params['index'];
        Common.getByIdIfAuthorized(req, res, id, 'store-check', StoreCheckModule, Common.serviceErrorCallbacks, function(storecheck) {
            if(storecheck.sample_types.length <= index) {
                res.send('sample type not found at supplied index', 500);
                return;
            }
            storecheck.sample_types[index].sales_volume = req.body.value;
            StoreCheckModule.collection.update({_id: storecheck._id}, {$set: {sample_types: storecheck.sample_types}}, function(err_update, result_update) {
                res.send({result: 'ok'}, 200);
            });
        });
    });
}

function _handleStorecheckSampleTypeExport(req, res) {
    Common.ensureHasAccess(req, res, 'store-check', 'r', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var storecheck_id = req.param('id');
        var product_id = req.param('product_id');
        var template_id = req.param('template_id');

        if(!nodeUtils.isValidId(storecheck_id)) {
            res.send('invalid store check id supplied', 500);
            return;
        }

        if(!nodeUtils.isValidId(product_id)) {
            res.send('invalid product id supplied', 500);
            return;
        }

        if(!nodeUtils.isValidId(template_id)) {
            res.send('invalid template id supplied', 500);
            return;
        }

        Common.getByIdIfAuthorized(req, res, storecheck_id, 'store-check', StoreCheckModule, Common.viewErrorCallbacks, function(storecheck) {
            if(typeof(storecheck.sample_types) != 'undefined' && storecheck.sample_types.length > 0) {
                var sample_type = _.filter(storecheck.sample_types, function(sample_type) {
                    return sample_type.product_id == product_id && sample_type.template_id == template_id;
                });

                if(typeof(sample_type) == 'undefined' || sample_type.length == 0) {
                    res.send('sample type could not be found', 500);
                    return;
                }
                Common.getByIdIfAuthorized(req, res, product_id, 'product', ProductModule, Common.serviceErrorCallbacks, function(product) {
                    Common.getByIdIfAuthorized(req, res, template_id, 'template', TemplateModule, Common.serviceErrorCallbacks, function(template) {
                        Common.getQuestionsForTemplate(template, [], function() {
                            SampleModule.sortQuestions(template.records[0].questions);

                            var format = req.param('format');

                            if(typeof(format) == 'undefined' || format == 'flat') {
                                _exportStoreCheckToFlatFile(storecheck, product, template, caller, res);
                            } else if(format == 'xlsx') {
                                _exportStoreCheckToXlsxFile(storecheck, product, template, caller, res);
                            } else {
                                res.send('not a recognized format', 500);
                            }
                        });
                    });
                });

            } else {
                res.send([], 200);
            }
        });
    });
}

// === HELPERS ===

function _exportStoreCheckToFlatFile(storecheck, product, template, caller, res) {
    var file_contents = 'StoreCheckName\tStoreCheckGuid\tAuditGridName\tAuditGridGuid\tProductCode\tPointOfSaleCustomerName (e.g. PLZ Carrefour)\tPointOfSaleCompanyName (e.g. Carrefour Warszawa)\tPointOfSaleAddress\tPointOfSaleCountry\tPointOfSaleState\tPointOfSaleCity\tPointOfSalePostalCode\tPointOfSaleAddressType (RETAILER or CONSUMER)\tPointOfSaleEmail\tPointOfSaleAccountNumber\tVisitDate (dd-MM-yyyy, e.g. 21-05-2014)\tAuditorName\tSampleId\tBestBy (dd-MM-yyyy, e.g. 28-05-2014)\tFactoryCode\tProductionLineCode\tBatchCode\tNote';

    SampleModule.sortQuestions(template.records[0].questions);
    var observations = template.records[0].questions;
    _.each(observations, function(observation) {
        _.each(observation.answers, function(answer) {
            file_contents += '\t' + answer.code;
        });
    });

    var end_line_separator = '\r\n';
    file_contents += end_line_separator + storecheck.name + '\t' + storecheck._id +
        '\t' + template.name + '\t' + template._id + '\t' + product.code + '\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t'; //OB1\tOB2\t...

    _.each(observations, function(observation) {
        if(observation.answers.length == 1) {
            file_contents += '\t' + observation.answers[0].value;
        } else {
            _.each(observation.answers, function(answer) {
                file_contents += '\t' + (answer.value == 'true' ? '1' : 0);
            });
        }
    });

    //res.header('Content-Disposition', 'inline; filename="samples_' + storecheck._id.toHexString() + '.csv"');
    //res.header('Content-Type', 'text/csv');

    res.header('Content-Type', 'text/plain; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="samples_' + storecheck._id.toHexString() + '.txt"');
    res.status(200);
    res.send(file_contents);
}

// === EXCEL XLSX HELPERS ===

function _exportStoreCheckToXlsxFile(storecheck, product, template, caller, res) {
    var worksheets = {
        worksheets: [
            _buildXlsxMainSheet(storecheck, product, template),
            _buildXlsxKeySheet(storecheck, product, template)//,
            //_buildXlsxAdminSheet(storecheck, product, template)
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
}

function _buildXlsxMainSheet(storecheck, product, template) {
    var samplesSheet = {
        "name":"Entries",
        "data":[
            // each column: 1st cell is question, each following cell is a sample's answer
        ],
        "data_validation": [
            []
        ]
    };

    // build the header row
    var headerRow = [
        { value: "StoreCheckName", bold: true, autoWidth: true },
        { value: "StoreCheckGuid", bold: true, autoWidth: true },
        { value: "AuditGridName", bold: true, autoWidth: true },
        { value: "ProductCode", bold: true, autoWidth: true },
        { value: "PointOfSale", bold: true, autoWidth: true },
        { value: "VisitName", bold: true, autoWidth: true },
        { value: "Date", bold: true, autoWidth: true },
        { value: "SampleId", bold: true, autoWidth: true },
        { value: "BestBy", bold: true, autoWidth: true }
    ];
    var observations = template.records[0].questions;
    _.each(observations, function(observation) {
        headerRow.push({ value: observation.level5_code, bold: true, autoWidth: true });
    });
    samplesSheet.data.push(headerRow);

    // fill in the first row
    var sampleRow = [
        { value: storecheck.name, autoWidth: true },
        { value: storecheck._id.toHexString(), autoWidth: true },
        { value: template.name, autoWidth: true },
        { value: product.code, autoWidth: true },
        { value: 'TBD', autoWidth: true },
        { value: '', autoWidth: true },
        { value: '', autoWidth: true },
        { value: '1', autoWidth: true },
        { value: '', autoWidth: true }
    ];
    var question_validations = [
        {}, {}, {}, {}, {}, {}, {}, {}, {}
    ];
    _.each(observations, function(observation, question_index) {

        if(observation.answers.length == 1) {
            sampleRow.push({ value: '', autoWidth: true });
            question_validations.push({
                type: 'any'
            });
        } else {

            var all_unanswered = _.every(observation.answers, function(answer) {

                // add validation entry for this answer
                question_validations.push({
                    type: 'list',
                    source: 'Answers!$' + 'A$' + (question_index + 1) + ':$' + xlsx_util.getCellLettersByIndex(observation.answers.length - 1) + '$' + (question_index + 1)
                });

                // add the "default" answer
                if(answer.value == 'true') {
                    sampleRow.push({ value: answer.text, autoWidth: true });
                    return false;
                }
                return true;
            });

            if(all_unanswered) {
                sampleRow.push({ value: '', autoWidth: true });
            }
        }
    });

    // add validation entries for this cell
    samplesSheet.data_validation.push(question_validations);
    samplesSheet.data.push(sampleRow);

    return samplesSheet;
}

function _buildXlsxKeySheet(storecheck, product, template) {
    // build the sheet of keys
    var keySheet = {
        "name":"Answers",
        "data": []
    };

    // NOTE: Assumes all samples have the same question structure
    // each question's answers occupy a row of the answers sheet
    _.each(template.records[0].questions, function(question) {
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

function _buildXlsxAdminSheet(samples) {

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