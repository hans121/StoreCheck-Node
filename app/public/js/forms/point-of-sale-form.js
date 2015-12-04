var point_of_sale_form = (function () {

    function init(pageController) {
        $('select.storecheck_candidate').select2({
            placeholder: "Select yes or no",
            allowClear: true
        });

        $('select.distribution_channel').select2({
            placeholder: "Select a distribution channel",
            allowClear: true
        });

        $('select.address-type').select2({
            placeholder: "Select an address type",
            allowClear: true
        });

        $('select.preparation_type').select2({
            placeholder: "Select preparation type",
            allowClear: true
        });

        $('select.mechanization').select2({
            placeholder: "Select yes or no",
            allowClear: true
        });

        admin_area_select.init("admin-area-select");
        country_select.init("country-select");
        state_select.init("state-select", "country-select");
        customer_select.init("customer-select");
        region_of_sales_select.init("region-of-sales-select");
        customer_platform_select.init("customer-platform-select");
        danone_platform_select.init("danone-platform-select");

        this.pageController = pageController;
    }

    function getGeoForPOS(id) {
        if(this.pageController) {
            this.pageController.showLoadingMessage('Geocoding...');
        }
        $.ajax({
            url: '/pos/' + id + '/geocode/init',
            type: 'GET',
            success: function(data){
                window.location.reload();
            },
            error: function(jqXHR){
                if(this.pageController) {
                    this.pageController.showAlert(jqXHR.responseText, 'Error');
                }
            }
        });
    }

    function deleteGeoForPOS(id) {
        if(this.pageController) {
            this.pageController.showLoadingMessage('Deleting Geocode...');
        }
        $.ajax({
            url: '/pos/' + id + '/geocode',
            type: 'DELETE',
            success: function(data){
                window.location.reload();
            },
            error: function(jqXHR){
                if(this.pageController) {
                    this.pageController.showAlert(jqXHR.responseText, 'Error');
                }
            }
        })
    }

    function getGeoForPOSData() {
        var that = this;
        if(this.pageController) {
            this.pageController.showLoadingMessage('Geocoding...');
        }
        $.ajax({
            url: '/pos/geocode',
            type: 'POST',
            data: that.getFromForm(),
            success: function(result){
                that.pageController.hideLoadingMessage();
                if(result.results[0].geometry) {
                    if(result.results[0].geometry.location) {
                        var coord = result.results[0].geometry.location;
                        $('.geocode_container').html('<a href="https://maps.google.com/maps?q=' + coord.lat + ',' + coord.lng + '" target="_blank" style="margin-right: 8px;">' +  coord.lat + '°, ' + coord.lng + '°</a>');
                    }
                }
            },
            error: function(jqXHR){
                if(that.pageController) {
                    that.pageController.showAlert(jqXHR.responseText, 'Error');
                }
            }
        });
    }

    function getFromForm() {
        var country_selection = country_select.getSelection('country-select');
        var state_selection = state_select.getSelection('state-select');
        var customer_selection = customer_select.getSelection('customer-select');
        var region_of_sales_selection = region_of_sales_select.getSelection('region-of-sales-select');
        var admin_area_selection = admin_area_select.getSelection('admin-area-select');
        var customer_platform_selection = customer_platform_select.getSelection('customer-platform-select');
        var danone_platform_selection = danone_platform_select.getSelection('danone-platform-select');

        return {
            company_name:               $('input.input-company-name').val(),
            address1:                   $('input.input-address-1').val(),
            address2:                   $('input.input-address-2').val(),
            city:                       $('input.input-city').val(),
            state:                      state_selection.text,
            postal_code:                $('input.input-postal-code').val(),
            administrative_area:        admin_area_selection.text,
            customer:                   customer_selection.text,
            address_type_code:          $('select.address-type').val(),
            country:                    country_selection.text,
            a12_code:                   country_selection.a12,
            email:                      $('input.input-email').val(),
            account_number:             $('input.input-account-number').val(),
            distribution_channel:       $('select.distribution_channel').val(),
            storecheck_candidate:       $('select.storecheck_candidate').val(),
            mechanization:              $('select.mechanization').val(),
            region_of_sales:            region_of_sales_selection.text,
            preparation_type:           $('select.preparation_type').val(),
            customer_platform:          customer_platform_selection.text,
            danone_platform:            danone_platform_selection.text
        }
    }

    return {
        init : init,
        getGeoForPOSData: getGeoForPOSData,
        getGeoForPOS: getGeoForPOS,
        deleteGeoForPOS: deleteGeoForPOS,
        getFromForm: getFromForm
    };
}(point_of_sale_form));
