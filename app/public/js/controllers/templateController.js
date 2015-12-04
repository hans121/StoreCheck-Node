TemplateController.prototype = new PageController();
TemplateController.prototype.constructor = TemplateController;
function TemplateController() {
    $('.modal-confirm .submit').addClass('btn-danger');
}

TemplateController.prototype.update = function(template) {
    var that = this;
    this.showLoadingMessage('Saving...');
    $.ajax({
        type: 'POST',
        data: template,
        url: '/template/' + template._id
    }).done(function(result) {
        window.location.href = '/template/view/' + template._id;
    }).error(function(jqXHR, textStatus, errorThrown) {
        that.showAlert(jqXHR.responseText, 'Error');
    });
};

TemplateController.prototype.deleteTemplate = function(id) {
    var that = this;
    that.showConfirmation('Are you sure you want to deactivate this audit grid template?', 'Deactivate', 'Yes', function() {
        that.showLoadingMessage('Deactivating...');
        $.ajax({
            type: 'DELETE',
            url: '/template/' + id
        }).done(function(result) {
            window.location.href = '/templates/view';
        }).error(function(jqXHR, textStatus, errorThrown) {
            that.showAlert(jqXHR.responseText, 'Error');
        });
    });
};


TemplateController.prototype.reactivateTemplate = function(id) {
    var that = this;
    that.showConfirmation('Are you sure you want to reactivate this audit grid template?', 'Reactivate', 'Yes', function() {
        that.showLoadingMessage('Reactivating...');
        $.ajax({
            type: 'POST',
            url: '/template/' + id + '?state=active'
        }).done(function(result) {
            window.location.href = '/templates/view';
        }).error(function(jqXHR, textStatus, errorThrown) {
            that.showAlert(jqXHR.responseText, 'Error');
        });
    });
};

TemplateController.prototype.sortLevel5Questions = function(level5_results) {
    // Sort each items' questions by sequence
    for(var i = 0; i < level5_results.length; i++) {
        level5_results[i].children.sort(function(a, b) {
            return (parseInt(a.sequence, 10) - parseInt(b.sequence, 10));
        });
    }

    // Make a sequence tuple and then lex sort it
    level5_results.sort(function (a, b) {
        var aTuple = [parseInt(a.level1_sequence, 10), parseInt(a.level2_sequence, 10), parseInt(a.level3_sequence, 10), parseInt(a.level4_sequence, 10), parseInt(a.sequence, 10)];
        var bTuple = [parseInt(b.level1_sequence, 10), parseInt(b.level2_sequence, 10), parseInt(b.level3_sequence, 10), parseInt(b.level4_sequence, 10), parseInt(b.sequence, 10)];

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

TemplateController.prototype.generateTemplateFromTable = function(language, company_id, t03_code, t03_description, t01_code, name) {
    var i, active_check, is_active, that = this;
    var active_fields = $('.template_active_field');

    //  TODO: Find out whether there are multiple L1 codes and languages allowed in the same template
    var template = {};

    // template.name will be modified in by server
    template.name = name;

    template.records = [];
    var level1_record = {};
    level1_record.language = language; // selectedLanguage;
    level1_record.t01_code = t01_code;
    level1_record.t03_code = t03_code;
    level1_record.t03_description = t03_description;
    level1_record.timestamp_L5 = that.timestamp_L5;
    level1_record.company_id = company_id;
    level1_record.questions = [];
    // level1_record.creation_time to be filled in by server
    // level1_record.created_by to be filled in by server

    var level5_records = {};

    // fill in question_data for each record!
    for(i=0; i<active_fields.length; i++) {
        active_check = active_fields.get(i);
        is_active = active_check.checked;
        var answer_id = active_check.id.substring(7, active_check.length);
        var active_check_class = active_check.getAttribute('class');
        var parent_id = active_check_class.substring(active_check_class.indexOf('level0_active_') + 14, active_check_class.length);

        var level5_record = level5_records[parent_id];
        if(typeof level5_record == 'undefined') {
            level5_record = { answers: [] };
            level5_records[parent_id] = level5_record;
        }

        var weight = $('#weight_' + answer_id).val();

        var field = $("#field_" + answer_id);
        var field_value = field.val();
        if(field.length > 0) {
            var fieldType = field.get(0).getAttribute('type');
            if(fieldType == "radio") {
                field_value = (field.get(0).checked ? "true" : "false");
            }
        }
        level5_record.answers.push({
            identity_id: answer_id,
            active: is_active,
            value: field_value,
            weight: weight
        });
    }

    for(var question in level5_records) {
        var questionJSON = {
            identity_id: question,
            answers: level5_records[question].answers
        };
        level1_record.questions.push(questionJSON);
    }

    template.records.push(level1_record);
    return template;
};

TemplateController.prototype.makeTable = function(container, data) {
    var that = this;

    var tableHtml = '<table class="table table-bordered table-striped" width="100%">';

    tableHtml += '<thead><tr>';
    tableHtml += '<th>Group of Criteria</th>';
    tableHtml += '<th>Criteria</th>';
    tableHtml += '<th>Parameter</th>';
    tableHtml += '<th>Item</th>';
    tableHtml += '<th colspan="2">Defect</th>';
    tableHtml += '<th>Weight</th>';
    tableHtml += '</tr></thead>';

    // variables for rowspans
    var prior_first_L2_desc = null, prior_first_L3_desc = null, prior_first_L4_desc = null, prior_first_L5_desc = null;
    var pending_L2_spans = 0, pending_L3_spans = 0, pending_L4_spans = 0, pending_L5_spans = 0;
    var i, j;
    for(i=0; i<data.length; i++) {

        // process level 2 rowspans
        if(data[i].level2_description2 != prior_first_L2_desc) {
            pending_L2_spans = data[i].children.length;
            for(j=i+1; j<data.length; j++) {
                if(data[i].level2_description2 != data[j].level2_description2) {
                    break;
                } else {
                    pending_L2_spans += data[j].children.length;
                }
            }
            prior_first_L2_desc = data[i].level2_description2;
        }
        // process level 3 rowspans
        if(data[i].level3_description2 != prior_first_L3_desc) {
            pending_L3_spans = data[i].children.length;
            for(j=i+1; j<data.length; j++) {
                if(data[i].level3_description2 != data[j].level3_description2) {
                    break;
                } else {
                    pending_L3_spans += data[j].children.length;
                }
            }
            prior_first_L3_desc = data[i].level3_description2;
        }
        // process level 4 rowspans
        if(data[i].level4_description2 != prior_first_L4_desc) {
            pending_L4_spans = data[i].children.length;
            for(j=i+1; j<data.length; j++) {
                if(data[i].level4_description2 != data[j].level4_description2) {
                    break;
                } else {
                    pending_L4_spans += data[j].children.length;
                }
            }
            prior_first_L4_desc = data[i].level4_description2;
        }
        // process level 5 rowspans
        if(data[i].description2 != prior_first_L5_desc) {
            pending_L5_spans = data[i].children.length;
            for(j=i+1; j<data.length; j++) {
                if(data[i].description2 != data[j].description2) {
                    break;
                } else {
                    pending_L5_spans += data[j].children.length;
                }
            }
            prior_first_L5_desc = data[i].description2;
        }

        for(j=0; j<data[i].children.length; j++) {
            tableHtml += '<tr>';
            if(pending_L2_spans > 0) {
                tableHtml += '<td rowspan="' + pending_L2_spans + '" align="center" valign="top" style="background-color: #FFF;">' + data[i].level2_description2 + '</td>';
            }
            if(pending_L3_spans > 0) {
                tableHtml += '<td rowspan="' + pending_L3_spans + '" align="center" valign="top" style="background-color: #FFF;">' + data[i].level3_description2 + '</td>';
            }
            if(pending_L4_spans > 0) {
                tableHtml += '<td rowspan="' + pending_L4_spans + '" align="center" valign="top" style="background-color: #FFF;">' + data[i].level4_description2 + '</td>';
            }
            if(pending_L5_spans > 0) {
                tableHtml += '<td rowspan="' + pending_L5_spans + '" align="center" valign="top" style="background-color: #FFF;">' +
                    data[i].description2 +
                    '<div><input type="checkbox" class="level5_' + data[i].identity_id + '" style="margin: 0;" checked' + (typeof(that.template) != 'undefined' && that.template.read_only ? ' disabled' : '') + '> active</div>' +
                    '</td>';
            }
            tableHtml += '<td><div>' + data[i].children[j].text + '</div>' + '</td>';
            tableHtml += '<td width="70px">' + '<input type="checkbox" id="active_' + data[i].children[j].identity_id +
                '" class="template_active_field level0_active_' + data[i].identity_id +
                '" checked' + (typeof(that.template) != 'undefined' && that.template.read_only ? ' disabled' : '') + '> active</input>' + '</td>';

            tableHtml += that.generateWeightElement(data[i], data[i].children[j]);

            tableHtml += '</tr>';

            pending_L2_spans = 0;
            pending_L3_spans = 0;
            pending_L4_spans = 0;
            pending_L5_spans = 0;
        }
    }

    tableHtml += '</tbody></table>';
    container.html(tableHtml);

    $("input[class^='level5_']").change(function() {
        var checked = $('.' + this.className)[0].checked ? true : false;
        var identity_id = this.className.split('_')[1];

        var level0_items = $('.level0_active_' + identity_id);
        if(checked) {
            level0_items.attr('checked', 'checked');
        } else {
            level0_items.removeAttr('checked');
        }
    });

    $("input.template_active_field").change(function() {
        var L5_identity_id;
        this.className.split(' ').forEach(function(current_class) {
            if(current_class.indexOf('level0_active') != -1) {
                L5_identity_id = current_class.split('_')[2];
                var other_L5_checks = $('.level0_active_' + L5_identity_id + ':checked');

                if(other_L5_checks.length > 0) {
                    $('.level5_' + L5_identity_id).attr('checked', 'checked');
                } else {
                    $('.level5_' + L5_identity_id).removeAttr('checked');
                }
            }
        });
    });
};

var acceptable_weights = ['A', 'B', 'C', 'CONFORM', 'NON-CONFORM', 'ALERT'];

TemplateController.prototype.generateWeightElement = function(record, L0_item) {
    // 1. Answer is one or multiple code values from a list of choices.
    // 2. A date entry with assistance from a displayed calendar.
    // 3. A numeric value, either real or integer.
    // 4. Free text entry.
    // 5. Answer is only one code value from a list of choices presented as radio buttons.
    // 6. Answer is only one code value from a list of choices presented as a pull-down list.
    // 7. Calculated and displayed from values previously entered; requiring no direct data entry.
    if(record.category_specific != '1' && record.category_specific != '5' && record.category_specific != '6') {
        return '<td></td>';
    }

    if(L0_item.weight == "") {
        return '<td></td>';
    }

    var tableHtml = '<td><select style="width: auto; margin-bottom: 0;" class="template_weight_field" id=weight_' + L0_item.identity_id + (typeof(this.template) != 'undefined' && this.template.read_only ? ' disabled' : '') + '>';
    for(var k=0; k<record.category_specific_options.length; k++) {
        if(acceptable_weights.indexOf(L0_item.weight) == -1) {
            L0_item.weight = '';
        }
        tableHtml += this.generateOptionItem(record.category_specific_options[k], L0_item.weight);
    }
    tableHtml +=    '</select></td>';
    return tableHtml;
};

TemplateController.prototype.generateOptionItem = function(weight_enum_item, actual_weight) {
    var selected_string = (actual_weight == weight_enum_item ? ' selected' : '');
    return '<option value="' + weight_enum_item + '"' + selected_string + '>' +
                (weight_enum_item == "" ? "N/A" : weight_enum_item) +
            '</option>';
};

TemplateController.prototype.loadTemplateInstance = function(container, templateId, loadedTemplateCallback) {
    var that = this;

    $.ajax({
        type: 'GET',
        url: '/template/' + templateId
    }).done(function(template_result) {

        that.template = template_result;
        if(loadedTemplateCallback) {
            loadedTemplateCallback(template_result);
        }

        // the data structure supports multiple template selections, but the requirements don't ask for it
        var level1_record = template_result.records[0];

        var data = {
            company_id: level1_record.company_id,
            t03_code: level1_record.t03_code,
            language: level1_record.language
        };

        $.ajax({
            type: 'GET',
            data: data,
            url: '/template/level/5/' + level1_record.timestamp_L5
        }).done(function(level5_result) {

            that.timestamp_L5 = level5_result.timestamp;
            that.sortLevel5Questions(level5_result);
            that.makeTable(container, level5_result);

            // for each question, update the GUI
            var active_check, value_field, isAnAnswerActive;
            level1_record.questions.forEach(function(question_instance) {
                isAnAnswerActive = false;
                question_instance.answers.forEach(function(answer) {
                    if(answer.active == "false") {
                        active_check = $('#active_' + answer.identity_id);
                        active_check.get(0).removeAttribute("checked");
                    } else {
                        isAnAnswerActive = true;
                    }
                    value_field = $('#field_' + answer.identity_id);
                    if(value_field.length > 0) {
                        if(value_field.get(0).type == "radio" && answer.value == "true") {
                            value_field.attr('checked', 'checked');
                        }
                    }

                    $('#weight_' + answer.identity_id).val(answer.weight);
                });
                if(!isAnAnswerActive) {
                    $('input.level5_' + question_instance.identity_id).removeAttr("checked");
                }
            });
        }).error(function(jqXHR, textStatus, errorThrown) {
            that.showAlert(jqXHR.responseText, 'Error');
        });
    });
};

function _findAnswerInTemplate(template, answer_id) {
    var matching_answer = null;

    // to improve, could use "every" unless worried about backwards-compat
    template.records[0].questions.forEach(function(old_question) {
        if(matching_answer) {
            return;
        }

        var answer_candidates = old_question.answers.filter(function(old_answer) {
            return old_answer.identity_id == answer_id;
        });

        if(answer_candidates.length > 0) {
            matching_answer = answer_candidates[0];
        }
    });

    return matching_answer;
}

TemplateController.prototype.updateTemplate = function() {
    var new_template = this.generateTemplateFromTable(this.template.records[0].language,
        this.template.records[0].company_id,
        this.template.records[0].t03_code);

    // loop through children of the new template and update the old template
    // this is done because we don't want to assume the questions are in the same position
    var i, j, k, p, current_answer, current_gui_answer;
    this.template.records[0].questions.forEach(function(old_question) {
        old_question.answers.forEach(function(old_answer) {

            var matching_answer_from_ui = _findAnswerInTemplate(new_template, old_answer.identity_id);

            if(matching_answer_from_ui) {
                old_answer.active = matching_answer_from_ui.active;
                old_answer.value = matching_answer_from_ui.value;
                old_answer.weight = matching_answer_from_ui.weight;
            } else {
                console.log('warning: could not find matching template answer when saving answer ' + old_answer.identity_id);
            }
        });
    });

    // save template back to the db
    this.update(this.template);
};

TemplateController.prototype.loadLevel5 = function(container, company_id, t03_code, selectedLanguage) {
    var that = this;
    var query_string = '?company_id=' + company_id + '&t03_code=' + t03_code + '&language=' + selectedLanguage;

    $.ajax({
        type: 'GET',
        url: '/template/level/5/latest' + query_string
    }).done(function(result) {
        if(result && result != null && result.length > 0) {
            that.timestamp_L5 = result[0].timestamp;
            that.sortLevel5Questions(result);
            that.makeTable(container, result);
        }
    }).error(function(jqXHR, textStatus, errorThrown) {
        that.showAlert(jqXHR.responseText, 'Error');
    });
};

TemplateController.prototype.duplicateTemplate = function(id) {
    var that = this;

    $('.template-name-modal').modal('show');
    $('.template-name-modal button.submit').click(function() {
        $('.template-name-modal').modal('hide');
        $.ajax({
            url: '/template/' + id + '?action=duplicate',
            type: 'POST',
            data: {
                name: $('.template-name-modal input').val()
            },
            success: function(data){
                that.showLockedAlert('Template duplicated', 'Success!', window.location.href);
            },
            error: function(jqXHR){
                that.showAlert(jqXHR.responseText, 'Error');
            }
        });
        return false;
    });
};