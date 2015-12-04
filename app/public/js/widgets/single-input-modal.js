//- valid input_types: "password",etc

var single_input_modal = (function() {

    var _modalClassName = '.modal-single-input';

    var single_input_modal_template_def =
        '<div class="modal-single-input modal fade" role="dialog">' +
            '<div class="modal-dialog" style="background-color: #fff;">' +
                '<div class="modal-header">' +
                    '<button class="close" data-dismiss="modal">x</button>' +
                    '<h3></h3>' +
                '</div>' +
                '<div class="modal-body">' +
                '</div>' +
                '<div class="modal-footer">' +
                    '<button data-dismiss="modal" class="cancel btn">Cancel</button>' +
                    '<button type="submit" class="submit btn">Ok</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    function show(title, text, input_type, onOk, onCancel, onHidden) {
        var dialog = $(_modalClassName);
        dialog.modal({ show : false, keyboard : false, backdrop : 'static' });
        dialog.find('.modal-body').html(text);
        dialog.find('.modal-body').append('<form><input class="form-control" type="' + input_type + '"></form>');
        dialog.find('.modal-header > h3').html(title);

        dialog.find('button.submit').unbind('click');
        dialog.find('button.submit').click(function() {
            hide();
            onOk();
            return false;
        });

        dialog.find('button.cancel').unbind('click');
        dialog.find('button.cancel').click(function() {
            if(onCancel) {
                onCancel();
            }
        });

        dialog.on('hidden.bs.modal', function() {
            if(onHidden) {
                onHidden();
            }
        });

        dialog.modal('show');
    }

    function hide() {
        $(_modalClassName).modal('hide');
    }

    function init(container) {
        container.append(doT.template(single_input_modal_template_def)({}));
    }

    function getValue(container) {
        return container.find(_modalClassName).find('input').val();
    }

    return {
        show: show,
        hide: hide,
        init: init,
        getValue: getValue
    }
}());

$(function() {
});