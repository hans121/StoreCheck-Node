var _ = require('underscore');
var schedule = require('node-schedule');
var winston = require('winston');

module.exports = {
    callbackWrapper: callbackWrapper,
    findOneCallbackWrapper: findOneCallbackWrapper,
    isValidId: isValidId,
    getUserPrefix: getUserPrefix,
    bytesToSize: bytesToSize,
    getSafeValue: getSafeValue,
    isUserGlobal: isUserGlobal,
    recursiveWrapper: recursiveWrapper,
    runInBackground: runInBackground,
    runWhenDbLoaded: runWhenDbLoaded,
    processEntireCollection: processEntireCollection,
    processMatchingCollectionItems: processMatchingCollectionItems,
    buildTableQuery: buildTableQuery,
    extendQueryWithRegex: extendQueryWithRegex
};

function callbackWrapper(callback) {
    return function(err, items) {
        if(err) {
            callback(err);
            return;
        }
        callback(null, items ? items : []);
    };
}

function findOneCallbackWrapper(callback) {
    return function(err, items) {
        if(items) {
            callback(null, items);
            return;
        }
        callback(err, null);
    };
}

var id_regex = new RegExp("^[0-9a-fA-F]{24}$");

function isValidId(id) {
    return id_regex.test(id);
}

function getUserPrefix(req) {
    if(req.session.user.roles.indexOf('admin') != -1) {
        return 'admin/';
    } else if(req.session.user.roles.indexOf('exec') != -1) {
        return 'exec/';
    } else if(req.session.user.roles.indexOf('CBU') != -1) {
        return 'CBU/';
    } else if(req.session.user.roles.indexOf('supervisor') != -1) {
        return 'supervisor/';
    } else if(req.session.user.roles.indexOf('auditor') != -1) {
        return 'auditor/';
    }
    return '';
}

function bytesToSize(bytes) {
    var sizes = [ 'n/a', 'bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    var i = +Math.floor(Math.log(bytes) / Math.log(1024));
    return  (bytes / Math.pow(1024, i)).toFixed( i ? 1 : 0 ) + ' ' + sizes[ isNaN( bytes ) ? 0 : i+1 ];
}

function getSafeValue(value, valueIfNullish) {
    if(typeof(value) == 'undefined' || value == null) {
        return valueIfNullish;
    }
    return value;
}

function isUserGlobal(user) {
    return user.roles.indexOf('admin') != -1 || user.roles.indexOf('exec') != -1;
}

function recursiveWrapper(functionToRecurse) {
    setTimeout(functionToRecurse, 0);
}

function runInBackground(functionToRun) {
    var date = new Date(new Date().getTime() + 500); // schedule for 1/2 second in the future

    var job = schedule.scheduleJob(date, functionToRun);
}

function runWhenDbLoaded(databaseModule, functionToRun) {
    setTimeout(function() {
        if(databaseModule.collection.db && databaseModule.collection.db.is_connected) {
            functionToRun();
        } else {
            setTimeout(function() {
                runWhenDbLoaded(databaseModule, functionToRun);
            }, 3000);
        }
    }, 3000);
}

function processEntireCollection(collection, item_batch_mutator, callback2) {

    collection.update({}, {$unset: {'batch_update_time': 1}}, {multi: true}, function(err_update) { // , update_count
        if(err_update) {
            callback2(err_update);
            return;
        }

        _applyChangeToRemainingItems(item_batch_mutator, callback2);
    });

    function _applyChangeToRemainingItems(item_batch_mutator, callback2) {
        // note that update_count = 0 is not an error
        collection.find({batch_update_time: {$exists: false}}).limit(500).toArray(function(err_find, items) {
            if(err_find) {
                callback2(err_find);
                return;
            }

            if(!items || items.length == 0) {
                collection.update({}, {$unset: {'batch_update_time': 1}}, {multi: true}, function(err_update) { // , update_count
                    callback2(err_update);
                });
                return;
            }

            winston.debug('applying item batch mutator to ' + items.length + ' items');
            item_batch_mutator(items, function(err_complete) { // , batch_result
                if(err_complete) {
                    callback2(err_complete);
                    return;
                }

                module.exports.recursiveWrapper(function() {
                    _applyChangeToRemainingItems(item_batch_mutator, callback2);
                });
            });
        });
    }
}

RegExp.quote = function(str) {
    return (str+'').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};

// Builds query and sort structs that are ready for mongo from sort and filter structs,
// like those that come from tablesorter.  For example, sort[field] and filter[field]
// values are read and converted.  For any property in the query struct that also isn't
// in the exact_match_properties array, a regex will be provided.  Else, an exact match
// will be required.  For sorting, 0 is ascending, anything else is descending.
function buildTableQuery(sort_struct, filter_struct, filter_date_struct, query, sort_by, exact_match_properties) {

    // apply sorts
    if(!_.isUndefined(sort_struct) && _.keys(sort_struct).length > 0) {
        _.each(_.keys(sort_struct), function(key) {
            sort_by[key] = (sort_struct[key] == '0' ? 1 : -1);
        });
    }

    // apply filters
    var filters = filter_struct ? filter_struct : {};
    if(!_.isUndefined(filters) && Object.keys(filters).length > 0) {
        _.each(_.keys(filters), function(key) {
            var property_value = filters[key];

            if(_.isUndefined(exact_match_properties) || exact_match_properties.indexOf(key) == -1) {
                query[key] = {$regex : ".*" + RegExp.quote(property_value) + ".*", $options: 'i'};
            } else {
                query[key] = property_value;
            }
        });
    }

    // apply date-specific filters (TODO: still requires time property to be called "timestamp"
    var date_filters = filter_date_struct ? filter_date_struct : {};
    if(Object.keys(date_filters).length > 0) {
        _.each(_.keys(date_filters), function(key) {
            var property_value = date_filters[key];

            var query_component;
            if(key == 'from') {
                query_component = {$gte: new Date(property_value)};
            } else if(key == 'to') {
                query_component = {$lte: new Date(property_value)};
            }
            if(query['timestamp']) {
                query['timestamp'] = _.extend(query['timestamp'], query_component);
            } else {
                query['timestamp'] = query_component;
            }
        });
    }
}

// will only query 1-level deep if x.y in query
function extendQueryWithRegex(query_in, query_out, use_regex) {

    // loop over req.query keys and add it to the query
    _.each(_.keys(query_in), function(query_key) {
        var nextParam = {};
        if(query_key != '_') {
            if(!_.isObject(query_in[query_key])) {

                // it's not a nested object, so assume to be a simple type (e.g. string-ish)
                if(use_regex) {
                    nextParam[query_key] = {$regex : ".*" + query_in[query_key] + ".*", $options: 'i'};
                } else {
                    nextParam[query_key] = query_in[query_key];
                }
                query_out = _.extend(query_out, nextParam);
            } else {
                _.each(_.keys(query_in[query_key]), function(inner_key) {
                    if(use_regex) {
                        query_out[query_key + '.' + inner_key] = {$regex : ".*" + query_in[query_key][inner_key] + ".*", $options: 'i'};
                    } else {
                        query_out[query_key + '.' + inner_key] = query_in[query_key][inner_key];
                    }
                });
            }
        }
    });
}

function processMatchingCollectionItems(collection, max_batch_size, query, fields, batch_mutator, callback2) {
    var progress_info = {
        total: 0,
        completed: 0
    };

    collection.update(query, {$unset: {'batch_update_time': 1}}, {multi: true}, function(err_update) { // , update_count
        if(err_update) {
            callback2(err_update);
            return;
        }

        collection.find(query).count(function(err_count, count) {
            if(err_count) {
                callback2(err_count);
                return;
            }
            progress_info.total = count;
            _applyChangeToRemainingItems();
        });

    });

    function _applyChangeToRemainingItems() {
        // note that update_count = 0 is not an error
        collection.find(_.extend({batch_update_time: {$exists: false}}, query), fields).limit(max_batch_size).toArray(function(err_find, samples) {
            if(err_find) {
                callback2(err_find);
                return;
            }

            if(!samples || samples.length == 0) {
                collection.update(query, {$unset: {'batch_update_time': 1}}, {multi: true}, function(err_update) { // , update_count
                    callback2(err_update);
                });
                return;
            }

            winston.debug('applying batch mutator to ' + samples.length + ' items (' + progress_info.completed + '/' + progress_info.total + ' completed)');
            batch_mutator(samples, function(err_complete) { // , batch_result
                if(err_complete) {
                    callback2(err_complete);
                    return;
                }

                progress_info.completed += samples.length;
                recursiveWrapper(function() {
                    _applyChangeToRemainingItems();
                });
            });
        });
    }
}