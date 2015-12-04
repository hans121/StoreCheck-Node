var winston = require('winston');
var ObjectId = require('mongodb').ObjectID;
var moment = require('moment');

var RC = require('../router-common');
var nodeUtils = require('../../modules/node-utils');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/system/resources/view', _handleViewSystemResources, true);
};

// === REQUEST HANDLERS

function _handleViewSystemResources(req, res){
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            RC.viewErrorCallbacks.on404(req, res);
            return;
        }

        RC.render(req, res, 'system-resources', {
            caller: caller,
            path: req.path
        });
    });
}