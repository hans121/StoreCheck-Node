var customer_platform_select = (function () {

    function init(class_name) {
        $('.' + class_name).select2({
            placeholder: "Select a customer platform",
            formatSelection: formatCustomerPlatformSelection,
            formatResult: formatCustomerPlatformResult,
            allowClear: true,
            minimumInputLength: 1,
            ajax: {
                url: "/customer-platforms",
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

    function formatCustomerPlatformResult(state) {
        return state.code;
    }
    function formatCustomerPlatformSelection(state) {
        return state.code + '<div class="value-container" data-code="' + state.code + '"></div>';
    }

    return {
        init : init,
        getSelection: getSelection
    };
}(customer_platform_select));
