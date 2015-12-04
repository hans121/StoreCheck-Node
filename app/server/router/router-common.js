var _ = require('underscore');
var async = require('async');
var ObjectId = require('mongodb').ObjectID;
var winston = require('winston');

var AccessManager = require('../modules/access-manager');
var AccountManager = require('../modules/account-manager');
var AuditAssignmentModule = require('../modules/model/audit-assignment');
var AuditTeamModule = require('../modules/model/audit-team');
var FactoryModule = require('../modules/model/hierarchy/factory');
var HierarchyModule5 = require('../modules/model/hierarchy/audit-grid-hierarchy-level5');
var HierarchyTranslationModule5 = require('../modules/model/hierarchy/audit-grid-hierarchy-translation-level5');
var OrganizationModule = require('../modules/model/organization');
var PointOfSaleModule = require('../modules/model/hierarchy/point-of-sale');
var ProductionLineModule = require('../modules/model/hierarchy/production-line');
var ProductModule = require('../modules/model/hierarchy/product');
var SamplesModule = require('../modules/model/sample');
var StaticLoadModule = require('../modules/static-loads');
var StoreCheckModule = require('../modules/model/store-check');
var VisitModule = require('../modules/model/visit');

var nodeUtils = require('../modules/node-utils');
var formatter = require('../modules/view-formatter');

// === EXPORTS

exports.addHandler = _addHandler;

exports.render = _render;

exports.logRequest = _logRequest;

exports.render401 = _render401;

exports.render404 = _render404;

exports.render500 = _render500;

exports.getInvalidIdMessage = function() { return 'id is invalid'; };

    // SECURITY

exports.userHasAccess = _userHasAccess;

// Checks the following:
// 1. A user object is in the session (inherited check)
// 2. The user has basic access to the resource class
//
// On access denied: return 404, as we don't want malicious
// people to know the resource even exists
exports.ensureHasAccess = _ensureHasAccess;

// callback is of type function(boolean, resource)
// action is one of 'c', 'r', 'u', 'd', 'l'
// example: {module}.tryAccessResource(req.session.user, user._id.toHexString(), 'user', 'r', AccountManager, function(canAccess) {}
// checks org
exports.tryAccessResource = _tryAccessResource;

// callback is of type function(boolean)
// action is one of 'c', 'r', 'u', 'd', 'l'
exports.canAccessUser = _canAccessUser;

// callback is of type function(boolean)
// action is one of 'c', 'r', 'u', 'd', 'l'
exports.canAccessUserByName = _canAccessUserByName;

    // GENERAL RESOURCE UTILITIES

// Checks the following:
// 1. A user object is in the session
//
// On no user in session: redirect to login/index
exports.ensureUserInSession = _ensureUserInSession;

// Checks the following:
// 1. A user object is in the session (inherited check)
// 2. The id is of a valid format
// 3. The user has basic access to the resource class (inherited check)
// 4. That the user is either global, or the object shares an organization with the calling user
//
// The errorCallbacks parameter is an object containing authFailed and userNotInSession functions,
// each of which takes (req, res) as arguments.
//
// On access denied: return 404, as we don't want malicious
// people to know the resource even exists
//
// Notes: ONLY use this for resources that are organization-scoped
exports.getByIdIfAuthorized = _getByIdIfAuthorized;

// Like getByIdIfAuthorized, except it does not check each item in the list to make sure it's in the caller's organizations
exports.getByIdsIfAuthorized = _getByIdsIfAuthorized;

// Will do an org-scoped search where needed
exports.scopedFind = _scopedFind;

// static_name is only defined when there are static-load records for the given type
exports.addStandardQueryHandler = _addStandardQueryHandler;

// will do a query for a WWBU (e.g. Dairy) by querying over organizations that are in that WWBU
exports.addStandardWWBUQueryHandler = _addStandardWWBUQueryHandler;

exports.doStandardQuery = _doStandardQuery;

// Safely loads a list of a specific resource type, taking global status and active organization/CBU into account (no team logic)
// requires:
//     a) the resource has an "organization" property
//     b) the resource is protected by the access manager
//     c) statuses can be left blank to include all statuses

// ensures/checks:
// 1. A user object is in the session (inherited check)
// 2. The user has access to listing store checks
// 3. The caller only gets back store checks that are visible to them
//     a. users in which nodeUtils.isUserGlobal returns true see all store checks
//     b. users in which nodeUtils.isUserGlobal is false see only checks in their organization
//
// on completion, either calls supplied errorCallbacks or resultsCallback(list_results) [no error param]
exports.getScopedList = _getScopedList;

// Observes org-scoping on static lists
exports.getScopedStaticList = _getScopedStaticList;

// Note: use {} for additionalQueryParams if you have none
exports.getStaticList = _getStaticList;

    // ERROR CALLBACKS

exports.onUserNotInSessionForViewMethod = function(req, res) {
    res.redirect('/');
};

exports.onUserNotInSessionForServiceMethod = function(req, res) {
    exports.render401(req, res, 'Authorization required');
};

exports.onAuthFailedForServiceMethod = function(req, res) {
    exports.render404(req, res);
};

exports.onAuthFailedForViewMethod = function(req, res) {
    if(req.session.user == null) {
        res.redirect('/');
    } else {
        exports.render404(req, res);
    }
};

exports.viewErrorCallbacks = {
    userNotInSession: exports.onUserNotInSessionForViewMethod,
    authFailed: exports.onAuthFailedForViewMethod,
    on500: exports.render500,
    on404: exports.render404
};

exports.serviceErrorCallbacks = {
    userNotInSession: exports.onUserNotInSessionForServiceMethod,
    authFailed: exports.onAuthFailedForServiceMethod,
    on500: function(req, res, error) { res.send(error, 500); },
    on404: function(req, res, error) { res.send(error, 404); }
};

exports.createGenericCallbacks = function(callback2) {
    this.userNotInSession = function() { callback2('user not in session'); };
    this.authFailed = function() { callback2('auth failed'); };
    this.on500 = function(req, res, error) { callback2(error) };
    this.on404 = function(req, res, error) { callback2(error); }
};

exports.queryResultHandler = _queryResultHandler;

exports.queryNonFatalResultHandler = _queryNonFatalResultHandler;

    // RESOURCE HELPERS

exports.listAuditTeams = _listAuditTeams;

// Safely loads a list of POS (which is a weird combo of pre-loaded and customizable entries),
// taking global status and active organization/CBU into account (no team logic)
//
// requires:
//     a) the user has list/pos access
//
// on completion, either calls supplied errorCallbacks or resultsCallback(list_results) [no error param]
exports.listPointsOfSale = _listPointsOfSale;

// calls listPointsOfSale, but makes sure to include an id if it exists (and access is allowed)
// this is useful because a user may have a pos from an old statis load
exports.findPointsOfSale = _findPointsOfSale;

// called by findPointsOfSale - doesn't assume req/res are available
exports.rawFindPointsOfSale = _rawFindPointsOfSale;

// Safely loads a list of products (observes org-scoping)
exports.listProducts = function(req, res, errorCallbacks, resultsCallback) {
    _getScopedStaticList(req, res, 'product', 'products', ProductModule, {}, errorCallbacks, resultsCallback);
};

exports.listStoreChecks = _listStoreChecks;

exports.listUsersByRole = _listUsersByRole;

// Checks access, and applies team-based logic to visit listings
// results_callback has one arg: visits
exports.listVisits = _listVisits;

exports.listVisitIds = _listVisitIds;

exports.getQuestionsForTemplate = _getQuestionsForTemplate;

exports.getSamplesMeta = _getSamplesMeta;

exports.getExtendedSamplesInfo = _getExtendedSamplesInfo;

exports.getTemplateLevel = _getTemplateLevel;

exports.pushMessage = _pushMessage;

exports.popMessages = _popMessages;

// A service-specific function, as it will send the result in the response
exports.getResourceById = _handleGetResourceById;

// does a query among all of the samples for all of the visits that the user can see
exports.findSamples = _findSamples;

exports.renderSampleList = _renderSampleList;

exports.getOrganizationSettings = _getOrganizationSettings;

// === HANDLERS

function _addHandler(app, method, path, handler, render) {
    app[method](path, function (req, res) {
        try {
            handler(req, res);
        } catch (ex) {
            if(render === true) {
                res.render('500', { title: 'Internal Server Error', error: ex.message });
            } else {
                winston.error('Uncaught exception: ' + ex.message);
                res.send('Internal server error: ' + ex.message, 500);
            }
        }
    });
}

function _render(req, res, suffix, data) {
    if (req.session.user == null){
        // if user is not logged-in redirect back to login page
        //res.render('login');
        res.redirect('/login');
    } else if(req.session.user.roles != null) {
        var path_to_test = nodeUtils.getUserPrefix(req) + suffix;
        data.messages = exports.popMessages(req);
        res.render(path_to_test, data, function(err, html) {
            if(err) {
                res.render('full-access/' + suffix, data, function(err, html) {
                    if(err) {
                        winston.log('error', 'failed to render ' + suffix + ', message=' + err);
                        exports.render404(req, res);
                    } else {
                        res.end(html);
                    }
                });
                return;
            }
            res.end(html);
        });
    } else {
        res.redirect('/home');
    }
}

function _render401(req, res, error) {
    res.status(401);
    res.render('401', {
        error: error
    });
}

function _render404(req, res, error) {
    res.status(404);
    res.render('404', {
        error: error
    });
}

function _render500(req, res, error) {
    res.status(500);
    res.render('500', { title: 'Internal Server Error', error: error });
}

function _logRequest(req, isAuthenticated, caller) {
    if(typeof(caller) == 'undefined') {
        winston.log('debug', (isAuthenticated ? 'authed and ' : '') + 'processing ' + req.method + ' ' + req.path + ' request from user=' + caller.name);
        return;
    }
    winston.log('debug', (isAuthenticated ? 'authed and ' : '') + 'processing ' + req.method + ' ' + req.path + ' request from user=' + caller.name);
}

function _userHasAccess(user, suffix, action) {
    //winston.log('debug', 'entered router-common.userHasAccess(user=' + user.name + ', suffix=' + suffix + ', action=' + action + ')');
    return AccessManager.hasAccess(AccessManager.getRole(user), suffix, action);  // todo: cycle through roles?
}

function _ensureHasAccess(req, res, resource, action, errorCallbacks, userReturnFunction) {
    //winston.log('debug', 'entered router-common.ensureHasAccess(req, res, resource=' + resource + ', action=' + action + ')');
    _ensureUserInSession(req, res, errorCallbacks.userNotInSession, function(caller) {
        if(_hasAccess(req, resource, action)) {
            userReturnFunction(caller);
        } else {
            winston.log('debug', 'auth failed in router-common.ensureHasAccess(req, res, resource=' + resource + ', action=' + action + ', caller=' + caller.name + ')');
            errorCallbacks.authFailed(req, res);
        }
    });
}

function _queryResultHandler(req, res, errorCallbacks, callback) {
    return function(err, items) {
        if (err != null) {
            errorCallbacks.on500(req, res, err);
        } else if(items == null) {
            errorCallbacks.on404(req, res, err);
        } else {
            callback(items);
        }
    };
}

function _queryNonFatalResultHandler(callback) {
    return function(err, items) {
        if (err != null) {
            callback([]);
        } else if(items == null) {
            callback([]);
        } else {
            callback(items);
        }
    };
}

function _tryAccessResource(caller, resourceId, resource_type, action, resource_collection, callback) {
    if(!caller || caller == null) {
        callback(false);
        return;
    }

    if(!_userHasAccess(caller, resource_type, action)) {
        callback(false);
        return;
    }

    resource_collection.findOneById(resourceId, function(err, resource) {
        if(err != null) {
            callback(false, resource);
            return;
        }

        if(!resource) {
            callback(true, resource);
            return;
        }

        if(nodeUtils.isUserGlobal(caller)) {
            callback(true, resource);
            return;
        }

        if(caller.organizations && caller.organizations.indexOf(resource.organization) == -1) {
            callback(false, null);
            return;
        }
        callback(true, resource);
    });
}

// TODO: check that they are on the same team for audit-team/role check
function _canAccessUser(req, id, action, callback) {
    winston.log('debug', 'entered router-common.canAccessUser(id=' + id + ', action=' + action + ')');

    // must have a user in the session
    if(!_userInSession(req)) {
        callback(false);
        return;
    }

    // caller can view users within their organization, or any user if the caller is global
    if(_hasAccess(req, 'user', action)) {
        callback(true);
        return;
    }

    // caller can view himself
    if(_hasAccess(req, 'user/me', action) && req.session.user._id == id) {
        callback(true);
        return;
    }

    // caller can only view users of a specific role within their organizations
    AccountManager.findOneById(id, function(err, user) {
        if(err != null || !user || user == null) {
            callback(false);
            return;
        }

        if(_.isUndefined(user.roles)) {
            callback(false);
            return;
        }

        if(user.roles.length == 0) {
            callback(false);
            return;
        }

        if(_.intersection(user.organizations, req.session.user.organizations).length == 0) {
            callback(false);
            return;
        }

        if(_userHasAccess(req.session.user, user.roles[0], action)) {
            callback(true);
            return;
        }

        if(_userHasAccess(req.session.user, 'audit-team/' + user.roles[0], action)) {
            callback(true);
            return;
        }

        callback(false);
    });
}

function _canAccessUserByName(req, name, action, callback) {
    winston.log('debug', 'entered router-common.canAccessUserByName(req, name=' + name + ', action=' + action + ')');
    if(_hasAccess(req, 'user', action)) {
        callback(true);
        return;
    }
    AccountManager.findOne({user: name}, function(err, userResult) {
        if(!userResult || userResult == null) {
            callback(false);
        } else {
            _canAccessUser(req, userResult._id.toHexString(), action, callback);
        }
    });
}

function _ensureUserInSession(req, res, userNotInSessionFunction, userReturnFunction) {
    if(!req.session.user || req.session.user == null) {
        userNotInSessionFunction(req, res);
    } else {
        userReturnFunction(req.session.user);
    }
}

function _getByIdIfAuthorized(req, res, id, resource_type, collection, errorCallbacks, results_and_caller_callback) {
    //winston.log('debug', 'entered router-common.getByIdIfAuthorized(req, res, id=' + id + ', resource_type=' + resource_type + ')');
    if(resource_type == 'factory') {
        winston.warn('getByIdIfAuthorized has been called for factory.  Be sure this is correct.  It is not org-scoped!');
    }
    if(resource_type == 'production-line') {
        winston.warn('getByIdIfAuthorized has been called for production-line.  Be sure this is correct.  It is not org-scoped!');
    }
    _ensureUserInSession(req, res, errorCallbacks.userNotInSession, function(caller) {
        if(!nodeUtils.isValidId(id)) {
            errorCallbacks.on500(req, res, exports.getInvalidIdMessage());
            return;
        }

        _tryAccessResource(caller, id, resource_type, 'r', collection, function(canAccess, item) {
            if(canAccess) {
                if(item) {
                    results_and_caller_callback(item, caller);
                } else {
                    errorCallbacks.on404(req, res, resource_type + ' not found');
                }
            } else {
                winston.log('debug', 'auth failed for router-common.getByIdIfAuthorized(req, res, id=' + id + ', resource_type=' + resource_type + ') with caller.name=' + caller.name);
                errorCallbacks.authFailed(req, res);
            }
        });
    });
}

function _getByIdsIfAuthorized(req, res, idList, resource_type, collection, errorCallbacks, results_callback) {
    //winston.log('debug', 'entered router-common.getByIdIfAuthorized(req, res, id=' + idList + ', resource_type=' + resource_type + ')');
    _ensureHasAccess(req, res, resource_type, 'r', errorCallbacks, function() { // caller
        for(var i=0; i<idList.length; i++) {
            if(!nodeUtils.isValidId(idList[i])) {
                errorCallbacks.on500(req, res, exports.getInvalidIdMessage());
                return;
            }
        }
        collection.listByIds(idList, function(err, item) {
            if(err == null && item != null) {
                results_callback(item);
            } else if(err != null) {
                errorCallbacks.on500(req, res, err);
            } else {
                errorCallbacks.on404(req, res);
            }
        });
    });
}

function _scopedFind(req, res, resource, collection, query, options, errorCallbacks, resultsCallback) {
    winston.log('debug', 'entered router-common.scopedFind(req, res, resource=' + resource + ')');
    _ensureHasAccess(req, res, resource, 'l', errorCallbacks, function(caller) {
        if(nodeUtils.isUserGlobal(caller)) {
            winston.log('debug', 'returning a global-scoped list in router-common.getScopedList(req, res, resource=' + resource + ')');
            collection.findWithOptions(query, options, exports.queryResultHandler(req, res, errorCallbacks, resultsCallback));
        } else if(caller.organizations) {
            winston.log('debug', 'returning an organization-scoped list in router-common.getScopedList(req, res, resource=' + resource + ')');
            collection.findWithOptions(_.extend(query, {organization: {$in: caller.organizations}}),options,  exports.queryResultHandler(req, res, errorCallbacks, resultsCallback));
        } else {
            errorCallbacks.on404(req, res);
        }
    });
}

// TODO: perhaps provide a resource, and do an ensureHasAccess check
function _addStandardQueryHandler(app, path, DatabaseModule, static_load_name, ignore_organization) {
    _addHandler(app, 'get', path, function(req, res) {
        _ensureUserInSession(req, res, exports.serviceErrorCallbacks.userNotInSession, function(caller) {
            _doStandardQuery(req, res, caller, DatabaseModule, static_load_name, ignore_organization, {});
        });
    });
}

// TODO: perhaps provide a resource, and do an ensureHasAccess check
function _addStandardWWBUQueryHandler(app, path, DatabaseModule, static_load_name) {
    _addHandler(app, 'get', path, function(req, res) {
        _ensureUserInSession(req, res, exports.serviceErrorCallbacks.userNotInSession, function(caller) {
            // To WWBU-scope, we need to do a kind of complicated set of stuff:
            // 1. get all "templates" for all of our organizations (e.g. "Dairy", "Waters")
            // 2. get all other organizations with any template that matches any of ours (non-zero cardinality intersection)
            // 3. query via getStaticList, adding organization: $in query

            // 1.
            var org_mongo_ids = _.map(caller.organizations, function(org) { return ObjectId(org);});
            OrganizationModule.find({_id: {$in: org_mongo_ids}}, function (err_my_orgs, my_orgs) {
                if (err_my_orgs) {
                    res.send(err_my_orgs, 500);
                    return;
                }

                var settings = _.pluck(my_orgs, 'settings');
                if (settings.length == 0) {
                    res.send([], 200);
                    return;
                }

                var template_arrays = _.pluck(settings, 'templates');
                if (template_arrays.length == 0) {
                    res.send([], 200);
                    return;
                }

                var templates = _.flatten(template_arrays);

                // 2.
                OrganizationModule.collection.find({'settings.templates': {$in: templates}}, {fields: {_id: true}}).toArray(function (err_other_orgs, orgs) {
                    if (err_other_orgs) {
                        res.send(err_other_orgs, 500);
                        return;
                    }

                    var ids = _.map(orgs, function (org) {
                        return org._id.toHexString();
                    });
                    _doStandardQuery(req, res, caller, DatabaseModule, static_load_name, true, {organization: {$in: ids}});
                });
            });
        });
    });
}

function _doStandardQuery(req, res, caller, DatabaseModule, static_load_name, ignore_organization, additionalParams) {
    var query = additionalParams ? additionalParams : {};

    nodeUtils.extendQueryWithRegex(req.query, query, true);

    function onComplete(err, answer_list) {

        if(err != null) {
            res.send('An error occurred: ' + err, 500);
            return;
        }

        // sort results in the order the params were given
        _.each(_.keys(req.query), function(query_key) {
            if(query_key != '_') {
                answer_list.sort(function(a, b) { return (a[query_key] < b[query_key] ? -1 : (a[query_key] == b[query_key] ? 0 : 1)); });
            }
        });

        res.send(answer_list, 200);
    }

    if(!nodeUtils.isUserGlobal(caller) && !ignore_organization) {
        query.organization = { $in: caller.organizations };
    }

    if(static_load_name) {
        _getStaticList(static_load_name, DatabaseModule, query, onComplete);
    } else {
        DatabaseModule.find(query, onComplete);
    }
}

function _getScopedList(req, res, resource, collection, statuses, errorCallbacks, resultsCallback) {
    winston.log('debug', 'entered router-common.getScopedList(req, res, resource=' + resource + ')');
    _ensureHasAccess(req, res, resource, 'l', errorCallbacks, function(caller) {
        if(_.isUndefined(statuses) || _.isNull(statuses) || statuses.length == 0) {
            if(nodeUtils.isUserGlobal(caller)) {
                winston.log('debug', 'returning a global-scoped list in router-common.getScopedList(req, res, resource=' + resource + ')');
                collection.list(exports.queryResultHandler(req, res, errorCallbacks, resultsCallback));
            } else if(caller.organizations) {
                winston.log('debug', 'returning an organization-scoped list in router-common.getScopedList(req, res, resource=' + resource + ')');
                collection.listByOrganizations(caller.organizations, exports.queryResultHandler(req, res, errorCallbacks, resultsCallback));
            } else {
                errorCallbacks.on404(req, res);
            }
        } else {
            if(nodeUtils.isUserGlobal(caller)) {
                winston.log('debug', 'returning a global-scoped list in router-common.getScopedList(req, res, resource=' + resource + ', status)');
                collection.listByStatuses(statuses, exports.queryResultHandler(req, res, errorCallbacks, resultsCallback));
            } else if(caller.organizations) {
                winston.log('debug', 'returning an organization-scoped list in router-common.getScopedList(req, res, resource=' + resource + ', status)');
                collection.listByOrganizationsAndStatuses(caller.organizations, statuses, exports.queryResultHandler(req, res, errorCallbacks, resultsCallback));
            } else {
                errorCallbacks.on404(req, res);
            }
        }
    });
}


function _getScopedStaticList(req, res, resource, staticCollectionName, collection, additionalQueryParams, errorCallbacks, resultsCallback) {
    _ensureHasAccess(req, res, resource, 'l', errorCallbacks, function(caller) {
        if(nodeUtils.isUserGlobal(caller)) {
            winston.log('debug', 'returning a global-scoped list in router-common.getScopedStaticList(req, res, resource=' + resource + ')');
            _getStaticList(staticCollectionName, collection, additionalQueryParams, function(err, results) {
                if(err != null) {
                    errorCallbacks.on500(req, res, err);
                } else {
                    resultsCallback(results);
                }
            });
        } else if(caller.organizations) {
            winston.log('debug', 'returning an organization-scoped list in router-common.getScopedStaticList(req, res, resource=' + resource + ')');
            _getStaticList(staticCollectionName,
                collection,
                _.extend({ "organization": { $in: caller.organizations }}, additionalQueryParams),
                function(err, results) {
                    if(err != null) {
                        errorCallbacks.on500(req, res, err);
                    } else {
                        resultsCallback(results);
                    }
                }
            );
        } else {
            errorCallbacks.on500(req, res, 'no organizations found');
        }
    });
}

function _getStaticList(staticCollectionName, collectionModule, additionalQueryParams, callback) {
    StaticLoadModule.findLatest(staticCollectionName, function(err, static_object) {
        if(err == null && static_object != null) {
            additionalQueryParams.timestamp = static_object.timestamp;
            collectionModule.find(additionalQueryParams, function(err, results) {
                callback(err, results != null ? results : []);
            });
        } else {
            winston.log('error', 'could not find static load reference for ' + staticCollectionName);
            callback(err, null);
        }
    });
}

function _listAuditTeams(caller, callback) {
    winston.log('debug', 'getting a list of auditor teams visible to user=' + caller.name);
    if(nodeUtils.isUserGlobal(caller)) {
        AuditTeamModule.find({state: 'active'}, callback);
    } else if(AccessManager.hasAccess(AccessManager.getRole(caller), 'audit-team', 'l') && caller.organizations) {
        AuditTeamModule.listByOrganizationsAndStatuses(caller.organizations, ['active'], callback);
    } else {
        AuditTeamModule.findTeamsWithMember(caller._id, callback);
    }
}

function _listPointsOfSale(req, res, errorCallbacks, resultsCallback) {
    winston.log('debug', 'entered router-common.listPointsOfSale(req, res)');
    _ensureHasAccess(req, res, 'pos', 'l', errorCallbacks, function(caller) {
        _getScopedStaticList(req, res, 'pos', 'point-of-sale', PointOfSaleModule, {}, errorCallbacks, function(process_pos) {
            if(nodeUtils.isUserGlobal(caller)) {
                winston.log('debug', 'returning a global-scoped list in router-common.listPointsOfSale(req, res)');
                _getStaticList('point-of-sale', PointOfSaleModule, { source: 'import' }, exports.queryResultHandler(req, res, errorCallbacks, function(process_pos) {
                    PointOfSaleModule.find({source: { $ne: 'import'}}, function(err, custom_pos) {
                        resultsCallback(process_pos.concat(custom_pos));
                    });
                }));
            } else if(caller.organizations) {
                winston.log('debug', 'returning an organization-scoped list in router-common.listPointsOfSale(req, res)');
                PointOfSaleModule.find({source: { $ne: 'import'}, organization: { $in: caller.organizations } }, function(err, custom_pos) {
                    resultsCallback(custom_pos.concat(process_pos));
                });
            } else {
                res.redirect('/');
            }
        });
    });
}

function _findPointsOfSale(req, res, query, errorCallbacks, resultsCallback) {
    winston.log('debug', 'entered router-common.findPointsOfSale(req, res)');
    _ensureHasAccess(req, res, 'pos', 'l', errorCallbacks, function(caller) {
        _rawFindPointsOfSale(caller, query, function(err, results) {
            if(err) {
                errorCallbacks.on500(req, res, err);
                return;
            }

            if(!results) {
                errorCallbacks.on404(req, res);
                return;
            }
            resultsCallback(results);
        });
    });
}

function _rawFindPointsOfSale(caller, query, callback2) {
    StaticLoadModule.findLatest('point-of-sale', function(err, static_object) {
        if(err == null && static_object != null) {
            var import_query = _.extend(JSON.parse(JSON.stringify(query)), { timestamp: static_object.timestamp });
            var customs_query = _.extend(JSON.parse(JSON.stringify(query)), {source: { $ne: 'import'} });

            if(nodeUtils.isUserGlobal(caller)) {
                winston.log('debug', 'returning a global-scoped result in router-common.findPointsOfSale(req, res)');
                query = {$or: [import_query, customs_query]};

                PointOfSaleModule.collection.aggregate([
                    { $match: query },
                    { $limit: 1000 } // TODO: ack
                ],
                {
                    allowDiskUse: true
                }, function (err_samples, samples_results) {
                    callback2(err_samples, samples_results);
                });
            } else if(caller.organizations) {
                import_query.organization = { $in: caller.organizations };
                customs_query.organization = { $in: caller.organizations };
                query = {$or: [import_query, customs_query]};

                winston.log('debug', 'returning an organization-scoped result in router-common.findPointsOfSale(req, res)');
                PointOfSaleModule.find(query, function(err, custom_pos) {
                    callback2(err, custom_pos);
                });
            } else {
                callback2(null, null);
            }
        } else {
            callback2(err);
        }
    });
}

function _listStoreChecks(req, res, caller, statuses, errorCallbacks, results_callback) {
    if(_userHasAccess(caller, 'store-check', 'l')) {
        if(nodeUtils.isUserGlobal(caller)) {
            StoreCheckModule.listByStatuses(statuses, exports.queryResultHandler(req, res, errorCallbacks, results_callback));
        } else {
            StoreCheckModule.listByOrganizationsAndStatuses(caller.organizations, statuses, exports.queryResultHandler(req, res, errorCallbacks, results_callback));
        }

    } else if(_userHasAccess(caller, 'audit-team/store-check', 'l')) {
        _getStoreCheckListsForUserBasedOnTeams(caller._id, function(err, storecheck_ids) {
            if(storecheck_ids) {
                StoreCheckModule.getStoreChecksWithStatusFromIdList(storecheck_ids, statuses, exports.queryResultHandler(req, res, errorCallbacks, results_callback));
            } else {
                results_callback([]);
            }
        });
    } else {
        errorCallbacks.authFailed(req, res);
    }
}

function _listUsersByRole(req, res, caller, role, errorCallbacks, results_callback) {
    winston.log('debug', 'entered router-common.listUsersByRole(req, res, caller=' + caller.name + ', role=' + role + ')');
    if(_userHasAccess(caller, role, 'l') || _userHasAccess(caller, 'user', 'l')) {
        if(nodeUtils.isUserGlobal(caller)) {
            AccountManager.getAllUsersWithRole(role, exports.queryResultHandler(req, res, errorCallbacks, results_callback));
        } else {
            AccountManager.getAllUsersWithRoleInOrganizations(role, req.session.user.organizations, exports.queryResultHandler(req, res, errorCallbacks, results_callback));
        }
    } else if(_userHasAccess(caller, 'audit-team/' + role, 'l')) {
        if(nodeUtils.isUserGlobal(caller)) {
            AccountManager.getAllUsersWithRole(role, exports.queryResultHandler(req, res, errorCallbacks, results_callback));
        } else {
            AuditTeamModule.findTeamsWithMember(caller._id, exports.queryResultHandler(req, res, errorCallbacks, function(teams) {
                // get a list of team member ids for teams occupied by the signed-in user
                var team_member_ids = [];
                for(var i=0; i<teams.length; i++) {
                    for(var j=0; j<teams[i].members.length; j++) {
                        team_member_ids.push(teams[i].members[j]);
                    }
                }

                if(teams.length > 0) {
                    // get all users in teams shared by this user
                    var objectIds = team_member_ids.map(function(id) { return AccountManager.getObjectId(id); });
                    AccountManager.find({
                        _id: {$in: objectIds},
                        roles: { $in: [ role ]}
                    }, exports.queryResultHandler(req, res, errorCallbacks, results_callback));
                } else {
                    results_callback([]);
                }
            }));
        }
    } else {
        errorCallbacks.authFailed(req, res);
    }
}

function _listVisits(req, res, errorCallbacks, results_callback) {
    _ensureUserInSession(req, res, errorCallbacks.userNotInSession, function(caller) {
        if(_hasAccess(req, 'visit', 'l')) { // TODO: this should be a global check.  And the L perm should do an org-scoped visit list
            if(nodeUtils.isUserGlobal(caller)) {
                VisitModule.list(exports.queryResultHandler(req, res, errorCallbacks, results_callback));
                return;
            }

            if(caller.organizations) {
                VisitModule.listByOrganizations(caller.organizations, exports.queryResultHandler(req, res, errorCallbacks, results_callback));
                return;
            }

            errorCallbacks.authFailed(req, res);

        } else if(_hasAccess(req, 'audit-team/visit', 'l')) {
            AuditTeamModule.findTeamIdsForMember(req.session.user._id, exports.queryResultHandler(req, res, errorCallbacks, function(team_ids) {
                AuditAssignmentModule.findStoreCheckIdsForTeams(team_ids, exports.queryResultHandler(req, res, errorCallbacks, function(storecheck_ids) {
                    VisitModule.getVisitsForStoreChecks(storecheck_ids, undefined, exports.queryResultHandler(req, res, errorCallbacks, results_callback));
                }));
            }));
        } else {
            errorCallbacks.authFailed(req, res);
        }
    });
}

function _listVisitIds(req, res, errorCallbacks, results_callback) {
    _ensureUserInSession(req, res, errorCallbacks.userNotInSession, function(caller) {
        if(_hasAccess(req, 'visit', 'l')) { // TODO: this should be a global check.  And the L perm should do an org-scoped visit list
            if(nodeUtils.isUserGlobal(caller)) {
                VisitModule.collection.distinct('_id', function(err_visit_ids, visit_ids) {
                    if(err_visit_ids) {
                        errorCallbacks.on500(req, res, err_visit_ids);
                        return;
                    }
                    results_callback(visit_ids);
                });
                return;
            }

            if(caller.organizations) {
                VisitModule.collection.distinct('_id', {organization: {$in: caller.organizations}}, function(err_visit_ids, visit_ids) {
                    if(err_visit_ids) {
                        errorCallbacks.on500(req, res, err_visit_ids);
                        return;
                    }
                    results_callback(visit_ids);
                });
                return;
            }

            errorCallbacks.authFailed(req, res);

        } else if(_hasAccess(req, 'audit-team/visit', 'l')) {
            AuditTeamModule.findTeamIdsForMember(req.session.user._id, exports.queryResultHandler(req, res, errorCallbacks, function(team_ids) {
                AuditAssignmentModule.findStoreCheckIdsForTeams(team_ids, exports.queryResultHandler(req, res, errorCallbacks, function(storecheck_ids) {
                    VisitModule.getVisitsForStoreChecks(storecheck_ids, {_id: 1}, function(err_visits, visits) {
                        if(err_visits) {
                            errorCallbacks.on500(req, res, err_visits);
                            return;
                        }
                        results_callback(_.pluck(visits, '_id'));
                    });
                }));
            }));
        } else {
            errorCallbacks.authFailed(req, res);
        }
    });
}

function _getQuestionsForTemplate(template, level1_t02_codes, callback) {
    var questions = [], active, active_answers, answer_weights = {};
    _.each(template.records, function(template_record) {
        _.each(template_record.questions, function(question) {
            active = false;
            active_answers = [];
            if(question.answers) {
                question.answers.forEach(function(answer) {
                    answer_weights[answer.identity_id] = answer.weight;
                    if(typeof(answer.active) != 'undefined' &&  answer.active == 'true') {
                        active = true;
                        active_answers.push(answer);
                    }
                });
                question.answers = active_answers;
            }

            if(active) {
                questions.push(question);
            }
        });
    });

    // Note: We only handle records[0].  This will probably be ok in the long-run, as we don't seem to need to support multiples
    exports.getTemplateLevel(function(data, code) {
        if(code == 200 && data.length > 0) {

            // go through each question, and add hierarchy properties from the corresponding L0 entries.
            _.each(questions, function(question) {
                var question_from_hierarchy = _.findWhere(data, {identity_id: question.identity_id});

                if(!_.isUndefined(question_from_hierarchy)) {
                    question = _.extend(question, _.pick(question_from_hierarchy,
                        'company_id',
                        'category_id',
                        'level1_description', 'level1_description2', 'level1_description3',
                        'level2_description', 'level2_description2', 'level2_description3',
                        'level3_description', 'level3_description2', 'level3_description3',
                        'level4_description', 'level4_description2', 'level4_description3',
                        'level1_code', 'level2_code', 'level3_code', 'level4_code',
                        'level1_sequence', 'level2_sequence', 'level3_sequence', 'level4_sequence',
                        'category_specific',
                        'category_specific_options',
                        'date_added',
                        'date_changed'
                    ));
                    question.conformance = "conform";
                    question.level5_description = question_from_hierarchy.description;
                    question.level5_description2 = question_from_hierarchy.description2;
                    question.level5_description3 = question_from_hierarchy.description3;
                    question.level5_code = question_from_hierarchy.code;
                    question.level5_sequence = question_from_hierarchy.sequence;

                    _.each(question.answers, function(answer) {
                        var answer_from_hierarchy = _.findWhere(question_from_hierarchy.children, {identity_id: answer.identity_id});

                        if(typeof(answer_from_hierarchy) != 'undefined') {
                            answer.weight = answer_weights[answer.identity_id];//answer_from_hierarchy.weight; // TODO: this should come from the template, not hierarchy
                            answer.text = answer_from_hierarchy.text;
                            if(question.answers.length > 1) {
                                answer.value = answer_from_hierarchy.default_indicator == "1" ? "true" : question_from_hierarchy.children.length > 0 ? answer_from_hierarchy.default_indicator : "false";
                            } else {
                                answer.value = "";
                            }
                            answer.code = answer_from_hierarchy.code;
                            answer.sequence = answer_from_hierarchy.sequence;
                        }
                    });
                }
            });
            callback(null, questions);
        }  else {
            callback('no questions were found for the given template', null);
        }
    }, "5", template.records[0].company_id, template.records[0].t03_code, level1_t02_codes, template.records[0].language, template.records[0].timestamp_L5);
}

function _getSamplesMeta(visit_id, question_id, samples) {
    var samplesMeta = {};
    samplesMeta.samples = [];
    samplesMeta.visit_id = visit_id;
    samplesMeta.question_id = question_id;

    samples.forEach(function(sample) {
        var samplesItem = {};
        var active_questions = [];

        // limit to active questions
        sample.questions.forEach(function(question) {
            if(SamplesModule.isQuestionActive(question)) {
                active_questions.push(question);
            }
        });
        sample.questions = active_questions;

        // Sort each items' questions by sequence
        sample.questions.forEach(function(question) {
            if(question.answers) {
                question.answers.sort(function(a, b) {
                    return (parseInt(a.sequence, 10) - parseInt(b.sequence, 10));
                });
            }
        });

        // sort the questions by sequence
        SamplesModule.sortQuestions(sample.questions);

        if(typeof(question_id) == 'undefined') {
            samplesItem = sample;
            samplesItem.question = samplesItem.questions[0];
            samplesMeta.next_question_id = (sample.questions.length > 1) ? sample.questions[1].identity_id : "";
            samplesMeta.prior_question_id = (sample.questions.length > 0) ? sample.questions[sample.questions.length - 1].identity_id : "";
            samplesMeta.question_id = samplesItem.question.identity_id;

            samplesMeta.samples.push(samplesItem);
        } else {
            sample.questions.forEach(function(question, j) {
                if(question.identity_id == question_id) {
                    samplesItem = sample;
                    samplesItem.question = question;
                    samplesMeta.next_question_id = (j < sample.questions.length - 1) ? sample.questions[j + 1].identity_id : "";
                    samplesMeta.prior_question_id = (j > 0) ? sample.questions[j-1].identity_id : sample.questions[sample.questions.length - 1].identity_id;

                    samplesMeta.samples.push(samplesItem);
                }
            });
        }

        sample.questions.forEach(function(question) {
            //SamplesModule.deleteLevelCodes(question);
            SamplesModule.deleteExtraDescriptions(question);
            SamplesModule.deleteSequenceCodes(question);
            if(question.identity_id != samplesMeta.question_id) {
                delete question.category_specific_options;
                delete question.answers;
            }
            delete question.answer_date;
        });
    });
    return samplesMeta;
}

function _getExtendedSamplesInfo(caller, idList, currentQuestionId, req, res, results_callback, error_callback) {
    // the difficulty in this method is to figure out whether each of the sampleids is visible to the requestor within making 1-3 db calls each
    // TODO: for now, should at least be sure the organization matches, but we should really confirm the team matches, too
    var loaded_samples, loaded_visits;

    async.series({

        'samples': function(callback_async) {
            _getByIdsIfAuthorized(req, res, idList, 'sample', SamplesModule, exports.viewErrorCallbacks, function(sample_results) {
                loaded_samples = sample_results;

                var samplesMeta = exports.getSamplesMeta(null, currentQuestionId, sample_results);
                callback_async(null, samplesMeta);
            });
        },

        'visits': function(callback_async) {
            VisitModule.getVisitsForSamples(idList, exports.queryResultHandler(req, res, exports.viewErrorCallbacks, function(visits) {
                loaded_visits = visits;
                callback_async(visits.length == 0 ? 'Could not find visit for one or more samples' : null, visits);
            }));
        },

        'storechecks': function(callback_async) {
            var storecheck_ids = _.pluck(loaded_visits, 'store_check_id');
            _getByIdsIfAuthorized(req, res, storecheck_ids, 'store-check', StoreCheckModule, exports.viewErrorCallbacks, function(storechecks) {
                callback_async(null, storechecks);
            });
        },

        'products': function(callback_async) {
            var product_ids = _.pluck(loaded_samples, 'product_id');
            _getByIdsIfAuthorized(req, res, product_ids, 'product', ProductModule, exports.viewErrorCallbacks, function(products) {
                callback_async(null, products);
            });
        },

        'factories': function(callback_async) {
            // TODO: merge samples with their visits

            // TODO: merge samples with their storechecks
            // TODO: I think we should get a list of factory ids and production line ids and just query for those
            _getStaticList('factories', FactoryModule, { }, exports.queryNonFatalResultHandler(function(factories) {
                callback_async(null, factories);
            }));
        },

        'production_lines': function(callback_async) {
            _getStaticList('production-lines', ProductionLineModule, { hierarchy_level: "0" }, exports.queryNonFatalResultHandler(function(production_lines) {
                callback_async(null, production_lines);
            }));
        }

    }, function(err, async_results) {
        if(err != null ) {
            error_callback(err);
        } else {
            results_callback(async_results);
        }
    });
}

function _getTemplateLevel(callback, level, company_id, t03_code, level1_t02_codes, language, timestamp) {
    if(level != "0" && level != "5") {
        callback('Level not found', 404);
        return;
    }

    if(language == "en") {
        if(level == "5") {
            HierarchyModule5.findEntries(company_id, t03_code, timestamp, level1_t02_codes, function(err, items) {
                if(err == null) {
                    if(!items || items.length == 0) {
                        winston.warn('when finding L5 entries, no results were returned: ' + t03_code + ', ' + timestamp + ', ' + level1_t02_codes);
                    }
                    callback(items, 200);
                } else {
                    callback(err, 500);
                }
            });
        } else {
            winston.error('could not find template hierarchy level=' + level);
            callback('could not find template hierarchy level=' + level, 500);
        }
        return;
    } else {
        if(level == "5") {
            HierarchyTranslationModule5.findEntries(company_id, t03_code, language, timestamp, level1_t02_codes, function(err, items) {
                if(err == null) {
                    callback(items, 200);
                } else {
                    callback(err, 500);
                }
            });
        } else {
            winston.error('could not find template hierarchy level=' + level);
            callback('could not find template hierarchy level=' + level, 500);
        }
    }
}

function _pushMessage(req, type, message) {
    if(typeof(req.session.messages) != 'undefined') {
        req.session.messages.push( {type: type, message: message} );
    } else {
        req.session.messages = [ {type: type, message: message} ];
    }
}

function _popMessages(req) {
    if(typeof(req.session.messages) != 'undefined') {
        var messages = req.session.messages;
        req.session.messages = [];
        return messages;
    } else {
        req.session.messages = [];
        return [];
    }
}

// TODO: This should go into some kind of "service router common" but since it references router-common stuff, that seemed a little bit unwieldy for now
function _handleGetResourceById(req, res, method, path, resource_type, collection) {
    _getByIdIfAuthorized(req, res, req.param('id'), resource_type, collection, exports.serviceErrorCallbacks, function(item, caller) {
        _logRequest(req, true, caller);

        res.send(item, 200);
    });
}

// when searching samples, this method ensures that the samples are limited to those belonging to visits
// the caller can see, and no others.
function _findSamples(req, res, queryParams, materialization, page, pageSize, sort, errorCallbacks, resultsCallback) {
    var visit_ids, query = {}, fields = {}, caller;

    async.series({

        'caller': function(callback) {
            _ensureUserInSession(req, res, errorCallbacks.userNotInSession, function(caller_in_session) {
                caller = caller_in_session;
                callback();
            });
        },

        'visits': function(callback) {
            if(caller.roles.indexOf('admin') != -1) {
                callback();
            }

            exports.listVisitIds(req, res, exports.viewErrorCallbacks, function(visit_id_lists) {
                visit_ids = visit_id_lists;
                callback();
            });
        },

        'build_query': function(callback) {

            if(visit_ids) {

                // limit to the visits this user can see
                visit_ids = _.map(visit_ids, function(visit_id) { return visit_id.toHexString(); });
                query = {
                    visit_id: {$in: visit_ids}
                };

                // if the query specifically uses visit_id, apply it
                if(queryParams.visit_id) {
                    query.visit_id = {$and: [query.visit_id, queryParams.visit_id]};
                }
            }

            query = _.extend(query, queryParams);

            callback();
        },

        'process_sort_param': function(callback) {
            if(!_.isUndefined(materialization)) {
                fields = materialization;
            }

            // make new attribute during aggregation that is a lower-case copy of the attribute
            // do it only for sorted fields.  Then, modify the sort struct to refer to the new field(s)
            _.each(_.keys(sort), function(sort_field) {
                if(sort_field == 'name') {
                    var fieldname = 'name_lwr';
                    fields[fieldname] = {
                        $cond: [
                            {$gte: ['$name', 0]},
                            '$name',
                            {
                                '$toLower': '$name'
                            }
                        ]
                    };
                    sort[fieldname] = sort[sort_field];
                    delete sort[sort_field];
                    return;
                }

                var field_name = sort_field + '_lwr';
                field_name = field_name.replace(/\./gm,"_");

                var aggregation_name = "$" + sort_field;

                fields[field_name] = { "$toLower": aggregation_name};

                sort[field_name] = sort[sort_field];
                delete sort[sort_field];
            });

            callback();
        },

        'samples': function(callback) {
            if(!page || !pageSize) {
                SamplesModule.collection.find(query, fields).toArray(function(err_samples, samples) {
                    if(err_samples) {
                        errorCallbacks.on500(req, res, err_samples);
                        return;
                    }
                    resultsCallback(samples);
                });
                return;
            }

            try {
                SamplesModule.collection.find(query).count(function(err_count, count) {
                    if(err_count) {
                        errorCallbacks.on500(req, res, 'could not count samples: ' + err_count);
                        return;
                    }

                    var aggregation_values = [
                        { $project: fields } // TODO: perhaps do that AFTER $match
                    ];

                    if(query && _.keys(query)) {
                        aggregation_values.push({ $match: query });
                    }
                    if(sort && _.keys(sort).length > 0) {
                        aggregation_values.push({ $sort: sort });
                    }

                    pageSize = parseInt(pageSize);
                    page = parseInt(page);

                    aggregation_values.push({ $skip: page * pageSize });
                    aggregation_values.push({ $limit: pageSize });

                    SamplesModule.collection.aggregate(
                        aggregation_values,
                        {
                            allowDiskUse: true
                        }, function(err_result, result) {
                            resultsCallback({rows: result, total_records: count}, 200);
                        }
                    );
                });

            } catch(ex) {
                errorCallbacks.on500(req, res, 'could not parse page and page size');
            }
        }
    });
}

// TODO: This should go into some kind of "view router common" but since it references router-common stuff, that seemed a little bit unwieldy for now
function _renderSampleList(req, res, path, title, idFilter, caller) {
    var sample_filter = {};
    if(idFilter != null) {
        sample_filter = idFilter;
    }

    var sample_ids = [];

    async.series([
        function(callback) {
            if(!idFilter) {
                callback();
                return;
            }
            var page = undefined;
            var pageSize = undefined;
            var sort = undefined;
            exports.findSamples(req, res, sample_filter, {_id: true}, page, pageSize, sort, exports.viewErrorCallbacks, function(sample_results) {
                sample_ids = _.map(sample_results, function(sample){return sample._id.toHexString();});
                callback();
            });
        }
    ], function() { // err_async, async_results
        exports.render(req, res, 'sample-list', {
            samples: sample_ids,
            formatter: formatter,
            caller: caller,
            path: path,
            title: title
        });
    });
}

function _getOrganizationSettings(req, caller, resultsCallback) {
    if(!_.isUndefined(caller.active_organization) && !_.isNull(caller.active_organization)) {
        OrganizationModule.findOneById(caller.active_organization, function(err, organization_result) {
            if(_.isUndefined(organization_result) || _.isNull(organization_result)) {
                resultsCallback({});
                return;
            }

            if(_.isUndefined(organization_result.settings) || _.isNull(organization_result.settings)) {
                resultsCallback({});
                return;
            }

            resultsCallback(organization_result.settings);
        });
        return;
    }
    resultsCallback({});
}

// HELPERS

function _userInSession(req) {
    return !(_.isUndefined(req.session.user) || req.session.user == null);
}

function _hasAccess(req, suffix, action) {
    if(!_userInSession(req)){
        return false;
    } else if(req.session.user.roles != null) {
        return _userHasAccess(req.session.user, suffix, action);
    }
    return false;
}

function _getStoreCheckListsForUserBasedOnTeams(user_id, results_callback) {
    //winston.log('debug', 'entered router-common._getStoreCheckListsForUserBasedOnTeams(user.id=' + user_id + ')');
    AuditTeamModule.findTeamIdsForMember(user_id, function(err, teamIds) {
        AuditAssignmentModule.findStoreCheckIdsForTeams(teamIds, function(err, storecheck_ids) {
            results_callback(err, storecheck_ids);
        });
    });
}

