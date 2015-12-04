var system_resource_page = (function () {
    var pc;

    function init() {
        pc = new PageController();
        pc.showLoadingMessage();

        $.ajax({
            type: 'GET',
            url: '/admin/system'
        }).error(function(jqXHR) {
            pc.hideLoadingMessage();
            pc.showAlert(jqXHR.responseText, 'Error');
        }).success(function(result) {
            cpu_chart.draw($('.cpu-chart-container'), result.cpu);
            disk_usage_chart.draw($('.disk-usage-container'), result.disk);
            _initDatabasesWidget(result.database);
            system_info_widget.init($('.system-info-container'), result.info);

            pc.hideLoadingMessage();
        });

        $('a.refresh-disk').click(function() {
            pc.showLoadingMessage();

            $.ajax({
                type: 'GET',
                url: '/admin/system'
            }).error(function(jqXHR) {
                pc.hideLoadingMessage();
                pc.showAlert(jqXHR.responseText, 'Error');
            }).success(function(result) {
                disk_usage_chart.draw($('.disk-usage-container'), result.disk);
                pc.hideLoadingMessage();
            });
        });

        // periodically refresh CPU chart
        setInterval(function() {
            //cpu_data, disk_data, database_data, system_info
            $.ajax({
                type: 'GET',
                url: '/admin/system'
            }).error(function(jqXHR) {
            }).success(function(result) {
                cpu_chart.draw($('.cpu-chart-container'), result.cpu);
            });
        }, 25000);
    }

    function _initDatabasesWidget(database_result) {
        var compact_message_prompt = 'Are you sure you want to compact this collection?  This will lock the collection and make dependent features unusable while processing.';

        databases_widget.init($('.database-container'), database_result, function(database, collection) {
            pc.showConfirmation(compact_message_prompt, 'Confirm Compact', 'Yes', function() {
                pc.hideLoadingMessage();
                pc.showLoadingMessage('Compacting');
                $.ajax({
                    type: 'POST',
                    url: '/admin/database/' + database + '/collection/' + collection + '?action=compact'
                }).done(function (result) {
                    pc.showAlert('Collection compacting began!  This may take a while, depending on collection size.', 'In Progress');
                }).error(function (jqXHR) {
                    pc.hideLoadingMessage();
                });
            });
        }, function(database) {
            pc.showConfirmation(compact_message_prompt, 'Confirm Repair', 'Yes', function() {
                pc.hideLoadingMessage();
                pc.showLoadingMessage('Repairing');
                $.ajax({
                    type: 'POST',
                    url: '/admin/database/' + database + '?action=repair'
                }).done(function (result) {
                    pc.showAlert('Database repair began!  This may take a while, depending on database size.', 'In Progress');
                }).error(function (jqXHR) {
                    pc.hideLoadingMessage();
                });
            });
        });
    }
    return {
        init: init
    };
}());

$(function() {
    system_resource_page.init();
});