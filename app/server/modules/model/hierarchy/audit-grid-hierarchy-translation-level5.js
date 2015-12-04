var _ = require('underscore');
var async = require('async');
var winston = require('winston');

var db = require('./../../database/semi-dynamic-database');
var dbUtils = require('../../database/database-utils');
var nodeUtils = require('../../node-utils');

var hierarchy = require('./template-static-hierarchy');
var hierarchy5 = require('./audit-grid-hierarchy-level5');
var hierarchyLang5 = db.db.collection('audit-grid-hierarchy-translation-level5');
var static_loads = require('../../static-loads');

var index_keys = [
    { t03_code: 1, code: 1, timestamp: 1, language: 1 }
];

module.exports = {
    reload: _reload,            // read and process right now
    reloadAsJob: _reloadAsJob,  // read and process in background (don't wait for result)

    process: _process,

    list: _list,
    findEntries: _findEntries,
    listLanguages: _listLanguages
};

dbUtils.addStandardMethods(module.exports, hierarchyLang5, index_keys);

// ===

function _reload(files, callback2) {
    var file_index = 0, file;

    //hierarchy.hierarchy_excipio_translation.remove(function() { // err_remove, remove_result
        processFile();
    //});

    function processFile() {
        if(files.length > file_index) {
            file = files[file_index];
            file_index++;

            hierarchy.readExcipioLanguagefile(file.path, function() {
                processFile();
            });
        } else {
            module.exports.process(callback2);
        }
    }
}

function _reloadAsJob(files, callback2) {
    function processTranslations() {
        module.exports.reload(files, callback2);
    }
    nodeUtils.runInBackground(processTranslations);
}

function _list(callback) {
    db.list(hierarchyLang5, callback);
}

function _findEntries(company_id, t03_code, language, timestamp, L1_t02_codes, callback) {

    var keyedItem = {
        company_id: company_id,
        language: language,
        timestamp: timestamp
    };

    if(!_.isUndefined(t03_code)) {
        keyedItem.t03_code = t03_code;
    }

    if(!_.isUndefined(L1_t02_codes) && !_.isNull(L1_t02_codes) && L1_t02_codes.length > 0) {
        keyedItem.level1_t02_code = {$in: L1_t02_codes};
    }

    hierarchyLang5.find(keyedItem).toArray(
        function(e, res) {
            if(e) {
                callback(e)
            } else {
                callback(null, res)
            }
        }
    );
}

function _listLanguages(callback) {
    var additionalQueryParams = {};
    static_loads.findLatest('audit-grid-hierarchy-translation-L5', function(err, static_object) {
        if(err == null && static_object != null) {
            additionalQueryParams.timestamp = static_object.timestamp;

            hierarchyLang5.distinct('language', additionalQueryParams, function(e, res) {
                if(e) {
                    callback(e)
                } else {
                    callback(null, res)
                }
            });
        } else {
            winston.log('error', 'could not find static load reference for languages');
            callback(err, null);
        }
    });
}

function _process(callback) {
    var timestamp = new Date().getTime().toString();

    static_loads.insert({
        type: 'audit-grid-hierarchy-translation-L5',
        timestamp: timestamp
    }, function(data) {
        if(data != null) {
            hierarchy.hierarchy_excipio_translation.distinct('language', function(e, res) {
                if(e) {
                    callback(e)
                } else {
                    _processLanguages(res, timestamp, 0, function(err_process, result_process) {
                        callback(err_process, result_process);
                    });
                }
            });
        } else {
            winston.error('failed to process audit-grid-hierarchy-translation-L5');
            callback('failed to add static load record', null);
        }
    });
}

function _processLanguages(languages, timestamp, processed_count, callback2) {
    if(languages.length == 0) {
        callback2(null, processed_count);
        return;
    }
    _processLanguage(languages.shift(), timestamp, function() { // err, result
        nodeUtils.recursiveWrapper(function() {
            _processLanguages(languages, timestamp, processed_count + 1, callback2);
        });
    });
}

function _processLanguage(languageCode, timestamp, callback2) {
    winston.log('info', 'processing L5 records for ' + languageCode);

    // get all language records for this language
    hierarchy.hierarchy_excipio_translation.find({ language: languageCode }).toArray(function(err, languageRecordUpdates) {
        if(err != null) {
            callback2(err);
            return;
        }

        winston.log('info', 'processing ' + languageRecordUpdates.length + ' audit grid hierarchy language L5 translations for ' + languageCode);
        static_loads.findLatest('audit-grid-hierarchy-L5', function(err, latest_5) {

            // for each languageRecordUpdate, query the relevant property in O05 to get all T03 entries with the given property
            // insert entries into the language collection for each T03 result that matched
            _processRecordsForLanguage(languageRecordUpdates, latest_5.timestamp, timestamp, function(err, results) {
                callback2(err, results);
            });
        });
    });
}

function _processRecordsForLanguage(languageRecordUpdates, timestamp_L5, timestamp, callback2) {
    if(languageRecordUpdates.length == 0) {
        callback2(null, []);
        return;
    }

    var languageRecord = languageRecordUpdates.shift();
    var t02_query = { timestamp: timestamp_L5 };

    if(languageRecord.description1.length == 0 && languageRecord.description2.length == 0 && languageRecord.description3.length == 0) {
        nodeUtils.recursiveWrapper(function() {
            _processRecordsForLanguage(languageRecordUpdates, timestamp_L5, timestamp, function (err, results) {
                callback2(err, results);
            });
        });
        return;
    }

    if(languageRecord.hierarchy_level == '0') {
        t02_query['children.code'] = languageRecord.code;
    } else {
        // we need to query T02 using the correct levelX_t02_code
        t02_query[hierarchy.getT02PropertyForHierarchyLevel(languageRecord.hierarchy_level)] = languageRecord.code;
    }

    hierarchy5.collection.find(t02_query).toArray(function(err_t03, affected_t03_items) {

        if(_.isUndefined(affected_t03_items) || affected_t03_items.length == 0) {
            nodeUtils.recursiveWrapper(function() {
                _processRecordsForLanguage(languageRecordUpdates, timestamp_L5, timestamp, function (err, results) {
                    callback2(err, results);
                });
            });
            return;
        }

        // TODO: check err
        _applyLanguageUpdatesForItem(languageRecord, timestamp, affected_t03_items, function(err_update, update_res) {
            nodeUtils.recursiveWrapper(function() {
                _processRecordsForLanguage(languageRecordUpdates, timestamp_L5, timestamp, function (err, results) {
                    callback2(err, results);
                });
            });
        });
    });
}

function _applyLanguageUpdatesForItem(languageRecord, timestamp, affected_t03_items, callback2) {
    // languageRecord can be applied to affects_t03_items
    // then, we need to issue inserts for the new documents

    winston.debug('updating ' + affected_t03_items.length + ' L5 records with language data for ' + languageRecord.language);

    _.each(affected_t03_items, function(t03_item) {
        delete t03_item._id;
        t03_item.timestamp = timestamp;
        t03_item.language = languageRecord.language;

        _applyLanguageRecord(languageRecord, t03_item);
    });

    winston.debug('generating merge functions for L5 records with language data for ' + languageRecord.language);

    // "merge" results - i.e. don't just insert blindly
    var merge_functions = [];
    _.each(affected_t03_items, function(t03_item) {
        merge_functions.push(function(callback) {
            hierarchyLang5.find({
                t03_code: t03_item.t03_code,
                code: t03_item.code,
                timestamp: timestamp,
                language: languageRecord.language
            }).toArray(function(err_langL5, duplicates_langL5) {
                if(err_langL5 != null) {
                    callback();
                    return;
                }
                if(duplicates_langL5.length > 0) {
                    _applyLanguageRecord(languageRecord, duplicates_langL5[0]);

                    hierarchyLang5.update({_id: duplicates_langL5[0]._id}, _.omit(duplicates_langL5[0], '_id'), function(err_update) { // doc_update_res
                        if(err_update != null) {
                            winston.log('error', 'while processing audit grid hierarchy language L5, an error occurred when updating a record: ' + err_update);
                        }
                        callback();
                    });
                    return;
                }
                hierarchyLang5.insert(t03_item, function(err_insert, doc_insert) {
                    callback(err_insert, doc_insert);
                });
            });
        });
    });

    async.series(merge_functions, function(err, results) {
        winston.debug('completed merge functions for L5 record with language data for ' + languageRecord.language);
        callback2(err, results)
    });
}

function _applyLanguageRecord(languageRecord, t03_item) {
    if(languageRecord.hierarchy_level == '5') {
        t03_item['description'] = languageRecord.description1;
        t03_item['description2'] = languageRecord.description2;
        t03_item['description3'] = languageRecord.description3;
    } else if(languageRecord.hierarchy_level == '0') {
        var child = _.where(t03_item.children, {code: languageRecord.code});
        if(!_.isUndefined(child) && child.length > 0) {
            //t03_item['description'] = languageRecord.description1;
            // TODO: set this
            child[0].text = languageRecord.description2;
            //t03_item['text'] = languageRecord.description2;
            //t03_item['description3'] = languageRecord.description3;
        }
    } else {
        t03_item['level' + languageRecord.hierarchy_level + '_description'] = languageRecord.description1;
        t03_item['level' + languageRecord.hierarchy_level + '_description2'] = languageRecord.description2;
        t03_item['level' + languageRecord.hierarchy_level + '_description3'] = languageRecord.description3;
    }
}