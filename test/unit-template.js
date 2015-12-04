// usage: npm install nodeunit -g
// run the app
// nodeunit integration.js

var request = require('request');
var values = require('./test-values');

var port = 8080; // TODO: use config

module.exports = {

    unitTemplateGet: function(test) {
        request({
            method: 'GET',
            url: 'http://localhost:' + port + '/template/' + values.template_id,
            headers: {
                cookie: values.auditor_cookie
            }
        }, function (e, r, body) {
            if(e == null) {
                test.ok(r.statusCode == 200, "template get succeeded");
                test.done();
            } else {
                test.ok(false, "template get failed");
                test.done();
            }
        });
    },

    unitTemplateNoId: function(test) {
        request({
            method: 'GET',
            url: 'http://localhost:' + port + '/template',
            headers: {
                cookie: values.auditor_cookie
            }
        }, function (e, r, body) {
            if(e == null) {
                test.ok(r.statusCode == 404, "template/get with no id");
                test.done();
            } else {
                test.ok(false, "template/get with no id");
                test.done();
            }
        });
    },

    unitTemplateBadId: function(test) {
        request({
            method: 'GET',
            url: 'http://localhost:' + port + '/template/BURP',
            headers: {
                cookie: values.auditor_cookie
            }
        }, function (e, r, body) {
            if(e == null) {
                test.ok(r.statusCode != 200, "template/get with bad id");
                test.done();
            } else {
                test.ok(false, "template/get with no id");
                test.done();
            }
        });
    }
};