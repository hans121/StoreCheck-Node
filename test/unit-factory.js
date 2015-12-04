// usage: npm install nodeunit -g
// run the app
// nodeunit integration.js

// Makes sure that only admins can access various methods
// A few methods won't be part of the tests, because they could alter the state of the running server

var request = require('request');
var values = require('./test-values');

var port = 8080; // TODO: use config

module.exports = {

    hierarchy: {

        unitTryFactoryHierarchyInitAuditor: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/factory-hierarchy/init',
                headers: {
                    cookie: values.auditor_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode != 200, "/factory-hierarchy/init as auditor");
                    test.done();
                } else {
                    test.ok(false, "/factory-hierarchy/init as auditor");
                    test.done();
                }
            });
        },

        unitTryFactoryHierarchyInitSupervisor: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/factory-hierarchy/init',
                headers: {
                    cookie: values.supervisor_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode != 200, "/factory-hierarchy/init as supervisor user");
                    test.done();
                } else {
                    test.ok(false, "/factory-hierarchy/init as supervisor user");
                    test.done();
                }
            });
        },

        unitTryFactoryHierarchyInitCBU: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/factory-hierarchy/init',
                headers: {
                    cookie: values.cbu_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode != 200, "/factory-hierarchy/init as cbu user");
                    test.done();
                } else {
                    test.ok(false, "/factory-hierarchy/init as cbu user");
                    test.done();
                }
            });
        },

        unitTryFactoryHierarchyInitNoUser: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/factory-hierarchy/init'
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode != 200, "/factory-hierarchy/init no user");
                    test.done();
                } else {
                    test.ok(false, "/factory-hierarchy/init no user");
                    test.done();
                }
            });
        },


        unitTryFactoryHierarchyProcessAuditor: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/factory-hierarchy/process',
                headers: {
                    cookie: values.auditor_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode != 200, "/factory-hierarchy/process as auditor");
                    test.done();
                } else {
                    test.ok(false, "/factory-hierarchy/process as auditor");
                    test.done();
                }
            });
        },

        unitTryFactoryHierarchyProcessSupervisor: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/factory-hierarchy/process',
                headers: {
                    cookie: values.supervisor_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode != 200, "/factory-hierarchy/process as supervisor user");
                    test.done();
                } else {
                    test.ok(false, "/factory-hierarchy/process as supervisor user");
                    test.done();
                }
            });
        },

        unitTryFactoryHierarchyProcessCBU: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/factory-hierarchy/process',
                headers: {
                    cookie: values.cbu_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode != 200, "/factory-hierarchy/process as cbu user");
                    test.done();
                } else {
                    test.ok(false, "/factory-hierarchy/process as cbu user");
                    test.done();
                }
            });
        }
    },

    get: {
        unitTryFactoryHierarchyProcessNoUser: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/factory-hierarchy/process'
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode != 200, "/factory-hierarchy/process no user");
                    test.done();
                } else {
                    test.ok(false, "/factory-hierarchy/process no user");
                    test.done();
                }
            });
        },

        unitGetFactoriesAuditorUser: function(test) {
            request({
                method: 'GET',
                url: 'http://localhost:' + port + '/factories',
                headers: {
                    cookie: values.auditor_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode == 200, "/factories auditor user");
                    test.done();
                } else {
                    test.ok(false, "/factories auditor user");
                    test.done();
                }
            });
        },

        unitGetFactoriesSupervisorUser: function(test) {
            request({
                method: 'GET',
                url: 'http://localhost:' + port + '/factories',
                headers: {
                    cookie: values.supervisor_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode == 200, "/factories supervisor user");
                    test.done();
                } else {
                    test.ok(false, "/factories supervisor user");
                    test.done();
                }
            });
        },

        unitGetFactoriesCBUUser: function(test) {
            request({
                method: 'GET',
                url: 'http://localhost:' + port + '/factories',
                headers: {
                    cookie: values.cbu_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode == 200, "/factories cbu user");
                    test.done();
                } else {
                    test.ok(false, "/factories cbu user");
                    test.done();
                }
            });
        },

        unitGetFactoriesNoUser: function(test) {
            request({
                method: 'GET',
                url: 'http://localhost:' + port + '/factories'
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode != 200, "/factories no user");
                    test.done();
                } else {
                    test.ok(false, "/factories no user");
                    test.done();
                }
            });
        },

        unitGetFactoriesAsAdmin: function(test) {
            request({
                method: 'GET',
                url: 'http://localhost:' + port + '/factories',
                headers: {
                    cookie: values.admin_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    var factories = JSON.parse(body);
                    values.factory_id = factories[0]._id;
                    test.ok(r.statusCode == 200, "/factories as admin");
                    test.done();
                } else {
                    test.ok(false, "/factories as admin");
                    test.done();
                }
            });
        },

        unitGetFactoryAuditorUser: function(test) {
            request({
                method: 'GET',
                url: 'http://localhost:' + port + '/factory/' + values.factory_id,
                headers: {
                    cookie: values.auditor_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode == 200, "/factory auditor user");
                    test.done();
                } else {
                    test.ok(false, "/factories auditor user");
                    test.done();
                }
            });
        },

        unitGetFactorySupervisorUser: function(test) {
            request({
                method: 'GET',
                url: 'http://localhost:' + port + '/factory/' + values.factory_id,
                headers: {
                    cookie: values.supervisor_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode == 200, "/factory supervisor user");
                    test.done();
                } else {
                    test.ok(false, "/factory supervisor user");
                    test.done();
                }
            });
        },

        unitGetFactoryCBUUser: function(test) {
            request({
                method: 'GET',
                url: 'http://localhost:' + port + '/factory/' + values.factory_id,
                headers: {
                    cookie: values.cbu_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode == 200, "/factory cbu user");
                    test.done();
                } else {
                    test.ok(false, "/factory cbu user");
                    test.done();
                }
            });
        },

        unitGetFactoryNoUser: function(test) {
            request({
                method: 'GET',
                url: 'http://localhost:' + port + '/factory/' + values.factory_id,
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode != 200, "/factory no user");
                    test.done();
                } else {
                    test.ok(false, "/factory no user");
                    test.done();
                }
            });
        },

        unitGetFactoryAsAdmin: function(test) {
            request({
                method: 'GET',
                url: 'http://localhost:' + port + '/factory/' + values.factory_id,
                headers: {
                    cookie: values.admin_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    test.ok(r.statusCode == 200, "/factory as admin");
                    test.done();
                } else {
                    test.ok(false, "/factory as admin");
                    test.done();
                }
            });
        }
    }
};