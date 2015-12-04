var crypto 		= require('crypto');
var moment 		= require('moment');
var nodeutils   = require('./node-utils');
var ObjectId    = require('mongodb').ObjectID;
var winston     = require('winston');

var db = require('./database/dynamic-database').db;
var accounts = db.collection('accounts');
var dbUtils = require('./database/database-utils');

module.exports = {
    autoLogin: _autoLogin,
    manualLogin: _manualLogin,

    addNewAccount: _addNewAccount,
    updateAccount: _updateAccount,
    updatePassword: _updatePassword,
    updateStatus: _updateStatus,
    deleteAccount: _deleteAccount,
    delAllRecords: _delAllRecords,
    validateResetLink: _validateResetLink,

    getAccountByEmail: _getAccountByEmail,
    getAllRecords: _getAllRecords,
    getAllUsersInOrganizations: _getAllUsersInOrganizations,
    getAllUsersWithRole: _getAllUsersWithRole,
    getAllActiveUsersWithRole: _getAllActiveUsersWithRole,
    getAllUsersWithRoleInOrganizations: _getAllUsersWithRoleInOrganizations,
    getAllActiveUsersWithRoleInOrganization: _getAllActiveUsersWithRoleInOrganization,
};

dbUtils.addStandardMethods(module.exports, accounts);

/* login validation methods */

function _autoLogin(user, pass, callback) {
	accounts.findOne({user:user}, function(e, o) {
		if (o){
			o.pass == pass ? callback(o) : callback(null);
		}	else{
			callback(null);
		}
	});
}

function _manualLogin(user, pass, callback) {
	accounts.findOne({user:user}, function(e, o) {
		if (o == null){
			callback('user-not-found');
		}	else{
			validatePassword(pass, o.pass, function(err, res) {
				if (res){
					callback(null, o);
				}	else{
					callback('invalid-password');
				}
			});
		}
	});
}

function _addNewAccount(newData, callback) {
	accounts.findOne({user:newData.user}, function(e, o) {
		if (o){
			callback('UserName Already Exists. Please try with Different UserName');
		}	else{
			accounts.findOne({email:newData.email}, function(e, o) {
				if (o){
					callback('Email Already Exists. Please try with Different Email');
				}	else{
					saltAndHash(newData.pass, function(hash){
						newData.pass = hash;
                        newData.state = 'active';
						newData.date = moment().format('MMMM Do YYYY, h:mm:ss a');
						accounts.insert(newData, {safe: true}, callback);
					});
				}
			});
		}
	});
}

function _updateAccount(newData, callback) {
	accounts.findOne({user:newData.user}, function(e, o){
        o.name      = newData.name;
		o.email 	= newData.email;
        if(typeof newData.roles != 'undefined') {
            o.roles = newData.roles;
        }
        if(typeof newData.organizations != 'undefined') {
            o.organizations = newData.organizations;
        }
        if(typeof newData.active_organization !== 'undefined') {
            o.active_organization = newData.active_organization;
        }
        if(typeof newData.active_organization_name !== 'undefined') {
            o.active_organization_name = newData.active_organization_name;
        }
        if(typeof newData.reset_token != 'undefined') {
            o.reset_token = newData.reset_token;
        } else if(o.reset_token) {
            delete o.reset_token;
        }
		if(newData.pass == ''){
			accounts.save(o, {safe: true}, function(err) {
				if (err) callback(err);
				else callback(null, o);
			});
		} else{
			saltAndHash(newData.pass, function(hash){
				o.pass = hash;
				accounts.save(o, {safe: true}, function(err) {
					if (err) callback(err);
					else callback(null, o);
				});
			});
		}
	});
}

function _updatePassword(email, newPass, callback) {
	accounts.findOne({email:email}, function(e, o){
		if (e){
			callback(e, null);
		}	else{
			saltAndHash(newPass, function(hash){
		        o.pass = hash;
                if(typeof o.reset_token != 'undefined') {
                    delete o.reset_token;
                }
		        accounts.save(o, {safe: true}, callback);
			});
		}
	});
}

function _updateStatus(id, status, callback) {
    accounts.update({ _id: ObjectId(id)}, { $set: { state: status }}, callback);
}

function _deleteAccount(id, callback) {
    accounts.remove({_id: ObjectId(id)}, callback);
}

/* account lookup methods */

function _getAccountByEmail(email, callback) {
	accounts.findOne({email:email}, function(e, o){ callback(o); });
}

function _validateResetLink(email, passHash, callback) {
	accounts.find({ $and: [{email:email, pass:passHash}] }, function(e, o){
		callback(o ? 'ok' : null);
	});
}

function _getAllRecords(callback) {
	accounts.find().toArray(nodeutils.callbackWrapper(callback));
}

function _getAllUsersInOrganizations(organizations, callback) {
    accounts.find({"organizations": { $in: organizations }}).toArray(nodeutils.callbackWrapper(callback));
}

function _getAllUsersWithRole(role, callback) {
    accounts.find({roles: { $in: [ role ]}}).toArray(nodeutils.callbackWrapper(callback));
}

function _getAllActiveUsersWithRole(role, callback) {
    accounts.find({roles: { $in: [ role ]}, state: {$nin: ["inactive"]}}).toArray(nodeutils.callbackWrapper(callback));
}

function _getAllUsersWithRoleInOrganizations(role, organizations, callback) {
    accounts.find({roles: { $in: [ role ]}, "organizations": { $in: organizations }}).toArray(nodeutils.callbackWrapper(callback));
}

function _getAllActiveUsersWithRoleInOrganization(role, organization, callback) {
    accounts.find({roles: { $in: [ role ]}, state: {$nin: ["inactive"]}, "organizations": { $in: [ organization ] }}).toArray(nodeutils.callbackWrapper(callback));
}

function _delAllRecords(callback) {
	accounts.remove({}, callback); // reset accounts collection for testing //
}

/* private encryption & validation methods */

var generateSalt = function() {
	var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
	var salt = '';
	for (var i = 0; i < 10; i++) {
		var p = Math.floor(Math.random() * set.length);
		salt += set[p];
	}
	return salt;
};

var md5 = function(str) {
	return crypto.createHash('md5').update(str).digest('hex');
};

var saltAndHash = function(pass, callback) {
	var salt = generateSalt();
	callback(salt + md5(pass + salt));
};

var validatePassword = function(plainPass, hashedPass, callback) {
	var salt = hashedPass.substr(0, 10);
	var validHash = salt + md5(plainPass + salt);
	callback(null, hashedPass === validHash);
};

nodeutils.runWhenDbLoaded(module.exports, function() {
    var admin_username = 'admin1';
    accounts.findOne({user: admin_username}, function(err_admin, admin_user) {
        if(err_admin) {
            winston.error('an error occurred while ensuring admin exists: ' + err_admin);
            return;
        }
        if(!admin_user) {
            winston.info('creating the default admin user');
            _addNewAccount({
                user: admin_username,
                name: 'admin',
                email: 'admin@example.com',
                pass: 'foopassword',
                roles: ['admin']
            }, function(err_add, add_result) {
                if(err_add) {
                    winston.error('failed to create the default admin user: ' + err_add);
                    return;
                }
                winston.info('created the default admin user');
            });
            return;
        }
        winston.debug('the default admin user exists');
    });
});