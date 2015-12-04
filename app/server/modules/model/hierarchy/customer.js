var db = require('./../../database/static-database');
var customer = db.db.collection('customer');
var dbUtils = require('../../database/database-utils');
var winston = require('winston');
var fs = require('fs');

var OrganizationModule = require('../organization');

var schema = require('./../schema/schema');

dbUtils.addStandardMethods(exports, customer);

exports.readFiles = function(file_list, callback) {
    customer.remove({}, function() {
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

        customer.ensureIndex({ code: 1, description: 1}, {background: true}, function(err) {
            winston.log('debug', 'completed initiating ensureIndex of customer container, err=' + err);
        });

        // read all of the lines
        var lines = data.split('\n');
        insertFromLines(path, lines, 1, function() {

            // move on to the next file
            onComplete();
        });

        winston.log('info', 'processing ' + lines.length + ' records.');
    });
}

function insertFromLines(path, lines, index, callback) {
    if(index == lines.length) {
        callback();
    } else {
        var lineItems = lines[index].split('\t');

        if(lineItems.length > 25) {

            var customer_record = {};
            customer_record.code = lineItems[2];
            customer_record.hierarchy_level = lineItems[3];
            customer_record.active = lineItems[5];
            customer_record.description = lineItems[13];
            customer_record.identity_id = lineItems[25].trim();
            customer_record.version = schema.currentVersion;

            OrganizationModule.findOne({code: customer_record.code.split(' ')[0]}, function(err, organization) {
                if(organization) {
                    customer_record.organization = organization._id.toHexString();
                }

                customer.insert(customer_record, {safe: true}, function(err, object) {
                    if(err != null) {
                        winston.log('error', 'while reading customer file, path="' + path + '", explanation=' + err);
                    }
                    insertFromLines(path, lines, index + 1, callback);
                });
            });

        } else {
            winston.log('warn', 'while reading customer file, line ' + (index + 1) + ' (1-indexed) did not have enough records to parse, path=' + path);
            insertFromLines(path, lines, index + 1, callback);
        }
    }
}