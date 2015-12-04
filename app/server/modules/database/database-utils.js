var winston     = require('winston');
var nodeutils   = require('./../node-utils');
var ObjectId    = require('mongodb').ObjectID;

exports.list = function(collection, callback) {
    collection.find().toArray(
        function(e, res) {
            if (e) {
                winston.log('error', 'database-utils.list: ' + e);
                callback(e)
            } else {
                callback(null, res)
            }
        });
};

exports.insert = function(collection, obj, callback) {
    collection.insert(obj, { safe:true }, function(err, doc) {
        if(!err) {
            callback(doc);
        } else {
            winston.log('error', 'db.insert: ' + err);
            callback(null);
        }
    });
};

exports.findOne = function(collection, obj, callback) {
    collection.findOne(obj, function(err, doc) {
        if(err) {
            winston.log('error', 'db.findOne: ' + err);
        }
        callback(err, doc);
    });
};

exports.update = function(collection, obj, callback) {
    collection.update(obj.query, obj.value, function(err, doc) {
        if(!err) {
            callback(doc);
        } else {
            winston.log('error', 'db.update: ' + err);
            callback(null);
        }
    });
};

exports.updateMultiple = function(collection, obj, callback) {
    collection.update(obj.query, obj.value, {upsert: false, multi: true}, function(err, count) {
        if(!err) {
            callback(count);
        } else {
            winston.log('error', 'db.update: ' + err);
            callback(null);
        }
    });
};

exports.lastError = function(db, options, callback) {
    db.lastError(options, callback);
};

exports.addStandardMethods = function(parent, collection, index_keys) {

    function ensureIndices(index_keys_in) {
        if(typeof index_keys_in != 'undefined' && index_keys_in.length > 0) {
            index_keys_in.forEach(function(keys) {
                collection.ensureIndex(keys, {background: true}, function(err) {
                    winston.log('debug', 'completed ensureIndex of collection ' + collection.collectionName + ': ' + JSON.stringify(keys));
                });
            });
        }
    }

    parent.collection = collection;

    parent.list = function(callback) {
        exports.list(collection, callback);
    };

    parent.insert = function(obj, callback) {
        //ensureIndices(index_keys);
        exports.insert(collection, obj, callback);
    };

    parent.find = function(query, callback) {
        /*
        collection.find(query).explain(function(err, explanation) {
            winston.debug('index: ' + collection.collectionName + ', ' + JSON.stringify(query) + ' = ' + JSON.stringify(explanation));
        });
        */
        collection.find(query).toArray(nodeutils.callbackWrapper(callback));
    };

    parent.findWithOptions = function(query, options, callback) {
        collection.find(query, options).toArray(nodeutils.callbackWrapper(callback));
    };

    parent.findOne = function(obj, callback) {
        exports.findOne(collection, obj, callback);
    };

    parent.distinct = function(field, query, options, callback) {
        collection.distinct(field, query, options, callback);
    };

    parent.update = function(obj, callback) {
        exports.update(collection, obj, callback);
    };

    parent.updateMultiple = function(obj, callback) {
        exports.updateMultiple(collection, obj, callback);
    };

    parent.upsert = function(obj, callback) {
        //ensureIndices(index_keys);
        collection.update(obj.query, obj.value, {upsert: true, multi: false}, function(err, doc) {
            if(!err) {
                callback(doc);
            } else {
                winston.log('error', 'db.update: ' + err);
                callback(null);
            }
        });
    };

    parent.delete = function(obj, callback) {
        collection.remove(obj, { safe: true }, function(err, doc) {
            if(!err) {
                callback(doc);
            } else {
                winston.log('error', 'db.delete: ' + err);
                callback(null);
            }
        });
    };

    parent.getObjectId = function(id) {
        return collection.db.bson_serializer.ObjectID.createFromHexString(id)
    };

    parent.findOneById = function(id, callback) {
        collection.findOne({_id: ObjectId(id)}, nodeutils.findOneCallbackWrapper(callback));
    };

    parent.listByIds = function(ids, callback) {
        var objectIds = ids.map(function(id) { return parent.getObjectId(id); });
        collection.find({_id: {$in: objectIds}}).toArray(nodeutils.callbackWrapper(callback));
    };

    parent.listByStatuses = function(statuses, callback) {
        collection.find({ "state": { $in: statuses }}).toArray(nodeutils.callbackWrapper(callback));
    };

    parent.listByOrganizations = function(organizations, callback) {
        collection.find({ "organization": { $in: organizations }}).toArray(nodeutils.callbackWrapper(callback));
    };

    parent.listByOrganizationsAndStatuses = function(organizations, statuses, callback) {
        /*
        collection.find({ "organization": { $in: organizations }, "state": { $in: statuses }}).explain(function(err, explanation) {
            winston.debug('index: ' + collection.collectionName + ' = ' + JSON.stringify(explanation));
        });
        */

        collection.find({ "organization": { $in: organizations }, "state": { $in: statuses }}).toArray(nodeutils.callbackWrapper(callback));
    };

    parent.listByOrganizationsAndExcludeStatuses = function(organizations, statuses, callback) {
        /*
        collection.find({ "organization": { $in: organizations }, "state": { $nin: statuses }}).explain(function(err, explanation) {
            winston.debug('index: ' + collection.collectionName + ' = ' + JSON.stringify(explanation));
        });
        */

        collection.find({ "organization": { $in: organizations }, "state": { $nin: statuses }}).toArray(nodeutils.callbackWrapper(callback));
    };

    parent.removeAll = function(callback){
        collection.remove(callback);
    };

    parent.save = function(value, is_safe, callback) {
        //ensureIndices(index_keys);
        if(typeof(is_safe) != 'undefined' && is_safe) {
            collection.save(value, {safe: true}, callback);
        } else {
            collection.save(value, {safe: false});
        }
    };

    function applyIndicesOnDBConnection() {
        setTimeout(function() {
            if(collection.db.is_connected) {
                ensureIndices(index_keys);
            } else {
                applyIndicesOnDBConnection();
            }
        }, 3000);
    }
    applyIndicesOnDBConnection();
};
