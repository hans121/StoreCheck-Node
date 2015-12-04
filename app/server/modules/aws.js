var AWS = require('aws-sdk');
var winston = require('winston');

var dynamic_config = require('./dynamic-config');

module.exports = {
    init: _initAWS,
    getConfig: _getConfig
};

function _initAWS(callback) {
    if(!dynamic_config.collection || !dynamic_config.collection.db.is_connected) {
        setTimeout(function() {
            _initAWS(callback);
        }, 3000);
        return;
    }

    winston.info('initializing AWS');
    dynamic_config.findOne({key: 'aws'}, function(err, aws_config) {
        if (err) {
            callback(err);
            return;
        }
        if (aws_config == null) {
            callback('could not load AWS configuration');
            return;
        }

        AWS.config.update({ accessKeyId: aws_config.values.AWSAccessKey, secretAccessKey: aws_config.values.AWSSecretKey, region: aws_config.values.AWSS3Region });
        winston.info('initialized AWS');
        callback();
    });
}

function _getConfig(callback) {
    dynamic_config.findOne({key: 'aws'}, function(err, aws_config) {
        callback(err, aws_config);
    });
}

_initAWS(function() {});