var db = require('./../database/dynamic-database');
var ObjectId = require('mongodb').ObjectID;
var storecheck = db.db.collection('store-check');
var nodeutils = require('../node-utils');
var dbUtils = require('../database/database-utils');

var index_keys = [
    { organization: 1, state: 1},
    { _id: 1, state: 1}
];

dbUtils.addStandardMethods(exports, storecheck, index_keys);

exports.getStoreChecksWithStatusFromIdList = function(idList, statuses, callback) {
    for(var i=0; i<idList.length; i++) {
        idList[i] = ObjectId(idList[i]);
    }
    storecheck.find({"_id":{ $in: idList }, "state": { $in: statuses }}, {hint: index_keys[1]}).toArray(nodeutils.callbackWrapper(callback));
};

exports.getDistinctSampleKeyValues = function(storecheck, key) {
    var sample_ids = storecheck.sample_types.map(function(sampleTuple) { return sampleTuple[key]; });
    return sample_ids.filter(function(e, i, a) { return sample_ids.indexOf(e) == i; });
};
