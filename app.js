require('./newrelic');
var express = require('express');
var app = express();

var config = require('config');
var fs = require('fs');
var http = require('http');
var https = require('https');
var MongoStore = require('connect-mongo')(express);

// grab logging modules from Winston
var winston = require('winston');
var winstonMongo = require('winston-mongodb').MongoDB;

// set up logging to a file, if it's desired
if(config['logging']['file'] && config['logging']['file'].enabled) {

    var winston_config = {
        filename: config['logging']['file']['filePrefix'],
        json: false,
        level: config['logging']['file']['logLevel']
    };

    if(config['logging']['file'].rotation && config['logging']['file'].rotation.enabled) {
        winston_config.maxsize = config['logging']['file']['rotation']['fileSize'];
    }

    winston.add(winston.transports.File, winston_config);
}

// set up logging to a database, if it's desired
if(config['logging'].database && config['logging'].database.enabled) {
    var database_options = {
        db: config['logging']['database']['name'],
        username: config['logging']['database']['user'],
        password: config['logging']['database']['password'],
        host: config['logging']['database']['address'],
        storeHost: true,
        safe: false, // TODO: probably can afford to set it to true for now
        level: config['logging']['database']['logLevel'],
        label: config['logging']['database']['label']
    };

    winston.add(winston.transports.MongoDB, database_options);
}

winston.remove(winston.transports.Console);
if(config.logging.console && config.logging.console.enabled) {
    winston.add(winston.transports.Console, {
        timestamp: true,
        level: config['logging']['console']['logLevel']
    });
}

app.configure(function(){
	app.set('port', config.site.port);
	app.set('views', __dirname + '/app/server/views');
	app.set('view engine', 'jade');
    if(config.site.isHtmlPretty) {
        app.set('view options', {pretty: false});
        app.locals.pretty = true;
    }
    if(config.site.isCompressing) {
        app.use(express.compress());
    }
    //csrf()
	app.use(express.bodyParser());
	app.use(express.cookieParser());
    app.use(express.session({
        store: new MongoStore({
            url: 'mongodb://' + config.sessions_database.user + ':' + config.sessions_database.password + '@' + config.sessions_database.address + ':27017/' + config.sessions_database.name
        }),
        secret: config.site.sessionSecret
    }));
	app.use(express.methodOverride());
	app.use(require('stylus').middleware({ src: __dirname + '/app/public' }));
	app.use(express.static(__dirname + '/app/public'));

    // caching for IE is super-sticky, and has caused some issues when testing and demoing
    // so, we've provided a method to tell browsers to not cache, if the node admin so desires
    if(config.site.isCacheOff) {
        app.use(function noCaching(req, res, next) {
            res.header("Cache-Control", "private, max-age=0, must-revalidate");
            res.header("Expires", "Thu, 01 Jan 1970 00:00:00");
            next();
        });
    }

    app.use(require('node-response-time-tracking').middleware());
});

app.configure('development', function(){
	app.use(express.errorHandler());
});

var EM = require('./app/server/modules/email-dispatcher');

var jobs = require('./app/server/modules/jobs/jobs');
if(config['system'].backupDirectory) {
    jobs.startDeleteDatabaseBackupsJob(18, 46);
}

process.on('uncaughtException', function(err) {
    if(typeof(err.stack) != 'undefined') {
        winston.error('uncaught exception: stack: ' + err.stack);
    } else {
        winston.error('uncaught exception: ' + err);
    }

    if(config.errors.shallSendEmail) {
        EM.semaphore.take(function() {
            EM.reconnect(function(err_reconect) {
                if(err_reconect == null) {
                    EM.send(config.errors.emailTo, 'Uncaught exception', 'Uncaught exception occurred:\n' + err.stack, err.stack);
                }
                EM.semaphore.leave();
            });
        });
    }
});

// TODO: do I still need this?  as long as deep stacks are nested in nodeUtils.recursiveWrapper, we're fine
process.maxTickDepth = Infinity;

require('./app/server/router/view/user')(app);
require('./app/server/router/view/aws')(app);
require('./app/server/router/view/audit-assignment')(app);
require('./app/server/router/view/audit-team')(app);
require('./app/server/router/view/customer-platform')(app);
require('./app/server/router/view/dynamic-config')(app);
require('./app/server/router/view/defects')(app);
require('./app/server/router/view/excipio-exports')(app);
require('./app/server/router/view/logs')(app);
require('./app/server/router/view/organization')(app);
require('./app/server/router/view/pos')(app);
require('./app/server/router/view/product')(app);
require('./app/server/router/view/response-times')(app);
require('./app/server/router/view/sample')(app);
require('./app/server/router/view/system')(app);
require('./app/server/router/view/store-check')(app);
require('./app/server/router/view/template')(app);
require('./app/server/router/view/visit')(app);

require('./app/server/router/service/admin')(app);
require('./app/server/router/service/admin-area')(app);
require('./app/server/router/service/audit-assignment')(app);
require('./app/server/router/service/audit-team')(app);
require('./app/server/router/service/customer-platform')(app);
require('./app/server/router/service/danone-platform')(app);
require('./app/server/router/service/dynamic-config')(app);
require('./app/server/router/service/excipio')(app);
require('./app/server/router/service/visit')(app);
require('./app/server/router/service/aws')(app);
require('./app/server/router/service/action-audit')(app);
require('./app/server/router/service/customer')(app);
require('./app/server/router/service/sample/sample-import')(app);
require('./app/server/router/service/sample/sample-export')(app);
require('./app/server/router/service/sample/sample')(app);
require('./app/server/router/service/factory')(app);
require('./app/server/router/service/organization')(app);
require('./app/server/router/service/jobs')(app);
require('./app/server/router/service/pos')(app);
require('./app/server/router/service/product')(app);
require('./app/server/router/service/production-line')(app);
require('./app/server/router/service/report')(app);
require('./app/server/router/service/region-of-sales')(app);
require('./app/server/router/service/store-check')(app);
require('./app/server/router/service/store-check-sample-type')(app);
require('./app/server/router/service/template')(app);
require('./app/server/router/service/template-hierarchy')(app);
require('./app/server/router/service/user')(app);
require('./app/server/router/service/world')(app);

require('./app/server/router/router-view')(app);

var paths = [];

app.routes.post.forEach(function(postPath) {
   paths.push({method: 'POST   ', path: postPath.path});
});

app.routes.get.forEach(function(postPath) {
    paths.push({method: 'GET    ', path: postPath.path});
});

app.routes.delete.forEach(function(postPath) {
    paths.push({method: 'DELETE ', path: postPath.path});
});

paths = paths.sort(function(a, b) {
    if(a.path < b.path) {
        return -1;
    } else if(a.path > b.path) {
        return 1;
    }
    return 0;
});

paths.forEach(function(path) {
    winston.log('debug', 'registered express route: ' + path.method + ' ' + path.path);
});

if(config.site.isHttps) {
    // Generating keys:
    // openssl genrsa -out privatekey.pem 1024
    // openssl req -new -key privatekey.pem -out certrequest.csr
    // openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem

    var privateKey = fs.readFileSync('config/ssl/key.pem').toString();
    var certificate = fs.readFileSync('config/ssl/cert.pem').toString();

    var server = https.createServer({key: privateKey, cert: certificate}, app).listen(app.get('port'), function(){
        console.log('Express server listening on port ' + app.get('port'));
    });

} else {
    var mkdirp = require('mkdirp');
    var dirs = [ 'data/products', 'data/danone_platforms', 'data/templates', 'data/templates/hierarchy', 'data/templates/language'] ;
    for(var i=0; i<dirs.length; i++){
        mkdirp(dirs[i], function (err) {
            if (err)
                 winston.log('error', dirs[i] + ' Not Exists. Error while creating : ' + err)
            else {
           }
        });
    }
    winston.log('info', ' Necessary Directory Created Successfully');

    http.createServer(app).listen(app.get('port'), function() {
        winston.log('info', 'express server listening on port ' + app.get('port'));
    });
}