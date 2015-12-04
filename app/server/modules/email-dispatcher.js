var EM = {};
module.exports = EM;

var config = require('config');
var connect_semaphore = require('semaphore')(1);
var emailjs = require("emailjs/email");

var dynamic_config = require("./dynamic-config");

EM.semaphore = connect_semaphore;

EM.reconnect = function(callback) {
    if(typeof(EM.server) != 'undefined') {
        delete EM.server;
    }

    dynamic_config.findOne({key: 'email'}, function(err, email_config) {
        if(err == null && email_config != null) {
            EM.connection_info = email_config.values;

            EM.server = emailjs.server.connect({
                host 	    : email_config.values.host,
                user 	    : email_config.values.user,
                password    : email_config.values.password,
                ssl		    : email_config.values.ssl,
                tls         : email_config.values.tls,
                port        : email_config.values.port
            });
            callback(err, email_config);
        } else {
            callback(err, null);
        }
    });
};

// callback takes (string err, boolean isGood)
EM.testConnection = function(callback) {
    dynamic_config.findOne({key: 'email'}, function(err, email_config) {
        var server = emailjs.server.connect({
            host 	    : email_config.values.host,
            user 	    : email_config.values.user,
            password    : email_config.values.password,
            ssl		    : email_config.values.ssl,
            tls         : email_config.values.tls,
            port        : email_config.values.port
        });
        if(server == null) {
            callback(err, false);
            return;
        }
        delete server;
        callback(null, true);
    });
};

EM.send = function(to, subject, text, attachments) {
    EM.server.send({
        from         : EM.connection_info.sender,
        to           : to,
        subject      : subject,
        text         : text,
        attachment   : attachments
    }, function(err, item) {
        if(err != null) {
            console.log(err);
        }
    });
};

EM.dispatchResetPasswordLink = function(account, token, callback) {
	EM.server.send({
        from         : EM.connection_info.sender,
		to           : account.email,
		subject      : 'Password Reset',
		text         : 'Password Reset',
		attachment   : EM.composeResetEmail(account, token)
	}, callback );
};

EM.composeResetEmail = function(o, token) {
	var link = config['site']['host'] + '/reset-password?e='+o.email+'&token='+token;
    if(link.indexOf('http') != 0) {
        link = 'http://' + link;
    }

	var html = "<html><body>";
		html += "Hi "+o.name+",<br><br>";
		html += "Your username is : <b>"+o.user+"</b><br><br>";
		html += 'Please visit <a href="'+link+'">' + link + '</a> to reset your password<br><br>';
		html += "</body></html>";
	return  [{data:html, alternative:true}];
};