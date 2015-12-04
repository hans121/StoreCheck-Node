var config = require('config');
var fs = require('fs');
var moment = require('moment');
var path = require('path');
var winston = require('winston');

var nodeUtils = require('./../node-utils');

var Job = require('./job');

DeleteDatabaseBackups.prototype  = new Job('delete database backups');
DeleteDatabaseBackups.prototype.constructor = DeleteDatabaseBackups;

function DeleteDatabaseBackups() {
}

DeleteDatabaseBackups.prototype.doWork = function() {
    var that = this;

    winston.info('begun ' + this.job_name + ' job');

    if(!config['system'].backupDirectory) {
        return;
    }

    fs.readdir(config['system'].backupDirectory, function(err_read, dir_contents) {
        if(err_read) {
            winston.error('while deleting old database backups: ' + err_read);
            return;
        }

        // if the file is of the format YYYY-MM-DDHHMMss.tar.gz
        var files = [], re = /\d\d\d\d-\d\d-\d\d\d\d\d\d\d\d\.tar\.gz/;
        dir_contents.forEach(function(directory_item) {
            if(directory_item.match(re)) {
                var my_moment = moment(directory_item.split('.')[0], 'YYYY-MM-DDHHmmss');
                files.push({
                    filename: directory_item,
                    timestamp: my_moment.valueOf()
                })
            }
        });

        var number_of_files_to_delete = files.length - config['system'].backupLimit;

        if(number_of_files_to_delete <= 0) {
            winston.info('completed ' + that.job_name + ' job, having deleted nothing');
            return;
        }

        winston.info('preparing to delete ' + (files.length - config['system'].backupLimit) + ' database backups');

        files.sort(function(a, b) {
            return (a.timestamp - b.timestamp);
        });

        for(var i = 0; i<number_of_files_to_delete; i++) {
            fs.unlinkSync(path.join(config['system'].backupDirectory, files[i].filename));
            winston.info('deleted ' + files[i].filename);
        }

        winston.info('completed ' + that.job_name + ' job, having deleted ' + number_of_files_to_delete + ' files');
    });
};

module.exports = new DeleteDatabaseBackups();