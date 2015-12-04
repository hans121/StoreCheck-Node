var winston = require('winston');

var db = require('./../../database/semi-dynamic-database');
var productionLine = db.db.collection('production-line');
var dbUtils = require('../../database/database-utils');

var index_keys = [
    { organization: 1, timestamp: 1 }
];

dbUtils.addStandardMethods(exports, productionLine, index_keys);
