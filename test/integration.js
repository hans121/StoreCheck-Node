// usage: npm install nodeunit -g
// run the app
// nodeunit integration.js

var request = require('request');
var _ = require('underscore');

var unit_admin = require('./unit-admin');
var unit_factory = require('./unit-factory');
var unit_sample = require('./unit-sample');
var unit_template = require('./unit-template');
var values = require('./test-values');
//var config = require('config');

var port = 8080; // TODO: use config

process.setMaxListeners(0);

module.exports = {

    setUp: function (callback) {
        callback();
    },

    tearDown: function (callback) {
        callback();
    },

    integration: {
        testAdminLogin: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/',
                json: {
                    user: 'admin',
                    pass: 'foopassword123',
                    "remember-me": true
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.admin_cookie = r.headers["set-cookie"];
                    test.ok(r.statusCode == 200, "login succeeded");
                    test.done();
                } else {
                    test.ok(false, "login failed");
                    test.done();
                }
            });
        },

        testCreateOrganization: function(test) {
            request({
                method: 'PUT',
                url: 'http://localhost:' + port + '/organization',
                headers: {
                    cookie: values.admin_cookie
                },
                json: {
                    name: 'TestOrganization_' + (new Date()).getTime(),
                    code: 'TORG'
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.organization_id = body;
                    test.ok(r.statusCode == 200, "organization creation succeeded");
                    test.done();
                } else {
                    test.ok(false, "organization creation failed");
                    test.done();
                }
            });
        },

        testCreateCBUUser: function(test) {
            values.cbu_user = 'test_cbu_user_' + (new Date()).getTime();
            request({
                method: 'PUT',
                url: 'http://localhost:' + port + '/user',
                headers: {
                    cookie: values.admin_cookie
                },
                json: {
                    user 		: values.cbu_user,
                    name 		: 'test_cbu_user_' + (new Date()).getTime(),
                    email 		: 'test_cbu_user_' + (new Date()).getTime() + '@example.com',
                    pass		: 'foopassword',
                    role        : 'CBU',
                    organization: values.organization_id
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.cbu_user_id = body;
                    test.ok(r.statusCode == 200, "cbu user creation succeeded");
                    test.done();
                } else {
                    test.ok(false, "cbu user creation failed");
                    test.done();
                }
            });
        },

        testCBULogin: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/',
                json: {
                    user: values.cbu_user,
                    pass: 'foopassword',
                    "remember-me": true
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.cbu_cookie = r.headers["set-cookie"];
                    test.ok(r.statusCode == 200, "CBU login succeeded");
                    test.done();
                } else {
                    test.ok(false, "CBU login failed");
                    test.done();
                }
            });
        },

        testCreateAuditTeam: function(test) {
            request({
                method: 'PUT',
                url: 'http://localhost:' + port + '/audit-team',
                headers: {
                    cookie: values.cbu_cookie
                },
                json: {
                    name: 'test_team_' + (new Date()).getTime()
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.audit_team_id = body;
                    test.ok(r.statusCode == 200, "audit team create succeeded");
                    test.done();
                } else {
                    test.ok(false, "audit team create failed");
                    test.done();
                }
            });
        },

        testAddAuditorToAuditTeam: function(test) {
            values.auditor_user = 'test_auditor_user_' + (new Date()).getTime();
            request({
                method: 'PUT',
                url: 'http://localhost:' + port + '/user',
                headers: {
                    cookie: values.cbu_cookie
                },
                json: {
                    user 		: values.auditor_user,
                    name 		: 'test_auditor_user_' + (new Date()).getTime(),
                    email 		: 'test_auditor_user_' + (new Date()).getTime() + '@example.com',
                    pass		: 'foopassword',
                    role        : 'auditor',
                    team        : values.audit_team_id
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.auditor_user_id = body;
                    test.ok(r.statusCode == 200, "audit team create succeeded");
                    test.done();
                } else {
                    test.ok(false, "audit team create failed");
                    test.done();
                }
            });
        },

        testAuditorLogin: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/',
                json: {
                    user: values.auditor_user,
                    pass: 'foopassword',
                    "remember-me": true
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.auditor_cookie = r.headers["set-cookie"];
                    test.ok(r.statusCode == 200, "Auditor login succeeded");
                    test.done();
                } else {
                    test.ok(false, "Auditor login failed");
                    test.done();
                }
            });
        },

        testAddSupervisorToAuditTeam: function(test) {
            values.supervisor_user = 'test_supervisor_user_' + (new Date()).getTime();
            request({
                method: 'PUT',
                url: 'http://localhost:' + port + '/user',
                headers: {
                    cookie: values.cbu_cookie
                },
                json: {
                    user 		: values.supervisor_user,
                    name 		: 'test_supervisor_user_' + (new Date()).getTime(),
                    email 		: 'test_auditor_user_' + (new Date()).getTime() + '@example.com',
                    pass		: 'foopassword',
                    role        : 'supervisor',
                    team        : values.audit_team_id
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.supervisor_user_id = body;
                    test.ok(r.statusCode == 200, "supervisor create succeeded");
                    test.done();
                } else {
                    test.ok(false, "supervisor create failed");
                    test.done();
                }
            });
        },

        testSupervisorLogin: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/',
                json: {
                    user: values.supervisor_user,
                    pass: 'foopassword',
                    "remember-me": true
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.supervisor_cookie = r.headers["set-cookie"];
                    test.ok(r.statusCode == 200, "Supervisor login succeeded");
                    test.done();
                } else {
                    test.ok(false, "Supervisor login failed");
                    test.done();
                }
            });
        },

        testAddStoreCheck: function(test) {
            request({
                method: 'PUT',
                url: 'http://localhost:' + port + '/store-check',
                headers: {
                    cookie: values.cbu_cookie
                },
                json: {
                    "name": 'test_store_check_' + (new Date()).getTime(),
                    "reportDate": "30-Dec-2013",
                    "notes": "test notes",
                    "type":  "internal"
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.storecheck_id = body;
                    test.ok(r.statusCode == 200, "store check create succeeded");
                    test.done();
                } else {
                    test.ok(false, "store check create failed");
                    test.done();
                }
            });
        },

        testAddPOS: function(test) {
            values.pos_name = 'test_company_' + (new Date()).getTime();
            request({
                method: 'PUT',
                url: 'http://localhost:' + port + '/pos',
                headers: {
                    cookie: values.cbu_cookie
                },
                json: {
                    company_name:               values.pos_name,
                    address1:                   'test address 1',
                    address2:                   'test address 2',
                    city:                       'test city',
                    state:                      'test state',
                    postal_code:                'test postal code',
                    address_type_code:          'test address type',
                    country:                    'test country',
                    email:                      'test email',
                    account_number:             'test account number',
                    a50_code:                   'test a50',
                    a47_code:                   'test a47',
                    a48_code:                   'test a48',
                    a53_code:                   'test a53',
                    a59_code:                   'test a59'
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.pos_id = body;
                    test.ok(r.statusCode == 200, "pos create succeeded");
                    test.done();
                } else {
                    test.ok(false, "pos create failed");
                    test.done();
                }
            });
        },

        testAssignTeam: function(test) {
            request({
                method: 'PUT',
                url: 'http://localhost:' + port + '/audit-assignment',
                headers: {
                    cookie: values.cbu_cookie
                },
                json: {
                    team_id         : values.audit_team_id,
                    storecheck_id   : values.storecheck_id
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.assignment_id = body;
                    test.ok(r.statusCode == 200, "assign team succeeded");
                    test.done();
                } else {
                    test.ok(false, "assign team failed");
                    test.done();
                }
            });
        },

        testAddVisit: function(test) {
            request({
                method: 'PUT',
                url: 'http://localhost:' + port + '/visit',
                headers: {
                    cookie: values.auditor_cookie
                },
                json: {
                    name:               'test_store_check_' + (new Date()).getTime(),
                    auditor_id:         values.auditor_user_id,
                    date_of_visit:      '18-Dec-2013',
                    pos_id:             values.pos_id,
                    pos_name:           values.pos_name,
                    store_check_id:     values.storecheck_id,
                    last_update_time:   "3/10/2008 22:15:53",
                    creation_time:      "3/10/2008 22:15:53",
                    samples:            [],
                    auditor_name:       "Test Auditor Name",
                    team_id:            values.team_id // TODO: review
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.visit_id = body;
                    test.ok(r.statusCode == 200, "visit create succeeded");
                    test.done();
                } else {
                    test.ok(false, "vsit create failed");
                    test.done();
                }
            });
        },

        testAddProduct: function(test) {
            request({
                method: 'PUT',
                url: 'http://localhost:' + port + '/product',
                headers: {
                    cookie: values.cbu_cookie
                },
                json: {
                    "company_id" : "SYS",
                    "category_id" : "C01",
                    "code" : "FRD DNTE CRM DES CHO 125X4 4247",
                    "sequence" : "100",
                    "product_description" : "Danette Chocolat 125gx4",
                    "description" : "Danette Chocolat 125gx4",
                    "description2" : "",
                    "description3" : "Danette chocolat 125gx4",
                    "identity_id" : "22401",
                    "category_specific" : "",
                    "active" : "Y",
                    "full_case_required" : "N",
                    "active_start_date" : "",
                    "active_end_date" : "",
                    "date_added" : "6/28/2007 4:34:50 AM",
                    "added_by_user_code" : "jassid",
                    "date_changed" : "7/8/2013 9:01:15 AM",
                    "changed_by_user_code" : "mornisc",
                    "alert_infocenter_code" : "",
                    "infocenter_code" : "",
                    "text_search" : "",
                    "product_code" : "FRD DNTE CRM DES CHO 125X4 4247",
                    "upc" : "",
                    "item_number" : "",
                    "mfg" : "",
                    "default_factory" : "FRD FAC Bailleul",
                    "e06_code" : "",
                    "pickup" : "Without",
                    "e08_code" : "",
                    "e09_code" : "",
                    "e10_code" : "",
                    "e11_code" : "",
                    "flavor" : "DAIRY Chocolate",
                    "e13_code" : "",
                    "type" : "DAIRY DESSERT",
                    "e15_code" : "",
                    "storeCheckSampleCandidate" : "Yes",
                    "format" : "x4",
                    "e18_code" : "",
                    "e19_code" : "",
                    "e20_code" : "",
                    "e21_code" : "",
                    "ean_13" : "",
                    "global_brand" : "DAIRY DANETTE",
                    "e24_code" : "",
                    "e25_code" : ""
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.product_id = body;
                    test.ok(r.statusCode == 200, "product create succeeded");
                    test.done();
                } else {
                    test.ok(false, "product create failed");
                    test.done();
                }
            });
        },

        testGetTemplateL5: function(test) {
            request({
                method: 'GET',
                url: 'http://localhost:' + port + '/template/level/5/latest?language=en&t03_code=WP&company_id=SYS',
                headers: {
                    cookie: values.cbu_cookie
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.template_L5 = JSON.parse(body);
                    test.ok(r.statusCode == 200 && values.template_L5.length > 0, "template L5 GET succeeded");
                    test.done();
                } else {
                    test.ok(false, "template L5 GET failed");
                    test.done();
                }
            });
        },

        testAddTemplate: function(test) {
            var answers, questions = [], child_values;
            _.each(values.template_L5, function(question) {
                answers = [];
                _.each(question.children, function(answer) {
                    child_values = _.pick(answer, 'identity_id', 'weight');
                    child_values.active = 'true';
                    answers.push(child_values);
                });

                var picked_values = _.pick(question,
                    "identity_id",
                    "company_id",
                    "category_id",
                    "conformance",
                    "level1_description",
                    "level1_description2",
                    "level1_description3",
                    "level2_description",
                    "level2_description2",
                    "level2_description3",
                    "level3_description",
                    "level3_description2",
                    "level3_description3",
                    "level4_description",
                    "level4_description2",
                    "level4_description3",
                    "level5_description",
                    "level5_description2",
                    "level5_description3",
                    "level1_code",
                    "level2_code",
                    "level3_code",
                    "level4_code",
                    "level5_code",
                    "level1_sequence",
                    "level2_sequence",
                    "level3_sequence",
                    "level4_sequence",
                    "level5_sequence",
                    "category_specific",
                    "category_specific_options");

                questions.push(_.extend(picked_values, { answers: answers }));
            });

            request({
                method: 'PUT',
                url: 'http://localhost:' + port + '/template',
                headers: {
                    cookie: values.cbu_cookie
                },
                json: {
                    "name" : 'DWP_test_' + (new Date()).getTime(),
                    "records" : [
                        {
                            "language" : "en",
                            "t03_code" : values.template_L5[0].t03_code,
                            "t03_description" : values.template_L5[0].t03_description,
                            "timestamp_L5" : values.template_L5[0].timestamp,
                            "company_id" : values.template_L5[0].company_id,
                            "category_id" : values.template_L5[0].category_id,
                            "questions" : questions
                        }
                    ]
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.template_id = body;
                    test.ok(r.statusCode == 200, "template create succeeded");
                    test.done();
                } else {
                    test.ok(false, "template create failed");
                    test.done();
                }
            });
        },

        testAddSampleType: function(test) {
            request({
                method: 'PUT',
                url: 'http://localhost:' + port + '/store-check/' + values.storecheck_id + '/sample-type',
                headers: {
                    cookie: values.cbu_cookie
                },
                json: {
                    product_id: values.product_id,
                    template_id: values.template_id
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.sample_type_id = body;
                    test.ok(r.statusCode == 200, "sample type create succeeded");
                    test.done();
                } else {
                    test.ok(false, "sample type failed");
                    test.done();
                }
            });
        },

        testAddSample1: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/sample',
                headers: {
                    cookie: values.auditor_cookie
                },
                json: {
                    visit_id:               values.visit_id,
                    product_id:             values.product_id,
                    template_id:            values.template_id,
                    name:                   "TEST_SAMPLE_001",
                    batch_code:             "TEST_BATCH_001",
                    factory_id:             "",
                    production_line_id:     ""
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.sample_1_id = body;
                    test.ok(r.statusCode == 200, "sample create succeeded");
                    test.done();
                } else {
                    test.ok(false, "sample create failed");
                    test.done();
                }
            });
        },

        testAddSample2: function(test) {
            request({
                method: 'POST',
                url: 'http://localhost:' + port + '/sample',
                headers: {
                    cookie: values.auditor_cookie
                },
                json: {
                    visit_id:               values.visit_id,
                    product_id:             values.product_id,
                    template_id:            values.template_id,
                    name:                   "TEST_SAMPLE_002",
                    batch_code:             "TEST_BATCH_002"
                }
            }, function (e, r, body) {
                if(e == null) {
                    values.sample_2_id = body;
                    test.ok(r.statusCode == 200, "sample create 2 succeeded");
                    test.done();
                } else {
                    test.ok(false, "sample create 2 failed");
                    test.done();
                }
            });
        }
    },

    unit_sample: unit_sample,
    unit_template: unit_template,
    unit_admin: unit_admin,
    unit_factory: unit_factory
};
