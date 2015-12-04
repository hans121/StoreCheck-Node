var config      = require('config');
var MongoDB 	= require('mongodb').Db;
var Server 		= require('mongodb').Server;
var winston     = require('winston');

var dbPort 		= config.semi_dynamic_database.port;
var dbHost 		= config.semi_dynamic_database.address;
var dbName 		= config.semi_dynamic_database.name;

var db = new MongoDB(dbName, new Server(dbHost, dbPort, {auto_reconnect: true}), {w: 1});
db.open(function(e, data){
    if (e) {
        winston.log('error', 'an error occurred while opening database ' + dbName + ':' + e);
    }   else{
        winston.log('info', 'connected to database :: ' + dbName + ' ... authenticating ...');
        data.authenticate(config.semi_dynamic_database.user, config.semi_dynamic_database.password,function(err2,data2){
            if(data2){
                winston.log('info', 'database authentication successful for database ' + dbName);
                db.is_connected = true;
            }
            else{
                winston.log('error', 'database authentication failed for database ' + dbName);
            }
        });

    }
});

exports.db = db;