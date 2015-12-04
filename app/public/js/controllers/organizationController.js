OrganizationController.prototype = new PageController();
OrganizationController.prototype.constructor = OrganizationController;
function OrganizationController() {
    var that = this;

    $('#organization-form-btn-create').click(function(){ that.createOrganization(); return false; });
    $('#organization-form-btn-save').click(function(){ that.updateOrganization(); return false; });
    $('.btn-add-user-to-org').click(function() { that.addUserToOrganization(); return false; });

    $('.modal-confirm').modal({ show : false, keyboard : true, backdrop : true });
    $('.modal-confirm .modal-header h3').text('Delete Organization');
    $('.modal-confirm .modal-body p').html('Are you sure you want to delete this organization?');
    //$('.modal-confirm .cancel').html('Cancel');
    //$('.modal-confirm .submit').html('Delete');
    $('.modal-confirm .submit').addClass('btn-danger');

    $('.modal-confirm .submit').click(function(){ that.deleteOrganization(that.delete_id); });
}

OrganizationController.prototype.setUserController = function(controller) {
    this.user_controller = controller;
};

OrganizationController.prototype.setOrganizationId = function (id) {
    this.organizationId = id;
};

OrganizationController.prototype.deleteOrganizationWithConfirmation = function(id) {
    $('.modal-confirm').modal('show');
    this.delete_id = id;
};

OrganizationController.prototype.deleteOrganization = function (id) {
    var that = this;

    $('.modal-confirm').modal('hide');
    $.ajax({
        url: '/organization/' + id,
        type: 'DELETE',
        success: function(data){
            that.showLockedAlert('The selected organization has been deleted.', 'Success', '/organizations/view');
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
};

OrganizationController.prototype.applyTemperature = function(data, property, selector) {
    try {
        var value = parseInt($(selector).val());

        if(!isNaN(value)) {
            if(!data.settings) {
                data.settings = {};
            }
            if(!data.settings.temperature_ranges) {
                data.settings.temperature_ranges = {};
            }
            data.settings.temperature_ranges[property] = value;
        }
    } catch(ex) {
    }
};

OrganizationController.prototype.createOrganization = function () {
    var that = this;
    that.showLoadingMessage('Creating...');

    var data = {
        name: $('.organization-name-input').val(),
        code: $('.organization-code-input').val(),
        state: $('.organization-active-input')[0].checked ? "active" : "inactive"
    };

    /*
    this.applyTemperature(data, 'min_nonconform', 'input.organization-min-nonconform');
    this.applyTemperature(data, 'conform', 'input.organization-conform');
    this.applyTemperature(data, 'alert', 'input.organization-alert');
    this.applyTemperature(data, 'max_nonconform', 'input.organization-max-nonconform');
*/

    $.ajax({
        url: '/organization',
        type: 'PUT',
        data: data,
        success: function(data_result){
            window.location.href = '/organizations/view';
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
};

OrganizationController.prototype.updateOrganization = function () {
    var that = this;
    that.showLoadingMessage('Saving...');

    var data = {
        name: $('.organization-name-input').val(),
        code: $('.organization-code-input').val(),
        state: $('.organization-active-input')[0].checked ? "active" : "inactive"
    };

    /*
    this.applyTemperature(data, 'min_nonconform', 'input.organization-min-nonconform');
    this.applyTemperature(data, 'conform', 'input.organization-conform');
    this.applyTemperature(data, 'alert', 'input.organization-alert');
    this.applyTemperature(data, 'max_nonconform', 'input.organization-max-nonconform');
    */

    // set templates setting
    if(typeof(data.settings) == 'undefined') {
        data.settings = {
            templates: []
        };
    } else if(typeof(data.settings.templates) == 'undefined') {
        data.settings.templates = [];
    }

    var included_templates = $('input.template-radio:checked');
    if(included_templates.length == 0) {
        data.settings.templates = [];
    }
    for(var i=0; i<included_templates.length; i++) {
        var template = included_templates[i].value;
        data.settings.templates.push(template);
    }

    $.ajax({
        url: '/organization/' + that.organizationId,
        type: 'POST',
        data: data,
        success: function(data_result){
            window.location.reload();
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
};

OrganizationController.prototype.updateTemperature = function() {
    var data = {}, that = this, values_defined = 0;

    var min_nonconform_value = $('input.organization-min-nonconform').val();
    var conform_value = $('input.organization-conform').val();
    var alert_value = $('input.organization-alert').val();
    var max_nonconform_value = $('input.organization-max-nonconform').val();

    if(min_nonconform_value.trim().length > 0) {
        values_defined++;
    }
    if(conform_value.trim().length > 0) {
        values_defined++;
    }
    if(alert_value.trim().length > 0) {
        values_defined++;
    }
    if(max_nonconform_value.trim().length > 0) {
        values_defined++;
    }

    if(values_defined != 0 && values_defined != 4) {
        this.showAlert('You must define all or none of the temperature settings', 'Error');
        return;
    }

    if(min_nonconform_value.trim().length > 0) {
        try {
            data.min_nonconform = parseInt(min_nonconform_value);
            data.conform = parseInt(conform_value);
            data.alert = parseInt(alert_value);
            data.max_nonconform = parseInt(max_nonconform_value);
        } catch(ex) {
            this.showAlert('You must define integers for the temperature settings', 'Error');
            return;
        }
    }

    $.ajax({
        url: '/organization/settings/temperature',
        type: 'POST',
        data: data,
        success: function(data_result){
            window.location.reload();
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
};

OrganizationController.prototype.addUserToOrganization = function() {
    var that = this;

    function addNewUser() {
        var user = that.user_controller.getUserFromForm();

        if(user != null) {
            user.organization = that.organizationId;
            user.roles = ['auditor']; // TODO: this doesn't work yet!
            $('.add-new-user-dialog').modal('hide');
            that.user_controller.sendCreate(user, function(result) {
                window.location.reload();
            });
        }
    }

    $('.add-new-user-dialog .submit').unbind('click');
    $('.add-new-user-dialog .submit').click(addNewUser);

    $('#account-form input').unbind('keydown');
    $('#account-form input').keydown(function(e){
        if(e.keyCode == 13){ // ENTER key
            addNewUser();
            return false;
        }
    });

    $('.add-new-user-dialog').modal('show');
    /*
    that.showLoadingMessage('Saving...');

    var data = {
        id: that.organizationId,
        name: $('.organization-name-input').val(),
        code: $('.organization-code-input').val(),
        state: $('.organization-active-input')[0].checked ? "active" : "inactive"
    };

    this.applyTemperature(data, 'min_nonconform', 'input.organization-min-nonconform');
    this.applyTemperature(data, 'conform', 'input.organization-conform');
    this.applyTemperature(data, 'alert', 'input.organization-alert');
    this.applyTemperature(data, 'max_nonconform', 'input.organization-max-nonconform');

    $.ajax({
        url: '/organization',
        type: 'POST',
        data: data,
        success: function(data_result){
            window.location.reload();
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
    */
};
