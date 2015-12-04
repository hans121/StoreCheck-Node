StoreCheckController.prototype = new PageController();
StoreCheckController.prototype.constructor = StoreCheckController;
function StoreCheckController(id, assignment_team_id) {
    var that = this;
    this.formChanged = false;
    this.id = id;
    this.current_sample_type = null;
    this.assignment_team_id = assignment_team_id;

    $('#store-check-form-btn-create').click(function(){ that.createStoreCheck(); });
    $('#store-check-form-btn-save').click(function(){ that.updateStoreCheck(); });
    $('button.close-store-check-btn').click(function() { that.closeStoreCheck(); });
    $('button.reopen-store-check-btn').click(function() { that.openStoreCheck(); });
    $('button.btn-export-samples').click(function() { that.exportStoreCheckSamples(); });

    $('.delete-storecheck-button').click(function(evt) {
        var id = evt.currentTarget.id.substring(7, evt.currentTarget.id.length);
        that.deleteCheck(id);
    });

    $('button.add-sample-type-button').click(function() { $('.product-samples-modal').modal('show'); });
    $('.product-samples-modal button.submit').click(function() {that.addNewSampleSet(); });

    $('.modal-confirm .submit').addClass('btn-danger');


    function formChangeFunction() {
        that.formChanged = true;
    }
    var storecheck_form = $('.form-storecheck');
    storecheck_form.find('textarea').change(formChangeFunction);
    storecheck_form.find('input').change(formChangeFunction);
    storecheck_form.find('select').change(formChangeFunction);

    $('.btn-edit-sales-volume').click(function(evt) {
        $('.sales-volume-modal').modal('show');
        that.current_sample_type = this.getAttribute('data-sample-index');

        $('.sales-volume-modal button.submit').click(function() {
            $('.sales-volume-modal').modal('hide');
            that.showLoadingMessage('Deleting...');
            var sales_volume = $('.sales-volume-modal input').val();
            $.ajax({
                url: '/store-check/' + that.id + '/sample-type/' + that.current_sample_type + '/sales-volume',
                type: 'POST',
                data: {
                    value: sales_volume
                },
                success: function(data){
                    window.location.reload();
                },
                error: function(jqXHR){
                    that.hideLoadingMessage();
                    that.showAlert(jqXHR.responseText, 'Error');
                }
            });
        });
    });
}

StoreCheckController.prototype.sendUpdate = function(onComplete, onError) {
    $.ajax({
        url: '/store-check/' + this.id,
        type: 'POST',
        data: {
            name:      $('.store-check-name-tf').val(),
            reportDate:$('.store-check-report-date-input').val(),
            notes:     $('.store-check-notes-text').val(),
            type:      $('select.store-check-type').val()
        },
        success: function(data){
            onComplete(data);
        },
        error: function(jqXHR){
            onError(jqXHR);
        }
    });
};

StoreCheckController.prototype.sendTeamUpdatesIfExist = function(onComplete, onError) {
    var that = this;
    var team_id = $('select.store-check-audit-team').val();
    if(team_id != "" && team_id != that.assignment_team_id) {
        that.hideLoadingMessage();
        that.showLoadingMessage('Assigning...');
        $.ajax({
            url: '/audit-assignment',
            type: 'PUT',
            data: {
                team_id:            $('select.store-check-audit-team').val(),
                storecheck_id:      that.id
            },
            success: function(data){
                onComplete();
            },
            error: function(jqXHR){
                onError(jqXHR);
            }
        });
    } else if(team_id != that.assignment_team_id) {
        that.hideLoadingMessage();
        that.showLoadingMessage('Unassigning...');
        $.ajax({
            url: '/store-check/' + that.id + '/audit-assignment',
            type: 'DELETE',
            success: function(data){
                onComplete();
            },
            error: function(jqXHR){
                onError(jqXHR);
            }
        });
    } else {
        onComplete();
    }
};

StoreCheckController.prototype.deleteCheck = function(id) {
    var that = this;
    that.showConfirmation('Are you sure you want to delete this store check?', 'Delete Store Check', 'Yes', function() {
        that.showLoadingMessage('Deleting...');
        $.ajax({
            type: 'DELETE',
            url: '/store-check/' + id
        }).done(function(result) {
            window.location.reload();
        });
    });
};

StoreCheckController.prototype.deactivateCheck = function(id) {
    var that = this;
    that.showConfirmation('Are you sure you want to deactivate this store check?', 'Deactivate Store Check', 'Yes', function() {
        that.showLoadingMessage('Deactivating...');
        $.ajax({
            type: 'POST',
            url: '/store-check/' + id + '?state=inactive'
        }).done(function(result) {
            window.location.href = '/store-checks/view';
        });
    });
};

StoreCheckController.prototype.createStoreCheck = function() {
    var that = this;
    this.showLoadingMessage('Creating...');
    var dateInput = $('input.store-check-report-date-input');

    $.ajax({
        url: '/store-check',
        type: 'PUT',
        data: {
            name:      $('.store-check-name-tf').val(),
            reportDate:$('.store-check-report-date-input').val(),
            notes:     $('.store-check-notes-text').val(),
            type:      $('select.store-check-type').val()
        },
        success: function(sc_data){
            var audit_team = $('select.store-check-audit-team').val();
            if(audit_team != undefined && audit_team != "") {
                $.ajax({
                    url: '/audit-assignment',
                    type: 'PUT',
                    data: {
                        team_id:            $('select.store-check-audit-team').val(),
                        storecheck_id:      sc_data
                    },
                    success: function(data){
                        window.location.href = '/store-check/view/' + sc_data;
                    },
                    error: function(jqXHR){
                        that.showAlert('An error has occurred: ' + jqXHR.responseText, 'Error');
                    }
                });
            } else {
                window.location.href = '/store-check/view/' + sc_data;
            }
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
};

StoreCheckController.prototype.updateStoreCheck = function() {
    var that = this;
    this.showLoadingMessage('Saving...');
    this.sendUpdate(function(data_storecheck) {
        that.sendTeamUpdatesIfExist(function() {
            window.location.reload();
        }, function(jqXHR) {
            that.showAlert('An error has occurred: ' + jqXHR.responseText, 'Error');
        });
    }, function(jqXHR) {
        that.hideLoadingMessage();
        that.showAlert(jqXHR.responseText, 'Error');
    });
};

StoreCheckController.prototype.closeStoreCheck = function() {
    var that = this;
    this.showConfirmation('Are you sure you want to archive completed store check?', 'Archive Store Check', 'Yes', function() {
        that.showLoadingMessage('Archiving...');
        $.ajax({
            url: '/store-check/' + that.id + '?state=closed',
            type: 'POST',
            success: function(data){
                window.location.href = '/store-checks/view';
            },
            error: function(jqXHR){
                that.showAlert(jqXHR.responseText, 'Error');
            }
        });
    });
};

StoreCheckController.prototype.openStoreCheck = function() {
    var that = this;
    this.showConfirmation('Are you sure you want to re-open this archived store check?', 'Open Archived Store Check', 'Yes', function() {
        that.showLoadingMessage('Re-opening...');
        $.ajax({
            url: '/store-check/' + that.id + '?state=active',
            type: 'POST',
            success: function(data){
                window.location.href = '/store-checks/view';
            },
            error: function(jqXHR){
                that.showAlert(jqXHR.responseText, 'Error');
            }
        });
    });
};

StoreCheckController.prototype.exportStoreCheckSamples = function() {
    var that = this;
    this.showConfirmation('Are you sure you want to export all samples for this store check?', 'Export Samples for Store Check', 'Yes', function() {
        that.showLoadingMessage('Exporting..');
        $.ajax({
            url: '/store-check/' + that.id + '/samples?action=export',
            type: 'POST',
            success: function(data){
                window.location.reload();
            },
            error: function(jqXHR){
                that.showAlert(jqXHR.responseText, 'Error');
            }
        });
    });
};

StoreCheckController.prototype.duplicateCheck = function(id) {
    var that = this;
    $('.store-check-name-modal').modal('show');
    $('.store-check-name-modal button.submit').click(function() {
        $('.store-check-name-modal').modal('hide');
        $.ajax({
            url: '/store-check/' + id + '?action=duplicate',
            type: 'POST',
            data: {
                name: $('.store-check-name-modal input').val()
            },
            success: function(data){
                window.location.href = '/store-checks/view';
            },
            error: function(jqXHR){
                that.showAlert(jqXHR.responseText, 'Error');
            }
        });
        return false;
    });
};

StoreCheckController.prototype.addNewSampleSet = function() {
    $('.product-samples-modal').modal('hide');

    var that = this;
    var product_id = $('.product-samples-modal').find('select.product').val();
    var template_id = $('.product-samples-modal').find('select.audit-grid-template').val();

    that.showLoadingMessage('Adding...');
    $.ajax({
        url: '/store-check/' + that.id + '/sample-type',
        type: 'PUT',
        data: {
            product_id: product_id,
            template_id: template_id
        },
        success: function(data){

            if(that.formChanged) {
                that.hideLoadingMessage();
                that.showLoadingMessage('Saving...');
                that.sendUpdate(function(data_storecheck) {
                    that.sendTeamUpdatesIfExist(function() {
                        window.location.reload();
                    }, function(jqXHR) {
                        that.showAlert('An error has occurred: ' + jqXHR.responseText, 'Error');
                    });
                }, function(jqXHR) {
                    that.hideLoadingMessage();
                    that.showAlert(jqXHR.responseText, 'Error');
                });
            } else {
                window.location.reload();
            }
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
};

StoreCheckController.prototype.removeSampleType = function(id) {
    var that = this;
    that.showLoadingMessage('Removing...');
    $.ajax({
        url: '/store-check/' + that.id + '/sample-type/' + id,
        type: 'DELETE',
        success: function(data){
            if(that.formChanged) {
                that.hideLoadingMessage();
                that.showLoadingMessage('Saving...');
                that.sendUpdate(function(data_storecheck) {
                    that.sendTeamUpdatesIfExist(function() {
                        window.location.reload();
                    }, function(jqXHR) {
                        that.showAlert('An error has occurred: ' + jqXHR.responseText, 'Error');
                    });
                }, function(jqXHR) {
                    that.hideLoadingMessage();
                    that.showAlert(jqXHR.responseText, 'Error');
                });
            } else {
                window.location.reload();
            }
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
};

StoreCheckController.prototype.exportSampleType = function(template_id, product_id) {
    var that = this;
    window.location.href = '/store-check/' + that.id + '/sample-type/product/' + product_id + '/template/' + template_id + '/export';
    /*
    $.ajax({
        url: ,
        type: 'GET',
        success: function(data){
            //window.location.reload();
        },
        error: function(jqXHR){
            that.showAlert('An error occurred', 'Error');
        }
    });
    */
};
