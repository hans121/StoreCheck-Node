var _ = require('underscore');
var async = require('async');

var PointOfSaleModule = require('../modules/model/hierarchy/point-of-sale');
var StaticLoadModule = require('../modules/static-loads');

module.exports = {

    getPosDuplicates: _getPosDuplicates

};

function _getPosDuplicates(options_in, callback2) {

    var default_options = {
        imports_only: false
    };

    var options = _.extend(default_options, options_in);

    var pos_results = [], timestamp = null;

    async.series({

        static_load: function(callback) {
            if(!options.imports_only) {
                callback();
                return;
            }

            StaticLoadModule.findLatest('point-of-sale', function(err_load, load_info) {
                if (err_load) {
                    callback(err_load);
                    return;
                }

                if(!load_info) {
                    callback('static load not found');
                    return;
                }

                timestamp = load_info.timestamp;
                callback();
            });
        },

        aggregation: function(callback) {

            var aggregation_pipeline = [];

            // query only items that have a timestamp, if desired
            if(timestamp) {
                aggregation_pipeline.push({
                    $match : {
                        timestamp: timestamp
                    }
                });
            }

            // establish criteria for duplicates
            aggregation_pipeline.push({
                $group : {
                    _id : { customer: '$customer', company_name: "$company_name", address1: "$address1", country: "$country", city: "$city" },
                    count : { $sum : 1 },
                    items: { $push: '$_id'}
                }
            });

            // return any duplicates
            aggregation_pipeline.push({
                $match : {
                    count: { $gt: 1 }
                }
            });

            // limit, if desired


            PointOfSaleModule.collection.aggregate(aggregation_pipeline,
                {
                    //$limit: 10000,// top 10,000 enough?
                    allowDiskUse: true
                },
                function(err_aggregate, aggregate_result) {
                    if (err_aggregate) {
                        winston.error('failed to get duplicate pos entries: ' + err_aggregate);
                        callback(err_aggregate);
                        return;
                    }

                    pos_results = aggregate_result;
                    callback();
                }
            );
        }

    }, function(err_async) { // , async_results
        if(err_async) {
            callback2(err_async);
            return;
        }

        callback2(null, pos_results);
    });
}