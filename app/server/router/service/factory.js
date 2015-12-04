var _ = require('underscore');
var fs = require('fs');
var ObjectId = require('mongodb').ObjectID;

var Common = require('../router-common');
var nodeUtils = require('../../modules/node-utils');

var ActionAuditModule = require('../../modules/action-audit');
var FactoryHierarchyModule = require('../../modules/model/hierarchy/factory-hierarchy');
var FactoryModule = require('../../modules/model/hierarchy/factory');
var HierarchyProcessor = require('../../modules/model/hierarchy/hierarchy-processor');
var OrganizationModule = require('../../modules/model/organization');

module.exports = function(app) {

    // Processes contents of the factory-hierarchy static load table and creates more usable entires in
    // the static collection factory
    //
    // Error conditions:
    //     - Caller does not have factory/hierarchy create access
    Common.addHandler(app, 'post', '/factory-hierarchy/process', _handleProcessFactoryHierarchy);

    // Gets a factory list
    //
    // Error conditions:
    //     - Caller does not have factory/hierarchy read access
    Common.addHandler(app, 'get', '/factories', _handleGetFactories);

    // Query factories
    Common.addStandardWWBUQueryHandler(app, '/factory', FactoryModule, 'factories');

    // Gets a factory by ID
    //
    // Error conditions:
    //     - Caller does not have factory/hierarchy read access
    //     - The provided id is not of a valid format
    //     - No factory exists with the specified id
    //
    // Notes:
    //     - Cannot use getResourceById, because it does org-scoping
    Common.addHandler(app, 'get', '/factory/:id', _handleGetFactoryById);
};

// === REQUEST HANDLERS

function _handleInitFactoryHierarchy(caller, callback2) {
    FactoryHierarchyModule.removeAll(function(err) {
        var files = fs.readdirSync('data/factories');

        function _readFiles(files, callback) {
            if(files.length == 0) {
                callback();
                return;
            }
            FactoryHierarchyModule.readHierarchyFiles('data/factories/' + files[0], function(err, results) {
                files.shift();
                _readFiles(files, callback);
            });
        }

        _readFiles(files, function(err, results) {
            ActionAuditModule.report(caller, 'create', 'factory-hierarchy', 'init');
            callback2(err, results);
        })
    });
}

function _handleProcessFactoryHierarchy(req, res) {
    Common.ensureHasAccess(req, res, 'factory/hierarchy', 'c', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        _handleInitFactoryHierarchy(caller, function(err, results) {
            if(err != null) {
                res.send(err, 500);
                return;
            }

            var params = {
                static_load_name: 'factories',
                hierarchyModule: FactoryHierarchyModule,
                resultsModule: FactoryModule,
                hierarchyQuery: { hierarchy_level: '0'},
                recordPKs: ['company_id','category_id','code','identity_id','hierarchy_level'],
                orgCodeFunction: function(item) {
                    return item.code.split(' ')[0];
                }
            };

            HierarchyProcessor.process(params,
                function(err, added_count) {
                    if(err != null) {
                        res.send(err, 400);
                    } else {
                        ActionAuditModule.report(caller, 'create', 'factory-hierarchy', 'process');
                        res.send(added_count + "", 200);
                    }
                }
            );
        });
    });
}

function _handleGetFactories(req, res) {
    Common.ensureHasAccess(req, res, 'factory', 'l', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        Common.getStaticList('factories', FactoryModule, {}, Common.queryResultHandler(req, res, Common.serviceErrorCallbacks, function(factories) { // TODO: getScopedStaticList should be used!
            res.send(factories, 200);
        }));
    });
}

function _handleGetFactoryById(req, res) {
    Common.ensureHasAccess(req, res, 'factory', 'r', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var id = req.param('id');
        if(nodeUtils.isValidId(id)) {
            FactoryModule.findOneById(id, Common.queryResultHandler(req, res, Common.serviceErrorCallbacks, function(factory) {
                res.send(factory, 200);
            }));
        } else {
            Common.serviceErrorCallbacks.on500(req, res, Common.getInvalidIdMessage());
        }
    });
}