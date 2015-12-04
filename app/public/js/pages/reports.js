function loadType(type, data_source, data_options) {
    if(type != 'defects' && type != 'alerts') {
        window.alert('unrecognized type: ' + type);
        return;
    }
    var defect_time_param = $('select.defect-timeframe').val();

    $.ajax({
        url: '/report/' + type + '/item' + (defect_time_param.length > 0 ? '?from=' + defect_time_param : ''),
        type: 'GET',
        success: function(pos_summary){
            defects_by_product_chart.draw($('.global_defects_by_product_chart'), pos_summary, type);
            defects_by_item_chart.draw($('.global_defects_by_item_chart'),pos_summary, type);
        },
        error: function(jqXHR){
            // TODO: show "no data" or something
        }
    });

    $('.global_defects_by_pos_chart').html('Loading...');

    $.ajax({
        url: '/report/' + type + '/pos' + (defect_time_param.length > 0 ? '?from=' + defect_time_param : ''),
        type: 'GET',
        success: function(pos_summary){
            defects_by_point_of_sale_chart.draw($('.global_defects_by_pos_chart'), pos_summary, type);

            //$('.global_defects_by_pos_map').html('');
            //defects_by_point_of_sale_map.draw($('.global_defects_by_pos_map'),pos_summary);

            data_source.load(pos_summary, data_options);
        },
        error: function(jqXHR){
            // TODO: show "no data" or something
        }
    });

    $.ajax({
        url: '/report/' + type + '/visit' + (defect_time_param.length > 0 ? '?from=' + defect_time_param : ''),
        type: 'GET',
        success: function(visit_summary) {
            defects_by_visit_chart.draw($('.global_defects_by_visit_chart'), visit_summary, type);
        },
        error: function(jqXHR){
            // TODO: show "no data" or something
        }
    });
}

/*
function loadAlerts(data_source, data_options) {
    var alert_time_widget = $('select.alert-timeframe');

    if(alert_time_widget.length > 0) {
        var alert_time_param = $('select.alert-timeframe').val();

        $.ajax({
            url: '/report/alerts/item' + (alert_time_param.length > 0 ? '?from=' + alert_time_param : ''),
            type: 'GET',
            success: function(pos_summary){
                alerts_by_product_chart.draw($('.global_alerts_by_product_chart'), pos_summary);
                alerts_by_item_chart.draw($('.global_alerts_by_item_chart'),pos_summary);
            },
            error: function(jqXHR){
                // TODO: show "no data" or something
            }
        });

        $.ajax({
            url: '/report/alerts/pos' + (alert_time_param.length > 0 ? '?from=' + alert_time_param : ''),
            type: 'GET',
            success: function(pos_summary){
                alerts_by_point_of_sale_chart.draw($('.global_alerts_by_pos_chart'), pos_summary);

                $('.global_alerts_by_pos_map').html('');
                alerts_by_point_of_sale_map.draw($('.global_alerts_by_pos_map'),pos_summary);

                if(data_source) {
                    data_source.load(pos_summary, data_options);
                }
            },
            error: function(jqXHR){
                // TODO: show "no data" or something
            }
        });

        $.ajax({
            url: '/report/alerts/visit' + (alert_time_param.length > 0 ? '?from=' + alert_time_param : ''),
            type: 'GET',
            success: function(visit_summary) {
                alerts_by_visit_chart.draw($('.global_alerts_by_visit_chart'), visit_summary);
            },
            error: function(jqXHR){
                // TODO: show "no data" or something
            }
        });
    }
}
*/

var GlobeDataSource = function(viewer) {
    // private declarations
    this._name = "TODO - ENTER NAME";
    this._entityCollection = new Cesium.EntityCollection();
    this._changed = new Cesium.Event();
    this._error = new Cesium.Event();
    this._isLoading = false;
    this._loading = new Cesium.Event();
    this._selectedEntity = undefined;
    this._viewer = viewer;

    this._minHeight = 300000.0;
    this._maxHeight = 1000000.0;

    var that = this;

    // If the mouse is over the billboard, change its scale and color
    var highlightBarHandler = new Cesium.ScreenSpaceEventHandler(this._viewer.scene.canvas);
    highlightBarHandler.setInputAction(
        function (movement) {
            var pickedObject = that._viewer.scene.pick(movement.endPosition);
            if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
                if (Cesium.defined(pickedObject.id.nationData)) {
                    //sharedObject.dispatch.nationMouseover(pickedObject.id.nationData, pickedObject);
                    //healthAndWealth.selectedEntity = pickedObject.id;
                }
            }
        },
        Cesium.ScreenSpaceEventType.MOUSE_MOVE
    );
};


Object.defineProperties(GlobeDataSource.prototype, {
    name : {
        get : function() {
            return this._name;
        }
    },
    clock : {
        get : function() {
            return this._clock;
        }
    },
    entities : {
        get : function() {
            return this._entityCollection;
        }
    },
    selectedEntity : {
        get : function() {
            return this._selectedEntity;
        },
        set : function(e) {
            if (Cesium.defined(this._selectedEntity)) {
                var entity = this._selectedEntity;
                // TODO: colorScale without d3!!
                //entity.polyline.material.color = new Cesium.ConstantProperty(Cesium.Color.fromCssColorString(this._colorScale(entity.region)));
            }
            if (Cesium.defined(e)) {
                e.polyline.material.color = new Cesium.ConstantProperty(Cesium.Color.fromCssColorString('#00ff00'));
            }
            this._selectedEntity = e;
        }
    },
    /**
     * Gets a value indicating if the data source is currently loading data.
     * @memberof HealthAndWealthDataSource.prototype
     * @type {Boolean}
     */
    isLoading : {
        get : function() {
            return this._isLoading;
        }
    },
    /**
     * Gets an event that will be raised when the underlying data changes.
     * @memberof HealthAndWealthDataSource.prototype
     * @type {Event}
     */
    changedEvent : {
        get : function() {
            return this._changed;
        }
    },
    /**
     * Gets an event that will be raised if an error is encountered during
     * processing.
     * @memberof HealthAndWealthDataSource.prototype
     * @type {Event}
     */
    errorEvent : {
        get : function() {
            return this._error;
        }
    },
    /**
     * Gets an event that will be raised when the data source either starts or
     * stops loading.
     * @memberof HealthAndWealthDataSource.prototype
     * @type {Event}
     */
    loadingEvent : {
        get : function() {
            return this._loading;
        }
    }
});

GlobeDataSource.prototype.load = function(data, options_in) {
    if (!Cesium.defined(data)) {
        throw new Cesium.DeveloperError("data must be defined.");
    }
    var that = this;

    var default_options = {
        onHover: function(data_item, ui_item) {

        },
        onClick: function(data_item, ui_item) {

        }
    };

    var options = $.extend({}, default_options, options_in);

    var ellipsoid = this._viewer.scene.globe.ellipsoid;

    this._setLoading(true);

    //It's a good idea to suspend events when making changes to a
    //large amount of entities.  This will cause events to be batched up
    //into the minimal amount of function calls and all take place at the
    //end of processing (when resumeEvents is called).

    that._viewer.scene.primitives.destroyPrimitives = false;
    that._viewer.scene.primitives.removeAll();

    var polylineCollection = new Cesium.PolylineCollection();

    var pos_record, summary = data.points_of_sale_summary;

    // do some calculations
    var max = null, min = null, lat_total = 0, lon_total = 0, pos_count = Object.keys(summary).length;
    Object.keys(summary).forEach(function(pos_key) {
        pos_record = summary[pos_key];

        max = (max ? max : pos_record.count);
        min = (min ? min : pos_record.count);

        max = Math.max(pos_record.count, max);
        min = Math.min(pos_record.count, min);

        if(typeof(pos_record.latitude) != 'undefined' && typeof(pos_record.longitude) != 'undefined') {
            lat_total += pos_record.latitude;
            lon_total += pos_record.longitude;
        }
    });

    // add the entities
    var count_difference = (max - min), height_difference = (this._maxHeight - this._minHeight);
    Object.keys(summary).forEach(function(pos_key) {
        pos_record = summary[pos_key];

        if(pos_record["latitude"] && pos_record["longitude"]) {

            var height = that._maxHeight;

            if(count_difference > 0 && typeof(pos_record.count) != 'undefined') {
                height = ((pos_record.count - min) / count_difference) * (height_difference) + that._minHeight;
            } else if(typeof(pos_record.count) == 'undefined') {
                height = 0;
            }

            var widePolyline = polylineCollection.add({
                positions: ellipsoid.cartographicArrayToCartesianArray([
                    Cesium.Cartographic.fromDegrees(pos_record["longitude"], pos_record["latitude"], 0.0),
                    Cesium.Cartographic.fromDegrees(pos_record["longitude"], pos_record["latitude"], height)
                ]),
                width: 5,
                id: pos_key
            });

            // Set a polyline's width
            var outlineMaterial = Cesium.Material.fromType('PolylineOutline');
            outlineMaterial.uniforms.outlineWidth = 3.0;
            outlineMaterial.uniforms.outlineColor = new Cesium.Color(0.0, 0.0, 0.0, 1.0);
            outlineMaterial.uniforms.color = Cesium.Color.fromCssColorString("#FF0000");

            /*
            var glowMaterial = Cesium.Material.fromType(Cesium.Material.PolylineGlowType, {
                glowPower : 0.25,
                color : new Cesium.Color(1.0, 0.5, 0.0, 1.0)
            });
            */

            widePolyline.material = outlineMaterial;
        }
    });
    var polylines = that._viewer.scene.primitives.add(polylineCollection);

    this.flyTo(lat_total / pos_count, lon_total / pos_count);

    var highlightBarHandler = new Cesium.ScreenSpaceEventHandler(this._viewer.scene.canvas);
    highlightBarHandler.setInputAction(
        function (movement) {
            var pickedObject = that._viewer.scene.pick(movement.endPosition);
            if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
                if (Cesium.defined(summary[pickedObject.id])) {
                    options.onHover(summary[pickedObject.id], pickedObject);
                    return;
                }
            }
            options.onHover(null, null);
        },
        Cesium.ScreenSpaceEventType.MOUSE_MOVE
    );

    var clickHandler = new Cesium.ScreenSpaceEventHandler(this._viewer.scene.canvas);
    clickHandler.setInputAction(
        function (movement) {
            var pickedObject = that._viewer.scene.pick(movement.position);

            if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
                options.onClick(summary[pickedObject.id], pickedObject);
            }
        },
        Cesium.ScreenSpaceEventType.LEFT_CLICK
    );

    this._setLoading(false);
};

GlobeDataSource.prototype.flyTo = function(lat, lon) {
    var ellipsoid = this._viewer.scene.globe.ellipsoid;

    var destination = Cesium.Cartographic.fromDegrees(lon, lat - 5.0, 10000000.0);
    var destCartesian = ellipsoid.cartographicToCartesian(destination);
    destination = ellipsoid.cartesianToCartographic(destCartesian);

    // only fly there if it is not the camera's current position
    if (!ellipsoid
            .cartographicToCartesian(destination)
            .equalsEpsilon(this._viewer.scene.camera.positionWC, Cesium.Math.EPSILON6)) {

        this._viewer.scene.camera.flyTo({
            destination: destCartesian
        });
    }
};

GlobeDataSource.prototype._setLoading = function(isLoading) {
    if (this._isLoading !== isLoading) {
        this._isLoading = isLoading;
        this._loading.raiseEvent(this, isLoading);
    }
};

$(function() {
    var defect_type_select = $('select.defect-type');
    var defect_timeframe_select = $('select.defect-timeframe');
    var type = 'defects';

    defect_type_select.change(function() {
        type = $(this).val();
        loadType(type, data_source, data_options);
    });

    defect_timeframe_select.change(function() {
        loadType(type, data_source, data_options);
    });

    // prepare cesium
    Cesium.BingMapsApi.defaultKey = 'ApHvJ-yuMKNjJuALVudBeOFK5Z-625r6xWV_nGw84PWCGnKnEqfjpCbPBxSEHnJG';

    var viewer = new Cesium.Viewer('cesiumContainer', {
        timeline: false,
        fullscreenButton: false
    });

    var data_source = new GlobeDataSource(viewer);

    var data_options = {
        onHover: function(data, ui_item) {
            $("#info > .pos-info").remove();
            if(data) {
                $("#info").append(
                    '<div class="pos-info"><table>' +
                    '<tr><td class="pos-key">Defects:</td><td>' + data.count + '</td></tr>' +
                    '<tr><td class="pos-key">Company:</td><td>' + data.company_name + '</td></tr>' +
                    '<tr><td class="pos-key">Address:</td><td>' + data.address1 + '</td></tr>' +
                    '<tr><td class="pos-key">City:</td><td>' + data.city + '</td></tr>' +
                    '<tr><td class="pos-key">Country:</td><td>' + data.country + '</td></tr>' +
                    '</table></div>'
                );
                //$("#info").position()
            }
        },
        onClick: function(data, ui_item) {
            window.location.href = '/point-of-sale/view/' + data.id;
        }
    };

    loadType('defects', data_source, data_options);

    $('.cesium-widget-credits').remove();
    $('.cesium-viewer-animationContainer').find('svg').remove();



});