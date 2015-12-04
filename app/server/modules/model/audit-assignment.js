var db = require('./../database/dynamic-database');
var assignment = db.db.collection('audit-assignment');
var nodeutils = require('../node-utils');
var dbUtils = require('../database/database-utils');
var formatter = require('../view-formatter');
var _ = require('underscore');

var index_keys = [
    { _id: 1, organization: 1, state: 1, storecheck_id: 1 },
    { _id: 1, team_id: 1, storecheck_id: 1 }
];

dbUtils.addStandardMethods(exports, assignment, index_keys);

// callback is (err, number_updated)
exports.setAssignmentStatusesForStoreCheck = function(storeCheckId, new_status, callback) {
    assignment.update(
        { storecheck_id: storeCheckId },
        { $set : { state: new_status, endDate: formatter.getCurrentUtcTimeString() } },
        { w: 1, multi:true },
        callback
    );
};

exports.findStoreCheckIdsForTeams = function(team_ids, callback) {
    /*assignment.find({ team_id: { $in: team_ids }}, {storecheck_id: 1, hint: index_keys[1]}).explain(function(err, res) {
        console.log('');
    });*/
    if(!team_ids || team_ids.length == 0) {
        callback(null, []);
        return;
    }
    assignment.find({ team_id: { $in: team_ids }}, {storecheck_id: 1, hint: index_keys[1]}).toArray(function(err, assignment_results) {
        if(err != null) {
            callback(err, null);
            return;
        }
        callback(null, _.pluck(assignment_results, 'storecheck_id'));
    });
};