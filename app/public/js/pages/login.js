var login_page = (function () {

    function init() {
        var lv = new LoginValidator();
        var pc = new PageController();

        $('#login-form #forgot-password').click(function(){ $('.modal-credentials').modal('show');});

        // automatically toggle focus between the email modal window and the login form
        $('.modal-credentials').on('shown', function(){ $('#email-tf').focus(); });
        $('.modal-credentials').on('hidden', function(){ $('#user-tf').focus(); });

        $('a.forgot-password').click(function() {
            $('.modal-credentials').modal('show');
        });

        $('.lost-credentials-submit').click(function() {
            $('.modal-credentials').modal('hide');
            $.ajax({
                url: '/lost-password',
                type: 'POST',
                data: {
                    email: $('#email-tf').val()
                },
                success: function(data) {
                    pc.showAlert('A reset email has been sent.', 'Success');
                },
                error: function(jqXHR) {
                    pc.showAlert('The specified email address could not be found in our system.', 'Error');
                }
            });
        });

        // main login form //

        $('#login-form').ajaxForm({
            beforeSubmit : function(formData, jqForm, options){
                if (lv.validateForm() == false){
                    return false;
                } 	else{
                    // append 'remember-me' option to formData to write local cookie //
                    formData.push({name:'remember-me', value:$("input:checkbox:checked").length == 1})
                    return true;
                }
            },
            success	: function(responseText, status, xhr, $form){
                if (status == 'success') window.location.href = '/home';
            },
            error : function(e){
                lv.showLoginError('Login Failure', 'Please check your username and/or password');
                $(':focus').blur();
                $('button#ok').focus();
            }
        });
        $('#user-tf').focus();

        // login retrieval form via email //

        var ev = new EmailValidator();

        $('.modal-credentials-form').ajaxForm({
            url: '/lost-password',
            beforeSubmit : function(formData, jqForm, options){
                if (ev.validateEmail($('#email-tf').val())){
                    ev.hideEmailAlert();
                    return true;
                }	else{
                    ev.showEmailAlert("<b> Error!</b> Please enter a valid email address");
                    return false;
                }
            },
            success	: function(responseText, status, xhr, $form){
                ev.showEmailSuccess("Check your email on how to reset your password.");
            },
            error : function(){
                ev.showEmailAlert("Sorry. There was a problem, please try again later.");
            }
        });
    }

    return {
        init: init
    };
}());

$(function(){
    login_page.init();
});
