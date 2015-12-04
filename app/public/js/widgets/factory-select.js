var factory_select = (function () {

    function init(class_name) {
        $('.' + class_name).select2({
            placeholder: "Select a factory",
            formatSelection: formatSelection,
            formatResult: formatResult,
            allowClear: true,
            ajax: {
                url: "/factory",
                dataType: 'json',
                data: function (term, page) {
                    return {
                        code: term
                    };
                },
                results: function (data, page) { // parse the results into the format expected by Select2.
                    if(data != null && data.length > 0) {
                        data.forEach(function(item) {
                            item.code = item.code;
                            item.id = item._id;
                        });
                    }
                    // since we are using custom formatting functions we do not need to alter remote JSON data
                    return {results: data};
                }
            },
            initSelection: function(element, callback) {
                callback({code: $(element).val(), id: $(element).attr('data-id')});
            }
        });
    }

    function getSelection(className) {
        var widgets = $('.' + className).find('.value-container');
        return { code: widgets.attr('data-code'), id: widgets.attr('data-id') };
    }

    function formatResult(factory) {
        return factory.code;
    }

    function formatSelection(result) {
        return result.code + '<div class="value-container" data-code="' + result.code + '" data-id="' + result.id + '"></div>';
    }

    return {
        init : init,
        getSelection: getSelection
    };
}(factory_select));
