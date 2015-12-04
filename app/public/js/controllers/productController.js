ProductController.prototype = new PageController();
ProductController.prototype.constructor = ProductController;
function ProductController() {
}

ProductController.prototype.initEdit = function(id) {
    var that = this;

    $('.product-btn-cancel').click(function() {
        window.location.href = '/products/view';
    });
    $('.product-btn-save').click(function() {
        var product_code = $('input.input-product-code').val();
        var description = $('input.input-product-description').val();
        var default_factory = $('input.input-default-factory').val();
        var pickup = $('input.input-pickup').val();
        var flavor = $('input.input-flavor').val();
        var type = $('input.input-type').val();
        var format = $('input.input-format').val();
        var ean_13 = $('input.input-ean13').val();
        var global_brand = $('input.input-global-brand').val();

        that.showLoadingMessage('Saving...');
        $.ajax({
            url: '/product/' + id,
            type: 'POST',
            data: {
                product_code:       product_code,
                description:        description,
                default_factory:    default_factory,
                pickup:             pickup,
                flavor:             flavor,
                type:               type,
                format:             format,
                ean_13:             ean_13,
                global_brand:       global_brand
            },
            success: function(data) {
                window.location.href = '/products/view';
            },
            error: function(jqXHR) {
                that.showAlert('An error has occurred: ' + jqXHR.responseText, 'Error');
            }
        });
    });
};

ProductController.prototype.initCreate = function() {
    var that = this;

    $('#product-create-form-btn-cancel').click(function() {
        window.location.href = '/products/view';
    });
    $('#product-create-form-btn-create').click(function() {
        var product_code = $('input.input-product-code').val();
        var description = $('input.input-product-description').val();
        var default_factory = $('input.input-default-factory').val();
        var pickup = $('input.input-pickup').val();
        var flavor = $('input.input-flavor').val();
        var type = $('input.input-type').val();
        var format = $('input.input-format').val();
        var ean_13 = $('input.input-ean13').val();
        var global_brand = $('input.input-global-brand').val();

        that.showLoadingMessage('Creating...');

        $.ajax({
            url: '/product',
            type: 'POST',
            data: {
                product_code:       product_code,
                description:        description,
                default_factory:    default_factory,
                pickup:             pickup,
                flavor:             flavor,
                type:               type,
                format:             format,
                ean_13:             ean_13,
                global_brand:       global_brand
            },
            success: function(data){
                window.location.href = '/products/view';
            },
            error: function(jqXHR){
                that.showAlert('An error has occurred: ' + jqXHR.responseText, 'Error');
            }
        });
    });
}