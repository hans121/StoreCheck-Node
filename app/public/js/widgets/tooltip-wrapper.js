var tooltip_wrapper = (function () {

    //".ui-tooltip"
    function init(selector, popover_selector) {
        $('.ui-popover').popover({});

        var is_touch_device = 'ontouchstart' in document.documentElement;
        if (!is_touch_device) {
            $( selector ).tooltip({});
            //$('.ui-popover').popover({});
            return;
        }



    }

    return {
        init : init
    };
}(tooltip_wrapper));

$(function() {
    tooltip_wrapper.init(".ui-tooltip", ".ui-popover");
});


