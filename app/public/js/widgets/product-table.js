var product_table = (function () {

    var external_interface = {
        init: init
    };

    var default_options = {
        table_sort_order: null
    };

    function init(options_in) {
        var options = $.extend({}, default_options, options_in);

        var properties = [
            'description3',
            'product_code',
            'flavor',
            'default_factory',
            'type',
            'ean_13',
            'organization_description',
            'active'
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
            ajaxUrl : '../products?{filterList:filter}&{sortList:column}&page={page}&pageSize={size}',
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
                new_query += '&fields=_id,description3,product_code,flavor,default_factory,type,ean_13,organization_description,active';

                return url_parsed.attr('path') + '?' + new_query;
            },

            ajaxProcessing: function(data){
                if (data && data.hasOwnProperty('rows')) {
                    var r, row, c, d = data.rows, product,

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
                        product = d[r];

                        // description3
                        var description3 = getSafeValue(product, 'description3');
                        if(description3.length == 0) {
                            row.push('');
                        } else {
                            row.push('<a href="/product/view/' + product._id + '">' + product.description3);
                        }

                        // other columns
                        row.push(getSafeValue(product, 'product_code'));
                        row.push(getSafeValue(product, 'flavor'));
                        row.push(getSafeValue(product, 'default_factory'));
                        row.push(getSafeValue(product, 'type'));
                        row.push(getSafeValue(product, 'ean_13'));

                        // organization
                        var organization_description = getSafeValue(product, 'organization_description');
                        if(organization_description.length == 0) {
                            row.push('');
                        } else {
                            row.push('<a href="/organization/view/' + product.organization + '">' + product.organization_description);
                        }

                        // tool cell
                        row.push(
                            '<span align="right">' +
                                '<a href="/product/view/' + product._id + '" style="color: #00aa00;">' +
                                    '<i class="icon-pencil ui-tooltip" data-placement="bottom" data-original-title="Edit"></i>' +
                                '</a>' +
                            '</span>'
                        );

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
