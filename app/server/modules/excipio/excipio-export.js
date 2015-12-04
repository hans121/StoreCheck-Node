var _ = require('underscore');
var async = require('async');
var config = require('config');
var fs = require('fs');
var moment = require('moment');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var category_specific = require('../category-specific');
var db = require('../database/static-database');
var dbUtils = require('../database/database-utils');
var nodeUtils = require('../node-utils');
var formatter = require('./../view-formatter');

var DynamicConfigModule = require('../dynamic-config');
var OrganizationModule = require('./../model/organization');
var PointOfSaleModule = require('./../model/hierarchy/point-of-sale');
var SampleModule = require('./../model/sample');
var StoreCheckModule = require('./../model/store-check');
var TemplateModule = require('./../model/template');
var VisitModule = require('./../model/visit');

var ExcipioExport = db.db.collection('excipio-export');
var excipio_sftp = require('./excipio-sftp');
var excipio_xml = require('./excipio-xml');
var excipio_export_log = require('../excipio-export-log');

dbUtils.addStandardMethods(exports, ExcipioExport);

var EXPORT_BATCH_SIZE = 1;

// visit -> case
// sample -> issue
// answer_option -> issueDetail

// processes operate in some combination of two steps:
// 1. records are generated visits/samples/storechecks and put into the excipio-export collection
// 2. we query the excipio-export collection for some set of records
//     - we generate xml from the records
//     - send the xml contents via SFTP
//
// notes:
// - excipio-export represents ready-to-send visit records that are pending a send via SFTP
//
// Module Exports:
// - export
//      - clears the excipio-export collection
//      - goes through all visits, builds a record for each sample, puts them into excipio-export
//      - grabs visit records from excipio-export, builds xml, sends them to SFTP in 10-visit batches
// - exportPending will skip step one, and export records in bundles of 10 per xml file
// - exportVisit will grab the samples for a single visit, generate xml, send it via SFTP (does not use excipio-export)
// - exportStoreCheck
//      - grab each sample from each visit for a given store check, build visit record
//      - generate xml, send via SFTP  (does not use excipio-export)
// - exportSamples
//      - grab all visits for the provided samples, build visit records for each
//      - grabs visit records from excipio-export, builds xml, sends them to SFTP in 10-visit batches

module.exports = {
    export:             _export,
    exportPending:      _exportPending,
    exportVisit:        _exportVisit,
    exportStoreCheck:   _exportStoreCheck,
    exportSamples:      _exportSamples
};

var default_config_values = {
    date_format: "MM/DD/YYYY",
    datetime_format: "MM/DD/YYYY HH:mm:ss",
    image_prefix: '',
    pos: {
        address_1_length: 80,           // nvarchar[80]
        address_2_length: 40,           // nvarchar[40]
        address_3_length: 40,           // nvarchar[40]
        city_length: 30,                // nvarchar[30]
        state_length: 3,                // nchar[3]
        account_number_length: 40,      // nvarchar[40]
        postal_code_length: 10,         // nvarchar[10]
        country_length: 3,              // nchar[3]
        email2_length: 255,             // nvarchar[255]
        company_name_length: 40,        // nvarchar[40]
        address_type_code_length: 40,   // nvarchar[40]
        a12_code_length: 40,            // nvarchar[40] "Country" ?
        a47_code_length: 40,            // nvarchar[40] "Storecheck Candidate"
        a48_code_length: 40,            // nvarchar[40] "Region of Sales"
        a50_code_length: 40,            // nvarchar[40] "Distribution Channel"
        a52_code_length: 40,            // nvarchar[40] "Danone Platform"
        a53_code_length: 40,            // nvarchar[40] "Admin Area"
        a54_code_length: 40,            // nvarchar[40] "Preparation Type"
        a56_code_length: 40,            // nvarchar[40] "Mechanization"
        a57_code_length: 40,            // nvarchar[40] "Customer Platform"
        a59_code_length: 40,            // nvarchar[40] "Customer"
        a70_code_length: 40             // nvarchar[40] "POS MongoDB ID"
    }
};

var shall_copy_images_to_sftp = true;

function _export(excipio_user_id, callback) {
    nodeUtils.runInBackground(function() {
        exports.removeAll(function() { // err, deletion_count
            DynamicConfigModule.findOne({key: 'excipio-export'}, function(err_config, import_config) {
                if(err_config) {
                    callback('could not get dynamic config for export while doing mass export');
                    return;
                }

                // TODO: provide default import_config

                SampleModule.collection.distinct('visit_id', {state: {$in: DynamicConfigModule.getExportSampleStatesFromConfig(import_config)}}, function(err_visit_ids, visit_ids) {
                    if(err_visit_ids) {
                        callback('could not get list of visit ids to export for mass export');
                        return;
                    }

                    visit_ids = _.map(visit_ids, function(id) { return ObjectId(id);});
                    VisitModule.find({_id: {$in: visit_ids}}, function (err, visits) {
                        if (err || !visits || visits.length == 0) {
                            callback(err, visits);
                            return;
                        }

                        var asyncFunctions = [], i;

                        // for each visit, find any released samples
                        _.each(visits, function (visit) {
                            _addVisitFunction(visit, excipio_user_id, asyncFunctions);
                        });

                        _addConsolidateFunction(function (err, results) {}, asyncFunctions);

                        winston.debug(asyncFunctions.length + ' tasks are scheduled for excipio mass-export for ' + visits.length + ' visits');
                        async.series(asyncFunctions, callback);
                    });
                });
            });
        });
    });
}

function _exportPending(callback) {
    _consolidateVisitRecords(callback, function() {})
}

function _exportVisit(visit_id, excipio_user_id, callback2) {
    VisitModule.findOneById(visit_id, function(err, visit) {
        if(err != null || !visit) {
            callback2('could not find visit');
            return;
        }
        generateCaseRecordFromVisit(
            function(err_cb) { callback2(err_cb, null);},
            function(record) {
                if(!record) {
                    winston.warn('a visit was bypassed on export because it contained no samples');
                    callback2();
                    return;
                }

                var xmlString = '<CaseList>';
                xmlString += excipio_xml.getCaseRecordXML(record);
                xmlString += '\n</CaseList>';

                var filename = _generateFilename([visit]);

                excipio_sftp.sendFileContentsToSFTP(filename, xmlString, function(err) {
                    if(err) {
                        if(excipio_sftp.getRetryCount()<=3) {
                            winston.error('failed to send visit file to SFTP - retrying in 30 seconds');
                            _retrySendFileContentsToSFTP([record], filename, xmlString, 30000, 1);
                        }
                        else
                        {
                            winston.error('failed to send visit file to SFTP - retrying in 1hr');
                            _retrySendFileContentsToSFTP([record], filename, xmlString, 3600000, 1);
                        }
                    } else {
                        excipio_export_log.report([record], filename, 0);
                    }

                    callback2();
                });
            },
            excipio_user_id,
            visit
        );
    });
}

function _exportVisits(visits, excipio_user_id, callback2) {
    winston.debug('exporting ' + visits.length + ' visits to SFTP');

    var asyncFunctions = [], i;

    _.each(visits, function(visit) {
        _addVisitFunction(visit, excipio_user_id, asyncFunctions);
    });

    _addConsolidateFunction(function(err, result) {}, asyncFunctions);

    async.series(asyncFunctions, callback2);
}

function _exportSamples(sample_ids, excipio_user_id, callback2) {
    VisitModule.getVisitIdsForSamples(sample_ids, function(err, visit_ids) {
        if(err != null || visit_ids == null) {
            callback2(err);
            return;
        }

        _exportVisits(visit_ids, excipio_user_id, callback2);
    });
}

function _exportStoreCheck(storecheck_id, excipio_user_id, callback2) {
    VisitModule.getVisitsForStoreCheck(storecheck_id, undefined, function(err, visits) {
        if(err != null && visits == null) {
            callback2(err, null);
            return;
        }

        _exportVisits(visits, excipio_user_id, callback2);
    });
}

function _addVisitFunction(visit, excipio_user_id, visitFunctionList) {
    visitFunctionList.push(function(callback) {
        _processVisitAsSyncJob(callback, excipio_user_id, visit);
    });
}

function _addConsolidateFunction(externalCallback, functionList) {
    functionList.push(function(callback) {
        _consolidateVisitRecords(externalCallback, callback);
    });
}

function _processVisitAsSyncJob(callback, excipio_user_id, visit) {
    _exportVisit(visit._id.toHexString(), excipio_user_id, callback);

    /*
    generateCaseRecordFromVisit(
        function(err_cb) {
            winston.error('an error occurred while generating a case record from visit ' + (visit && visit._id ? visit._id.toHexString() : '') + ': ' + err_cb);
            callback(); // an err is logged, but make sure we don't stop the export
            //callback(err_cb);
        },
        function(record) {
            if(!record) {
                winston.warn('no export record was generated for visit ' + visit._id.toHexString() + ' most likely because no released examples were found');
                callback();
                return;
            }
            ExcipioExport.insert(record, function() { // insert_count
                callback();
            });
        },
        excipio_user_id,
        visit
    );
    */
}

// onResult can return null if no samples have been released for the given sample
function generateCaseRecordFromVisit(onError, onResult, excipio_user_id, visit) {
    winston.debug('generating excipio case record for visit ' + visit._id.toHexString());
    if(!visit.samples) {
        onResult(null);
        return;
    }
    if(visit.samples) {
        var visit_sample_ids = visit.samples.map(function(sample) {return ObjectId(sample.id);});

        if(_.isUndefined(visit.store_check_id) || !nodeUtils.isValidId(visit.store_check_id)) {
            onError('No storecheck as associated with visit ' + visit._id.toHexString() );
            return;
        }

        DynamicConfigModule.findOne({key: 'excipio-export'}, function(err, import_config) {
            var config_values = {};
            config_values = _.extend(config_values, default_config_values);

            if(import_config && import_config.values) {
                config_values = _.extend(config_values, import_config.values);
            }
            StoreCheckModule.findOneById(visit.store_check_id, function (err_storecheck, storecheck) {
                if (err_storecheck != null || storecheck == null) {
                    onError('Could not find storecheck ' + visit.store_check_id + ' while exporting visit ' + visit._id.toHexString());
                    return;
                }
                OrganizationModule.findOneById(visit.organization, function (err_org, organization) {
                    if (err_org != null || organization == null) {
                        onError('Could not find organization ' + visit.organization + ' while exporting visit ' + visit._id.toHexString());
                        return;
                    }
                    PointOfSaleModule.findOneById(visit.pos_id, function (err_pos, pos) {
                        if (err_pos != null || pos == null) {
                            onError('Could not find pos' + visit.pos_id + ' while exporting visit ' + visit._id.toHexString());
                            return;
                        }
                        var sampleCriteria = {_id: {$in: visit_sample_ids}};
                        sampleCriteria.state = {$in: DynamicConfigModule.getExportSampleStatesFromConfig(import_config)};
                        SampleModule.find(sampleCriteria, function (err_released_samples, released_samples) {
                            if (err_released_samples) {
                                onError('An error occurred while finding samples while exporting visit ' + visit._id.toHexString());
                                return;
                            }

                            if (released_samples == null || released_samples.length == 0) {
                                onResult(null);
                                return;
                            }

                            var template_ids = released_samples.map(function (sample) {
                                return sample.template_id;
                            });
                            template_ids = template_ids.filter(function (e, i) {
                                return template_ids.indexOf(e) == i;
                            });
                            template_ids = template_ids.map(function (template_id) {
                                return ObjectId(template_id);
                            });

                            TemplateModule.find({_id: {$in: template_ids}}, function (err_templates, templates) {

                                if (err_templates || templates.length == 0) {
                                    onError('no templates were found during excipio export');
                                    return;
                                }

                                var division = safeStr(templates[0].records[0].t01_code, 40);

                                // varchar[40] "Date of Contact"
                                var b06_code = safeStr(convertShortDate(visit.date_of_visit, config_values.date_format), 40);

                                // varchar[40] "Date of storecheck"
                                var b19_code = safeStr(convertShortDate(storecheck.reportDate, config_values.date_format), 40);

                                // varchar[40] "Campaign closed => store check closed" - marked with date when store check closed
                                var b21_code = safeStr(convertShortDate(storecheck.endDate, config_values.date_format), 40);

                                var record = {
                                    //company_id:                                                               // required char[3] "auto-generated"
                                    //case_id: visits[i]._id.toHexString(),                                     // required int[4] "auto-generated"
                                    initial_user_code: "isprocess",                                             // required varchar[40]
                                    responsible_user_code: safeStr(excipio_user_id, 40),                        // required varchar[40] "Responsible Rep"
                                    address_id: 0,                                                              // int[4]
                                    case_status: "C",                                                           // required char[1], O = "open", C = "closed"
                                    case_status_code: "Reviewed",                                               // required varchar[40]
                                    //received: "",                                                             // datetime[8], required ???
                                    //closed: "",                                                               // datetime[8]
                                    contact_multiplier: 1,                                                      // int, not used by Danone
                                    b05_code: "WW STORE CHECK",                                                 // varchar[40] "Origin" (Danone to use generic code to identify Store Checks: WW STORE CHECK)
                                    b06_code: b06_code,
                                    //b07_code: "",
                                    b08_code: safeStr(organization.code, 40),                                   // varchar[40] "Selling CBU" [category_type="Code; 2 Levels", description 3 of O03]
                                    b09_code: "Store Check",                                                    // varchar[40] "Caller profile"
                                    b11_code: safeStr(visit.auditor_name, 40),                                  // varchar[40] "Auditor"
                                    b13_code: safeStr(division, 40),                                            // varchar[40] "WWBU" (from template)
                                    b10_code: safeStr(storecheck.name, 2000),                                   // varchar[2000] "Store check description"
                                    b19_code: b19_code,
                                    //case_address_role: "",                                                    // varchar[40] Unconfirmed Use/Need
                                    b21_code: b21_code,
                                    b23_code: safeStr(storecheck.type, 16),
                                    //b49_code: "",                                                 // varchar[40] "Boolean" ???
                                    b17_code: safeStr(visit._id.toHexString(), 40),                 // varchar[40] "Survey Response ID" Category Type is "Integer" // TODO: just convert visit id to decimal? (i.e. parseInt(id, 16))
                                    issues: _buildSampleRecords(storecheck, visit, released_samples, templates, config_values)
                                };

                                record.address = _buildPOSRecord(pos, config_values);

                                // build a list of images for all samples (unique)
                                var sample_urls = [];
                                _.each(released_samples, function (sample) {
                                    _.each(sample.questions, function (question) {
                                        if (question.image_urls && question.image_urls.length > 0) {
                                            _.each(question.image_urls, function (image_url) {
                                                sample_urls.push(image_url);
                                            });
                                        }
                                    });
                                });
                                sample_urls = _.uniq(sample_urls);

                                // if there are images, upload them in the background
                                if (sample_urls.length > 0 && shall_copy_images_to_sftp) {
                                    nodeUtils.runInBackground(function () {
                                        _copyImagesToSFTP(sample_urls, function (err_copy, copy_result) {
                                            winston.info('SFTP image file copy complete for visit ' + visit._id.toHexString());
                                        });
                                    });
                                }

                                onResult(record);
                            });
                        });
                    });
                });
            });
        });
    }
}

function _buildSampleRecords(storecheck, visit, released_samples, templates, config_values) {
    var records = [];

    _.each(released_samples, function(sample) {
        _.each(templates, function(template) {
            if(sample.template_id == template._id.toHexString()) {
                sample.template = template;
            }
        });

        var issue_count = sample.non_conform.length + sample.alerts.length;

        // find the sample_type for the store check that matches this sample
        var sample_type = _.find(storecheck.sample_types, function(sample_type) {
            return sample_type.product_id == sample.product_id && sample_type.template_id == sample.template_id;
        });

        // safely grab the sales volume
        var sales_volume = (typeof(sample_type) == 'undefined' || typeof(sample_type.sales_volume) == 'undefined' ? '' : sample_type.sales_volume);

        // calculate time remaining
        var remaining = '';
        if(visit.date_of_visit.length > 0 && sample.best_by_date.length > 0) {
            var moment_to_use = moment(visit.date_of_visit, "DD-MMM-YYYY");
            remaining = _calculateRemaining(moment_to_use, sample.best_by_date, 'DD-MMM-YYYY') + '';
        }

        // format state string
        var stateString = "Released";
        if(sample.state == 'validated') {
            stateString = "Validated";
        }

        // varchar[40], "Auditor submitted"
        var c51_code = safeStr(convertZDateTime(sample.submitted_time, config_values.datetime_format), 40);

        // varchar[40], "BBD/UBD Primary Container
        var c75_code = safeStr(convertShortDate(sample.best_by_date, config_values.date_format), 40);

        records.push({
            product_code: safeStr(sample.product_info.code, 40),            // varchar[40]
            issue_status: "C",                                              // char[1], filled="auto"
            issue_status_code: "Received",                                  // varchar[40], filled="auto"
            c52_code: issue_count == 0 ? "Yes" : "No",                      // varchar[40], "Perfectly executed ("Yes" or "No")
            c73_code: safeStr(sample.factory_code, 40),                     // varchar[40], "Factory"
            c82_code: safeStr(sample._id.toHexString(), 90),                // varchar[90], "For sample sequence"
            c91_code: safeStr(sample.production_line_code, 40),
            //custom_date1: "",
            //date_added: safeStr(convertZToDate(sample.creation_time), 9), // varchar[8], "Date Added"
            //added_by_user_code: "",
            //date_changed: "",
            //changed_by_user_code: "",
            c05_code: "OFF Store Check",                                    // "Root Cause"
            c10_code: safeStr(sales_volume, 40),                            // varchar[40]
            c11_code: "normal",                                             // "Severity"
            c22_code: "OFF Store Check",                                    // "Consumer Reason"
            c26_code: "Stored",                                             // varchar[40], "Samples" {"Useless" = to be excluded; "Stored" if OK}, Default to "Stored"
            c46_code: safeStr(sample.validated_agent, 40),                  // varchar[40], "Supervisor"
            c51_code: c51_code,
            c53_code: safeStr(stateString, 40),                             // varchar[40], "Supervisor validation" ("Draft"/"Validated"/"Released")
            c75_code: c75_code,
            c71_code: safeStr(sample.batch_code, 40),                       // varchar[40], "Batch code of primary container"
            //c68_code: "",                                                 // varchar[40], "Flavour group"
            c41_code: safeStr(sample.name + '', 40),                        // varchar[40], "3P Sample ID"
            c43_code: safeStr(remaining, 40),                               // varchar[40], "Remaining shelf life"
            c31_code: safeStr(sample.note, 2000),                           // varchar[2000], "Sample note"
            //c05_code: "",                                                 // ??, Root Cause (OFF STORE CHECK)
            //c22_code: "",                                                 // ??, Consumer Reason (OFF STORE CHECK)
            issue_details: _buildIssueDetails(sample, config_values)
        });
    });

    return records;
}

function _calculateRemaining(from_moment, expiration, format) {
    var expiration_as_moment = moment.utc(expiration, format);
    if(expiration_as_moment.isValid()) {
        return Math.round(expiration_as_moment.diff(from_moment, 'days', true));
    }
    return '';
}

function _buildIssueDetails(sample, config_values) {
    var results = [];

    _.each(sample.questions, function(question) {
        _.each(question.answers, function(answer) {
            var image_url_descriptor = '';
            
            if(question.image_urls && question.image_urls.length > 0) {
                var url_tokens = question.image_urls[0].split('/');
                image_url_descriptor = config_values.image_prefix + url_tokens[url_tokens.length - 1];
            }

            var t08 = answer.text, t12 = safeStr(answer.value, 40), question_type = category_specific.getQuestionType(question.category_specific);
            if(question_type == 'select' || question_type == 'checkbox') {
                t12 = (t12 == 'true' ? 'Yes' : 'No');
            } else {
                // for numbers, t08 should be the answer, and t12 should be whether or not it is set
                t08 = answer.value;
                t12 = (!!answer.value && answer.value.length > 0 ? 'Yes' : 'No');
            }

            var t05_code = answer.weight;
            if(!t05_code || t05_code.trim().length == 0) {
                t05_code = 'N/A';
            }

            var issue_detail = {
                issue_detail: -1,                                              // int[4], "issue_detail" (required)
                t01_code: safeStr(answer.identity_id, 40),                     // varchar[40], "Sequence ID"
                t03_code: safeStr(sample.template.records[0].t03_code, 40),    // varchar[40], "Audit Grid Template" (NOTE: was "sample.template.records[0].t03_code")
                t05_code: safeStr(t05_code, 40),                               // varchar[40], "Score"
                t06_code: "Yes",                                               // varchar[40], "Active Code"
                t07_code: safeStr(question.level5_description2, 80),           // varchar[80], "Item TR"
                t08_code: safeStr(t08, 80),                                    // varchar[80], "Finish TR"
                //date_added: safeStr(convertZToDate(question.answer_date), 9),// varchar[8], "Date Added"
                //added_by_user_code: "",                                      // varchar[40]
                //date_changed: safeStr(convertZToDate(question.answer_date), 9),// varchar[8], "Date Changed"
                //changed_by_user_code: "",                                    // datetime[8]
                t09_code: safeStr(question.level3_description2, 40),
                t10_code: safeStr(question.level4_description2, 40),
                t11_code: safeStr(question.level5_description2, 80),
                t12_code: t12,
                t02_code: safeStr(answer.code, 40),
                t31_code: safeStr(image_url_descriptor, 2000)
            };
            results.push(issue_detail);
        });
    });
    return results;
}

function _buildPOSRecord(pos, config_values) {
    return {
        address_id:             typeof(pos.address_id) != 'undefined' && pos.address_id != null ? pos.address_id : '-1',
        address_type_code:      safeStr(pos.address_type_code, config_values.pos.address_type_code_length),
        //address_code:         '',                                         // nvarchar[40]
        active:                 safeStr(pos.active, 1),                     // nchar[1]
        account_number:         safeStr(pos.account_number, config_values.pos.account_number_length),
        //name_title:           '',                                         // nvarchar[12]
        //given_names:          '',                                         // nvarchar[255]
        //middle_initial:       '',                                         // nchar[1]
        //last_name:            '',                                         // nvarchar[255]
        //suffix:               '',                                         // nvarchar[5]
        company_name:           safeStr(pos.company_name, config_values.pos.company_name_length),
        address1:               safeStr(pos.address1, config_values.pos.address_1_length),
        address2:               safeStr(pos.address2, config_values.pos.address_2_length),
        address3:               safeStr(pos.address3, config_values.pos.address_3_length),
        city:                   safeStr(pos.city, config_values.pos.city_length),
        state:                  safeStr(pos.state, config_values.pos.state_length),
        postal_code:            safeStr(pos.postal_code, config_values.pos.postal_code_length),
        country:                safeStr(pos.country, config_values.pos.country_length),
        //email:                '',                                         // nvarchar[40] OBSOLETE
        email2:                 safeStr(pos.email, config_values.pos.email2_length),
        //search_name:          '',                                         // nvarchar[40]
        //search_address:       '',                                         // nvarchar[40]
        //originated_via:       '',                                         // nchar[1]
        //originated_date:      '',                                         // datetime
        //last_modified:        '',                                         // datetime
        //allow_survey:         '',                                         // nchar[1]
        //last_contact:         '',                                         // datetime
        //accumulated_goodwill: '',                                         // numeric(12, 2)
        //where_to_buy:         '',                                         // nchar[1]
        //latitude:             '',                                         // numeric(9, 6)
        //longitude:            '',                                         // numeric(9, 6)
        instructions:           safeStr(pos._id.toHexString(), 255),        // nvarchar[255] "POS MongoDB ID"
        a12_code:               safeStr(pos.a12_code, config_values.pos.a12_code_length),
        //county:               '',                                         // nvarchar[40]
        a47_code:               safeStr(pos.a47_code, config_values.pos.a47_code_length),
        a48_code:               safeStr(pos.a48_code, config_values.pos.a48_code_length),
        a50_code:               safeStr(pos.a50_code, config_values.pos.a50_code_length),
        a52_code:               safeStr(pos.a52_code, config_values.pos.a52_code_length),
        a53_code:               safeStr(pos.a53_code, config_values.pos.a53_code_length),
        a54_code:               safeStr(pos.a54_code, config_values.pos.a54_code_length),
        a56_code:               safeStr(pos.a56_code, config_values.pos.a56_code_length),
        a57_code:               safeStr(pos.a57_code, config_values.pos.a57_code_length),
        a59_code:               safeStr(pos.a59_code, config_values.pos.a59_code_length),
        a70_code:               safeStr(pos._id.toHexString(), config_values.pos.a70_code_length)
        //primary_address_id:   ''
        //date_added:           safeStr(convertZToDate(pos.date_added), 9), // datetime
        //added_by_user_code:   safeStr(pos.added_by_user_code, 40),        // nvarchar[40] "POS MongoDB ID"
        //date_changed:         ''
        //changed_by_user_code: ''
    };
}

function _copyImagesToSFTP(url_list, callback2) {
    if(url_list.length == 0) {
        callback2(null, []);
        return;
    }

    var url = url_list.shift();
    url = url.replace('https://', 'http://');

    winston.debug('excipio-export module is connecting to SFTP to upload and image from ' + url);
    excipio_sftp.connect(function(connection) {
        //var request = request(url, function(response) {
            var filename_tokens = url.split('/');
            var filename = filename_tokens[filename_tokens.length - 1];
            winston.debug('excipio-export module is copying ' + filename + ' to remote SFTP');
            excipio_sftp.copyRemoteFileToSFTP(connection, url, filename, function (err) { // err, success
                excipio_sftp.close(connection);
                if(err) {
                    winston.log('error', 'an error occurred while sending to sftp: ' + err);
                    callback2(err);
                    return;
                }

                winston.debug('excipio-export module has copied ' + filename + ' to remote SFTP');
                nodeUtils.recursiveWrapper(function() { _copyImagesToSFTP(url_list, callback2); });
            });
        //});
    });
}

// grabs EXPORT_BATCH_SIZE records from the pending export table and sends them over SCP as xml
// keeps going until all exports are done
function _consolidateVisitRecords(externalCallback, onComplete) {

    winston.info('consolidating visit records');

    // get oldest exports, and export them
    ExcipioExport.find({}, {limit: EXPORT_BATCH_SIZE}).sort({_id: 1}).toArray(function(err, visit_batch) {
        if(err) {
            winston.error('while consolidating visit records, an error occurred: ' + err);
            externalCallback();
            onComplete();
            return;
        }

        if(visit_batch.length == 0) {
            externalCallback();
            onComplete();
            return;
        }

        var async_tasks = [];

        // build the string and add functions to copy from S3 to SFTP
        var xmlString = '\n<CaseList>', export_ids = [];
        _.each(visit_batch, function(case_record) { // , index
            export_ids.push(case_record._id);
            xmlString += excipio_xml.getCaseRecordXML(case_record);
        });
        xmlString += '\n</CaseList>';

        async_tasks.push(function(callback) {
            var filename = _generateFilename(visit_batch);

            excipio_sftp.sendFileContentsToSFTP(filename, xmlString, function(err) { // , success
                if(err) {
                    if(excipio_sftp.getRetryCount()<=3) {
                        winston.error('failed to send visit file to SFTP - retrying in 30 seconds');
                        _retrySendFileContentsToSFTP(visit_batch, filename, xmlString, 30000, 1);
                    }
                    else
                    {
                        winston.error('failed to send visit file to SFTP - retrying in 1hr');
                        _retrySendFileContentsToSFTP(visit_batch, filename, xmlString, 3600000, 1);
                    }
                } else {
                    excipio_export_log.report(visit_batch, filename, 0);
                }

                // erase relevant excipio export records in export_ids
                ExcipioExport.remove({_id: {$in: export_ids}}, function(count) { // count
                    callback(count);
                });
            });
        });

        async.series(async_tasks, function() { // err_async, results_asyc
            nodeUtils.recursiveWrapper(function() {
                _consolidateVisitRecords(externalCallback, onComplete);
            });
        });
    });
}

function _generateFilename(visits) {
    return "/excipio/from_storecheck/storecheck_" + new Date().valueOf() + ".xml.gz";
}

function _retrySendFileContentsToSFTP(case_records, filename, contents, interval_ms, iteration) {
    setTimeout(function() {
        excipio_sftp.sendFileContentsToSFTP(filename, contents, function(err) {
            if(err) {
                if(excipio_sftp.getRetryCount()<=3) {
                    winston.error('failed to send ' + filename + ' to SFTP - retrying in 30 seconds');
                    _retrySendFileContentsToSFTP(case_records, filename, contents, 30000, iteration + 1);
                }
                else {

                    winston.error('failed to send ' + filename + ' to SFTP - retrying in 1hr');
                    _retrySendFileContentsToSFTP(case_records, filename, contents, 3600000, iteration + 1);
                }
                return;
            } else {
                excipio_export_log.report(case_records, filename, iteration);
            }
            winston.info('SFTP retry succeeded');
        });
    }, interval_ms);
}

function convertZToDate(zuluString, format) {
    return !zuluString ? "" : formatter.convertZToDate(zuluString, format);
}

function convertZDateTime(zuluString, format) {
    return !zuluString ? "" : formatter.convertZToExcipio(zuluString, format);
}

function convertShortDate(shortString, format) {
    return !shortString ? "" : formatter.convertShortToExcipio(shortString, format);
}

function safeChars(unsafeString) {
    if(!unsafeString) {
        return "";
    }

    return unsafeString.replace(/</g, '&lt;')
        .replace(/&/g, '&amp;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/\n/g, '&amp;#10;')
        .replace(/\r/g, '&amp;#13;');
}

function safeStr(unsafeString, maxLength) {
    return safeChars(limitLength(unsafeString, maxLength));
}

function limitLength(str, max) {
    if(!str) {
        return "";
    }

    // try to be protective, even though no strings should be coming in here
    if(typeof(max) == 'string') {
        try {
            max = parseInt(max);
        } catch(ex) {
            winston.error('limitLength trying to parse ' + max + ' as max');
            return str;
        }
    }

    var tstr = str;
    if (tstr.length > max) {
        tstr = tstr.substring(0, max);
    }
    return tstr;
}