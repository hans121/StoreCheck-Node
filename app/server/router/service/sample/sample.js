var _ = require('underscore');
var async = require('async');
var AWS = require('aws-sdk');
var config = require('config');
var fs = require('fs');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var ActionAuditModule = require('../../../modules/action-audit');
var Common = require('../../router-common');
var FactoryModule = require('../../../modules/model/hierarchy/factory');
var OrganizationModule = require('../../../modules/model/organization');
var ProductModule = require('../../../modules/model/hierarchy/product');
var ProductionLineModule = require('../../../modules/model/hierarchy/production-line');
var SampleCreate = require('./sample-create');
var SampleModule = require('../../../modules/model/sample');
var StoreCheckModule = require('../../../modules/model/store-check');
var VisitModule = require('../../../modules/model/visit');
var VisitReportsModule = require('../../../modules/model/visit-reports');

var category_specific = require('../../../modules/category-specific');
var dynamic_config = require('../../../modules/dynamic-config');
var excipio_export = require('../../../modules/excipio/excipio-export');
var formatter = require('../../../modules/view-formatter');
var nodeUtils = require('../../../modules/node-utils');
var schema = require('../../../modules/model/schema/schema');

module.exports = function(app) {

    // === IMAGE MANAGEMENT

    // Specifies which (already-uploaded) image urls are to be used for a given question
    //
    // Error conditions:
    //     - Caller isn't authorized to update the sample
    //     - Sample state is "released"
    //     - A sample id was not provided
    //     - No sample could be found for the given sample id
    //     - A question id was not provided
    //
    // Notes:
    //     - if the specified question id is not found, it is not an error
    //     - the urls are not validated
    Common.addHandler(app, 'post', '/sample/:id/question/:qid/image_url', _handleAssociateImages);

    // Removes reference to which images are to be used for a given question
    // original image content remains on server
    //
    // Error conditions:
    //     - Caller isn't authorized to update the sample
    //     - Sample state is "released"
    //     - A sample id was not provided
    //     - No sample could be found for the given sample id
    //     - A question id was not provided
    //
    // Notes:
    //     - if the specified question id is not found, it is not an error
    Common.addHandler(app, 'delete', '/sample/:id/question/:qid/image_url', _handleDeleteImageAssociation);

    // Uploads images, but does not associate them with the question or sample
    //
    // Error conditions:
    //     - Image file can't be read
    //     - An error occurred while uploading to Amazon
    //
    // Notes:
    //     -
    // TODO: this should probably move elsewhere, as it's not part of the sample resource (other than for permissions)
    Common.addHandler(app, 'post', '/sample/images', _handleUploadImages);

    // === CREATE SAMPLE

    // Creates a sample from a request that is validated by the create sample schema
    // associates the sample with the specified visit and specified product
    //
    // Error conditions:
    //     - Request body is invalid according to schema definition
    //     - The specified visit does not exist
    //     - The specified product does not exist
    //
    // Query params:
    //     - metacopy (optional) - a sample id whose metadata (batch code, etc - but not questions) are to be copied
    //
    // Notes:
    //     - The created sample will have the same organization as the caller
    //     - The created sample will have state = "draft"
    //     - If metacopy is specified, it will attempt to load the supplied id.  If batch_code, best-by-date, factory,
    //       or production line is provided in the request body (and length > 0), it takes precendence over the metacopy value.
    Common.addHandler(app, 'post', '/sample', _handleCreateSample);

    // === SAMPLE ANSWER UPDATE

    // Answers a specified question for a group of samples
    //
    // Error conditions:
    //     - Caller isn't authorized to update the sample
    //     - No sample could be found for the given sample id
    //     - A question id was not provided
    //
    // Notes:
    //     - If the state of any sample is "released", it is not changed
    //     - the body is very loosely validated
    // TODO: validate request more
    Common.addHandler(app, 'post', '/sample/answer', _handleAnswerQuestion);

    // === UPDATE SAMPLE

    // Updates a sample
    //
    // Error conditions:
    //     - Caller isn't authorized to update the sample
    //     - The sample id is not of a valid format
    //     - A state of any sample is "released"
    //     - No sample could be found for the given sample id
    //     - The request was rejected during schema validation
    Common.addHandler(app, 'post', '/sample/:id', _handleUpdateSample);

    // Updates a single field of a sample
    //
    // Error conditions:
    //     - Caller isn't authorized to update the sample
    //     - See RouterCommon.getByIdIfAuthorized (for sample)
    //     - The state of the sample is "released"
    //     - The field was not a valid option
    Common.addHandler(app, 'post', '/sample/:id/:field', _handleUpdateSampleField);

    // === STATE MANAGEMENT

    // Updates the state of a list of samples
    //
    // Error conditions:
    //     - Caller isn't authorized to update samples
    //     - No id list was provided
    //     - No "destination" state value was provided
    //     - At least one sample id was not of a valid format
    //
    // Notes:
    //     - Any sample with the state "released" will not have its state changed, but no error will be thrown
    //     - All samples in the list will be part of an immediate Excipio export
    Common.addHandler(app, 'post', '/samples/:idList/state', _handleUpdateStateOfSamples);

    // === SAMPLE DELETION

    // Deletes a non-released sample, and removes it from any visits it is associated with
    //
    // Error conditions:
    //     - Caller isn't authorized to delete samples
    //     - No id was provided
    //     - The provided id was not of a valid format
    //     - The specified sample was released
    Common.addHandler(app, 'delete', '/sample/:id', _handleDeleteSample);

    // Deletes a list of samples, and removes each from any visits they are associated with
    //
    // Error conditions:
    //     - Caller isn't authorized to delete samples
    //     - No id list was provided
    //     - Any provided sample id was not of a valid format
    //     - No samples were part of a visit (confirm)
    //
    // Notes:
    //     -
    Common.addHandler(app, 'delete', '/samples/:idList', _handleDeleteSamples);

    // Gets a sample by id
    //
    // Error conditions:
    //     - See Common.getResourceById
    Common.addHandler(app, 'get', '/sample/:id', function(req, res) {
        Common.getResourceById(req, res, 'get', '/sample/:id', 'sample', SampleModule);
    });

    // Gets a bunch of samples by id
    //
    // Error conditions:
    //     - See Common.getResourceById
    Common.addHandler(app, 'get', '/samples/:idList', _handleSampleList);

    // Gets all samples visible to the current user
    //
    // Error conditions:
    //     - See Common\.getResourceById
    Common.addHandler(app, 'get', '/samples', _handleSampleList);


    // Gets all distinct values of a certain property for all samples visible to the current user
    // Note: I think this was developed early, and never used?
    //
    // Error conditions:
    //     - See Common.getResourceById
    Common.addHandler(app, 'get', '/samples/property/:property', _handleSamplePropertyList);

    /*
    // Get a sample list by ids
    //
    // TODO: Add more error conditions and test
    // Error conditions:
    //     - See Common.getByIdsIfAuthorized
    Common.addHandler(app, 'get', '/sample/:idList', function(req, res) {
        var idList = req.param('idList');
        if(_.isUndefined(idList)) {
           Common.serviceErrorCallbacks.on500(req, res, Common.getInvalidIdMessage());
            return;
        }

        Common.getByIdsIfAuthorized(req, res, idList.split(','), 'sample', SampleModule, Common.viewErrorCallbacks, function(samples) {
            res.send(samples, 200);
        });
    });
    */
};

// === REQUEST HANDLERS

function _handleCreateSample(req, res) {
    Common.ensureHasAccess(req, res, 'sample', 'c', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var validation = schema.validate(req.body, schema.createSampleSchema);
        if(validation.errors.length > 0) {
            winston.log('warn', 'a POST /sample/create request from user=' + caller.name + ' had validation errors: ' + JSON.stringify(validation.errors));
            Common.pushMessage(req, 'error', 'Failed to create sample because the request had format errors');
            res.send(validation.errors, 500);
            return;
        }

        SampleCreate.getCreateSampleDependencies(req, res, req.body, function(err_deps, deps) {
            if(err_deps) {
                res.send(err_deps, 500);
                return;
            }

            SampleCreate.rawCreateSample(req, res, req.body, deps, req.query['metaCopyTarget'], function(err, sample_id) {

                // update reports for the visits for these samples
                setTimeout(function() {
                    VisitReportsModule.generateReportsForSamples([ObjectId(sample_id)], function(err_generate) {});
                }, 0);

                res.send(sample_id, 200);
            });
        });
    });
}

function _handleUpdateSample(req, res) {
    Common.ensureHasAccess(req, res, 'sample', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var validation = schema.validate(req.body, schema.updateSampleSchema);
        if(validation.errors.length > 0) {
            winston.log('warn', 'a POST /sample/:id request from user=' + caller.name + ' had validation errors: ' + JSON.stringify(validation.errors));
            Common.pushMessage(req, 'error', 'Failed to update sample because the request had format errors');
            res.send(validation.errors, 500);
            return;
        }

        var id = req.param('id');
        if(!nodeUtils.isValidId(id)) {
            Common.serviceErrorCallbacks.on500(req, res, Common.getInvalidIdMessage());
            return;
        }

        var data = req.body;

        var tasks = [], factory, production_line;
        tasks.push(function(callback) {
            if(nodeUtils.isValidId(data.factory_id)) {
                FactoryModule.findOneById(data.factory_id, function(req, factory_result) {
                    factory = factory_result;
                    callback();
                });
            } else {
                factory = null;
                callback();
            }
        });
        tasks.push(function(callback) {
            if(nodeUtils.isValidId(data.production_line_id)) {
                ProductionLineModule.findOneById(data.production_line_id, function(req, production_line_result) {
                    production_line = production_line_result;
                    callback();
                });
            } else {
                production_line = null;
                callback();
            }
        });
        tasks.push(function(callback) {
            Common.getOrganizationSettings(req, caller, function(organization_settings) {
                SampleModule.mergeQuestions(id, data.questions, organization_settings, function(err, questions, sample) {
                    if(questions) {
                        var unset_values = {};

                        var values = {
                            name:                   data.name,
                            best_by_date:           formatter.formatDate(data.best_by_date),
                            batch_code:             data.batch_code,
                            questions:              questions,
                            non_conform:            sample.non_conform,
                            alerts:                 sample.alerts,
                            note:                   (typeof(data.note) == 'undefined' ? '' : data.note),
                            update_time:            formatter.getCurrentUtcTimeString(),
                            version:                schema.currentVersion,
                            image_count:            SampleModule.getImageCount(sample)
                        };
                        if(typeof(factory) != 'undefined' && factory != null) {
                            values.factory_id = data.factory_id;
                            values.factory_code = factory.code;
                        } else {
                            unset_values.factory_id = 1;
                            values.factory_code = '';
                        }
                        if(typeof(production_line) != 'undefined' && production_line != null) {
                            values.production_line_code = production_line.code;
                            values.production_line_id = data.production_line_id;
                        } else {
                            unset_values.production_line_id = 1;
                            values.production_line_code = '';
                        }

                        // attempt to get the int representation of the name, if able
                        try {
                            var name_as_int = parseInt(values.name);
                            if(!isNaN(name_as_int)) {
                                values.name = name_as_int;
                            }
                        } catch(ex) {}

                        var update_clause = {
                            $set: values
                        };

                        if(_.keys(unset_values).length > 0) {
                            update_clause['$unset'] = unset_values
                        }

                        SampleModule.update({
                            query: { _id : ObjectId(id), state: { $ne: "released" } },
                            value: update_clause
                        }, function(count) {
                            if(count) {

                                // update reports for the visit for this sample
                                setTimeout(function() {
                                    VisitReportsModule.generateReportsForSamples([ObjectId(id)], function(err_generate) {});
                                }, 0);

                                ActionAuditModule.report(caller, 'update', 'sample', 'sample ' + sample.name + ' for visit ' + sample.visit_info.pos_name + ' ' + sample.visit_info.date_of_visit);
                                winston.log('debug', 'a POST /sample/' + id + ' request from user=' + caller.name + ' has succeeded');
                                Common.pushMessage(req, 'success', 'Successfully updated sample');
                                res.send(count, 200);
                            } else{
                                winston.log('warn', 'a POST /sample/' + id + ' request from user=' + caller.name + ' failed');
                                Common.pushMessage(req, 'error', 'Failed to update sample');
                                Common.serviceErrorCallbacks.on500(req, res, 'Failed to update /sample/' + id);
                            }
                            callback();
                        });
                    } else {
                        winston.log('warn', 'a POST /sample request from user=' + caller.name + ' failed, message=' + err);
                        Common.serviceErrorCallbacks.on500(req, res, err);
                        callback();
                    }
                });
            });
        });
        async.series(tasks);
    });
}

function _handleUpdateSampleField(req, res) {
    Common.ensureHasAccess(req, res, 'sample', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);
        Common.getByIdIfAuthorized(req, res, req.param('id'), 'sample', SampleModule, Common.serviceErrorCallbacks, function(sample) {
            if(sample.state == 'released') {
                Common.serviceErrorCallbacks.on500(req, res, 'cannot edit released sample');
                return;
            }

            var fields = ['batch_code', 'note'];
            var field = req.param('field');
            if(!field || field.length == 0) {
                Common.serviceErrorCallbacks.on500(req, res, 'a field must be specified');
                return;
            }

            if(fields.indexOf(field) == -1) {
                Common.serviceErrorCallbacks.on500(req, res, 'invalid field specified');
                return;
            }

            if(typeof(req.param('value')) == 'undefined') {
                Common.serviceErrorCallbacks.on500(req, res, 'a value must be specified');
                return;
            }

            var update_values = {};
            update_values[field] = req.param('value');
            SampleModule.update({
                query: { _id : sample._id, state: { $ne: "released" } },
                value: {
                    $set: update_values
                }
            }, function(count) {
                if(count) {

                    // update reports for the visit for this samples
                    setTimeout(function() {
                        VisitReportsModule.generateReportsForSamples([sample._id], function(err_generate) {});
                    }, 0);

                    ActionAuditModule.report(caller, 'update', 'sample', field + ' of sample ' + sample.name + ' for visit ' + sample.visit_info.pos_name + ' ' + sample.visit_info.date_of_visit);
                    winston.log('debug', 'a POST /sample/' + sample._id + '/:field request from user=' + caller.name + ' has succeeded');
                    Common.pushMessage(req, 'success', 'Successfully updated sample');
                    res.send(count, 200);
                    return;
                }
                winston.log('warn', 'a POST /sample/' + sample._id + '/:field request from user=' + caller.name + ' failed');
                Common.pushMessage(req, 'error', 'Failed to update sample');
                Common.serviceErrorCallbacks.on500(req, res, 'Failed to update /sample/' + sample._id + '/:field');
            });
        });
    });
}

function _handleUpdateStateOfSamples(req, res) {
    Common.ensureHasAccess(req, res, 'sample/state', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var value = req.param('value');
        var idList = req.param('idList');

        // we require a list of ids to update
        if(!idList) {
            winston.log('error', 'a POST /visit/release request from user=' + caller.name + ' failed because no sample ids were provided');
            Common.pushMessage(req, 'error', 'Failed to update states for samples.  An id list was not provided');
            Common.serviceErrorCallbacks.on500('An id list must be provided', 500);
            return;
        }

        // we require a state to set
        if(!value) {
            winston.log('error', 'a POST /visit/release request from user=' + caller.name + ' failed because no state was provided');
            Common.pushMessage(req, 'error', 'Failed to update states for samples.  A state was not provided');
            Common.serviceErrorCallbacks.on500('A value must be provided', 500);
            return;
        }

        // convert the id list string to individual ids
        var idArray = idList.split(',');

        // check each id for validity
        var each_id_valid = _.every(idArray, function(id) { return nodeUtils.isValidId(id); });
        if(!each_id_valid) {
            Common.pushMessage(req, 'error', 'Failed to update states for samples.  A provided sample id is not valid');
            Common.serviceErrorCallbacks.on500('Provided id is not valid', 500);
            return;
        }

        // get the ids as ObjectIds
        var objectIdArray = idArray.map(function(id) { return ObjectId(id); });

        // start building a query to further tighten the scope of samples to be updated
        var additionalQuery = {};

        // allow changes to released samples only if the user can revert, and if the value is to be 'to-be-corrected'
        if(!(Common.userHasAccess(caller, 'sample/state/revert', 'c') && value == 'to-be-corrected')) {
            additionalQuery = { state: {$ne: "released"} };
        }

        SampleModule.updateStates(objectIdArray, additionalQuery, value,  formatter.getCurrentUtcTimeString(), caller.user, function(e, doc_count) {
            if(e || !doc_count) {
                Common.pushMessage(req, 'error', 'Failed to update states for samples.  No records were updated');
                Common.serviceErrorCallbacks.on500(req, res, 'All 111: Failed to update state of samples ' + idArray + ' at ' + formatter.getCurrentUtcTimeString() + ' please report this to the development team');
                return;
            }

            // update reports for the visits for these samples
            setTimeout(function() {
                VisitReportsModule.generateReportsForSamples(objectIdArray, function(err_generate) {});
            }, 0);

            // check the dynamic configuration to see if this state change results in an export to excipio
            dynamic_config.getSampleStatesCausingExport(function(err_config, states_causing_export) {
                if(err_config) {
                    res.send('an error occurred while retrieving config: ' + err_config, 500);
                    return;
                }

                // check to see if this state is in the set of states that cause exports
                if(states_causing_export.indexOf(value) != -1) {
                    ActionAuditModule.report(caller, 'update', 'sample/state', idArray + ' released');
                    winston.log('debug', 'a POST /samples/:idList/state?value=released request from user=' + caller.name + ' succeeded for ' + idArray.length + ' samples');
                    Common.pushMessage(req, 'success', 'Successfully released samples');

                    // fire off the export
                    nodeUtils.runInBackground(function() {
                        excipio_export.exportSamples(idArray, caller.user, function(err) { // , success
                            if(!err) {
                                winston.info('enqueueing of visit exports for released samples complete');
                                return;
                            }
                            winston.error('an error occurred when exporting released samples: ' + err);
                        });
                    });

                    res.send({result: 'ok'}, 200);
                    return;
                }

                // no export was needed - pass along the good news about the updates
                ActionAuditModule.report(caller, 'update', 'sample/state', 'state = ' + value + ' for ' + idArray);
                winston.log('debug', 'a POST /samples/:idList/state request from user=' + caller.name + ' succeeded');
                Common.pushMessage(req, 'success', 'Successfully updated states for samples');
                res.send({result: 'ok'}, 200);
            });
        });
    });
}

function _handleDeleteSample(req, res) {
    Common.ensureHasAccess(req, res, 'sample', 'd', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var id = req.param('id');
        Common.getByIdIfAuthorized(req, res, id, 'sample', SampleModule, Common.serviceErrorCallbacks, function(sample) {
            VisitModule.removeSamplesFromVisits([id], function(e) {
                if(e != null) {
                    winston.log('warn', 'a DELETE /sample/:id request from user=' + caller.name + ' failed, message=' + e);
                    Common.pushMessage(req, 'error', 'Failed to delete sample');
                    res.send(e, 400);
                    return;
                }

                SampleModule.deleteSamples([id], function(err_delete, delete_count) {
                    if(err_delete || !delete_count) {
                        winston.log('error', 'a DELETE /sample/:id request from user=' + caller.name + ' failed');
                        Common.pushMessage(req, 'error', 'Failed to delete sample');
                        res.send('Failed to delete sample', 400);
                        return;
                    }

                    // update reports for the visits for these samples
                    setTimeout(function() {
                        VisitReportsModule.generateReportsForSamples([sample._id], function(err_generate) {});
                    }, 0);

                    ActionAuditModule.report(caller, 'delete', 'sample', sample.name + ' from visit ' + sample.visit_info.pos_name + ' ' + sample.visit_info.date_of_visit);
                    winston.log('debug', 'a DELETE /sample/:id request from user=' + caller.name + ' has succeeded');
                    Common.pushMessage(req, 'success', 'Deleted sample');
                    res.send({result: 'ok'}, 200);
                });
            });
        });
    });
}

function _handleDeleteSamples(req, res) {
    Common.ensureHasAccess(req, res, 'sample', 'd', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var idList = req.param('idList');
        if(idList == null) {
            Common.pushMessage(req, 'error', 'Failed to delete samples, because no id list was provided');
            res.send('no id list was provided', 500);
            return;
        }

        var idArray = idList.split(',');
        for(var i=0; i<idArray.length; i++) {
            if(!nodeUtils.isValidId(idArray[i])) {
                winston.log('error', 'a DELETE /samples/:idList request from user=' + caller.name + ' has failed because id ' + idArray[i] + ' is not valid');
                Common.pushMessage(req, 'error', 'Failed to delete samples, because sample id ' + idArray[i] + ' is not valid');
                Common.serviceErrorCallbacks.on500('ID ' + idArray[i] + ' is not valid', 500);
                return;
            }
        }

        VisitModule.removeSamplesFromVisits(idArray, function(e) { // ,remove_result
            if(e != null) {
                winston.log('warn', 'a DELETE /samples/:idList request from user=' + caller.name + ' failed, message=' + e);
                Common.pushMessage(req, 'error', 'Failed to delete samples');
                Common.serviceErrorCallbacks.on500(req, res, 'Failed to remove samples from visits');
                return;
            }

            SampleModule.deleteSamples(idArray, function(error_delete) {
                if(error_delete) {
                    winston.log('warn', 'a DELETE /samples/:idList request from user=' + caller.name + ' failed');
                    Common.pushMessage(req, 'error', 'Failed to delete samples');
                    Common.serviceErrorCallbacks.on500(req, res, 'Failed to delete one or more samples');
                    return;
                }

                // update reports for the visits for these samples
                setTimeout(function() {
                    VisitReportsModule.generateReportsForSamples(idArray, function(err_generate) {});
                }, 0);

                ActionAuditModule.report(caller, 'delete', 'sample', idArray);
                winston.log('debug', 'a DELETE /samples/:idList request from user=' + caller.name + ' has succeeded');
                Common.pushMessage(req, 'success', 'Successfully deleted samples');
                res.send({result: 'ok'}, 200);
            });
        });
    });
}

function _handleAssociateImages(req, res) {
    Common.ensureHasAccess(req, res, 'sample', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.getByIdIfAuthorized(req, res, req.param('id'), 'sample', SampleModule, Common.serviceErrorCallbacks, function(sample) {
            if(sample.state == 'released') {
                Common.pushMessage(req, 'error', 'Cannot update released sample');
                Common.serviceErrorCallbacks.on500(req, res, 'Cannot update released sample');
                return;
            }

            var qid = req.param('qid'), sid = req.param('id');
            if(qid == null) {
                winston.log('warn', 'failed processing a POST /sample/:id/question/:qid/image_url request from user=' + caller.name + ' because no question id was provided');
                Common.pushMessage(req, 'error', 'Failed to delete image from question because no question id was provided');
                Common.serviceErrorCallbacks.on500(req, res, 'No question id provided');
                return;
            }

            for(var i=0; i<sample.questions.length; i++) {
                if(sample.questions[i].identity_id == qid) {
                    sample.questions[i].image_urls = [req.body.url];
                    break;
                }
            }

            SampleModule.update({
                query: { _id : ObjectId(sid) },
                value: {
                    $set: {
                        questions: sample.questions,
                        image_count: SampleModule.getImageCount(sample),
                        image_update_time: formatter.getCurrentUtcTimeString()
                    }
                }
            }, function(count) { //, result
                if(count) {
                    ActionAuditModule.report(caller, 'associate', 'sample/image', 'question ' + qid + ' for sample ' + sid);
                    Common.pushMessage(req, 'success', 'Successfully uploaded image');
                    res.send({result: 'ok'}, 200);
                    return;
                }
                Common.pushMessage(req, 'error', 'Failed to uploaded image');
                Common.serviceErrorCallbacks.on500(req, res, 'Failed to update question');
            });
        });
    });
}

function _handleDeleteImageAssociation(req, res) {
    Common.ensureHasAccess(req, res, 'sample', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.getByIdIfAuthorized(req, res, req.param('id'), 'sample', SampleModule, Common.serviceErrorCallbacks, function(sample) {
            if(sample.state == 'released') {
                Common.pushMessage(req, 'error', 'Cannot update released sample');
                Common.serviceErrorCallbacks.on500(req, res, 'Cannot update released sample');
                return;
            }
            var qid = req.param('qid'), sid = req.param('id');
            if(qid == null) {
                winston.log('warn', 'failed processing a POST /sample/images request from user=' + caller.name + ' because no question id was provided');
                Common.pushMessage(req, 'error', 'Failed to delete image from question because no question id was provided');
                Common.serviceErrorCallbacks.on500(req, res, 'no question id provided');
                return;
            }

            for(var i=0; i<sample.questions.length; i++) {
                if(sample.questions[i].identity_id == qid) {
                    sample.questions[i].image_urls = [];
                    break;
                }
            }

            SampleModule.update({
                query: { _id : ObjectId(sid) },
                value: {
                    $set: {
                        questions: sample.questions,
                        image_count: SampleModule.getImageCount(sample),
                        image_update_time: formatter.getCurrentUtcTimeString()
                    }
                }
            }, function(update_count) { //, result
                if(update_count) {
                    ActionAuditModule.report(caller, 'delete', 'sample/image', 'question ' + qid + ' for sample ' + sid);
                    Common.pushMessage(req, 'success', 'Successfully deleted image from question');
                    res.send({result: 'ok'}, 200);
                } else {
                    Common.pushMessage(req, 'error', 'Failed to delete image from question');
                    Common.serviceErrorCallbacks.on500(req, res, 'failed to delete image from question ' + qid + ' for sample ' + sample._id.toHexString());
                }
            });
        });
    });
}

function _handleUploadImages(req, res) {
    Common.ensureHasAccess(req, res, 'sample', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        // function that generates a random string id of numbers that is unlikely to collide with anything:
        var genSnowflake = function(id_seed) {
            var pad = function(val, n) {
                var s = val.toString();
                while (s.length < n) { s = '0' + s; }
                return s;
            };
            var d = new Date();
            var id = '1';

            id += pad(d.getMilliseconds(), 3);
            id += pad(d.getSeconds(), 2);

            var dateSum = d.getFullYear() + d.getMonth() + d.getDay();
            id += (dateSum * 5);

            if(typeof(id_seed) != 'undefined') {
                id += id_seed;
            } else {
                id += '1';
            }

            return id;
        };

        var result = { urlMap: [], status: 'ok' };

        dynamic_config.findOne({key: 'aws'}, function(err, aws_config) {
            if(err) {
                res.send(err, 500);
                return;
            }
            if(aws_config == null) {
                res.send('could not load AWS configuration');
                return;
            }

            var s3Uploads = [];

            // Make list of S3 uploads
            var processed_count = 1;
            _.each(req.files, function(image_upload, index) {
                var image = req.files[index];

                // gen some kind of sweet snowflake name for image so it can live on server peacefully
                var serverFileName = '';
                {
                    var nameTokens = image.filename.split('.');
                    if (nameTokens.length == 0) {
                        return;
                    }
                    var extension = nameTokens[nameTokens.length - 1];
                    serverFileName = genSnowflake((processed_count) + '') + '.' + extension;
                    processed_count++;
                }

                s3Uploads.push({ imageName: index, image: image, serverFileName: serverFileName });
            });

            var completedUploads = 0;

            // send response after all work is done
            var syncResponseSending = function() {
                if (completedUploads < s3Uploads.length) return;
                res.send(result);
            };

            _.each(s3Uploads, function(s3Call) {

                // copy image over to S3
                var bucket = 'store_check';
                var key = 'images/'  + s3Call.serverFileName; // key gets the actual file name?

                var s3 = new AWS.S3();
                winston.log('debug', 'while handling POST /sample/images, reading temp file');

                fs.readFile(s3Call.image.path, function (errr, fileData) {

                    winston.log('debug', 'while handling POST /sample/images, putting object');
                    var params = { Bucket: bucket, Key: key, Body: fileData };
                    var imageName = s3Call.imageName;

                    s3.putObject(params, function(err) { //, data
                        if(err) {
                            winston.log('error', 'while handling POST /sample/images, an error occurred: ' + err);
                        } else {

                            var imageUrl = aws_config.values.RootURL + key;
                            ActionAuditModule.report(caller, 'create', 'image', imageUrl);
                            result.urlMap.push({ name: imageName, url: imageUrl });
                            winston.log('info', 'while handling POST /sample/images, completed upload to ' + imageUrl);
                        }
                        // Once all S3 uploads are completed (successful or not), send response back to client
                        completedUploads++;
                        syncResponseSending();
                    });
                });
            });

            syncResponseSending();
        });
    });
}

function _handleAnswerQuestion(req, res) {
    Common.ensureHasAccess(req, res, 'sample', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var data = {
            question_id: req.param('question_id'),
            answers: req.param('answers')
        };

        if(data.question_id == undefined) {
            Common.serviceErrorCallbacks.on500(req, res, 'no question id was provided');
            return;
        }

        if(!data.answers) {
            Common.serviceErrorCallbacks.on500(req, res, 'no answers were provided');
            return;
        }

        // go through the questions, find matching answers in the req.body.
        // update answers where they match, then push update for each sample
        var sample_ids = _.pluck(data.answers, 'sample_id');
        var sampleUpdateErrors = [], sampleUpdateMessages = [], sampleUpdateSuccesses = [];
        SampleModule.listByIds(sample_ids, Common.queryResultHandler(req, res, Common.serviceErrorCallbacks, function(samples) {
            var samples_to_answer = _.filter(samples, function(sample) {
                return (sample.state != 'released');
            });
            if(samples_to_answer.length == 0) {
                Common.serviceErrorCallbacks.on500(req, res, 'no samples were eligible for answers');
                return;
            }

            // NOTE: assumes samples are from same organization
            OrganizationModule.findOneById(samples_to_answer[0].organization, function(err, organization) {
                SampleModule.answerQuestionInSamples(data, samples_to_answer, sampleUpdateErrors, sampleUpdateSuccesses, sampleUpdateMessages, organization.settings, function() {

                    // push messages - TODO: only the first message should be pushed?
                    sampleUpdateMessages.forEach(function(message) {
                        Common.pushMessage(req, message.type, message.message);
                    });

                    // update reports for the visits for these samples
                    setTimeout(function() {
                        VisitReportsModule.generateReportsForSamples(sample_ids, function(err_generate) {});
                    }, 0);

                    if(sampleUpdateErrors.length == 0) {
                        winston.log('debug', 'a POST /sample/answer request from user=' + caller.name + ' has succeeded');
                        ActionAuditModule.report(caller, 'update', 'sample/answer', sampleUpdateSuccesses);
                        res.send({'result': 'ok'}, 200);
                        return;
                    }

                    winston.log('warn', 'a POST /sample/answer request from user=' + caller.name + ' failed');
                    Common.pushMessage(req, 'error', 'Failed to update sample responses');
                    res.send(sampleUpdateErrors, 500);
                });
            });
        }));
    });
}

function _handleSampleList(req, res) {

    //// Redirect Samples/ to Samples/View
    if(req.route.path == '/samples' && req.headers.referer == undefined) {
        res.redirect('/samples/view');
        return;
    }


    _querySamples(req, res, function(err, sample_results) {
        res.send(sample_results, 200);
    });
}

function _handleSamplePropertyList(req, res) {
    _getSamples(req, res, function(err, samples) {
        var property = req.param('property');
        res.send(_.uniq(_.pluck(samples, property)), 200);
    });
}

// === HELPERS

function _querySamples(req, res, callback2) {

    // get materialization fields from req
    var fields = {};
    if(typeof(req.query['fields']) != 'undefined') {
        var field_values = req.query['fields'].split(',');
        _.each(field_values, function(field) {
            fields[field] = 1;
        });
    }
    //function _buildTableQuery(sort_struct, filter_struct, query, sort_by, exact_match_properties) {
    var query = {}, sort_by = {};

    async.series([

        function(callback) {
            nodeUtils.buildTableQuery(req.query.sort, req.query.filter, {}, query, sort_by, ['product_info.name', 'visit_info.store_check_name']);
            console.log(req.query);
            // attempt to query by name as integer, if the name filter is provided
            if(req.query.filter && req.query.filter.name) {
                try {
                    var name_as_int = parseInt(req.query.filter.name);
                    if(!isNaN(name_as_int)) {
                        query.name = name_as_int;
                    }
                } catch(ex) {}
            }
            callback();
        },

        function(callback) {
            var idListAsString = req.query['idList'];
            if(!idListAsString) {
                callback();
                return;
            }

            var idList = idListAsString.split(',');
            idList = _.filter(idList, function(id) { return nodeUtils.isValidId(id);});
            idList = _.map(idList, function(id) { return ObjectId(id); });
            query['_id'] = { $in: idList};
            callback();
        },

        // special handling for image_count
        function(callback) {
            if(!req.query || !req.query.filter || !req.query.filter.image_count) {
                callback();
                return;
            }

            query.image_count = (req.query.filter.image_count == 'yes' ? {$gt: 0} : 0);
            callback();
        },

        // special handling for defects, alert, conform filtering
        function(callback) {
            if(!req.query || !req.query.filter || !req.query.filter.defects) {
                callback();
                return;
            }
            var indexOfDefects = req.query.filter.defects.indexOf('defect');
            var indexOfAlerts = req.query.filter.defects.indexOf('alert');
            var indexOfConform = req.query.filter.defects.indexOf('conform');
            if(indexOfDefects != -1 && indexOfAlerts != -1) {
                // TODO: extend $or if it exists!
                query['$or'] = [{non_conform: {$not: {$size: 0}}}, {alerts: {$not: {$size: 0}}}];
            } else if(indexOfDefects != -1) {
                query.non_conform = {$not: {$size: 0}};
            } else if(indexOfAlerts != -1) {
                query.alerts = {$not: {$size: 0}};
            } else if(indexOfConform != -1) {
                // TODO: extend $and if it exists!
                query['$and'] = [{non_conform: {$size: 0}}, {alerts: {$size: 0}}];
            }
            delete query.defects;
            callback();
        },

        // special handling for storecheck.name filtering
        function(callback) {
            if(_.isUndefined(query['store_check_name'])) {
                callback();
                return;
            }

            StoreCheckModule.collection.find({name: query['store_check_name']}, {_id: 1}).toArray(function(err_sc, storechecks) {
                query['visit_info.store_check_id'] = {$in: _.map(storechecks, function(storecheck) { return storecheck._id.toHexString();})};
                delete query['store_check_name'];
                callback();
            });
        },

        // special handling for visit-date sorting
        function(callback) {
            if(_.isUndefined(sort_by['visit_info.date_of_visit'])) {
                callback();
                return;
            }
            sort_by['visit_info.date_of_visit_timestamp'] = sort_by['visit_info.date_of_visit'];
            delete sort_by['visit_info.date_of_visit'];
            callback();
        }

    ], function(err_async, async_results) {
        var page = req.query['page'];
        var pageSize = req.query['pageSize'];
        Common.findSamples(req, res, query, fields, page, pageSize, sort_by, Common.serviceErrorCallbacks, function(sample_results) {
            callback2(null, sample_results);
        });
    });
}

// TODO: consolidate with querySamples ???
function _getSamples(req, res, callback2) {
    var idListAsString = req.param('idList'), sampleFilter = {};
    if(!_.isUndefined(idListAsString)) {
        var idList = idListAsString.split(',');
        idList = _.map(idList, function(id) { return ObjectId(id); });
        sampleFilter = {_id: { $in: idList}};
    }

    // get materialization fields from req
    var fields = {};
    if(typeof(req.query['fields']) != 'undefined') {
        var field_values = req.query['fields'].split(',');
        _.each(field_values, function(field) {
            fields[field] = 1;
        });
    }

    var page = undefined;
    var pageSize = undefined;
    var sort = undefined;
    Common.findSamples(req, res, sampleFilter, fields, page, pageSize, sort, Common.serviceErrorCallbacks, function(sample_results) {
        callback2(null, sample_results);
    });
}

