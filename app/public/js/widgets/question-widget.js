var question_widget = (function () {

    function init(sample, question, extra_data) {
        if(question.category_specific == "1") {
            return checkboxItemTemplate({ question: question, sample: sample });
        }
        if(question.category_specific == "2") {
            return datepickerItemTemplate({ question: question, sample: sample });
        }
        if(question.category_specific == "5") {
            return radioItemTemplate({ question: question, sample: sample });
        }
    }

    function addConformanceCheckHandler(parent_container) {
        parent_container.find('input[type=checkbox]').change(function() {

            // if this is an uncheck event, ignore it
            if(!$(this).prop('checked')) {
                return;
            }

            // if it's a conforming item, ignore it
            if($(this).data('weight') == 'A') {
                return;
            }

            var checked_answers_for_question = parent_container.find('[data-question=' + $(this).data('question') + '][data-sample=' + $(this).data('sample') + ']:checked');

            // if any answers for this question and sample are non-conform
            var found_nonconform = false;
            for(var i=0; i<checked_answers_for_question.length && !found_nonconform; i++) {
                if($(checked_answers_for_question[i]).data('weight') != 'A') {
                    found_nonconform = true;
                }
            }
            if(found_nonconform) {

                // uncheck all conforming checkboxes for this question
                parent_container.find('[data-question=' + $(this).data('question') + '][data-sample=' + $(this).data('sample') + '][data-weight=A]').removeAttr('checked');
            }
        });
    }

    // expects {question: [Object object]}
    var radioItemTemplate = doT.template(
        '<table class="template_value_field field_{{=it.question.identity_id}}">' +
            '{{~it.question.answers :answer:index}}' +
                '{{?answer.active == "true"}}' +
                    '<tr>' +
                        '<td style="padding: 0 8px 0 8px;">' +
                            '<input type="radio" style="margin-top: -1px;" ' +
                                'data-t03-code="{{=it.question.level1_code}}" ' +
                                'data-code="{{=answer.code}}" ' +
                                'value="{{=answer.identity_id}}" ' +
                                'name="group_{{=it.question.identity_id}}" ' +
                                '{{=(answer.value === "true" || answer.value === true) ? checked="checked" : ""}}/>' +
                        '</td>' +
                        '<td>' +
                            '<div class="conformance_box" style="background-color: {{=question_widget.getConformanceColor(answer.weight)}}"></div>' +
                        '</td>' +
                         '<td>{{=answer.text}}</td>'+
                    '</tr>' +
                '{{?}}' +
            '{{~}}' +
        '</table>'
    );

    // expects {question: [Object object]}
    var checkboxItemTemplate = doT.template(
        '<table class="template_value_field field_{{=it.question.identity_id}}">' +
            '{{~it.question.answers :answer:index}}' +
                '{{?answer.active == "true"}}' +
                    '<tr>' +
                        '<td style="padding: 0 8px 0 8px;">' +
                            '<input type="checkbox" style="margin-top: -1px;" ' +
                                'data-t03-code="{{=it.question.level1_code}}" ' +
                                'data-code="{{=answer.code}}" ' +
                                'value="{{=answer.identity_id}}" ' +
                                'data-weight="{{=question_widget.getWeightAsABC(answer.weight)}}" ' +
                                'data-sample="{{=it.sample._id}}"' +
                                'data-question="{{=it.question.identity_id}}" ' +
                                '{{=(answer.value === "true" || answer.value === true) ? checked="checked" : ""}}/>' +
                        '</td>' +
                        '<td>' +
                            '<div class="conformance_box" style="background-color: {{=question_widget.getConformanceColor(answer.weight)}}"></div>' +
                        '</td>' +
                         '<td>{{=answer.text}}</td>'+
                    '</tr>' +
                '{{?}}' +
            '{{~}}' +
        '</table>'
    );

    var datepickerItemTemplate = doT.template(
        '<div class="input-append date datepicker" data-date="{{=it.question.answers[0].value}}" data-date-format="dd-mmm-yyyy">' +
            '<input class="template_value_field field_{{=it.question.identity_id}}" placeholder="dd-mmm-yyyy" id="answer_{{=it.question.answers[0].identity_id}}" ' +
                'size="16" type="text" value="{{=it.question.answers[0].value}}" style="width: 110px; margin-right: -3px;">' +
            '<span class="add-on calendar-add-on">' +
                '<i class="icon-calendar"/>' +
            '</span>' +
        '</div>'
    );

    function getWeightAsABC(weight) {
        if(!weight) {
            return 'N/A'
        }

        if(weight == 'A' || weight == 'B' || weight == 'C') {
            return weight;
        }

        if(weight.toLowerCase() == 'non-conform') {
            return 'C';
        } else if(weight.toLowerCase() == 'alert') {
            return 'B';
        } else if(weight.toLowerCase() == 'conform') {
            return 'A';
        }
        return 'N/A';
    }

    function getConformanceColor(weight) {
        if(weight == 'A' || weight.toLowerCase() == 'conform') {
            return '#00EE00';
        } else if(weight == 'B' || weight.toLowerCase() == 'alert') {
            return '#EEEE00';
        } else if(weight == 'C' || weight.toLowerCase() == 'non-conform') {
            return '#EE0000';
        }
    }

    return {
        init : init,
        addConformanceCheckHandler: addConformanceCheckHandler,

        getWeightAsABC: getWeightAsABC,
        getConformanceColor: getConformanceColor
    };
}());
