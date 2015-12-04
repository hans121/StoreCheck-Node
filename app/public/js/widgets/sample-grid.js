var sample_grid_control = (function () {

    var external_interface = {
        init: init,
        editBatchCode : editBatchCode,
        editNote: editNote,
        submitImages: submitImages,
        removeImage: removeImage
    };

    function init(parent_container) {

        // TODO: move stuff from jade file to here

        // enforce non-conform/alerts causing checkboxes to get unchecked
        parent_container.find('input[type=checkbox]').change(function() {
            // if this is an uncheck event, ignore it
            if(!$(this).prop('checked')) {
                return;
            }

            if($(this).data('weight') == 'A' || $(this).data('weight') == 'CONFORM') {
                return;
            }

            var checked_answers_for_sample = parent_container.find('[data-sample=' + $(this).data('sample') + ']:checked');

            // if any answers for this question are non-conform
            var found_nonconform = false;
            for(var i=0; i<checked_answers_for_sample.length && !found_nonconform; i++) {
                if($(checked_answers_for_sample[i]).data('weight') != 'A' && $(checked_answers_for_sample[i]).data('weight') != 'CONFORM') {
                    found_nonconform = true;
                }
            }

            if(found_nonconform) {
                // uncheck all conforming checkboxes for this question
                parent_container.find('[data-sample=' + $(this).data('sample') + '][data-weight=A]').removeAttr('checked');
                parent_container.find('[data-sample=' + $(this).data('sample') + '][data-weight=CONFORM]').removeAttr('checked');
            }
        });
    }

    function editNote(pc, sample_id, note) {
        $('.sample-note-modal').modal('show');

        $('.sample-note-modal textarea').val(note);

        $('.sample-note-modal button.submit').unbind('click');
        $('.sample-note-modal button.submit').click(function() {
            $('.sample-note-modal').modal('hide');

            var note_value = $('.sample-note-modal textarea').val();

            pc.showLoadingMessage('Saving...');
            $.ajax({
                url: '/sample/' + sample_id + '/note',
                type: 'POST',
                data: {
                    value: note_value
                },
                success: function(data){
                    updateNoteInUI(sample_id, note_value);
                    pc.hideLoadingMessage();
                },
                error: function(jqXHR){
                    pc.showAlert(jqXHR.responseText, 'Error');
                }
            });
            return false;
        });
        return false;
    }

    function updateNoteInUI(sample_id, note) {
        var td = $('td.properties[data-id=' + sample_id + ']');
        var note_container = td.find('.note-container');
        var html_contents = '<div class="property-label">Note: </div><div class="property-value">' + note + '</div>';

        if(note_container.length == 0) {
            // add note
            td.append('<div class="property note-container">' + html_contents + '</div>');

        } else {
            note_container.html(html_contents);
        }
    }

    function editBatchCode(pc, id, initial_value) {
        $('.sample-batch-code-modal').modal('show');

        $('.sample-batch-code-modal input').val(initial_value);

        $('.sample-batch-code-modal button.submit').unbind('click');
        $('.sample-batch-code-modal button.submit').click(function() {
            $('.sample-batch-code-modal').modal('hide');
            pc.showLoadingMessage('Saving...');
            $.ajax({
                url: '/sample/' + id + '/batch_code',
                type: 'POST',
                data: {
                    value: $('.sample-batch-code-modal input').val()
                },
                success: function(data){
                    window.location.reload();
                },
                error: function(jqXHR){
                    pc.showAlert(jqXHR.responseText, 'Error');
                }
            });
            return false;
        });
        return false;
    }

    function submitImages(pc) {
        var sample_grid_container = $('.sample-table-file-upload-form');
        sample_grid_container.ajaxSubmit({
            error: function(jqXHR) {
                window.alert(jqXHR.responseText);
                pc.hideLoadingMessage();
                //that.showAlert('An error has occurred: ' + jqXHR.responseText, 'Error');
            },

            success: function(response) {
                if (response.error) {
                    pc.hideLoadingMessage();
                    window.alert('Error uploading images: ' + response.error, 'Error');
                    return;
                }

                var serviceCalls = [];

                // data coming back should be an array of (input "name" attributes + new image URLs); shove the new image URLs into the DOM
                for (var i = 0; i < response.urlMap.length; i++) {
                    var imageMap = response.urlMap[i];
                    var imageMapTokens = imageMap.name.split('_');
                    var question_id = imageMapTokens[1];
                    var sample_id = imageMapTokens[2];
                    $('.imageurl_' + sample_id).val(imageMap.url);

                    serviceCalls.push({path: '/sample/' + sample_id + '/question/' + question_id + '/image_url', url: imageMap.url});
                }

                var uploads_complete = 0;
                for (var k=0; k<serviceCalls.length; k++) {
                    $.ajax({
                        type: 'POST',
                        data: {url: serviceCalls[k].url},
                        url: serviceCalls[k].path
                    }).done(function(result) {
                        uploads_complete++;
                        if(uploads_complete == serviceCalls.length) {
                            pc.hideLoadingMessage();
                        }
                    }).error(function(jqXHR, textStatus, errorThrown) {
                        uploads_complete++;
                        if(uploads_complete == serviceCalls.length) {
                            window.alert('an error occurred on one or more uploads');
                        }
                    });
                }
            }
        });
    }

    function removeImage(pc, sample_id, question_id) {
        pc.showConfirmation('Are you sure you want to remove this image?', 'Remove Image', 'Yes', function(){
            pc.showLoadingMessage('Removing image...');
            $.ajax({
                type: 'DELETE',
                url: '/sample/' + sample_id + '/question/' + question_id + '/image_url'
            }).done(function(result) {
                var imagepreview_container = $('.imagepreview_' + sample_id + '_' + question_id);
                imagepreview_container.attr('src', '/img/no-image.jpg').show();
                imagepreview_container.removeClass('imagepreview');
                $('.btn-remove-image').parent().css('height', '');
                $('.btn-remove-image').remove();
                pc.hideLoadingMessage();
            }).error(function(jqXHR, textStatus, errorThrown) {
                window.alert('an error occurred on one or more deletions');
            });
        });
    }


    return external_interface;

}(sample_grid_control));
