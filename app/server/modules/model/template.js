var db = require('./../database/dynamic-database');
var moment = require('moment');
var template = db.db.collection('template');
var formatter = require("../view-formatter");
var schema = require("./schema/schema");
var nodeutils = require('../node-utils');
var dbUtils = require('../database/database-utils');

var index_keys = [
    { organization: 1, state: 1 }
];

dbUtils.addStandardMethods(exports, template, index_keys);

exports.list = function(fully_materialize, callback) {
    if(fully_materialize) {
        template.find({}, {name: true, created_by: true, creation_time: true, language: true }).toArray(nodeutils.callbackWrapper(callback));
    } else {
        template.find().toArray(nodeutils.callbackWrapper(callback));
    }
};

exports.generateQuestionRecord = function(identity_id, active, default_value) {
    return {
        identity_id: identity_id,
        active: active,
        default_value: default_value
    };
};

exports.generate = function(name, questions) {
    return {
        name: name,
        questions: questions
    };
};

exports.generateInsertionData = function(username, template) {
    template.creation_time = formatter.getCurrentUtcTimeString();
    template.last_update_time = template.creation_time;
    template.created_by = username;
    template.version = schema.currentVersion;
};