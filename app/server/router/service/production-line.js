var fs = require('fs');
var ObjectId = require('mongodb').ObjectID;

var ActionAuditModule = require('../../modules/action-audit');
var Common = require('../router-common');
var HierarchyModule = require('../../modules/model/hierarchy/hierarchy-processor');
var ProductionLineModule = require('../../modules/model/hierarchy/production-line');
var ProductionLineHierarchyModule = require('../../modules/model/hierarchy/production-line-hierarchy');

module.exports = function(app) {

    // Processes contents of the production-line-hierarchy static load table and creates more usable entires in
    // the static collection production-line
    //
    // Error conditions:
    //     - Caller does not have pos/hierarchy create access
    Common.addHandler(app, 'post', '/production-line-hierarchy/process', _handleProcessProductionLineHierarchy);

    // === GET METHODS

    // Query production lines
    Common.addStandardQueryHandler(app, '/production-line', ProductionLineModule, 'production-lines', true);

    // Gets a production line by ID
    //
    // Error conditions:
    //     - See RouterCommon.getByIdIfAuthorized (production-line)
    Common.addHandler(app, 'get', '/production-line/:id', function(req, res) {
        Common.getResourceById(req, res, 'get', '/production-line/:id', 'production-line', ProductionLineModule);
    });
};

// === REQUEST HANDLERS

function _handleInitProductionLineHierarchy(req, res, callback2) {
    Common.ensureHasAccess(req, res, 'production-line/hierarchy', 'c', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        ProductionLineHierarchyModule.removeAll(function(err) {
            var files = fs.readdirSync('data/production_lines');

            function _readFiles(files, callback) {
                if(files.length == 0) {
                    callback();
                    return;
                }
                ProductionLineHierarchyModule.readHierarchyFiles('data/production_lines/' + files[0], function(err, results) {
                    files.shift();
                    _readFiles(files, callback);
                });
            }

            _readFiles(files, function(err, results) {
                ActionAuditModule.report(caller, 'create', 'production-line/hierarchy', 'init');
                callback2(err, results);
            })
        });
    });
}

function _handleProcessProductionLineHierarchy(req, res) {
    Common.ensureHasAccess(req, res, 'production-line/hierarchy', 'c', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        _handleInitProductionLineHierarchy(req, res, function(err) { //results
            if(err != null) {
                res.send(err, 500);
                return;
            }

            var params = {
                static_load_name: 'production-lines',
                hierarchyModule: ProductionLineHierarchyModule,
                resultsModule: ProductionLineModule,
                hierarchyQuery: { hierarchy_level: '0' },
                recordPKs: ['company_id', 'category_id', 'hierarchy_level', 'identity_id'],
                orgCodeFunction: function(item) {
                    return item.code.split(' ')[0];
                }
            };

            HierarchyModule.process(params, function(err, added_count) {
                if(err != null) {
                    res.send(err, 400);
                } else {
                    ActionAuditModule.report(caller, 'create', 'production-line/hierarchy', 'process');
                    res.send(added_count + "", 200);
                }
            });
        });
    });
}