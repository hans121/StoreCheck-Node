var winston = require('winston');

var linereader = require('../file-line-reader');
var nodeUtils = require('../node-utils');

// organization semi-dynamic entries
var db = require('./../database/semi-dynamic-database');
var org = db.db.collection('organization');

var dbUtils = require('../database/database-utils');
dbUtils.addStandardMethods(exports, org);

// organization hierarchy
var static_db = require('./../database/static-database');
var hierarchy_O03 = static_db.db.collection('organization-hierarchy-O03');
exports.hierarchy_O03 = hierarchy_O03;

exports.readO03File = function(path, onComplete) {
    var reader = new linereader.FileLineReader(path), line, tokens;

    function readNextLineIfExists(reader) {
        if(reader.hasNextLine()) {
            line = reader.nextLine();

            tokens = line.split('\t');

            if(tokens.length > 25) {

                var record = {
                    company_id: tokens[0],
                    category_id: tokens[1],
                    code: tokens[2],
                    hierarchy_level: tokens[3].trim().length == 0 ? '0' : tokens[3],
                    display_sequence: tokens[4],
                    active: tokens[5],
                    full_case_required: tokens[6],
                    subcategory_code: tokens[7],
                    group_code: tokens[8],
                    subgroup_code: tokens[9],
                    section_code: tokens[10],
                    subsection_code: tokens[11],
                    category_specific: tokens[12],
                    description1: tokens[13],
                    description2: tokens[14],
                    description3: tokens[15],
                    active_start_date: tokens[16],
                    active_end_date: tokens[17],
                    date_added: tokens[18],
                    added_by_user_code: tokens[19],
                    date_changed: tokens[20],
                    changed_by_user_code: tokens[21],
                    alert_infocenter_code: tokens[22],
                    infocenter_code: tokens[23],
                    text_search: tokens[24],
                    identity_id: tokens[25]
                };

                hierarchy_O03.insert(record, function(err, inserted) {
                    nodeUtils.recursiveWrapper(function() {
                        readNextLineIfExists(reader);
                    });
                });
            } else {
                winston.warn('too few records were found for line ' + line);
                readNextLineIfExists(reader);
            }

        } else {
            winston.debug('finished reading csv import file');
            onComplete(null, 'ok');
        }
    }

    hierarchy_O03.remove(function(err, results) {
        if(reader.hasNextLine()) {
            line = reader.nextLine(); // skip line 0
        }

        readNextLineIfExists(reader);
    });
};