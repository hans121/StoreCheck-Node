var winston = require('winston');
var async = require('async');
var _ = require('underscore');

var hierarchy = require('./template-static-hierarchy');
var db = require('./../../database/static-database');
var static_loads = require('../../static-loads');
var nodeUtils   = require('../../node-utils');

var OrganizationModule = require('./../organization.js');

// This is a generic hierarchy processor.  For most hierarchies, this is good enough.
// For others, like the L5 hierarchy, special processing is done.

// params:
// static_load_name, hierarchyModule, resultsModule, hierarchyQuery, recordPKs, orgCodeFunction
exports.process = function(params, callback) {

    // if we're able to get a record without errors
    _findFirst(params.hierarchyModule, params.hierarchyQuery, 1, function(err, result) {
        if(err != null) {
            callback(err, 0);
            return;
        }

        if(!result) {
            callback(null, null);
            return;
        }

        //TODO: perhaps insert static load record AFTER process complete
        // add a static load record, then process the hierarchy
        var timestamp = new Date().getTime().toString();
        static_loads.insert({
            type: params.static_load_name,
            timestamp: timestamp
        }, function(data) {
            _processHierarchy(0, params, timestamp, callback);
        });
    });
};

function _findFirst(dbModule, hierarchyQuery, batch_size, callback) {
    dbModule.findWithOptions(
        {
            $query: hierarchyQuery,
            $orderby: {
                _id: -1
            }
        },
        {
            limit: batch_size
        },
        nodeUtils.callbackWrapper(callback));
}

// count is how many have already been processed
// timestamp is timestamp of static load
// hierarchyQuery limits hierarchy records to process

function _processHierarchy(count, params, timestamp, callback) {
    var BATCH_SIZE = 1;

    // we effectively "pop" an entry from the raw hierarchy collection
    _findFirst(params.hierarchyModule, params.hierarchyQuery, BATCH_SIZE, function(err, results) {
        if(err) {
            callback(err, null);
            return;
        }

        if(results == null) {
            callback(null, count);
            return;
        }

        if(results.length == 0) {
            callback(null, count);
            return;
        }

        var ids = _.pluck(results, '_id');

        params.hierarchyModule.delete({
            _id: {$in: ids}
        }, function(err, docs) {

            // omit id from results and process it
            results = _.map(results, function(result) {
                result.timestamp = timestamp;
                return _.omit(result, '_id');
            });

            var steps = [], organization;

            // TODO: add cardinality-handling

            // attach organization
            steps.push(function(async_callback) {
                var organization_code = params.orgCodeFunction == null ? null : params.orgCodeFunction(results[0]);
                if(organization_code != null) {
                    OrganizationModule.findOne({code: organization_code}, function(err, organization_result) {
                        if(err == null && organization_result != null) {
                            organization = organization_result;
                        }
                        async_callback();
                    });
                } else {
                    organization = null;
                    async_callback();
                }
            });

            // fill in parents (levels 5->1)
            var i;
            for(i=5; i>1; i--) {
                steps.push(_generateAttachHierarchyParentAsyncFunction(params, results[0], i));
            }

            // attach organization, source, and upsert
            steps.push(function(async_callback) {
                if(organization != null) {
                    results[0].organization = organization._id.toHexString();
                    results[0].organization_description =  organization.name;
                }
                results[0].source = 'import';

                //
                params.resultsModule.findOne(_.pick(results[0], params.recordPKs), function(err, result) {
                    if(err == null && result != null) {
                        params.resultsModule.update({
                                query: _.pick(results[0], params.recordPKs),
                                value: { $set: params.valuePKs ? _.pick(results[0], params.valuePKs) : _.omit(results[0], '_id') }
                            },
                            function(docs_count) {
                                // TODO: check err, doc
                                async_callback();
                                _processHierarchy(count + 1, params, timestamp, callback);
                            }
                        );
                    } else {
                        params.resultsModule.upsert({
                                query: _.pick(results[0], params.recordPKs),
                                value: params.valuePKs ? _.pick(results[0], params.valuePKs) : results[0]
                            },
                            function(docs_count) {
                                // TODO: check err, doc
                                async_callback();
                                _processHierarchy(count + 1, params, timestamp, callback);
                            }
                        );
                    }
                });
            });

            async.series(steps);
        });
    });
}

function _generateAttachHierarchyParentAsyncFunction(params, record, hierarchy_level) {
    var property_name, query_level = { };
    property_name = hierarchy.getCodePropertyForHierarchyLevel('' + hierarchy_level);
    if(!_.isUndefined(record[property_name])) {
        return function(async_callback) {
            query_level['code'] = record[property_name];
            params.hierarchyModule.findOne(query_level, function(err_ancestor, ancestor) {
                if(err_ancestor != null) {
                    async_callback();
                    return;
                }

                if(ancestor == null) {
                    async_callback();
                    return;
                }

                var base = record;
                while(!_.isUndefined(base.parent)) { base = base.parent; }
                base.parent = {
                    code: ancestor['code'],
                    sequence: ancestor['display_sequence'],
                    description1: ancestor['description1'],
                    description2: ancestor['description2'],
                    description3: ancestor['description3'],
                    identity_id: ancestor['identity_id']
                };
                async_callback();
            });
        };
    }
    return function(async_callback) {
        async_callback();
    }
}
