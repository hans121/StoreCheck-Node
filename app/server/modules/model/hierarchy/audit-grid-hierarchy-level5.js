var _ = require('underscore');
var async = require('async');
var moment = require('moment');
var winston = require('winston');

var schema = require('../schema/schema');
var db = require('./../../database/semi-dynamic-database');
var hierarchy = require('./template-static-hierarchy');
var hierarchy5 = db.db.collection('audit-grid-hierarchy-level5');
var dbUtils = require('../../database/database-utils');
var static_loads = require('../../static-loads');
var category_specific = require('../../category-specific');

var index_keys = [
    { timestamp: 1 }
];

dbUtils.addStandardMethods(exports, hierarchy5);

exports.reload = function(files, callback2) {
    var file_index = 0, file;

    hierarchy.hierarchy_excipio.remove(function() { // err_remove, remove_result
        processFile();
    });

    function processFile() {
        if(files.length > file_index) {
            file = files[file_index];
            file_index++;

            hierarchy.readExcipioFile(file.path, function() {
                processFile();
            });
        } else {
            excipio_hierarchy_processor.process(callback2);
        }
    }
};

exports.findEntries = function(company_id, t03_code, timestamp, L1_t02_codes, callback) {
    var keyedItem = {
        company_id: company_id,
        timestamp: timestamp
    };

    if(!_.isUndefined(t03_code)) {
        keyedItem.t03_code = t03_code;
    }

    if(!_.isUndefined(L1_t02_codes) && !_.isNull(L1_t02_codes) && L1_t02_codes.length > 0) {
        keyedItem.level1_t02_code = {$in: L1_t02_codes};
    }

    exports.find(keyedItem, function(e, res) {
        if(e) {
            callback(e);
            return;
        }

        callback(e, res);
    });
};

exports.getLevel1T02Codes = function(callback_2) {
    static_loads.findLatest('audit-grid-hierarchy-L5', function(err, static_object) {
        if(err == null && static_object != null) {
            exports.collection.distinct('level1_t02_code', { timestamp: static_object.timestamp }, callback_2);
        } else {
            callback_2(err, null);
        }
    });
};

// typical l1_t02_items include: "Water", "Dairy"
exports.getLevel1Codes = function(l1_t02_items, callback_2) {
    var timestamp;

    async.series({
        timestamp: function(callback) {
            static_loads.findLatest('audit-grid-hierarchy-L5', function(err, static_object) {
                if(err == null && static_object != null) {
                    timestamp = static_object.timestamp;
                    callback(err, timestamp);
                } else {
                    callback(err, null);
                }
            });
        },

        l5_items: function(callback) {
            var match = { 'timestamp': timestamp };
            if(!_.isUndefined(l1_t02_items) && !_.isNull(l1_t02_items) && l1_t02_items.length > 0) {
                match.level1_t02_code = {$in: l1_t02_items};
            }

            exports.collection.aggregate([
                { $match: match },
                {
                    $group:
                    {
                        "_id": {
                            company_id: "$company_id",
                            t03_code: "$t03_code",
                            t03_description: "$t03_description",
                            level1_t02_code: "$level1_t02_code"
                        }
                    }
                }
            ],
                function (err, hierarchy_results) {
                    if(err == null && hierarchy_results != null) {
                        hierarchy_results = _.map(hierarchy_results, function(item) {
                            return item._id;
                        });
                    }
                    callback(err, hierarchy_results);
                }
            );
        }
    }, function(err, results) {
        callback_2(err, !_.isUndefined(results) && !_.isUndefined(results.l5_items) ? results.l5_items : results);
    });
};

// ===

function _getDescriptionWithFallback(desc2, desc1, desc3) {
    if(desc2.length > 0) {
        return desc2;
    }
    if(desc1.length > 0) {
        return desc1;
    }
    return desc3;
}

// ===

var excipio_hierarchy_processor = (function () {

    function process(callback) {
        var timestamp = new Date().getTime().toString();
        static_loads.insert({
            type: 'audit-grid-hierarchy-L5',
            timestamp: timestamp,
            version: schema.currentVersion
        }, function(data) {
            if(data != null) {
                var keyedItem = {
                    //    company_id: company_id,
                    //    code: code,
                    hierarchy_level: '5'
                };

                hierarchy.hierarchy_excipio.find(keyedItem).toArray(
                    function(e, res) {
                        if (e) {
                            callback(e);
                        } else {
                            winston.log('info', 'processing ' + res.length + ' audit grid hierarchy L5 records');

                            var index = 0;
                            function process() {
                                if(index < res.length) {
                                    _processLevel5Item(res[index], timestamp, function() {
                                        index++;
                                        process();
                                    });
                                } else {
                                    callback(null, res);
                                }
                            }
                            process();
                        }
                    }
                );
            } else {
                winston.error('failed to process audit-grid-hierarchy-L5');
                callback(data, null);
            }
        });
    }

    function _processLevel5Item(level5Item, timestamp, onComplete) {
        var hierarchy_collection = hierarchy.hierarchy_excipio;

        var level0_children = [];
        var answerOptions = [];
        var level1_item;
        var level2_item;
        var level3_item;
        var level4_item;
        var default_value = "";

        async.series([

            // get the level 5 item
            function(callback) {

                var level5Params = {
                    company_id: level5Item.company_id,
                    code: level5Item.code
                };

                hierarchy_collection.findOne(level5Params, function(e, o5) {
                    if(o5.active == 'N') {
                        callback(true);
                    } else {
                        callback();
                    }
                });
            },

            // get all level 4 items for this level 5 item
            function(callback) {
                _getHierarchyLevel(level5Item, '4', function(err, o4) {
                    if(err != null) { callback(err, o4); return; }
                    if(o4 == null) { callback('not found'); return; }

                    level4_item = o4;
                    callback(err, o4);
                });
            },

            // get all level 3 items for this level 5 item
            function(callback) {
                _getHierarchyLevel(level5Item, '3', function(err, o3) {
                    if(err != null) {
                        callback(err, o3);
                        return;
                    }
                    if(o3 == null) {
                        callback('not found');
                        return;
                    }
                    level3_item = o3;

                    callback(err, o3);
                });
            },

            // get all level 2 items for this level 5 item
            function(callback) {
                _getHierarchyLevel(level5Item, '2', function(err, o2) {
                    if(err != null) {
                        callback(err, o2);
                        return;
                    }
                    if(o2 == null) {
                        callback('not found');
                        return;
                    }
                    level2_item = o2;

                    callback(err, o2);
                });
            },

            // get all level 1 items for this level 5 item
            function(callback) {
                _getHierarchyLevel(level5Item, '1', function(err, o1) {
                    if(err != null) {
                        callback(err, o1);
                        return;
                    }
                    if(o1 == null) {
                        callback('not found');
                        return;
                    }
                    level1_item = o1;

                    callback(err, o1);
                });
            },

            // get all level 0 items for this level 5 item
            function(callback) {

                var level0Params = {
                    company_id: level5Item.company_id,
                    subsection_code: level5Item.code,
                    t03_code: level5Item.t03_code,
                    hierarchy_level:'0'
                };

                hierarchy_collection.find(level0Params).toArray(function(e, level0Items) {
                    if(level0Items) {
                        for(var i=0; i<level0Items.length; i++) {
                            level0_children.push({
                                weight: level0Items[i].description1,
                                text: level0Items[i].description2,
                                default_indicator: level0Items[i].description3,
                                code: level0Items[i].code,
                                identity_id: level0Items[i].identity_id,
                                sequence: level0Items[i].display_sequence,
                                date_added: level0Items[i].date_added,
                                date_changed: level0Items[i].date_changed
                            });

                            if(level0Items.length > 1 && level0Items[i].description3 == '1') {
                                default_value = level0Items[i].identity_id;
                            }
                        }

                        if(level0Items.length > 1) {
                            var firstLongConform = _.find(_.pluck(level0Items, 'description1'), function(desc1) {
                                return desc1 == 'CONFORM' || desc1 == 'NON-CONFORM' || desc1 == 'ALERT';
                            });

                            if(_.isUndefined(firstLongConform)) {
                                answerOptions = ['A', 'B', 'C', ''];
                            } else {
                                answerOptions = ['CONFORM', 'NON-CONFORM', 'ALERT', ''];
                            }
                        }
                        callback();
                    } else {
                        winston.log('error', 'while processing product hierarchy, failed to process level 0 of level 5 item ' + level5Item.code);
                        callback('while processing product hierarchy, failed to process level 0 of level 5 item ' + level5Item.code);
                    }
                });
            },

            function(callback) {
                // validate the category_specific has been filled in - use default if it hasn't
                if(_.isUndefined(level5Item.category_specific) || level5Item.category_specific.trim().length == 0) {
                    level5Item.category_specific = (level0_children.length == 1 ? category_specific.CategorySpecific.FREE_TEXT : category_specific.CategorySpecific.LIST_CHOICES);
                }

                hierarchy5.insert({
                    company_id: level5Item.company_id,
                    code: level5Item.code,

                    level1_code: level5Item.t03_code,
                    level1_t02_code: level1_item.code,
                    level1_sequence: level1_item.display_sequence,
                    level1_description: level5Item.t03_description,
                    level1_description2: _getDescriptionWithFallback(level5Item.t03_description, level1_item.description2, level1_item.description1),
                    level1_description3: level1_item.description3,

                    level2_code: level2_item.code,
                    level2_t02_code: level2_item.code,
                    level2_sequence: level2_item.display_sequence,
                    level2_description: level2_item.description1,
                    level2_description2: _getDescriptionWithFallback(level2_item.description2, level2_item.description1, level2_item.description3),
                    level2_description3: level2_item.description3,

                    level3_code: level3_item.code,
                    level3_t02_code: level3_item.code,
                    level3_sequence: level3_item.display_sequence,
                    level3_description: level3_item.description1,
                    level3_description2: _getDescriptionWithFallback(level3_item.description2, level3_item.description1, level3_item.description3),
                    level3_description3: level3_item.description3,

                    level4_code: level4_item.code,
                    level4_t02_code: level4_item.code,
                    level4_sequence: level4_item.display_sequence,
                    level4_description: level4_item.description1,
                    level4_description2: _getDescriptionWithFallback(level4_item.description2, level4_item.description1, level4_item.description3),
                    level4_description3: level4_item.description3,

                    sequence: level5Item.display_sequence,
                    description: level5Item.description1,
                    description2: _getDescriptionWithFallback(level5Item.description2, level5Item.description1, level5Item.description3),
                    description3: level5Item.description3,
                    default_value: default_value,
                    t02_code: level5Item.code,
                    t03_code: level5Item.t03_code,
                    t03_description: level5Item.t03_description,
                    identity_id: level5Item.identity_id,
                    category_specific: level5Item.category_specific,

                    timestamp: timestamp,
                    source: 'import',
                    version: schema.currentVersion,
                    children: level0_children,
                    category_specific_options: answerOptions,
                    date_added: level5Item.date_added,
                    date_changed: level5Item.date_changed
                }, {safe: true}, function() {
                    callback();
                }); // TODO: convey error!
            }
        ], function(err, data) {
            onComplete();
        });
    }

    function _getHierarchyLevel(level5Item, level, callback2) {
        var levelParams = {
            company_id: level5Item.company_id,
            code: level5Item[hierarchy.getCodePropertyForHierarchyLevel(level)],
            hierarchy_level: level
        };

        hierarchy.hierarchy_excipio.findOne(levelParams, function(e, hierarchy_result) {
            if(hierarchy_result) {
                if(hierarchy_result.active == 'N') {
                    callback2(null, null);
                } else {
                    callback2(null, hierarchy_result);
                }
            } else {
                winston.log('error', 'while processing excipio hierarchy, failed to process level ' + level + ' of level 5 item ' + level5Item.code);
                callback2(true);
            }
        });
    }

    return {
        process : process
    };
}());

// ===

