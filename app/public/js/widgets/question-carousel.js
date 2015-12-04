var question_control = (function (my) {

    var read_only, page_controller, question_id, prior_question_id, next_question_id;

    function init(read_only_in, page_controller_in, question_id_in, prior_question_id_in, next_question_id_in) {
        read_only = read_only_in;
        page_controller = page_controller_in;
        question_id = question_id_in;
        prior_question_id = prior_question_id_in;
        next_question_id = next_question_id_in;
    }

    function next() {
        if(read_only) {
            page_controller.showLoadingMessage('Loading...');
            window.location.href = window.location.pathname + '?questionId=' + prior_question_id;
        } else {
            save_raw(question_id, next_question_id);
        }
    }

    function save() {
        if(read_only) {
            page_controller.showLoadingMessage('Loading...');
            window.location.reload();
        } else {
            save_raw(question_id, question_id);
        }
    }

    function previous() {
        if(read_only) {
            page_controller.showLoadingMessage('Loading...');
            window.location.href = window.location.pathname + '?questionId=' + prior_question_id;
        } else {
            save_raw(question_id, prior_question_id);
        }

    }

    function addAnswers(data) {

        // process radio buttons
        var answer_fields = $('input[type="radio"].answer_field:checked'), current_answer_field;
        if(answer_fields.length > 0) {
            for(var i=0; i<answer_fields.length; i++) {
                current_answer_field = $(answer_fields[i]);

                var answered_question = {};
                answered_question.sample_id = current_answer_field[0].name;
                answered_question.answer = current_answer_field.data('answer');
                data.answers.push(answered_question);
            }
            return answer_fields;
        }

        // process checkboxes
        answer_fields = $('input[type="checkbox"].answer_field:checked');
        if(answer_fields.length > 0) {
            var sample_answers = {};
            for(var i=0; i<answer_fields.length; i++) {
                current_answer_field = $(answer_fields[i]);

                sample_answers[answer_fields[i].name] = sample_answers[answer_fields[i].name] ? sample_answers[answer_fields[i].name] : [];
                sample_answers[answer_fields[i].name].push(current_answer_field.data('answer'));
            }


            Object.keys(sample_answers).forEach(function(sample_id) {
                var answered_question = { sample_id: sample_id, answer: '' };
                sample_answers[sample_id].forEach(function(answer) {
                    answered_question.answer += (answered_question.answer.length > 0 ? ',' + answer : answer);
                });
                data.answers.push(answered_question);
            });

            return answer_fields;
        }

        // process input types
        answer_fields = $('input[type="text"].answer_field');
        if(answer_fields.length == 0) {
            answer_fields = $('input[type="number"].answer_field');
        }
        if(answer_fields.length > 0) {
            // process text input/datepicker
            for(var i=0; i<answer_fields.length; i++) {
                var answered_question = {};
                answered_question.sample_id = answer_fields[i].id.split('_')[1];
                answered_question.answer = answer_fields[i].value;
                data.answers.push(answered_question);
            }
            return answer_fields;
        }

        // process select types
        answer_fields = $('select.answer_field');
        if(answer_fields.length > 0) {

            for(var i=0; i<answer_fields.length; i++) {
                var answered_question = {};
                answered_question.sample_id = answer_fields[i].id.split('_')[1];
                answered_question.answer = answer_fields[i].value;
                data.answers.push(answered_question);
            }
        }
        return answer_fields;
    }

    function save_raw(question_id, new_current_question_id) {
        var that = this;

        var data = {};
        data.question_id = question_id;
        data.answers = [];

        var answer_fields = addAnswers(data);

        if(answer_fields.length > 0) {
            page_controller.showLoadingMessage('Saving...');

            $.ajax({
                url: '/sample/answer',
                type: 'POST',
                data: data,
                success: function(data){
                    window.location.href = window.location.pathname + '?questionId=' + new_current_question_id;
                },
                error: function(jqXHR){
                    page_controller.hideLoadingMessage();
                    page_controller.showAlert('An error has occurred: ' + jqXHR.responseText, 'Error');
                }
            });
        } else {
            window.location.href = window.location.pathname + '?questionId=' + new_current_question_id;
        }
    }

    return {
        init : init,
        save : save,
        next : next,
        previous: previous
    };
}(question_control));