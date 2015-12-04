var _ = require('underscore');
var fs = require('fs');
var winston = require('winston');

var dbUtils = require('../../database/database-utils');
var linereader = require('../../file-line-reader');
var nodeUtils = require('../../node-utils');

var semiDynamicDb = require('./../../database/semi-dynamic-database');
var staticDb = require('./../../database/static-database');

//===

exports.hierarchy_excipio = staticDb.db.collection('template-hierarchy-excipio');
exports.hierarchy_excipio_translation = semiDynamicDb.db.collection('template-hierarchy-excipio-translation');

//===

exports.readExcipioFile = _readExcipioFile;
exports.readExcipioLanguagefile = _readExcipioLanguageFile;

exports.getCodePropertyForHierarchyLevel = function(level) {
    switch(level) {
        case '1': return 'subcategory_code';
        case '2': return 'group_code';
        case '3': return 'subgroup_code';
        case '4': return 'section_code';
        case '5': return 'subsection_code';
    }
    return '';
};

exports.getL5CodePropertyForHierarchyLevel = function(level) {
    switch(level) {
        case '1': return 'level1_code';
        case '2': return 'level2_code';
        case '3': return 'level3_code';
        case '4': return 'level4_code';
        case '5': return 'code';
    }
    return '';
};

exports.getT02PropertyForHierarchyLevel = function(level) {
    switch(level) {
        case '1': return 'level1_t02_code';
        case '2': return 'level2_t02_code';
        case '3': return 'level3_t02_code';
        case '4': return 'level4_t02_code';
        case '5': return 't02_code';
    }
    return '';
};

//===

function _readExcipioFile(path, onComplete) {
    var reader = new linereader.FileLineReader(path, 'ucs2'), line, tokens;

    function readNextLineIfExists(reader) {
        if(reader.hasNextLine()) {
            line = reader.nextLine();
            line = line.replace(/\r/gm,"");
            tokens = line.split('\t');

            if(tokens.length > 27) {
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
                    identity_id: tokens[25],
                    t03_code: tokens[26],
                    t03_description: tokens[27]
                };

                exports.hierarchy_excipio.insert(record, function() { //err, inserted
                    nodeUtils.recursiveWrapper(function() {
                        readNextLineIfExists(reader);
                    });
                });
            } else {
                winston.warn('too few records were found for line ' + line);
                nodeUtils.recursiveWrapper(function() {
                    readNextLineIfExists(reader);
                });
            }

        } else {
            winston.debug('finished reading excipio csv import file');
            onComplete(null, 'ok');
        }
    }

    if(reader.hasNextLine()) {
        line = reader.nextLine(); // skip line 0
    }

    nodeUtils.recursiveWrapper(function() {
        readNextLineIfExists(reader);
    });
}

function _readExcipioLanguageFile(path, onComplete) {
    var reader = new linereader.FileLineReader(path, 'ucs2'), line, tokens;

    function readNextLineIfExists(reader) {
        if(reader.hasNextLine()) {
            line = reader.nextLine();
            line = line.replace(/\r/gm,"");

            tokens = line.split('\t');

            if(tokens.length > 7) {

                var hierarchy_record = {
                    company_id: tokens[0],
                    category_id: tokens[1],
                    code: tokens[2],
                    language: tokens[3],
                    hierarchy_level: tokens[4],
                    description1: tokens[5],
                    description2: tokens[6],
                    description3: tokens[7]
                };

                var options = {
                    upsert: true
                };

                exports.hierarchy_excipio_translation.update({
                        company_id: hierarchy_record.company_id,
                        category_id: hierarchy_record.category_id,
                        code: hierarchy_record.code,
                        language: hierarchy_record.language,
                        hierarchy_level: hierarchy_record.hierarchy_level
                    },
                    hierarchy_record,
                    options,
                    function(err_upsert, upsert_result) { //err, inserted
                        nodeUtils.recursiveWrapper(function() {
                            readNextLineIfExists(reader);
                        });
                    }
                );
            } else {
                winston.warn('too few records were found for line ' + line);
                nodeUtils.recursiveWrapper(function() {
                    readNextLineIfExists(reader);
                });
            }

        } else {
            winston.debug('finished reading excipio csv import file');
            onComplete(null, 'ok');
        }
    }

    if(reader.hasNextLine()) {
        line = reader.nextLine(); // skip line 0
    }

    nodeUtils.recursiveWrapper(function() {
        readNextLineIfExists(reader);
    });
}

