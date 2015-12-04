UserController.prototype = new PageController();
UserController.prototype.constructor = UserController;
function UserController(validator) {
    var that = this;
    this.validator = validator;
    $('.modal-confirm .submit').addClass('btn-danger');

    $('select.active-organization').select2({
        placeholder: "Select an organization",
        allowClear: true
    });
    $('select.role-list').select2({
        placeholder: "Select a role",
        allowClear: false
    });
    $('button.btn-become').click(function() {
        $.ajax({
            type: 'POST',
            url: '/admin/user/become?user=' + $('#userUsername').val()
        }).done(function(result) {
            window.location.reload();
        }).error(function(jqXHR, textStatus, errorThrown) {
            that.showAlert('Failed to update user', 'Error');
        });
    });
}

UserController.prototype.initUserCreate = function() {
    var that = this;

    $('#account-form-btn2').html('Create');
    $('#account-form-delete-btn').hide();

    $('#account-form input').keydown(function(e){
        if(e.keyCode == 13){ // ENTER key
            that.sendAddUser.call(that);
            return false;
        }
    });

    $('#account-form-btn2').click(function() {
        that.sendAddUser.call(that);
    });
};

UserController.prototype.getUserFromForm = function() {
    var that = this;

    var data = {
        name:                  $('input#name-tf').val(),
        email:                 $('input#email-tf').val(),
        user:                  $('input#user-tf').val(),
        pass:                  $('input#pass-tf').val()
    };
    var role = $('select.role-list').val();
    if(role != null) {
        data.role = role;
    }
    var orgId = $('select.active-organization').val();
    if(orgId != null) {
        data.organization = orgId;
    }

    if(that.validator) {
        if(that.validator.validateUpdateForm()) {
            return data;
        }
        return null;
    } else {
        return data;
    }
};

UserController.prototype.initEditUser = function(user_roles) {
    var that = this;

    $('#account-form-delete-btn').html('Delete');
    $('#user-tf').prop('disabled', true);

    $('#account-form-delete-btn').click(function(){
        that.deleteUserWithConfirmation($('#userId').val(), function() {
            if(typeof(user_roles) == 'undefined') {
                that.showLockedAlert('This account has been deleted.', 'Success', '/users/view');
            } else {
                // I hate this sort of behavior.  BLEGH!
                if(user_roles.indexOf('admin') != -1 || user_roles.indexOf('exec') != -1) {
                    that.showLockedAlert('This account has been deleted.', 'Success', '/users/view');
                } else if(user_roles.indexOf('CBU') != -1) {
                    that.showLockedAlert('This account has been deleted.', 'Success', '/audit-teams/view');
                } else {
                    that.showAlert('This account has been deleted.', 'Success');
                }
            }
        });
    });

    $('.btn-add-user').click(function() {
        window.location.href = '/';
    });

    var formButton = $('#account-form-btn2');
    formButton.html('Save');
    formButton.click(function() {
        that.sendUpdate(that.getUserFromForm());
        return false;
    });
};

UserController.prototype.sendUpdate = function (data) {
    var that = this;
    if(data != null) {
        that.showLoadingMessage('Saving...');
        $.ajax({
            type: 'POST',
            data: data,
            url: '/user'
        }).done(function(result) {
            window.location.href = '/users/view';
            //window.location.reload();
        }).error(function(jqXHR, textStatus, errorThrown) {
            that.showAlert('Failed to update user', 'Error');
        });
    }
};

UserController.prototype.sendCreate = function (data, onComplete) {
    var that = this;
    that.showLoadingMessage('Creating...');
    $.ajax({
        type: 'PUT',
        data: data,
        url: '/user'
    }).done(function(result) {
        that.hideLoadingMessage();
        onComplete(result);
    }).error(function(jqXHR, textStatus, errorThrown) {
        that.showAlert('An error has occurred: ' + jqXHR.responseText, 'Error');
    });
};

UserController.prototype.sendAddUser = function() {
    var that = this;

    var data = {
        name:                  $('input#name-tf').val(),
        email:                 $('input#email-tf').val(),
        user:                  $('input#user-tf').val(),
        pass:                  $('input#pass-tf').val()
    };
    var team = $('select.user-team').val();
    if(team != null && team.trim().length > 0){
        data.team = team.trim();
    }

    var role = $('select.role-list').val();
    if(role != null && role.length > 0) {
        data.role = role;
    }
    var orgId = $('select.active-organization').val();
    if(orgId != null) {
        data.organization = orgId;
    }

    if(this.validator) {
        if(this.validator.validateCreateForm()) {
            this.sendCreate(data, function(result) {
                window.location.reload();
            });
        }
    } else {
        this.sendCreate(data, function(result) {
            window.location.reload();
        });
    }

    return false;
};

UserController.prototype.initUserList = function() {
};

UserController.prototype.deleteUserWithConfirmation = function(id, onDeleted) {
    var that = this;
    this.showConfirmation('Are you sure you want to delete this user account?', 'Delete User Account', 'Yes', function(){
        that.deleteUser(id, onDeleted);
    });
};

UserController.prototype.deleteUser = function(id, callback) {
    var that = this;
    that.showLoadingMessage('Deleting...');
    $.ajax({
        url: '/user/' + id,
        type: 'DELETE',
        success: function(data){
            if(callback) {
                callback(data);
            } else {
                that.showLockedAlert('This account has been deleted.', 'Success', '/users/view');
            }
        },
        error: function(jqXHR){
            $('.modal-confirm').modal('hide');
            that.showAlert('This account could not be deleted!<br> Reason: ' + jqXHR.responseText, 'Error');
        }
    });
};

UserController.prototype.deactivateUserWithConfirmation = function(id) {
    var that = this;
    this.showConfirmation('Are you sure you want to deactivate this user account?', 'Deactivate User Account', 'Yes', function(){
        that.showLoadingMessage('Deactivating...');
        that.deactivateUser(id);
    });
};

UserController.prototype.deactivateUser = function(id, callback) {
    var that = this;
    $.ajax({
        url: '/user/' + id + '?state=inactive',
        type: 'POST',
        success: function(data){
            if(callback) {
                callback(data);
            } else {
                window.location.reload();
            }
        },
        error: function(jqXHR){
            that.showAlert('This account could not be deactivated!<br> Reason: ' + jqXHR.responseText, 'Error');
        }
    });
};

UserController.prototype.activateUserWithConfirmation = function(id) {
    var that = this;
    $('.modal-confirm .submit').addClass('btn-danger');
    this.showConfirmation('Are you sure you want to activate this user account?', 'Activate User Account', 'Yes', function() {
        that.showLoadingMessage('Activating...');
        that.activateUser(id);
    });
};

UserController.prototype.activateUser = function(id) {
    var that = this;
    $.ajax({
        url: '/user/' + id + '?state=active',
        type: 'POST',
        success: function(data){
            window.location.reload();
        },
        error: function(jqXHR){
            that.showAlert('This account could not be activated!<br> Reason: ' + jqXHR.responseText, 'Error');
        }
    });
};
