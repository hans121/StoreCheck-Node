var general_util = (function () {

    function validateEmail(email) {
        var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
    }

    function bytesToSize(bytes) {
        if(bytes == 0) { return '0 bytes'; }
        var sizes = [ 'n/a', 'bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        var i = +Math.floor(Math.log(bytes) / Math.log(1024));
        return  (bytes / Math.pow(1024, i)).toFixed( i ? 1 : 0 ) + ' ' + sizes[ isNaN( bytes ) ? 0 : i+1 ];
    }

    function allowOnlyFloat(selector_string) {
        $(selector_string).on('keypress', function(evt) {
            $(this)[0].lastValue = $(this).val();
        });
        $(selector_string).on('change keydown keyup', function(evt) {
            if (isFloat($(this).val()) || $(this).val() == '-') {
                $(this)[0].lastValue = $(this).val();
            } else {
                $(this).val($(this)[0].lastValue);
            }
        });
    }

    function isFloat(value) {
        return (isNaN(value / 1) == false);
    }

    return {
        validateEmail: validateEmail,
        bytesToSize: bytesToSize,
        allowOnlyFloat : allowOnlyFloat,
        isFloat: isFloat
    };
}());
