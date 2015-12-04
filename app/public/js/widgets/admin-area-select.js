var admin_area_select = (function () {

    function init(class_name) {
        $('.' + class_name).select2({
            placeholder: "Select an admin area",
            formatSelection: formatAdminAreaSelection,
            formatResult: formatAdminAreaResult,
            allowClear: true,
            minimumInputLength: 1,
            ajax: {
                url: "/admin-areas",
                dataType: 'json',
                data: function (term, page) {
                    return {
                        code_substring: term, // search term
                        limit: 10
                    };
                },
                results: function (data, page) { // parse the results into the format expected by Select2.
                    if(data != null && data.length > 0) {
                        data.forEach(function(item) {
                            item.id = item.code;
                        });
                    }
                    // since we are using custom formatting functions we do not need to alter remote JSON data
                    return {results: data};
                }
            },
            initSelection: function(element, callback) {
                callback({code: $(element).val()});
            }
        });
    }

    function getSelection(className) {
        var widgets = $('.' + className).find('.value-container');
        return { text: widgets.attr('data-code') };
    }

    function formatAdminAreaResult(state) {
        return state.code;
    }
    function formatAdminAreaSelection(state) {
        return state.code + '<div class="value-container" data-code="' + state.code + '"></div>';
    }

    return {
        init : init,
        getSelection: getSelection
    };
}(admin_area_select));
