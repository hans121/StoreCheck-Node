var disk_usage_chart = (function () {

    var disk_container_template = doT.template(
        '<div class="{{=it.class}} pull-left">' +
        '<div class="title text-center" style="margin-bottom: 10px;"></div>' +
        '<div class="chart"></div>' +
        '<div class="summary text-center" style="margin-top: 10px;"></div></div>'
    );

    function draw(all_disk_container, disk_data) {

        all_disk_container.html('<div class="tooltip"></div>');

        all_disk_container.find('.tooltip').css({
            "position": "absolute",
            "display": "none",
            "border": "1px solid #fdd",
            "padding": "2px",
            "background-color": "#ffe",
            "opacity": 1.0
        });
        
        disk_data.forEach(function(disk, index) {
            var disk_class = 'disk_' + index;
            all_disk_container.append(disk_container_template({
                class: disk_class
            }));

            var disk_container = all_disk_container.find('.' + disk_class);

            disk_container.find('.title').html('Drive: ' + disk.drive);
            disk_container.find('.summary').html(disk.free_formatted + ' free of ' + disk.total_formatted + ' (' + disk.percent_free + '%)');

            var disk_chart_container = disk_container.find('.chart');
            disk_chart_container.css('height', 200 );
            disk_chart_container.css('width', 300 );

            var data_for_disk = [{
                label: "Free",
                data: disk.percent_free
            }, {
                label: "Occupied",
                data: 100.0 - disk.percent_free
            }];
            $.plot(disk_chart_container, data_for_disk, {
                series: {
                    pie: {
                        innerRadius: 0.5,
                        show: true
                    }
                },
                grid: {
                    hoverable: true,
                    clickable: true
                },
                colors: [
                    '#00f',
                    '#f00'
                ]
            });

            disk_chart_container.bind("plothover", function(event, pos, obj) {
                if (!obj) {
                    all_disk_container.find('.tooltip').hide();
                    return;
                }

                all_disk_container.find(".tooltip").html(obj.series.label + " = " + parseFloat(obj.series.percent).toFixed(2) + '%')
                    .css({top: pos.pageY+5, left: pos.pageX+5})
                    .fadeIn(200);
            });
        });
    }

    return {
        draw: draw
    };

}());

