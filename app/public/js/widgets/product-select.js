var product_select = (function () {

    function init(class_name, endpoint) {
        if(!endpoint || endpoint.length == 0) {
            endpoint = '/products';
        }
        $('.' + class_name).select2({
            placeholder: "Select a product",
            formatSelection: formatProductSelection,
            formatResult: formatProductResult,
            allowClear: true,
            minimumInputLength: 0,
            ajax: {
                url: endpoint,
                dataType: 'json',
                data: function (term, page) {
                    return {
                        'filter[description3]': term,
                        'sort[description3]': 1,
                        'page': 0,
                        'pageSize': 20
                    };
                },
                results: function (data, page) { // parse the results into the format expected by Select2.

                     if(typeof(data) == 'undefined' || typeof(data.rows) == 'undefined' || data.rows.length == 0) {
                        return {results: []};
                     }

                     data.rows.forEach(function(item) {
                         item.id = item._id;
                         item.text = item.description3;
                     });
                     return {results: data.rows};
                }
            },
            initSelection: function(element, callback) {
                callback({name: $(element).val()});
            }
        });
    }

    function getSelection(className) {
        var widgets = $('.' + className).find('.value-container');
        var result = widgets.length > 0 ? { code: widgets.attr('data-code'), id: widgets.attr('data-id') } : undefined;
        return result;
    }

    function formatProductResult(product) {
        return product.text + '<br/><div class="product-code">' + product.code + "</div>";
    }

    function formatProductSelection(result) {
        return result.text + '<div class="value-container" data-code="' + result.code + '" data-id="' + result.id + '"></div>';
    }

    return {
        init : init,
        getSelection: getSelection
    };
}());
