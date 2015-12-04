var winston = require('winston');

var RC = require('../router-common');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/customer-platforms/view', _handleCustomerPlatformView, true);

};

function _handleCustomerPlatformView(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        RC.render(req, res, 'customer-platform-list', {
            caller: caller,
            path: req.path
        });
    });
}