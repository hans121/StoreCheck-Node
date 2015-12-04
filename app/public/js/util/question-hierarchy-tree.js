var question_hierarchy_tree = (function (my) {

    var hierarchyLevelParams = ['level1_code', 'level2_code', 'level3_code', 'level4_code', 'level5_code'];
    var backupHierarchyLevelParams = ['level1_description2', 'level2_description2', 'level3_description2', 'level4_description2', 'level5_description2'];

    var hierarchyDisplayParams = ['level1_description2', 'level2_description2', 'level3_description2', 'level4_description2', 'level5_description2'];

    // get the information from the question into the hierarchical representation
    function init(sample, is_trimming) {
        var tree = new TreeModel();
        var root = tree.parse({'name': 'root', level: 0, 'children': [] });

        var k;
        sample.questions.forEach(function(question) {
            var params = [];

            // trim each desc/key
            hierarchyLevelParams.forEach(function(hierarchyLevelParam) {
                question[hierarchyLevelParam] = question[hierarchyLevelParam].trim();
            });

            for(k=0; k<hierarchyLevelParams.length; k++) {

                if (is_trimming) {
                    // -2 because we don't want to prune leaves
                    if (k < hierarchyLevelParams.length - 2 && question[hierarchyLevelParams[k]] == question[hierarchyLevelParams[k + 1]]) {

                        // hide blank hierarchy levels
                        console.log('hid level ' + k + ' of the hierarchy');
                    } else if (question[hierarchyLevelParams[k]].length == 0) {

                    } else {
                        if (question[hierarchyLevelParams[k]].length > 0) {
                            params.push({key: question[hierarchyLevelParams[k]], desc: question[hierarchyDisplayParams[k]]});
                        } else {
                            params.push({key: question[backupHierarchyLevelParams[k]], desc: question[hierarchyDisplayParams[k]]});
                        }
                    }
                } else {
                    if (question[hierarchyLevelParams[k]].length > 0) {
                        params.push({key: question[hierarchyLevelParams[k]], desc: question[hierarchyDisplayParams[k]]});
                    } else {
                        params.push({key: question[backupHierarchyLevelParams[k]], desc: question[hierarchyDisplayParams[k]]});
                    }
                }
            }
            _createHierarchy(tree, root, question, params);
        });
        _renameHierarchyNodes(tree, root);
        return root;
    }

    // builds an in-memory tree representation of the questions
    function _createHierarchy(tree, inspection_root, question, array_of_descriptions) {
        if(!array_of_descriptions || array_of_descriptions.length == 0) {
            return;
        }

        var foundRootChild = false;
        inspection_root.children.forEach(function(child) {
            if(child.model.name == array_of_descriptions[0].key) {
                foundRootChild = true;
                array_of_descriptions.splice(0, 1);

                _createHierarchy(tree, child, question, array_of_descriptions);
            }
        });

        if(!foundRootChild) {
            var new_node = { 'name': array_of_descriptions[0].key, desc: array_of_descriptions[0].desc };
            if(array_of_descriptions.length == 1) {
                new_node.question = question;
            }
            var newChild = inspection_root.addChild(tree.parse(new_node));
            array_of_descriptions.splice(0, 1);

            _createHierarchy(tree, newChild, question, array_of_descriptions);
        }
    }

    function _renameHierarchyNodes(tree, inspection_root) {
        if(!inspection_root.children || inspection_root.children.length == 0) {
            inspection_root.model.name = inspection_root.model.desc;
            return;
        }

        inspection_root.model.name = inspection_root.model.desc;

        inspection_root.children.forEach(function(child) {
            _renameHierarchyNodes(tree, child);
        });
    }

    return {
        init: init
    };

}(question_hierarchy_tree));