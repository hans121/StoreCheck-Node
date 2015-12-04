var backup_manager = require('node-mongo-backup-manager');
var config = require('config');
var winston = require('winston');

var DynamicConfig = require('../dynamic-config');
var nodeUtils = require('./../node-utils');

var Job = require('./job');

BackupDatabasesJob.prototype  = new Job('backup databases', DynamicConfig.keys.AUTO_BACKUP_DATABASES);
BackupDatabasesJob.prototype.constructor = BackupDatabasesJob;

function BackupDatabasesJob() {
    //Job.prototype.constructor.call(this);
}

BackupDatabasesJob.prototype.doWork = function() {
    var that = this;

    winston.info('begun ' + this.job_name + ' job');

    if(!config['system'].backupDirectory) {
        winston.warn('no backup directory specified for ' + this.job_name + ' job');
        return;
    }

    backup_manager.backup({
        username: config['dynamic_database'].user,      // TODO: only backs up database instance dynamic lives inside of
        password: config['dynamic_database'].password,
        outputDirectory: config['system'].backupDirectory,
        createEnclosingDirectory: true,
        compresses: true
    }, function(err_backup) {
        if(err_backup) {
            winston.error('while backing up database: ' + err_backup);
        }

        winston.info('finished ' + that.job_name + ' job');
    });
};

module.exports = new BackupDatabasesJob();