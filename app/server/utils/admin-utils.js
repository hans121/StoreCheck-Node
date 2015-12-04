var async = require('async');
var config = require('config');
var exec = require('child_process').exec;
var path = require('path');
var sys = require('sys');
var targz = require('tar.gz');
var winston = require('winston');

var DatabaseMonitor = require('node-server-monitor').mongo_database_monitor;

var DynamicDatabase = require('../modules/database/dynamic-database');
var SemiDynamicDatabase = require('../modules/database/semi-dynamic-database');
var StaticDatabase = require('../modules/database/static-database');
var StorecheckLogsDatabase = require('../modules/database/storecheck-logs-database');

module.exports = {
    deleteAllData: _deleteAllData,
    restoreFromBackup: _restoreFromBackup,
    compactCollection: _compactCollection,
    repairDatabase: _repairDatabase,
    compactAndRepairDatabases: _compactAndRepairDatabases
};

function _deleteAllData(callback2) {
    var delete_tasks = [];

    var reserved_collection_names = [
        'system.indexes',
        'system.profile',
        'system.users'
    ];

    async.series({

        dynamic_database: function(callback) {
            DynamicDatabase.db.collections(function(err, collections) {
                collections.forEach(function(collection) {

                    // ignore system/overhead collections
                    if(reserved_collection_names.indexOf(collection.collectionName) == -1) {

                        // add a task to delete this collection's contents
                        delete_tasks.push(function(callback_task) {
                            collection.remove({}, function(err_remove) {
                                callback_task(err_remove);
                            });
                        });
                    }
                });
                callback();
            });
        },

        semi_dynamic_database: function(callback) {
            SemiDynamicDatabase.db.collections(function(err, collections) {
                collections.forEach(function(collection) {

                    // ignore system/overhead collections
                    if(reserved_collection_names.indexOf(collection.collectionName) == -1) {

                        // add a task to delete this collection's contents
                        delete_tasks.push(function(callback_task) {
                            collection.remove({}, function(err_remove) {
                                callback_task(err_remove);
                            });
                        });
                    }
                });
                callback();
            });
        },

        static_database: function(callback) {
            StaticDatabase.db.collections(function(err, collections) {
                collections.forEach(function(collection) {

                    // ignore system/overhead collections
                    if(reserved_collection_names.indexOf(collection.collectionName) == -1) {

                        // add a task to delete this collection's contents
                        delete_tasks.push(function(callback_task) {
                            collection.remove({}, function(err_remove) {
                                callback_task(err_remove);
                            });
                        });
                    }
                });
                callback();
            });
        }
    }, function(err_async, async_results) {
        if(err_async) {
            callback2(err_async);
            return;
        }

        async.series(delete_tasks, function(err_delete, delete_results) {
            if(err_delete) {
                callback2(err_delete);
                return;
            }
            callback2(null, delete_results);
        });
    });
}

function _restoreFromBackup(filepath, callback2) {
    winston.info('restoring from backup ' + filepath);

    var directory = path.dirname(filepath);
    winston.debug('extracting database backup to ' + directory);

    var compress = new targz().extract(filepath, directory, function(err){
        if(err) {
            callback2(err);
            return;
        }

        var command = 'mongorestore ' + filepath + ' --username ' + config['dynamic_database']['user'] + ' --password ' + config['dynamic_database']['password'];
        var child = exec(command, function (error, stdout, stderr) {
            //sys.print('stdout: ' + stdout);
            //sys.print('stderr: ' + stderr);
            callback2(error);
        });
    });
}

function _getDatabaseFromName(database_name) {
    switch(database_name) {
        case config['dynamic_database'].name:
            return DynamicDatabase;
        case config['semi_dynamic_database'].name:
            return SemiDynamicDatabase;
        case config['static_database'].name:
            return StaticDatabase;
        case config['logging'].database.name:
            return StorecheckLogsDatabase;
    }
    return null;
}

function _compactCollection(database_name, collection_name, callback2) {
    var db = _getDatabaseFromName(database_name);

    if(!db) {
        callback2('database not found');
        return;
    }

    winston.info('began compacting collection ' + collection_name + ' on database ' + database_name);
    db.db.command({compact: collection_name}, function(err_command, command_result) {
        winston.info('finished compacting collection ' + collection_name + ' on database ' + database_name);
        DatabaseMonitor.takeStats();
        callback2(err_command, command_result);
    });
}

function _repairDatabase(database_name, callback2) {
    var db = _getDatabaseFromName(database_name);

    if(!db) {
        callback2('database not found');
        return;
    }

    winston.info('began repairing database ' + database_name);
    db.db.command({repairDatabase: 1}, function(err_command, command_result) {
        if(command_result && !command_result.ok) {
            winston.error('failed to repair database: ' + command_result.errmsg);
        }
        winston.info('finished repairing database ' + database_name);
        DatabaseMonitor.takeStats();
        callback2(err_command, command_result);
    });
}

function _compactAndRepairDatabases(callback2) {
    var compact_tasks = [];

    var reserved_collection_names = [
        'system.indexes',
        'system.profile',
        'system.users'
    ];

    async.series({

        dynamic_database: function(callback) {
            DynamicDatabase.db.collections(function(err, collections) {
                collections.forEach(function(collection) {

                    // ignore system/overhead collections
                    if(reserved_collection_names.indexOf(collection.collectionName) == -1) {

                        // add a task to delete this collection's contents
                        compact_tasks.push(function(callback_task) {
                            _compactCollection(config['dynamic_database'].name, collection.collectionName, callback_task);
                        });
                    }
                });

                compact_tasks.push(function(callback_task) {
                    _repairDatabase(config['dynamic_database'].name, callback_task);
                });

                callback();
            });
        },

        semi_dynamic_database: function(callback) {
            SemiDynamicDatabase.db.collections(function(err, collections) {
                collections.forEach(function(collection) {

                    // ignore system/overhead collections
                    if(reserved_collection_names.indexOf(collection.collectionName) == -1) {

                        // add a task to delete this collection's contents
                        compact_tasks.push(function(callback_task) {
                            _compactCollection(config['semi_dynamic_database'].name, collection.collectionName, callback_task);
                        });
                    }
                });

                compact_tasks.push(function(callback_task) {
                    _repairDatabase(config['semi_dynamic_database'].name, callback_task);
                });

                callback();
            });
        },

        static_database: function(callback) {
            StaticDatabase.db.collections(function(err, collections) {
                collections.forEach(function(collection) {

                    // ignore system/overhead collections
                    if(reserved_collection_names.indexOf(collection.collectionName) == -1) {

                        // add a task to delete this collection's contents
                        compact_tasks.push(function(callback_task) {
                            _compactCollection(config['static_database'].name, collection.collectionName, callback_task);
                        });
                    }
                });

                compact_tasks.push(function(callback_task) {
                    _repairDatabase(config['static_database'].name, callback_task);
                });

                callback();
            });
        }
    }, function(err_async, async_results) {
        if(err_async) {
            callback2(err_async);
            return;
        }

        async.series(compact_tasks, function(err_delete, delete_results) {
            if(err_delete) {
                callback2(err_delete);
                return;
            }
            callback2(null, delete_results);
        });
    });
}