var template_list_page = (function () {
    var tc = new TemplateController();
    var templates = [];
    var table_body_template;

    function init() {
        $('table').tablesorter({
            sortList: [[0,0] ]
        });

        var select_status = $('select.select-status');
        select_status.select2({ allowClear: false });
        select_status.change(function() {
            _applyFilter();
        });

        table_body_template = doT.template(document.getElementById('template_table_row').text);

        tc.showLoadingMessage('Loading...');
        $.ajax({
            type: 'GET',
            url: '/templates'
        }).done(function(result) {
            templates = result;
            tc.hideLoadingMessage();

            _applyFilter();
        }).error(function(jqXHR) { // , textStatus, errorThrown
            tc.showAlert(jqXHR.responseText, 'Error');
        });
    }

    function _applyFilter() {
        var filter = $('select.select-status').val();
        var shown_templates = templates.filter(function(template) {
            return template.state == filter;
        });

        var tableBody = table_body_template(shown_templates);
        var table = $('table.template-table');
        table.find('tbody').html(tableBody);

        $(table).find(".ui-popover").popover({});
        tooltip_wrapper.init(".ui-tooltip");

        $('a.duplicate-template').unbind();
        $('a.duplicate-template').click(function() {
            tc.duplicateTemplate($(this).data('id'));
        });

        $('a.deactivate-template').unbind();
        $('a.deactivate-template').click(function() {
            tc.deleteTemplate($(this).data('id'));
        });

        $('a.reactivate-template').unbind();
        $('a.reactivate-template').click(function() {
            tc.reactivateTemplate($(this).data('id'));
        });
    }

    return {
        init: init
    };
}());

$(function(){
    template_list_page.init();
});
