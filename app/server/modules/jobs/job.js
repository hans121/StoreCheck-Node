var schedule = require('node-schedule');
var winston = require('winston');

var DynamicConfig = require('../dynamic-config');
var nodeUtils = require('./../node-utils');

// just override "doWork" after extending

function Job(name, config_key) {
    var that = this;

    this.job_name = name;
    this.job_instance = null;
    this.last_config = null;
    this.config_key = config_key;

    if(config_key) {
        nodeUtils.runWhenDbLoaded(DynamicConfig, function() {
            that.ensureSyncedWithConfig();

            // every 2 minutes, figure out if our job config is up-to-date
            setInterval(function() {
                that.ensureSyncedWithConfig();
            }, 120000);
        });
    }
}

Job.prototype.start = function(hour, minute) {
    winston.info('scheduling "' + this.job_name + '" job');

    if(this.job_instance) {
        winston.info(this.job_name + ' job is already running');
        return;
    }

    var rule = new schedule.RecurrenceRule();
    rule.hour = hour ? hour : 2; // once per day at 2 AM
    rule.minute = minute ? minute : 0;
    rule.second = 0;

    var that = this;
    this.job_instance = schedule.scheduleJob(rule, function() {
        that.doWork();
    });
    winston.info('scheduled ' + this.job_name + ' job for hour = ' + rule.hour + ' minute = ' + rule.minute);
};

Job.prototype.stop = function() {
    winston.info('stopping ' + this.job_name + ' job');

    if(!this.job_instance) {
        winston.info(this.job_name + ' job was not running');
        return;
    }

    this.job_instance.cancel();
    winston.info('stopped ' + this.job_name + ' job');

    this.job_instance = null;
};

Job.prototype.ensureSyncedWithConfig = function() {
    var that = this;

    DynamicConfig.collection.findOne({key: that.config_key}, function(err, import_config) {
        if(err || !import_config) {
            //winston.error('could not load dynamic config record for ' + that.job_name + ' job');
            return;
        }

        if(that.last_config) {
            if(that.last_config.hour == import_config.hour && that.last_config.minute == import_config.minute) {
                return;
            } else {
                winston.debug('a change has been detected to the ' + that.job_name + ' job scheduled time');
                that.stop();
            }
        }

        that.last_config = import_config;
        if(import_config.active) {
            that.start(import_config.hour, import_config.minute);
        }
    });
};

Job.prototype.doWork = function() {
};

module.exports = Job;