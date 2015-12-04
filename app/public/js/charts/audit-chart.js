var audit_chart = (function () {

    function draw(container, audit_records) {
        var values = [], groups = {}, group, group_key, days_back = 7;
        var seconds_from_start, bucket;

        var starting_point = moment().subtract('days', days_back);
        starting_point.hour(0);
        starting_point.minute(0);
        starting_point.second(0);
        starting_point.millisecond(0);

        // compute for each audit type how much on each day instances occurred
        audit_records.forEach(function(audit_record) {
            seconds_from_start = parseInt(moment.utc(audit_record.timestamp).format('X')) - parseInt(moment(starting_point).format('X'));
            bucket = parseInt(seconds_from_start / 86400);
            group_key = audit_record.action + '_' + audit_record.resource;
            group = groups[group_key];
            if(typeof(group) == 'undefined') {
                groups[group_key] = {
                    label: audit_record.action + ' ' + audit_record.resource,
                    counts: {}
                };
                group = groups[group_key];
            }
            if(typeof(group.counts[bucket]) == 'undefined') {
                group.counts[bucket] = 0;
            }
            group.counts[bucket]++;
        });

        var numerical_index = 0, max_value = 0;
        Object.keys(groups).forEach(function(group_key) {
            var record = groups[group_key];
            record.data = [];
            record.index = numerical_index;

            Object.keys(record.counts).forEach(function(record_key) {
                var count_value = record.counts[record_key];
                if(count_value > max_value) {
                    max_value = count_value;
                }
                 record.data.push([record_key - numerical_index * 0.03, count_value]); // 0.035 makes them hug
            });

            // convert counts to data
            values.push(record);
            numerical_index++;
        });

        var plot_options = {
            series: {
                bars: {
                    show: true,
                    barWidth: 0.02,
                    align: "center",
                    fill: 1,
                    numbers: {
                        show: true,
                        xAlign: function(x) { return x - 0.005; },
                        yAlign: function(y) { return y + max_value * .1; }
                    }
                }
            },

            grid: { hoverable: true, clickable: true },

            legend: {
                show: true,
                container: $('.action-audit-legend'),
                noColumns: Math.ceil($('.action-audit-legend').width() / 150)
            },

            xaxis: {
                min: 3,
                max: 7,
                tickDecimals: 0,
                tickFormatter: function(a, b) {
                    return moment(starting_point + a * 86400000).format('MMMM DD');
                }
            },

            yaxis: {
                max: max_value * 1.1
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

        container.unbind("plothover");
        container.bind("plothover", function(event, pos, obj) {
            if (!obj) {
                container.find('.tooltip').addClass('hidden');
                return;
            }

            container.find('.tooltip').removeClass('hidden');
            container.find(".tooltip").html(obj.series.label + ' (' + obj.datapoint[1] + ')')
                .css({top: pos.pageY+10, left: pos.pageX+5})
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