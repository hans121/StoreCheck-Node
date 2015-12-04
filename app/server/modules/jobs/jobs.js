var Common = require('../../router/router-common');

var nodeUtils = require('./../node-utils');

var BackupDatabasesJob = require('./backup-databases');
var CompactDatabasesJobs = require('./compact-databases');
var CPU_Jobs = require('./cpu-snapshot');
var DatabaseMonitorJobs = require('./database-monitor');
var DeleteDatabaseBackupsJobs = require('./delete-database-backups');
var DiskJobs = require('./disk-monitor');
var ExcipioImportJobs = require('./excipio-import');

module.exports = {
    startDiskJob: _startDiskJob,
    startCPUJob: _startCPUJob,
    startDatabaseSizeJob: _startDatabaseSizeJob,
    startExcipioImportJob: _startExcipioImportJob,
    stopExcipioImportJob: _stopExcipioImportJob,
    startCompactDatabasesJob: _startCompactDatabasesJob,
    stopCompactDatabasesJob: _stopCompactDatabasesJob,
    startDatabaseBackupJob: _startDatabaseBackupJob,
    stopDatabaseBackupJob: _stopDatabaseBackupJob,
    startDeleteDatabaseBackupsJob: _startDeleteDatabaseBackupsJob
};

function _startDiskJob() {
    return DiskJobs.start();
}

function _startCPUJob() {
    return CPU_Jobs.start();
}

function _startDatabaseSizeJob() {
    DatabaseMonitorJobs.start();
}

function _startExcipioImportJob(hour, minute) {
    ExcipioImportJobs.start(hour, minute);
}

function _stopExcipioImportJob() {
    ExcipioImportJobs.stop();
}

function _startCompactDatabasesJob(hour, minute) {
    CompactDatabasesJobs.start(hour, minute);
}

function _stopCompactDatabasesJob() {
    CompactDatabasesJobs.stop();
}

function _startDatabaseBackupJob(hour, minute) {
    BackupDatabasesJob.start(hour, minute);
}

function _stopDatabaseBackupJob() {
    BackupDatabasesJob.stop();
}

function _startDeleteDatabaseBackupsJob(hour, minute) {
    DeleteDatabaseBackupsJobs.start(hour, minute);
}