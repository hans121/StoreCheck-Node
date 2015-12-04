function TreeNavController() {    

    var interface = 
    {
        init: function(container, data, initialQuestionId, setCurrentQuestionsFn) {
            init(container, data, initialQuestionId, setCurrentQuestionsFn);
        }
    };


    function truncate(str, max) {
        var tstr = str;
        if (tstr.length > max) {
            tstr = tstr.substring(0, max) + '...';
        }
        return tstr;
    }

    function init(container, data, initialQuestionId, setCurrentQuestionsFn) {

        var active_question_id, active_hierarchy = '', active_hierarchy_parent = '';
        var questionToNodeMap = {}, leafParentMap = {};
        var tree_root = question_hierarchy_tree.init(data);

        var _truncationLimits = 
        {
            navButton: 60,
            questionLabel: 60
        };

        var _curIndex = 0;

        if (data.questions.length == 0) return;

        // make a map of identity_id to tree node for leaves
        {
            function buildLeafNodeMap(node, leafNodeMap) {
                if(node.children.length == 0) {
                    leafNodeMap[node.model.question.identity_id] = node;
                } else {
                    node.children.forEach(function(child) {
                        buildLeafNodeMap(child, leafNodeMap);
                    });
                }
            }
            buildLeafNodeMap(tree_root.children[0], questionToNodeMap);
        }

        {
            var keys = Object.keys(questionToNodeMap);
            keys.forEach(function(questionId) {
                var parent = questionToNodeMap[questionId].parent;
                leafParentMap[Object.keys(leafParentMap).length] = parent;
            });
        }

        // output html
        {
            var html = '';
            html += '<table>';
            html += '<tr>';

            function getParentIndexString(node) {
                var toReturn = "", parentStrings = "";
                if(typeof(node.parent) != 'undefined') {
                    node.parent.children.forEach(function(innerNode, innerNodeIndex) {
                        if(innerNode == node) {
                            toReturn = innerNodeIndex + "";
                            parentStrings = getParentIndexString(node.parent);
                            if(parentStrings.length > 0) {
                                toReturn = parentStrings + '_' + toReturn;
                            }
                        }
                    });
                }
                return toReturn;
            }

            function getNodesAsCell(nodeArray, level_index) {
                var returnVal = '<td valign="top" style="width: 25%;">';
                if(level_index < 2) {
                    returnVal = '<td valign="top" style="border-right: 1px dashed #999;">';
                }
                nodeArray.forEach(function(child) {
                    returnVal = returnVal + '<div><button style="clear: both; margin-bottom: 2px; padding: 2px 5px;" ' + '' +
                        ' class="btn set level_' + level_index + ' navnode_' + getParentIndexString(child) + ' navparent_' + getParentIndexString(child.parent) +
                        (typeof(child.model.question) != 'undefined' ? ' question_' + child.model.question.identity_id : '') +
                        '" title="' + child.model.name + '">' + truncate(child.model.name, _truncationLimits.navButton) + '</button></div>';
                });
                returnVal += "</td>";

                var childrens_children = [];
                nodeArray.forEach(function(child) {
                    childrens_children = childrens_children.concat(child.children);
                });
                if(childrens_children.length > 0) {
                    returnVal += getNodesAsCell(childrens_children,  level_index + 1);
                }
                return returnVal;
            }

            function getHierarchyAsCell(node, level_index) {
                var returnVal = '<td valign="top" style="border-right: 1px dashed #999; width: 25%;">';
                node.children.forEach(function(child) {
                    returnVal = returnVal + '<div><button style="clear: both; margin-bottom: 2px; padding: 2px 5px;" ' + '' +
                        'class="btn set level_' + level_index + ' navnode_' + getParentIndexString(child) +
                        (typeof(child.model.question) != 'undefined' ? ' question_' + node.model.question.identity_id : '') +
                        '" title="' + child.model.name + '">' + truncate(child.model.name, _truncationLimits.navButton) + '</button></div>';
                });
                returnVal += "</td>";

                var childrens_children = [];
                node.children.forEach(function(child) {
                    childrens_children = childrens_children.concat(child.children);
                });

                returnVal += getNodesAsCell(childrens_children, level_index + 1);
                return returnVal;
            }

            html += getHierarchyAsCell(tree_root.children[0], 0);
            html += '</tr></table>';
            $(container).find('.navui').html(html);
            $(container).find('.navui button').click(function(e) { onNavButtonClicked(e); return false; });
        }

        var setCurrentIndex = function(val) {
            _curIndex = val;
            if (_curIndex != -1) {
                var currentNode = questionToNodeMap[data.questions[_curIndex].identity_id];
                if(!currentNode) {
                    console.log('questionToNodeMap had no entry for ' + data.questions[_curIndex].identity_id);
                    return;
                }

                var parentNode = currentNode.parent;
                var questions = [];
                parentNode.children.forEach(function(child) {
                    questions.push(child.model.question.identity_id);
                });
                setCurrentQuestionsFn(data.questions, questions, _curIndex);
            } else {
                setCurrentQuestionsFn(data.questions, []);
            }

            var questionIsDisplayed = (_curIndex != -1);

            if (_curIndex >= 0 && questionIsDisplayed) {
                $(container).find('.question_number').html('' + (_curIndex + 1) + ' \\ ' + data.questions.length);
            } else {
                $(container).find('.question_number').html('');
            }

            // hide/show prev and next button
            var firstQuestion = $('.question_0:visible');
            if (firstQuestion.length != 0 || !questionIsDisplayed) {
                $(container).find('.prev').attr('disabled', 'disabled');
            } else {
                $(container).find('.prev').removeAttr('disabled');
            }

            var lastQuestion = $('.question_' + (data.questions.length - 1) + ':visible');
            if (lastQuestion.length != 0 || !questionIsDisplayed) {
                $(container).find('.next').attr('disabled', 'disabled');
            } else {
                $(container).find('.next').removeAttr('disabled');
            }
        };

        var setCurrentQuestion = function(quid) {
            for (var i = 0; i < data.questions.length; i++) {
                if (data.questions[i].identity_id == quid) {
                    _curIndex = i;
                    break;
                }
            }
        };

        var syncNav = function() {
            // by default, buttons are hidden
            $('.navui button').css('display', 'none');

            // hide level 3
            $('.navui button.level_3').css('display', 'none');

            // the first level of the hierarchy is visible
            $('.navui button.level_0').css('display', '');
            $('.navui button').removeClass('selected');

            // if the selection represents a question
            if(typeof(questionToNodeMap[active_question_id]) != 'undefined') {
                var active_node = questionToNodeMap[active_question_id];

                var question_button = $('.navui button.question_' + active_node.model.question.identity_id);

                // activate the leaf
                question_button.addClass('selected');

                question_button[0].className.split(' ').forEach(function(token) {
                    if(token.indexOf('navnode_') != -1) {
                        active_hierarchy = token;
                    } else if(token.indexOf('navparent_0') != -1) {
                        active_hierarchy_parent = token;
                    }
                });
            }

            // if something is selected (this should probably always hit)
            if(active_hierarchy.length > 0) {
                var hierarchy_parse = active_hierarchy.slice(0);
                $('button.' + hierarchy_parse).addClass('selected');
                //$('button.' + hierarchy_parse).css('display', ''); // show leaf

                // keep pulling off suffices and highlighting matches
                var hierarchy_tokens;
                while(hierarchy_parse != 'navnode_0') {
                    // TODO: lastIndexOf is a better option
                    hierarchy_tokens = hierarchy_parse.split('_');
                    hierarchy_parse = hierarchy_parse.slice(0, hierarchy_parse.length - (hierarchy_tokens[hierarchy_tokens.length - 1].length + 1));
                    $('button.' + hierarchy_parse).addClass('selected');
                    $('button.' + hierarchy_parse).css('display', '');
                }

                // make selection and siblings visible
                {
                    var hierarchy_parent_parse = active_hierarchy_parent.slice(0);
                    //$('button.' + hierarchy_parent_parse).css('display', ''); // show leaf

                    // keep pulling off suffices and making matches visible
                    while(hierarchy_parent_parse != 'navparent_0') {
                        // TODO: lastIndexOf is a better option
                        hierarchy_tokens = hierarchy_parent_parse.split('_');
                        hierarchy_parent_parse = hierarchy_parent_parse.slice(0, hierarchy_parent_parse.length - (hierarchy_tokens[hierarchy_tokens.length - 1].length + 1));
                        $('button.' + hierarchy_parent_parse).css('display', '');
                    }
                }
            }
        };

        var onNavButtonClicked = function(e) {
            var c = $(e.target).attr('class');
            var v = $(e.target).attr('title');

            active_question_id = '';
            c.split(' ').forEach(function(className) {
                if(className.indexOf('navnode_0') != -1) {
                    active_hierarchy = className;
                } else if(className.indexOf('navparent_0') != -1) {
                    active_hierarchy_parent = className;
                }
            });
            while(active_hierarchy_parent.length < 17) {
                active_hierarchy_parent += '_0';
            }
            while(active_hierarchy.length < 17) {
                active_hierarchy += '_0';
            }
            // get the level 0 button and set the active_question_id from it
            var active_classes = $('.' + active_hierarchy).attr('class');
            active_question_id = (active_classes.substring(active_classes.indexOf('question_')).split(' ')[0]).split('_')[1];

            syncNav();
            if(active_question_id.length > 0) {
                setCurrentQuestion(active_question_id);
                setCurrentIndex(_curIndex);
                //setCurrentQuestionFn(data.questions, active_question_id);
            }
            //syncCurrentIndexFromNav();
        };

        var adjustIndex = function(amt) {
            setCurrentIndex(_curIndex + amt);
            
            // update hierarchy nav to match new question index
            var q = data.questions[_curIndex];
            active_question_id = q.identity_id;
            syncNav();
        };

        var adjustIndexL4 = function(is_forward) {
            var q = data.questions[_curIndex];

            if(is_forward) {
                for(var i=_curIndex + 1; i<data.questions.length; i++) {
                    if(data.questions[i].level4_description2 != q.level4_description2) {
                        setCurrentIndex(i);
                        active_question_id = data.questions[i].identity_id;
                        break;
                    }
                }
            } else {
                // go back to the last of the items with a different L4 code
                for(var i=_curIndex - 1; i>=0; i--) {
                    if(data.questions[i].level4_description2 != q.level4_description2) {

                        // now, find the beginning of that chain
                        for(var j=i-1; j>=0; j--) {
                            if(data.questions[j].level4_description2 != data.questions[i].level4_description2) {
                                break;
                            }
                        }

                        setCurrentIndex(j+1);
                        active_question_id = data.questions[_curIndex].identity_id;
                        break;
                    }
                }
            }
            syncNav();
        };
        
        $(container).find('.prev').click(function() { adjustIndexL4(false); return false; });
        $(container).find('.next').click(function() { adjustIndexL4(true); return false; });
        
        // Select initial question (first question will be selected if not specified)
        if (typeof initialQuestionId != 'undefined') {
            setCurrentQuestion(initialQuestionId);
            setCurrentIndex(_curIndex);
            var q = data.questions[_curIndex];
            active_question_id = q.identity_id;
            syncNav();
        } else {
            adjustIndex(0);
        }
    }


    return interface;
}