var schema = require('../../modules/model/schema/schema');
var formatter = require('../../modules/view-formatter');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var Common = require('../router-common');

var ActionAuditModule = require('../../modules/action-audit');
var nodeUtils = require('../../modules/node-utils');
var SampleModule = require('../../modules/model/sample');
var TemplateModule = require('../../modules/model/template');

module.exports = function(app) {

    // Creates a template
    //
    // Error conditions:
    //     - Caller isn't authorized to create templates
    //     - The request body fails validation against the schema
    //
    // Notes:
    //     - The created template will have the same organization as the caller
    //     - The created template will have state = "active"
    Common.addHandler(app, 'put', '/template', _handleCreateTemplate);

    // Deactivates template
    //
    // Error conditions:
    //     - Caller isn't authorized to delete templates
    //     - See getByIdIfAuthorized (template)
    //
    // Notes:
    //     - Templates cannot be deleted via the web interface,  only deactivated
    Common.addHandler(app, 'delete', '/template/:id', _handleDeleteTemplate);

    // Updates a template
    //
    // Query parameters:
    //     - state (optional) - the state to set for the given audit assignment ("active" or "inactive")
    //     - action (optional) - "duplicate"
    //
    // Error conditions:
    //     - See RouterCommon.getByIdIfAuthorized (template)
    //     - The supplied state was not valid
    //     - The supplied action was not valid
    //     - The caller does not have update template permissions
    //
    // Notes:
    //     - If no parameters are provided, a typical update is done
    //     - If state is provided, it is the only field that is updated
    Common.addHandler(app, 'post', '/template/:id', _handleUpdateTemplate);

    // Gets a template by id
    //
    // Error conditions:
    //     - See Common.getResourceById (template)
    Common.addHandler(app, 'get', '/template/:id', function(req, res) {
        Common.getResourceById(req, res, 'get', '/template/:id', 'template', TemplateModule);
    });

    // Gets a template list
    //
    // Error conditions:
    //     - Caller does not have template read access
    Common.addHandler(app, 'get', '/templates', _handleGetTemplates);
};

// === REQUEST HANDLERS

function _handleCreateTemplate(req, res) {
    Common.ensureHasAccess(req, res, 'template', 'c', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var template = req.body;
        var validation = schema.validate(req.body, schema.createTemplateSchema);
        if(validation.errors.length == 0) {
            template.version = schema.currentVersion;
            template.organization = req.session.user.active_organization;
            template.state = "active";
            template.read_only = false;
            TemplateModule.generateInsertionData(caller.name, template);
            TemplateModule.insert(template, function(e){
                if(e) {
                    ActionAuditModule.report(caller, 'create', 'template', template.name);
                    winston.log('debug', 'a POST /template request from user=' + caller.name + ' has succeeded');
                    Common.pushMessage(req, 'success', 'Successfully created audit grid template');
                    res.send(e[0]._id.toHexString(), 200);
                } else {
                    winston.log('warn', 'a POST /template request from user=' + caller.name + ' failed');
                    Common.pushMessage(req, 'error', 'Failed to create audit grid template');
                    res.send(e, 400);
                }
            });
        } else {
            winston.log('warn', 'a POST /template request from user=' + caller.name + ' had validation errors: ' + validation.errors);
            Common.pushMessage(req, 'error', 'Failed to create audit grid template because the request had format errors');
            res.send(validation.errors, 500);
        }
    });
}

function _handleUpdateTemplate(req, res) {
    Common.ensureHasAccess(req, res, 'template', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        Common.getByIdIfAuthorized(req, res, req.param('id'), 'template', TemplateModule, Common.serviceErrorCallbacks, function(template) {
            if(req.query["state"] != null) {
                var state = req.query["state"];
                _updateTemplateState(caller, req, res, template, state)

            } else if(req.query["action"] != null) {

                if(req.query["action"] == "duplicate") {
                    if(typeof(req.body.name) != 'undefined') {
                        _duplicateTemplate(caller, req, res, template, req.body.name);
                    } else {
                        res.send('name must be specified', 500);
                    }
                } else {
                    res.send('invalid action specified', 500);
                }
            } else {
                _updateTemplate(caller, req, res, template);
            }
        });
    });
}

function _handleDeleteTemplate(req, res) {
    Common.ensureHasAccess(req, res, 'template', 'd', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        Common.getByIdIfAuthorized(req, res, req.param('id'), 'template', TemplateModule, Common.serviceErrorCallbacks, function(template) {
            _updateTemplateState(caller, req, res, template, 'inactive');
        });
    });
}

function _handleGetTemplates(req, res) {
    Common.ensureHasAccess(req, res, 'template', 'l', Common.viewErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var query = {};
        var fields = {  };

        if(nodeUtils.isUserGlobal(caller)) {
            fields = { name: true, created_by: true, creation_time: true, language: true };
            TemplateModule.db.find(query, fields).toArray(function(err_templates, templates) {
                if(err_templates != null) {
                    Common.serviceErrorCallbacks.on500(req, res, err_templates);
                    return;
                }
                res.send(templates, 200);
            });
            return;
        }

        if(caller.organizations) {
            TemplateModule.listByOrganizations(caller.organizations, function(err_templates, templates) {
                if(err_templates != null) {
                    Common.serviceErrorCallbacks.on500(req, res, err_templates);
                    return;
                }
                res.send(templates, 200);
            });
            return;
        }

        Common.serviceErrorCallbacks.on404(req, res);
    });
}

// === HELPER

function _updateTemplateState(caller, req, res, template, state) {
    /*
    if(template.read_only && state != 'inactive') {
        winston.log('warn', 'an update template failed because the template was read-only');
        Common.pushMessage(req, 'error', 'Failed to change the state of a read-only audit grid template');
        res.send('audit grid is not editable', 500);
        return;
    }
*/
    TemplateModule.update({
        query: { '_id' : template._id },
        value: {
            $set : {
                state: state
            }
        }
    }, function(e, o) {
        if(e) {
            ActionAuditModule.report(caller, 'update', 'template/state', template.name + ' set to ' + state);
            winston.log('debug', 'a POST /template/:id?state=inactive request from user=' + caller.name + ' has succeeded');
            Common.pushMessage(req, 'success', 'Successfully de-activated audit grid template');
            res.send({result: 'ok'}, 200);
        } else{
            winston.log('warn', 'a POST /template/:id?state=inactive request from user=' + caller.name + ' failed');
            Common.pushMessage(req, 'error', 'Failed to de-activate audit grid template');
            res.send(e, 400);
        }
    });
}

// A helper that does validation, and specializes in the details of updating a template
//
// Error conditions:
//     - The request does not pass schema validation
//     - Something went wrong when using the mongo node driver
//     - The template is associated with a product/template pair
function _updateTemplate(caller, req, res, template) {
    var validation = schema.validate(req.body, schema.updateTemplateSchema);
    if(validation.errors.length == 0) {

        if(template.read_only) {
            winston.log('warn', 'an update template failed because the template was read-only');
            Common.pushMessage(req, 'error', 'Failed to change the state of a read-only audit grid template');
            res.send('audit grid is not editable', 500);
            return;
        }

        SampleModule.findOne({'template_id': template._id.toHexString()}, function(err, sample) {
            if(sample != null) {
                winston.log('warn', 'a POST /template request from user=' + caller.name + ' was rejected because the template was used to create a sample');
                Common.pushMessage(req, 'error', 'Failed to update audit grid template was rejected because the template was used to create a sample');
                res.send('Cannot edit template, because it was used to create a sample', 500);
            } else {
                var currentTimeString = formatter.getCurrentUtcTimeString();
                TemplateModule.update({
                    query: { '_id' : template._id },
                    value: {
                        $set : {
                            records: req.body.records,
                            name: req.body.name,
                            last_update_time: currentTimeString,
                            created_by: req.body.created_by
                        }
                    }
                }, function(e, o) {
                    if(e) {
                        ActionAuditModule.report(caller, 'update', 'template', template.name);
                        winston.log('debug', 'a POST /template request from user=' + caller.name + ' has succeeded');
                        Common.pushMessage(req, 'success', 'Successfully updated audit grid template');
                        res.send({result: 'ok'}, 200);
                    } else{
                        winston.log('warn', 'a POST /template request from user=' + caller.name + ' failed');
                        Common.pushMessage(req, 'error', 'Failed to update audit grid template');
                        res.send(e, 500);
                    }
                });
            }
        });
    } else {
        winston.log('warn', 'a POST /template request from user=' + caller.name + ' had validation errors: ' + validation.errors);
        Common.pushMessage(req, 'error', 'Failed to update audit grid template because the request had format errors');
        res.send(validation.errors, 500);
    }
}

// A helper that duplicates a template
//
// Error conditions:
//     - Something went wrong when using the mongo node driver
function _duplicateTemplate(caller, req, res, template, name) {
    delete template._id;
    var original_name = template.name;
    template.name = name;
    template.status = "active";
    template.read_only = false;
    TemplateModule.generateInsertionData(caller.name, template);
    TemplateModule.insert(template, function(e){
        if(e) {
            ActionAuditModule.report(caller, 'create', 'template', template.name + ' duplicated from ' + original_name);
            winston.log('debug', 'a POST /template duplicate request from user=' + caller.name + ' has succeeded');
            Common.pushMessage(req, 'success', 'Successfully duplicated audit grid template');
            res.send({result: 'ok'}, 200);
        } else {
            winston.log('warn', 'a POST /template duplicate request from user=' + caller.name + ' failed');
            Common.pushMessage(req, 'error', 'Failed to duplicate audit grid template');
            res.send(e, 400);
        }
    });
}

