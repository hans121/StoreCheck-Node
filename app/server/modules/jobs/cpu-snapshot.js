var schedule = require('node-schedule');
var winston = require('winston');

var nodeUtils = require('./../node-utils');

var node_server_monitor = require('node-server-monitor');

module.exports = {
    start: _start,
    stop: _stop,
    doWork: _takeCPUSnapshot
};

var job_instances = [];

function _start() {
    winston.info('scheduled CPU snapshot jobs');

    // === cpu usage snapshots
    var cpu_rule = new schedule.RecurrenceRule();
    cpu_rule.second = 0; // once per minute
    job_instances.push(schedule.scheduleJob(cpu_rule, _takeCPUSnapshot));

    var cpu_rule2 = new schedule.RecurrenceRule();
    cpu_rule2.second = 20; // once per minute
    job_instances.push(schedule.scheduleJob(cpu_rule2, _takeCPUSnapshot));

    var cpu_rule3 = new schedule.RecurrenceRule();
    cpu_rule3.second = 40; // once per minute
    job_instances.push(schedule.scheduleJob(cpu_rule3, function() {
        node_server_monitor.cpu_monitor.sampleCPU(function(cpu) {
            //SystemModule.reduceOldCPUSnapshots(3, 5);
        });
    }));

    return job_instances;
}

function _stop() {
    // TODO
}

function _takeCPUSnapshot() {
    node_server_monitor.cpu_monitor.sampleCPU(function(cpu) {});
}

_start();