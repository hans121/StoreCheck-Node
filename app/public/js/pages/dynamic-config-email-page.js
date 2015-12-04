$(function() {
    var sc = new PageController();

    $('button.save-dynamic-config-btn').click(function() {
        var port = $('input.input-port').val();
        port = parseInt(port);
        $.ajax({
            url: '/dynamic-config/email',
            type: 'POST',
            data: {
                host: $('input.input-host').val(),
                user: $('input.input-user').val(),
                password: "CheckStoresD4123",
                sender: $('input.input-sender').val(),
                ssl: $('input.check-ssl')[0].checked,
                tls: $('input.check-tls')[0].checked,
                port: $('input.input-port').val()
            },
            success: function(data) {
                window.location.reload();
            },
            error: function(jqXHR) {
                sc.showAlert(jqXHR.responseText, 'Error');
            }
        });
    });

    $('button.btn-send-test-email').click(function() {
        $.ajax({
            url: '/dynamic-config/email/test',
            type: 'POST',
            success: function(data) {
                window.location.reload();
            },
            error: function(jqXHR) {
                sc.showAlert(jqXHR.responseText, 'Error');
            }
        });
    });

    $('.cancel-btn').click(function() {
        window.location.href="/home";
    });
});