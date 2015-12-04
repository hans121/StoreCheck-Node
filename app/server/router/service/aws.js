var AWS = require('aws-sdk');
var winston = require('winston');

var Common = require('../router-common');

var ActionAuditModule = require('../../modules/action-audit');

module.exports = function (app) {

    // Deleted an image
    //
    // Error conditions:
    //     -
    Common.addHandler(app, 'delete', '/aws/image', _handleAWSDelete);
};

// === REQUEST HANDLERS

function _handleAWSDelete(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForViewMethod, function(caller) {
        if(caller.roles.indexOf('admin') != -1) {
            var s3 = new AWS.S3();
            var bucket = 'store_check';
            var params = { Bucket: bucket, Key: req.param('key') };

            s3.deleteObject(params, function(err, result) {
                if(err == null) {
                    ActionAuditModule.report(caller, 'delete', 'aws/image', params.Key);
                    res.send(result, 200);
                } else {
                    res.send(err, 500);
                }
            });
        } else {
            Common.viewErrorCallbacks.on404(req, res);
        }
    });
}