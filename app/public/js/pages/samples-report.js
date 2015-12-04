var samples_report_page = (function () {
    var pc;
    var data;

    var plot_options, current_results;

    function init() {
        pc = new PageController();

        // init weight controls and handlers
        var weight_select = $('select.weight');
        weight_select.select2({
            allowClear: true,
            placeholder: "Select Conformance"
        });
        weight_select.change(function() {
            _loadReport();
        });

        // init state controls and handlers
        var state_select = $('select.state');
        state_select.select2({
            allowClear: true,
            placeholder: "Select State"
        });
        state_select.change(function() {
            _loadReport();
        });

        // init storecheck controls and handlers
        storecheck_select.init('storecheck-select-widget');
        $('.storecheck-select-widget').change(function() {
            _loadReport();
        });

        // init audito controls and handlers
        auditor_select.init('auditor-select-widget');
        $('.auditor-select-widget').change(function() {
            _loadReport();
        });

        product_select.init('product-select-widget', '/visits/products');
        $('.product-select-widget').change(function() {
            _loadReport();
        });

        $('button.button-export-report').click(function() {
            var contents = $('.reports-container');
            html2canvas([contents[0]], {
                onrendered: function(canvas) {
                    var img = canvas.toDataURL("image/png");
                    window.open(img);
                }
            });
        });

        //_loadReport();

        $(window).resize(function() {
            _renderResults($('.reports-container'));
        });
    }

    function _loadReport() {
        var params = "";

        var storecheck_id = storecheck_select.getSelection('storecheck-select-widget').id;
        if(storecheck_id) {
            params += (params.length > 0 ? "&" : "?") + "storecheck=" + storecheck_id;
        }

        var weight = $('select.weight').val();
        if(weight) {
            params += (params.length > 0 ? "&" : "?") + "weight=" + weight;
        }

        var state = $('select.state').val();
        if(state) {
            params += (params.length > 0 ? "&" : "?") + "state=" + state;
        }

        var auditor = auditor_select.getSelection('auditor-select-widget');
        if(auditor) {
            params += (params.length > 0 ? "&" : "?") + "auditor=" + encodeURIComponent(auditor);
        }

        var product = product_select.getSelection('product-select-widget');
        if(product) {
            params += (params.length > 0 ? "&" : "?") + "product=" + encodeURIComponent(product.code);
        }

        $('button.button-export-report').addClass('hidden');
        $('.report-sample-count-container').html('');
        $('.reports-container').parent().css('display', 'none');

        if(params.length == 0) {
            $(".flot-tooltip").hide();
            $('.parameter-select-container').html('');
            return;
        }

        pc.showLoadingMessage('Loading...');

        $.ajax({
            type: 'GET',
            url: '/report/samples' + params
        }).done(function(result) {
            $('.reports-container').parent().css('display', '');
            current_results = result;
            _onResults('.reports-container', result);

            pc.hideLoadingMessage();
        }).error(function(jqXHR) { // , textStatus, errorThrown
            pc.showAlert(jqXHR.responseText, 'Error');
        });
    }

    function _filterL5(selector_string) {
        // go through current_results and pluck out only those results with the given L5 parameter
        var l5_select = $('.parameter-select-container').find('select.L5');
        var l5_item = l5_select.val();

        if(l5_item.length == 0) {
            _onResults(selector_string, current_results);
            return;
        }

        // value.level5_descriptions[Object.keys(value.level5_descriptions)[0]]
        var filtered_results = {
            sample_count: current_results.sample_count,
            questions: {}
        };

        var value;
        Object.keys(current_results.questions).forEach(function(answer_key, index) {
            value = current_results.questions[answer_key];
            if(value.level5_descriptions[Object.keys(value.level5_descriptions)[0]] == l5_item) {
                filtered_results.questions[answer_key] = value;
            }
        });

        _onResults(selector_string, filtered_results);
    }

    function _onResults(selector_string, results) {
        $('.report-sample-count-container').html(results.sample_count + (results.sample_count != 1 ? ' samples found' : ' sample found'));

        if(results.sample_count == 0) {
            $(selector_string).parent().css('display', 'none');
        }

        var max_value = 0, value, L5_items = [""];
        data = [];

        Object.keys(results.questions).forEach(function(answer_key, index) {
            value = results.questions[answer_key];

            // find best description (favor "en")
            var best_description =  value.descriptions['en'] + ' "' + answer_key + '"', best_label = value.descriptions['en'];
            Object.keys(value.descriptions).forEach(function(description_key) {
                if(typeof(best_description) == 'undefined') {
                    best_description = value.descriptions[description_key] + ' "' + answer_key + '"';
                }
                if(typeof(best_label) == 'undefined') {
                    best_label = value.descriptions[description_key]
                }
            });

            var best_L5 = value.level5_descriptions[Object.keys(value.level5_descriptions)[0]]; //value.level5_descriptions['en'];
            /*
            Object.keys(value.level5_descriptions).forEach(function(L5_description_key) {
                if(typeof(best_L5) == 'undefined') {
                    best_L5 = value.level5_descriptions[L5_description_key] + ' "' + answer_key + '"';
                }
            });
            */
            if(L5_items.indexOf(best_L5) == -1) {
                L5_items.push(best_L5);
            }

            data.unshift({
                label: best_label,
                description: best_description,
                color: _getColorFromConformance(value.conformance),
                data: [[value.count, value.index]],
                samples: value.samples,
                index: value.i
            });

            if(max_value < value.count) {
                max_value = value.count;
            }
        });

        var max_adjustment = Math.max(max_value * 1.1, max_value + 1);

        var parameter_container = $('.parameter-select-container');
        if(parameter_container.children().length == 0) {
            var L5_html = '<select class="L5" style="width: 250px;">';
            L5_items.forEach(function(L5) {
                L5_html += '<option>' + L5 + '</options>';
            });
            L5_html += '</select>';
            parameter_container.html(L5_html);

            var L5_selector = parameter_container.find('.L5');
            L5_selector.select2({
                allowClear: true,
                placeholder: "Select Item"
            });
            L5_selector.unbind('click');
            L5_selector.click(function() {
                _filterL5(selector_string);
            });
        }

        if(data.length == 0) {
            $(".flot-tooltip").hide();
            $(selector_string).css('display', 'none' );
            return;
        }

        data.sort(function(a, b) {
            return b.index - a.index;
        });

        // update the internal indices to match the proper sort order
        data.forEach(function(item, index) {
            item.data[0][1] = index;
        });

        plot_options = {
            series: {
                stack: 1,
                bars: {
                    show: true,
                    barWidth: 0.75,
                    align: "center",
                    horizontal: true,
                    fill:1,
                    numbers: {
                        show: true,
                        xAlign: function(x) { return x + 1; }
                    }
                }
            },
            grid: {
                hoverable: true,
                clickable: true
            },
            xaxis: {
                tickDecimals: 0,
                max: max_adjustment,
                min: 0
            },
            yaxis: {
                tickDecimals: 0,
                tickSize: 1,
                min: -1,
                max: data.length,

                tickFormatter: function(val, axis) {
                    return data[val] ? data[val].label : "";
                }
            },
            legend: {
                show: false
            }
        };

        _renderResults($(selector_string));
    }

    // TODO: onclick, redirect to /defects/type/view/:defectList and make sure we use code for the defects!

    function _renderResults(container) {

        // set height to something like 17-18 pixels per result TODO: find more solid way to do this
        container.html('');
        container.css('height', data.length * 28 + 40 );
        container.css('display', '' );
        $(".flot-tooltip").hide();

        var plot = $.plot(container, data, plot_options);

        container.unbind("plothover");
        container.bind("plothover", function (event, pos, item) {
            if(item) {
                var x = item.datapoint[0], y = item.datapoint[1];

                $(".flot-tooltip").html(item.series.description + " (" + x + ")")
                    .css({top: item.pageY+10, left: item.pageX / 2})
                    .fadeIn(200);
            } else {
                $(".flot-tooltip").hide();
            }
        });

        container.unbind("plotclick");
        container.bind("plotclick", function (event, pos, item) {
            if(item) {
                if(item.series) {
                    var idString = "";
                    item.series.samples.forEach(function(sample) {
                        idString += (idString.length > 0 ? "," : "") + sample;
                    });

                    window.location.href = '/samples/' + idString + '/view';
                }
                //$("#clickdata").text(" - click point " + item.dataIndex + " in " + item.series.label);
                //plot.highlight(item.series, item.datapoint);
            }
        });

        $('button.button-export-report').removeClass('hidden');
    }

    function _getColorFromConformance(conformance) {
        if(conformance == 'A') {
            return 'green';
        } else if(conformance == 'B') {
            return 'yellow';
        }
        return 'red';
    }

    return {
        init: init
    };
}());

$(function(){
    samples_report_page.init();
});
