var _ = require('underscore');
var async = require('async');
var moment = require('moment');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var nodeUtils = require('../modules/node-utils');
var RC = require('./router-common');
var formatter = require('../modules/view-formatter');

var ActionAuditModule = require('../modules/action-audit');
var AdminAreaModule = require('../modules/model/hierarchy/admin-area');
var AM = require('../modules/account-manager');
var CountryModule = require('../modules/model/world/countries');
var CustomerModule = require('../modules/model/hierarchy/customer');
var FactoryModule = require('../modules/model/hierarchy/factory');
var ProvinceModule = require('../modules/model/world/provinces');
var ProductionLineModule = require('../modules/model/hierarchy/production-line');
var SampleModule = require('../modules/model/sample');
var StaticLoadModule = require('../modules/static-loads');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/home', _renderHome, true);

    RC.addHandler(app, 'get', '/factories/view', _handleFactoriesView, true);

    RC.addHandler(app, 'get', '/factory/:id/view', _handleFactoryView, true);

    RC.addHandler(app, 'get', '/production-lines/view', _handleProductionLinesView, true);

    RC.addHandler(app, 'get', '/production-line/:id/view', _handleProductionLineView, true);

    RC.addHandler(app, 'get', '/action-audits/view', _handleActionAuditsView, true);

    RC.addHandler(app, 'get', '/administrative-areas/view', _handleAdministrativeAreasView, true);

    RC.addHandler(app, 'get', '/static-loads/view', _handleStaticLoadsView, true);

    RC.addHandler(app, 'get', '/customers/view', _handleCustomersView, true);

    RC.addHandler(app, 'get', '/world/countries/view', _handleCountriesView, true);

    RC.addHandler(app, 'get', '/world/country/:code', _handleCountryView, true);

    RC.addHandler(app, 'get', '/reports', _handleReportsView, true);

    RC.addHandler(app, 'get', '/report/samples/view', _handleRenderSamplesReport, true);

    RC.addHandler(app, 'get', '*', function(req, res) { RC.render404(req, res); }, true);

};

function _renderHome(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        if(_.contains(caller.roles, 'auditor')) {
            res.redirect('/visits/view');
        } else if(_.contains(caller.roles, 'supervisor')) {
            res.redirect('/store-checks/view');
        } else if(_.contains(caller.roles, 'CBU')) {
            res.redirect('/store-checks/view');
        } else if(_.contains(caller.roles, 'exec')) {
            res.redirect('/users/view');
        } else if(caller != null) {
            RC.render(req, res, 'home', {
                caller: caller,
                path: req.path
            });
        }
    });
}

function _handleFactoryView(req, res) {
    RC.getByIdIfAuthorized(req, res, req.param('id'), 'factory', FactoryModule, RC.viewErrorCallbacks, function(factory, caller) {
        RC.logRequest(req, true, caller);

        RC.render(req, res, 'factory', {
            factory: factory,
            caller: req.session.user,
            formatter: formatter,
            path: req.path
        });
    });
}

function _handleFactoriesView(req, res) {
    RC.ensureHasAccess(req, res, 'factory', 'l', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        RC.getStaticList('factories', FactoryModule, {}, RC.queryResultHandler(req, res, RC.viewErrorCallbacks, function(factories) {
            RC.render(req, res, 'factory-list', {
                factories : factories,
                caller: caller,
                path: req.path
            });
        }));
    });
}

function _handleProductionLinesView(req, res) {
    RC.ensureHasAccess(req, res, 'production-line', 'l', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        RC.getStaticList('production-lines', ProductionLineModule, {}, RC.queryResultHandler(req, res, RC.viewErrorCallbacks, function(production_lines) {
            RC.render(req, res, 'production-lines', {
                production_lines : production_lines,
                caller: caller,
                path: req.path
            });
        }));
    });
}

function _handleProductionLineView(req, res) {
    RC.getByIdIfAuthorized(req, res, req.param('id'), 'production-line', ProductionLineModule, RC.viewErrorCallbacks, function(production_line, caller) {
        RC.logRequest(req, false, caller);

        RC.render(req, res, 'production-line', {
            production_line: production_line,
            caller: req.session.user,
            formatter: formatter,
            path: req.path
        });
    });
}

function _handleStaticLoadsView(req, res) {
    RC.ensureHasAccess(req, res, 'action-audit', 'l', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        StaticLoadModule.find({}, function(err_loads, static_loads) {
            if(err_loads) {
                RC.render500(req, res, err_loads);
                return;
            }

            RC.render(req, res, 'static-loads', {
                moment: moment,
                static_loads: static_loads,
                caller: caller,
                formatter: formatter,
                path: req.path
            });
        });
    });
}

function _handleActionAuditsView(req, res) {
    RC.ensureHasAccess(req, res, 'action-audit', 'l', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        RC.render(req, res, 'action-audit-list', {
            caller: caller,
            formatter: formatter,
            path: req.path
        });
    });
}

function _handleAdministrativeAreasView(req, res) {
    RC.ensureHasAccess(req, res, 'action-audit', 'l', RC.viewErrorCallbacks, function(caller) { // TODO: change resource type
        RC.logRequest(req, true, caller);

        AdminAreaModule.find({hierarchy_level: '0'}, function(err_admin_area, items) {
            if(err_admin_area) {
                RC.render500(req, res, err_admin_area);
                return;
            }

            RC.render(req, res, 'admin-area-list', {
                items: items,
                caller: caller,
                formatter: formatter,
                path: req.path
            });
        });
    });
}

function _handleCustomersView(req, res) {
    RC.ensureHasAccess(req, res, 'customer', 'l', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        CustomerModule.find({hierarchy_level: '0'}, function(err_country, items) {
            if(err_country) {
                RC.render500(req, res, err_country);
                return;
            }

            RC.render(req, res, 'customer-list', {
                items: items,
                caller: caller,
                formatter: formatter,
                path: req.path
            });
        });
    });
}

function _handleCountriesView(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        CountryModule.find({}, function(err_country, items) {
            if(err_country) {
                RC.render500(req, res, err_country);
                return;
            }

            RC.render(req, res, 'country-list', {
                items: items,
                caller: caller,
                formatter: formatter,
                path: req.path
            });
        });
    });
}

function _handleCountryView(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        CountryModule.findOne({code: req.param('code')}, function(err_country, country) {
            if(err_country) {
                RC.render500(req, res, err_country);
                return;
            }

            ProvinceModule.find({country_code: req.param('code')}, function(err_provinces, provinces) {
                if(err_provinces) {
                    RC.render500(req, res, err_country);
                    return;
                }

                RC.render(req, res, 'country', {
                    country: country,
                    items: provinces,
                    caller: caller,
                    formatter: formatter,
                    path: req.path
                });
            });
        });
    });
}

function _handleReportsView(req, res, caller) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.logRequest(req, true, caller);

        //if(caller.permissions && caller.permissions['reports']) {
            //SampleModule.listIdsByOrganizations(caller.organizations, function(err, samples) {
             //   if(err) {
            //        RC.render500(req, res, err);
            //        return;
            //    }

                // TODO: delete excess attributes in samples
                RC.render(req, res, 'reports', {
                    moment: moment,
                    formatter: formatter,
                    caller: caller,
                    path: req.path
                });
         //   });
         //   return;
        //}
        //RC.viewErrorCallbacks.on404(req, res);
    });
}

function _handleRenderSamplesReport(req, res) {
    RC.ensureUserInSession(req, res, RC.onUserNotInSessionForViewMethod, function(caller) {
        RC.render(req, res, 'samples-report', {
            caller: caller,
            path: req.path
        });
    });
}