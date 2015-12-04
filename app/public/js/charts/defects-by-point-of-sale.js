var defects_by_point_of_sale_chart = (function () {

    function draw(container, mapping, type) {
        var nonconform_values = [];

        if(typeof(mapping) != 'undefined' && typeof(mapping.points_of_sale_summary) != 'undefined') {
            var pos_summary;
            Object.keys(mapping.points_of_sale_summary).forEach(function(pos_id) {
                pos_summary = mapping.points_of_sale_summary[pos_id];
                nonconform_values.push({
                    name: pos_summary.company_name + ' ' + pos_summary.city,
                    y: pos_summary.count,
                    id: pos_id,
                    sliced: false,
                    selected: false
                });
            });
        }

        // Limit the results
        var visible_count, trimmed_count, other_defect_total = 0, i, max_slices = 7;
        nonconform_values.sort(function(a, b) {
            return (a[1] < b[1] ? -1 : (a[1] == b[1] ? 0 : 1));
        });
        visible_count = Math.min(nonconform_values.length, max_slices);
        trimmed_count = nonconform_values.length - max_slices;
        for(i=visible_count; i<nonconform_values.length; i++) {
            other_defect_total += nonconform_values[i][1];
        }
        nonconform_values = nonconform_values.slice(0, Math.min(nonconform_values.length, max_slices));
        /*
         if(trimmed_count > 0) {
         nonconform_values.push(['Other', other_defect_total]);
         }
         */

        container.highcharts({
            chart: {
                plotBackgroundColor: null,
                plotBorderWidth: null,
                plotShadow: false
            },
            title: {
                text: 'Most ' + (type == 'alerts' ? 'Alerts' : 'Defects') + ' by Point of Sale',
                margin: 0
            },
            legend: {
                margin: 0
            },
            tooltip: {
                pointFormat: '{series.name}: <b>{point.y}</b>'
            },
            credits: {
                enabled: false
            },
            plotOptions: {
                pie: {
                    dataLabels: {
                        enabled: false
                    },
                    showInLegend: true
                }
            },
            series: [{
                allowPointSelect: true,
                type: 'pie',
                name: (type == 'alerts' ? 'Alerts' : 'Defects'),
                data: nonconform_values,
                point:{
                    events:{
                        click: function (event) {
                            window.location.href = '/point-of-sale/view/' + this.id;
                        }
                    }
                }
            }]
        });
    }

    return {
        draw: draw
    };

}());