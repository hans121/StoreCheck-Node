var collapsible_tree_control = (function () {

    var external_interface = {
        init: init,
        buildTree : buildTree,
        hideLeafNodes: hideLeafNodes,
        showQuestion: showQuestion,
        highlightQuestion: highlightQuestion,
        expandAll: expandAll,
        expandOnlyDefects: expandOnlyDefects,
        expandOnlyAlerts: expandOnlyAlerts
    };

    var node_count;

    function init(samples_in) {
        return question_hierarchy_tree.init(samples_in[0], true);
    }

    function buildTree(container, urlBuilder, root_node, samples) {
        $(container).append('<ul class="tree-trunk"></ul>');
        var child_container = $(container).find('ul.tree-trunk');
        node_count = 1;
        for(var i=0; i<root_node.children.length;i++) {
            _appendChildToTree(child_container, urlBuilder, root_node.children[i], samples);
        }

        _attachEvents(container);
    }

    function hideLeafNodes(container) {
        var leafSelector = $(container).find('li.leaf');
        leafSelector.css('display', 'none');

        var leafSpans = leafSelector.parent().parent().find('> span');
        leafSpans.attr('title', 'Expand this branch').find(' > i').addClass('icon-plus-sign').removeClass('icon-minus-sign');
    }

    function expandAll(container) {
        var leafSelector = $(container).find('li.leaf');
        leafSelector.css('display', '');

        var leafSpans = leafSelector.parent().parent().find('> span');
        leafSpans.attr('title', 'Collapse this branch').find(' > i').addClass('icon-minus-sign').removeClass('icon-plus-sign');
    }

    function expandOnlyDefects(container) {
        hideLeafNodes(container);
        var nonCompliantLeafSpanParents = $(container).find('li.leaf').find('> span > i.icon-remove').parent().parent();

        nonCompliantLeafSpanParents.attr('title', 'Collapse this branch').find(' > i').addClass('icon-minus-sign').removeClass('icon-plus-sign');
        nonCompliantLeafSpanParents.css('display', '');
    }

    function expandOnlyAlerts(container) {
        hideLeafNodes(container);
        var nonCompliantLeafSpanParents = $(container).find('li.leaf').find('> span > i.has-alert').parent().parent();

        nonCompliantLeafSpanParents.attr('title', 'Collapse this branch').find(' > i').addClass('icon-minus-sign').removeClass('icon-plus-sign');
        nonCompliantLeafSpanParents.css('display', '');
    }

    function showQuestion(container, questionId) {
        var spanSelector = $(container).find('li.leaf > span.question_' + questionId);
        var listSelector = spanSelector.parent().parent().find('> li');

        var questionLeafSpanParents = listSelector.parent().parent().find('> span');

        questionLeafSpanParents.attr('title', 'Collapse this branch').find(' > i').addClass('icon-minus-sign').removeClass('icon-plus-sign');
        questionLeafSpanParents.css('display', '');

        listSelector.show('fast');
    }

    function highlightQuestion(container, questionId) {
        var spanSelector = $(container).find('li.leaf > span.question_' + questionId);
        spanSelector.css('background-color','rgba(0, 182, 256, 0.6)');
        showQuestion(container, questionId);
    }

    function _attachEvents(container) {
        var tree_selector = $(container);
        tree_selector.find('> ul').attr('role', 'tree').find('ul').attr('role', 'group');

        var children_with_parents = tree_selector.find('li:has(ul)');
        children_with_parents.addClass('parent_li');
        children_with_parents.attr('role', 'treeitem');

        var children_spans = children_with_parents.find(' > span');
        children_spans.attr('title', 'Collapse this branch');//.on('click', spanClicked);

        var first_level = tree_selector.find('li:has(ul)');
        first_level.addClass('parent_li').attr('role', 'treeitem').find(' > span').attr('title', 'Collapse this branch').on('click', _spanClicked);
    }

    function _spanClicked(e) {
        var children = $(this).parent('li.parent_li').find('> ul > li');
        if (children.is(':visible')) {
            children.hide('fast');
            $(this).attr('title', 'Expand this branch').find('> i').addClass('icon-plus-sign').removeClass('icon-minus-sign');
        }
        else {
            children.show('fast');
            $(this).attr('title', 'Collapse this branch').find('> i').addClass('icon-minus-sign').removeClass('icon-plus-sign');
        }
        e.stopPropagation();
    }

    // the hierarchy is built, now add to the dom
    function _appendChildToTree(container, urlBuilder, node, samples) {
        if(node.children.length > 0) {
            $(container).append('<li><span><i class="icon-minus-sign"/>' + node.model.name + '</span><ul class="container_' + node_count + '"></ul></li>');
            var child_container = $(container).find('li > ul.container_' + node_count);
            node_count++;
            for(var i=0; i<node.children.length;i++) {
                _appendChildToTree(child_container, urlBuilder, node.children[i], samples);
            }
        } else {
            $(container).append('<li class="leaf"><span class="question_' + node.model.question.identity_id + '"><i ' + _getIconProps(samples, node.model.question) + '/><a href="' + urlBuilder(node.model.question.identity_id) + '">' + node.model.name + '</a></span></li>');
        }
    }

    function _getIconProps(samples, question) {
        var thisQuestionAmongSamples = [], i;
        for(i=0; i<samples.length; i++) {
            for(var j=0; j<samples[i].questions.length; j++) {
                if(samples[i].questions[j].identity_id == question.identity_id) {
                    thisQuestionAmongSamples.push(samples[i].questions[j]);
                }
            }
        }

        var currentCompliance = "conform", hasAlert = false;
        thisQuestionAmongSamples.forEach(function(questionAmongSamples) {
            if(questionAmongSamples.conformance) {
                if(questionAmongSamples.conformance == "alert") {
                    hasAlert = true;
                    if(currentCompliance != 'non-conform') {
                        currentCompliance = 'alert';
                    }
                } else if(questionAmongSamples.conformance == "non-conform") {
                    currentCompliance = 'non-conform';
                }
            }
        });

        if(currentCompliance == "conform") {
            return 'class="icon-ok" style="color: #00EE00; text-shadow: 1px 1px 1px #555;"';
        } else if(currentCompliance == "alert") {
            return 'class="icon-exclamation has-alert" style="color: #EEEE00; margin-right: 5px; margin-left: 5px; text-shadow: 1px 1px 1px #555;"';
        }else if(currentCompliance == "non-conform") {
            return 'class="icon-remove' + (hasAlert ? ' has-alert': '') + '" style="color: #EE0000; text-shadow: 1px 1px 1px #555;"';
        }
        return 'class="icon-question;"';
    }

    return external_interface;

}(collapsible_tree_control));