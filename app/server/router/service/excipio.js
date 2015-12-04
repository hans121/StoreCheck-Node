var _ = require('underscore');
var async = require('async');
var winston = require('winston');

var nodeUtils = require('../../modules/node-utils');
var RC = require('../router-common');

var ActionAuditModule = require('../../modules/action-audit');
var ExcipioExport = require('../../modules/excipio/excipio-export');
var ExcipioImport = require('../../modules/excipio/excipio-import');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/excipio-export', _handleExcipioExport, true);

    RC.addHandler(app, 'post', '/excipio-import', _handleExcipioImport);
};

// === REQUEST HANDLERS

function _handleExcipioExport(req, res){
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') != -1) {
            RC.logRequest(req, true, caller);
            _doExcipioExport(req, res, caller);
        } else {
            RC.viewErrorCallbacks.on404(req, res);
        }
    });
}

function _handleExcipioImport(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') != -1) {
            RC.logRequest(req, true, caller);

            var type = "general";
            if(!_.isUndefined(req.query.type)) {
                if(req.query.type != 'template' &&
                        req.query.type != 'pos' &&
                        req.query.type != 'general') {
                    res.send('unrecognized type', 500);
                    return;
                }
                type = req.query.type;
            }
            nodeUtils.runInBackground(function() {
                ExcipioImport.import(req.param('email'), type, function(err, results) {
                    ActionAuditModule.report(caller, 'update', 'excipio/import', type);
                    if(err != null) {
                        winston.error('during excipio import: ' + err);
                        return;
                    }
                    winston.info('excipio import complete');

                });
            });

            res.send({result: 'ok'}, 200);
            return;
        }
        RC.serviceErrorCallbacks.on404(req, res);
    });
}

function _doExcipioExport(req, res, caller) {
    ExcipioExport.export(caller.user, function(err) { // , results
        if(err) {
            winston.error('mass excipio export completed with error: ' + err);
            return;
        }
        winston.info('mass excipio export complete!');
    });
    res.redirect('/excipio-exports/view');
    //res.send({result: 'ok'}, 200);
}