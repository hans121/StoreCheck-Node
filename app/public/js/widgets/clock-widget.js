var clock_widget = (function () {

    var external_interface = {
        init: init
    };

    var default_options = {
        container: null,
        isUTC: false,
        format: 'YYYY-MM-DD HH:mm:ss'
    };

    function init(options_in) {
        var options = $.extend({}, default_options, options_in);

        options.container.html(template({}));
        var clock_container = options.container.find('.clock-widget');

        setInterval(_updateTime, 500);

        function _updateTime() {
            var time_string;

            if(options.isUTC) {
                time_string = moment().utc().format(options.format) + 'Z';
            } else {
                time_string = moment().format(options.format);
            }

            clock_container.html(time_string);
        }
        _updateTime();
    }

    var template_def =
        '<div class="clock-widget" title="Current time">' +
        '</div>';

    var template = doT.template(template_def);

    return external_interface;

}());