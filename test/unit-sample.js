// usage: npm install nodeunit -g
// run the app
// nodeunit integration.js

var request = require('request');
var values = require('./test-values');

var port = 8080; // TODO: use config

module.exports = {

    get: {
    
        auditorGet: function(test) {
            request({
                method: 'GET',
                url: 'http://localhost:' + port + '/sample/' + values.sample_1_id,
                headers: {
                    cookie: values.auditor_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.sample_1 = body;
                    test.ok(r.statusCode == 200, "sample get succeeded");
                    test.done();
                } else {
                    test.ok(false, "sample get failed");
                    test.done();
                }
            });
        },

        noId: function(test) {
            request({
                method: 'GET',
                url: 'http://localhost:' + port + '/sample',
                headers: {
                    cookie: values.auditor_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode == 404, "sample/get with no id");
                    test.done();
                } else {
                    test.ok(false, "sample/get with no id");
                    test.done();
                }
            });
        },

        badId: function(test) {
            request({
                method: 'GET',
                url: 'http://localhost:' + port + '/sample/BURP',
                headers: {
                    cookie: values.auditor_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode != 200, "sample/get with bad id");
                    test.done();
                } else {
                    test.ok(false, "sample/get with no id");
                    test.done();
                }
            });
        }
    },

    update: {
        unitSampleUpdate: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/sample/' + values.sample_1_id,
                headers: {
                    cookie: values.auditor_cookie
                },
                json: JSON.parse(values.sample_1)
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode == 200, "sample update succeeded");
                    test.done();
                } else {
                    test.ok(false, "sample update failed");
                    test.done();
                }
            });
        }
    },

    sample_states: {

        auditor_submitted: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/samples/' + values.sample_1_id + '/state?value=submitted',
                headers: {
                    cookie: values.auditor_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode == 200, "sample auditor submit succeeded");
                    test.done();
                } else {
                    test.ok(false, "sample auditor submit failed");
                    test.done();
                }
            });
        },

        supervisor_validated: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/samples/' + values.sample_1_id + '/state?value=submitted',
                headers: {
                    cookie: values.supervisor_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode == 200, "sample supervisor submit succeeded");
                    test.done();
                } else {
                    test.ok(false, "sample supervisor submit failed");
                    test.done();
                }
            });
        },

        cbu_released: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/samples/' + values.sample_1_id + '/state?value=released',
                headers: {
                    cookie: values.cbu_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode == 200, "sample cbu submit succeeded");
                    test.done();
                } else {
                    test.ok(false, "sample cbu submit failed");
                    test.done();
                }
            });
        },

        delete_released_should_fail: function(test) {
            request({
                method: 'DELETE',
                url: 'http://localhost:' + port + '/sample/' + values.sample_1_id,
                headers: {
                    cookie: values.auditor_cookie
                },
                json: JSON.parse(values.sample_1)
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode != 200, "released sample delete failed");
                    test.done();
                } else {
                    test.ok(false, "released sample delete failed");
                    test.done();
                }
            });
        },

        confirm_delete_failed: function(test) {
            request({
                method: 'GET',
                url: 'http://localhost:' + port + '/sample/' + values.sample_1_id,
                headers: {
                    cookie: values.auditor_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode == 200 && body != null, "sample delete confirmed");
                    test.done();
                } else {
                    test.ok(false, "sample delete confirmed");
                    test.done();
                }
            });
        },

        cbu_revert_validated: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/samples/' + values.sample_1_id + '/state?value=to-be-corrected',
                headers: {
                    cookie: values.cbu_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode == 200, "sample cbu revert succeeded");
                    test.done();
                } else {
                    test.ok(false, "sample cbu revert succeeded");
                    test.done();
                }
            });
        }
    },

    deletes: {

        auditor_delete_simple: function(test) {
            request({
                method: 'DELETE',
                url: 'http://localhost:' + port + '/sample/' + values.sample_1_id,
                headers: {
                    cookie: values.auditor_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode == 200, "sample delete succeeded");
                    test.done();
                } else {
                    test.ok(false, "sample delete failed");
                    test.done();
                }
            });
        },

        confirm_delete: function(test) {
            request({
                method: 'GET',
                url: 'http://localhost:' + port + '/sample/' + values.sample_1_id,
                headers: {
                    cookie: values.auditor_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode == 404, "sample delete confirmed");
                    test.done();
                } else {
                    test.ok(false, "sample delete confirmed");
                    test.done();
                }
            });
        }
    }
};