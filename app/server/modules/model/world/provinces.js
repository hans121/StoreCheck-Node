var db = require('./../../database/static-database');
var provinces = db.db.collection('provinces');
var dbUtils = require('../../database/database-utils');
var winston = require('winston');
var fs = require('fs');

var schema = require('./../schema/schema');

dbUtils.addStandardMethods(exports, provinces);

exports.readFile = function(path, callback) {
    fs.readFile(path, 'UTF8', function(err, data) {
        provinces.remove({}, function() {
            if (err) throw err;

            provinces.ensureIndex({ country_code: 1, name: 1}, {background: true}, function(err) {
                winston.log('debug', 'completed initiating ensureIndex of provinces container, err=' + err);
            });

            var lines = data.split('\n');

            insertFromLines(path, lines, 0, callback);

            winston.log('info', 'processing ' + lines.length + ' records.');
        });
    });
};

function insertFromLines(path, lines, index, callback) {
    if(index == lines.length) {
        callback();
    } else {
        var lineItems = lines[index].split(';');

        if(lineItems.length > 19) {

            var province_record = {};
            province_record.country_code = lineItems[0];
            province_record.type = lineItems[6];
            province_record.language_spec = lineItems[14];
            province_record.language = lineItems[15];

            if(province_record.language_spec == 'en-us' && province_record.language == 'english') {
                province_record.name = lineItems[17];

                province_record.version = schema.currentVersion;
                provinces.insert(province_record, {safe: true}, function(err, object) {
                    if(err != null) {
                        winston.log('error', 'while reading provinces file, path="' + path + '", identity_id=' + object.identity_id + ', explanation=' + err);
                    }
                    insertFromLines(path, lines, index + 1, callback);
                });
            } else {
                insertFromLines(path, lines, index + 1, callback);
            }

        } else {
            winston.log('warn', 'while reading provinces file, line ' + (index + 1) + ' (1-indexed) did not have enough records to parse, path=' + path);
            insertFromLines(path, lines, index + 1, callback);
        }
    }
}