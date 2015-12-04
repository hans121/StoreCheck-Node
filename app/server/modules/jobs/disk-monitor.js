var config = require('config');
var schedule = require('node-schedule');
var winston = require('winston');

var nodeUtils = require('./../node-utils');

var node_server_monitor = require('node-server-monitor');

module.exports = {
    start: _start,
    stop: _stop
};

var job_instance;

function _start() {
    winston.info('scheduled disk space snapshot job');

    // === disk usage snapshots
    var disk_rule = new schedule.RecurrenceRule();
    disk_rule.minute = 4; // once per hour
    job_instance = schedule.scheduleJob(disk_rule, _takeDiskSnapshot);

    var disk_stats = [], max_disk_stats = 500;

    function _takeDiskSnapshot() {
        node_server_monitor.disk_monitor.getDiskSpace(config['system']['drives'], function(err, result){

            // Process Disk
            {
                disk_stats.push(result);
                if(disk_stats.length > max_disk_stats) {
                    disk_stats.slice(1);
                }
                winston.debug('Disk space:' + JSON.stringify(result));
            }
        });
    }

    return job_instance;
}

function _stop() {

}

_start();