PageController.prototype = new PageController();
PageController.prototype.constructor = PageController;
function PageController() {

}

PageController.prototype.showAlert = function(msg, title){
    this.hideLoadingMessage();
    $('.modal-alert').modal({ show : false, keyboard : false, backdrop : 'static' });
    $('.modal-alert .modal-header h3').text(title);
    $('.modal-alert .modal-body p').html(msg);
    $('.modal-alert').modal('show');
    $('.modal-alert button').unbind('click');
    $('.modal-alert button').click(function(){$('.modal-alert').modal('hide');})

    var button = $('button#ok');
    $(':focus').blur();
    $('button#ok').focus();
};

PageController.prototype.showLockedAlert = function(msg, title, redirect_to){
    this.hideLoadingMessage();
    $('.modal-alert').modal({ show : false, keyboard : false, backdrop : 'static' });
    $('.modal-alert .modal-header h3').text(title);
    $('.modal-alert .modal-body p').html(msg);
    $('.modal-alert').modal('show');
    $('.modal-alert button').unbind('click');
    $('.modal-alert button').click(function(){
        if(typeof(redirect_to) == 'undefined') {
            window.location.reload();
            return;
        }
        window.location.href = redirect_to;
    });

    var button = $('button#ok');
    $(':focus').blur();
    $('button#ok').focus();

    /*
    $('.modal-alert').focus();
    $('.modal-alert').keypress(function(e) {
        if (e.keyCode == $.ui.keyCode.ENTER) {
            window.location.href = redirect_to;
        }
    });
    */
};

PageController.prototype.showConfirmation = function(msg, title, confirmButtonText, okCallback, cancelCallback){
    var dlg = $('.modal-confirm');
    dlg.modal({ show : false, keyboard : false, backdrop : 'static' });
    $('.modal-confirm .modal-header h3').text(title);
    $('.modal-confirm .modal-body p').html(msg);
    $('.modal-confirm .submit').html(confirmButtonText);
    dlg.modal('show');

    var confirmSubmitButton = $('.modal-confirm .submit');
    confirmSubmitButton.unbind('click');
    confirmSubmitButton.click(function(){
        $('.modal-confirm').modal('hide');
        okCallback();
    });

    var cancelSubmitButton = $('.modal-confirm .cancel');
    cancelSubmitButton.unbind('click');
    cancelSubmitButton.click(function(){
        $('.modal-confirm').modal('hide');
        if(cancelCallback) {
            cancelCallback();
        }
    });

    $(':focus').blur();
    confirmSubmitButton.focus();
};

PageController.prototype.showLoadingMessage = function(loadingText) {
    var loadingMessage = $('.modal-loading');
    loadingMessage.modal({ show : false, keyboard : false, backdrop : 'static' });
    loadingMessage.find('.modal-body .loading-text').html(loadingText);

    if(typeof(this.spinner) == 'undefined') {
        var opts = {
            lines: 13, // The number of lines to draw
            length: 20, // The length of each line
            width: 10, // The line thickness
            radius: 30, // The radius of the inner circle
            corners: 1, // Corner roundness (0..1)
            rotate: 0, // The rotation offset
            direction: 1, // 1: clockwise, -1: counterclockwise
            color: '#000', // #rgb or #rrggbb or array of colors
            speed: 1, // Rounds per second
            trail: 60, // Afterglow percentage
            shadow: false, // Whether to render a shadow
            hwaccel: false, // Whether to use hardware acceleration
            className: 'spinner', // The CSS class to assign to the spinner
            zIndex: 2e9, // The z-index (defaults to 2000000000)
            top: 'auto', // Top position relative to parent in px
            left: 'auto' // Left position relative to parent in px
        };
        this.spinner = new Spinner(opts)
    }
    var target = loadingMessage.find('.loading-child').get(0);
    this.spinner.spin(target);

    loadingMessage.modal('show');
};

PageController.prototype.hideLoadingMessage = function() {
    $('.modal-loading').modal('hide');
    if(typeof(this.spinner) != 'undefined') {
        this.spinner.stop();
    }
};