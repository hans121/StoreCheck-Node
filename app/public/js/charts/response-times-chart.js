var response_times_chart = (function () {

    function drawAverages(container, response_times) {
        container.html('');

        container.css('height', 280 );
        container.css('display', '' );

        var values = [], routes = {}, earliest_timestamp;

        response_times.forEach(function(response_time_record) {
            if(typeof(earliest_timestamp) == 'undefined') {
                earliest_timestamp = response_time_record.timestamp;
                // TODO: don't assume the first record is the earliest (even though it currently is)
            }

            if(typeof(routes['/']) == 'undefined') {
                routes['/'] = {label: '/', data: []};
            }
            routes['/'].data.push([new Date(response_time_record.at), parseFloat(response_time_record.avg)]);
        });

        if(typeof(routes['/']) != 'undefined') {
            values.push(routes['/']);
        }

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
                    return moment.utc(a).format('HH:mm:ss') + 'Z';
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

            var tooltip_html = obj.datapoint[1].toFixed(1) + ' ms at ' + moment.utc(obj.datapoint[0]).format('HH:mm:ss') + 'Z';

            container.find('.tooltip').removeClass('hidden');
            container.find(".tooltip").html(tooltip_html)
                .css({top: pos.pageY+5 - window.pageYOffset, left: pos.pageX+5})
                .fadeIn(200);
        });

        container.on('mouseleave', function() {
            container.find('.tooltip').addClass('hidden');
        });
    }

    function drawMaxes(container, response_times) {
        container.html('');

        container.css('height', 280 );
        container.css('display', '' );

        var values = [], routes = {}, earliest_timestamp;

        response_times.forEach(function(response_time_record) {
            if(typeof(earliest_timestamp) == 'undefined') {
                earliest_timestamp = response_time_record.timestamp;
                // TODO: don't assume the first record is the earliest (even though it currently is)
            }

            if(typeof(routes['/']) == 'undefined') {
                routes['/'] = {label: '/', data: []};
            }
            routes['/'].data.push([new Date(response_time_record.at), parseFloat(response_time_record.max)]);
        });

        if(typeof(routes['/']) != 'undefined') {
            values.push(routes['/']);
        }

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
                    return moment.utc(a).format('HH:mm:ss') + 'Z';
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

            var tooltip_html = obj.datapoint[1].toFixed(1) + ' ms at ' + moment.utc(obj.datapoint[0]).format('HH:mm:ss') + 'Z';

            container.find('.tooltip').removeClass('hidden');
            container.find(".tooltip").html(tooltip_html)
                .css({top: pos.pageY+5 - window.pageYOffset, left: pos.pageX+5})
                .fadeIn(200);
        });

        container.on('mouseleave', function() {
            container.find('.tooltip').addClass('hidden');
        });
    }

    function drawTotals(container, response_times) {
        container.html('');

        container.css('height', 280 );
        container.css('display', '' );

        var values = [], routes = {}, earliest_timestamp;

        response_times.forEach(function(response_time_record) {
            if(typeof(earliest_timestamp) == 'undefined') {
                earliest_timestamp = response_time_record.timestamp;
                // TODO: don't assume the first record is the earliest (even though it currently is)
            }

            if(typeof(routes['/']) == 'undefined') {
                routes['/'] = {label: '/', data: []};
            }
            routes['/'].data.push([new Date(response_time_record.at), response_time_record.n]);
        });

        if(typeof(routes['/']) != 'undefined') {
            values.push(routes['/']);
        }

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
                    return moment.utc(a).format('HH:mm:ss') + 'Z';
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

            var tooltip_html = obj.datapoint[1].toFixed(0) + ' request' + (obj.datapoint[1] == 1 ? '' : 's') + ' at ' + moment.utc(obj.datapoint[0]).format('HH:mm:ss') + 'Z';

            container.find('.tooltip').removeClass('hidden');
            container.find(".tooltip").html(tooltip_html)
                .css({top: pos.pageY+5 - window.pageYOffset, left: pos.pageX+5})
                .fadeIn(200);
        });

        container.on('mouseleave', function() {
            container.find('.tooltip').addClass('hidden');
        });
    }

    return {
        drawAverages: drawAverages,
        drawMaxes: drawMaxes,
        drawTotals: drawTotals
    };

}());