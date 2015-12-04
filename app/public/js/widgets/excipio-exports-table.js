var excipio_exports_table = (function () {

    var external_interface = {
        init: init
    };

    var properties = [
        'timestamp',
        'destination',
        'sftp_retries',
        'details'
    ];

    var header_details = [];

    //'table.sample-table'
    function init(table) {

        var context = {
            from_date: null,
            to_date: null
        };

        table.bind('filterInit', function() {
            $(table).find(".ui-popover").popover({});

            if ($.tablesorter.storage) {
                var f = $.tablesorter.storage(this, 'tablesorter-filters') || [];
                setTimeout(function() {
                    $(table).find('.tablesorter-filter').each(function(i){
                        $(this).val( f[i] );
                    });
                    $(table).trigger('search', [f]);
                }, 0);
            }
        }).bind('filterEnd', function(){
            if ($.tablesorter.storage) {
                var f = $(this).find('.tablesorter-filter').map(function(){
                    return $(this).val() || '';
                }).get();
                $.tablesorter.storage(this, 'tablesorter-filters', f);
            }
        });

        table.tablesorter( {
            sortList: [[0, 1]],

            widgets: ["filter", "saveSort"],
            widgetOptions : {
                filter_childRows : false,
                filter_columnFilters : false,
                filter_cssFilter : '',
                filter_filteredRow   : 'filtered',
                filter_formatter : null,
                filter_hideFilters : true,
                filter_ignoreCase : true,
                filter_liveSearch : true,
                filter_reset : 'button.reset',
                filter_searchDelay : 500,
                filter_serversideFiltering: true,
                filter_startsWith : false,
                filter_useParsedData : false,
                filter_functions: {
                }
            },

            serverSideSorting: true

        }).tablesorterPager({
            container: $(".pager"),
            ajaxUrl : '/admin/excipio-exports?{filterList:filter}&{sortList:column}&page={page}&pageSize={size}',
            size: 100,
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

                new_query += '&fields=_id,destination,timestamp,send_retries,visits';

                return url_parsed.attr('path') + '?' + new_query;
            },

            ajaxProcessing: function(data){
                if (data && data.hasOwnProperty('rows')) {
                    var r, row, c, d = data.rows, sample,

                    // total number of rows (required)
                        total = data.total_records,

                    // array of header names (optional)
                        headers = header_details,

                    // all rows: array of arrays; each internal array has the table cell data for that row
                        rows = [],

                    // len should match pager set size (c.size)
                        len = d.length;

                    // this will depend on how the json is set up - see City0.json
                    // rows
                    for ( r=0; r < len; r++ ) {
                        row = [];
                        sample = d[r];

                        // cells
                        var destination_sans_path = sample.destination.split('/');
                        row.push('<div>' + sample.timestamp + '</div>');
                        row.push('<div>' + destination_sans_path[destination_sans_path.length - 1] + '</div>');
                        row.push('<div>' + sample.sftp_retries + '</div>');
                        row.push('<div style="margin-top: -2px;">' + _getVisitsDetails(sample.visits) + '</div>');

                        rows.push(row); // add new row array to rows array
                    }
                    // in version 2.10, you can optionally return $(rows) a set of table rows within a jQuery object
                    return [ total, rows, headers ];
                }
            }
        }).bind('updateComplete', function() {
            _onTableUpdated();
        });

        // TODO: parameterize
        //var from_input = $('.from-date input');
        //$.tablesorter.filter.bindSearch(table, $('.from-date input'));

        _onTableUpdated();

        function _onTableUpdated() {
            _waitUntilTableBody(table, function() {
                $(table).find(".ui-popover").popover({});
            });
        }

        //$.tablesorter.storage( table[0], 'tablesorter-savesort', '' );
        //$.tablesorter.storage( table[0], 'tablesorter-filters', '' );

        return context;
    }

    function _getVisitsDetails(visits) {
        var text = '';

        visits.forEach(function(visit) {
            text += '<span class="badge"><a href="/store-check/view/' + visit.storecheck_id + '">Store check \"' + visit.storecheck_name + '\"</a></span>&nbsp;&nbsp;';
            text += '<span class="badge"><a href="/visit/view/' + visit.id + '">Visit \"' + visit.pos_name + ' ' + visit.date + '\"</a></span>&nbsp;&nbsp;';

            var sample_id_string = '';
            visit.samples.forEach(function(sample) {
                if(sample_id_string.length > 0) {
                    sample_id_string += ',';
                }
                sample_id_string += sample.id;
            });

            text += '<span class="badge"><a href="/samples/' + sample_id_string + '/view">' + visit.samples.length + ' samples</a></span>&nbsp;&nbsp;';

            text += '<span class="badge"><a href="/organization/view/' + visit.organization + '">' + visit.org_code + ' ' + visit.wwbu + '</a></span>&nbsp;&nbsp;';
        });

        return text;
    }

    function _waitUntilTableBody(table, onBody) {

        // this sucks...
        // the crappy tablesorter lib doesn't throw an event when using the ajax and the dom has changed (initially)
        setTimeout(function() {
            if(table.find('tbody').html().length == 0) {
                _waitUntilTableBody(table, onBody);
                return;
            }
            onBody();
        }, 500);
    }

    function _getColumnNameFromIndex(index) {
        return index >= 0 && index < properties.length ? properties[index] : null;
    }

    return external_interface;

}());
