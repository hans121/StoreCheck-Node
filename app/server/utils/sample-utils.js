var _ = require('underscore');
var async = require('async');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var OrganizationModule = require('../modules/model/organization');
var SampleModule = require('../modules/model/sample');

var nodeUtils = require('../modules/node-utils');

module.exports = {
    updateSampleTemperatureConformance: _updateSampleTemperatureConformance,
    updateSampleVisitDates: _updateSampleVisitDates
};

function _updateSampleTemperatureConformance() {
    nodeUtils.runInBackground(function() {
        SampleModule.applyChangeToAllSamples(function(samples, callback2) { // mutator
            var organization_ids = _.map(_.uniq(_.pluck(samples, 'organization')), function(org_string) { return ObjectId(org_string); });

            OrganizationModule.collection.find({_id: {$in: organization_ids}}).toArray(function(err, organizations) {
                if(err) {
                    winston.error('an error occurred while updating conformance of samples (continuing): ' + err);

                    _.each(samples, function(sample) {
                        tasks.push(function(callback) {
                            SampleModule.collection.update({_id: sample._id}, {$set: { batch_update_time: new Date()}}, function(err_update, update_result) {
                                callback(err_update, update_result);
                            });
                        });
                    });
                } else {
                    var tasks = [];
                    _.each(samples, function(sample) {

                        var organization = _.find(organizations, function(org) {
                            return org._id.toHexString() == sample.organization;
                        });

                        if(!organization) {
                            winston.error('could not find organization for sample ' + sample._id.toHexString());
                            return; // skip to next sample if organization not found
                        }

                        SampleModule.processSampleConformances(sample, organization.settings);

                        tasks.push(function(callback) {
                            SampleModule.collection.update({_id: sample._id},
                                {
                                    $set: {
                                        questions: sample.questions,
                                        alerts: sample.alerts,
                                        non_conform: sample.non_conform,
                                        batch_update_time: new Date()
                                    }
                                },
                                function(err_update, update_result) {
                                    callback(err_update, update_result);
                                }
                            );
                        });
                    });
                }
                async.series(tasks, function(err_tasks, task_results) {
                    callback2(err_tasks, task_results);
                });
            });

        }, function(err_updates) {
            winston.info('sample temperature conformance update complete');
        });
    });
}

function _updateSampleVisitDates() {
    nodeUtils.runInBackground(function() {
        SampleModule.applyChangeToAllSamples(function(samples, callback2) { // mutator
            var tasks = [];
            _.each(samples, function(sample) {

                // if visit info or date of visit undefined, mark it as processed
                if(!sample.visit_info || !sample.visit_info.date_of_visit) {
                    tasks.push(function(callback) {
                        SampleModule.collection.update({_id: sample._id}, {$set: { batch_update_time: new Date()}}, function(err_update, update_result) {
                            callback(err_update, update_result);
                        });
                    });
                }

                // otherwise, attempt to update the date_of_visit timestamp
                sample.visit_info.date_of_visit_timestamp = formatter.formattedDateToTimestamp(sample.visit_info.date_of_visit);
                tasks.push(function(callback) {
                    SampleModule.collection.update({_id: sample._id}, {$set: {visit_info: sample.visit_info, batch_update_time: new Date()}}, function(err_update, update_result) {
                        callback(err_update, update_result);
                    });
                });
            });
            async.series(tasks, function(err_tasks, task_results) {
                callback2(err_tasks, task_results);
            });
        }, function(err_updates) {
            winston.info('sample visit date timestamping complete');
        });
    });
}