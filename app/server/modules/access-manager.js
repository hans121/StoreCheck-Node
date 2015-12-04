var _ = require('underscore');
var winston = require('winston');

var _roles = {};

_roles["CBU"] = initCBUAccess();
_roles["auditor"] = initAuditorAccess();
_roles["admin"] = initAdminAccess();
_roles["exec"] = initExecAccess();
_roles["supervisor"] = initSupervisorAccess();

exports.hasAccess = function(role, resource, action) {
    //winston.log('debug', 'entered access-manager.hasAccess(role=' + role + ', resource=' + resource + ', action=' + action + ')');
    var roleRecords = _roles[role];
    if(roleRecords) {
        var resourceRecords = roleRecords[resource];
        if(resourceRecords) {
            return resourceRecords.indexOf(action) != -1;
        }
        winston.log('debug', 'access-manager.hasAccess(role=' + role + ', resource=' + resource + ', action=' + action + ') declined access because the resource was not found');
        return false;
    }
    winston.log('debug', 'access-manager.hasAccess(role=' + role + ', resource=' + resource + ', action=' + action + ') declined access because the role was not found');
    return false;
};

exports.hasRole = function(caller, role_criteria) {
    return !_.every(caller.roles, function(role) {
        return (role != role_criteria);
    });
};

exports.getRole = function(caller) {
    return caller.roles[0];
};

function initCBUAccess() {
    var pep = {};

    pep["action-audit"] = "rl";
    pep["admin"] = "";
    pep["auditor"] = "crudl";
    pep["audit-assignment"] = "crudl";
    pep["audit-team"] = "crudl";
    pep["audit-team/auditor"] = "crul";
    pep["audit-team/supervisor"] = "crul";
    pep["audit-team/visit"] = "";   // actions on visit within audit-team scope
    pep["audit-team/store-check"] = "";
    pep["CBU"] = "crul";
    pep["customer"] = "r";
    pep["exec"] = "";
    pep["factory"] = "rl";
    pep["factory/hierarchy"] = "";
    pep["organization"] = "";
    pep["organization/settings/temperature"] = "u";
    pep["pos"] = "crudl";
    pep["pos/hierarchy"] = "rl";
    pep["product"] = "curl";
    pep["product/hierarchy"] = "rl";
    pep["role-list"] = "";
    pep["sample"] = "rl";
    pep["sample/state"] = "url";
    pep["sample/state/revert"] = "c";
    pep["store-check"] = "crudl";
    pep["supervisor"] = "crudl";
    pep["template"] = "crudl";
    pep["template/hierarchy"] = "rl";
    pep["user"] = "c";                 // actions on users at global/organization level
    pep["user/me"] = "crud";
    pep["user/role"] = "cru";
    pep["user/organization"] = "";
    pep["visit"] = "rdl";          // actions on visits at global/organization level
    pep["visit/state/active"] = "rl";
    pep["visit/state/submitted"] = "rl";
    pep["visit/state/validated"] = "rudl";
    pep["visit/state/released"] = "rl";
    return pep;
}

function initAdminAccess() {
    var pep = {};

    pep["template"] = "crudl";
    pep["action-audit"] = "rl";
    pep["audit-assignment"] = "crudl";
    pep["audit-team"] = "crudl";
    pep["audit-team/auditor"] = "crudl";
    pep["audit-team/supervisor"] = "crudl";
    pep["audit-team/visit"] = "";   // actions on visit within audit-team scope
    pep["audit-team/store-check"] = "";
    pep["customer"] = "rl";
    pep["product"] = "crudl";
    pep["product/hierarchy"] = "curdl";
    pep["factory"] = "crudl";
    pep["factory/hierarchy"] = "crudl";
    pep["production-line"] = "rl";
    pep["production-line/hierarchy"] = "crudl";
    pep["pos"] = "crudl";
    pep["pos/hierarchy"] = "crudl";
    pep["template/hierarchy"] = "crudl";
    pep["store-check"] = "crudl";
    pep["supervisor"] = "crudl";
    pep["auditor"] = "crudl";           // actions on auditors at global/organization level
    pep["CBU"] = "crudl";
    pep["admin"] = "crudl";
    pep["exec"] = "crudl";
    pep["sample"] = "crudl";
    pep["sample/state"] = "crudl";
    pep["sample/state/revert"] = "c";
    pep["visit"] = "crudl";         // actions on visits at global/organization level
    pep["visit/state/active"] = "crudl";
    pep["visit/state/submitted"] = "crudl";
    pep["visit/state/validated"] = "crudl";
    pep["visit/state/released"] = "crudl";
    pep["role-list"] = "rl";
    pep["user"] = "crudl";
    pep["user/me"] = "crud";
    pep["user/role"] = "crudl";
    pep["user/organization"] = "crudl";
    pep["organization"] = "crudl";
    pep["organization/settings/temperature"] = "u";
    return pep;
}

function initExecAccess() {
    var pep = {};

    pep["action-audit"] = "rl";
    pep["admin"] = "";
    pep["audit-assignment"] = "crudl";
    pep["audit-team"] = "crudl";
    pep["audit-team/auditor"] = "crudl";
    pep["audit-team/supervisor"] = "crudl";
    pep["audit-team/visit"] = "";   // actions on visit within audit-team scope
    pep["audit-team/store-check"] = "";
    pep["auditor"] = "crudl";           // actions on auditors at global/organization level
    pep["CBU"] = "crudl";
    pep["customer"] = "rl";
    pep["exec"] = "rl";
    pep["factory"] = "crudl";
    pep["factory/hierarchy"] = "rl";
    pep["organization"] = "crudl";
    pep["organization/settings/temperature"] = "u";
    pep["production-line"] = "rl";
    pep["production-line/hierarchy"] = "rl";
    pep["pos"] = "crudl";
    pep["pos/hierarchy"] = "rl";
    pep["product"] = "crudl";
    pep["product/hierarchy"] = "rl";
    pep["role-list"] = "rl";
    pep["sample"] = "crudl";
    pep["sample/state"] = "crudl";
    pep["sample/state/revert"] = "c";
    pep["store-check"] = "crudl";
    pep["supervisor"] = "crudl";
    pep["template"] = "crudl";
    pep["template/hierarchy"] = "rl";
    pep["user"] = "crudl";
    pep["user/me"] = "crud";
    pep["user/role"] = "crudl";
    pep["user/organization"] = "crudl";
    pep["visit"] = "crudl";         // actions on visits at global/organization level
    pep["visit/state/active"] = "crudl";
    pep["visit/state/submitted"] = "crudl";
    pep["visit/state/validated"] = "crudl";
    pep["visit/state/released"] = "crudl";
    return pep;
}

function initAuditorAccess() {
    var pep = {};

    pep["action-audit"] = "";
    pep["admin"] = "";
    pep["auditor"] = "";            // actions on auditors at global/organization level
    pep["audit-assignment"] = "ru";
    pep["audit-team"] = "";
    pep["audit-team/auditor"] = "";
    pep["audit-team/supervisor"] = "";
    pep["audit-team/visit"] = "l";  // actions on visit within audit-team scope
    pep["audit-team/store-check"] = "l";
    pep["customer"] = "r";
    pep["CBU"] = "";
    pep["exec"] = "";
    pep["factory"] = "rl";
    pep["factory/hierarchy"] = "rl";
    pep["organization"] = "";
    pep["organization/settings/temperature"] = "r";
    pep["pos"] = "curl";
    pep["pos/hierarchy"] = "crudl";
    pep["product"] = "rl";
    pep["product/hierarchy"] = "rl";
    pep["production-line"] = "rl";
    pep["production-line/hierarchy"] = "rl";
    pep["role-list"] = "";
    pep["sample"] = "crudl";
    pep["sample/state"] = "url";
    pep["sample/state/revert"] = "";
    pep["store-check"] = "r";
    pep["supervisor"] = "";
    pep["template"] = "r";
    pep["template/hierarchy"] = "";
    pep["user"] = "";
    pep["user/me"] = "rud";
    pep["user/role"] = "";
    pep["user/organization"] = "";
    pep["visit"] = "crud";          // actions on visits at global/organization level
    pep["visit/state/active"] = "crudl";
    pep["visit/state/submitted"] = "rl";
    pep["visit/state/validated"] = "";
    pep["visit/state/released"] = "";
    return pep;
}

function initSupervisorAccess() {
    var pep = {};

    pep["action-audit"] = "";
    pep["admin"] = "";
    pep["audit-assignment"] = "crudl";
    pep["audit-team"] = "cru";
    pep["audit-team/supervisor"] = "crul";
    pep["audit-team/auditor"] = "crudl";
    pep["audit-team/store-check"] = "l";
    pep["audit-team/visit"] = "l";      // actions on visit within audit-team scope
    pep["auditor"] = "cd";              // actions on auditors at global/organization level
    pep["CBU"] = "";
    pep["customer"] = "r";
    pep["exec"] = "";
    pep["factory"] = "rl";
    pep["factory/hierarchy"] = "rl";
    pep["organization"] = "";
    pep["organization/settings/temperature"] = "r";
    pep["product"] = "url";
    pep["product/hierarchy"] = "curl";
    pep["production-line"] = "rl";
    pep["production-line/hierarchy"] = "rl";
    pep["pos"] = "crudl";
    pep["pos/hierarchy"] = "crudl";
    pep["role-list"] = "";
    pep["sample"] = "crudl";
    pep["sample/state"] = "url";
    pep["sample/state/revert"] = "";
    pep["store-check"] = "r";
    pep["supervisor"] = "c";
    pep["template"] = "crudl";
    pep["template/hierarchy"] = "rl";
    pep["user"] = "c";
    pep["user/me"] = "crud";
    pep["user/role"] = "cr";
    pep["user/organization"] = "";
    pep["visit"] = "crud";              // actions on visits at global/organization level
    pep["visit/state/active"] = "crudl";
    pep["visit/state/released"] = "";
    pep["visit/state/submitted"] = "rudl";
    pep["visit/state/validated"] = "rl";
    return pep;
}

