$(function($) {
    var pc = new PageController();

    $('button.btn-clear').click(function() {
        pc.showConfirmation('Are you sure you want to delete all log data?', 'Delete Log Data', 'Yes', function() {
            pc.showLoadingMessage();

            $.ajax({
                type: 'DELETE',
                url: '/admin/logs'
            }).error(function (jqXHR) {
                pc.hideLoadingMessage();
                pc.showAlert(jqXHR.responseText, 'Error');
            }).success(function (result) {
                window.location.reload();
            });
        });
    });

    date_range_widget.init($('.date-range-container'));

    var table_selector = $(".table-container > table");

    function init_date_pickers() {
        var from_datepicker = $('.from-date');
        var to_datepicker = $('.to-date');

        $('.datepicker').datepicker({format: 'mm/dd/yyyy', changeYear: true, autoclose: true});
        //from_datepicker.datepicker('update', start_of_timeframe.format('MM/DD/YYYY'));
        //to_datepicker.datepicker('update', end_of_timeframe.format('MM/DD/YYYY'));

        from_datepicker.on('changeDate', function(ev){
            context.from_date = $('.from-date input').val();

            var current_sort = table_selector[0].config.sortList;
            table_selector.trigger('sorton', [[[0,0]]]);
            table_selector.trigger('sorton', [current_sort]);
        });
        to_datepicker.on('changeDate', function(ev){
            context.to_date = $('.to-date input').val();

            var current_sort = table_selector[0].config.sortList;
            table_selector.trigger('sorton', [[[0,0]]]);
            table_selector.trigger('sorton', [current_sort]);
        });
    }
    init_date_pickers();

    var context = logs_table.init(table_selector);

    clock_widget.init({
        container: $('.clock-widget-container'),
        isUTC: true
    });
});