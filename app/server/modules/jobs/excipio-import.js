var config = require('config');
var schedule = require('node-schedule');
var winston = require('winston');

var DynamicConfig = require('../dynamic-config');
var ExcipioImport = require('../excipio/excipio-import');

var nodeUtils = require('./../node-utils');

module.exports = {
    start: _start,
    stop: _stop
};

var job_instance;
var last_config;

function _start(hour, minute) {

    winston.info('scheduling excipio import job');

    if(typeof(job_instance) != 'undefined') {
        winston.info('excipio import job is already running');
        return;
    }

    var rule = new schedule.RecurrenceRule();
    rule.hour = hour ? hour : 2; // once per day at 2 AM
    rule.minute = minute ? minute : 0;
    job_instance = schedule.scheduleJob(rule, _doExcipioImport);
    winston.info('scheduled excipio import job for hour = ' + rule.hour + ' minute = ' + rule.minute);
}

function _stop() {
    winston.info('stopping excipio import job');

    if(typeof(job_instance) == 'undefined') {
        winston.info('excipio import job was not running');
        return;
    }

    job_instance.cancel();
    winston.info('stopped excipio import job');

    job_instance = undefined;
}

function _doExcipioImport() {
    winston.info('begun excipio import job');
    ExcipioImport.import(undefined, 'template', function(err_template) { // , results
        ExcipioImport.import(undefined, 'pos', function(err_pos) { // , results
            ExcipioImport.import(undefined, 'general', function(err_general) { // , results
                var error_text = "";
                error_text += (err_template ? (error_text.length > 0 ? ',' : '') + 'template' : '');
                error_text += (err_pos ? (error_text.length > 0 ? ',' : '') + 'pos' : '');
                error_text += (err_general ? (error_text.length > 0 ? ',' : '') + 'general' : '');
                winston.info('completed excipio import job. errors = ' + error_text);
            });
        });
    });
}

nodeUtils.runWhenDbLoaded(DynamicConfig, function() {
    if(config['excipio_import'].enabled) {
        _ensureSyncedWithConfig();

        // every 2 minutes, figure out if our import is up-to-date
        setInterval(_ensureSyncedWithConfig, 120000);
    }
});

function _ensureSyncedWithConfig() {
    DynamicConfig.collection.findOne({key: DynamicConfig.keys.AUTO_IMPORT_HIERARCHIES}, function(err, import_config) {
        if(err || !import_config) {
            winston.error('could not load dynamic config record for auto-import-hierarchies');
            return;
        }
        if(last_config) {
            if(last_config.hour == import_config.hour && last_config.minute == import_config.minute) {
                return;
            } else {
                winston.debug('a change has been detected to the excipio-import job scheduled time');
                _stop();
            }
        }

        last_config = import_config;
        if(import_config.active) {
            _start(import_config.hour, import_config.minute);
        }
    });
}