var _ = require('underscore');
var async = require('async');
var csv = require('csv');
var fs = require('fs');
var moment = require('moment');
var winston = require('winston');

var category_specific = require('../../../modules/category-specific');
var Common = require('../../router-common');
var formatter = require('../../../modules/view-formatter');
var schema = require('../../../modules/model/schema/schema');

var OrganizationModule = require('../../../modules/model/organization');
var PointOfSaleModule = require('../../../modules/model/hierarchy/point-of-sale');
var ProductModule = require('../../../modules/model/hierarchy/product');
var SampleCreate = require('./sample-create');
var SampleModule = require('../../../modules/model/sample');
var VisitModule = require('../../../modules/model/visit');

module.exports = function(app) {

    // Imports excel csv files of samples
    //
    // Error conditions:
    //     - Caller isn't authorized to update samples
    //     - TODO: stuff about format of (excel?) file, sample IDs, etc...
    Common.addHandler(app, 'post', '/samples/import', _handleImportSamples);
};

// IMPORT CSV

function _handleImportSamples(req, res) {
    // TODO: user must have create visit, create sample, create POS permissions
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);
        if(_.isUndefined(req.files) || _.isUndefined(req.files.files)) {
            Common.serviceErrorCallbacks.on500(req, res, 'File list not received');
            return;
        }

        _handleImportSamplesCsv(req.files.files, [], req, res, caller, function(err, result) {
            if(err != null) {
                res.send(err, 500);
                return;
            }
            res.send(result, 200);
        });
    });
}

function _handleImportSamplesCsv(files, completed_files, req, res, caller, callback2) {
    if(files.length == 0) {
        callback2(null, completed_files);
        return;
    }
    var next_file = files.shift(), samples_created = [], samples_updated = [], warnings = [];

    fs.readFile(next_file.path, 'utf8', function(err, data) {
        if(err) {
            winston.error('failed to read ' + next_file.path);
            _handleImportSamplesCsv(files, completed_files, req, res, caller, callback2);
            return;
        }

        // grab the lines, if they exist
        var lines = data.split('\n'), linesCR = data.split('\r');
        if(linesCR.length > lines.length) {
            lines = linesCR;
        }
        if(lines.length <= 1) {
            // process any additional csv files
            _handleImportSamplesCsv(files, completed_files, req, res, caller, callback2);
            return;
        }

        // figure out what the separator is
        var separator = _detectSeparator(lines[0]);

        // read all of the line (and header) data
        var line_data = [], headers = lines.shift().split('\t');
        _getDataFromLines(separator, headers, lines, 1, line_data, function(err, line_data) {

            // at this point, we have the data that each line represents in objects in the line_data array
            _processCSVImportLines(req, res, caller, line_data, samples_created, samples_updated, warnings, function(err_lines, lines_results) {
                if(err_lines != null) {
                    // issues have already been logged when they happened
                }

                if(lines_results) {
                    completed_files.push({
                        file: next_file,
                        samples_added: samples_created,
                        samples_updated: samples_updated,
                        warnings: warnings
                    });
                }

                _handleImportSamplesCsv(files, completed_files, req, res, caller, callback2);
            });
        });
    });
}

// creates any items in pos_tuples and makes sure any referenced pos is put into pos_objects
function _ensurePOSItemsCreated(pos_tuples, caller, pos_objects, callback2) {

    // create a list of functions to run (1 per tuple)
    var setup_functions = [];

    _.each(pos_tuples, function(pos_tuple) {
        setup_functions.push(function(callback) {

            var pos_query = {
                a59_code:                   pos_tuple.point_of_sale_customer_name,
                address1:                   pos_tuple.point_of_sale_address,
                city:                       pos_tuple.point_of_sale_city,
                organization:               caller.active_organization
            };

            // if we have a matching POS in our cache, move on to the next POS
            var pos_cached = _.findWhere(pos_objects, pos_query);
            if(pos_cached) {
                callback();
                return;
            }

            Common.rawFindPointsOfSale(caller, pos_query, function(err_pos, pos) {
                if(pos && pos.length > 0) {
                    pos_objects.push(pos[0]);
                    callback(null, pos[0]);
                    return;
                }

                // TODO: attempt to match address type to enum

                PointOfSaleModule.collection.insert({
                    company_name:               pos_tuple.point_of_sale_company,
                    address1:                   pos_tuple.point_of_sale_address,
                    address2:                   '',
                    address3:                   '',
                    city:                       pos_tuple.point_of_sale_city,
                    state:                      pos_tuple.point_of_sale_state,
                    postal_code:                pos_tuple.point_of_sale_postal_code,
                    address_type_code:          '',
                    country:                    pos_tuple.point_of_sale_country,
                    email:                      pos_tuple.point_of_sale_email,
                    account_number:             pos_tuple.point_of_sale_account_number,
                    a12_code:                   '',
                    a47_code:                   '',
                    a48_code:                   '',
                    a50_code:                   '',
                    a52_code:                   '',
                    a53_code:                   '',
                    a54_code:                   '',
                    a56_code:                   '',
                    a57_code:                   '',
                    a59_code:                   pos_tuple.point_of_sale_customer_name,
                    version:                    schema.currentVersion,
                    organization:               caller.active_organization,
                    organization_description:   caller.active_organization_name,
                    active:                     'Y',
                    added_by_user_code:         '',
                    source:                     'service'
                }, function(err_insert, insert_result) {
                    if(err_insert != null) {
                        winston.error(err_insert);
                        callback();
                        return;
                    }

                    if(insert_result != null && insert_result.length > 0) {
                        pos_objects.push(insert_result[0]);
                        callback(null, insert_result[0]);
                        return;
                    }

                    callback();
                });
            });
        });
    });

    async.series(setup_functions, callback2);
}

function _ensureVisitsCreated(visits_tuples, caller, pos_objects, visit_objects, callback2) {

    // create a list of functions to run (1 per tuple)
    var setup_functions = [];

    _.each(visits_tuples, function(visit_tuple) {
        setup_functions.push(function(callback) {

            var pos = _.find(pos_objects, function(pos) {
                return pos.address1 == visit_tuple.point_of_sale_address &&
                    pos.city == visit_tuple.point_of_sale_city;
            });

            if(!pos) {
                winston.error('could not find pos for visit ' + visit_tuple.date_of_visit);
                callback();
                return;
            }

            var visit_query = {
                date_of_visit:      visit_tuple.date_of_visit,
                pos_id:             pos._id.toHexString(),
                store_check_id:     visit_tuple.storecheck_id,
                organization:       caller.active_organization
            };

            // if we have a matching visit in our cache, move on to the next visit
            var visit_cached = _.findWhere(visit_objects, visit_query);
            if(visit_cached) {
                callback();
                return;
            }

            VisitModule.collection.findOne(visit_query, function(err_find_visit, visit) {
                if(visit) {
                    visit_objects.push(visit);
                    callback(null, visit);
                    return;
                }

                VisitModule.collection.insert({
                    date_of_visit:      visit_tuple.date_of_visit,
                    pos_id:             pos._id.toHexString(),
                    pos_name:           visit_tuple.point_of_sale_company,
                    store_check_id:     visit_tuple.storecheck_id,
                    last_update_time:   formatter.getCurrentUtcTimeString(),
                    creation_time:      formatter.getCurrentUtcTimeString(),
                    samples:            [],
                    state:             "draft",
                    organization:       caller.active_organization,
                    auditor_name:       visit_tuple.auditor_name,
                    version:            schema.currentVersion
                }, function(err_visit, visit_result) {
                    if(err_visit != null) {
                        winston.error(err_visit);
                        callback();
                        return;
                    }
                    if(visit_result != null && visit_result.length > 0) {
                        visit_objects.push(visit_result[0]);
                        callback(null, visit_result[0]);
                        return;
                    }
                    callback();
                });
            });
        });
    });

    async.series(setup_functions, callback2);
}

// processes a series of parsed lines, presumably from the same file
function _processCSVImportLines(req, res, caller, line_data, samples_created, samples_updated, warnings, callback2) {

    // TODO: perhaps limit to 3000 samples or so in a single import to make sure we don't run out of memory?

    var points_of_sale_tuples = [], visits_tuples = [];

    // go through lines, filter erroneous lines and pick out any POS's and visits that are to be created
    line_data = _processAndFilterSampleIDs(line_data, warnings);
    line_data = _processAndFilterVisitDates(line_data, warnings);
    line_data = _processPOSRecords(line_data, points_of_sale_tuples, warnings);
    line_data = _processVisitRecords(line_data, visits_tuples, warnings);
    _processBestByDates(line_data, warnings);

    // so, we now have some idea which points of sale need to be created, and which visits need to be created
    var setup_functions = [];
    var pos_objects = [];
    var visit_objects = [];

    // create the points of sale we'll be using
    setup_functions.push(function(callback) {
        _ensurePOSItemsCreated(points_of_sale_tuples, caller, pos_objects, function(err_pos) {
            callback(err_pos);
        });
    });

    // create the visits we'll be using
    setup_functions.push(function(callback) {
        _ensureVisitsCreated(visits_tuples, caller, pos_objects, visit_objects, function(err_pos) {
            callback(err_pos);
        });
    });

    // create/update the samples, with the proper answers
    _.each(line_data, function(line_data_item, line_index) {
        setup_functions.push(function(callback) {

            // get point of sale from cache
            var pos = _.find(pos_objects, function(pos) {
                return pos.address1 == line_data_item.point_of_sale_address &&
                    pos.city == line_data_item.point_of_sale_city;
            });
            if(!pos) {
                winston.error('could not find pos for sample');
                warnings.push('line ' + (line_index + 1) + ' was not processed, because the specified point of sale was not found');
                callback();
                return;
            }

            // get visit
            var visit_record = _.find(visit_objects, function(visit) {
                return visit.pos_id == pos._id.toHexString() &&
                    visit.date_of_visit == line_data_item.date_of_visit &&
                    visit.store_check_id == line_data_item.storecheck_id;
            });
            if(!visit_record) {
                winston.error('could not find visit for pos');
                warnings.push('line ' + (line_index + 1) + ' was not processed, because the specified point of sale was not found');
                callback();
                return;
            }

            var stored_name = parseInt(line_data_item.sample_id);
            if(isNaN(stored_name)) {
                stored_name = line_data_item.sample_id;
            }

            SampleModule.collection.findOne({
                name: stored_name,
                visit_id: visit_record._id.toHexString()
            }, function(err_sample, sample_by_name) {
                if(err_sample) {
                    winston.error('could not find sample for visit by name: ' + err_sample);
                    warnings.push('line ' + (line_index + 1) + ' was not processed, because sample for visit by name was not found');
                    callback();
                    return;
                }

                // if sample exists, update
                if(sample_by_name) {
                    OrganizationModule.findOneById(sample_by_name.organization, function(err_organization, organization) {
                        if(err_organization) {
                            winston.error('failed to get organization for sample sample: ' + err_organization);
                            warnings.push('line ' + (line_index + 1) + ' was not processed, because organization could not be retreived');
                            callback();
                            return;
                        }

                        // apply the 1s and 0s from the file to this sample's questions/answers
                        _fillInAnswers(sample_by_name.questions, line_data_item.answers);

                        // merge the sample with itself so things like conformance and temperature conformance are processed
                        SampleModule.processSampleConformances(sample_by_name, organization.settings);

                        // set properties in visit_info here
                        //sample_by_name.visit_info.auditor_name = line_data_item.auditor_name;

                        // fire off the update
                        SampleModule.collection.update(
                            {
                                _id: sample_by_name._id
                            },
                            {
                                $set: {
                                    questions: sample_by_name.questions,
                                    non_conform: sample_by_name.non_conform,
                                    alerts: sample_by_name.alerts,

                                    // TODO: make sure all properties we care about are set
                                    batch_code: line_data_item.batch_code,
                                    note: line_data_item.note
                                    //visit_info: sample_by_name.visit_info
                                }
                            }, function(err_sample) {
                                if(err_sample) {
                                    winston.error('failed to update sample: ' + err_sample);
                                    warnings.push('line ' + (line_index + 1) + ' was not processed, because sample failed during update: ' + err_sample);
                                } else {
                                    samples_updated.push(sample_by_name._id.toHexString());
                                }

                                callback();
                            }
                        );
                    });
                    return;
                }

                // find the product_id for the product_code of this item, and use the template_id
                Common.getStaticList('products', ProductModule, {code: line_data_item.product_code}, function(err, products) {

                    var product_id = products[0]._id.toHexString();

                    var sample_references = {
                        product_id: product_id,
                        visit_id: visit_record._id.toHexString(),
                        template_id: line_data_item.template_id
                    };

                    if(line_data_item.factory.trim().length > 0) {
                        sample_references.factory_code = line_data_item.factory;
                    }

                    if(line_data_item.production_line.trim().length > 0) {
                        sample_references.production_line_code = line_data_item.production_line;
                    }

                    SampleCreate.getCreateSampleDependencies(req, res, sample_references, function(err_deps, deps) {
                        _fillInAnswers(deps.questions, line_data_item.answers);

                        var base_sample_data = {
                            best_by_date: line_data_item.best_by,
                            name: stored_name,
                            batch_code: line_data_item.batch_code,
                            note: line_data_item.note
                        };

                        SampleCreate.rawCreateSample(req, res, base_sample_data, deps, undefined, function(err_sample, sample) {
                            if(sample) {
                                samples_created.push(sample);
                            }
                            callback(err_sample, sample);
                        });
                    });
                });
            });
        });
    });

    async.series(setup_functions, callback2);
}

function _processAndFilterSampleIDs(line_data, warnings_out) {
    var still_valid_lines = [];

    // pluck out any lines with no sample id
    _.each(line_data, function(line_info) {
        if(line_info.sample_id.trim().length == 0) {
            warnings_out.push('Sample at line #' + (line_info.line_number + 1) + ' was not added, because no sample ID was defined.');
            return;
        }
        still_valid_lines.push(line_info);
    });

    return still_valid_lines;
}

// will remove any lines with incorrectly-specified date of visit info
function _processAndFilterVisitDates(line_data, warnings_out) {
    var still_valid_lines = [];

    // pluck out any lines with invalid date of visit
    _.each(line_data, function(line_info) {
        // ugh.  This is too lenient.  There's a cryptic reference to "parseTwoDigitYear" in the docs.
        var parsed_date = moment(line_info.date_of_visit.trim(), "DD-MM-YYYY");
        if(!parsed_date.isValid()) {
            warnings_out.push('Sample ' + line_info.sample_id + ' was not added, because the date of visit was not in dd-MM-yyyy format.');
            return;
        }
        line_info.date_of_visit = parsed_date.format('DD-MMM-YYYY');
        still_valid_lines.push(line_info);
    });

    return still_valid_lines;
}

// will provide a unique list of POS entries across all lines, and filter lines without adequate POS data
// expects warnings_in_out and points_of_sale_tuples_out to be allocated Arrays (does not assume them to be empty)
function _processPOSRecords(line_data, points_of_sale_tuples_out, warnings_in_out) {
    var still_valid_lines = [];

    _.each(line_data, function(line_info) {
        if(line_info.point_of_sale_address.trim().length == 0 || line_info.point_of_sale_city.trim().length == 0) {
            warnings_in_out.push('Sample ' + line_info.sample_id + ' was not added, because address, and city must be entered.');
            return;
        }
        var current_record = _.find(points_of_sale_tuples_out, function(tuple) {
            return tuple.point_of_sale_address == line_data.point_of_sale_address &&
                tuple.point_of_sale_city == line_data.point_of_sale_city;
        });
        if(_.isUndefined(current_record)) {
            points_of_sale_tuples_out.push(line_info);
        }
        still_valid_lines.push(line_info);
    });
    return still_valid_lines;
}

function _processVisitRecords(line_data, visits_tuples_out, warnings_in_out) {
    var still_valid_lines = [];

    _.each(line_data, function(line_info) {
        if(line_info.date_of_visit.trim().length == 0 || line_info.storecheck_id.trim().length == 0) {
            warnings_in_out.push(line_data.sample_id + ' was not added, because date of visit and storecheck_id must be entered.');
            return;
        }
        // we want to make sure visits are matched for the given POS
        var current_record = _.find(visits_tuples_out, function(tuple) {
            return tuple.point_of_sale_address == line_data.point_of_sale_address &&
                tuple.point_of_sale_city == line_data.point_of_sale_city &&
                tuple.date_of_visit == line_data.date_of_visit &&
                tuple.storecheck_id == line_data.storecheck_id;
        });
        if(_.isUndefined(current_record)) {
            visits_tuples_out.push(line_info);
        }
        still_valid_lines.push(line_info);
    });

    return still_valid_lines;
}

function _processBestByDates(line_data, warnings_in_out) {

    // report warnings for invalid best-by date
    _.each(line_data, function(line_info) {

        // ugh.  This is too lenient.  There's a cryptic reference to "parseTwoDigitYear" in the docs.
        var parsed_date = moment(line_info.best_by.trim(), ["DD-MM-YY", "DD-MM-YYYY"]);
        if(!parsed_date.isValid()) {
            warnings_in_out.push('[NON-FATAL] Sample ' + line_info.sample_id + ' had an invalid best-by date (was not in dd-MM-yyyy format).');
            return;
        }
        line_info.best_by = parsed_date.format('DD-MMM-YYYY');
    });
}

function _detectSeparator(line) {
    var separator = '\t';
    var line_items = line.split('\t');
    var csv_items = line.split(',');
    var ssv_items = line.split(';');
    if(csv_items.length > line_items.length) {
        line_items = csv_items;
        separator = ',';
    }
    if(ssv_items.length > line_items.length) {
        //line_items = ssv_items;
        separator = ';';
    }
    return separator;
}

function _fillInAnswers(questions, answers) {
    _.each(questions, function(question) {
        _.each(question.answers, function(sample_answer) {
            var answer_from_import = _.find(answers, function(answer) {
                return answer.code == sample_answer.code;
            });

            if(!_.isUndefined(answer_from_import)) {
                if(category_specific.getQuestionType(question.category_specific) == 'select') {
                    sample_answer.value = (answer_from_import.value == '1' ? 'true' : '');
                } else {
                    sample_answer.value = answer_from_import.value;
                }
            }
        });
    });
}

function _getDataFromLines(separator, headers, lines, index, line_data, callback2) {
    if(lines.length == 0) {
        callback2(null, line_data);
        return;
    }
    var line = lines.shift();
    _getDataFromLine(separator, headers, line, index, function(err_line, line_data_item) {
        if(!_.isUndefined(line_data_item)) {
            line_data.push(line_data_item);
        }
        _getDataFromLines(separator, headers, lines, index + 1, line_data, callback2);
    });
}

function _getDataFromLine(separator, headers, line, line_number, callback2) {

    csv().from.string(line, {delimiter: separator}).to.array(function(csv_data) {
        var line_items = csv_data[0];//line.split(separator),
        var token_index = 0;
        if (line_items.length > 23) {

            var data = {
                storecheck_name: line_items[token_index++],
                storecheck_id: line_items[token_index++],
                template_name: line_items[token_index++],
                template_id: line_items[token_index++],
                product_code: line_items[token_index++],
                point_of_sale_customer_name: line_items[token_index++],
                point_of_sale_company: line_items[token_index++],
                point_of_sale_address: line_items[token_index++],
                point_of_sale_country: line_items[token_index++],
                point_of_sale_state: line_items[token_index++],
                point_of_sale_city: line_items[token_index++],
                point_of_sale_postal_code: line_items[token_index++],
                point_of_sale_address_type: line_items[token_index++],
                point_of_sale_email: line_items[token_index++],
                point_of_sale_account_number: line_items[token_index++],
                date_of_visit: line_items[token_index++],
                auditor_name: line_items[token_index++],
                sample_id: line_items[token_index++],
                best_by: line_items[token_index++],
                factory: line_items[token_index++],
                production_line: line_items[token_index++],
                batch_code: line_items[token_index++],
                note: line_items[token_index++],
                line_number: line_number,
                answers: []
            };

            for (; token_index < line_items.length; token_index++) {
                data.answers.push({
                    code: headers[token_index].trim(),
                    value: line_items[token_index].trim()
                });
            }

            callback2(null, data);

        } else {
            winston.log('warn', 'while importing sample file, line ' + (line_number + 1) + ' (1-indexed) did not have enough records to parse');
            callback2(); // just a warning
        }
    });
}
