var cpu_chart = (function () {
    function draw(container, cpu_records) {
        container.html('');

        container.css('height', 300 );
        container.css('display', '' );

        var values = [], cores = {}, earliest_timestamp;

        cpu_records.forEach(function(cpu_record) {
            if(typeof(earliest_timestamp) == 'undefined') {
                earliest_timestamp = cpu_record.timestamp;
                // TODO: don't assume the first record is the earliest (even though it currently is)
            }
            cpu_record.cores.forEach(function(core_record) {
                if(typeof(cores['core ' + core_record.core_index]) == 'undefined') {
                    cores['core ' + core_record.core_index] = {label: 'core ' + core_record.core_index, data: []};
                }
                cores['core ' + core_record.core_index].data.push([new Date(cpu_record.timestamp), parseFloat(core_record.percentUsed)]);
            });
        });

        Object.keys(cores).forEach(function(core) {
            var core_record = cores[core];
            values.push(core_record);
        });

        var plot_options = {
            legend: {
                show: true,
                position: "nw"
            },
            grid: {
                hoverable: true,
                clickable: true
            },
            xaxis: {
                tickFormatter: function(a, b) {
                    return moment(a).format('hh:mm:ss');
                }
            }
        };

        $.plot(container, values, plot_options);

        container.append("<div class='tooltip'></div>");
        container.find('.tooltip').css({
            position: "fixed",
            display: "none",
            border: "1px solid #fdd",
            padding: "2px",
            "background-color": "#ffe",
            opacity: 1.0
        });

        container.bind("plothover", function(event, pos, obj) {
            if (!obj) {
                container.find('.tooltip').addClass('hidden');
                return;
            }

            container.find('.tooltip').removeClass('hidden');
            container.find(".tooltip").html(obj.datapoint[1] + '% at ' + moment(obj.datapoint[0]).format('hh:mm:ss'))
                .css({top: pos.pageY+5 - window.pageYOffset, left: pos.pageX+5})
                .fadeIn(200);
        });

        container.on('mouseleave', function() {
            container.find('.tooltip').addClass('hidden');
        });
    }

    return {
        draw: draw
    };

}());