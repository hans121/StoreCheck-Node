var temperature_settings = (function () {

    function init(container, organization) {
        $.ajax({
            type: 'GET',
            url: '/template/level/5/latest?language=en&company_id=SYS'
        }).done(function(level5_result) {
            $('button.add-temperature-setting').click(function() {
                _addItem(container, organization, level5_result);
                return false;
            });
            _render(container, organization, level5_result);
        }).error(function(jqXHR) {
            window.alert(jqXHR.responseText);
        });

        /*
        $('select.temperatureL0_code').select2({
            placeholder: "Select a template",
            allowClear: false
        });
        */
    }

    function save(container) {
        var data = {};

        // TODO: fill in data
        var selects_t03 = $('select.t03_select');
        if(selects_t03.length > 0) {

            data.temperature_ranges = [];

            for(var i=0; i<selects_t03.length; i++) {
                var select_t03 = selects_t03[i];
                var select_as_selector = $(select_t03);
                var selected_t03_option = select_as_selector.find('option').filter(':selected');

                var this_range = {
                    t03_code: selected_t03_option.data('t03'),
                    code: selected_t03_option.data('code')
                };

                // min non-conform
                var input_nonconf = select_as_selector.parent().find('input.organization-min-nonconform');
                var input_nonconf_l0 = select_as_selector.parent().find('select.organization-min-nonconform-l0 > option:selected');

                this_range.min_nonconform = {
                    value: input_nonconf.val(),
                    linked_code: input_nonconf_l0.data('code')
                };

                // conform
                var input_conf = select_as_selector.parent().find('input.organization-conform');
                var input_conf_l0 = select_as_selector.parent().find('select.organization-conform-l0 > option:selected');

                this_range.conform = {
                    value: input_conf.val(),
                    linked_code: input_conf_l0.data('code')
                };

                // alert
                var input_alert = select_as_selector.parent().find('input.organization-alert');
                var input_alert_l0 = select_as_selector.parent().find('select.organization-alert-l0 > option:selected');

                this_range.alert = {
                    value: input_alert.val(),
                    linked_code: input_alert_l0.data('code')
                };

                // max non-conform
                var input_max_nonconf = select_as_selector.parent().find('input.organization-max-nonconform');
                var input_max_nonconf_l0 = select_as_selector.parent().find('select.organization-max-nonconform-l0 > option:selected');

                this_range.max_nonconform = {
                    value: input_max_nonconf.val(),
                    linked_code: input_max_nonconf_l0.data('code')
                };

                data.temperature_ranges.push(this_range);
            }
        }

        $.ajax({
            url: '/organization/settings/temperature',
            type: 'POST',
            data: data,
            success: function(data_result){
                window.location.reload();
            },
            error: function(jqXHR){
                window.alert(jqXHR.responseText);
            }
        });
    }

    function _addItem(container, organization, level5_items, mayPopulate) {
        var new_html = '', select_L5 = '';

        // get L5 items that have numeric values
        var digit_entries = level5_items.filter(function(level5_item) {
            return level5_item.category_specific == CategorySpecificEnum.NUMERIC_VALUE;
        });

        if(digit_entries.length == 0) {
            return; // TODO: show error?
        }

        // get conformance (moot if not given an initial value or mayPopulate set to false/undefined) TODO: pass in current values optionally
        var minNonConform = "", conform = "", alert_val = "", maxNonConform = "", minNonConformL0 = "", conformL0 = "", alert_valL0 = "", maxNonConformL0 = "", code = "", t03_code = "";
        if(typeof(organization.settings) != 'undefined' && mayPopulate) {
            if(typeof(organization.settings.temperature_ranges) != 'undefined') {
                //get the proposed index
                var proposed_index = $('select.t03_select').length;

                if(proposed_index < organization.settings.temperature_ranges.length) {
                    minNonConform = organization.settings.temperature_ranges[proposed_index].min_nonconform.value;
                    conform = organization.settings.temperature_ranges[proposed_index].conform.value;
                    alert_val = organization.settings.temperature_ranges[proposed_index].alert.value;
                    maxNonConform = organization.settings.temperature_ranges[proposed_index].max_nonconform.value;

                    minNonConformL0 = organization.settings.temperature_ranges[proposed_index].min_nonconform.linked_code;
                    conformL0 = organization.settings.temperature_ranges[proposed_index].conform.linked_code;
                    alert_valL0 = organization.settings.temperature_ranges[proposed_index].alert.linked_code;
                    maxNonConformL0 = organization.settings.temperature_ranges[proposed_index].max_nonconform.linked_code;

                    code = organization.settings.temperature_ranges[proposed_index].code;
                    t03_code = organization.settings.temperature_ranges[proposed_index].t03_code;
                }
            }
        }

        // build a select widget from the result

        select_L5 += '<select class="t03_select">';
        digit_entries.forEach(function(entry) {
            select_L5 += '<option data-t03="' + entry.t03_code + '" data-code="' + entry.code + '"' +
                (code == entry.code && t03_code == entry.t03_code ? ' selected>' : '>') +
                entry.t03_code + ' ' + entry.description2 + '</option>';
        });
        select_L5 += '</select>';

        // add the controls

        var nonConformOptions = _buildL0ItemOptionString(level5_items, minNonConformL0);
        var conformOptions = _buildL0ItemOptionString(level5_items, conformL0);
        var alertOptions = _buildL0ItemOptionString(level5_items, alert_valL0);
        var maxNonConformOptions = _buildL0ItemOptionString(level5_items, maxNonConformL0);

        new_html +=
            '<div class="well">' +
                '<button class="pull-right btn btn-xs btn-danger remove-settings"><i class="icon-remove" style="padding-left: 0;"></i></button>' +
                select_L5 +
                '<hr>' +
                '<div class="form-group">' +
                    '<label class="control-label col-sm-4 col-md-2"></label>' +
                    '<label class="control-label col-sm-4 col-md-5" style="text-align: center;">Temperature</label>' +
                    '<label class="control-label col-sm-4 col-md-5" style="text-align: center;">L0 Code</label>' +
                '</div>' +

                '<div class="form-group">' +
                    '<label class="control-label col-sm-4 col-md-2">Min Non-Conform</label>' +
                    '<div class="col-sm-4 col-md-5">' +
                        '<input class="form-control organization-min-nonconform" type="text" name="min_non_conform" value="' + minNonConform + '">' +
                    '</div>' +
                    '<div class="col-sm-4 col-md-5">' +
                        '<select style="padding: 0;" class="form-control organization-min-nonconform-l0 l0-select">' +
                            nonConformOptions +
                        '</select>' +
                    '</div>' +
                '</div>' +

                '<div class="form-group">' +
                    '<label class="control-label col-sm-4 col-md-2">Conform</label>' +
                    '<div class="col-sm-4 col-md-5">' +
                        '<input class="form-control organization-conform" type="text" name="conform" value="' + conform + '">' +
                    '</div>' +
                    '<div class="col-sm-4 col-md-5">' +
                        '<select style="padding: 0;" class="form-control organization-conform-l0 l0-select">' +
                            conformOptions +
                        '</select>' +
                    '</div>' +
                '</div>' +

                '<div class="form-group">' +
                    '<label class="control-label col-sm-4 col-md-2">Alert</label>' +
                    '<div class="col-sm-4 col-md-5">' +
                        '<input class="form-control organization-alert" type="text" name="alert" value="' + alert_val + '">' +
                    '</div>' +
                    '<div class="col-sm-4 col-md-5">' +
                        '<select style="padding: 0;" class="form-control organization-alert-l0 l0-select">' +
                            alertOptions +
                        '</select>' +
                    '</div>' +
                '</div>' +

                '<div class="form-group">' +
                    '<label class="control-label col-sm-4 col-md-2">Max Non-Conform</label>' +
                    '<div class="col-sm-4 col-md-5">' +
                        '<input class="form-control organization-max-nonconform" type="text" name="max-nonconform" value="' + maxNonConform + '">' +
                    '</div>' +
                    '<div class="col-sm-4 col-md-5">' +
                        '<select style="padding: 0;" class="form-control organization-max-nonconform-l0 l0-select">' +
                maxNonConformOptions +
                        '</select>' +
                    '</div>' +
                '</div>' +

            '</div>';
        $(container).append(new_html);

        $('button.remove-settings').unbind('click');
        $('button.remove-settings').click(function(evt) {
            var well = evt.currentTarget.parentElement;
            well.parentElement.removeChild(well);
            return false;
        });

        $('select.l0-select').select2({
            allowClear: true
        });
    }

    function _buildL0ItemOptionString(level5_items, selected_item) {
        if(typeof(level5_items) == 'undefined' || level5_items == null) {
            return;
        }

        var optionString = '<option></option>';

        level5_items.forEach(function(level5_item) {
            if(level5_item.category_specific == CategorySpecificEnum.LIST_CHOICES ||
                level5_item.category_specific == CategorySpecificEnum.LIST_MULTIPLE_CHOICES ||
                level5_item.category_specific == CategorySpecificEnum.RADIO_CHOICES) {

                level5_item.children.forEach(function(answer) {
                    optionString += '<option data-code="' + answer.code + '"' + (selected_item == answer.code ? ' selected>' :'>') + answer.text + '</option>'
                });
            }
        });
        return optionString;
    }

    function _render(container, organization, level5_items) {
        if(typeof(level5_items) == 'undefined' || level5_items == null) {
            return;
        }

        var digit_entries = level5_items.filter(function(level5_item) {
            return level5_item.category_specific == CategorySpecificEnum.NUMERIC_VALUE;
        });

        if(digit_entries.length == 0) {
            return;
        }

        // TODO: render organization temperature settings!
        if(typeof(organization) != 'undefined' && typeof(organization.settings) != 'undefined' && typeof(organization.settings.temperature_ranges) != 'undefined') {
            for(var i=0; i<organization.settings.temperature_ranges.length; i++) {
                _addItem(container, organization, level5_items, true);
            }
        }
        // That is, call _addItem the correct number of times, passing the settings item or something

        /*
            .form-group
                label.control-label.col-sm-2 Min Non-Conform
                .col-sm-4
                    input.form-control.organization-min-nonconform(type='text', name='min_non_conform', value=minNonConform)
                label.control-label.col-sm-2 Conform
                .col-sm-4
                    input.form-control.organization-conform(type='text', name='conform', value=conform)
            .form-group
                label.control-label.col-sm-2 Max Alert
                .col-sm-4
                    input.form-control.organization-alert(type='text', name='alert', value=alert)
                label.control-label.col-sm-2 Max Non-Conform
                .col-sm-4
                    input.form-control.organization-max-nonconform(type='text', name='max_non_conform', value=maxNonConform)
            .form-actions
                .pull-right
                    button(type='button', onclick='window.history.back();').btn.btn-warning Cancel
                    button(type='button').save-organization-settings.btn.btn-primary Save
         */
    }

    return {
        init : init,
        save: save
    };
}(temperature_settings));
