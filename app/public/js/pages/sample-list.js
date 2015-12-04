var sample_list_page = (function () {
    var sc;

    function init() {
        sc = new SampleController();

        $('button.delete-samples-btn').click(function() {
            sc.showConfirmation('Are you sure you want to delete these samples?', 'Confirm Deletion', 'Yes', function() {
                sc.showLoadingMessage('Deleting...');
                $.ajax({
                    type: 'DELETE',
                    url: '/samples/' + sc.getSelectedIds()
                }).done(function() { // result
                    window.location.reload();
                }).error(function(jqXHR) { // , textStatus, errorThrown
                    sc.showAlert(jqXHR.responseText, 'Error');
                });
            });
        });

        $('button.submit-samples-btn').click(function() {
            var selectedIds = sc.getSelectedIds();
            sc.showConfirmation('Are you sure you want to submit ' + (selectedIds.length > 1 ? 'these samples?' : 'this sample?'), 'Confirm Submission', 'Yes', function() {
                sc.showLoadingMessage('Submitting...');
                $.ajax({
                    type: 'POST',
                    url: '/samples/' + selectedIds + '/state?value=submitted'
                }).done(function() { // result
                    window.location.reload();
                }).error(function(jqXHR) { // , textStatus, errorThrown
                    sc.showAlert(jqXHR.responseText, 'Error');
                });
            });
        });

        $('button.revert-validate-samples-btn').click(function() {
            var selectedIds = sc.getSelectedIds();
            sc.showConfirmation('Are you sure you want to mark ' + (selectedIds.length > 1 ? 'these samples' : 'this sample') + ' as to-be-corrected?', 'Confirm Revert', 'Mark For Correction', function() {
                sc.showLoadingMessage('Reverting...');
                $.ajax({
                    type: 'POST',
                    url: '/samples/' + sc.getSelectedIds() + '/state?value=to-be-corrected'
                }).done(function() { // result
                    window.location.reload();
                }).error(function(jqXHR) { // , textStatus, errorThrown
                    sc.showAlert(jqXHR.responseText, 'Error');
                });
            });
        });

        $('button.validate-samples-btn').click(function() {
            var selectedIds = sc.getSelectedIds();
            sc.showConfirmation('Are you sure you want to validate ' + (selectedIds.length > 1 ? 'these samples?' : 'this sample?'), 'Confirm Validate', 'Yes', function() {
                sc.showLoadingMessage('Submitting...');
                $.ajax({
                    type: 'POST',
                    url: '/samples/' + sc.getSelectedIds() + '/state?value=validated'
                }).done(function() { // result
                    window.location.reload();
                }).error(function(jqXHR) { // , textStatus, errorThrown
                    sc.showAlert(jqXHR.responseText, 'Error');
                });
            });
        });

        $('button.release-samples-btn').click(function() {
            var selectedIds = sc.getSelectedIds();
            sc.showConfirmation('Are you sure you want to release ' + (selectedIds.length > 1 ? 'these samples?' : 'this sample?'), 'Confirm Release', 'Yes', function() {
                sc.showLoadingMessage('Releasing...');
                $.ajax({
                    type: 'POST',
                    url: '/samples/' + sc.getSelectedIds() + '/state?value=released'
                }).done(function() { // result
                    window.location.reload();
                }).error(function(jqXHR) { // , textStatus, errorThrown
                    sc.showAlert(jqXHR.responseText, 'Error');
                });
            });
        });

        $('button.view-grid-btn').click(function() {
            window.location.href = '/samples/' + sc.getSelectedIds() + '/view/grid';
        });

        $('button.export-samples-btn').click(function() {
            window.location.href = '/samples/' + sc.getSelectedIds() + '/export';
        });

        $('button.draft-samples-btn').click(function() {
            sc.showLoadingMessage('Saving...');
            $.ajax({
                type: 'POST',
                url: '/samples/' + sc.getSelectedIds() + '/state?value=draft'
            }).done(function() { // result
                window.location.reload();
            }).error(function(jqXHR) { // , textStatus, errorThrown
                sc.showAlert(jqXHR.responseText, 'Error');
            });
        });

        $('.sample-import').fileupload({
            dataType: 'json',
            success: function (result) { // result, textStatus, jqXHR
                var sample_add_count = 0, sample_update_count = 0, warnings = [];
                result.forEach(function(process_record) {
                    sample_add_count += process_record.samples_added.length;
                    sample_update_count += process_record.samples_updated.length;
                    process_record.warnings.forEach(function(warning) {
                        warnings.push(warning);
                    });
                });

                var message = 'Added ' + sample_add_count + ' samples.';
                message += '<BR>Updated ' + sample_update_count + ' samples.';
                if(warnings.length > 0) {
                    // TODO: append warnings!
                    message += '<BR><BR>' + warnings.length + ' warnings were given: <ul>';

                    warnings.forEach(function(warning) {
                        message += '<li>' + warning + '</li>';
                    });
                    message += '</ul>';
                }
                sc.showLockedAlert(message, 'Import Complete');
            },
            error: function(jqXHR) { // , textStatus, errorThrown
                sc.showAlert(jqXHR.responseText, 'Error');
            }
        });
    }

    return {
        init: init
    };
}());

$(function(){
    sample_list_page.init();
});
