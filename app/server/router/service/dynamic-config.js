var _ = require('underscore');
var config = require('config');
var fs = require('fs');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var Common = require('../router-common');

var ActionAuditModule = require('../../modules/action-audit');
var AWSModule = require('../../modules/aws');
var DynamicConfig = require('../../modules/dynamic-config');
var EmailModule = require('../../modules/email-dispatcher');
var JobModule = require('../../modules/jobs/jobs');
var schema = require('../../modules/model/schema/schema');

module.exports = function(app) {

    Common.addHandler(app, 'post', '/dynamic-config/init', _handleInitDynamicConfig);

    Common.addHandler(app, 'post', '/dynamic-config/email', _handleUpdateDynamicConfigEmail);

    Common.addHandler(app, 'post', '/dynamic-config/auto-backup-databases', _handleUpdateDynamicConfigAutoBackupDatabases);

    Common.addHandler(app, 'post', '/dynamic-config/auto-compact-databases', _handleUpdateDynamicConfigCompactDatabase);

    Common.addHandler(app, 'post', '/dynamic-config/auto-import-hierarchies', _handleUpdateDynamicConfigAutoImportHierarchies);

    Common.addHandler(app, 'post', '/dynamic-config/email/test', _handleTestDynamicConfigEmail);

    Common.addHandler(app, 'post', '/dynamic-config/excipio-export', _handleExcipioExport);

    Common.addHandler(app, 'post', '/dynamic-config/aws', _handleUpdateDynamicConfigAWS);

};

// === REQUEST HANDLERS

function _handleInitDynamicConfig(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles[0] == 'admin') {
            DynamicConfig.init(function(err, result) {
                if(err == null) {
                    ActionAuditModule.report(caller, 'create', 'dynamic-config', 'init');
                    res.send({result: 'ok'}, 200);
                } else {
                    res.send(err, 500);
                }
            });
            return;
        }

        Common.render404(req, res);
    });
}

function _handleUpdateDynamicConfigEmail(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') != -1) {
            var validation = schema.validate(req.body, schema.dynamicConfigEmailUpdateSchema);
            if(validation.errors.length == 0) {
                req.body.tls = !!(req.body.tls == 'true');
                req.body.ssl = !!(req.body.ssl == 'true');
                req.body.port = parseInt(req.body.port);
                DynamicConfig.update({
                        query: { key: "email" },
                        value: { $set: { values: req.body } }
                    },
                    function(err, docs) {
                        ActionAuditModule.report(caller, 'update', 'dynamic-config', 'email');
                        res.send({result: 'ok'}, 200);
                    });
            } else {
                winston.log('warn', 'a POST /dynamic-config/email request from user=' + caller.name + ' had validation errors: ' + validation.errors);
                Common.pushMessage(req, 'error', 'Failed to update email config because the request had format errors');
                res.send(validation.errors, 500);
            }

            return;
        }

        Common.render404(req, res);
    });
}

function _handleTestDynamicConfigEmail(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles[0] == 'admin') {
            EmailModule.semaphore.take(function() {
                EmailModule.reconnect(function(err_reconect) {
                    if(err_reconect == null) {
                        EmailModule.send(config.errors.emailTo, 'Test email from Store Check', 'Test email from Store Check');
                    } else {
                        Common.serviceErrorCallbacks.on500(req, res, 'Could not connect to email server');
                    }
                    EmailModule.leave();
                });
            });
            return;
        }

        Common.render404(req, res);
    });
}

function _handleExcipioExport(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles[0] == 'admin') {

            if(!req.body.pos) {
                res.send('pos settings not provided', 500);
                return;
            }

            // go through POS in the body and convert all values to number, if able
            var found_nonnumber = false;
            _.each(_.keys(req.body.pos), function(key) {
                try {
                    req.body.pos[key] = parseInt(req.body.pos[key]);
                } catch(ex) {
                    found_nonnumber = true;
                }
            });

            if(found_nonnumber) {
                res.send('a pos config option was not an integer', 500);
                return;
            }

            DynamicConfig.collection.update(
                {
                    key: "excipio-export"
                },
                {
                    key: "excipio-export",
                    values: req.body
                },
                { upsert: true },
                function(err_update, docs) {
                    if(err_update) {
                        res.send(err_update, 500);
                        return;
                    }
                    ActionAuditModule.report(caller, 'update', 'dynamic-config', 'excipio-export');
                    res.send({result: 'ok'}, 200);
                }
            );

        } else {
            Common.render404(req, res);
        }
    });
}

function _handleUpdateDynamicConfigAWS(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles[0] == 'admin') {
            var validation = schema.validate(req.body, schema.dynamicConfigAWSUpdateSchema);
            if(validation.errors.length == 0) {
                req.body.active = true;
                DynamicConfig.update({
                        query: { key: "aws" },
                        value: { $set: { values: req.body } }
                    },
                    function(err_update, docs) {
                        if(!err_update) {
                            res.send({result: 'ok'}, 200);
                            return;
                        }
                        ActionAuditModule.report(caller, 'update', 'dynamic-config', 'aws');
                        AWSModule.init(function(err_init, init_result) {
                            if(err_init) {
                                res.send(err_init, 500);
                                return;
                            }
                            res.send({result: 'ok'}, 200);
                        });
                    });
            } else {
                winston.log('warn', 'a POST /dynamic-config/aws request from user=' + caller.name + ' had validation errors: ' + validation.errors);
                Common.pushMessage(req, 'error', 'Failed to update AWS config because the request had format errors');
                res.send(validation.errors, 500);
            }
        } else {
            Common.render404(req, res);
        }
    });
}

function _handleUpdateDynamicConfigCompactDatabase(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles[0] == 'admin') {
            //var validation = schema.validate(req.body, schema.dynamicConfigAWSUpdateSchema);
            //if(validation.errors.length == 0) {
            if(!_.isUndefined(req.body.active)) {

                if(_.isUndefined(req.body.hour) || _.isUndefined(req.body.minute)) {
                    winston.log('warn', 'a POST /dynamic-config/compact-database request from user=' + caller.name + ' had did not have time values');
                    Common.pushMessage(req, 'error', 'Failed to update AWS config because the request did not specify a time');
                    res.send('time not defined', 500);
                    return;
                }

                try {
                    req.body.hour = parseInt(req.body.hour);
                    req.body.minute = parseInt(req.body.minute);
                } catch(ex) {
                    winston.log('warn', 'a POST /dynamic-config/compact-database request from user=' + caller.name + ' could not parse time values');
                    Common.pushMessage(req, 'error', 'Failed to update AWS config because the request did not have a parseable time');
                    res.send('time not defined', 500);
                    return;
                }

                var set_active = (req.body.active == 'true');
                DynamicConfig.collection.update(
                    {
                        key: "auto-compact-databases"
                    },
                    {
                        $set: {
                            active: set_active,
                            hour: req.body.hour,
                            minute: req.body.minute
                        }
                    },
                    {
                        upsert: true
                    },
                    function(docs_updated) {
                        if(docs_updated == 0) {
                            res.send('not updated', 500);
                            return;
                        }
                        ActionAuditModule.report(caller, 'update', 'dynamic-config', 'auto-compact-databases');

                        // Doesn't jive well with clustering.  It would only update the current
                        // instance's job (which may not even be active).
                        JobModule.stopCompactDatabasesJob();
                        if(set_active) {
                            JobModule.startCompactDatabasesJob(req.body.hour, req.body.minute);
                        }

                        res.send({result: 'ok'}, 200);
                    }
                );
            } else {
                winston.log('warn', 'a POST /dynamic-config/compact-database request from user=' + caller.name + ' had validation errors: ' + 'active not defined');
                Common.pushMessage(req, 'error', 'Failed to update auto-compact database config because the request had format errors');
                res.send('active not defined', 500);
            }
        } else {
            Common.render404(req, res);
        }
    });
}

// req.active
// req.hour (24-hour hour component)
// req.minute
function _handleUpdateDynamicConfigAutoImportHierarchies(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles[0] == 'admin') {
            //var validation = schema.validate(req.body, schema.dynamicConfigAWSUpdateSchema);
            //if(validation.errors.length == 0) {
            if(!_.isUndefined(req.body.active)) {

                if(_.isUndefined(req.body.hour) || _.isUndefined(req.body.minute)) {
                    winston.log('warn', 'a POST /dynamic-config/aws request from user=' + caller.name + ' had did not have time values');
                    Common.pushMessage(req, 'error', 'Failed to update AWS config because the request did not specify a time');
                    res.send('time not defined', 500);
                    return;
                }

                try {
                    req.body.hour = parseInt(req.body.hour);
                    req.body.minute = parseInt(req.body.minute);
                } catch(ex) {
                    winston.log('warn', 'a POST /dynamic-config/aws request from user=' + caller.name + ' could not parse time values');
                    Common.pushMessage(req, 'error', 'Failed to update AWS config because the request did not have a parseable time');
                    res.send('time not defined', 500);
                    return;
                }

                var set_active = (req.body.active == 'true');
                DynamicConfig.update({
                        query: {
                            key: "auto-import-hierarchies"
                        },
                        value: {
                            $set: {
                                active: set_active,
                                hour: req.body.hour,
                                minute: req.body.minute
                            }
                        }
                    },
                    function(docs_updated) {
                        if(docs_updated == 0) {
                            res.send('not updated', 500);
                            return;
                        }
                        ActionAuditModule.report(caller, 'update', 'dynamic-config', 'auto-import-hierarchies');

                        // Doesn't jive well with clustering.  It would only update the current
                        // instance's job (which may not even be active).
                        JobModule.stopExcipioImportJob();
                        if(set_active) {
                            JobModule.startExcipioImportJob(req.body.hour, req.body.minute);
                        }

                        res.send({result: 'ok'}, 200);
                    });
            } else {
                winston.log('warn', 'a POST /dynamic-config/aws request from user=' + caller.name + ' had validation errors: ' + 'active not defined');
                Common.pushMessage(req, 'error', 'Failed to update AWS config because the request had format errors');
                res.send('active not defined', 500);
            }
        } else {
            Common.render404(req, res);
        }
    });
}


// req.active
// req.hour (24-hour hour component)
// req.minute
function _handleUpdateDynamicConfigAutoBackupDatabases(req, res) {
    Common.ensureUserInSession(req, res, Common.onUserNotInSessionForServiceMethod, function(caller) {
        Common.logRequest(req, true, caller);

        if(caller.roles[0] == 'admin') {
            //var validation = schema.validate(req.body, schema.dynamicConfigAWSUpdateSchema);
            //if(validation.errors.length == 0) {
            if(!_.isUndefined(req.body.active)) {

                if(_.isUndefined(req.body.hour) || _.isUndefined(req.body.minute)) {
                    winston.log('warn', 'a POST /dynamic-config/auto-backup-databases request from user=' + caller.name + ' had did not have time values');
                    Common.pushMessage(req, 'error', 'Failed to update auto-backup databases config because the request did not specify a time');
                    res.send('time not defined', 500);
                    return;
                }

                try {
                    req.body.hour = parseInt(req.body.hour);
                    req.body.minute = parseInt(req.body.minute);
                } catch(ex) {
                    winston.log('warn', 'a POST /dynamic-config/auto-backup-databases request from user=' + caller.name + ' could not parse time values');
                    Common.pushMessage(req, 'error', 'Failed to update auto-backup databases config because the request did not have a parseable time');
                    res.send('time not defined', 500);
                    return;
                }

                var set_active = (req.body.active == 'true');
                DynamicConfig.collection.update(
                    {
                        key: "auto-backup-databases"
                    },
                    {
                        $set: {
                            active: set_active,
                            hour: req.body.hour,
                            minute: req.body.minute
                        }
                    },
                    {
                        upsert: true
                    },
                    function(docs_updated) {
                        if(docs_updated == 0) {
                            res.send('not updated', 500);
                            return;
                        }
                        ActionAuditModule.report(caller, 'update', 'dynamic-config', 'auto-backup-databases');

                        // Doesn't jive well with clustering.  It would only update the current
                        // instance's job (which may not even be active).
                        JobModule.stopDatabaseBackupJob();
                        if(set_active) {
                            JobModule.startDatabaseBackupJob(req.body.hour, req.body.minute);
                        }

                        res.send({result: 'ok'}, 200);
                    }
                );

            } else {
                winston.log('warn', 'a POST /dynamic-config/auto-backup-databases request from user=' + caller.name + ' had validation errors: ' + 'active not defined');
                Common.pushMessage(req, 'error', 'Failed to update auto-backup-databases config because the request had format errors');
                res.send('active not defined', 500);
            }
        } else {
            Common.render404(req, res);
        }
    });
}
