var db = require('./../../database/static-database');
var region_of_sales = db.db.collection('region-of-sales');
var dbUtils = require('../../database/database-utils');
var winston = require('winston');
var fs = require('fs');

var OrganizationModule = require('../organization');

var schema = require('./../schema/schema');

dbUtils.addStandardMethods(exports, region_of_sales);

exports.readFiles = function(file_list, callback) {
    region_of_sales.remove({}, function() {
        function readFiles(remaining_files) {
            var file = remaining_files.shift();
            readFile(file.path, function() {
                if(remaining_files.length == 0) {
                    callback();
                    return;
                }
                readFiles(remaining_files);
            });
        }
        readFiles(file_list);
    });
};

function readFile(path, onComplete) {

    fs.readFile(path, 'UCS2', function(err, data) {
        if (err) throw err;

        region_of_sales.ensureIndex({ code: 1, description: 1}, {background: true}, function(err) {
            winston.log('debug', 'completed initiating ensureIndex of region_of_sales container, err=' + err);
        });

        // read all of the lines
        var lines = data.split('\n');
        winston.log('info', 'processing ' + lines.length + ' records for file ' + path);

        insertFromLines(path, lines, 1, function() {

            // move on to the next file
            onComplete();
        });
    });
}

function insertFromLines(path, lines, index, callback) {
    if(index == lines.length) {
        callback();
    } else {
        var lineItems = lines[index].split('\t');

        if(lineItems.length > 26) {

            var region_of_sales_record = {}, hierarchy_level;
            region_of_sales_record.code = lineItems[2];
            hierarchy_level = lineItems[3];

            region_of_sales_record.display_sequence = lineItems[4];
            region_of_sales_record.active = lineItems[5];
            region_of_sales_record.description = lineItems[13];
            region_of_sales_record.identity_id = lineItems[25].trim();
            region_of_sales_record.version = schema.currentVersion;

            if(hierarchy_level == '0') {
                OrganizationModule.findOne({code: region_of_sales_record.code.split(' ')[0]}, function(err, organization) {

                    if(organization) {
                        region_of_sales_record.organization = organization._id.toHexString();
                    }

                    region_of_sales.insert(region_of_sales_record, {safe: true}, function(err) { // err, object
                        if(err != null) {
                            winston.log('error', 'while reading region_of_sales file, path="' + path + '", explanation=' + err);
                        }
                        insertFromLines(path, lines, index + 1, callback);
                    });
                });
            } else {
                region_of_sales.insert(region_of_sales_record, {safe: true}, function(err) { // err, object
                    if(err != null) {
                        winston.log('error', 'while reading region_of_sales file, path="' + path + '", explanation=' + err);
                    }
                    insertFromLines(path, lines, index + 1, callback);
                });
            }

        } else {
            winston.log('warn', 'while reading region_of_sales file, line ' + (index + 1) + ' (1-indexed) did not have enough records to parse, path=' + path);
            insertFromLines(path, lines, index + 1, callback);
        }
    }
}