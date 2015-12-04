var _ = require('underscore');
var async = require('async');
var db = require('./../../database/static-database');
var fs = require('fs');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var dbUtils = require('../../database/database-utils');
var hierarchyProcessor = require('./hierarchy-processor');
var linereader = require('../../file-line-reader');
var nodeUtils = require('../../node-utils');
var posHierarchy = db.db.collection('point-of-sale-hierarchy');
var schema = require('./../schema/schema');

dbUtils.addStandardMethods(exports, posHierarchy);

// expect file.path to be set
exports.readHierarchyFiles = function(files, callback2) {
    posHierarchy.remove({}, function(err, result) {
        _readFiles(files, callback2);
    });
};

exports.mergeRecordsWithA70 = _mergeRecordsWithA70;

exports.process = function(posModule, callback) {
    var valueKeys = [
        'company_id', 'address_id', 'address_type_code','active','company_name','address1',
        'address2','address3','city','state','postal_code', 'country','email','account_number',
        'a12_code',
        'a47_code', // Storecheck Candidate
        'a48_code', // Region of Sales
        'a50_code', // Distribution Channel
        'a52_code', // Danone Platform
        'a53_code', // Admin Area
        'a54_code', // Preparation Type
        'a56_code', // Mechanization
        'a57_code', // Customer Platform
        'a59_code', // Customer,
        'a70_code', // GUID
        'language_id', 'currency_code','primary_address_id','date_added', 'added_by_user_code',
        'organization', 'organization_description','source', 'version', 'timestamp'
    ];

    var params = {
        static_load_name: 'point-of-sale',
        hierarchyModule: exports,
        resultsModule: posModule,
        hierarchyQuery: {},
        recordPKs: ['company_id', 'address_id'],
        valuePKs: valueKeys,
        orgCodeFunction: function(item) { return item.a59_code.split(' ')[0]; }
    };

    hierarchyProcessor.process(params, function(err, added_count) {
        winston.debug('began merging a70 records');

        // look for items from this static load that have a70 codes, and merge them with their matching non-import brother
        _mergeRecordsWithA70(posModule, function(err_merge, merge_results) {
            winston.debug('finished merging a70 records');
            callback(err, added_count);
        });
    });
};

function _mergeRecordsWithA70(posModule, callback2) {

    // recursive algorithm: query for a70 code exists and non-empty
    // if the a70 code is not an id, clear it, log a warning
    // if the a70 code is an id, grab that item from posModule by id
    //     if that pos doesn't exist, we should clear it and log a warning
    //     fill in the address_id and other features from the static load record
    //     erase the static load record
    // regardless of case, the query must get one item smaller each time, as this is recursive
    posModule.findOne({$and: [{a70_code: {$exists: true}}, {a70_code: {$ne: ''}}]}, function(err_pos, pos) {
        if(err_pos) {
            callback2(err);
            return;
        }
        if(!pos) {
            callback2(null, null);
            return;
        }

        var a70_pos;

        async.series({
            'check_a70_code': function(callback) {
                if(nodeUtils.isValidId(pos.a70_code.trim())) {
                    callback();
                    return;
                }

                // invalid a70 codes are removed from the pos record - move on to next merge
                winston.warn('pos "' + pos.company_name + ', ' + pos.city + '" ' + pos._id.toHexString() + ' had an invalid a70 code "' + pos.a70_code + '" - and the a70 code was removed');
                posModule.collection.update({_id: pos._id}, {$unset: {a70_code: 1}}, function(err_remove, remove_result) {
                    if(err_remove) {
                        callback2(err_remove);
                        return;
                    }
                    nodeUtils.recursiveWrapper(function() { _mergeRecordsWithA70(posModule, callback2); });
                });
            },

            'get_a70_pos': function(callback) {

                // try to grab the pos for that a70 code
                posModule.findOne({_id: ObjectId(pos.a70_code.trim())}, function(err_user_pos, a70_pos_result) {
                    if(err_user_pos) {
                        callback2('pos referenced in a70 code does not exist');
                        return;
                    }

                    // if the a70 code is bogus, log it and wipe it
                    if(!a70_pos_result) {
                        winston.warn('pos ' + pos._id.toHexString() + ' had an invalid a70 code "' + pos.a70_code + '" - which will be removed');
                        posModule.collection.update({_id: pos._id}, {$set: {a70_code: ''}, $unset: {timestamp: 1}}, function(err_update) { // update_result
                            if(err_update) {
                                callback2(err_update);
                                return;
                            }
                            nodeUtils.recursiveWrapper(function() { _mergeRecordsWithA70(posModule, callback2); });
                        });
                        return;
                    }

                    a70_pos = a70_pos_result;

                    // merge attributes from the new POS to our old one (id = pos.a70_code)
                    _.keys(pos, function(pos_key) {
                        if(pos_key != '_id' && pos_key != 'source' && pos_key != 'a70_code') {
                            a70_pos[pos_key] = pos[pos_key];
                        }
                    });

                    callback();
                });
            },

            'update_a70': function(callback) {

                // do the update from the merge
                var update_record = _.omit(a70_pos, '_id');
                update_record.a70_code = '';

                //winston.debug('pos "' + a70_pos.company_name + ', ' + a70_pos.city + '" ' + a70_pos._id.toHexString() + ' has been merged and will be updated');
                posModule.collection.update({_id: a70_pos._id}, update_record, function(err_update) { // , update_result
                    if(err_update) {
                        callback2(err_update);
                        return;
                    }

                    callback();
                });
            },

            'update_new_pos': function(callback) {

                // remove the newly-imported POS, if it differs from the one referenced by the a70 code
                if(a70_pos._id.toHexString() == pos._id.toHexString()) {
                    posModule.collection.update({_id: pos._id}, {$set: {a70_code: ''}}, function(err_update) { // update_result
                        if(err_update) {
                            callback2(err_update);
                            return;
                        }
                        nodeUtils.recursiveWrapper(function() { _mergeRecordsWithA70(posModule, callback2); });
                    });
                    return;
                }

                winston.debug('removing pos "' + pos.company_name + ', ' + pos.city + '" from most recent import, as it was merged based on an a70 code');
                posModule.collection.update({_id: pos._id}, {$set: {timestamp: 1}, $unset: {a70_code: 1}}, function(err_remove, remove_result) {
                    if(err_remove) {
                        callback2(err_remove);
                        return;
                    }
                    nodeUtils.recursiveWrapper(function() { _mergeRecordsWithA70(posModule, callback2); });
                });
            }
        });


        /*
        // if the a70 code is bogus, log it and wipe it
        winston.warn('pos "' + pos.company_name + ', ' + pos.city + '" had an invalid a70 code "' + pos.a70_code + '" - and the pos will be removed');
        posModule.collection.remove({_id: pos._id}, function(err_remove, remove_result) {
            if(err_remove) {
                callback2(err_remove);
                return;
            }
            nodeUtils.recursiveWrapper(function() { _mergeRecordsWithA70(posModule, callback2); });
        });
        */
    });
}

function _readFiles(files, callback) {
    if(files.length == 0) {
        callback();
        return;
    }

    var file = files.shift();

    winston.info('began reading pos hierarchy file ' + file.path);

    var reader = new linereader.FileLineReader(file.path, 'ucs2');

    _readLines(reader, 0, function(err, result) {
        if(err) {
            winston.error('while reading POS hierarchy: ' + err);
        }

        nodeUtils.recursiveWrapper(function() {
            _readFiles(files, callback);
        });
    });
}

function _readLines(reader, index, callback2) {
    if(!reader.hasNextLine()) {
        callback2();
        return;
    }

    var lines = [], line_count = 0, BATCH_SIZE = 100;

    while(lines.length < BATCH_SIZE && reader.hasNextLine()) {

        // account for an optional header line
        if(index == 0) {
            var first_line = reader.nextLine();
            if(first_line.indexOf('﻿company_i\taddress_id\taddress_type_code\taddress_code\tactive') == -1) {
                lines.push(reader.nextLine());
            }
        } else {
            lines.push(reader.nextLine());
        }

        line_count++;
    }

    if(index > 0 && (index % 1000 == 0)) {
        var pct = ((reader.getCurrentPosition() / reader.getFileSize()) * 100).toFixed(1);

        winston.debug('pos hierarchy import, line ' + index + ' reached during read (' + pct + '% buffered)');
    }

    _processLines(lines, index, function(err, result) {
        nodeUtils.recursiveWrapper(function() {
            _readLines(reader, index + line_count, callback2);
        });
    });
}

function _processLines(lines, index, callback2) {
    if(lines.length == 0) {
        callback2(null, index);
        return;
    }

    var line = lines.shift();

    var lineItems = line.split('\t');

    if(lineItems.length > 122) {
        var hierarchy_record = {};
        hierarchy_record.company_id = lineItems[0];
        hierarchy_record.address_id = lineItems[1];
        hierarchy_record.address_type_code = lineItems[2];
        hierarchy_record.address_code = lineItems[3];
        hierarchy_record.active = lineItems[4];
        hierarchy_record.account_number = lineItems[5];
        hierarchy_record.name_title = lineItems[6];
        hierarchy_record.given_names = lineItems[7];
        hierarchy_record.middle_initial	= lineItems[8];
        hierarchy_record.last_name = lineItems[9];
        hierarchy_record.suffix = lineItems[10];
        hierarchy_record.company_name = lineItems[11];
        hierarchy_record.job_title = lineItems[12];
        hierarchy_record.address1 = lineItems[13];
        hierarchy_record.address2 = lineItems[14];
        hierarchy_record.address3 = lineItems[15];
        hierarchy_record.city = lineItems[16];
        hierarchy_record.state = lineItems[17];
        hierarchy_record.postal_code	= lineItems[18];
        hierarchy_record.country = lineItems[19];
        hierarchy_record.email = lineItems[20];
        hierarchy_record.search_name = lineItems[21];
        hierarchy_record.search_address = lineItems[22];
        hierarchy_record.originated_via = lineItems[23];
        hierarchy_record.originated_date = lineItems[24];
        hierarchy_record.last_modified = lineItems[25];
        hierarchy_record.allow_survey = lineItems[26];
        hierarchy_record.last_survey = lineItems[27];
        hierarchy_record.last_contact = lineItems[28];
        hierarchy_record.accumulated_goodwill = lineItems[29];
        hierarchy_record.where_to_buy = lineItems[30];
        hierarchy_record.latitude = lineItems[31];
        hierarchy_record.longitude = lineItems[32];
        hierarchy_record.instructions = lineItems[33];
        hierarchy_record.a05_code = lineItems[34];
        hierarchy_record.a06_code = lineItems[35];
        hierarchy_record.a07_code = lineItems[36];
        hierarchy_record.a08_code = lineItems[37];
        hierarchy_record.a09_code = lineItems[38];
        hierarchy_record.a10_code = lineItems[39];
        hierarchy_record.a11_code = lineItems[40];
        hierarchy_record.a12_code = lineItems[41];
        hierarchy_record.a13_code = lineItems[42];
        hierarchy_record.a14_code = lineItems[43];
        hierarchy_record.a15_code = lineItems[44];
        hierarchy_record.email2 = lineItems[45];
        hierarchy_record.a16_code = lineItems[46];
        hierarchy_record.a17_code = lineItems[47];
        hierarchy_record.a18_code = lineItems[48];
        hierarchy_record.a19_code = lineItems[49];
        hierarchy_record.a20_code = lineItems[50];
        hierarchy_record.a21_code = lineItems[51];
        hierarchy_record.a22_code = lineItems[52];
        hierarchy_record.a23_code = lineItems[53];
        hierarchy_record.a24_code = lineItems[54];
        hierarchy_record.a25_code = lineItems[55];
        hierarchy_record.repeater_code = lineItems[56];
        hierarchy_record.a26_code = lineItems[57];
        hierarchy_record.encl_auth_level = lineItems[58];
        hierarchy_record.email3 = lineItems[59];
        hierarchy_record.county = lineItems[60];
        hierarchy_record.a27_code = lineItems[61];
        hierarchy_record.a28_code = lineItems[62];
        hierarchy_record.a29_code = lineItems[63];
        hierarchy_record.a30_code = lineItems[64];
        hierarchy_record.a31_code = lineItems[65];
        hierarchy_record.a32_code = lineItems[66];
        hierarchy_record.a33_code = lineItems[67];
        hierarchy_record.a34_code = lineItems[68];
        hierarchy_record.a35_code = lineItems[69];
        hierarchy_record.a36_code = lineItems[70];
        hierarchy_record.a37_code = lineItems[71];
        hierarchy_record.a38_code = lineItems[72];
        hierarchy_record.a39_code = lineItems[73];
        hierarchy_record.a40_code = lineItems[74];
        hierarchy_record.a41_code = lineItems[75];
        hierarchy_record.a42_code = lineItems[76];
        hierarchy_record.a43_code = lineItems[77];
        hierarchy_record.a44_code = lineItems[78];
        hierarchy_record.a45_code = lineItems[79];
        hierarchy_record.a46_code = lineItems[80];
        hierarchy_record.a47_code = lineItems[81];
        hierarchy_record.a48_code = lineItems[82];
        hierarchy_record.a49_code = lineItems[83];
        hierarchy_record.a50_code = lineItems[84];
        hierarchy_record.a51_code = lineItems[85];
        hierarchy_record.a52_code = lineItems[86];
        hierarchy_record.a53_code = lineItems[87];
        hierarchy_record.a54_code = lineItems[88];
        hierarchy_record.a55_code = lineItems[89];
        hierarchy_record.a56_code = lineItems[90];
        hierarchy_record.a57_code = lineItems[91];
        hierarchy_record.a58_code = lineItems[92];
        hierarchy_record.a59_code = lineItems[93];
        hierarchy_record.a60_code = lineItems[94];
        hierarchy_record.a61_code = lineItems[95];
        hierarchy_record.a62_code = lineItems[96];
        hierarchy_record.a63_code = lineItems[97];
        hierarchy_record.a64_code = lineItems[98];
        hierarchy_record.a65_code = lineItems[99];
        hierarchy_record.a66_code = lineItems[100];
        hierarchy_record.a67_code = lineItems[101];
        hierarchy_record.a68_code = lineItems[102];
        hierarchy_record.a69_code = lineItems[103];
        hierarchy_record.a70_code = lineItems[104];
        hierarchy_record.a71_code = lineItems[105];
        hierarchy_record.a72_code = lineItems[106];
        hierarchy_record.a73_code = lineItems[107];
        hierarchy_record.a74_code = lineItems[108];
        hierarchy_record.a75_code = lineItems[109];
        hierarchy_record.a76_code = lineItems[110];
        hierarchy_record.a77_code = lineItems[111];
        hierarchy_record.a78_code = lineItems[112];
        hierarchy_record.a79_code = lineItems[113];
        hierarchy_record.a80_code = lineItems[114];
        hierarchy_record.opt_out = lineItems[115];
        hierarchy_record.language_id = lineItems[116];
        hierarchy_record.currency_code = lineItems[117];
        hierarchy_record.primary_address_id = lineItems[118];
        hierarchy_record.date_added = lineItems[119];
        hierarchy_record.added_by_user_code = lineItems[120];
        hierarchy_record.date_changed = lineItems[121];
        hierarchy_record.changed_by_user_code = lineItems[122].trim(); //TODO: trim any trailing space?

        hierarchy_record.version = schema.currentVersion;

        // limit field length to 256 bytes
        var field_as_string;
        Object.keys(hierarchy_record).forEach(function(hierarchy_key) {
            field_as_string = hierarchy_record[hierarchy_key];
            if(field_as_string.length > 256) {
                winston.warn('pos hierarchy import, truncated line ' + (index + 1) + ' field ' + hierarchy_key);
                hierarchy_record[hierarchy_key] = field_as_string.slice(0, 255);
            }
        });

        _upsert(hierarchy_record, function(err, object) {
            if(err != null) {
                winston.log('error', 'pos hierarchy import, identity_id=' + hierarchy_record.address_id + ', explanation=' + err);
            }
            _processLines(lines, index + 1, callback2);
        });
    } else {
        winston.log('warn', 'pos hierarchy import, line ' + (index + 1) + ' (1-indexed) did not have enough records to parse');
        _processLines(lines, index + 1, callback2);
    }
}

function _upsert(obj, callback2) {

    async.series({

        simple_upsert: function(callback) {
            var keyedItem = {
                company_id: obj.company_id,
                address_id: obj.address_id
            };

            var options = {
                upsert: true,
                multi: false
            };

            posHierarchy.update(
                keyedItem,      // query
                obj,            // update
                options,
                function(e, o) {
                    callback(e, o);
                }
            );
        }

    }, function(err, results) {
        callback2(err, results);
    });
}
