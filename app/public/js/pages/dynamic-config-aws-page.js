$(function() {
    var sc = new PageController();

    $('button.save-dynamic-config-btn').click(function() {
        sc.showLoadingMessage('Saving');
        $.ajax({
            url: '/dynamic-config/aws',
            type: 'POST',
            data: {
                AWSAccessKey: $('input.aws-key').val(),
                AWSSecretKey: $('input.aws-secret-key').val(),
                AWSS3Region: $('input.aws-region').val(),
                RootURL: $('input.aws-url-prefix').val()
            },
            success: function(data) {
                window.location.reload();
            },
            error: function(jqXHR) {
                sc.showAlert(jqXHR.responseText, 'Error');
            }
        });
    });
});