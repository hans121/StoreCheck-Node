var schedule = require('node-schedule');
var winston = require('winston');

var adminUtils = require('../../utils/admin-utils');
var DynamicConfig = require('../dynamic-config');
var nodeUtils = require('./../node-utils');

module.exports = {
    start: _start,
    stop: _stop
};

var job_instance;
var last_config;

function _start(hour, minute) {

    winston.info('scheduling compact databases job');

    if(typeof(job_instance) != 'undefined') {
        winston.info('compact databases job is already running');
        return;
    }

    var rule = new schedule.RecurrenceRule();
    rule.hour = hour ? hour : 2; // once per day at 2 AM
    rule.minute = minute ? minute : 0;
    job_instance = schedule.scheduleJob(rule, _doCompact);
    winston.info('scheduled compact databases job for hour = ' + rule.hour + ' minute = ' + rule.minute);
}

function _stop() {
    winston.info('stopping compact databases job');

    if(typeof(job_instance) == 'undefined') {
        winston.info('compact databases job was not running');
        return;
    }

    job_instance.cancel();
    winston.info('stopped compact databases job');

    job_instance = undefined;
}

function _doCompact() {
    winston.info('begun compact databases job');

    adminUtils.compactAndRepairDatabases(function(err_compact) {
        if(err_compact) {
            winston.error('an error occurred while compacting databases: ' + err_compact);
        }
        winston.info('completed auto-compact databases job');
    });
}

nodeUtils.runWhenDbLoaded(DynamicConfig, function() {
    _ensureSyncedWithConfig();

    // every 2 minutes, figure out if our job config is up-to-date
    setInterval(_ensureSyncedWithConfig, 120000);
});

function _ensureSyncedWithConfig() {
    DynamicConfig.collection.findOne({key: DynamicConfig.keys.AUTO_COMPACT_DATABASES}, function(err, import_config) {
        if(err || !import_config) {
            //winston.error('could not load dynamic config record for auto-compact-databases');
            return;
        }
        if(last_config) {
            if(last_config.hour == import_config.hour && last_config.minute == import_config.minute) {
                return;
            } else {
                winston.debug('a change has been detected to the auto-compact-databases job scheduled time');
                _stop();
            }
        }

        last_config = import_config;
        if(import_config.active) {
            _start(import_config.hour, import_config.minute);
        }
    });
}