var storecheck_list_page = (function () {

    function init() {
        var scc = new StoreCheckController();

        $('.active-storechecks-container > table').tablesorter( {
            sortList: [[0,0] ],

            headers: {
                2: { sorter: false, filter: false },
                4: { sorter: false, filter: false }
            }
        });

        $('.closed-storechecks-container > table').tablesorter( { sortList: [[0,0] ] });

        $('.store-check-name-modal').modal({ show : false, keyboard : true, backdrop : true });
        //$('.store-check-name-modal .submit').addClass('btn-danger');

        $('select.storecheck-state-select').change(function(e) {
            $('.active-storechecks-container').css('display', this.value == 'active' ? 'block' : 'none');
            $('.closed-storechecks-container').css('display', this.value == 'closed' ? 'block' : 'none');
        });

        $('select.storecheck-state-select').select2({
            placeholder: "Select a store check state",
            allowClear: false
        });

        $('.deactivate-storecheck-button').click(function() {
            scc.deactivateCheck($(this).data('id'));
        });

        $('.delete-storecheck-button').click(function() {
            scc.deleteCheck($(this).data('id'));
        });

        $('.duplicate-storecheck-button').click(function() {
            scc.duplicateCheck($(this).data('id'));
        });
    }

    return {
        init: init
    };
}());

$(function(){
    storecheck_list_page.init();
});
