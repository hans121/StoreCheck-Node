var date_range_widget = (function () {

    var template_horizontal_def =
        '<div class="input-group date datepicker from-date pull-left" style="width: 150px; margin-right: 10px;">' +
            '<span class="input-group-addon"> From</span>' +
            '<input class="form-control" placeholder="dd/mm/yyyy" size="16" type="text" value="" style="width: 110px;">' +
            '<span class="add-on calendar-add-on input-group-addon">' +
                '<i class="icon-calendar"></i>' +
            '</span>' +
        '</div>' +
        '<div class="input-group date datepicker to-date pull-left" style="width: 150px;">' +
            '<span class="input-group-addon"> To</span>' +
            '<input class="form-control" placeholder="dd/mm/yyyy" size="16" type="text" value="" style="width: 110px;">' +
            '<span class="add-on calendar-add-on input-group-addon">' +
                '<i class="icon-calendar"></i>' +
            '</span>' +
        '</div>';

    var template_vertical_def =
        '<div class="input-group date datepicker from-date pull-left" style="width: 150px; margin-right: 10px; margin-bottom: 5px;">' +
            '<span class="input-group-addon"> From</span>' +
            '<input class="form-control" placeholder="dd/mm/yyyy" size="16" type="text" value="" style="width: 110px;">' +
            '<span class="add-on calendar-add-on input-group-addon">' +
                '<i class="icon-calendar"></i>' +
            '</span>' +
        '</div>' +
        '<div class="clearfix"></div>' +
        '<div class="input-group date datepicker to-date pull-left" style="width: 150px;">' +
            '<span class="input-group-addon" style="min-width: 59px;"> To</span>' +
            '<input class="form-control" placeholder="dd/mm/yyyy" size="16" type="text" value="" style="width: 110px;">' +
            '<span class="add-on calendar-add-on input-group-addon">' +
                '<i class="icon-calendar"></i>' +
            '</span>' +
        '</div>' +
        '<div class="clearfix"></div>';

    function init(container, options) {
        if(!options || options.orientation == 'horizontal') {
            var template_horizontal = doT.template(template_horizontal_def);
            container.html(template_horizontal());
            return;
        }
        var template_vertical = doT.template(template_vertical_def);
        container.html(template_vertical);
    }

    return {
        init: init
    };

}());