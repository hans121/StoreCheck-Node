var db = require('./../database/dynamic-database');
var auditteam = db.db.collection('audit-team');
var nodeutils = require('../node-utils');
var dbUtils = require('../database/database-utils');
var ObjectId = require('mongodb').ObjectID;

var index_keys = [
    { organization: 1, state: 1 },
    { _id: 1, members: 1 }
];

dbUtils.addStandardMethods(exports, auditteam, index_keys);

exports.findTeamIdsForMember = function(memberId, callback) {
    /*auditteam.find({ members: { $in: [memberId]}}, {_id: 1, hint: index_keys[1]}).explain(function(err, explained) {
        console.log(explained);
    });*/
    auditteam.find({ members: { $in: [memberId]}}, {_id: 1, hint: index_keys[1]}).toArray(function(err, teams) {
        if(err) {
            callback(err);
            return;
        }
        var teamIds = teams.map(function(team) { return team._id.toHexString(); });
        callback(null, teamIds);
    });
};

exports.findTeamsWithMember = function (memberId, callback) {
    auditteam.find({ members: { $in: [memberId]}}).toArray(nodeutils.callbackWrapper(callback));
};

exports.removeMemberFromTeams = function (memberId, callback) {
    auditteam.update({ members: { $in: [memberId]}}, { $pull: {members: memberId}}, callback);
};

exports.getAllMembers = function (organizations, callback) {
    var allMembers = [];
    var query = { state: {$nin: ["inactive"]} };

    if(typeof(organizations) != 'undefined') {
        query.organization = {$in: organizations};
    }

    auditteam.find(query, { members: 1 }).toArray(function (err, items) {
        if(err !== null) {
            callback(err);
            return;
        }

        items.forEach(function (e) {
            e.members = e.members || [];
            e.members.forEach(function (e1) {
                if(allMembers.indexOf(e1) === -1) {
                    allMembers.push(e1);
                }
            });
        });
        callback(null, allMembers);
    });
};

exports.getMemberNames = function (users, memberIds) {
    var memberNames = [],
        userIds = users.map(function (user) { return user._id.toHexString(); });

    memberIds.forEach(function (item) {
        var j = userIds.indexOf(item);
        if(j !== -1) {
            memberNames.push(users[j].name);
        }
    });

    return memberNames;
};

exports.addMemberToTeam = function(user, team_id, callback) {
    auditteam.update({_id: ObjectId(team_id)}, {$addToSet: { members: user }}, nodeutils.callbackWrapper(callback));
};



