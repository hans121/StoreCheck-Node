var db = require('./database/semi-dynamic-database');
var dynamic_config = db.db.collection('dynamic-config');
var nodeutils = require('./node-utils');
var dbUtils = require('./database/database-utils');
var EM = require('./email-dispatcher');
var aws = require('./aws');

dbUtils.addStandardMethods(exports, dynamic_config);

// string type
// boolean active
// keys: {}

exports.keys = {
    AUTO_BACKUP_DATABASES: 'auto-backup-databases',
    AUTO_COMPACT_DATABASES: 'auto-compact-databases',
    AUTO_IMPORT_HIERARCHIES: 'auto-import-hierarchies',
    AWS: "aws",
    EMAIL: "email",
    EXCIPIO_EXPORT: "excipio-export"
};

exports.init = function(callback) {
    var records = [];

    records.push({
        key: exports.keys.EMAIL,
        active: true,
        values: {
            "host" : "email-smtp.us-east-1.amazonaws.com",
            "user" : "AKIAJOLXVTIXUEQKYGNQ",
            "password" : "AsCFeyxOyO8jFCDvXglsLW0zAd57orSxLf4NpA0pEtRw",
            "sender" : "storecheck.users@gmail.com",
            "ssl" : false,
            "tls" : true,
            "port" : 587
            /*
            host: "smtp.gmail.com",
            user: "storecheck.users",
            password: "CheckStoresD4123",
            sender: "storecheck.users@gmail.com",
            ssl: false,
            tls: true,
            port: 587
            */
        }
    });

    records.push({
        key: exports.keys.AWS,
        active: true,
        values: {
            "AWSAccessKey": "AKIAIIALBNOMWSZRPLVA",
            "AWSSecretKey": "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",
            "AWSS3Region": "us-east-1",
            "RootURL": "https://s3.amazonaws.com/store_check/"
        }
    });

    records.push({
        key: exports.keys.AUTO_IMPORT_HIERARCHIES,
        active: false,
        values: {}
    });

    exports.removeAll(function(err, removed) {
        dynamic_config.insert(records, {safe: true}, function(err, inserted) {
            aws.init(function(err_aws_init, aws_init_result) {
                EM.semaphore.take(function() {
                    EM.reconnect(function(err_reconnect, reconnect_res) {
                        EM.semaphore.leave();
                        callback(err, inserted);
                    });
                });
            });
        });
    });
};

// releasing samples

var default_states_causing_export = ['released', 'validated'];

exports.getExportSampleStatesFromConfig = function(config_result) {
    if(!config_result) {
        return default_states_causing_export;
    }

    if(!config_result.values) {
        return default_states_causing_export;
    }

    return config_result.values.sample_states_to_export ? config_result.values.sample_states_to_export : default_states_causing_export;
};

exports.getSampleStatesCausingExport = function(callback2) {
    dynamic_config.findOne({key: exports.keys.EXCIPIO_EXPORT}, function(err_config, config_result) {
        if(err_config) {
            callback2(err_config);
            return;
        }

        callback2(null, exports.getExportSampleStatesFromConfig(config_result));
    });
};