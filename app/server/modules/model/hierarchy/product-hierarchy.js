var _ = require('underscore');
var fs = require('fs');
var winston = require('winston');

var db = require('./../../database/static-database');
var dbUtils = require('../../database/database-utils');
var productHierarchy = db.db.collection('product-hierarchy');
var schema = require('./../schema/schema');

dbUtils.addStandardMethods(exports, productHierarchy);

exports.readFiles = function(file_path_list, callback) {
    function readFiles(remaining_files) {
        var file = remaining_files.shift();
        _readFile(file.path, function() {
            if(remaining_files.length == 0) {
                callback();
                return;
            }
            readFiles(remaining_files);
        });
    }

    productHierarchy.remove({}, function() {
        var file_list = _.map(file_path_list, function(file) { return {path: file}});
        readFiles(file_list);
    });
};

function _readFile(path, onComplete) {

    fs.readFile(path, 'UCS2', function(err, data) {
        if (err) throw err;

        // read all of the lines
        var lines = data.split('\n');
        _insertFromLines(path, lines, 1, function() {

            // move on to the next file
            onComplete();
        });

        winston.log('info', 'processing ' + lines.length + ' records.');
    });
}

function _insertFromLines(path, lines, index, callback) {
    if(index == lines.length) {
        callback();
    } else {
        var lineItems = lines[index].split('\t');

        if(lineItems.length > 53) {
            var hierarchy_record = {};
            hierarchy_record.company_id = lineItems[0];
            hierarchy_record.category_id = lineItems[1];
            hierarchy_record.code = lineItems[2];
            hierarchy_record.hierarchy_level = lineItems[3];
            hierarchy_record.display_sequence = lineItems[4];
            hierarchy_record.active = lineItems[5];
            hierarchy_record.full_case_required = lineItems[6];
            hierarchy_record.subcategory_code = lineItems[7];
            hierarchy_record.group_code	= lineItems[8];
            hierarchy_record.subgroup_code = lineItems[9];
            hierarchy_record.section_code = lineItems[10];
            hierarchy_record.subsection_code = lineItems[11];
            hierarchy_record.category_specific = lineItems[12];
            hierarchy_record.description1 = lineItems[13];
            hierarchy_record.description2 = lineItems[14];
            hierarchy_record.description3 = lineItems[15];
            hierarchy_record.active_start_date = lineItems[16];
            hierarchy_record.active_end_date = lineItems[17];
            hierarchy_record.date_added	= lineItems[18];
            hierarchy_record.added_by_user_code = lineItems[19];
            hierarchy_record.date_changed = lineItems[20];
            hierarchy_record.changed_by_user_code = lineItems[21];
            hierarchy_record.alert_infocenter_code = lineItems[22];
            hierarchy_record.infocenter_code = lineItems[23];
            hierarchy_record.text_search = lineItems[24];
            hierarchy_record.identity_id = lineItems[25];
            hierarchy_record.product_code = lineItems[26];
            hierarchy_record.product_description = lineItems[27];
            hierarchy_record.upc = lineItems[28];
            hierarchy_record.item_number = lineItems[29];
            hierarchy_record.mfg = lineItems[30];
            hierarchy_record.default_factory = lineItems[31];
            hierarchy_record.e06_code = lineItems[32]; //default prod.line
            hierarchy_record.pickup = lineItems[33];
            hierarchy_record.e08_code = lineItems[34];
            hierarchy_record.e09_code = lineItems[35];
            hierarchy_record.e10_code = lineItems[36];
            hierarchy_record.e11_code = lineItems[37];
            hierarchy_record.flavor = lineItems[38];
            hierarchy_record.e13_code = lineItems[39];
            hierarchy_record.type = lineItems[40];
            hierarchy_record.e15_code = lineItems[41];
            hierarchy_record.storeCheckSampleCandidate = lineItems[42];
            hierarchy_record.format = lineItems[43];
            hierarchy_record.e18_code = lineItems[44];
            hierarchy_record.e19_code = lineItems[45];
            hierarchy_record.e20_code = lineItems[46];
            hierarchy_record.e21_code = lineItems[47];
            hierarchy_record.ean_13 = lineItems[48];
            hierarchy_record.global_brand = lineItems[49];
            hierarchy_record.e24_code = lineItems[50];
            hierarchy_record.e25_code = lineItems[51];
            hierarchy_record.cbu = lineItems[52];
            hierarchy_record.cbu_description = lineItems[53];
            hierarchy_record.version = schema.currentVersion;

            _upsertProduct(hierarchy_record, function(err) { // err, object
                if(err != null) {
                    winston.log('error', 'while reading danone-platform file, path="' + path + '", explanation=' + err);
                }
                _insertFromLines(path, lines, index + 1, callback);
            });

        } else {
            winston.log('warn', 'while reading product file, line ' + (index + 1) + ' (1-indexed) did not have enough records to parse, path=' + path);
            _insertFromLines(path, lines, index + 1, callback);
        }
    }
}

function _upsertProduct(obj, callback) {
    var keyedItem = {
        company_id: obj.company_id,
        category_id: obj.category_id,
        code: obj.code,
        hierarchy_level: obj.hierarchy_level,
        t03_code: obj.t03_code
    };

    productHierarchy.findOne(keyedItem, function(err, o) {
        if(err) {
            callback(err);
            return;
        }

        if(o) {
            productHierarchy.update(keyedItem, {$set: obj}, function(err_update, update_result) {
                callback(err_update, update_result);
            });
        } else {
            productHierarchy.insert(obj, {safe: true}, callback);
        }
    });
}
