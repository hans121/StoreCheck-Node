var moment = require('moment');

exports.formatDateTime = function(dateTime) {
    return dateTime && dateTime != null ? moment(dateTime).format('DD-MMM-YYYY, HH:mm:ss') : "";
};

exports.formatDateTimeAsLocal = function(dateTime) {
    return dateTime && dateTime != null ? moment(dateTime).local().format('DD-MMM-YYYY, HH:mm:ss') : "";
};

exports.formatDate = function(date) {
    return date && date != null && moment(date).isValid() ? moment(date).format('DD-MMM-YYYY') : "";
};

exports.formattedDateToTimestamp = function(formatted_date) {
    return formatted_date && formatted_date != null && moment(formatted_date, 'DD-MMM-YYYY').isValid() ? moment(formatted_date).unix() : '';
};

exports.getUtcTimeString = function(momentRep) {
    return momentRep.format("YYYY-MM-DDTHH:mm:ss") + "Z"
};

exports.getCurrentUtcTimeString = function() {
    return exports.getUtcTimeString(moment.utc());
};

exports.getCurrentLocalTimeWithoutZoneString = function() {
    return moment.local().format("YYYY-MM-DDTHH:mm:ss");
};

exports.convertZToExcipio = function(dateString, outputFormat) {
    dateString = dateString.slice(0, dateString.length - 1);// + " +0000";
    var date = moment(dateString, "YYYY-MM-DDTHH:mm:ss");

    if(!outputFormat) {
        return date.isValid() ? date.format("MM/DD/YYYY HH:mm:ss") : "";
    }
    return date.isValid() ? date.format(outputFormat) : "";
};

exports.convertZToDate = function(dateString, outputFormat) {
    dateString = dateString.slice(0, dateString.length - 1);// + " +0000";
    var date = moment(dateString, "YYYY-MM-DDTHH:mm:ss");
    if(!outputFormat) {
        return date.isValid() ? date.format("MM/DD/YYYY") : "";
    }
    return date.isValid() ? date.format(outputFormat) : "";
};

exports.convertShortToExcipio = function(dateString, outputFormat) {
    var date_in = moment(dateString, "DD-MMM-YYYY");
    if(!outputFormat) {
        return date_in != null && date_in.isValid() ? date_in.format("MM/DD/YYYY") : "";
    }
    return date_in != null && date_in.isValid() ? date_in.format(outputFormat) : "";
};