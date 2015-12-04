var system_info_widget = (function () {

    var info_template_ref =
        '<label>Hostname</label><span>{{=it.hostname}}</span><div class="clearfix"></div>' +
        '{{?it.node_env}}<label>Environment</label><span>{{=it.node_env}}</span><div class="clearfix"></div>{{?}}' +
        '{{?it.app_instance}}<label>Instance</label><span>{{=it.app_instance}}</span><div class="clearfix"></div>{{?}}' +
        '<label>Node version</label><span>{{=it.versions.node}}</span><div class="clearfix"></div>' +
        '<label>Type</label><span>{{=it.type}}</span><div class="clearfix"></div>' +
        '<label>Platform</label><span>{{=it.platform}}</span><div class="clearfix"></div>' +
        '<label>Architecture</label><span>{{=it.architecture}}</span><div class="clearfix"></div>' +
        '<label>Uptime</label><span>{{=it.uptime.humanize()}} ({{=it.uptime.asSeconds()}} seconds)</span><div class="clearfix"></div>' +
        '<label>Process Uptime</label><span>{{=it.process_uptime.humanize()}} ({{=it.process_uptime.asSeconds()}} seconds)</span><div class="clearfix"></div>' +
        '{{?it.sftp}}<label>SFTP</label><span>{{=it.sftp}}</span><div class="clearfix"></div>{{?}}' +
        '<label>Memory</label><span>{{=general_util.bytesToSize(it.free_memory)}} of {{=general_util.bytesToSize(it.total_memory)}} ({{=(100 * it.free_memory / it.total_memory).toFixed(2)}}%) free</span><div class="clearfix"></div>' +
        '<div class="meter"><span style="width: {{=(100 * ( 1 - (it.free_memory / it.total_memory))).toFixed(2)}}%;"></span></div>';

    var info_template = doT.template(info_template_ref);

    function init(container, info) {
        info.uptime = moment.duration(info.uptime, 's');
        info.process_uptime = moment.duration(info.process_uptime, 's');

        container.html(info_template(info));
    }

    return {
        init: init
    };

}());