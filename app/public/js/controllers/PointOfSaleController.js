PointOfSaleController.prototype = new PageController();
PointOfSaleController.prototype.constructor = PointOfSaleController;
function PointOfSaleController() {
    var that = this;

    $('.pos-edit-form-btn-cancel').click(function() {
        window.location.href="/points-of-sale/view";
    });
    $('.pos-edit-form-btn-save').click(function() {
        that.save();
    });
    $('.pos-edit-form-btn-create').click(function() {
        that.create();
    });
}

PointOfSaleController.prototype.getFromForm = function() {
    return point_of_sale_form.getFromForm();
};

PointOfSaleController.prototype.initEdit = function(id) {
    this.id = id;
};

PointOfSaleController.prototype.save = function(onSuccess) {
    var that = this;

    this.showLoadingMessage('Saving...');
    var data = this.getFromForm();
    data.id = this.id;
    $.ajax({
        url: '/pos/' + that.id,
        type: 'POST',
        data: data,
        success: function(data){
            if(onSuccess) {
                onSuccess(data);
            } else {
                window.location.reload();
            }
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
};

PointOfSaleController.prototype.create = function(onSuccess) {
    var that = this;

    this.showLoadingMessage('Creating...');
    $.ajax({
        url: '/pos',
        type: 'PUT',
        data: this.getFromForm(),
        success: function(data){
            if(onSuccess) {
                onSuccess(data);
            } else {
                window.location.href = '/points-of-sale/view';
            }
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
};

PointOfSaleController.prototype.getGeoForPOS = function(id) {
    var that = this;
    this.showLoadingMessage('Geocoding...');
    $.ajax({
        url: '/pos/' + id + '/geocode/init',
        type: 'GET',
        success: function(data){
            window.location.reload();
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
};

PointOfSaleController.prototype.deleteGeoForPOS = function(id) {
    var that = this;
    this.pageController.showLoadingMessage('Deleting Geocode...');
    $.ajax({
        url: '/pos/' + id + '/geocode',
        type: 'DELETE',
        success: function(data){
            window.location.reload();
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    })
};