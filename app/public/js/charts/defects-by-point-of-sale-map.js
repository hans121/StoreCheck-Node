var defects_by_point_of_sale_map = (function (my_module) {

    function getMap(country) {
        switch(country) {
            case 'POL': return {file: 'jquery-jvectormap-pl-mill-en.js', functionName: 'pl_mill_en'}; break;
            case 'FRA': return {file: 'jquery-jvectormap-fr-mill-en.js', functionName: 'fr_mill_en'}; break;
            case 'ESP': return {file: 'jquery-jvectormap-es-mill-en.js', functionName: 'es_mill_en'}; break;
            case 'world':
            default:
                return {file: 'jquery-jvectormap-world-mill-en.js', functionName: 'world_mill_en'}; break;
        }
    }

    function draw(container, pos_summary) {
        var markers = [], defects = [], pos_data = [], map;
        if(typeof(pos_summary) != 'undefined' && typeof(pos_summary.points_of_sale_summary) != 'undefined') {
            Object.keys(pos_summary.points_of_sale_summary).forEach(function(pos_id) {
                var pos = pos_summary.points_of_sale_summary[pos_id];
                if(pos.latitude && pos.longitude) {
                    markers.push([pos.latitude, pos.longitude]);
                    defects.push(pos_summary.points_of_sale_summary[pos_id].count);
                    pos.id = pos_id;
                    pos_data.push(pos);
                }
                map = map ? map : getMap(pos.country); // TODO: eventually, allow multi-country maps
            });
        } else {
            map = getMap('world');
        }

        function showMap() {
            container.vectorMap({
                map: map.functionName,
                series: {
                    markers: [{
                        attribute: 'fill',
                        scale: ['#FF8000', '#A50F15'],
                        values: defects,
                        min: jvm.min(defects),
                        max: jvm.max(defects)
                    },{
                        attribute: 'r',
                        scale: [5, 12],
                        values: defects,
                        min: jvm.min(defects),
                        max: jvm.max(defects)
                    }]
                },
                onMarkerLabelShow: function(event, label, index) {
                    label.html( pos_data[index].company_name + '<br>' + pos_data[index].address1 + '<br>' + pos_data[index].city + '<br>'+defects[index]+' defects');
                },
                markersSelectable: true,
                markersSelectableOne: true,
                onMarkerSelected: function(evt, code, isSelected){
                    var index = parseInt(code);
                    window.location.href = '/point-of-sale/view/' + pos_data[index].id
                },
                markers: markers
            });
        }

        var oHead = document.getElementsByTagName('HEAD');
        var fileref=document.createElement('script');
        fileref.setAttribute("type","text/javascript");
        fileref.setAttribute("src", '/vendor/jvectormap/' + map.file);
        fileref.onreadystatechange= function () {
            if (this.readyState == 'complete') { showMap(); }
        };
        fileref.onload = showMap;
        oHead[0].appendChild( fileref);


    }

    return {
        draw: draw
    };

}(defects_by_point_of_sale_map));