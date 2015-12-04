var sample_table_ajax_control = (function () {

    var external_interface = {
        initAjax: init
    };

    var properties = [
        '',
        'visit_info.date_of_visit',
        'visit_info.store_check_name',
        'name',
        'visit_info.pos_name',
        'product_info.name',
        'visit_info.auditor_name',
        'best_by_date',
        'batch_code',
        'factory_code',
        'image_count',
        'defects',
        'note',
        'state'
    ];

    var header_details = [];

    //'table.sample-table'
    function init(sample_ids, table, role) {

        _listStorechecks(function(storechecks) { // _id, name pairs
            storechecks.sort(function(a, b) { var as = a.name.toLowerCase(), bs = b.name.toLowerCase(); return (as > bs ? 1 : (as < bs ? -1 : 0)); });
            _listProducts(function(products) {
                products.sort(function(a, b) { var as = a.description3.toLowerCase(), bs = b.description3.toLowerCase(); return (as > bs ? 1 : (as < bs ? -1 : 0)); });

                var storecheck_names = {}, storecheck_regexes = {};
                storechecks.forEach(function(storecheck) {
                    storecheck_names[storecheck._id] = storecheck.name;
                    storecheck_regexes[storecheck.name] = 1
                });

                var product_items = {};
                products.forEach(function(product) {
                    product_items[product.description3] = 1;
                });

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
                    uncheckAllCheckboxes(table);
                    if ($.tablesorter.storage) {
                        var f = $(this).find('.tablesorter-filter').map(function(){
                            return $(this).val() || '';
                        }).get();
                        $.tablesorter.storage(this, 'tablesorter-filters', f);
                    }
                });

                table.tablesorter( {
                    //sortList: typeof(table_sort_order) != 'undefined' ? table_sort_order : [[0,0]],

                    widgets: ["filter", "saveSort"],
                    widgetOptions : {
                        filter_childRows : false,
                        filter_columnFilters : true,
                        filter_cssFilter : '',
                        filter_filteredRow   : 'filtered',
                        filter_formatter : null,
                        filter_hideFilters : false,
                        filter_ignoreCase : true,
                        filter_liveSearch : true,
                        filter_reset : 'button.reset',
                        filter_searchDelay : 500,
                        filter_serversideFiltering: true,
                        filter_startsWith : false,
                        filter_useParsedData : false,
                        filter_functions: {
                            2 : storecheck_regexes,
                            5: product_items,
                            10: {
                                'yes': 1,
                                'no': 1
                            },
                            11: {
                                'defects': 1,
                                'alerts': 1,
                                'defects or alerts': 1,
                                'conform': 1
                            },
                            13: {
                                draft: 1,
                                submitted: 1,
                                validated: 1,
                                released: 1,
                                'to-be-corrected': 1
                            }
                        }
                    },

                    serverSideSorting: true

                }).tablesorterPager({
                    container: $(".pager"),
                    ajaxUrl : '/samples?{filterList:filter}&{sortList:column}&page={page}&pageSize={size}',
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
                        if(typeof(sample_ids) != 'undefined' && sample_ids.length > 0) {
                            new_query += '&idList=' + sample_ids;
                        }

                        new_query += '&fields=_id,name,product_id,template_id,auditor_name,visit_id,visit_info,best_by_date,batch_code,factory_code,non_conform,alerts,product_info,image_count,note,state';

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
                                var sample_values = 'sample_' + sample._id + '_' + sample.template_id + '_' + sample.state;
                                row.push('<input type="checkbox" class="sample_check" id="' + sample_values + '" data-values="' + sample_values + '">');
                                row.push('<a href="/visit/view/' + sample.visit_id + '">' + sample.visit_info.date_of_visit + '</a>');
                                if(typeof(sample.visit_info.store_check_name) == 'undefined') {
                                    row.push('DELETED');
                                } else {
                                    row.push('<a href="/store-check/view/' + sample.visit_info.store_check_id + '">' + sample.visit_info.store_check_name + '</a>');
                                }

                                row.push('<a href="/sample/view/' + sample._id + '">' + sample.name + '</a>');
                                row.push('<div>' + sample.visit_info.pos_name + '</div>');
                                row.push('<a href="/product/view/' + sample.product_id + '">' + sample.product_info.name + '</a>');
                                row.push('<div>' + sample.visit_info.auditor_name + '</div>');
                                row.push('<div>' + sample.best_by_date + '</div>');
                                row.push('<div>' + sample.batch_code + '</div>');
                                row.push('<div>' + sample.factory_code + '</div>');
                                row.push('<div>' + (sample.image_count > 0 ? 'yes' : 'no') + '</div>');

                                // non-conforms
                                var conformance_cell = '';
                                if(typeof(sample.non_conform) != 'undefined' && sample.non_conform.length > 0) {
                                    conformance_cell += sample.non_conform.length;
                                    conformance_cell += '<a href="/sample/view/' + sample._id + '/defects?type=non-conform"><i style="margin-left: 2px; margin-right: 6px; text-shadow: 0 1px 1px #999; color: red" class="icon-remove-sign"></i></a>';
                                }
                                if(typeof(sample.alerts) != 'undefined' && sample.alerts.length > 0) {
                                    conformance_cell += sample.alerts.length;
                                    conformance_cell += '<a href="/sample/view/' + sample._id + '/defects?type=alert"><i style="margin-left: 2px; margin-right: 6px; text-shadow: 0 1px 1px #999; color: yellow" class="icon-exclamation-sign"></i></a>';
                                }
                                row.push(conformance_cell);

                                if(typeof(sample.note) == 'undefined' || sample.note.trim().length == 0) {
                                    row.push('');
                                } else {
                                    row.push('<i class="icon-file-alt ui-popover help-me-widget" style="font-size: 10px; font-weight: normal; margin-left: 0;" data-trigger="hover" data-placement="bottom" data-html="true" data-content="' + sample.note + '" data-original-title="Notes for Sample ' + sample.name + '"></i>');
                                }
                                row.push(sample.state);
                                row.push('<a href="/sample/view/' + sample._id + '"><i class="icon-pencil ui-tooltip" data-placement="bottom" data-original-title="Edit" style="color: #00aa00;"/></a>');

                                rows.push(row); // add new row array to rows array
                            }
                            // in version 2.10, you can optionally return $(rows) a set of table rows within a jQuery object
                            return [ total, rows, headers ];
                        }
                    }
                }).bind('updateComplete', function() {
                    _onTableUpdated();
                });

                $( 'input.selectAll').unbind('change');
                $( 'input.selectAll').on('change', function(evt) {
                    var check_selector = $('tr:visible input.sample_check');
                    if(this.checked) {
                        $('input.sample_check').prop('checked', true);
                        //$('tr.filtered input.sample_check').prop('checked', false);
                    } else {
                        $('input.sample_check').prop('checked', false);
                    }
                    check_selector.trigger("change");
                });

                _onTableUpdated();
            });
        });

        function _onTableUpdated() {
            _waitUntilTableBody(table, function() {
                $(table).find(".ui-popover").popover({});
                _initCheckBoxes(role);
            });
        }

        //$.tablesorter.storage( table[0], 'tablesorter-savesort', '' );
        //$.tablesorter.storage( table[0], 'tablesorter-filters', '' );
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

    // TODO: perhaps move buttons to be part of the sample-table, as the widget depends on it
    function _initCheckBoxes(role) {
        $('table input.sample_check').unbind('change');
        $('table input.sample_check').change(function() {
            var templates = getTemplatesForSelected();
            if(templates.length == 1) {
                $('button.view-grid-btn').css('display', 'inline-block');
            } else if(templates.length > 1) {
                $('button.view-grid-btn').css('display', 'none');
            } else {
                $('button.view-grid-btn').css('display', 'none');
            }

            function containsOnly(types, allowable_types) {
                var foundBadType = false;
                types.forEach(function(type) {
                    if(allowable_types.indexOf(type) == -1) {
                        foundBadType = true;
                    }
                });
                return !foundBadType;
            }

            var types = getTypesForSelected();

            // no entries are selected
            if(types.length == 0) {
                // hide all sample selection-sensitive buttons
                $('button.sample-selection-btn').css('display', 'none');
            } else {

                if(role == 'auditor') {
                    // auditors have the following buttons:
                    // delete (visible only when drafts are selected)
                    // submit (visible only when drafts are selected or submitted are selected or to-be-corrected are selected)
                    // mark as draft (visible only when drafts are selected or submitted are selected)
                    // view on grid (visible only when two items are selected from the same template)
                    $('button.delete-samples-btn').css('display', types.length == 1 && types[0] == 'draft' ? 'inline-block' : 'none');
                    $('button.submit-samples-btn').css('display', containsOnly(types, ['draft', 'submitted', 'to-be-corrected']) ? 'inline-block' : 'none');
                    $('button.draft-samples-btn').css('display', containsOnly(types, ['draft', 'submitted']) ? 'inline-block' : 'none');

                } else if(role == 'supervisor') {
                    // supervisors have the following buttons:
                    // delete (visible only when drafts are selected)
                    // revert (visible when subnitted are selected)
                    // validate (visible only when validated or submitted are selected)
                    // view on grid (visible only when two items are selected from the same template)
                    $('button.delete-samples-btn').css('display', types.length == 1 && types[0] == 'draft' ? 'inline-block' : 'none');
                    $('button.revert-validate-samples-btn').css('display', types.length == 1 && types[0] == 'submitted' ? 'inline-block' : 'none');
                    $('button.validate-samples-btn').css('display', containsOnly(types, ['validated','submitted']) != -1 ? 'inline-block' : 'none');

                } else if(role == 'CBU') {
                    // CBU users have the following buttons:
                    // delete (never visible, but WAS visible only when drafts are selected)
                    // revert (visible only when released are selected or validated are selected)
                    // view on grid (visible only when two items are selected from the same template)
                    // release (visible when only submitted is selected)
                    //$('button.delete-samples-btn').css('display', types.length == 1 && types[0] == 'draft' ? 'inline-block' : 'none');
                    $('button.revert-validate-samples-btn').css('display', containsOnly(types, ['released', 'validated']) ? 'inline-block' : 'none');
                    $('button.release-samples-btn').css('display', containsOnly(types, ['validated']) ? 'inline-block' : 'none');
                } else if(role == 'admin') {
                    // admins get just about all of the buttons, but still observe proper sample state routes
                    $('button.submit-samples-btn').css('display', containsOnly(types, ['draft', 'submitted', 'to-be-corrected']) ? 'inline-block' : 'none');
                    $('button.draft-samples-btn').css('display', containsOnly(types, ['draft', 'submitted']) ? 'inline-block' : 'none');
                    $('button.revert-validate-samples-btn').css('display', types.length == 1 && types[0] == 'submitted' ? 'inline-block' : 'none');
                    $('button.validate-samples-btn').css('display', containsOnly(types, ['validated','submitted']) != -1 ? 'inline-block' : 'none');
                    $('button.release-samples-btn').css('display', containsOnly(types, ['validated']) ? 'inline-block' : 'none');
                    //$('button.delete-samples-btn').css('display', types.length == 1 && types[0] == 'draft' ? 'inline-block' : 'none');
                }

                $('button.export-samples-btn').css('display', types.length == 1 ? 'inline-block' : 'none');
                $('button.view-grid-btn').css('display', types.length == 1 ? 'inline-block' : 'none'); // TODO: I think this can go away
            }
        });
    }

    function _rebindRowSelectEvent(table) {
        $(table).find(".ui-popover").popover({});
    }

    function _getColumnNameFromIndex(index) {
        return index >= 0 && index < properties.length ? properties[index] : null;
    }

    function uncheckAllCheckboxes(table) {
        var checkboxes = $(table).find('input[type="checkbox"]');
        checkboxes.prop('checked', false);
        checkboxes.trigger("change");
    }

    function getTypesForSelected() {
        var selected = $('input.sample_check:checked');
        var templates = [];
        for(var i=0; i<selected.length; i++) {
            templates.push(selected[i].id.split('_')[3]);
        }
        return templates.filter(function (e, i, a) { return templates.indexOf(e) === i; });
    }

    function getTemplatesForSelected() {
        var selected = $('input.sample_check:checked');
        var templates = [];
        for(var i=0; i<selected.length; i++) {
            templates.push(selected[i].id.split('_')[2]);
        }
        return templates.filter(function (e, i, a) { return templates.indexOf(e) === i; });
    }

    function _listStorechecks(onResults) {
        $.ajax({
            url: '/store-checks?fields=_id,name',
            type: 'GET',
            success: function(data){
                onResults(data);
            },
            error: function(jqXHR){
                // TODO: use alert modal
                console.log(jqXHR.responseText, 'Error');
            }
        });
    }

    function _listProducts(onResults) {
        $.ajax({
            url: '/visits/products?fields=_id,description3',
            type: 'GET',
            success: function(data){
                onResults(data && data.rows ? data.rows : []);
            },
            error: function(jqXHR){
                // TODO: use alert modal
                console.log(jqXHR.responseText, 'Error');
            }
        });
    }

    return external_interface;

}());
