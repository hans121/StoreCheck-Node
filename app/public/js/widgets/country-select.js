var country_select = (function () {

    function init(class_name) {
        $('.' + class_name).select2({
            placeholder: "Select a country",
            formatSelection: formatCountrySelection,
            formatResult: formatCountryResult,
            allowClear: true,
            minimumInputLength: 2,
            ajax: {
                url: "/world/countries",
                dataType: 'json',
                data: function (term, page) {
                    return {
                        name_substring: term, // search term
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
                var id=$(element).val();
                if (id!=="") {
                    $.ajax("/world/countries?code="+id, {
                        dataType: "json"
                    }).done(function(data) {
                        callback(data[0]);
                    });
                }
            }
        });
    }

    function getSelection(className) {
        var widgets = $('.' + className).find('.value-container');
        return { a12: widgets.attr('data-a12'), text: widgets.attr('data-name') };
    }

    function formatCountryResult(country) {
        return country.name;
    }
    function formatCountrySelection(country) {
        return country.name + '<div class="value-container" data-name="' + country.name + '" data-a12="' + country.code + '"></div>';
    }

    return {
        init : init,
        getSelection: getSelection
    };
}(country_select));
