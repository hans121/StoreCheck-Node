var storecheck_select = (function () {

    function init(class_name) {
        $('.' + class_name).select2({
            placeholder: "Select a storecheck",
            formatSelection: formatStorecheckSelection,
            formatResult: formatStorecheckResult,
            allowClear: true,
            minimumInputLength: 0,
            ajax: {
                url: "/store-checks?fields=_id,name",
                dataType: 'json',
                data: function (term, page) {
                    return {
                        'filters[name]': term,
                        limit: 100
                    };
                },
                results: function (data, page) { // parse the results into the format expected by Select2.
                    if(data != null && data.length > 0) {

                        data.sort(function (a, b) { var as = a.name.toLowerCase(), bs = b.name.toLowerCase(); return (as > bs ? 1 : (as < bs ? -1 : 0)); });
                        data.forEach(function(item) {
                            item.id = item._id;
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
        return { id: widgets.attr('data-id') };
    }

    function formatStorecheckResult(storecheck) {
        return storecheck.name;
    }
    function formatStorecheckSelection(storecheck) {
        return storecheck.name + '<div class="value-container" data-name="' + storecheck.name + '" data-id="' + storecheck._id + '"></div>';
    }

    return {
        init : init,
        getSelection: getSelection
    };
}());
