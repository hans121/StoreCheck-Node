var winston = require('winston');
var _ = require('underscore');

var Common = require('../router-common');
var ActionAuditModule = require('../../modules/action-audit');
var CountryModule = require('../../modules/model/world/countries');
var ProvinceModule = require('../../modules/model/world/provinces');

module.exports = function(app) {

    Common.addHandler(app, 'get', '/world/countries/reload', _handleReloadCountries);

    Common.addHandler(app, 'get', '/world/provinces/reload', _handleReloadProvinces);

    Common.addHandler(app, 'get', '/world/countries', _handleGetWorldCountries);

    Common.addHandler(app, 'get', '/world/provinces', _handleGetWorldProvinces);
};

function _handleReloadCountries(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        if(caller.roles.indexOf('admin') != -1) {
            CountryModule.readFile('data/world/countries/2142_2013_03_20.csv', function() {
                ActionAuditModule.report(req.session.user, 'reload', 'world/countries', '');
                res.send({result: 'ok'}, 200);
            });
            return;
        }

        Common.serviceErrorCallbacks.on404(req, res);
    });
}

function _handleReloadProvinces(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        if(caller.roles.indexOf('admin') != -1) {
            ProvinceModule.readFile('data/world/provinces/2051_2013_06_08.csv', function() {
                ActionAuditModule.report(req.session.user, 'reload', 'world/provinces', '');
                res.send({result: 'ok'}, 200);
            });
            return;
        }

        Common.serviceErrorCallbacks.on404(req, res);
    });
}

function _handleGetWorldCountries(req, res) {
    var query = {};

    // TODO: loop over req.query keys and make sure we don't see any funny ones

    if(!_.isUndefined(req.query.name_substring)) {
        query = _.extend(query, { name: {$regex : ".*" + req.query.name_substring + ".*", $options: 'i'}});
    }
    if(!_.isUndefined(req.query.code)) {
        query = _.extend(query, { code: req.query.code});
    }

    CountryModule.find(query, function(err_countries, country_list) {
        if(err_countries) {
            Common.on500(req, res, err_countries);
            return;
        }

        country_list.sort(function(a, b) { return (a.name < b.name ? -1 : (a.name == b.name ? 0 : 1)); });
        res.send(country_list, 200);
    });
}

function _handleGetWorldProvinces(req, res) {
    var query = {};

    // TODO: loop over req.query keys and make sure we don't see any funny ones

    if(!_.isUndefined(req.query.name_substring)) {
        query = _.extend(query, { name: {$regex : ".*" + req.query.name_substring + ".*", $options: 'i'}});
    }
    if(!_.isUndefined(req.query.country_code)) {
        query = _.extend(query, { country_code: req.query.country_code});
    }

    ProvinceModule.find(query, function(err_provinces, province_list) {
        if(err_provinces) {
            Common.on500(req, res, err_provinces);
            return;
        }

        province_list.sort(function(a, b) { return (a.name < b.name ? -1 : (a.name == b.name ? 0 : 1)); });
        res.send(province_list, 200);
    });
}