var _ = require('underscore');
var async = require('async');
var winston = require('winston');

var db = require('./../../database/semi-dynamic-database');
var product = db.db.collection('product');

var productHierarchy = require('./product-hierarchy');
var organization = require('../organization');
var static_loads = require('../../static-loads');

var dbUtils = require('../../database/database-utils');
var schema = require('./../schema/schema');
var nodeUtils = require('../../node-utils');

var index_keys = [
    { organization: 1, timestamp: 1 }
];

dbUtils.addStandardMethods(exports, product, index_keys);

exports.process = function(obj, callback) {
    var keyedItem = {
        //    company_id: company_id,
        //    category_id: category_id,
        //    code: code,
        hierarchy_level: '0'
    };

    productHierarchy.find(keyedItem, function(e, res) {
        if (e) {
            winston.log('error', 'product hierarchy level 0 could not be found');
            callback(e, null);
        } else {
            var timestamp = new Date().getTime().toString();
            static_loads.insert({
                type: 'products',
                timestamp: timestamp
            }, function(data) {
                if(data != null) {
                    winston.log('info', 'processing ' + res.length + ' records of product hierarchy.');
                    processLevel0Hierarchy(res, timestamp, callback);

                    //callback(null, res)
                } else {
                    winston.error('failed to process product hierarchy - could not insert static load record');
                    callback('could not insert static load record', null);
                }
            });
        }
    });
};

var mapHierarchyItem = function(fullHierarchyItem) {
    var mapped = {};
    mapped.code = fullHierarchyItem.code;
    mapped.sequence = fullHierarchyItem.display_sequence;
    mapped.description1 = fullHierarchyItem.description1;
    mapped.description2 = fullHierarchyItem.description2;
    mapped.description3 = fullHierarchyItem.description3;
    mapped.identity_id = fullHierarchyItem.identity_id;
    return mapped;
};

var processLevel0HierarchyItem = function(level0Item, timestamp, callback2) {
    var level5Params = {
        company_id: level0Item.company_id,
        category_id: level0Item.category_id,
        code: level0Item.subsection_code,
        hierarchy_level:'5'
    };

    var level4Params = {
        company_id: level0Item.company_id,
        category_id: level0Item.category_id,
        code: level0Item.section_code,
        hierarchy_level:'4'
    };

    var level3Params = {
        company_id: level0Item.company_id,
        category_id: level0Item.category_id,
        code: level0Item.subgroup_code,
        hierarchy_level:'3'
    };

    var level2Params = {
        company_id: level0Item.company_id,
        category_id: level0Item.category_id,
        code: level0Item.group_code,
        hierarchy_level:'2'
    };

    var level1Params = {
        company_id: level0Item.company_id,
        category_id: level0Item.category_id,
        code: level0Item.subcategory_code,
        hierarchy_level:'1'
    };

    async.series({

        level5_item: function(callback) {
            productHierarchy.findOne(level5Params, function(e, o5) {
                if(o5) {
                    callback(e, mapHierarchyItem(o5));
                    return;
                }
                winston.log('error', 'while processing product hierarchy, failed to process level 5 of level 0 item ' + level0Item.code);
                callback(null, null);
            });
        },

        level4_item: function(callback) {
            productHierarchy.findOne(level4Params, function(e, o4) {
                if(o4) {
                    callback(e, mapHierarchyItem(o4));
                    return;
                }
                winston.log('error', 'while processing product hierarchy, failed to process level 4 of level 0 item ' + level0Item.code);
                callback(null, null);
            });
        },

        level3_item: function(callback) {
            productHierarchy.findOne(level3Params, function(e, o3) {
                if(o3) {
                    callback(e, mapHierarchyItem(o3));
                    return;
                }
                winston.log('error', 'while processing product hierarchy, failed to process level 3 of level 0 item ' + level0Item.code);
                callback(null, null);
            });
        },

        level2_item: function(callback) {
            productHierarchy.findOne(level2Params, function(e, o2) {
                if(o2) {
                    callback(e, mapHierarchyItem(o2));
                    return;
                }
                winston.log('error', 'while processing product hierarchy, failed to process level 2 of level 0 item ' + level0Item.code);
                callback(null, null);
            });
        },

        level1_item: function(callback) {
            productHierarchy.findOne(level1Params, function(e, o1) {
                if(o1) {
                    callback(e, mapHierarchyItem(o1));
                    return;
                }
                winston.log('error', 'while processing product hierarchy, failed to process level 1 of level 0 item ' + level0Item.code);
                callback(null, null);
            });
        }

    }, function(err, results) {
        if(results.level5_item && results.level4_item) {
            results.level5_item.parent = results.level4_item;
        }
        if(results.level4_item && results.level3_item) {
            results.level4_item.parent = results.level3_item;
        }
        if(results.level3_item && results.level2_item) {
            results.level3_item.parent = results.level2_item;
        }
        if(results.level2_item && results.level1_item) {
            results.level2_item.parent = results.level1_item;
        }

        loadCBU(level0Item.cbu, level0Item.cbu_description, function(err, cbu) {
            if(err == null) {
                var to_insert = {
                    version: schema.currentVersion,
                    source: 'import',
                    timestamp: timestamp,
                    company_id: level0Item.company_id,
                    category_id: level0Item.category_id,
                    code: level0Item.code,
                    sequence: level0Item.display_sequence,
                    product_description: level0Item.product_description,
                    description: level0Item.description1,
                    description2: level0Item.description2,
                    description3: level0Item.description3,
                    identity_id: level0Item.identity_id,
                    category_specific: level0Item.category_specific,
                    active: level0Item.active,
                    full_case_required: level0Item.full_case_required,
                    active_start_date: level0Item.active_start_date,
                    active_end_date: level0Item.active_end_date,
                    date_added: level0Item.date_added,
                    added_by_user_code: level0Item.added_by_user_code,
                    date_changed: level0Item.date_changed,
                    changed_by_user_code: level0Item.changed_by_user_code,
                    alert_infocenter_code: level0Item.alert_infocenter_code,
                    infocenter_code: level0Item.infocenter_code,
                    text_search: level0Item.text_search,
                    product_code: level0Item.product_code,
                    upc: level0Item.upc,
                    item_number: level0Item.item_number,
                    mfg: level0Item.mfg,
                    default_factory: level0Item.default_factory,
                    e06_code: level0Item.e06_code,
                    pickup: level0Item.pickup,
                    e08_code: level0Item.e08_code,
                    e09_code: level0Item.e09_code,
                    e10_code: level0Item.e10_code,
                    e11_code: level0Item.e11_code,
                    flavor: level0Item.flavor,
                    e13_code: level0Item.e13_code,
                    type: level0Item.type,
                    e15_code: level0Item.e15_code,
                    storeCheckSampleCandidate: level0Item.storeCheckSampleCandidate,
                    format: level0Item.format,
                    e18_code: level0Item.e18_code,
                    e19_code: level0Item.e19_code,
                    e20_code: level0Item.e20_code,
                    e21_code: level0Item.e21_code,
                    ean_13: level0Item.ean_13,
                    global_brand: level0Item.global_brand,
                    e24_code: level0Item.e24_code,
                    e25_code: level0Item.e25_code,
                    organization: cbu._id.toHexString(),
                    organization_description: level0Item.cbu_description
                };
                if(results.level5_item) {
                    to_insert.parent = results.level5_item;
                }
                exports.insert(to_insert, function(res) {
                    callback2(null, res);
                });
            } else {
                winston.log('error', 'while processing product hierarchy, could not find cbu with name=' + level0Item.cbu);
                callback2('could not find CBU');
            }
        });
    });
};

var processLevel0Hierarchy = function(level0Items, timestamp, callback2) {
    if(level0Items.length == 0) {
        winston.info('completed product hierarchy processing');
        callback2(null, {result: 'ok'});
        return;
    }
    var item = level0Items.shift();
    if(item.category_specific == "NULL") {
        winston.log('warn', 'product with null category-specific value: ' + res[i].code);
    }

    processLevel0HierarchyItem(item, timestamp, function(err, result) {
        nodeUtils.recursiveWrapper(function() {
            processLevel0Hierarchy(level0Items, timestamp, callback2);
        });
    });
};

var loadCBU = function(cbu_name, cbu_description, callback) {
    organization.findOne({ code: cbu_name.split(' ')[0] }, function(err, org) {
        if(err == null) {
            if(org != null) {
                callback(err, org);
            } else {
                winston.log('error', 'while processing product hierarchy, could not find cbu with name=' + cbu_name);
                callback('could not find CBU', null);
                /*
                organization.insert({name: cbu_name}, function(item) {
                   callback(null, item);
                });
                */
            }
        } else {
            callback(err, null);
        }
    });
};