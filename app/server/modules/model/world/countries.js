var db = require('./../../database/static-database');
var countries = db.db.collection('countries');
var dbUtils = require('../../database/database-utils');
var winston = require('winston');
var fs = require('fs');

var schema = require('./../schema/schema');

dbUtils.addStandardMethods(exports, countries);

exports.readFile = function(path, callback) {
    fs.readFile(path, 'UTF8', function(err, data) {
        countries.remove({}, function() {
            if (err) throw err;

            countries.ensureIndex({ code: 1, name: 1}, {background: true}, function(err) {
                winston.log('debug', 'completed initiating ensureIndex of countries container, err=' + err);
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
            var country_record = {};
            country_record.code = lineItems[0];

            country_record.type = lineItems[5];

            if(country_record.type == 'PCL') {

                // 15 -lang
                country_record.language = lineItems[15];
                country_record.name = lineItems[17];
                country_record.short_form = lineItems[18]; // conventional | local
                country_record.long_form = lineItems[20]; // conventional | local

                country_record.version = schema.currentVersion;
                countries.insert(country_record, {safe: true}, function(err, object) {
                    if(err != null) {
                        winston.log('error', 'while reading country file, path="' + path + '", identity_id=' + object.identity_id + ', explanation=' + err);
                    }
                    insertFromLines(path, lines, index + 1, callback);
                });
            } else {
                insertFromLines(path, lines, index + 1, callback);
            }

        } else {
            winston.log('warn', 'while reading country file, line ' + (index + 1) + ' (1-indexed) did not have enough records to parse, path=' + path);
            insertFromLines(path, lines, index + 1, callback);
        }
    }
}