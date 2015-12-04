var admin_area_table = (function () {

    var external_interface = {
        init: init
    };

    var table_body_template_def =
        '<table class="table table-bordered table-striped administrative-area-table">' +
            '<thead>' +
                '<th>Code</th>' +
                '<th>Description</th>' +
                '<th>Identity ID</th>' +
                '<th>Active</th>' +
            '</thead>' +
            '<tbody>' +
                '{{~it :customer_platform:index}}' +
                    '<tr>' +
                        '<td>{{=customer_platform.code}}</td>' +
                        '<td>{{=customer_platform.description}}</td>' +
                        '<td>{{=customer_platform.identity_id}}</td>' +
                        '<td>{{=customer_platform.active}}</td>' +
                    '</tr>' +
                '{{~}}' +
            '</tbody>' +
        '</table>' +
        '<div class="pager-container"></div>';

    var table_body_template;

    function init(container) {
        table_body_template = doT.template(table_body_template_def);
        _listAdministrativeAreas(function(customer_platforms) {
            container.html(table_body_template(customer_platforms));
            table_pager_widget.inject(container.find('.pager-container'));
            sortable_table.init(container.find('table'));

        });
    }

    function _listAdministrativeAreas(results_callback) {

        $.ajax({
            url: '/admin-areas?code_substring=e&limit=10000',
            type: 'GET',
            success: function(data) {
                results_callback(data);
            },
            error: function(jqXHR) {
                // TODO: use alert modal
                console.log(jqXHR.responseText, 'Error');
            }
        });
    }

    return external_interface;

}());
