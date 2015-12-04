var db = require('./database/dynamic-database');
var winston = require('winston');
var static_loads = db.db.collection('static-loads');
var dbUtils = require('./database/database-utils');
var nodeUtils   = require('./node-utils');

dbUtils.addStandardMethods(exports, static_loads);

exports.findLatest = function(resource, callback2) {
    static_loads.findOne(
        {
            type: resource
        },
        {
            sort: { timestamp: -1 },
            fields: { type: 1, timestamp: 1, _id: 0},
            hint: { type: 1, timestamp: 1}
        },
        function(err_load, load_result) {
            if(err_load) {
                callback2(err_load);
                return;
            }
            callback2(null, load_result);
        }
    );
};

exports.insert = function(obj, callback) {
    static_loads.ensureIndex({ type: 1, timestamp: 1}, {background: true}, function(err) {
        winston.log('debug', 'completed initiating ensureIndex of static-loads container, err=' + err);
    });
    static_loads.insert(obj, function(err, doc){
        if(!err) {
            callback(doc);
        } else {
            callback(null);
        }
    });
};