var state_select = (function () {

    function init(class_name, country_class_name) {
        $('.' + class_name).select2({
            placeholder: "Select a state",
            formatSelection: formatStateSelection,
            formatResult: formatStateResult,
            allowClear: true,
            minimumInputLength: 1,
            ajax: {
                url: "/world/provinces",
                dataType: 'json',
                data: function (term, page) {
                    if(typeof(country_class_name) == 'undefined') {
                        return {
                            name_substring: term, // search term
                            limit: 10
                        };
                    } else {
                        var country_code = country_select.getSelection(country_class_name).a12;
                        return {
                            country_code: country_code,
                            name_substring: term, // search term
                            limit: 10
                        };
                    }
                },
                results: function (data, page) { // parse the results into the format expected by Select2.
                    if(data != null && data.length > 0) {
                        data.forEach(function(item) {
                            item.id = item.name;
                        });
                    }
                    // since we are using custom formatting functions we do not need to alter remote JSON data
                    return {results: data};
                }
            },
            initSelection: function(element, callback) {
                callback({name: $(element).val()});
            }
        });
    }

    function getSelection(className) {
        var widgets = $('.' + className).find('.value-container');
        return { text: widgets.attr('data-name') };
    }

    function formatStateResult(state) {
        return state.name;
    }
    function formatStateSelection(state) {
        return state.name + '<div class="value-container" data-name="' + state.name + '" data-a12="' + state.code + '"></div>';
    }

    return {
        init : init,
        getSelection: getSelection
    };
}(state_select));
