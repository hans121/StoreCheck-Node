SampleController.prototype = new PageController();
SampleController.prototype.constructor = SampleController;
function SampleController() {
}

SampleController.prototype.initEditMode = function(product_id, template_id, sampleId, visitId, temperature_settings) {
    var that = this;
    this.sampleId = sampleId;
    this.visitId = visitId;
    this.formChanged = false;
    this.temperature_settings = temperature_settings;
    this.hasImageBeenUploaded = false;

    function formChangeFunction() {
        that.formChanged = true;
    }
    var sample_form = $('.sample-form-container');
    sample_form.find('textarea').change(formChangeFunction);
    sample_form.find('input').change(formChangeFunction);
    sample_form.find('select').change(formChangeFunction);

    $('.datepicker').datepicker({format: 'dd-M-yyyy', changeYear: true, autoclose: true});

    $('#sample-best-by-input').on('change', function () {
        that.updateRemaining();
    });

    $('button.btn-save-sample').click(function() {
        that.save(sampleId, visitId, that.reloadOnSaveComplete);
        return false;
    });

    $('button.btn-submit-sample').click(function() {
        that.submitSample(sampleId);
        return false;
    });

    $('button.btn-delete-sample').click(function() {
        that.deleteSample(sampleId, '/samples/view');
        return false;
    });

    $('button.btn-add-sample-copy').click(function() {
        that.addSampleType(product_id, template_id, sampleId);
        return false;
    });

    $('button.btn-go-to-grid').click(function() {
        return false;
    });
};

SampleController.prototype.updateRemaining = function() {
    var moment_to_use = moment();
    var shelf_life_container = $('.sample-remaining-shelf-life-container');

    var dateOfVisit = shelf_life_container.data('date-of-visit');
    if(dateOfVisit.length > 0) {
        moment_to_use = moment(dateOfVisit, "DD-MMM-YYYY");
    }

    var best_by = $('#sample-best-by-input').val();
    if(best_by === undefined) {
        best_by = $('label.best-before').text();
    }
    var remaining = this.calculateRemaining(moment_to_use, best_by, 'DD-MMM-YYYY');
    shelf_life_container.text(remaining);
};

SampleController.prototype.reloadOnSaveComplete = function(sampleId, visitId, data) {
    if(this.question_index != 0 && typeof(this.question_id) != 'undefined'){
        window.location.href = '/sample/view/' + sampleId + '?questionId=' + this.question_id;
    } else {
        window.location.href = '/sample/view/' + sampleId;
    }
};

SampleController.prototype.hasSampleChanged = function() {
    if(this.formChanged) {
        return true;
    }
    return this.hasImageBeenUploaded;
};

SampleController.prototype.addSampleType = function(product_id, template_id, metaCopyTarget) {
    var that = this;
    this.save(this.sampleId, this.visitId, function(sampleId, visitId, result) {
        that.hideLoadingMessage();
        that.addSampleTypeOnly(product_id, template_id, metaCopyTarget);
    });
};

SampleController.prototype.addSampleTypeOnly = function(product_id, template_id, metaCopyTarget) {
    this.showLoadingMessage('Adding...');

    var that = this;
    $.ajax({
        url: (typeof metaCopyTarget == 'undefined' || metaCopyTarget == 'undefined' ? '/sample' : '/sample?metaCopyTarget=' + metaCopyTarget),
        type: 'POST',
        data: {
            visit_id:               that.visitId,
            product_id:             product_id,
            template_id:            template_id,
            batch_code:             ""
        },
        success: function(data){
            window.location.href = '/sample/view/' + data;
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
};

SampleController.prototype.getSelectedIds = function() {
    var selected = $('input.sample_check:checked');
    var ids = "";
    for(var i=0; i<selected.length; i++) {
        if(i > 0) {
            ids += ',';
        }
        ids += (selected[i].id.split('_')[1]);
    }
    return ids;
};

SampleController.prototype.getTemplatesForSelected = function() {
    var selected = $('input.sample_check:checked');
    var templates = [];
    for(var i=0; i<selected.length; i++) {
        templates.push(selected[i].id.split('_')[2]);
    }
    return templates.filter(function (e, i, a) { return templates.indexOf(e) === i; });
};

SampleController.prototype.getTypesForSelected = function() {
    var selected = $('input.sample_check:checked');
    var templates = [];
    for(var i=0; i<selected.length; i++) {
        templates.push(selected[i].id.split('_')[3]);
    }
    return templates.filter(function (e, i, a) { return templates.indexOf(e) === i; });
};

SampleController.prototype.deleteSample = function(id, return_url) {
    var that = this;

    that.showConfirmation('Are you sure you want to delete this sample?', 'Confirm Deletion', 'Yes', function() {
        that.showLoadingMessage('Deleting...');
        $.ajax({
            type: 'DELETE',
            url: '/samples/' + id
        }).done(function(result) {
            window.location.href = return_url;
        }).error(function(jqXHR, textStatus, errorThrown) {
            that.showAlert(jqXHR.responseText, 'Error');
        });
    });
};

SampleController.prototype.calculateRemaining = function (from_moment, expiration, format) {
    var dayDiff = Math.round(moment.utc(expiration, format).diff(from_moment, 'days', true));
    //description = moment.utc(expiration, format).fromNow(); <-- way cooler, but moment switches units depending on ranges

    return dayDiff + ' days';
};

SampleController.prototype.generateChildElement = function(sample, question) {

    var html = '';
    var activeAnswers = $.grep( question.answers, function(n,i) { return n.active ==="true"; });

    // TODO: refactor more of these into question_widget
    if(question.category_specific == "1" || question.category_specific == "2") {
        html = question_widget.init(sample, question);
    } else if(question.category_specific == "3") {

        // find out if any temperature settings pertain to this element
        var has_temperature_element = false;
        if(typeof(this.temperature_settings) != 'undefined') {
            this.temperature_settings.forEach(function(range) {
                if(range.code == question.level5_code && range.t03_code == question.level1_code) { // TODO: L1 code ?
                    has_temperature_element = true;
                }
            });
        }

        html +=    '<input type="text" style="width: 80px;" ' +
            'data-code="' + question.level5_code + '" data-t03-code="' + question.level1_code + '" ' + // TODO: L1 code ?
            'class="float_only template_value_field' + (has_temperature_element ? ' temperature_field' : '') + ' field_' + question.identity_id + '" value="' + question.answers[0].value + '"></input>';
    } else if(question.category_specific == "4") {
        html +=    '<input type="text" class="template_value_field field_' + question.identity_id + '" value="' + question.answers[0].value + '"></input>';
    } else if(question.category_specific == "5") {
        if (activeAnswers.length > 0) {
            html = question_widget.init(sample, question);
        } else {
            html += 'No answers active';
        }
    } else if(question.category_specific == "6") {
        if(activeAnswers.length > 0) {
            html += '<select class="template_value_field field_' + question.identity_id + '">';
            html += '<option value=""></option>';
            activeAnswers.forEach(function(activeAnswer) {
                var selected = ((activeAnswer.value === "true" || activeAnswer.value === true) ? ' selected' : '');
                html += '<option value="' + activeAnswer.identity_id + '" data-t03-code="' + activeAnswer.level1_code + '" data-code="' + activeAnswer.code + '" name="group_' + question.identity_id + '"' + selected + '>' + activeAnswer.text + '</option>';
            });
            html += '</select>';
        } else {
            html += 'No answers active';
        }
    } else {
        html += 'No data type given';
    }
    return html;
};

SampleController.prototype.generateOptionItem = function(answer) {
    return '<option value="' + answer.identity_id + '"' + ((answer.value === "true" || answer.value === true) ? ' selected' : '') + '>' + answer.text + '</option>';
};

parseQueryString = function() {

    var str = window.location.search;
    var objURL = {};

    str.replace(
        new RegExp( "([^?=&]+)(=([^&]*))?", "g" ),
        function( $0, $1, $2, $3 ){
            objURL[ $1 ] = $3;
        }
    );
    return objURL;
};

SampleController.prototype.loadSample = function(container, questionContainer, treeNavContainer, sheetId, loadedSheetCallback) {
    var that = this;

    $.ajax({
        type: 'GET',
        url: '/sample/' + sheetId
    }).done(function(sheet) {

        that.loadedSheet = sheet;
        if(loadedSheetCallback) {
            loadedSheetCallback(null, sheet);
        }
        that.questionContainer = questionContainer;
        that.sortLevel5Questions(sheet.questions);

        // Populate a bunch of question UIs into DOM
        that.makeQuestions(questionContainer, sheet);

        // create tree navigator
        var tnc = new TreeNavController();
        tnc.init(treeNavContainer, sheet, parseQueryString()['questionId'], function(questions, visible_question_ids, questionIndex) {
            // hide all question UI
            $(that.questionContainer).find('.question').hide();

            // interior/hierarchy node is selected; exit
            if (visible_question_ids.length == 0) return;

            // found selected question show
            if (questionIndex > -1) {
                that.question_id = questions[questionIndex].identity_id;
                that.question_index = questionIndex;

                $('.question.selected').removeClass('selected');
                $(that.questionContainer).find('.identity_id_' + that.question_id).addClass('selected');

                visible_question_ids.forEach(function(question_id) {
                    var container = $(that.questionContainer).find('.identity_id_' + question_id);
                    container.show();
                });
            }
        });

        general_util.allowOnlyFloat('input.float_only');
    }).error(function(jqXHR) { //, textStatus, errorThrown) {
        that.showAlert(jqXHR.responseText, 'Error');
    });
};

SampleController.prototype.makeQuestions = function(container, data) {
    var that = this;

    var truncate = function(str, max) {
        var tstr = str;
        if (tstr.length > max) tstr = tstr.substring(0, max) + '...';
        return tstr;
    };

    var _truncationLimits =
    {
        navButton: 45,
        questionLabel: 65
    };

    var html = '';
    for (var i = 0; i < data.questions.length; i++) {
        html += '<div class="question question_' + i + ' identity_id_' + data.questions[i].identity_id + '">';

        html += '<table style="width: 100%; margin-top: 10px;">';

        var label = '<span style="font-weight: bold;" title="' + data.questions[i].level5_description2 + '">' + truncate(data.questions[i].level5_description2, _truncationLimits.questionLabel) + '</span>';

        html += label;
        html += '<tr>';

        // question answer
        html += '<td>';
        html += '<div style="overflow-x: hidden; margin-right:8px;">';
        html += that.generateChildElement(data, data.questions[i]);
        html += '</div>';
        html += '</td>';

        // image(s)
        var questionImage = '';
        if (typeof data.questions[i].image_urls != 'undefined' && data.questions[i].image_urls.length > 0) {
            questionImage = data.questions[i].image_urls[0];
        }
        html += '<td valign="top" align="right" style="white-space:nowrap; height:50px;">';

        html += '<div style="margin-right: 4px;">Image</div>';
        if (questionImage != '') {
            html += '<img style="margin-bottom: 8px;" src="/img/has-image.png" image-url="' + questionImage + '" class="imagepreview imagepreview_' + data.questions[i].identity_id  + '"/>';
        } else {
            html += '<img style="margin-bottom: 8px;" src="/img/no-image.jpg" class="imagepreview imagepreview_' + data.questions[i].identity_id  + '"/>';
        }

        // Use trick to hide ugly standard "file" input button (http://stackoverflow.com/questions/11235206/twitter-bootstrap-form-file-element-upload-button)
        if(that.loadedSheet.state == "draft") {
            html +=
                '<div style="position: relative; height: 25px;">' +
                    '<label class="cabinet">' +
                        '<a class="btn btn-primary" href="javascript:;" title="Select image..." style="color: white; position: absolute; right: 3px; padding: 2px 12px;">' +
                            '<i class="icon icon-camera icon-white"></i>' +
                        '</a>' +
                        '<input type="file" accept="image/*" name="questionimage_' + data.questions[i].identity_id + '" style="cursor: pointer; filter: alpha(opacity=0);-ms-filter:&quot;progid:DXImageTransform.Microsoft.Alpha(Opacity=0)&quot;;opacity:0;background-color:transparent;color:transparent;">' +
                    '</label>' +
                '</div>';
            if (questionImage != '') {
                html += '<div style="position:relative; margin-top: 10px; margin-right: 5px;">';
                html += '    <a class="btn btn-primary btn-remove-image" title="Remove image..." style="color: red; padding: 0 12px;" onclick=sc.removeImage("' + this.sampleId + '",' + data.questions[i].identity_id + ');><i class="icon icon-remove icon-white"></i></a>';
                html += '</div>';
            }

            // store actual image url value in DOM as well:
            html += '<input type="hidden" class="imageurl_' + data.questions[i].identity_id + '" value="' + questionImage + '"/>';
        }
        html += '</td>';
        html += '</tr>';
        html += '</table>';
        html += '</div>';
    }
    $(container).html(html);

    question_widget.addConformanceCheckHandler($('.template_value_field'));

    SI.Files.stylizeAll();

    // TODO: add value changed handlers that check the temperature settings (if set) and make the appropriate selection based on the ranges

    $('.temperature_field').blur(function(evt) {
        that.applyTemperatureProcessing($(evt.currentTarget));
    });

    $('.datepicker').datepicker({format: 'dd-M-yyyy', changeYear: true, autoclose: true});

    /*
    // When a new image is selected, draw it on screen immediately
    $(container).find('input[type="file"]').change(function(e) {
        if (typeof(this.files) == 'undefined') return;

        var questionId = $(e.target).attr('name').split('_')[1];
        var file = this.files[0];

        var imageReader = new FileReader();
        imageReader.onload = function (event) {
            $(container).find('.imagepreview_' + questionId).attr('src', '/img/has-image.png').show();
            $(container).find('.imagepreview_' + questionId).attr('image-url', event.target.result).show();
        };
        imageReader.readAsDataURL(file);
    });
    */

    $(container).find('input[type="file"]').change(function(e) {
        if (typeof(this.files) == 'undefined') return;

        var questionId = $(e.target).attr('name').split('_')[1];
        var file = this.files[0];

        var imageReader = new FileReader();
        imageReader.onload = function (event) {
            $(container).find('.imagepreview_' + questionId).attr('src', '/img/has-image.png').show();
            $(container).find('.imagepreview_' + questionId).attr('image-url', event.target.result).show();
        };
        imageReader.readAsDataURL(file);
    });

    // when image is clicked, show image dialog
    $(container).find('.imagepreview').click(function(e) {
        var imgUi = $(e.target).clone();
        imgUi.attr('src', imgUi.attr('image-url'));
        $(imgUi).css('height', '').css('width', '100%');
        $(imgUi).removeClass('imagepreview');
        var imgDlg = $('#imageDialog');
        imgDlg.find('.full-size-image').empty().append(imgUi);
        imgDlg.modal();
    });
};

SampleController.prototype.applyTemperatureProcessing = function(selector) {
    var floatValue = parseFloat(selector.val());
    if(isNaN(floatValue)) {
        return;
    }

    var modified_t03 = selector.data('t03-code');
    var modified_code = selector.data('code');

    // TODO: it's not possible to get here if there aren't settings config'd - good code would check anyways
    // but, I am literally doing this entire frickin' thing in a hurry by request. DEAL WITH IT

    var applicable_settings = this.temperature_settings.filter(function(setting) {
       return setting.code == modified_code && setting.t03_code == modified_t03;
    });

    if(applicable_settings.length > 0) {
        if(typeof(applicable_settings[0].min_nonconform) != 'undefined' && parseFloat(applicable_settings[0].min_nonconform.value) > floatValue) {
            var matched = $('[data-t03-code="' + applicable_settings[0].t03_code + '"][data-code="' + applicable_settings[0].min_nonconform.linked_code + '"]');
            $(matched).prop('checked', true);
        } else if(typeof(applicable_settings[0].conform) != 'undefined' && parseFloat(applicable_settings[0].conform.value) >= floatValue) {
            var matched = $('[data-t03-code="' + applicable_settings[0].t03_code + '"][data-code="' + applicable_settings[0].conform.linked_code + '"]');
            $(matched).prop('checked', true);
        } else if(typeof(applicable_settings[0].alert) != 'undefined' && parseFloat(applicable_settings[0].alert.value) >= floatValue) {
            var matched = $('[data-t03-code="' + applicable_settings[0].t03_code + '"][data-code="' + applicable_settings[0].alert.linked_code + '"]');
            $(matched).prop('checked', true);
        } else if(typeof(applicable_settings[0].max_nonconform) != 'undefined' && parseFloat(applicable_settings[0].max_nonconform.value) <= floatValue) {
            var matched = $('[data-t03-code="' + applicable_settings[0].t03_code + '"][data-code="' + applicable_settings[0].max_nonconform.linked_code + '"]');
            $(matched).prop('checked', true);
        }
    }
};

// get single question value (from table UI)
SampleController.prototype.generateQuestion = function(question) {
    // find the selected answer and set it as the correct one, set all others as value = "false"
    var field = $(".field_" + question.identity_id);

    // if radio UI, have to get value differently
    var category = question.category_specific;

    var field_val = '';
    if(category == '1') {
        var widgets = $('.field_' + question.identity_id + ' input[type="checkbox"]:checked');
        for(var i = 0; i<widgets.length; i++) {
            field_val += (field_val.length > 0 ? ',' + $(widgets[i]).val() : $(widgets[i]).val());
        }
    } else if (category == '5') {
        field_val = $('.field_' + question.identity_id + ' input[type="radio"]:checked').val();
    } else if(category == '6') {
        field_val = $('.field_' + question.identity_id).val();
    } else {
        field_val = field.val();
    }

    var imageUrls = [ $('.imageurl_' + question.identity_id).val() ];

    return {
        identity_id: question.identity_id,
        image_urls: imageUrls,
        answer: field_val
    };
};

SampleController.prototype.generateQuestionsFromTable = function(initial_sheet) {
    var i, j;
    var value_fields = $('.template_value_field');
    var questions = [];
    var that = this;

    // fill in question_data for each record!
    for(i=0; i<value_fields.length; i++) {
        var valueClass = $(value_fields[i]).attr('class');
        var fc = valueClass.substring(valueClass.indexOf('field_'));
        var question_id = fc.split(' ')[0].substring(6, fc.length);
        for(j=0; j<initial_sheet.questions.length; j++) {
            if(initial_sheet.questions[j].identity_id == question_id) {
                questions.push(that.generateQuestion(initial_sheet.questions[j]));
                break;
            }
        }
    }

    return questions;
};

SampleController.prototype.sortLevel5Questions = function(level5_results) {
    // Sort each items' questions by sequence
    for(var i = 0; i < level5_results.length; i++) {
        level5_results[i].answers.sort(function(a, b) {
            return (parseInt(a.sequence, 10) - parseInt(b.sequence, 10));
        });
    }

    // Make a sequence tuple and then lex sort it
    level5_results.sort(function (a, b) {
        var aTuple = [parseInt(a.level1_sequence, 10), parseInt(a.level2_sequence, 10), parseInt(a.level3_sequence, 10), parseInt(a.level4_sequence, 10), parseInt(a.level5_sequence, 10)];
        var bTuple = [parseInt(b.level1_sequence, 10), parseInt(b.level2_sequence, 10), parseInt(b.level3_sequence, 10), parseInt(b.level4_sequence, 10), parseInt(b.level5_sequence, 10)];

        for (var i = 0; i < aTuple.length; i++) {
            if (aTuple[i] < bTuple[i]) {
                return -1;
            } else if (aTuple[i] > bTuple[i]) {
                return 1;
            }
        }

        return 0;
    });
};

SampleController.prototype.save = function(sampleId, visitId, onComplete) {
    var that = this;
    that.showLoadingMessage('Saving...');

    var production_line = production_line_select.getSelection('production-line-select');
    var factory = factory_select.getSelection('factory-select');

    that.doImageUploads(function() {
        $.ajax({
            url: '/sample/' + sampleId,
            type: 'POST',
            data: {
                visit_id:               visitId,
                name:                   $('#sample-identifier-input').val(),
                best_by_date:           $('#sample-best-by-input').val(),
                batch_code:             $('#sample-batch-code-input').val(),
                questions:              that.generateQuestionsFromTable(that.loadedSheet),
                note:                   ($('#sample-note-input').length > 0 ? $('#sample-note-input').val() : ""),
                factory_id:             factory.id,
                production_line_id:     production_line.id
            },
            success: function(data){
                onComplete(sampleId, visitId, data);
            },
            error: function(jqXHR){
                that.showAlert('An error has occurred: ' + jqXHR.responseText, 'Error');
            }
        });
    });
};

// async upload of image files (see http://markdawson.tumblr.com/post/18359176420/asynchronous-file-uploading-using-express-and-node-js for details)
SampleController.prototype.doImageUploads = function(onSuccessFn) {
    var that = this;
    $('.sample-form').ajaxSubmit({
        error: function(jqXHR) {
            that.showAlert('An error has occurred: ' + jqXHR.responseText, 'Error');
        },

        success: function(response) {
            if (response.error) {
                that.showAlert('Error uploading images: ' + response.error, 'Error');
                return;
            }

            // data coming back should be an array of (input "name" attributes + new image URLs); shove the new image URLs into the DOM
            for (var i = 0; i < response.urlMap.length; i++) {
                var imageMap = response.urlMap[i];
                var questionId = imageMap.name.split('_')[1];
                $('.imageurl_' + questionId).val(imageMap.url);
                that.hasImageBeenUploaded = true;
            }

            onSuccessFn();
        }
    });
};

SampleController.prototype.submitSample = function(id) {
    var that = this;
    this.save(this.sampleId, this.visitId, function(sampleId, visitId, result) {
        that.hideLoadingMessage();
        that.submitSampleOnly(id);
    });
};

SampleController.prototype.submitSampleOnly = function(id) {
    var that = this;
    that.showLoadingMessage('Submitting...');
    $.ajax({
        url: '/samples/' + id + '/state?value=submitted',
        type: 'POST',
        success: function(data){
            window.location.href = '/sample/view/' + id;
        },
        error: function(jqXHR){
            that.showAlert('An error has occurred: ' + jqXHR.responseText, 'Error');
        }
    });
};

SampleController.prototype.removeImage = function(sample_id, question_id) {
    var that = this;
    this.showConfirmation('Are you sure you want to remove this image?', 'Remove Image', 'Yes', function(){
        that.showLoadingMessage('Removing image...');
        $.ajax({
            type: 'DELETE',
            url: '/sample/' + sample_id + '/question/' + question_id + '/image_url'
        }).done(function(result) {
            var imagepreview_container = $('.imagepreview_' + question_id);
            imagepreview_container.attr('src', '/img/no-image.jpg').show();
            imagepreview_container.removeClass('imagepreview');
            $('.btn-remove-image').parent().css('height', '');
            $('.btn-remove-image').remove();
            imagepreview_container.removeAttr('image-url');
            $('.imageurl_' + question_id).remove();
            that.hideLoadingMessage();
        }).error(function(jqXHR, textStatus, errorThrown) {
            window.alert('an error occurred on one or more deletions');
        });
    });
}