var action_audit_list_page = (function () {
    var pc;

    function init() {
        pc = new PageController();

        loadHistory();

        $('.exclusion').click(function() {
            loadHistory();
        });
    }

    function loadHistory() {
        var url = '/action-audits';

        var exclusions = $('input.exclusion:checked');
        if(exclusions.length > 0) {
            url += '?exclude-resources=';

            for(var i=0; i<exclusions.length; i++) {
                url += (i == 0 ? '' : ',');
                url += $(exclusions[i]).data('exclude');
            }
        }

        $.ajax({
            url: url,
            type: 'GET',
            data: {
            },
            success: function(data){
                var html = '';
                data.forEach(function(audit_record) {
                    html += '<tr>';
                    html += '<td>' + audit_record.timestamp + '</td>';
                    html += '<td>' + moment(audit_record.timestamp).local().format('YYYY-MM-DDTHH:mm:ss') + '</td>';
                    html += '<td>' + audit_record.action + '</td>';
                    html += '<td>' + audit_record.resource + '</td>';
                    if(audit_record.details != null && Array.isArray(audit_record.details)) {
                        html += '<td style="word-break: break-all;">' + (audit_record.details.toString().replace(/,/g,", ")) + '</td>';
                    } else {
                        html += '<td style="word-break: break-all;">' + audit_record.details + '</td>';
                    }
                    html += '<td>' + audit_record.agent.user + '</td>';
                    html += '</tr>';
                });
                $('table tbody').html(html);

                $.tablesorter.addParser({
                    id: "customDate",
                    is: function(s) {
                        //return false;
                        //use the above line if you don't want table sorter to auto detected this parser
                        //else use the below line.
                        //attention: doesn't check for invalid stuff
                        //2009-77-77 77:77:77.0 would also be matched
                        //if that doesn't suit you alter the regex to be more restrictive
                        return /\d{1,4}-\d{1,2}-\d{1,2} \d{1,2}:\d{1,2}:\d{1,2}/.test(s);
                    },
                    format: function(s) {
                        s = s.replace(/\-/g," ");
                        s = s.replace(/:/g," ");
                        s = s.replace(/T/g," ");
                        s = s.replace(/\./g," ");
                        s = s.split(" ");
                        var parsedDate = new Date(s[0], s[1]-1, s[2], s[3], s[4], s[5]);
                        return $.tablesorter.formatFloat(parsedDate.getTime());
                    },
                    type: "numeric"
                });

                $('table.audit-table').tablesorter( {
                    sortList: [[0,1] ],

                    widthFixed : true,
                    widgets: ["filter"],
                    headers: {
                        1: { sorter: 'customDate' }
                    },

                    widgetOptions : {

                        // If there are child rows in the table (rows with class name from "cssChildRow" option)
                        // and this option is true and a match is found anywhere in the child row, then it will make that row
                        // visible; default is false
                        filter_childRows : false,

                        // if true, a filter will be added to the top of each table column;
                        // disabled by using -> headers: { 1: { filter: false } } OR add class="filter-false"
                        // if you set this to false, make sure you perform a search using the second method below
                        filter_columnFilters : true,

                        // extra css class applied to the table row containing the filters & the inputs within that row
                        filter_cssFilter : '',

                        // class added to filtered rows (rows that are not showing); needed by pager plugin
                        filter_filteredRow   : 'filtered',

                        // add custom filter elements to the filter row
                        // see the filter formatter demos for more specifics
                        filter_formatter : null,

                        // add custom filter functions using this option
                        // see the filter widget custom demo for more specifics on how to use this option
                        filter_functions : null,

                        // if true, filters are collapsed initially, but can be revealed by hovering over the grey bar immediately
                        // below the header row. Additionally, tabbing through the document will open the filter row when an input gets focus
                        filter_hideFilters : false,

                        // Set this option to false to make the searches case sensitive
                        filter_ignoreCase : true,

                        // if true, search column content while the user types (with a delay)
                        filter_liveSearch : true,

                        // jQuery selector string of an element used to reset the filters
                        filter_reset : 'button.reset',

                        // Delay in milliseconds before the filter widget starts searching; This option prevents searching for
                        // every character while typing and should make searching large tables faster.
                        filter_searchDelay : 300,

                        // if true, server-side filtering should be performed because client-side filtering will be disabled, but
                        // the ui and events will still be used.
                        filter_serversideFiltering: false,

                        // Set this option to true to use the filter to find text from the start of the column
                        // So typing in "a" will find "albert" but not "frank", both have a's; default is false
                        filter_startsWith : false,

                        // Filter using parsed content for ALL columns
                        // be careful on using this on date columns as the date is parsed and stored as time in seconds
                        filter_useParsedData : false
                    }
                });

                audit_chart.draw($('.action-chart-container'), data);
            },
            error: function(jqXHR){
                pc.showAlert(jqXHR.responseText, 'Error');
            }
        });
    }

    return {
        init: init
    };
}());

$(function(){
    action_audit_list_page.init();
});
