var moment = require('moment');

var RC = require('../router-common');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/response-times/view', _handleResponseTimesView, true);
};

function _handleResponseTimesView(req, res) {

    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForServiceMethod, function(caller) {
        RC.logRequest(req, true, caller);

        if (caller.roles.indexOf('admin') == -1) {
            RC.viewErrorCallbacks.on404(req, res);
            return;
        }

        RC.render(req, res, 'response-times', {
            moment: moment,
            caller: caller,
            path: req.path
        });
    });
}