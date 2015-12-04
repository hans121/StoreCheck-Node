var winston = require('winston');
var fs = require('fs');

var db = require('./../../database/static-database');
var factoryHierarchy = db.db.collection('factory-hierarchy');
var dbUtils = require('../../database/database-utils');
var schema = require('./../schema/schema');

dbUtils.addStandardMethods(exports, factoryHierarchy);

exports.readFiles = function(file_list, callback) {
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
    readFiles(file_list);
};

exports.readHierarchyFiles = function(path, callback2) {
    _readFile(path, callback2);
};

function _readFile(path,callback2) {
    fs.readFile(path, 'ucs2', function(err, data) {
        if (err) throw err;

        var lines = data.split('\n');

        if(lines.length <= 1) {
            callback2(null, 0);
            return;
        }

        lines.shift();
        _readLine(lines, 1, callback2 ? callback2 : function(){});
    });
}

function _readLine(lines, index, callback2) {
    if(lines.length == 0) {
        callback2(null, index);
        return;
    }

    var line = lines.shift();
    var lineItems = line.split('\t');

    if(lineItems.length > 25) {
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
        hierarchy_record.version = schema.currentVersion;

        factoryHierarchy.insert(hierarchy_record, {safe: true}, function(err, object) {
            if(err != null) {
                winston.log('error', 'while reading factoryHierarchy file, identity_id=' + object.identity_id + ', explanation=' + err);
            }
            _readLine(lines, index + 1, callback2);
        });
    } else {
        winston.log('warn', 'while reading factoryHierarchy file, line ' + (index + 1) + ' (1-indexed) did not have enough records to parse');
        _readLine(lines, index + 1, callback2);
    }
}