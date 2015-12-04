var table_pager_widget = (function () {

    var external_interface = {
        inject: inject
    };

    var table_body_template_def =
        '<div class="pager text-center" style="width: 100%;">' +
            '<button class="btn btn-sm btn-info first" style="border-radius: 5px;">' +
                '<i class="icon icon-fast-backward" style="padding-left: 0;"></i>' +
            '</button>' +
            '<button class="btn btn-sm btn-info prev" style="border-radius: 5px;">' +
                '<i class="icon icon-backward" style="padding-left: 0;"></i>' +
            '</button>' +
            '<input type="text" disabled style="text-align: center;" class="pagedisplay">' +
            '<button class="btn btn-sm btn-info next" style="border-radius: 5px;">' +
                '<i class="icon icon-forward" style="padding-left: 0;"></i>' +
            '</button>' +
            '<button class="btn btn-sm btn-info last" style="border-radius: 5px;">' +
                '<i class="icon icon-fast-forward" style="padding-left: 0;"></i>' +
            '</button>' +
            '<select class="pagesize" style="width: auto; margin-right: 5px;">' +
                '<option selected value="15">15</option>' +
                '<option value="30">30</option>' +
                '<option value="100">100</option>' +
                '<option value="250">250</option>' +
                '<option value="500">500</option>' +
            '</select>' +
            ' per page' +
        '</div>';

    var table_body_template;

    function inject(container) {
        table_body_template = doT.template(table_body_template_def);
        container.html(table_body_template({}));
    }

    return external_interface;

}());
