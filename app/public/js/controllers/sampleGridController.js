SampleGridController.prototype = new PageController();
SampleGridController.prototype.constructor = SampleGridController;
function SampleGridController() {
    var that = this;

    // navigation UI letting us know a new question id has been selected by user:
    this.setCurrentQuestion = function(questions, new_current_question_id) {
        if(new_current_question_id != that.question_id) {

            // No question is selected (hierarchy node in nav is selected) hide grid and return
            if (new_current_question_id == -1) {
                $('.grid_ui').hide();
                return;
            }

            // Current question matches what is already shown/contained in DOM, just make sure its visible
            if (new_current_question_id == that.question_id) {
                $('.grid_ui').show();
                return;
            }

            // A new question is selected
            if(!that.read_only) {
                that.save(new_current_question_id);
            } else {
                that.showLoadingMessage('Loading...');
                window.location.href = window.location.pathname + new_current_question_id;
            }
        }
    }
}

SampleGridController.prototype.copyAcrossSamples = function(sample_id) {
    var checkboxesToCopy = $('input[type=checkbox][data-sample=' + sample_id + ']');
    if(checkboxesToCopy.length > 0) {
        for(var i=0; i<checkboxesToCopy.length; i++) {
            var is_checked = $(checkboxesToCopy[i]).attr('checked');
            var toCopyTo = $('input[type=checkbox].answer_' + $(checkboxesToCopy[i]).data('answer'));
            if(is_checked) {
                toCopyTo.attr('checked', is_checked);
            } else {
                toCopyTo.removeAttr('checked');
            }
        }
        return;
    }

    var radioToCopy = $('input[name=' + sample_id + ']:checked');
    if(radioToCopy.length > 0) {
        // a checkbox or radio was checked
        $('[data-answer=' + radioToCopy.data('answer') + ']').attr('checked', true);
        return;
    }

    var sampleToCopyInput = $('input#answer_' + sample_id);
    if(sampleToCopyInput.length > 0) {
        $('.answer_field:enabled').val(sampleToCopyInput.val());
    } else {
        var sampleToCopySelect = $('select[name=' + sample_id + ']');
        if(sampleToCopySelect.length > 0) {
            $('.answer_field:enabled').val(sampleToCopySelect.val());
        }
    }
};

SampleGridController.prototype.init = function(next_question_id, prior_question_id, question_id, visit_id, storecheck_id, product_id, samples, treeNavContainer, read_only) {
    var that = this;
    that.question_id = question_id;
    that.product_id = product_id;
    that.storecheck_id = storecheck_id;
    that.read_only = read_only;

    $('.btn-copy-across-samples').click(function(evt) {
        var sampleId = evt.target.id.split('_')[2];
        that.copyAcrossSamples(sampleId);

        return false;
    });
    this.question_id = question_id;
    this.visit_id = visit_id;
    that.prior_question_id = prior_question_id;
    that.next_question_id = next_question_id;

    // when images are clicked, show image dialog
    $('.imagepreview').click(function(e) {
        var imgUi = $(e.target).clone();
        imgUi.attr('src', imgUi.attr('image-url'));
        $(imgUi).css('height', '').css('width', '100%');
        $(imgUi).removeClass('imagepreview');
        $('#imageDialog').find('.full-size-image').empty().append(imgUi);
        $('#imageDialog').modal();
    });
};
