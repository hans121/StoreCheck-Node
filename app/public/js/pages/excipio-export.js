var excipio_export_page = (function () {
    var pc;

    var template_def =
        '{{?it.files.length == 0}}' +
            'No cases were found in the provided files' +
        '{{??}}' +
            '{{=it.file_count}} files<br>' +
            '{{=it.visit_count}} visits{{?it.duplicate_visits.length > 0}} ({{=it.duplicate_visits.length}} with duplicates){{?}}<br>' +
            '{{=it.sample_count}} samples<br>' +
            '{{~it.files :file_item:file_index}}' +
                '<hr>' +
                '<div class="excipio-label">Filename:</div>' + ' {{=file_item.file_name}}<br>' +
                '{{~file_item.cases :case_item}}' +
                    '<div class="excipio-label">Storecheck:</div> {{=case_item.b10_code}}<br>' +
                    '<div class="excipio-label">Visit:</div> {{=case_item.b06_code}} (<a target="_blank" href="/visit/view/{{=case_item.b17_code}}">{{=case_item.b17_code}}</a> )' +
                        '{{?it.visits[case_item.b17_code] && it.visits[case_item.b17_code].length > 1}}<div class="duplicate-label" style="color: red;">DUPLICATE</div>{{?}}<br>' +
                    '<div class="excipio-label">Sample count:</div> <a target="_blank" href="/samples/{{=case_item.sample_ids}}/view">{{=case_item.issue_list.length}}</a><br>' +

                    '{{~case_item.issue_list :issue}}' +
                        //'{{=issue.issue_details.length}} sample parameters/issue details' +
                    '{{~}}' +
                '{{~}}' +
            '{{~}}' +
        '{{?}}';

    var template = doT.template(template_def);

    function init() {
        pc = new PageController();

        var fileInput = $('.import-file-button');
        fileInput.fileupload({
            dataType: 'json',
            url: '/afsffs',
            singleFileUploads: false,
            sequentialUploads: false,
            add: function (e, data) {

                var parsed_data = [], visits = {}, samples = {};

                _readRemainingFiles(data.files, parsed_data, function(err_read, results) {
                    if(err_read) {
                        alert(err_read);
                        return;
                    }

                    var file_count = 0, case_id;

                    parsed_data.forEach(function(parsed_file) {
                        parsed_file.cases.forEach(function(case_item) {
                            // each case has:
                            // - issue_list: []
                            // - bXX_code attributes

                            var sample_ids_for_case = [];
                            case_item.issue_list.forEach(function(issue_details) {
                                if(typeof(issue_details.c82_code) != 'undefined') {
                                    samples[issue_details.c82_code] = 1;
                                    sample_ids_for_case.push(issue_details.c82_code);
                                }
                            });

                            case_item.sample_ids = sample_ids_for_case;

                            case_id = case_item['b17_code'];
                            visits[case_id] = (visits[case_id] ? visits[case_id] : []);
                            visits[case_id].push({
                                file: parsed_file.file_name,
                                case: case_item
                            });

                            file_count++;
                        });
                    });

                    var duplicate_visits = [];
                    var visit;
                    Object.keys(visits).forEach(function(visit_id) {
                        visit = visits[visit_id];
                        if(visit.length > 1) {
                            duplicate_visits.push(visit);
                        }
                    });

                    parsed_data.sort(function(a, b) {
                        return a == b ? 0 : (a < b ? -1 : 1);
                    });

                    $('.results-container').html(template({
                        files: parsed_data,
                        file_count: file_count,
                        visit_count: Object.keys(visits).length,
                        sample_count: Object.keys(samples).length,
                        duplicate_visits: duplicate_visits,
                        visits: visits
                    }));
                });
            },
            change: function(e) {
            },
            success: function () { //result, textStatus, jqXHR
                alert('success');
            },
            error: function(jqXHR) { //, textStatus, errorThrown
                alert('error');
            }
        });
    }

    function _readRemainingFiles(files, data_out, callback2) {
        if(files.length == 0) {
            callback2(null);
            return;
        }

        var file = files.pop();

        var reader = new FileReader();
        reader.onload = function() {
            try {
                var xml = $.parseXML(this.result);
                data_out.push(_parseXML(file, xml));
                _readRemainingFiles(files, data_out, callback2);

            } catch(ex) {
                callback2(ex);
            }
        };
        reader.readAsText(file);
    }

    function _parseXML(file_info, xml) {
        var representation = {
            file_name: file_info.name,
            cases: []
        };

        if(xml.childNodes.length == 0) {
            return representation;
        }

        var case_list = xml.childNodes[0];
        if(case_list.nodeName != 'CaseList') {
            return representation;
        }

        var i, case_element;
        for(i=0; i<case_list.children.length; i++) {
            case_element = case_list.children[i];

            if(case_element.nodeName == 'Case') {
                var case_data = _parseCase(case_element);
                representation.cases.push(case_data);
            }
        }

        return representation;
    }

    function _parseCase(case_xml) {
        var case_value = {
            issue_list: [],
            address_list: []
        };

        var i, case_child, attribute;

        for(i=0; i<case_xml.attributes.length; i++) {
            attribute = case_xml.attributes[i];
            case_value[attribute.nodeName] = attribute.value;
        }

        for(i=0; i<case_xml.children.length; i++) {
            case_child = case_xml.children[i];

            if(case_child.nodeName == 'IssueList') {
                case_value.issue_list = _parseIssueList(case_child);

            } else if(case_child.nodeName == 'AddressList') {
                case_value.address_list = _parseAddressList(case_child);
            }
        }

        return case_value;
    }

    function _parseIssueList(issue_list_xml) {
        var issue_list = [];

        var i, issue_xml;
        for(i=0; i<issue_list_xml.children.length; i++) {
            issue_xml = issue_list_xml.children[i];

            if(issue_xml.nodeName == 'Issue') {
                var issue_item = _parseIssue(issue_xml);
                issue_list.push(issue_item);
            }
        }

        return issue_list;
    }

    function _parseIssue(issue_xml) {
        var issue = {
            issue_details: []
        };

        var attribute;
        for(var j=0; j<issue_xml.attributes.length; j++) {
            attribute = issue_xml.attributes[j];
            issue[attribute.name] = attribute.value;
        }

        if(issue_xml.children.length != 1) {
            return issue;
        }

        var issue_detail_list_xml = issue_xml.children[0];

        var issue_element;
        for(var i=0; i<issue_detail_list_xml.children.length; i++) {
            issue_element = issue_detail_list_xml.children[i];

            // issue_element.attributes
            issue.issue_details.push({test: '1'});
        }

        return issue;
    }

    function _parseAddressList(address_xml) {
        var address_list = {};

        return address_list;
    }

    return {
        init: init
    };
}());

$(function() {
    excipio_export_page.init();
});