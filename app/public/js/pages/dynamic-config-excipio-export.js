$(function() {
    var sc = new PageController();

    $('select.date-format').val($('select.date-format').data('format'));
    $('select.date-time-format').val($('select.date-time-format').data('format'));

    $('button.save-dynamic-config-btn').click(function() {
        sc.showLoadingMessage();

        var sample_states_to_export = [];
        if($('input.export-validated-samples:checked').length > 0) {
            sample_states_to_export.push('validated');
        }
        if($('input.export-released-samples:checked').length > 0) {
            sample_states_to_export.push('released');
        }

        $.ajax({
            url: '/dynamic-config/excipio-export',
            type: 'POST',
            data: {
                date_format: $("select.date-format").val(),
                datetime_format: $("select.date-time-format").val(),
                image_prefix: $('input.image-prefix').val(),
                pos: {
                    address_1_length: $('input.address-1-length').val(),
                    address_2_length: $('input.address-2-length').val(),
                    address_3_length: $('input.address-3-length').val(),
                    city_length: $('input.city-length').val(),
                    state_length: $('input.state-length').val(),
                    account_number_length: $('input.account-number-length').val(),
                    postal_code_length: $('input.postal-code-length').val(),
                    country_length: $('input.country-length').val(),
                    email2_length: $('input.email2-length').val(),
                    company_name_length: $('input.company-name-length').val(),
                    address_type_code_length: $('input.address-type-code-length').val(),
                    a12_code_length: $('input.a12-code-length').val(),
                    a47_code_length: $('input.a47-code-length').val(),
                    a48_code_length: $('input.a48-code-length').val(),
                    a50_code_length: $('input.a50-code-length').val(),
                    a52_code_length: $('input.a52-code-length').val(),
                    a53_code_length: $('input.a53-code-length').val(),
                    a54_code_length: $('input.a54-code-length').val(),
                    a56_code_length: $('input.a56-code-length').val(),
                    a57_code_length: $('input.a57-code-length').val(),
                    a59_code_length: $('input.a59-code-length').val(),
                    a70_code_length: $('input.a70-code-length').val()
                },
                sample_states_to_export: sample_states_to_export
            },
            success: function(data) {
                window.location.reload();
            },
            error: function(jqXHR) {
                sc.hideLoadingMessage();
                sc.showAlert(jqXHR.responseText, 'Error');
            }
        });
    });
});