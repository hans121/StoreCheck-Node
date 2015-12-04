$(function() {
    var navbarController = new PageController();

    $('.navbar').find('.btn-logout').click(function() {
        navbarController.showLoadingMessage('Signing Out...');
        $.ajax({
            url: "/user",
            type: "POST",
            data: {logout : true},
            success: function(data){
                window.location.href = '/';
            },
            error: function(jqXHR){
                navbarController.showAlert('An error has occurred: ' + jqXHR.responseText, 'Error');
            }
        });
    });
});