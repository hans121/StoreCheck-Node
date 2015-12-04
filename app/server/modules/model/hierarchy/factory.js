var db = require('./../../database/semi-dynamic-database');
var factory = db.db.collection('factory');
var dbUtils = require('../../database/database-utils');

var index_keys = [
    { organization: 1, timestamp: 1 }
];

dbUtils.addStandardMethods(exports, factory, index_keys);