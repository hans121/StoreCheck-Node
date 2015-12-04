var _ = require('underscore');
var async = require('async');
var ObjectId = require('mongodb').ObjectID;
var moment = require('moment');
var winston = require('winston');

var RC = require('../router-common');
var nodeUtils = require('../../modules/node-utils');
var formatter = require('../../modules/view-formatter');
var language = require('../../modules/language-list');

var HierarchyL5Module = require('../../modules/model/hierarchy/audit-grid-hierarchy-level5');
var HierarchyTranslationModule5 = require('../../modules/model/hierarchy/audit-grid-hierarchy-translation-level5');
var HierarchyStatic = require('../../modules/model/hierarchy/template-static-hierarchy');
var OrganizationModule = require('../../modules/model/organization');
var StaticLoadModule = require('../../modules/static-loads');
var TemplateModule = require('../../modules/model/template');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/templates/view', _handleTemplatesView, true);

    RC.addHandler(app, 'get', '/template/view/create', _handleCreateTemplatesView, true);

    RC.addHandler(app, 'get', '/template/view/:id', _handleTemplateView, true);

    RC.addHandler(app, 'get', '/template/hierarchies/view', _handleTemplateHierarchiesView, true);
};

// === REQUEST HANDLERS

function _handleTemplatesView(req, res) {
    RC.ensureHasAccess(req, res, 'template', 'l', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        RC.render(req, res, 'template-list', {
            formatter: formatter,
            caller: caller,
            path: req.path
        });
    });
}

function _handleCreateTemplatesView(req, res) {
    RC.ensureHasAccess(req, res, 'template', 'c', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        var l1_t02 = [];
        async.series({
            l1_t02: function(callback) {
                OrganizationModule.listByIds(caller.organizations, function(err_orgs, organizations) {
                    var settings = _.pluck(_.filter(organizations, function(org) { return typeof(org.settings) != 'undefined'; }), 'settings');
                    var templates = _.compact(_.flatten(_.pluck(settings, 'templates')));
                    l1_t02 = _.uniq(templates);
                    callback();
                });
            },

            languages: function(callback) {
                HierarchyTranslationModule5.listLanguages(function(err, languages) {
                    callback(err, languages);
                });
            },

            l1_items: function(callback) {
                HierarchyL5Module.getLevel1Codes(l1_t02, function (err, hierarchy_results) {
                    callback(err, hierarchy_results);
                });
            }
        }, function(err, results) {
            if(err) {
                RC.render500(req, res, 'No T03 hierarchies were found');
                return;
            }

            RC.render(req, res, 'template-create', {
                level1_items : !_.isUndefined(results.l1_items) ? results.l1_items : [],
                languages: language,
                allow_languages: results.languages,
                caller: caller,
                path: req.path
            });
        });
    });
}

function _handleTemplateView(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        var id = req.params['id'];
        winston.log('debug', 'processing a /template/view/' + id + ' request from user=' + caller.name);
        RC.getByIdIfAuthorized(req, res, id, 'template', TemplateModule, RC.viewErrorCallbacks, function(template) {
            RC.render(req, res, 'template', {
                template: template,
                id : id,
                caller: req.session.user,
                path: req.path
            });
        });
    });
}

function _handleTemplateHierarchiesView(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            RC.viewErrorCallbacks.on404(req, res);
            return;
        }

        HierarchyStatic.hierarchy_excipio.find({}).toArray(function(err, raw_hierarchy) {
            raw_hierarchy = _.isUndefined(raw_hierarchy) ? [] : raw_hierarchy;
            StaticLoadModule.findLatest('audit-grid-hierarchy-L5', RC.queryResultHandler(req, res, RC.serviceErrorCallbacks, function(template_record) {
                HierarchyL5Module.find({timestamp: template_record.timestamp}, function(err, L5_items) {

                    StaticLoadModule.findLatest('audit-grid-hierarchy-translation-L5', RC.queryResultHandler(req, res, RC.serviceErrorCallbacks, function(translation_record) {
                        HierarchyTranslationModule5.find({timestamp: translation_record.timestamp}, function(err, L5_language_items) {
                            RC.render(req, res, 'template-hierarchies', {
                                L5_items : L5_items,
                                L5_language_items: L5_language_items,
                                raw_hierarchy: raw_hierarchy,
                                caller: req.session.user,
                                path: req.path
                            });
                        });
                    }));
                });
            }));
        });
    });
}