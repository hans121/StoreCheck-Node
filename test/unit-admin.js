// usage: npm install nodeunit -g
// run the app
// nodeunit integration.js

// Makes sure that only admins can access various methods
// A few methods won't be part of the tests, because they could alter the state of the running server

var request = require('request');
var values = require('./test-values');

var port = 8080; // TODO: use config

module.exports = {

    pos_hierarchy: {

    }
};