var _ = require('underscore');
var moment = require('moment');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var RC = require('../router-common');
var formatter = require('../../modules/view-formatter');
var nodeUtils = require('../../modules/node-utils');

var SampleModule = require('../../modules/model/sample');

module.exports = function(app) {

    RC.addHandler(app, 'get', '/defects/type/view/:defectList', _handleViewDefectList, true);
};

// === REQUEST HANDLERS

function _handleViewDefectList(req, res) {
    RC.ensureHasAccess(req, res, 'sample', 'r', RC.viewErrorCallbacks, function(caller) {
        RC.logRequest(req, true, caller);

        var defectListAsString = req.params['defectList'], type = req.query['type'], from = req.query['from'];
        if(defectListAsString == null) {
            RC.viewErrorCallbacks.on500(req, res, 'no ids specified');
        } else if(type != 'conform' && type != 'non-conform' && type != 'alert') {
            RC.viewErrorCallbacks.on500(req, res, 'type must be one of ("conform", "non-conform" or "alert")');
        } else {
            RC.logRequest(req, true, caller);

            // the difficulty in this method is to figure out whether each of the sampleids is visible to the requestor within making 1-3 db calls each
            // TODO: for now, should at least be sure the organization matches, but we should really confirm the team matches, too
            var defectList = defectListAsString.split(',');

            // get a list of t03_codes, identity ids to load (this isn't a great query, but it will limit results a little bit)
            var t03_codes = {}, identity_ids = [], idParts;
            _.each(defectList, function(id) {
                idParts = id.split('_');
                if(typeof(t03_codes[idParts[0]]) == 'undefined') {
                    t03_codes[idParts[0]] = [idParts[1]];
                } else {
                    t03_codes[idParts[0]].push(idParts[1]);
                }
                identity_ids.push(idParts[1]);
            });
            identity_ids = _.uniq(identity_ids);

            // get all samples that have defects in the identity_ids list
            // note that there could be results in which t03_code and identity_id don't both match for the same record
            var sample_query = { 'template_info.t03_code': {$in: _.keys(t03_codes)} };
            var type_field = (type == 'non-conform' ? 'non_conform' : (type == 'alert' ? 'alerts' : type));
            sample_query[type_field] = {$in: identity_ids};
            if(typeof(from) != 'undefined') { sample_query['answer_time'] = {$gte: from}; }

            SampleModule.find(sample_query,
                function(err, items) {
                    var questions_for_sample, identity_ids, defects = {}, sample_data;

                    _.each(defectList, function(defect_key) {
                        defects[defect_key] = [];
                    });

                    // for each result, we need to find the questions for the given sample
                    _.each(items, function(sample) {

                        // here's where the t03/identity_id combo gets matched (implicitly)
                        identity_ids = t03_codes[sample.template_info.t03_code];
                        questions_for_sample = _.filter(sample.questions, function(question) {
                            return _.indexOf(identity_ids, question.identity_id) != -1 && question.conformance == type;
                        });

                        if(questions_for_sample) {
                            sample_data = _.pick(sample, ["_id", "name", "best_by_date", "creation_time", "update_time", "batch_code",
                                "active", "note", "state", "factory_code", "production_line_code", "template_id", "template_info", "product_id",
                                "product_info", "visit_id", "visit_info", "non_conform", "alerts", "image_count", "image_urls"]);

                            _.each(questions_for_sample, function(question) {
                                SampleModule.deleteLevelCodes(question);
                                SampleModule.deleteExtraDescriptions(question);
                                SampleModule.deleteSequenceCodes(question);

                                question.sample = sample_data;
                                defects[sample.template_info.t03_code + '_' + question.identity_id].push(question);
                            });
                        }
                    });

                    RC.render(req, res, 'defects-by-type', {
                        defects: defects,
                        moment: moment,
                        caller: caller,
                        read_only: !RC.userHasAccess(caller, 'sample', 'r'),
                        path: req.path
                    });
                }
            );
        }
    });
}