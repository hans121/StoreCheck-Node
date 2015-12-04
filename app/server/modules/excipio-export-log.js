var _ = require('underscore');

var db = require('./database/dynamic-database');
var formatter = require('./view-formatter');
var nodeUtils   = require('./node-utils');
var ObjectId = require('mongodb').ObjectID;

var VisitModule = require('./model/visit');

exports.excipio_exports = db.db.collection('excipio-export-log');

// mongodb has an inherent timestamp in the ObjectId
exports.report = function(case_records, filename, sftp_retries) {
    nodeUtils.runInBackground(function() {
        var visit_ids = _.map(case_records, function(case_record) { return ObjectId(case_record.b17_code); });

        VisitModule.collection.find({_id: {$in: visit_ids}}, {_id: 1, pos_name: 1, organization: 1, store_check_id: 1}).toArray(function(err_visit, visits) {
            if(err_visit) {
                winston.error('while reporting an excipio export, could not materialize visit');
                return;
            }

            var visit_infos = _.map(case_records, function(case_record) {

                var samples = [];
                case_record.issues.forEach(function(issue) {
                    samples.push({
                        name: issue.c41_code,
                        id: issue.c82_code
                    });
                });

                var visit_record = _.find(visits, function(visit) { return visit._id.toHexString() == case_record.b17_code; });

                if(!visit_record) {
                    winston.error('while reporting an excipio export, could not associate visit to case record');
                    return;
                }

                return {
                    id: case_record.b17_code,
                    storecheck_id: visit_record.store_check_id,
                    storecheck_name: case_record.b10_code,
                    pos_name: visit_record.pos_name,
                    date: case_record.b06_code,
                    organization: visit_record.organization,
                    org_code: case_record.b08_code,
                    wwbu: case_record.b13_code,
                    samples: samples
                }
            });

            exports.excipio_exports.insert({
                visits: visit_infos,
                sftp_retries: sftp_retries,
                destination: filename,
                //sample_count: samples.length,
                //organizations: visit_organizations,
                timestamp: formatter.getCurrentUtcTimeString()
            }, {safe: false}, function(){});
        });
    });
};