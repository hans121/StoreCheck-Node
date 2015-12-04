var excipio_exports_page = (function () {
    var pc;

    function init() {
        pc = new PageController();

        $('.clear-button').click(function() {
            pc.showConfirmation('Are you sure you want to delete all export log entries?  This cannot be undone.', 'Confirm Deletion', 'Yes', function() {
                $.ajax({
                    url: '/admin/excipio-exports',
                    type: 'DELETE',
                    success: function (data) {
                        window.location.reload();
                    },
                    error: function (jqXHR) {
                        sc.showAlert(jqXHR.responseText, 'Error');
                    }
                });
            });
            return false;
        });

        excipio_exports_table.init($('table'));
    }

    return {
        init: init
    };
}());

$(function() {
    excipio_exports_page.init();
});