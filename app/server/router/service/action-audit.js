var winston = require('winston');
var _ = require('underscore');

var RC = require('../router-common');
var ActionAuditModule = require('../../modules/action-audit');

module.exports = function(app) {

    // Creates a product
    //
    // Error conditions:
    //     - Caller isn't authorized to view action-audit lists
    RC.addHandler(app, 'get', '/action-audits', _listActionAudits, true);
};

function _listActionAudits(req, res){
    RC.ensureHasAccess(req, res, 'action-audit', 'l', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        var query = {};

        if(!_.isUndefined(req.query['exclude-resources'])) {
            var exclusions = req.query['exclude-resources'].split(',');

            query = _.extend(query, {resource: {$not: {$in: exclusions}}});
        }

        RC.scopedFind(req, res, 'action-audit', ActionAuditModule, query, {limit: 1500, sort: [['_id',-1]]}, RC.viewErrorCallbacks, function(audit_records) {
            winston.log('debug', 'returning action history for user=' + caller.name);
            res.send(audit_records, 200);
        });
    });
}