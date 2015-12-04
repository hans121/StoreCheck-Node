var _ = require('underscore');
var fs = require('fs');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var schema = require('../../modules/model/schema/schema');
var formatter = require('../../modules/view-formatter');

var Common = require('../router-common');
var ActionAuditModule = require('../../modules/action-audit');
var HierarchyModule5 = require('../../modules/model/hierarchy/audit-grid-hierarchy-level5');
var HierarchyTranslationModule5 = require('../../modules/model/hierarchy/audit-grid-hierarchy-translation-level5');
var OrganizationModule = require('../../modules/model/organization');
var StaticLoadModule = require('../../modules/static-loads');

module.exports = function(app) {

    Common.addHandler(app, 'post', '/template-hierarchy/EPC/reload', _handleReloadTemplateHierarchyExcipio);

    Common.addHandler(app, 'post', '/template-hierarchy/EPC/language/reload', _handleReloadTemplateHierarchyExcipioTranslation);

    // Note: can provide "latest" as the timestamp
    Common.addHandler(app, 'get', '/template/level/:level/:timestamp', _handleGetTemplateHierarchyLevel);

};

// === REQUEST HANDLERS

// TODO: double-check AUTH
function _handleReloadTemplateHierarchyExcipio(req, res) {
    var files = _.isArray(req.files.files[0]) ? req.files.files[0] : [req.files.files[0]];

    HierarchyModule5.reload(files, function() {
        ActionAuditModule.report(req.session.user, 'reload', 'template/hierarchy/5');
        res.send({result: 'ok'}, 200);
    });
}

// TODO: double-check AUTH
function _handleReloadTemplateHierarchyExcipioTranslation(req, res) {
    var files = _.isArray(req.files.files[0]) ? req.files.files[0] : [req.files.files[0]];

    var date = new Date();

    HierarchyTranslationModule5.reloadAsJob(files, function(err_process) { // process_result
        if(err_process != null) {
            winston.error(err_process);
        } else {
            winston.info('hierarchy translation complete');
            ActionAuditModule.report(req.session.user, 'reload', 'template/hierarchy-translation/5', 'completed: from ' + date + ' to ' + new Date());

            // job is complete, but user does not expect response
        }
    });

    winston.info('scheduled audit grid translation processing task');
    res.send({result: 'background process began'}, 200);
}

function _handleGetTemplateHierarchyLevel(req, res) {
    Common.ensureHasAccess(req, res, 'template/hierarchy', 'r', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var timestamp = req.params['timestamp'];
        var level = req.params['level'];
        var language = 'en';

        if(req.query.language == null) {
            winston.log('warning', 'A template level was requested without specifying the language');
            Common.serviceErrorCallbacks.on500(req, res, 'No language specified');
            return;
        }
        language = req.query.language;
        if(req.query.company_id == null) {
            winston.log('warning', 'A template level was requested without specifying the company_id');
            Common.serviceErrorCallbacks.on500(req, res, 'No company_id specified');
            return;
        }
        /*
        if(req.query.t03_code == null) {
            winston.log('warning', 'A template level was requested without specifying the t03_code');
            Common.serviceErrorCallbacks.on500(req, res, 'No t03_code specified');
            return;
        }
        */
        OrganizationModule.listByIds(caller.organizations, function(err_orgs, organizations) {
            var settings = _.pluck(_.filter(organizations, function(org) { return typeof(org.settings) != 'undefined'; }), 'settings');
            var templates = _.compact(_.flatten(_.pluck(settings, 'templates')));
            if(language == 'en') {
                // search for load
                if(timestamp == 'latest') {
                    StaticLoadModule.findLatest('audit-grid-hierarchy-L' + level, Common.queryResultHandler(req, res, Common.serviceErrorCallbacks, function(item) {
                        Common.getTemplateLevel(function(data, code) {
                            res.send(data, code);
                        }, level, req.query.company_id, req.query.t03_code, templates, language, item.timestamp);
                    }));
                } else {
                    StaticLoadModule.find({type: 'audit-grid-hierarchy-L' + level, timestamp: timestamp}, Common.queryResultHandler(req, res, Common.serviceErrorCallbacks, function() { // load
                        Common.getTemplateLevel(function(data, code) {
                            res.send(data, code);
                        }, level, req.query.company_id, req.query.t03_code, templates, language, timestamp);
                    }));
                }

            } else {
                if(timestamp == 'latest') {
                    StaticLoadModule.findLatest('audit-grid-hierarchy-translation-L' + level, Common.queryResultHandler(req, res, Common.serviceErrorCallbacks, function(item) {
                        Common.getTemplateLevel(function(data, code) {
                            res.send(data, code);
                        }, level, req.query.company_id, req.query.t03_code, templates, language, item.timestamp);
                    }));
                } else {
                    StaticLoadModule.find({type: 'audit-grid-hierarchy-translation-L' + level, timestamp: timestamp}, Common.queryResultHandler(req, res, Common.serviceErrorCallbacks, function() { // load
                        Common.getTemplateLevel(function(data, code) {
                            res.send(data, code);
                        }, level, req.query.company_id, req.query.t03_code, templates, language, timestamp);
                    }));
                }
            }
        });
    });
}