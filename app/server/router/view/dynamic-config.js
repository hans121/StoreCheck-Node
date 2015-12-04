var winston = require('winston');

var RC = require('../router-common');
var DynamicConfigModule = require("../../modules/dynamic-config");

module.exports = function(app) {

    RC.addHandler(app, 'get', '/dynamic-config/email/view', _handleDynamicConfigEmailView, true);

    RC.addHandler(app, 'get', '/dynamic-config/aws/view', _handleDynamicConfigAWSView, true);

    RC.addHandler(app, 'get', '/dynamic-config/timed-jobs/view', _handleDynamicConfigTimedJobsView, true);

    RC.addHandler(app, 'get', '/dynamic-config/excipio-export/view', _handleDynamicConfigExcipioView, true);
};

// === REQUEST HANDLERS

function _handleDynamicConfigEmailView(req, res) {
    RC.ensureUserInSession(req, res, RC.viewErrorCallbacks.userNotInSession, function(caller) {
        RC.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            RC.viewErrorCallbacks.on404(req, res);
            return;
        }

        DynamicConfigModule.findOne({key: 'email'}, function(err, email_config) {
            if(err == null && email_config != null) {
                RC.render(req, res, 'dynamic-config-email', {
                    caller: caller,
                    config: email_config.values,
                    path: req.path
                });
            } else {
                RC.viewErrorCallbacks.on500(req, res, err);
            }
        });
    });
}

function _handleDynamicConfigAWSView(req, res) {
    RC.ensureUserInSession(req, res, RC.viewErrorCallbacks.userNotInSession, function(caller) {
        RC.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            RC.viewErrorCallbacks.on404(req, res);
            return;
        }

        DynamicConfigModule.findOne({key: 'aws'}, function(err, aws_config) {
            if(err) {
                RC.viewErrorCallbacks.on500(req, res, err);
                return;
            }

            if(!aws_config) {
                RC.viewErrorCallbacks.on404(req, res);
                return;
            }

            RC.render(req, res, 'dynamic-config-aws', {
                caller: caller,
                config: aws_config.values,
                path: req.path
            });
        });
    });
}

function _handleDynamicConfigTimedJobsView(req, res) {
    RC.ensureUserInSession(req, res, RC.viewErrorCallbacks.userNotInSession, function(caller) {
        RC.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            RC.viewErrorCallbacks.on404(req, res);
            return;
        }

        // get any dynamic configs we'd be interested in here
        var job_keys = [
            'auto-compact-databases',
            'auto-import-hierarchies',
            'auto-backup-databases'
        ];

        DynamicConfigModule.collection.find({key: {$in: job_keys}}).toArray(function(err, import_configs) {
            if(err) {
                RC.viewErrorCallbacks.on500(req, res, err);
                return;
            }

            var auto_import_config = null, auto_compact_databases = null, auto_backup_databases = null;

            import_configs.forEach(function(config_item) {
                switch(config_item.key) {
                    case 'auto-import-hierarchies':
                        auto_import_config = config_item;
                        break;
                    case 'auto-compact-databases':
                        auto_compact_databases = config_item;
                        break;
                    case 'auto-backup-databases':
                        auto_backup_databases = config_item;
                }
            });

            RC.render(req, res, 'dynamic-config-timed-jobs', {
                caller: caller,
                auto_import_config: auto_import_config,
                auto_compact_databases_config: auto_compact_databases,
                auto_backup_databases_config: auto_backup_databases,
                path: req.path
            });
        });
    });
}

function _handleDynamicConfigExcipioView(req, res) {
    RC.ensureUserInSession(req, res, RC.viewErrorCallbacks.userNotInSession, function(caller) {
        RC.logRequest(req, true, caller);

        if(caller.roles.indexOf('admin') == -1) {
            RC.viewErrorCallbacks.on404(req, res);
            return;
        }

        DynamicConfigModule.findOne({key: 'excipio-export'}, function(err, import_config) {
            if(err) {
                RC.viewErrorCallbacks.on500(req, res, err);
                return;
            }

            if(!import_config) {
                import_config = {};
            }

            RC.render(req, res, 'dynamic-config-excipio-export', {
                caller: caller,
                config: import_config,
                path: req.path
            });
        });
    });
}