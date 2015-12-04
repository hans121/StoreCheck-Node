var template_create_page = (function () {
    var tc = new TemplateController();

    var selectedTemplateWidget;
    var selectedTemplate;
    var selectedLanguage = "en";

    function init() {

        $(function() {
            $("#template-create-template-list").change(function(evt) {
                selectedTemplateWidget = $(this).find(':selected');
                selectedTemplate = selectedTemplateWidget.val();
                onItemSelected();
            });

            $("#template-create-language-list").change(function(evt) {
                selectedLanguage = $(this).find(':selected').val();
                onItemSelected();
            });

            $('select#template-create-template-list').select2({
                placeholder: "Select a template",
                allowClear: false
            });

            $('select#template-create-language-list').select2({
                placeholder: "Select a language",
                allowClear: false
            });

            selectedTemplateWidget = $(':selected'); // TODO: make more specific
            selectedTemplate = selectedTemplateWidget.val();
            onItemSelected();
        });

        function onItemSelected() {
            var values = selectedTemplate.split(',');

            var container = $('#template-create-data-container');
            container.html('');

            tc.loadLevel5(container, values[0], values[1], selectedLanguage);
        }
    }

    function createTemplate() {
        var values = selectedTemplate.split(','), template_name = $('input.input_name').val();
        var t01_code = selectedTemplateWidget.data('level1-t02');

        if(template_name.trim().length == 0) {
            tc.showAlert('You must enter a name for this Audit Grid Template.', 'Error');
            return;
        }

        tc.showLoadingMessage('Creating...');
        $.ajax({
            type: 'PUT',
            data: tc.generateTemplateFromTable(selectedLanguage, values[0], values[1], values[2], t01_code, template_name),
            url: '/template'
        }).done(function(result) {
            window.location.href = '/templates/view';
        }).error(function(jqXHR) { // , textStatus, errorThrown
            tc.showAlert(jqXHR.responseText, 'Error');
        });
    }

    return {
        init: init,
        createTemplate: createTemplate
    };
}());

$(function(){
    template_create_page.init();
});
