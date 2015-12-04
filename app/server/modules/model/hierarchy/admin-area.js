var db = require('./../../database/static-database');
var admin_area = db.db.collection('administrative-area');
var dbUtils = require('../../database/database-utils');
var winston = require('winston');
var fs = require('fs');

var OrganizationModule = require('../organization');

var schema = require('./../schema/schema');

dbUtils.addStandardMethods(exports, admin_area);

exports.readFiles = function(file_list, callback) {
    admin_area.remove({}, function() {
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

        admin_area.ensureIndex({ code: 1, description: 1, hierarchy_level: 1}, {background: true}, function(err) {
            winston.log('debug', 'completed initiating ensureIndex of admin area container, err=' + err);
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

            var admin_area_record = {};

            admin_area_record.code = lineItems[2];
            admin_area_record.hierarchy_level = lineItems[3];
            admin_area_record.active = lineItems[5];
            admin_area_record.description = lineItems[13];
            admin_area_record.identity_id = lineItems[25].trim();
            admin_area_record.version = schema.currentVersion;

            if(admin_area_record.hierarchy_level == '0') {
                OrganizationModule.findOne({code: admin_area_record.code.split(' ')[0]}, function(err, organization) {
                    admin_area.insert(admin_area_record, {safe: true}, function(err, object) {
                        if(organization) {
                            admin_area_record.organization = organization._id.toHexString();
                        }

                        if(err != null) {
                            winston.log('error', 'while reading admin area file, path="' + path + '", explanation=' + err);
                        }
                        insertFromLines(path, lines, index + 1, callback);
                    });
                });
            } else {
                admin_area.insert(admin_area_record, {safe: true}, function(err, object) {
                    if(err != null) {
                        winston.log('error', 'while reading admin area file, path="' + path + '", explanation=' + err);
                    }
                    insertFromLines(path, lines, index + 1, callback);
                });
            }

        } else {
            winston.log('warn', 'while reading admin area file, line ' + (index + 1) + ' (1-indexed) did not have enough records to parse, path=' + path);
            insertFromLines(path, lines, index + 1, callback);
        }
    }
}