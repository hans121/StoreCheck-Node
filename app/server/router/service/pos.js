var fs = require('fs');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');
var googlemaps = require('googlemaps');
var async = require('async');
var _ = require('underscore');

var schema = require('../../modules/model/schema/schema');
var formatter = require('../../modules/view-formatter');
var node_utils = require('../../modules/node-utils');

var ActionAuditModule = require('../../modules/action-audit');
var Common = require('../router-common');
var Database = require('../../modules/database/database');
var PointOfSaleModule = require('../../modules/model/hierarchy/point-of-sale');
var POSHierarchyModule = require('../../modules/model/hierarchy/point-of-sale-hierarchy');
var SampleModule = require('../../modules/model/sample');
var StaticLoadModule = require('../../modules/static-loads');
var VisitModule = require('../../modules/model/visit');

module.exports = function(app) {

    Common.addHandler(app, 'put', '/pos', _handleCreatePOS);

    Common.addHandler(app, 'post', '/pos/geocode', _handleGeocodePOSObject);

    Common.addHandler(app, 'post', '/pos/:id', _handleUpdatePOS);

    Common.addHandler(app, 'delete', '/pos/:id', _handleDeletePOS);

    // Reads pos hierarchy files and puts them into the point-of-sale-hierarchy static load collection
    //
    // Error conditions:
    //     - Caller does not have pos/hierarchy create access
    //     - There was an issue reading one or more files
    Common.addHandler(app, 'post', '/pos/hierarchy/init', _handleReloadPOSHierarchyFiles);

    // TODO: this should really be a POST, but I'm rushing to get this into the system (easier client code)
    Common.addHandler(app, 'get', '/pos/:id/geocode/init', _handleGeocodePOS);

    // Processes contents of the point-of-sale dynamic table and tries to geocode some
    // the static collection point-of-sale
    //
    // Error conditions:
    //     - Caller does not have pos/hierarchy create access
    // TODO: this should really be a POST, but I'm rushing to get this into the system
    Common.addHandler(app, 'get', '/pos/geocode/init', _handleInitBatchGeocode);

    Common.addHandler(app, 'delete', '/pos/:id/geocode', _handleDeletePOSGeocode);

    // === GET REQUESTS

    // Gets an point of sale list matching the specified criteria
    // Error conditions:
    //     - See RouterCommon.findPointsOfSale (pos)
    Common.addHandler(app, 'get', '/pos', _handlePOSTableQuery);

    // Gets an point of sale by ID
    //
    // Error conditions:
    //     - See RouterCommon.getByIdIfAuthorized (pos)
    Common.addHandler(app, 'get', '/pos/:id', _handleGetPOSById);

    // Gets an point of sale geo-coding summary
    // Error conditions:
    //     - See RouterCommon.findPointsOfSale (pos)
    Common.addHandler(app, 'get', '/points-of-sale/geocode', _handlePOSBatchExport);
};

// == REQUEST HANDLERS

// TODO: rename state to location_state
function _handleCreatePOS(req, res) {
    Common.ensureHasAccess(req, res, 'pos', 'c', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        // TODO: validate body
        PointOfSaleModule.insert({
            company_name:               req.body.company_name,
            address1:                   req.body.address1,
            address2:                   req.body.address2,
            address3:                   "",
            city:                       req.body.city,
            state:                      req.body.state,
            postal_code:                req.body.postal_code,
            address_type_code:          req.body.address_type_code,
            country:                    req.body.country,
            email:                      req.body.email,
            account_number:             req.body.account_number,
            a12_code:                   node_utils.getSafeValue(req.body.a12_code, ''),
            a47_code:                   node_utils.getSafeValue(req.body.storecheck_candidate, ''),
            a48_code:                   node_utils.getSafeValue(req.body.region_of_sales, ''),
            a50_code:                   node_utils.getSafeValue(req.body.distribution_channel, ''),
            a52_code:                   node_utils.getSafeValue(req.body.danone_platform, ''),
            a53_code:                   node_utils.getSafeValue(req.body.administrative_area, ''),
            a54_code:                   node_utils.getSafeValue(req.body.preparation_type, ''),
            a56_code:                   node_utils.getSafeValue(req.body.mechanization, ''),
            a57_code:                   node_utils.getSafeValue(req.body.customer_platform, ''),
            a59_code:                   node_utils.getSafeValue(req.body.customer, ''),
            version:                    schema.currentVersion,
            organization:               caller.active_organization,
            organization_description:   caller.active_organization_name,
            active:                     'Y',
            added_by_user_code:         '',
            source:                     'service'
        }, function(e) {
            if(e) {
                req.body._id = e[0]._id;
                _geoCodePosList(req, res, [req.body], function() {
                    ActionAuditModule.report(caller, 'create', 'pos', req.body.company_name + ' ' + req.body.address1);
                    Common.pushMessage(req, 'success', 'Successfully created point of sale');
                    res.send(e[0]._id.toHexString(), 200);
                });
            } else{
                Common.pushMessage(req, 'success', 'Failed to create point of sale');
                res.send(e, 400);
            }
        });
    });
}

function _handleUpdatePOS(req, res) {
    Common.ensureHasAccess(req, res, 'pos', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        Common.getByIdIfAuthorized(req, res, req.param('id'), 'pos', PointOfSaleModule, Common.serviceErrorCallbacks, function(pos) {
            var visit_ids = [];

            async.series({

                pos: function(callback) {
                    PointOfSaleModule.update({
                        query: { _id : pos._id },
                        value: {
                            $set: {
                                company_name:               req.body.company_name,
                                address1:                   req.body.address1,
                                address2:                   req.body.address2,
                                city:                       req.body.city,
                                state:                      node_utils.getSafeValue(req.body.state, ''),
                                postal_code:                req.body.postal_code,
                                address_type_code:          req.body.address_type_code,
                                active:                     "Y",
                                country:                    node_utils.getSafeValue(req.body.country, ''),
                                email :                     req.body.email,
                                account_number:             req.body.account_number,
                                a12_code:                   node_utils.getSafeValue(req.body.a12_code, ''),
                                a47_code:                   node_utils.getSafeValue(req.body.storecheck_candidate, ''),
                                a48_code:                   node_utils.getSafeValue(req.body.region_of_sales, ''),
                                a50_code:                   node_utils.getSafeValue(req.body.distribution_channel, ''),
                                a52_code:                   node_utils.getSafeValue(req.body.danone_platform, ''),
                                a53_code:                   node_utils.getSafeValue(req.body.administrative_area, ''),
                                a54_code:                   node_utils.getSafeValue(req.body.preparation_type, ''),
                                a56_code:                   node_utils.getSafeValue(req.body.mechanization, ''),
                                a57_code:                   node_utils.getSafeValue(req.body.customer_platform, ''),
                                a59_code:                   node_utils.getSafeValue(req.body.customer, ''),
                                language_id:                "en"

                                //currency_code:              "",
                                //primary_address_id:         ""
                            }
                        }
                    }, function(e) {
                        if(e) {
                            ActionAuditModule.report(caller, 'update', 'pos', req.body.company_name + ' ' + req.body.address1);
                            Common.pushMessage(req, 'success', 'Successfully updated point of sale');
                            callback(null, e);
                        } else {
                            callback('Failed to update point of sale', null);
                        }
                    });
                },

                visits: function(callback) {

                    VisitModule.updateMultiple({
                        query: { pos_id: pos._id.toHexString() },
                        value: {
                            $set: {
                                'pos_name': req.body.company_name
                            }
                        }
                    }, function(e) {
                        callback(null, e);
                    });
                },

                samples: function(callback) {

                    VisitModule.find({
                        pos_id: pos._id.toHexString()
                    }, function(err, visits) {
                        if(err != null) {
                            callback(err, null);
                        } else{
                            visit_ids = _.map(visits, function(visit) {
                                return visit._id.toHexString();
                            });

                            SampleModule.updateMultiple({
                                query: { visit_id: {$in: visit_ids} },
                                value: {
                                    $set: {
                                        'visit_info.pos_name': req.body.company_name
                                    }
                                }
                            }, function(e) {
                                callback(null, e);
                            });
                        }
                    });
                }

            }, function(err_async, results) {

                if(err_async != null) {
                    Common.pushMessage(req, 'error', err_async);
                    res.send(err_async, 400);
                } else {
                    res.send(results, 200);
                }
            });
        });
    });
}

function _handleDeletePOS(req, res) {
    Common.ensureHasAccess(req, res, 'pos', 'd', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        Common.getByIdIfAuthorized(req, res, req.param('id'), 'pos', PointOfSaleModule, Common.serviceErrorCallbacks, function(pos) {
            PointOfSaleModule.delete(
                { _id: pos._id },
                function(e) {
                    if(e) {
                        ActionAuditModule.report(caller, 'delete', 'pos', pos.company_name + ' ' + pos.address1 + ' (' + pos._id.toHexString() + ')');
                        Common.pushMessage(req, 'success', 'Successfully deleted point of sale');
                        res.send({result: 'ok'}, 200);
                    } else{
                        Common.pushMessage(req, 'error', 'Failed to deleted point of sale');
                        res.send('no points of sale were updated', 400);
                    }
                });
        });
    });
}

function _handleGeocodePOSObject(req, res) {
    // TODO: validate body
    _geocode(req, res, req.body, function(err, result) {
        if(err != null) {
            Common.serviceErrorCallbacks.on500(req, res, err);
            return;
        }
        res.send(result, 200);
    });
}

function _handleGeocodePOS(req, res) {
    Common.getByIdIfAuthorized(req, res, req.param('id'), 'pos', PointOfSaleModule, Common.serviceErrorCallbacks, function(pos, caller) {
        Common.logRequest(req, true, caller);

        _geoCodePosList(req, res, [pos], function() {
            res.send({result: 'ok'}, 200);
        });
    });
}

function _handleDeletePOSGeocode(req, res) {
    Common.getByIdIfAuthorized(req, res, req.param('id'), 'pos', PointOfSaleModule, Common.serviceErrorCallbacks, function(pos, caller) {
        Common.logRequest(req, true, caller);

        PointOfSaleModule.update({
                query: { _id: pos._id },
                value: { $unset: { geocoded_at: 1, latitude: 1, longitude: 1 }}
            },
            function(docs) {
                res.send({result: 'ok'}, 200);
            }
        );
    });
}

function _handleInitBatchGeocode(req, res) {
    Common.ensureHasAccess(req, res, 'pos', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        PointOfSaleModule.findWithOptions({ latitude: { $exists: false}, geocoded_at: { $exists: false}},
            { limit: 50 },
            function(err_pos, added) {
                if(err_pos) {
                    res.send(err_pos, 500);
                    return;
                }

                ActionAuditModule.report(caller, 'create', 'pos-geocode', 'bulk process <= 50');
                _geoCodePosList(req, res, added, function() {
                    res.send({result: 'ok'}, 200);
                });
            }
        );
    });
}

function _handleReloadPOSHierarchyFiles(req, res) {
    Common.ensureHasAccess(req, res, 'pos/hierarchy', 'c', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            Common.serviceErrorCallbacks.on404(req, res);
            return;
        }

        node_utils.runInBackground(function() {
            var files = fs.readdirSync('data/pos');
            files = _.filter(files, function(file) { return file.indexOf('README.md') == -1; }); // TODO:
            var files_as_structs = _.map(files, function(file) { return {path: 'data/pos/' + file}});

            winston.debug('began reading POS hierarchy files');
            POSHierarchyModule.readHierarchyFiles(files_as_structs, function(err, results) {
                ActionAuditModule.report(caller, 'create', 'pos-hierarchy', 'init');
                winston.info('finished reading POS hierarchy files - beginning processing step');

                if(err != null) {
                    winston.error('An error occurred while importing pos hierarchy: ' + err);
                    return;
                }

                POSHierarchyModule.process(PointOfSaleModule, function(err, result) {
                    if(err != null) {
                        winston.error('An error occurred while processing pos hierarchy: ' + err);
                    } else {
                        ActionAuditModule.report(caller, 'create', 'pos-hierarchy', 'process');
                    }
                });
            });
        });
        res.send('{result: "began"}', 200);
    });
}

function _handlePOSBatchExport(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') != -1) {
            var geocoded_cursor = PointOfSaleModule.collection.find({geocoded_at: {$exists: true}}).sort({company_name: 1});

            function blankIfUndef(val) {
                return _.isUndefined(val) || _.isNull(val) ? "" : val;
            }

            var contents = "company_name,address id,address_2, country, state, city, postal_code, address_type, email, account_number, distribution_channel, administrative_area, customer, region of sales, storecheck_candidate, preparation_type, customer_platform, danone_platform, latitude,longitude,organization, mechanization\n";
            geocoded_cursor.each(function(err, pos) {
                if (pos == null) {
                    geocoded_cursor.close();

                    res.set('Content-Type', 'text/csv');
                    res.set('Content-Disposition', 'attachment; filename=pos-geocoding.csv');
                    res.set('Content-Length', contents.length);
                    res.end(contents, 'binary');

                    ActionAuditModule.report(caller, 'read', 'pos-geocode', 'export');
                } else {
                    contents += blankIfUndef(pos.company_name) + ',';
                    contents += blankIfUndef(pos.address_id) + ',';
                    contents += blankIfUndef(pos.address2) + ',';
                    contents += blankIfUndef(pos.country) + ',';
                    contents += blankIfUndef(pos.state) + ',';
                    contents += blankIfUndef(pos.city) + ',';
                    contents += blankIfUndef(pos.postal_code) + ',';
                    contents += blankIfUndef(pos.address_type_code) + ',';
                    contents += blankIfUndef(pos.email) + ',';
                    contents += blankIfUndef(pos.account_number) + ',';
                    contents += blankIfUndef(pos.a50_code) + ',';
                    contents += blankIfUndef(pos.a53_code) + ',';
                    contents += blankIfUndef(pos.a59_code) + ',';
                    contents += blankIfUndef(pos.a48_code) + ',';
                    contents += blankIfUndef(pos.a47_code) + ',';
                    contents += blankIfUndef(pos.a54_code) + ',';
                    contents += blankIfUndef(pos.a57_code) + ',';
                    contents += blankIfUndef(pos.a52_code) + ',';
                    contents += blankIfUndef(pos.latitude) + ',';
                    contents += blankIfUndef(pos.longitude) + ',';
                    contents += blankIfUndef(pos.organization_description) + ',';
                    contents += blankIfUndef(pos.a56_code) + '\n';
                }
            });

        } else {
            Common.serviceErrorCallbacks.on404(req, res);
        }
    });
}

function _handleGetPOSById(req, res) {
    Common.getResourceById(req, res, 'get', '/pos/:id', 'pos', PointOfSaleModule);
}

// ===

// Geocoding helpers

var country_map = {
    "FRA": "france",
    "ESP": "spain",
    "POL": "poland",
    "CAD": "canada"
};

function _geoCodeContinueIfBelowQuota(req, res, result, callback) {
    if(result.status == 'OVER_QUERY_LIMIT') {
        res.send('over query limit with Google', 500);
    } else {
        callback();
    }
}

// callback2: err, result
// fires a 500 and stops if hit quota
function _geocode(req, res, pos, callback2) {
    // we have to potentially try results in various permutations to get a solid hit
    var query_all = "";
    var query_without_address = "";
    var query_without_company = "";

    if(typeof(pos.company_name) != 'undefined') {
        query_all += pos.company_name;
        query_without_address += pos.company_name;
    }
    if(typeof(pos.address1) != 'undefined') {
        query_all += ', ' + pos.address1;
        query_without_company += pos.address1;
    }
    if(typeof(pos.city) != 'undefined') {
        query_all += ', ' + pos.city;
        query_without_address += ', ' + pos.city;
        query_without_company += ', ' + pos.city;
    }
    if(typeof(pos.country) != 'undefined') {
        query_all += ', ' + country_map[pos.country];
        query_without_address += ', ' + country_map[pos.country];
        query_without_company += ', ' + country_map[pos.country];
    }

    winston.debug('beginning geocode');

    googlemaps.geocode(query_all, function(err, result) {
        if(result == null || result.results.length == 0) {
            _geoCodeContinueIfBelowQuota(req, res, result, function() {
                googlemaps.geocode(query_without_address, function(err2, result2) {
                    if(result2 == null || result2.results.length == 0) {
                        _geoCodeContinueIfBelowQuota(req, res, result2, function() {
                            googlemaps.geocode(query_without_company, function(err3, result3) {
                                if(result3 == null || result3.results.length == 0) {
                                    _geoCodeContinueIfBelowQuota(req, res, result3, function() {
                                        googlemaps.geocode(pos.city + ', ' + country_map[pos.country], function(err4, result4) {
                                            if(result4 == null || result4.results.length == 0) {
                                                _geoCodeContinueIfBelowQuota(req, res, result4, function() {
                                                    callback2('no match found', null);
                                                });
                                            } else {
                                                callback2(null, result4);
                                            }
                                        });
                                    });
                                } else {
                                    callback2(null, result3);
                                }
                            });
                        });
                    } else {
                        callback2(null, result2);
                    }
                });
            });
        } else {
            callback2(null, result);
        }
    });
}

function _geoCodePosList(req, res, pos_list, onComplete) {
    if(pos_list.length == 0) {
        onComplete();
    } else {
        var pos = pos_list.pop();
        console.log('geocode called...');
        _geocode(req, res, pos, function(err, result) {
            if(err != null) {
                PointOfSaleModule.update({
                    query: { _id: pos._id },
                    value: { $set: { geocoded_at: formatter.getCurrentUtcTimeString()}}
                },
                function(docs) {
                    _geoCodePosList(req, res, pos_list, onComplete);
                });
            } else {
                _onGeoCodeResult(req, res, pos, pos_list, result);
            }
        });
    }
}

function _onGeoCodeResult(req, res, pos, pos_list, result) {
    var update_val = { geocoded_at: formatter.getCurrentUtcTimeString() };
    if(result.results[0].geometry) {
        if(result.results[0].geometry.location) {
            update_val.latitude = result.results[0].geometry.location.lat;
            update_val.longitude = result.results[0].geometry.location.lng;
        }
    }
    PointOfSaleModule.update({
        query: { _id: pos._id },
        value: { $set: update_val}
    },
    function(docs) {
        _geoCodePosList(req, res, pos_list, function() {
            res.send({result: 'ok'}, 200);
        });
    });
}

function _handlePOSTableQuery(req, res) {
    Common.ensureHasAccess(req, res, 'pos', 'l', Common.serviceErrorCallbacks, function(caller) {

        if((caller.roles.indexOf('admin') == -1 && caller.roles.indexOf('exec') == -1) && (!caller.organizations || caller.organizations.length == 0)) {
            Common.serviceErrorCallbacks.on500(req, res, 'no organization provided');
            return;
        }

        StaticLoadModule.findLatest('point-of-sale', function(err, static_object) {
            if(err || !static_object) {
                Common.serviceErrorCallbacks.on500(req, res, err);
                return;
            }

            var page = req.query['page'];
            var pageSize = req.query['pageSize'];

            var query = {}, sort_by = {};
            node_utils.buildTableQuery(req.query.sort, req.query.filter, {}, query, sort_by, []);

            var fields = {
                _id: 1,
                a59_code: 1,
                company_name: 1,
                address1: 1,
                city: 1,
                country: 1,
                a53_code: 1,
                a50_code: 1
            };

            var import_query = _.extend(JSON.parse(JSON.stringify(query)), {timestamp: static_object.timestamp});
            var customs_query = _.extend(JSON.parse(JSON.stringify(query)), {source: {$ne: 'import'}});

            if((caller.roles.indexOf('admin') == -1 && caller.roles.indexOf('exec') == -1)) {
                import_query.organization = { $in: caller.organizations };
                customs_query.organization = { $in: caller.organizations };
            }

            query = {$or: [import_query, customs_query]};

            Database.query(PointOfSaleModule.collection, {
                query: query,
                sort_by: sort_by,
                fields: fields,
                page: page,
                pageSize: pageSize
            }, function(err_query, query_results) {
                if(err_query) {
                    Common.on500(req, res, err_query);
                    return;
                }
                res.send(query_results, 200);
            });
        });
    });
}
