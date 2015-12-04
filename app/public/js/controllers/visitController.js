VisitController.prototype = new PageController();
VisitController.prototype.constructor = VisitController;
function VisitController(visitId, auditorId, storeCheckId) {
    this.visitId = visitId;
    this.auditorId = auditorId;
    this.storeCheckId = storeCheckId;
}

VisitController.prototype.init = function() {
    var that = this;
    $('button.btn-new-visit').click(function() {
        if($('select.select-store-check').val()) {
            window.location.href="/visit/view/create?storecheck=" + $('select.select-store-check').val();
        } else {
            that.showAlert('You must select a store check', 'Error');
        }
    });

    $('button.btn-create-visit').click(function() { that.createVisit(); return false; });
    $('button.btn-update-visit').click(function() { that.updateVisit(); return false; });
    $('button.btn-close-visit').click(function() { that.closeVisit(); return false; });
    $('button.btn-export-samples').click(function() { that.exportSamples(); return false; });
    $('button.btn-visit-grid').click(function() { window.location.href="/visit/grid/view/" + that.visitId; return false; });
    $('select.select-store-check').change(function () { that.onStoreCheckSelected($('select.select-store-check').val(), $('select.visit-state-select').val()); return false; });
};

VisitController.prototype.createVisit = function() {
    $('.modal-confirm').modal('hide');
    var that = this,
        dateOfVisit = $('#date-of-visit-input').val(),
        posId = $('.pos-address-selection').attr('value');
        auditorName = $('#auditor-name-input').val();

    that.showLoadingMessage('Creating...');
    $.ajax({
        url: '/visit',
        type: 'PUT',
        data: {
            auditor_id:     that.auditorId,
            date_of_visit:  dateOfVisit,
            pos_id:         posId,
            store_check_id: that.storeCheckId,
            auditor_name:   auditorName
        },
        success: function(data){
            window.location.href = '/visit/view/' + data;
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
};

VisitController.prototype.updateVisit = function() {
    $('.modal-confirm').modal('hide');
    var that = this,
        name = $('#identifier-input').val(),
        dateOfVisit = $('#date-of-visit-input').val(),
        auditorName = $('#auditor-name-input').val(),
        ids = $.map($('td.sample-id'), function (v, i) {
            return $(v).text();
        });

    that.showLoadingMessage('Saving...');
    $.ajax({
        url: '/visit/' + that.visitId,
        type: 'POST',
        data: {
            name:          name,
            date_of_visit: dateOfVisit,
            samples:       ids,
            auditor_name:  auditorName
        },
        success: function(){
            window.location.reload();
        },
        error: function(jqXHR){
            that.showAlert('Visit could not be updated.  Reason: ' + jqXHR.responseText, 'Error');
        }
    });
};

VisitController.prototype.closeVisit = function() {
    var that = this;

    that.showConfirmation('Are you sure you want to submit this visit?<BR>It will submit all unsubmitted samples associated with it', 'Confirm Submission', 'Yes', function() {
        that.showLoadingMessage('Submitting...');
        $.ajax({
            url: '/visit/' + that.visitId + '?state=submitted',
            type: 'POST',
            success: function(){
                window.location.reload();
            },
            error: function(jqXHR){
                that.showAlert('Visit could not be submitted.  Reason: ' + jqXHR.responseText, 'Error');
            }
        });
    });
};

VisitController.prototype.exportSamples = function() {
    var that = this;

    that.showConfirmation('Are you sure you want to export all samples for this visit?', 'Confirm Export', 'Yes', function() {
        that.showLoadingMessage('Exporting...');
        $.ajax({
            url: '/visit/' + that.visitId + '/samples?action=export',
            type: 'POST',
            success: function(){
                window.location.reload();
            },
            error: function(jqXHR){
                that.showAlert('Visit could not be exported.', 'Error');
            }
        });
    });
};

VisitController.prototype.addSampleType = function(product_id, template_id, name, metaCopyTarget) {
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
            window.location.reload();
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
};

VisitController.prototype.buildTable = function(visits) {
    var tableHtml = '<table class="table table-bordered table-striped" width="100%">';

    tableHtml += '<thead><tr>';
    tableHtml += '<th class="filter-select">Visit ID</th>';
    tableHtml += '<th class="filter-select">Point of Sale</th>';
    tableHtml += '<th class="sorter-shortDate filter-select">Date of Visit</th>';
    tableHtml += '<th class="filter-select">Sales Region</th>';
    tableHtml += '<th class="filter-select">Auditor</th>';
    tableHtml += '<th>Last Updated</th>';
    tableHtml += '<th width="50px;"></th>';
    tableHtml += '</tr></thead>';

    for(var i=0; i<visits.length; i++) {
        tableHtml += '<tr>';
        tableHtml += '<td>' + '<a href="/visit/view/' + visits[i]._id + '">' + visits[i].pos_name + ' ' + visits[i].date_of_visit + '</a></td>';
        tableHtml += '<td>' + visits[i].pos_name + '</td>';
        tableHtml += '<td>' + visits[i].date_of_visit + '</td>';
        tableHtml += '<td>' + (visits[i].pos ? visits[i].pos.a48_code : '') + '</td>';
        tableHtml += '<td>' + visits[i].auditor_name + '</td>';
        tableHtml += '<td>' + moment(visits[i].last_update_time).local().calendar() + '</td>';
        tableHtml += '<td style="text-align: right;">';
        tableHtml += '<span><a href="/visit/view/' + visits[i]._id + '" style="margin-right: 10px; color: #00aa00;">';
        tableHtml += '<i class="icon-pencil ui-tooltip" data-placement="bottom" data-original-title="Edit"/></a>';
        tableHtml += '<a class="delete_visit" id="delete_' + visits[i]._id + '" style="cursor: pointer; color: #aa0000;">';
        tableHtml += '<i class="icon-trash ui-tooltip" data-placement="bottom" data-original-title="Delete"/></a>';
        tableHtml += '</span></td>';
    }
    //onclick="deleteVisit(' +  + ');" style="margin-left: 5px; cursor: pointer;">

    return tableHtml;
};

VisitController.prototype.onStoreCheckSelected = function(storeCheckId, state) {
    if(storeCheckId != null && storeCheckId.length > 0) {
        $('.visit-list-container').html('');
        var that = this;
        $.ajax({
            type: 'GET',
            url: '/store-check/' + storeCheckId + '/visits?statuses=' + state
        }).done(function(result) {
            function getVisitName(visit) { return visit.pos_name + ' ' + visit.date_of_visit; }
            result.sort(function(a, b) { var as = getVisitName(a).toLowerCase(), bs = getVisitName(b).toLowerCase(); return (as > bs ? 1 : (as < bs ? -1 : 0)); });
            $('.store-check-description-container > span').css('display', 'none');
            $('.store-check-description-container').find('.' + storeCheckId).css('display', '');

            $('.visit-list-container').html(that.buildTable(result));
            $('.visit-list-container > table').tablesorter( {
                sortList: [[0,0] ],
                widgets: ["filter"],

                headers: {
                    5: { sorter: false, filter: false },
                    6: { sorter: false, filter: false }
                },

                widgetOptions : {
                    filter_childRows : false,
                    filter_columnFilters : true,
                    filter_cssFilter : '',
                    filter_filteredRow   : 'filtered',
                    filter_formatter : null,
                    filter_functions : null,
                    filter_hideFilters : false,
                    filter_ignoreCase : true,
                    filter_liveSearch : true,
                    filter_reset : 'button.reset',
                    filter_searchDelay : 300,
                    filter_serversideFiltering: false,
                    filter_startsWith : false,
                    filter_useParsedData : false
                }
            } );
            $('.delete_visit').unbind('click');
            $('.delete_visit').click(function(evt) {
                var id = evt.currentTarget.id.substring(7, evt.currentTarget.id.length);
                that.deleteVisitWithConfirmation(id);
            });
            tooltip_wrapper.init(".ui-tooltip");
        }).error(function(jqXHR, textStatus, errorThrown) {
            that.showAlert(jqXHR.responseText, 'Error');
        });
    } else {
        $('.visit-list-container').html('');
    }
};

VisitController.prototype.getSelectedStoreCheck = function() {
    return $('select.select-store-check').val();
};

VisitController.prototype.deleteVisitWithConfirmation = function(id) {
    $('.modal-confirm').modal({ show : false, keyboard : true, backdrop : true });
    $('.modal-confirm .modal-header h3').text('Delete Visit');
    $('.modal-confirm .modal-body p').html('Are you sure you want to delete this visit?');
    //$('.modal-confirm .cancel').html('Cancel');
    //$('.modal-confirm .submit').html('Delete');
    $('.modal-confirm .submit').addClass('btn-danger');

    var that = this;
    $('.modal-confirm .submit').click(function(){ that.deleteVisit(id); });
    $('.modal-confirm').modal('show');
};

VisitController.prototype.deleteVisit = function(id) {
    var that = this;
    $('.modal-confirm').modal('hide');
    that.showLoadingMessage('Deleting...');
    var current_storecheck = this.getSelectedStoreCheck();
    $.ajax({
        url: '/visit/' + id,
        type: 'delete',
        success: function(data){
            window.location.href = '/home' + (typeof(current_storecheck) != 'undefined' ? '?store-check=' + current_storecheck : '');
        },
        error: function(jqXHR){
            that.showAlert(jqXHR.responseText, 'Error');
        }
    });
    $('.modal-confirm').modal('hide');
};

VisitController.prototype.deleteSampleWithConfirmation = function(id, visitId) {
    $('.modal-confirm').modal({ show : false, keyboard : true, backdrop : true });
    $('.modal-confirm .modal-header h3').text('Delete Sample');
    $('.modal-confirm .modal-body p').html('Are you sure you want to delete this sample?');
    //$('.modal-confirm .cancel').html('Cancel');
    //$('.modal-confirm .submit').html('Delete');
    $('.modal-confirm .submit').addClass('btn-danger');

    var that = this;
    $('.modal-confirm .submit').click(function(){ that.deleteSample(id, visitId); });
    $('.modal-confirm').modal('show');
};

VisitController.prototype.deleteSample = function(id, visitId) {
    var data = {
        id: id
    }, that = this;
    $.ajax({
        type: 'POST',
        data: data,
        url: '/sample/delete'
    }).done(function(result) {
        window.location.href = '/visit/view/' + visitId;
    }).error(function(jqXHR, textStatus, errorThrown) {
        that.showAlert(jqXHR.responseText, 'Error');
    });
    $('.modal-confirm').modal('hide');
};//