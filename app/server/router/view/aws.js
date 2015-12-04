var _ = require('underscore');
var async = require('async');
var AWS = require('aws-sdk');
var moment = require('moment');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var AWSModule = require('../../modules/aws');
var nodeUtils = require('../../modules/node-utils');
var RC = require('../router-common');
var formatter = require('../../modules/view-formatter');
var SampleModule = require('../../modules/model/sample');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/aws/images/view', _handleAWSImagesView, true);
};

// === REQUEST HANDLERS

function _handleAWSImagesView(req, res){
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') != -1) {
            var s3 = new AWS.S3();
            var bucket = 'store_check';
            var params = { Bucket: bucket };

            s3.listObjects(params, function(err, bucket) {
                if(err != null) {
                    RC.viewErrorCallbacks.on500(req, res, 'AWS Error: ' + err.message);
                    return;
                }

                bucket.Contents = _.filter(bucket.Contents, function(bucket_item) {
                    return bucket_item.Size > 0 && bucket_item.Key[0] != '/';
                });
                var bucket_contents = _.map(bucket.Contents, function(bucket_item) {
                    return {
                        key: bucket_item.Key,
                        last_modified: formatter.getUtcTimeString(moment(bucket_item.LastModified)),//moment(bucket_item.LastModified).format('X'),
                        size: bucket_item.Size,
                        formatted_size: nodeUtils.bytesToSize(bucket_item.Size)
                    };
                });

                AWSModule.getConfig(function(err_aws_config, aws_config) {
                    RC.render(req, res, 'aws-images', {
                        bucket: bucket_contents,
                        aws_config: aws_config.values,
                        formatter: formatter,
                        caller: caller,
                        path: req.path
                    });
                });
            });
        } else {
            RC.viewErrorCallbacks.on404(req, res);
        }
    });
}