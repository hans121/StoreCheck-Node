var databases_widget = (function () {

    function init(container, database_data, on_collection_clicked, on_database_clicked) {
        if(typeof(database_data) == 'undefined' || Object.keys(database_data).length == 0) {
            container.html('No data');
            return;
        }
        container.html('');

        container.append("<div class='tooltip'></div>");
        container.find('.tooltip').css({
            position: "absolute",
            display: "none",
            border: "1px solid #fdd",
            padding: "2px",
            "background-color": "#ffe",
            opacity: 1.0
        });

        Object.keys(database_data).forEach(function(database, database_index) {
            var database_name = database;
            var database_info = database_data[database];
            var database_items = [];
            var record;

            Object.keys(database_info.collections).forEach(function(collection) {
                record = database_info.collections[collection];
                database_items.push({label: collection, data: record[record.length - 1].storageSize});
            });

            //.html(JSON.stringify(database_items));

            var database_class = 'database_' + database_index;
            container.append('<div class="' + database_class + ' pull-left">' +
                '<div class="title text-center" style="margin-bottom: 10px;"></div>' +
                '<div class="db-summary text-center"></div>' +
                '<div class="chart"></div>' +
                '<div class="database_legend_' + database_index + '"></div>' +
                '<div class="summary text-center" style="margin-top: 10px;"></div></div>');

            var disk_container = container.find('.' + database_class);

            disk_container.find('.title').html('<a class="database" data-database="' + database_name + '">' + database + '</a>');
            //disk_container.find('.summary').html(disk.free_formatted + ' free of ' + disk.total_formatted + ' (' + disk.percent_free + '%)');

            var latest_db_stats = database_info.stats[database_info.stats.length - 1];
            disk_container.find('.db-summary').html(general_util.bytesToSize(latest_db_stats.fileSize) + ' storage / ' + general_util.bytesToSize(latest_db_stats.dataSize) + ' documents');

            var disk_chart_container = disk_container.find('.chart');
            disk_chart_container.css('height', 200 );
            disk_chart_container.css('width', 300 );

            $.plot(disk_chart_container, database_items, {
                series: {
                    pie: {
                        innerRadius: 0.5,
                        show: true,

                        label: {
                            show: true,
                            radius: 1,
                            formatter: function(a, b, c) {
                                if(b.percent < 10) {
                                    return "";
                                }
                                return general_util.bytesToSize(b.datapoints.points[1]);
                            },
                            background: {
                                opacity: 0.8
                            }
                        }
                    }
                },

                grid: {
                    hoverable: true,
                    clickable: true
                },


                legend: {
                    show: true,
                    container: $('.database_legend_' + database_index),
                    labelFormatter: function(label, series) {
                        // series is the series object for the label
                        return '<a class="collection" data-database="' + database_name + '" data-collection="' + label + '">' + label + '</a>';
                    }
                }
            });

            disk_chart_container.bind("plotclick", function (event, pos, item) {
                //alert("You clicked at " + pos.x + ", " + pos.y);
                // axis coordinates for other axes, if present, are in pos.x2, pos.x3, ...
                // if you need global screen coordinates, they are pos.pageX, pos.pageY

            });

            disk_chart_container.bind("plothover", function(event, pos, obj) {
                if (!obj) {
                    container.find('.tooltip').addClass('hidden');
                    return;
                }

                var collection_info = database_info.collections[obj.series.label][0];

                container.find('.tooltip').removeClass('hidden');
                container.find(".tooltip").html('<strong>' + obj.series.label + '</strong><hr>' +
                    general_util.bytesToSize(collection_info.storageSize) + ' (' + parseFloat(obj.series.percent).toFixed(2) + '%) storage<BR>' +
                    general_util.bytesToSize(collection_info.size) + ' (' + collection_info.count + ' total) documents<br>' +
                    (collection_info.size == 0 ? '0 bytes' : general_util.bytesToSize(collection_info.avgObjSize)) + ' average document size')
                    .css({top: pos.pageY+5, left: pos.pageX+5})
                    .fadeIn(200);
            });

            container.on('mouseleave', function() {
                container.find('.tooltip').addClass('hidden');
            });

            container.find('a.collection').click(function() {
                var database = $(this).data('database');
                var collection = $(this).data('collection');

                on_collection_clicked(database, collection);
            });

            container.find('a.database').click(function() {
                var database = $(this).data('database');

                on_database_clicked(database);
            });
        });
    }

    return {
        init: init
    };

}());