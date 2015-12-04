var _ = require('underscore');
var db = require('./../database/dynamic-database');
var visit = db.db.collection('visit');
var ObjectId = require('mongodb').ObjectID;
var nodeutils = require('../node-utils');
var dbUtils = require('../database/database-utils');

var index_keys = [
    { _id: 1, store_check_id: 1, state: 1 },
    { _id: 1, team_id: 1 }
];

dbUtils.addStandardMethods(exports, visit, index_keys);

exports.collection = visit;

exports.getVisitsForStoreCheck = function(storeCheckId, fields, callback) {
    var options = { hint: index_keys[0] };
    if(_.isUndefined(fields)) {
        visit.find({store_check_id: storeCheckId}, options).toArray(nodeutils.callbackWrapper(callback));
        return;
    }
    visit.find({store_check_id: storeCheckId}, fields, options).toArray(nodeutils.callbackWrapper(callback));
};

exports.getVisitsForStoreChecks = function(storeCheckIds, fields, callback) {
    var options = { hint: index_keys[0] };
    if(_.isUndefined(fields)) {
        visit.find({ store_check_id: {$in: storeCheckIds} }, options).toArray(nodeutils.callbackWrapper(callback));
        return;
    }
    visit.find({ store_check_id: {$in: storeCheckIds} }, fields, options).toArray(nodeutils.callbackWrapper(callback));
};

exports.getVisitsForStoreCheckWithStatuses = function(storeCheckId, statuses, callback) {
    visit.find({
        store_check_id: storeCheckId,
        state: {$in: statuses}
    }, {hint: index_keys[0]}).toArray(nodeutils.callbackWrapper(callback));
};

// callback is (err, number_updated)
exports.setVisitStatusesForStoreCheck = function(storeCheckId, new_status, callback) {
    visit.update(
        { store_check_id: storeCheckId },
        { $set : { state: new_status } },
        { w: 1, multi:true },
        callback
    );
};

exports.getVisitsForSamples = function (sampleIds, callback) {
    visit.find({"samples.id": { $in: sampleIds}}).toArray(nodeutils.callbackWrapper(callback));
};

exports.getVisitIdsForSamples = function (sampleIds, callback) {
    visit.find({"samples.id": { $in: sampleIds}}, {_id: 1}).toArray(nodeutils.callbackWrapper(callback));
};

exports.getVisitForSample = function (sampleId, callback) {
    visit.findOne({"samples.id": sampleId}, nodeutils.callbackWrapper(callback));
};

exports.removeSamplesFromVisits = function (sampleIds, callback) {
    visit.update(
        {
            "samples.id": {
                $in: sampleIds
            },
            state: "draft"
        },
        {
            $pull: {
                "samples": {
                    "id" : {
                        $in: sampleIds
                    }
                }
            }
        },
        {
            multi: true
        }, callback );
};

exports.getDistinctSampleKeyValues = function(visit, key) {
    var sample_ids = visit.samples.map(function(sampleTuple) { return sampleTuple[key]; });
    return sample_ids.filter(function(e, i, a) { return sample_ids.indexOf(e) == i; });
};