var schema = require('../../modules/model/schema/schema');
var formatter = require('../../modules/view-formatter');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');
var _ = require('underscore');

var Common = require('../router-common');
var ActionAuditModule = require('../../modules/action-audit');
var AuditTeamModule = require('../../modules/model/audit-team');
var OrganizationModule = require('../../modules/model/organization');
var nodeUtils = require('../../modules/node-utils');

module.exports = function(app) {

    Common.addHandler(app, 'post', '/organization/O05/reload', _handleReloadHierarchyO05);

    // An admin method to make sure the minimum set of organization records is in the system
    //
    // Error conditions:
    //     - The caller does not have create organization permissions
    //
    // Notes:
    //     - User-added organizations are preserved
    Common.addHandler(app, 'post', '/organization/sync', _handleSyncOrganizations);

    // An admin method to make sure the minimum set of organization records is in the system
    //
    // Error conditions:
    //     - The request did not pass schema validation
    //     - The caller does not have create organization permissions
    //
    // Notes:
    //     - User-added organizations are preserved
    Common.addHandler(app, 'put', '/organization', _handleCreateOrganization);

    // Deletes an (active) organization.  Also, removes audit teams for the deleted organization (TODO: should it?)
    //
    // Error conditions:
    //     - Caller isn't authorized to delete organizations
    //     - See RouterCommon.getByIdIfAuthorized(organization)
    //     - The organization is inactive
    Common.addHandler(app, 'delete', '/organization/:id', _handleDeleteOrganization);

    // Updates an (active) organization
    //
    // Error conditions:
    //     - See getByIdIfAuthorized (organization)
    //     - The caller does not have access to update store checks
    //     - The specified organization is not active
    //
    // Notes:
    //     - Acceptable parameters: state={state}, action={"duplicate"}
    Common.addHandler(app, 'post', '/organization/:id', _handleUpdateOrganization);

    Common.addHandler(app, 'post', '/organization/settings/temperature', _handleUpdateOrganizationTemp);

    // Gets an organization by ID
    //
    // Error conditions:
    //     - See RouterCommon.getByIdIfAuthorized (organization)
    Common.addHandler(app, 'get', '/organization/:id', function(req, res) {
        Common.getResourceById(req, res, 'get', '/organization/:id', 'organization', OrganizationModule);
    });
};

// === REQUEST HANDLERS

function _handleReloadHierarchyO05(req, res) {
    Common.ensureHasAccess(req, res, 'organization', 'c', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        OrganizationModule.readO03File(req.files.files[0].path, function(err, result) {
            res.send({result: 'ok'}, 200);
        });
    });
}

function _handleSyncOrganizations(req, res) {
    Common.ensureHasAccess(req, res, 'organization', 'c', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        OrganizationModule.hierarchy_O03.find({}).toArray(function(err, organizations) {
            if(err != null) {
                res.send('could not load static organizations database', 500);
                return;
            }

            if(organizations == null || organizations.length == 0) {
                res.send('could not load any static organizations', 500);
                return;
            }

            function syncNextOrganization(index, onComplete) {
                _syncOrganization(organizations[index], function() {
                    index++;
                    if(index<organizations.length) {
                        syncNextOrganization(index, onComplete);
                    } else {
                        onComplete();
                    }
                });
            }

            syncNextOrganization(0, function() {
                ActionAuditModule.report(caller, 'update', 'organizations', 'sync');
                Common.pushMessage(req, 'success', 'Successfully synced organization');
                res.send({result: 'ok'}, 200);
            });
        });
    });
}

function _handleCreateOrganization(req, res) {
    Common.ensureHasAccess(req, res, 'organization', 'c', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var validation = schema.validate(req.body, schema.createOrganizationSchema);
        if(validation.errors.length == 0) {
            _.extend(req.body, {
                children: [],
                creation_time: formatter.getCurrentUtcTimeString(),
                type: 'WWBU',
                version: schema.currentVersion,
                state: "active"
            });
            OrganizationModule.insert(req.body, function(e){
                if(e) {
                    ActionAuditModule.report(caller, 'create', 'organization', req.body.name);
                    winston.log('debug', 'a PUT /organization request from user=' + caller.name + ' has succeeded');
                    Common.pushMessage(req, 'success', 'Successfully created organization');
                    res.send(e[0]._id.toHexString(), 200);
                } else {
                    winston.log('warn', 'a PUT /organization request from user=' + caller.name + ' failed');
                    Common.pushMessage(req, 'error', 'Failed to create organization');
                    res.send(e, 400);
                }
            });
        } else {
            winston.log('warn', 'a PUT /organization request from user=' + caller.name + ' had validation errors: ' + validation.errors);
            res.send(validation.errors, 500);
        }
    });
}

function _handleUpdateOrganization(req, res) {
    Common.ensureHasAccess(req, res, 'organization', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var validation = schema.validate(req.body, schema.updateOrganizationSchema);
        if(validation.errors.length == 0) {

            // get the resource via a convenience method that does the necessary security checks and id validation
            Common.getByIdIfAuthorized(req, res, req.param('id'), 'organization', OrganizationModule, Common.serviceErrorCallbacks, function(organization) {
                if(organization.state == 'active' || req.body.state == 'active') {
                    var data = {
                        name: req.body.name,
                        code: req.body.code,
                        state: req.body.state
                    };
                    if(!_.isUndefined(req.body.settings)) {
                        data.settings = req.body.settings;
                    } else {
                        // no settings are in req, but org has some -> clear settings
                        if(!_.isUndefined(organization.settings)) {
                            data.settings = {};
                        }
                    }
                    OrganizationModule.update({
                        query: { '_id' : organization._id },
                        value: {
                            $set : data
                        }
                    }, function(e, o) {
                        if(e) {
                            ActionAuditModule.report(caller, 'update', 'organization', organization.name);
                            winston.log('debug', 'a POST /organization request from user=' + caller.name + ' has succeeded for organization with name=' + req.body.name);
                            Common.pushMessage(req, 'success', 'Successfully updated organization');
                            res.send({result: 'ok'}, 200);
                        } else {
                            winston.log('warn', 'a POST /organization request from user=' + caller.name + ' failed for organization with name=' + req.body.name);
                            Common.pushMessage(req, 'error', 'Failed to update organization');
                            res.send('Failed to update organization', 400);
                        }
                    });
                } else {
                    winston.log('warn', 'a POST /organization request from user=' + caller.name + ' failed for organization with name=' + req.body.name + ' because is it not active');
                    Common.pushMessage(req, 'error', 'Failed to update organization because it was inactive');
                    Common.serviceErrorCallbacks.on500(req, res, 'Failed to update organization because it was inactive');
                }
            });
        } else {
            winston.log('warn', 'a POST /organization request from user=' + caller.name + ' had validation errors: ' + validation.errors);
            Common.pushMessage(req, 'error', 'Failed to update organization because the request had format errors');
            res.send(validation.errors, 500);
        }
    });
}

function _handleDeleteOrganization(req, res) {
    Common.ensureHasAccess(req, res, 'organization', 'd', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        // get the resource via a convenience method that does the necessary security checks and id validation
        Common.getByIdIfAuthorized(req, res, req.param('id'), 'organization', OrganizationModule, Common.serviceErrorCallbacks, function(organization) {
            if(organization.state == 'active') {
                OrganizationModule.delete({_id: organization._id}, function(e) {
                    if(e) {
                        ActionAuditModule.report(caller, 'delete', 'organization', organization.name);

                        // TODO: maybe think about erasing store checks, etc?
                        AuditTeamModule.delete({organization: organization._id.toHexString()}, function(e) {

                            winston.log('debug', 'a DELETE /organization/:id request from user=' + caller.name + ' has succeeded for organization with id=' + organization._id.toHexString());
                            Common.pushMessage(req, 'success', 'Successfully deleted organization');
                            res.send({result: 'ok'}, 200);
                        });
                    } else {
                        winston.log('warn', 'a DELETE /organization/:id request from user=' + caller.name + ' failed for organization with id=' + organization._id.toHexString());
                        Common.pushMessage(req, 'error', 'Failed to delete organization');
                        res.send('Failed to delete organization', 400);
                    }
                });
            } else {
                winston.log('warn', 'a DELETE /organization/:id request from user=' + caller.name + ' failed for organization with id=' + organization._id.toHexString() + ' because it was inactive');
                Common.pushMessage(req, 'error', 'Failed to delete organization because it was inactive');
                res.send('Failed to delete organization because it was inactive', 400);
            }
        });
    });
}

function _handleUpdateOrganizationTemp(req, res) {
    Common.ensureHasAccess(req, res, 'organization/settings/temperature', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        //var validation = schema.validate(req.body, schema.organizationTemperatureSchema);
        // TODO: validation
        var validation = {errors: []};
        if(validation.errors.length == 0) { // _.keys(req.body).length == 0 ||
            OrganizationModule.findOneById(caller.active_organization, function(err_org, organization) {
                if(organization.state == 'active') {
                    function onOrganizationUpdated(err, update_result) {
                        if(update_result) {
                            ActionAuditModule.report(caller, 'update', 'organization/temperature', organization.name);
                            winston.log('debug', 'a POST /organization/settings/temperature request from user=' + caller.name + ' has succeeded for organization with id=' + organization._id.toHexString());
                            Common.pushMessage(req, 'success', 'Successfully update organization temperature settings');
                            res.send({result: 'ok'}, 200);
                        } else {
                            winston.log('warn', 'a POST /organization/settings/temperature request from user=' + caller.name + ' has failed for organization with id=' + organization._id.toHexString());
                            Common.pushMessage(req, 'error', 'Failed to update organization temperature settings');
                            res.send('Failed to update organization temperature settings', 400);
                        }
                    }

                    if(_.keys(req.body).length == 0) { // "erasing"
                        OrganizationModule.collection.update({_id: organization._id}, {$unset: {'settings.temperature_ranges': ''}}, function(err, update_result) {
                            onOrganizationUpdated(err, update_result);
                        })
                    } else {
                        OrganizationModule.collection.update({_id: organization._id}, {$set: {'settings.temperature_ranges': req.body.temperature_ranges}}, function(err, update_result) {
                            onOrganizationUpdated(err, update_result);
                        });
                    }

                } else {
                    winston.log('warn', 'a POST /organization/settings/temperature request from user=' + caller.name + ' failed for organization with id=' + organization._id.toHexString() + ' because it was inactive');
                    Common.pushMessage(req, 'error', 'Failed to update organization temperature settings because it was inactive');
                    res.send('Failed to update organization temperature settings sbecause it was inactive', 400);
                }
            });
        } else {
            winston.log('warn', 'a POST /organization/settings/temperature request from user=' + caller.name + ' had validation errors: ' + validation.errors);
            res.send(validation.errors, 500);
        }
    });
}

// === HELPERS

// Ensures an organization exists, and if it already exists, the organization code is set
//
// Error conditions:
//     -
//
// Notes:
//     - Does not convey any errors that occur
function _syncOrganization(organization_info, onComplete) {
    OrganizationModule.findOne({code: organization_info.description3}, function(err, result) {
        var templates = [];
        if(organization_info.group_code.indexOf('Waters') != -1) {
            templates.push('Waters');
        }
        if(organization_info.group_code.indexOf('Dairy') != -1) {
            templates.push('Dairy');
        }
        if(organization_info.group_code.indexOf('Baby') != -1) {
            templates.push('Baby');
        }

        if(err == null && result != null) {
            var settings = result.settings ? result.settings : {};
            settings.templates = templates;
            OrganizationModule.update({
                    query: { _id: result._id },
                    value: { $set:
                        {
                            company_id: organization_info.company_id,
                            type: 'WWBU',
                            name: organization_info.description1,
                            group_code: organization_info.group_code,
                            settings: settings
                        }
                    }
            }, function(e) {
                if(e) {
                    winston.log('info', 'a /organization/update while syncing has updated the code for organization with name ' + organization_info.description1);
                } else {
                    winston.log('warn', 'a /organization/update while syncing has failed to update the code for organization with name ' + organization_info.description1);
                }
                onComplete();
            });
        } else if(err == null) {
            if(organization_info.description3.trim().length == 0) {
                onComplete();
                return;
            }
            var new_organization = {
                children: [],
                creation_time: formatter.getCurrentUtcTimeString(),
                type: 'WWBU',
                version: schema.currentVersion,
                state: "active",
                code: organization_info.description3,
                name: organization_info.description1,
                group_code: organization_info.group_code,
                templates: templates
            };
            OrganizationModule.insert(new_organization, function(e) {
                if (e){
                    winston.log('info', 'an /organization/create while syncing has inserted organization with name ' + organization_info.name);
                } else {
                    winston.log('warn', 'an /organization/create while syncing has failed while inserting organization with name ' + organization_info.name);
                }
                onComplete();
            });
            winston.log('info', 'prepping insert of ' + organization_info.name);
        } else {
            onComplete();
            winston.log('warning', 'organization/sync encountered an error for organization.name=' + organization_info.name);
        }
    });
}