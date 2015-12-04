var sample_form = (function () {

    function init(pageController) {
        production_line_select.init("production-line-select", "factory-select");
        factory_select.init("factory-select");

        this.pageController = pageController;
    }

    return {
        init : init
    };
}(sample_form));
