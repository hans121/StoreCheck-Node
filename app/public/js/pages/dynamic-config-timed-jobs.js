$(function() {
    var sc = new PageController();

    var excipio_import_timepicker = $('input.hierarchy-import-time-selection');
    var database_import_timepicker = $('input.database-compact-time-selection');
    var database_backup_timepicker = $('input.database-backup-time-selection');

    var current_scheduled_import_time = moment($('.hierarchy-import-configured-time').data('time'), 'HH:mm');
    var current_scheduled_compact_time = moment($('.database-compact-configured-time').data('time'), 'HH:mm');
    var current_scheduled_backup_time = moment($('.database-backup-configured-time').data('time'), 'HH:mm');

    excipio_import_timepicker.timepicker({
        defaultTime: current_scheduled_import_time != null && current_scheduled_import_time.isValid() ? current_scheduled_import_time.format('hh:mm A') : '02:00 AM',
        minuteStep: 5
    });

    database_import_timepicker.timepicker({
        defaultTime: current_scheduled_compact_time != null && current_scheduled_compact_time.isValid() ? current_scheduled_compact_time.format('hh:mm A') : '02:00 AM',
        minuteStep: 5
    });

    database_backup_timepicker.timepicker({
        defaultTime: current_scheduled_backup_time != null && current_scheduled_backup_time.isValid() ? current_scheduled_backup_time.format('hh:mm A') : '02:00 AM',
        minuteStep: 5
    });

    $('button.save-dynamic-config-btn').click(function() {
        var schedule_auto_import_moment = moment(excipio_import_timepicker.val(), 'h:mm A');
        var schedule_auto_compact_moment = moment(database_import_timepicker.val(), 'h:mm A');
        var schedule_auto_backup_moment = moment(database_backup_timepicker.val(), 'h:mm A');

        sc.showLoadingMessage('Saving');
        _saveImportHierarchiesSettings(schedule_auto_import_moment.hour(), schedule_auto_import_moment.minute(), function(err) {
            if(err) {
                sc.showAlert(err, 'Error');
                return;
            }

            _saveAutoCompactSettings(schedule_auto_compact_moment.hour(), schedule_auto_compact_moment.minute(), function(err) {
                if(err) {
                    sc.showAlert(err, 'Error');
                    return;
                }

                _saveAutoBackupSettings(schedule_auto_backup_moment.hour(), schedule_auto_backup_moment.minute(), function(err) {
                    if(err) {
                        sc.showAlert(err, 'Error');
                        return;
                    }

                    window.location.reload();
                });
            });
        });
    });

    function _saveImportHierarchiesSettings(hour, minute, callback2) {
        $.ajax({
            url: '/dynamic-config/auto-import-hierarchies',
            type: 'POST',
            data: {
                active: $('input.active')[0].checked,
                hour: hour,
                minute: minute
            },
            success: function(data) {
                callback2();
            },
            error: function(jqXHR) {
                callback2(jqXHR.responseText);
            }
        });
    }

    function _saveAutoCompactSettings(hour, minute, callback2) {
        $.ajax({
            url: '/dynamic-config/auto-compact-databases',
            type: 'POST',
            data: {
                active: $('input.auto-compact-active')[0].checked,
                hour: hour,
                minute: minute
            },
            success: function(data) {
                callback2();
            },
            error: function(jqXHR) {
                callback2(jqXHR.responseText);
            }
        });
    }

    function _saveAutoBackupSettings(hour, minute, callback2) {
        $.ajax({
            url: '/dynamic-config/auto-backup-databases',
            type: 'POST',
            data: {
                active: $('input.auto-backup-active')[0].checked,
                hour: hour,
                minute: minute
            },
            success: function(data) {
                callback2();
            },
            error: function(jqXHR) {
                callback2(jqXHR.responseText);
            }
        });
    }
});