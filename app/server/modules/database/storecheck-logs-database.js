var config      = require('config');
var winston     = require('winston');

var database    = require('./database');
var db = database.init(config['logging']['database'], _onConnected);

function _onConnected() {
    //exports.logs.ensureIndex({timestamp: 1}, {background: true, unique: false}, function(err) {});
    exports.db.is_connected = true;
}

exports.db = db;
exports.logs = db.collection('logs');