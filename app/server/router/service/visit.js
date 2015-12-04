var _ = require('underscore');
var async = require('async');
var config = require('config');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var excipio_export = require('../../modules/excipio/excipio-export');
var formatter = require('../../modules/view-formatter');
var nodeUtils = require('../../modules/node-utils');
var schema = require('../../modules/model/schema/schema');

var Common = require('../router-common');
var ActionAuditModule = require('../../modules/action-audit');
var PointOfSaleModule = require('../../modules/model/hierarchy/point-of-sale');
var ProductModule = require('../../modules/model/hierarchy/product');
var SampleModule = require('../../modules/model/sample');
var VisitModule = require('../../modules/model/visit');

module.exports = function(app) {

    Common.addHandler(app, 'put', '/visit', _handleCreateVisit);

    // updates a visit
    // request parameters:
    //     1) the request body should match the current version of the update-visit schema
    // error conditions:
    //     1) user does not have visit "update" access
    //     2) the id passed in is not in the valid format (this is checked by schema validation)
    //     3) the visit has "released" status
    // notes:
    //     1)
    Common.addHandler(app, 'post', '/visit/:id', _handleUpdateVisit);

    Common.addHandler(app, 'post', '/visit/:id/samples', _handleUpdateVisitSamples);

    Common.addHandler(app, 'delete', '/visit/:id', _handleDeleteVisit);

    // === GET METHODS

    Common.addHandler(app, 'get', '/visit/:id', function(req, res) {
        Common.getResourceById(req, res, 'get', '/visit/:id', 'visit', VisitModule);
    });

    Common.addHandler(app, 'get', '/visits', _handleGetVisits);

    Common.addHandler(app, 'get', '/visits/auditors', _handleGetVisitsAuditors);

    Common.addHandler(app, 'get', '/visits/products', _handleGetVisitsProducts);
};

// === REQUEST HANDLERS

function _handleCreateVisit(req, res) {
    Common.ensureHasAccess(req, res, 'visit', 'c', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        // validate the request body
        var validation = schema.validate(req.body, schema.createVisitSchema);
        if(validation.errors.length > 0) {
            winston.log('warn', 'a PUT /visit request from user=' + caller.name + ' had validation errors: ' + validation.errors);

            if(validation.errors[0].uri.indexOf('pos_id') != -1) {
                res.send('Point of sale must be provided', 500);
            } else if(validation.errors[0].uri.indexOf('date_of_visit') != -1) {
                res.send('Date of visit must be provided', 500);
            } else {
                res.send(validation.errors[0].message, 500);
            }
            return;
        }

        Common.getByIdIfAuthorized(req, res, req.body.pos_id, 'pos', PointOfSaleModule, Common.serviceErrorCallbacks, function(pos) {
            var currentTimeString = formatter.getCurrentUtcTimeString();
            VisitModule.insert({
                auditor_id:         req.body.auditor_id,
                date_of_visit:      req.body.date_of_visit,
                pos_id:             req.body.pos_id,
                pos_name:           pos.company_name,
                store_check_id:     req.body.store_check_id,
                last_update_time:   formatter.getCurrentUtcTimeString(),
                creation_time:      currentTimeString,
                samples:            [],
                state:             "draft",
                organization:       caller.active_organization,
                auditor_name:       req.body.auditor_name,
                version:            schema.currentVersion
            }, function(e){
                if(e) {
                    ActionAuditModule.report(caller, 'create', 'visit', '"' + pos.company_name + ' ' + req.body.date_of_visit + '" (' +e[0]._id.toHexString() + ')');
                    winston.log('debug', 'a PUT /visit request from user=' + caller.name + ' has succeeded');
                    Common.pushMessage(req, 'success', 'Successfully created visit');
                    res.send(e[0]._id.toHexString(), 200);
                    return;
                } else {
                    winston.log('warn', 'a PUT /visit request from user=' + caller.name + ' failed');
                    Common.pushMessage(req, 'error', 'Failed to create visit');
                    res.send(e, 400);
                }
            });
        });
    });
}

function _handleUpdateVisit(req, res) {
    Common.ensureHasAccess(req, res, 'visit', 'u', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        if(req.param('state') == null) {

            var validation = schema.validate(req.body, schema.updateVisitSchema);
            if(validation.errors.length > 0) {
                winston.log('warn', 'a POST /visit request from user=' + caller.name + ' had validation errors: ' + validation.errors);
                Common.pushMessage(req, 'error', 'Failed to update visit because the request had format errors');
                res.send(validation.errors[0].message, 500);
                return;
            }

            if(!Array.isArray(req.body.samples)) {
                req.body.samples = [];
            }

            var visit;

            async.series({
                visit: function(callback) {
                    Common.getByIdIfAuthorized(req, res, req.param('id'), 'visit', VisitModule, Common.serviceErrorCallbacks, function(visit_result) {
                        if(visit_result.status == "released") {
                            callback('visit has been released', null);
                        } else {
                            visit = visit_result;
                            callback(null, visit_result);
                        }
                    });
                },

                visit_update_result: function(callback) {
                    VisitModule.update({
                        query: { _id : visit._id },
                        value: {
                            $set: {
                                date_of_visit:      formatter.formatDate(req.body.date_of_visit),
                                last_update_time:   formatter.getCurrentUtcTimeString(),
                                auditor_name:       req.body.auditor_name
                            }
                        }
                    }, function(e){
                        if(e) {
                            callback(null, e)
                        } else {
                            callback('Failed to update visit', null);
                        }
                    });
                },

                sample_visit_info_result: function(callback) {
                    var visit_sample_ids = visit.samples.map(function(sample) {return ObjectId(sample.id);});
                    var date_of_visit = formatter.formatDate(req.body.date_of_visit);
                    SampleModule.updateMultiple({
                        query: { _id: {$in: visit_sample_ids}},
                        value: {
                            $set: {
                                'visit_info.auditor_name': req.body.auditor_name,
                                'visit_info.date_of_visit': date_of_visit,
                                'visit_info.date_of_visit_timestamp': formatter.formattedDateToTimestamp(date_of_visit)
                            }
                        }
                    }, function(e) {
                        callback(null, e);
                    });
                }

            }, function(error_async, results) {
                if(error_async != null) {
                    winston.log('warn', 'a POST /visit request from user=' + caller.name + ' failed, because visit with id=' + req.param('id') + ' has problem: ' + error_async);
                    Common.pushMessage(req, 'error', 'Failed to update visit');
                    res.send(error_async, 500);
                } else {
                    ActionAuditModule.report(caller, 'update', 'visit', '"' + visit.pos_name + ' ' + visit.date_of_visit + '" (' + visit._id.toHexString() + ')');
                    winston.log('debug', 'a POST /visit request from user=' + caller.name + ' has succeeded');
                    Common.pushMessage(req, 'success', 'Successfully updated visit');
                    res.send(results.visit_update_result, 200);
                }
            });
        } else {
            _updateVisitState(caller, req, res, req.param('id'), req.param('state'));
        }
    });
}

function _handleUpdateVisitSamples(req, res) {
    Common.ensureHasAccess(req, res, 'visit', 'r', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        if (req.param('action')) {

            // TODO: check action

            var id = req.param('id');
            Common.getByIdIfAuthorized(req, res, id, 'visit', VisitModule, Common.serviceErrorCallbacks, function(visit) {

                ActionAuditModule.report(caller, 'export', 'visit', '"' + visit.pos_name + ' ' + visit.date_of_visit + '" (' + visit._id.toHexString() + ') samples exported');
                Common.pushMessage(req, 'success', 'Successfully started export of all samples for visit "' + visit.pos_name + ' ' + visit.date_of_visit + '"');

                nodeUtils.runInBackground(function() {
                    excipio_export.exportVisit(id, caller.user, function(err_export, export_results) {
                        if(err_export) {
                            winston.error('an error occurred during excipio export of visit ' + id);
                            return;
                        }
                        winston.debug('excipio export of visit ' + id + ' compeleted');
                    });
                });
                res.send('{result: "began"}', 200);
            });
            return;
        }
        Common.serviceErrorCallbacks.on500(req, res, 'unrecognized parameter');
    });
}

function _handleDeleteVisit(req, res) {
    Common.ensureHasAccess(req, res, 'visit', 'd', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        Common.getByIdIfAuthorized(req, res, req.param('id'), 'visit', VisitModule, Common.serviceErrorCallbacks, function(visit) {
            if(visit.state != 'draft') {
                winston.log('warn', 'a DELETE /visit/:id request from user=' + caller.name + ' failed');
                Common.pushMessage(req, 'error', 'Failed to delete visit because it was not a draft');
                res.send('Failed to delete visit because it was not a draft', 400);
                return;
            }

            SampleModule.delete({ _id : { $in: visit.samples } },
                function () {
                    VisitModule.delete({
                        _id : visit._id
                    }, function(e){
                        if(e) {
                            ActionAuditModule.report(caller, 'delete', 'visit', '"' + visit.pos_name + ' ' + visit.date_of_visit + '" (' + visit._id.toHexString() + ')');
                            winston.log('debug', 'a DELETE /visit/:id request from user=' + caller.name + ' has succeeded');
                            Common.pushMessage(req, 'success', 'Successfully deleted visit');
                            res.send({result: 'ok'}, 200);
                        } else{
                            winston.log('warn', 'a DELETE /visit/:id request from user=' + caller.name + ' failed');
                            Common.pushMessage(req, 'error', 'Failed to delete visit');
                            res.send('Failed to delete visit', 400);
                        }
                    });
                }
            );
        });
    });
}

function _handleGetVisits(req, res) {
    Common.ensureHasAccess(req, res, 'visit', 'l', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        var findRequest = {};

        if(typeof(req.query['storeCheck']) != 'undefined') {
            findRequest.store_check_id = req.query['auditGrid'];
        }

        if(typeof(req.query['auditor']) != 'undefined') {
            findRequest.auditor_id = req.query['auditor'];
        }

        if(typeof(req.query['status']) != 'undefined') {
            findRequest.status = req.query['status'];
        }

        if(typeof(req.query['pos_id']) != 'undefined') {
            findRequest.pos_id = req.query['pos_id'];
        }

        if(typeof(req.query['id']) != 'undefined') {
            if(nodeUtils.isValidId(req.query['id'])) {
                findRequest._id = ObjectId(req.query['id']);
            } else {
                res.send('invalid id format', 400);
                return;
            }
        }

        if(Object.keys(findRequest).length > 0) {
            VisitModule.find(findRequest, function(err, visits) {
                var pos_ids = _.uniq(_.pluck(visits, 'pos_id'));

                PointOfSaleModule.listByIds(pos_ids, function(err, pos_list) {
                    if(err) {
                        res.send(err, 500);
                        return;
                    }

                    var pos;
                    _.each(visits, function(visit) {
                        pos = _.find(pos_list, function(pos) {
                            return pos._id.toHexString() == visit.pos_id;
                        });
                        visit.pos = pos;
                    });

                    winston.log('debug', 'a GET /visits request from user=' + caller.name + ' has succeeded');
                    res.send(visits, 200);
                });
            });
            return;
        }

        winston.log('warn', 'could not process a GET /visits request from user=' + caller.name + ' because too few parameters were specified');
        res.send('too few parameters were defined', 400);
    });
}

function _handleGetVisitsAuditors(req, res) {
    Common.ensureHasAccess(req, res, 'visit', 'r', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        // get auth-scoped visit list
        Common.listVisitIds(req, res, Common.serviceErrorCallbacks, function (visit_ids) {

            var query = {}, sort_by = {};
            nodeUtils.buildTableQuery(req.query.sort, req.query.filters, {}, query, sort_by, []);

            query._id = {$in: visit_ids};
            VisitModule.collection.distinct('auditor_name', query, function (err_auditors, auditors) {
                if (err_auditors) {
                    res.send(err_auditors, 500);
                    return;
                }

                // TODO: we ignore the sort property of the query
                if (auditors) {
                    auditors.sort(function (a, b) {
                        var as = a.toLowerCase(), bs = b.toLowerCase();
                        return (as > bs ? 1 : (as < bs ? -1 : 0));
                    });
                }
                res.send(auditors, 200);
            });
        });
    });
}

function _handleGetVisitsProducts(req, res) {
    Common.ensureHasAccess(req, res, 'visit', 'r', Common.serviceErrorCallbacks, function(caller) {
        Common.logRequest(req, true, caller);

        // get auth-scoped visit list
        Common.listVisitIds(req, res, Common.serviceErrorCallbacks, function(visit_ids) {

            var visit_query = {_id: {$in: visit_ids}};
            VisitModule.collection.distinct('samples.product_id', visit_query, function(err_product_ids, product_ids) {
                if(err_product_ids) {
                    res.send(err_product_ids, 500);
                    return;
                }

                var product_ids_mongo = _.map(product_ids, function(id) { return ObjectId(id);});
                var fields = {};
                if(req.query['fields']) {
                    var fieldTokens = req.query['fields'].split(',');
                    _.each(fieldTokens, function(field_token) {
                        fields[field_token] = 1;
                    });
                }

                var product_query = {_id: {$in: product_ids_mongo}};
                _.each(_.keys(req.query.filter), function(query_key) {
                    if(req.query.filter[query_key].length > 0) { // trim?
                        var new_query_component = {};
                        new_query_component[query_key] = {$regex : ".*" + req.query.filter[query_key] + ".*", $options: 'i'};
                        product_query = _.extend(product_query, new_query_component);
                    }
                });

                var sort_fields = {};
                if(req.query.sort) {
                    _.each(_.keys(req.query.sort), function(sort_key) {
                        sort_fields[sort_key] = (req.query.sort[sort_key] == 1 ? 1 : -1);
                    });
                }

                ProductModule.collection.find(product_query, fields).sort(sort_fields).toArray(function(err_products, products) {
                    if(err_products) {
                        res.send(err_product_ids, 500);
                        return;
                    }
                    res.send({rows: products, total_records: products.length}, 200);
                });
            });
        });
    });
}

// === HELPERS

function _submitNestedSamples(caller, req, res, visit, on_success) {
    var sample_ids = VisitModule.getDistinctSampleKeyValues(visit, 'id');
    SampleModule.listByIds(sample_ids, function(err, samples) {

        var draft_samples = [];
        samples.forEach(function(sample) {
            if(sample.state == 'draft') {
                draft_samples.push(sample._id);
            }
        });

        if(draft_samples.length > 0) {
            SampleModule.updateStates(draft_samples, {}, 'submitted', formatter.getCurrentUtcTimeString(), caller.user, function(update_count) {
                if(update_count) {
                    on_success();
                } else {
                    winston.log('debug', 'a POST /visit/status request from user=' + caller.name + ' has failed');
                    Common.pushMessage(req, 'error', 'Failed to update visit sample status to "submitted"');
                    res.send('Could not submit draft samples for visit', 200);
                }
            });
        } else {
            on_success();
        }
    });
}

function _updateVisitState(caller, req, res, id, state) {
    var validation = schema.validate({ state: state }, schema.updateVisitStatusSchema);
    if(validation.errors.length == 0) {
        Common.getByIdIfAuthorized(req, res, id, 'visit', VisitModule, Common.serviceErrorCallbacks, function(visit) {
            if(visit.status == "released") {
                winston.log('warn', 'a POST /visit/status request from user=' + caller.name + ' failed, because visit with id=' + id + ' has been released');
                res.send('visit has been released', 500);
            } else {
                var data = { state: state };
                data[state + '_time'] = formatter.getCurrentUtcTimeString();
                data[state + '_agent'] = caller.user;

                // if we need to submit any samples (potentially)
                if(visit.state == 'draft' && state == 'submitted') {
                    _submitNestedSamples(caller, req, res, visit, function() {
                        VisitModule.update({
                            query: { _id : visit._id },
                            value: { $set: data }
                        }, visitStateUpdatedCallback);
                    });
                } else {
                    VisitModule.update({
                        query: { _id : visit._id },
                        value: { $set: data }
                    }, visitStateUpdatedCallback);
                }

                function visitStateUpdatedCallback(e) {
                    if(e) {
                        winston.log('debug', 'a POST /visit/status request from user=' + caller.name + ' has succeeded');
                        Common.pushMessage(req, 'success', 'Successfully update visit status to "' + state + '"');
                        res.send(e[0], 200);
                    } else{
                        winston.log('warn', 'a POST /visit/status request from user=' + caller.name + ' failed');
                        Common.pushMessage(req, 'error', 'Failed to create visit');
                        res.send(e, 400);
                    }
                }
            }
        });
    } else {
        winston.log('warn', 'a POST /visit/status request from user=' + caller.name + ' had validation errors: ' + validation.errors);
        Common.pushMessage(req, 'error', 'Failed to create visit becase the request had format errors');
        res.send(validation.errors, 500);
    }
}