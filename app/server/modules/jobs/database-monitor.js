var schedule = require('node-schedule');
var winston = require('winston');

var node_server_monitor = require('node-server-monitor');

var nodeUtils = require('./../node-utils');

var DynamicConfig = require('./../dynamic-config');

module.exports = {
    start: _start,
    stop: _stop
};

node_server_monitor.mongo_database_monitor.addDatabase(require('../database/dynamic-database').db);
node_server_monitor.mongo_database_monitor.addDatabase(require('../database/semi-dynamic-database').db);
node_server_monitor.mongo_database_monitor.addDatabase(require('../database/static-database').db);
node_server_monitor.mongo_database_monitor.addDatabase(require('../database/storecheck-logs-database').db);

var database_size_job;

function _start() {
    winston.info('scheduled database statistics snapshot job');

    // === cpu usage snapshots
    var db_rule = new schedule.RecurrenceRule();
    db_rule.minute = 12; // once per hour
    database_size_job = schedule.scheduleJob(db_rule, node_server_monitor.mongo_database_monitor.takeStats);
}

function _stop() {
    // TODO
}

nodeUtils.runWhenDbLoaded(DynamicConfig, function() {

    _start();
    node_server_monitor.mongo_database_monitor.takeStats();
});