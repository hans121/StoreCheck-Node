var db = require('./database/dynamic-database');
var winston = require('winston');

var action_audit = db.db.collection('action-audit');

var dbUtils = require('./database/database-utils');
var nodeUtils   = require('./node-utils');
var formatter = require('./view-formatter');

dbUtils.addStandardMethods(exports, action_audit);

// mongodb has an inherent timestamp in the ObjectId
exports.report = function(caller, action, resource, details) {
    setTimeout(function() {
        exports.collection.insert({
            action: action,
            resource: resource,
            details: (typeof(details) != 'undefined' ? details : ''),
            agent: {
                user: caller.user,
                id: caller._id,
                name: caller.name
            },
            organization: caller.active_organization,
            timestamp: formatter.getCurrentUtcTimeString()
        }, {safe: true}, function(){});
    }, 0);
};