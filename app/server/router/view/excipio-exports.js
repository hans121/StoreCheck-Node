var moment = require('moment');

var RC = require('../router-common');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/excipio-export/view', _handleExportView, true);

    RC.addHandler(app, 'get', '/excipio-exports/view', _handleExportsView, true);
};

function _handleExportView(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForServiceMethod, function(caller) {
        RC.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            RC.viewErrorCallbacks.on404(req, res);
            return;
        }

        RC.render(req, res, 'excipio-export', {
            moment: moment,
            caller: caller,
            path: req.path
        });
    });
}

function _handleExportsView(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForServiceMethod, function(caller) {
        RC.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            RC.viewErrorCallbacks.on404(req, res);
            return;
        }

        RC.render(req, res, 'excipio-exports', {
            moment: moment,
            caller: caller,
            path: req.path
        });
    });
}