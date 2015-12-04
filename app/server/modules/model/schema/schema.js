var jsv = require("jsv").JSV.createEnvironment();

exports.validate = function(jsonObject, schema) {
    return jsv.validate(jsonObject, schema);
};

exports.currentVersion = "1";

exports.templateSchema = require("./v" + exports.currentVersion + "/template.json");
exports.updateTemplateSchema = require("./v" + exports.currentVersion + "/template-update.json");
exports.createTemplateSchema = require("./v" + exports.currentVersion + "/template-create.json");

exports.storeCheckSchema = require("./v" + exports.currentVersion + "/store-check.json");
exports.updateStoreCheckSchema = require("./v" + exports.currentVersion + "/store-check-update.json");
exports.createStoreCheckSchema = require("./v" + exports.currentVersion + "/store-check-create.json");
exports.closeStoreCheckSchema = require("./v" + exports.currentVersion + "/store-check-close.json");

exports.auditTeamSchema = require("./v" + exports.currentVersion + "/audit-team.json");
exports.updateAuditTeamSchema = require("./v" + exports.currentVersion + "/audit-team-update.json");
exports.createAuditTeamSchema = require("./v" + exports.currentVersion + "/audit-team-create.json");

exports.visitSchema = require("./v" + exports.currentVersion + "/visit.json");
exports.updateVisitSchema = require("./v" + exports.currentVersion + "/visit-update.json");
exports.updateVisitStatusSchema = require("./v" + exports.currentVersion + "/visit-status-update.json");
exports.createVisitSchema = require("./v" + exports.currentVersion + "/visit-create.json");

exports.sampleSchema = require("./v" + exports.currentVersion + "/sample.json");
exports.updateSampleSchema = require("./v" + exports.currentVersion + "/sample-update.json");
exports.createSampleSchema = require("./v" + exports.currentVersion + "/sample-create.json");

exports.organizationSchema = require("./v" + exports.currentVersion + "/organization.json");
exports.updateOrganizationSchema = require("./v" + exports.currentVersion + "/organization-update.json");
exports.createOrganizationSchema = require("./v" + exports.currentVersion + "/organization-create.json");
exports.organizationTemperatureSchema = require("./v" + exports.currentVersion + "/organization-temperature-update.json");

exports.auditAssignmentSchema = require("./v" + exports.currentVersion + "/audit-assignment.json");
exports.createAuditAssignmentSchema = require("./v" + exports.currentVersion + "/audit-assignment-update.json");

exports.userSchema = require("./v" + exports.currentVersion + "/user.json");
exports.updateUserSchema = require("./v" + exports.currentVersion + "/user-update.json");
exports.createUserSchema = require("./v" + exports.currentVersion + "/user-create.json");

exports.dynamicConfigEmailUpdateSchema = require("./v" + exports.currentVersion + "/dynamic-config-email-update.json");
exports.dynamicConfigAWSUpdateSchema = require("./v" + exports.currentVersion + "/dynamic-config-aws-update.json");