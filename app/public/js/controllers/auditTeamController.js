AuditTeamController.prototype = new PageController();
AuditTeamController.prototype.constructor = AuditTeamController;
function AuditTeamController(audit_team_id, user_controller) {
    var that = this;
    $('#audit-team-form-btn-create').click(function(){ that.createAuditTeam(); });
    $('#audit-team-form-btn-save').click(function(){ that.updateAuditTeam(audit_team_id); });

    $('.modal-confirm .submit').addClass('btn-danger');

    $('.add-new-user-dialog').modal({ show : false, keyboard : true, backdrop : true });
    $('.add-new-user-dialog .cancel').html('Cancel');
    $('.add-new-user-dialog .submit').html('Save');
    $('.add-new-user-dialog .submit').addClass('btn-primary');

    $('.add-existing-user-dialog').modal({ show : false, keyboard : true, backdrop : true });
    $('.add-existing-user-dialog .submit').html('Done');
    $('.add-existing-user-dialog .submit').addClass('btn-primary');

    function addNewUser() {
        var user = user_controller.getUserFromForm();

        if(user != null) {
            user.roles = ['auditor']; // TODO: this doesn't work yet!
            $('.add-new-user-dialog').modal('hide');
            user_controller.sendCreate(user, function(result) {
                that.updateAuditTeamMembership(audit_team_id, result, 'add', function() {
                    window.location.reload();
                });
            });
        }
    }

    // initUserCreate applies a keycode, but we have additional stuff to do, so override the event
    $('.add-new-user-dialog input').unbind('keydown');
    $('.add-new-user-dialog input').keydown(function(e){
        if(e.keyCode == 13){ // ENTER key
            addNewUser();
            return false;

        }
    });
    $('.add-new-user-dialog .submit').click(addNewUser);

    $('.add-existing-user-dialog .submit').click(function(){
    });

    $('button.audit-team-add-existing-user').click(function() {
        $('.add-existing-user-dialog').modal('show');
    });

    $('button.audit-team-add-new-user').click(function() {
        $('.add-new-user-dialog').modal('show');
    });
}

AuditTeamController.prototype.deleteTeam = function(id) {
    var that = this;
    that.showConfirmation('Are you sure you want to delete this auditor team?', 'Delete Auditor Team', 'Yes', function() {
        that.showLoadingMessage('Deactivating...');
        $.ajax({
            type: 'DELETE',
            url: '/audit-team/' + id
        }).done(function(result) {
            window.location.reload();
        });
    });
};

AuditTeamController.prototype.deactivateTeam = function(id) {
    var that = this;
    that.showConfirmation('Are you sure you want to deactivate this auditor team?', 'Deactivate Auditor Team', 'Yes', function() {
        that.showLoadingMessage('Deactivating...');
        $.ajax({
            type: 'POST',
            url: '/audit-team/' + id + '?state=inactive'
        }).done(function(result) {
            window.location.reload();
        });
    });
};

AuditTeamController.prototype.deleteAssignment = function(id) {
    var that = this;
    that.showConfirmation('Are you sure you want to delete this auditor team assignment?', 'Delete Assignment', 'Yes', function() {
        that.showLoadingMessage('Deleting...');
        $.ajax({
            type: 'DELETE',
            url: '/audit-assignment/' + id
        }).done(function(result) {
            window.location.reload();
        });
    });
};

AuditTeamController.prototype.deactivateAssignment = function(id) {
    var that = this;
    that.showConfirmation('Are you sure you want to deactivate this auditor team assignment?', 'Deactivate Assignment', 'Yes', function() {
        that.showLoadingMessage('Deactivating...');
        $.ajax({
            type: 'POST',
            url: '/audit-assignment/' + id + '?state=inactive'
        }).done(function(result) {
            window.location.reload();
        });
    });
};

AuditTeamController.prototype.createAuditTeam = function() {
    var that = this;
    that.showLoadingMessage('Creating...');
    $.ajax({
        url: '/audit-team',
        type: 'PUT',
        data: {
            name:      $('.audit-team-name-input').val(),
            members:   []
        },
        success: function(data){
            window.location.href = '/audit-team/view/' + data;
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
};

AuditTeamController.prototype.updateAuditTeam = function(audit_team_id)  {
    var that = this;
    that.showLoadingMessage('Saving...');
    $.ajax({
        url: '/audit-team/' + audit_team_id,
        type: 'POST',
        data: {
            name:      $('.audit-team-name-input').val()
        },
        success: function(data){
            window.location.href = '/audit-team/view/' + audit_team_id;
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
};

AuditTeamController.prototype.updateAuditTeamMembership = function(team_id, id, action, callback_success)  {
    var that = this, action_modifier = (action == 'add' ? ' to this team?' : '?');
    that.showConfirmation('Are you sure you want to ' + action + ' this user' + action_modifier, 'Change Membership', action.charAt(0).toUpperCase() + action.slice(1), function() {
        that.showLoadingMessage('Applying...');
        $.ajax({
            url: '/audit-team/member?action=' + action,
            type: 'POST',
            data: {
                id:        team_id,
                memberId:  id
            },
            success: function(data){
                if(callback_success) {
                    callback_success();
                }
            },
            error: function(jqXHR){
                that.showAlert(jqXHR.responseText, 'Error');
            }
        });
    }, function() {
        window.location.reload();
    });
};

AuditTeamController.prototype.onUpdateSuccess = function() {
    this.showAlert('The auditor team has been edited.', 'Success!');
};
