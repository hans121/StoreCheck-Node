var auditor_select = (function () {

    function init(class_name) {
        $('.' + class_name).select2({
            placeholder: "Select an auditor",
            formatSelection: formatAuditorSelection,
            formatResult: formatAuditorResult,
            allowClear: true,
            minimumInputLength: 0,
            ajax: {
                url: "/visits/auditors",
                dataType: 'json',
                data: function (term, page) {
                    return {
                        'filters[auditor_name]': term,
                        limit: 1000
                    };
                },
                results: function (data, page) { // parse the results into the format expected by Select2.
                    if(data != null && data.length > 0) {
                        data.sort(function (a, b) { var as = a.toLowerCase(), bs = b.toLowerCase(); return (as > bs ? 1 : (as < bs ? -1 : 0)); });

                        var as_structs = [];
                        data.forEach(function(item) {
                            as_structs.push({id: item});
                        });
                        data = as_structs;
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
        return $('input.' + className).val();
    }

    function formatAuditorResult(auditor) {
        return auditor.id;
    }
    function formatAuditorSelection(auditor) {
        return auditor.id;
    }

    return {
        init : init,
        getSelection: getSelection
    };
}());
