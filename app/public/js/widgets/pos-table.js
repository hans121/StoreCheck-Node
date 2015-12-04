var pos_table = (function () {

    var external_interface = {
        init: init
    };

    var default_options = {
        isAdmin: false,
        isCBU: false,
        canDelete: false,
        table_sort_order: null
    };

    function init(options_in) {
        var options = $.extend({}, default_options, options_in);

        var properties = [
            'a59_code',
            'company_name',
            'address1',
            'city',
            'country',
            'a53_code',
            'a50_code'
        ];

        function getSafeValue(val, key) {
            if(typeof(val) == 'undefined' || val == null) {
                return "";
            }
            return val[key];
        }

        //http://mottie.github.io/tablesorter/docs/example-pager.html
        var table_container = $('table');
        table_container.tablesorter( {
            sortList: options.table_sort_order ? options.table_sort_order : [[0,0]],

            widgets: ["filter"],
            widgetOptions : {
                filter_childRows : false,
                filter_columnFilters : true,
                filter_cssFilter : '',
                filter_filteredRow   : 'filtered',
                filter_formatter : null,
                filter_functions : null,
                filter_hideFilters : false,
                filter_ignoreCase : true,
                filter_liveSearch : true,
                filter_reset : 'button.reset',
                filter_searchDelay : 600,
                filter_serversideFiltering: true,
                filter_startsWith : false,
                filter_useParsedData : false
            }

        }).tablesorterPager({
            container: $(".pager"),
            ajaxUrl : '../pos?{filterList:filter}&{sortList:column}&page={page}&pageSize={size}',
            size: 15,
            savePages: false,
            removeRows: true,

            customAjaxUrl: function(table, url) {
                var url_parsed = $.url(url);
                var params = url_parsed.param();

                var new_query = 'pageSize=' + params['pageSize'] + '&page=' + params['page'];
                // column[]
                if(Array.isArray(params.filter)) {
                    params.filter.forEach(function(filter_value, index) {
                        new_query += '&filter[' + _getColumnNameFromIndex(index) + ']=' + encodeURIComponent(filter_value);
                    });
                }
                if(Array.isArray(params.column)) {
                    params.column.forEach(function(sort_value, index) {
                        new_query += '&sort[' + _getColumnNameFromIndex(index) + ']=' + sort_value;
                    });
                }
                if(typeof(sample_ids) != 'undefined' && sample_ids.length > 0) {
                    new_query += '&idList=' + sample_ids;
                }
                new_query += '&fields=_id,a59_code,address1,city,country,a53_code,a50_code';

                return url_parsed.attr('path') + '?' + new_query;
            },

            ajaxProcessing: function(data){
                if (data && data.hasOwnProperty('rows')) {
                    var r, row, c, d = data.rows,

                    // total number of rows (required)
                        total = data.total_records,

                    // array of header names (optional)
                        headers = data.headers,

                    // all rows: array of arrays; each internal array has the table cell data for that row
                        rows = [],

                    // len should match pager set size (c.size)
                        len = d.length;

                    // this will depend on how the json is set up - see City0.json
                    // rows
                    for ( r=0; r < len; r++ ) {
                        row = [];

                        // cells
                        row.push(getSafeValue(d[r], 'a59_code'));
                        row.push(getSafeValue(d[r],'company_name'));
                        row.push(getSafeValue(d[r],'address1'));
                        row.push(getSafeValue(d[r],'city'));
                        if(options.isAdmin) {
                            row.push(getSafeValue(d[r],'country'));
                        }
                        row.push(getSafeValue(d[r],'a53_code'));
                        row.push(getSafeValue(d[r],'a50_code'));

                        var tools_cell = "";
                        if((options.isCBU || options.isAdmin) && typeof(d[r].latitude) == 'undefined') {
                            tools_cell += '<a onclick=pc.getGeoForPOS("' + d[r]._id + '") style="color: #00aa00; margin-right: 8px; cursor: pointer;">';
                            tools_cell += '<i class="icon-globe ui-tooltip" data-placement="bottom" data-original-title="Get location from Google"></i></a>';
                        }

                        if(d[r].source != 'import') {
                            tools_cell += '<a href="/point-of-sale/view/' + d[r]._id + '" style="color: #00aa00;">';
                            tools_cell += '<i class="icon-pencil ui-tooltip" data-placement="bottom" data-original-title="Edit"></i></a>';
                        } else {
                            tools_cell += '<a href="/point-of-sale/view/' + d[r]._id + '" style="color: #00aa00;">';
                            tools_cell += '<i class="icon-search ui-tooltip" data-placement="bottom" data-original-title="View"></i></a>';
                        }

                        if(options.canDelete) {
                            tools_cell += '<a onclick=deletePOS("' + d[r]._id + '") style="margin-left: 5px; color: #aa0000; cursor: pointer;">';
                            tools_cell += '<i class="icon-remove ui-tooltip" data-placement="bottom" data-original-title="Delete POS"></i></a>';
                        }
                        row.push(tools_cell);

                        rows.push(row); // add new row array to rows array
                    }
                    // in version 2.10, you can optionally return $(rows) a set of table rows within a jQuery object
                    return [ total, rows, headers ];
                }
            }
        });

        function _getColumnNameFromIndex(index) {
            return index >= 0 && index < properties.length ? properties[index] : null;
        }
    }

    return external_interface;

}());
