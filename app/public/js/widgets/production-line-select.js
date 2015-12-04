var production_line_select = (function () {

    function init(class_name, factory_class_name) {
        $('.' + class_name).select2({
            placeholder: "Select a production line",
            formatSelection: formatSelection,
            formatResult: formatResult,
            allowClear: true,
            ajax: {
                url: '/production-line',
                dataType: 'json',
                data: function (term, page) {
                    var query = {
                        code: term
                    };
                    // comment to not filter production lines based on the selected factory
                    var factory = factory_select.getSelection(factory_class_name);
                    if(factory.code) {
                        query.parent = {
                            code: factory.code // encode uri component?
                        }
                    }
                    return query;
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

    function formatResult(production_line) {
        return production_line.code;
    }

    function formatSelection(result) {
        return result.code + '<div class="value-container" data-code="' + result.code + '" data-id="' + result.id + '"></div>';
    }

    return {
        init : init,
        getSelection: getSelection
    };
}(production_line_select));
