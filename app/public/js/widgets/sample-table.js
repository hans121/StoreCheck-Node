var sample_table_control = (function () {

    var external_interface = {
        init: init
    };

    var table_body_template_def =
        '{{~it :sample:index}}' +
            '<tr>' +
                '<td><input type="checkbox" class="sample_check" id="sample_{{=sample._id}}_{{=sample.template_id}}_{{=sample.state}}" data-values="{{=sample._id}}_{{=sample.template_id}}_{{=sample.state}}"></td>' +
                '<td><a href="/visit/view/{{=sample.visit_id}}">{{=sample.visit_info.date_of_visit}}</a></td>' +
                '<td>{{? sample.storecheck}} <a href="/store-check/view/{{=sample.storecheck._id}}">{{=sample.storecheck.name}}</a>{{?}}</td>' +
                '<td><a href="/sample/view/{{=sample._id}}">{{=sample.name}}</a></td>' +
                '<td>{{=sample.visit_info.pos_name}}</td>' +
                '<td><a href="/product/view/{{=sample.product_id}}">{{=sample.product_info.name}}</a></td>' +
                '<td>{{=sample.visit_info.auditor_name}}</td>' +
                '<td>{{=sample.best_by_date}}</td>' +
                '<td>{{=sample.batch_code}}</td>' +
                '<td>{{=sample.factory_code}}</td>' +
                '<td>{{? sample.image_count > 0}}yes{{??}}no{{?}}</td>' +
                '<td>' +
                    '<div title="{{? sample.non_conform !== undefined && sample.non_conform.length > 0}}yes{{??}}no{{?}}">' +
                        '{{? sample.non_conform !== undefined && sample.non_conform.length > 0}}{{=sample.non_conform.length}}{{??}}{{?}}' +
                        '{{? sample.non_conform !== undefined && sample.non_conform.length > 0}}<a href="/sample/view/{{=sample._id}}/defects?type=non-conform"><i style="margin-left: 2px; margin-right: 6px; text-shadow: 0 1px 1px #999; color: red" class="icon-remove-sign"></i></a>{{??}}{{?}}' +
                        '{{? sample.alerts !== undefined && sample.alerts.length > 0}}{{=sample.alerts.length}}{{??}}{{?}}' +
                        '{{? sample.alerts !== undefined && sample.alerts.length > 0}}<a href="/sample/view/{{=sample._id}}/defects?type=alert"><i style="margin-left: 2px; margin-right: 6px; text-shadow: 0 1px 1px #999; color: yellow" class="icon-exclamation-sign"></i></a>{{??}}{{?}}' +
                    '</div>' +
                '</td>' +
                '<td style="text-align: center; padding: 0;">{{? sample.note}}<i class="icon-file-alt ui-popover help-me-widget" style="font-size: 10px; font-weight: normal; margin-left: 0;" data-trigger="hover" data-placement="bottom" data-html="true" data-content="{{=sample.note}}" data-original-title="Notes for Sample {{=sample.name}}"></i>{{?}}</td>' +
                '<td>{{=sample.state}}</td>' +
                '<td style="text-align: right;"><a href="/sample/view/{{=sample._id}}"><i class="icon-pencil ui-tooltip" data-placement="bottom" data-original-title="Edit" style="color: #00aa00;"/></a></td>' +
            '</tr>' +
        '{{~}}';

    var table_body_template;

    function init(container, role, sample_ids) {
        container.find('.status-text').html('loading...');
        table_body_template = doT.template(table_body_template_def);
        listStorechecks(function(storechecks) {
            var path = '/samples';
            if(sample_ids.length > 0) {
                path = '/samples/' + sample_ids;
            }
            $.ajax({
                url: path + '?fields=_id,name,product_id,template_id,auditor_name,visit_id,visit_info,best_by_date,batch_code,factory_code,non_conform,alerts,product_info,image_count,note,state',
                type: 'GET',
                success: function(data){
                    onSamples(container, role, data, storechecks);
                },
                error: function(jqXHR){
                    // TODO: use alert modal
                    console.log(jqXHR.responseText, 'Error');
                }
            });
        });
    }

    function listStorechecks(onResults) {
        $.ajax({
            url: '/store-checks?fields=_id,name', // note: fields ignored
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

    function onSamples(container, role, samples, storechecks) {
        var tableBodyString = "";
        samples.forEach(function(sample) {
            // Correlate samples to storechecks
            // should only samples of active store checks should appear in lists?
            storechecks.forEach(function(storecheck) {
                if(storecheck._id == sample.visit_info.store_check_id) {
                    sample.storecheck = storecheck;
                }
            });
        });

        container.find('.status-text').html('');

        var table = container.find('table');

        table.bind('filterInit', function() {
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
            // when a filter is changed, deselect everything
            uncheckAllCheckboxes(table);
            if ($.tablesorter.storage) {
                var f = $(this).find('.tablesorter-filter').map(function(){
                    return $(this).val() || '';
                }).get();
                $.tablesorter.storage(this, 'tablesorter-filters', f);
            }
        });

        var tableBody = table_body_template(samples);
        $(table).find('tbody').html(tableBody);

        table.tablesorter( {
            sortList: [[1,1] ],
            widgets: ["filter", "saveSort"], //

            headers: {
                0:  { sorter: false, filter: false },
                3:  { filter: false },
                12: { sorter: false, filter: false },
                14: { sorter: false, filter: false }
            },

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
                filter_searchDelay : 300,
                filter_serversideFiltering: false,
                filter_startsWith : false,
                filter_useParsedData : false
            }
        }).tablesorterPager({
            container: $(".pager"),
            savePages: false,
            size: 15
        });

        $('.pager').css('position', '');
        $(table).find(".ui-popover").popover({});
        tooltip_wrapper.init(".ui-tooltip");
        $(table).css('display', '');

        $( 'input.selectAll').on('change', function(evt) {
            var check_selector = $('tr:visible input.sample_check');
            if(this.checked) {
                $('input.sample_check').prop('checked', true);
                $('tr.filtered input.sample_check').prop('checked', false);
            } else {
                $('input.sample_check').prop('checked', false);
            }
            check_selector.trigger("change");
        });

        initCheckBoxes(role);
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

    // TODO: perhaps move buttons to be part of the sample-table, as the widget depends on it
    function initCheckBoxes(role) {
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
                    //$('button.delete-samples-btn').css('display', types.length == 1 && types[0] == 'draft' ? 'inline-block' : 'none');
                }

                $('button.export-samples-btn').css('display', types.length == 1 ? 'inline-block' : 'none');
                $('button.view-grid-btn').css('display', types.length == 1 ? 'inline-block' : 'none'); // TODO: I think this can go away
            }
        });
    }

    return external_interface;

}(sample_table_control));
