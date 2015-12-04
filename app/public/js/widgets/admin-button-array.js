var admin_button_array = (function () {

    function init(page_controller) {

        _initLoadEPCFiles(page_controller);
        _initLoadEPCLanguage(page_controller);
        _initLoadProducts(page_controller);
        _initLoadFactories(page_controller);
        _initLoadProductionLines(page_controller);

        function initTemplateImport(email) {
            page_controller.showLoadingMessage('Loading...');
            $.ajax({
                type: 'POST',
                url: '/excipio-import?type=template',
                data: {
                    email: email
                }
            }).done(function() { //result
                page_controller.showAlert('Import started.  You will receive an email when completed.', 'Process Started!');
            }).error(function(jqXHR){
                page_controller.showAlert(jqXHR.responseText, 'Error');
            });
        }

        $('.load-audit-grids').click(function() {
            $('.process-email-modal').modal('show');
            var process_button = $('.process-email-modal button.submit');
            process_button.unbind('click');
            process_button.click(function() {
                $('.process-email-modal').modal('hide');
                initTemplateImport($('.process-email-modal input').val());
                return false;
            });
        });

        $('.load-points-of-sale').click(function() {
            $('.process-email-modal').modal('show');
            var process_button = $('.process-email-modal button.submit');
            process_button.unbind('click');
            process_button.click(function() {
                $('.process-email-modal').modal('hide');
                page_controller.showLoadingMessage('Loading...');
                $.ajax({
                    type: 'POST',
                    url: '/excipio-import?type=pos',
                    data: {
                        email: $('.process-email-modal input').val()
                    }
                }).done(function () { //result
                    page_controller.showAlert('Import started.  You will receive an email when completed.', 'Process Started!');
                }).error(function (jqXHR) {
                    page_controller.showAlert(jqXHR.responseText, 'Error');
                });
            });
        });

        $('.load-general').click(function() {
            $('.process-email-modal').modal('show');
            var process_button = $('.process-email-modal button.submit');
            process_button.unbind('click');
            process_button.click(function() {
                $('.process-email-modal').modal('hide');
                page_controller.showLoadingMessage('Loading...');
                $.ajax({
                    type: 'POST',
                    url: '/excipio-import?type=general',
                    data: {
                        email: $('.process-email-modal input').val()
                    }
                }).done(function () { //result
                    page_controller.showAlert('Import started.  You will receive an email when completed.', 'Process Started!');
                }).error(function (jqXHR) {
                    page_controller.showAlert(jqXHR.responseText, 'Error');
                });
            });
        });

        $('.admin-button-array-form-btn-load-organization').fileupload({
            dataType: 'json',
            url: '/organization/O05/reload',
            always: function () { //e, data
                page_controller.showAlert('Completed!', 'Complete');
            }
        });

        $('.admin-button-array-form-btn-organization-process').click(function() {
            $.ajax({
                type: 'POST',
                url: '/organization/sync'
            }).done(function() { //result
                page_controller.showAlert('Completed!', 'Complete');
            });
        });

        $('.admin-button-init-dynamic-config').click(function() {
            $.ajax({
                type: 'POST',
                url: '/dynamic-config/init'
            }).done(function() { //result
                page_controller.showAlert('Completed!', 'Complete');
            });
        });

        $('.admin-button-array-form-btn-pos-hierarchy').click(function() {
            page_controller.showLoadingMessage('Loading...');
            $.ajax({
                type: 'POST',
                url: '/pos/hierarchy/init'
            }).done(function() { //result
                page_controller.showAlert('Started!', 'Process began!');
            });
        });

        $('.admin-button-array-form-btn-reload-provinces').click(function() {
            $.ajax({
                type: 'GET',
                url: '/world/provinces/reload'
            }).done(function() { //result
                page_controller.showAlert('Completed!', 'Complete');
            });
        });

        $('.admin-button-array-form-btn-reload-countries').click(function() {
            $.ajax({
                type: 'GET',
                url: '/world/countries/reload'
            }).done(function() { //result
                page_controller.showAlert('Completed!', 'Complete');
            });
        });

        $('.admin-button-array-form-btn-erase-data').click(function() {
            page_controller.showConfirmation('Are you sure you want to delete all user-entered data?', 'Delete User-Entered Data', 'Yes', function() {
                page_controller.showLoadingMessage('Deleting...');

                $.ajax({
                    type: 'DELETE',
                    url: '/admin/user-entered-data'
                }).done(function() { //result
                    window.location.reload();
                }).error(function(jqXHR){
                    page_controller.showAlert(jqXHR.responseText, 'Error');
                });
            });
        });

        $('.admin-button-array-form-btn-erase-all-data').click(function() {
            page_controller.showConfirmation('Are you sure you want to delete all data?', 'Delete All Data', 'Yes', function() {
                page_controller.showConfirmation('No, really.  Do you realize this is final?', 'Delete All Data', 'Yes', function() {
                    page_controller.showLoadingMessage('Deleting...');

                    $.ajax({
                        type: 'DELETE',
                        url: '/admin/all-data'
                    }).done(function () { //result
                        page_controller.hideLoadingMessage();
                        page_controller.showAlert('Deleted everything!  Don\'t log out until you restore!', 'Notice');
                    }).error(function (jqXHR) {
                        page_controller.showAlert(jqXHR.responseText, 'Error');
                    });
                });
            });
            return false;
        });

        $('.admin-button-array-form-btn-restore-backup').click(function() {
            $('.restore-path-modal').modal('show');
            $('.restore-path-modal button.submit').click(function() {
                $('.restore-path-modal').modal('hide');
                page_controller.showConfirmation('Are you sure you want to restore from a backup?', 'Restore Data From Backup', 'Yes', function() {
                    page_controller.showLoadingMessage('Restoring...');

                    $.ajax({
                        type: 'POST',
                        url: '/admin/backup/restore',
                        data: {
                            path: $('.restore-path-modal input').val()
                        }
                    }).done(function () { //result
                        //page_controller.hideLoadingMessage();
                        page_controller.showAlert('Backup started in background.  It may take a while.', 'Notice');
                        //window.location.reload();
                    }).error(function (jqXHR) {
                        page_controller.showAlert(jqXHR.responseText, 'Error');
                    });
                });

                return false;
            });
        });

        $('.recompute-sample-temp').click(function() {
            $.ajax({
                type: 'POST',
                url: '/admin/samples/temperature-conformance',
                data: {
                }
            }).done(function () { //result
                page_controller.showAlert('Process started in background.  It may take a while.', 'Notice');
            }).error(function (jqXHR) {
                page_controller.showAlert(jqXHR.responseText, 'Error');
            });
        });

        $('.admin-button-array-form-btn-take-backup').click(function() {
            $.ajax({
                type: 'POST',
                url: '/admin/backup',
                data: {
                }
            }).done(function () { //result
                page_controller.showAlert('Process started in background.  It may take a while.', 'Notice');
            }).error(function (jqXHR) {
                page_controller.showAlert(jqXHR.responseText, 'Error');
            });
        });

        $('.show-superadmin').click(function() {
            $('.advanced-hierarchy-controls').css('display', '');
            $(this).addClass('hidden');
        });

        $('.show-general-advanced').click(function() {
            $('.advanced-controls').removeClass('hidden');
            $(this).addClass('hidden');
        });
        _initLoadFlatHierarchies(page_controller);
    }

    function _initLoadEPCFiles(page_controller) {
        $('.loadEPC-files').fileupload({
            dataType: 'json',
            url: '/template-hierarchy/EPC/reload',
            singleFileUploads: false,
            sequentialUploads: true,
            change: function() {
                page_controller.showLoadingMessage('Loading...');
            },
            success: function () { //result, textStatus, jqXHR
                page_controller.showAlert('Completed successfully!', 'Success');
            },
            error: function(jqXHR) { //, textStatus, errorThrown
                page_controller.showAlert('Failed!  Reason: ' + jqXHR.responseText, 'Success');
            }
        });
    }

    function _initLoadEPCLanguage(page_controller) {
        $('.loadEPC-language-files').fileupload({
            dataType: 'json',
            url: '/template-hierarchy/EPC/language/reload',
            singleFileUploads: false,
            sequentialUploads: true,
            change: function() {
                page_controller.showLoadingMessage('Loading...');
            },
            success: function () { //result, textStatus, jqXHR
                page_controller.showAlert('Translation submitted for background processing!', 'Success');
            },
            error: function(jqXHR) { //, textStatus, errorThrown
                page_controller.showAlert('Failed!  Reason: ' + jqXHR.responseText, 'Success');
            }
        });
    }

    function _initLoadProducts(page_controller) {
        $('.admin-button-array-form-btn-product-hierarchy').click(function() {
            page_controller.showLoadingMessage('Loading...');
            $.ajax({
                type: 'POST',
                url: '/product-hierarchy/reload'
            }).done(function() { //result
                page_controller.showAlert('Completed!', 'Complete');
            });
        });
    }

    function _initLoadFactories(page_controller) {
        $('.admin-button-array-form-btn-factory-process').click(function() {
            page_controller.showLoadingMessage('Loading...');
            $.ajax({
                type: 'POST',
                url: '/factory-hierarchy/process'
            }).success(function() { //result
                page_controller.showAlert('Completed!', 'Complete');
            });
        });
    }

    function _initLoadProductionLines(page_controller) {
        $('.admin-button-array-form-btn-production-line-process').click(function() {
            page_controller.showLoadingMessage('Loading...');
            $.ajax({
                type: 'POST',
                url: '/production-line-hierarchy/process'
            }).done(function() {
                page_controller.showAlert('Completed!', 'Complete');
            });
        });
    }

    function _initLoadFlatHierarchies(page_controller) {
        $('.loadCustomers-file').fileupload({
            dataType: 'json',
            url: '/customers/reload',
            change: function() {
                page_controller.showLoadingMessage('Loading...');
            },
            success: function () { //result, textStatus, jqXHR
                page_controller.showAlert('Completed successfully!', 'Success');
            },
            error: function(jqXHR) { //, textStatus, errorThrown
                page_controller.showAlert('Failed!  Reason: ' + jqXHR.responseText, 'Success');
            }
        });
        $('.loadRegionOfSales-file').fileupload({
            dataType: 'json',
            url: '/region-of-sales/reload',
            change: function() {
                page_controller.showLoadingMessage('Loading...');
            },
            success: function () { //result, textStatus, jqXHR
                page_controller.showAlert('Completed successfully!', 'Success');
            },
            error: function(jqXHR) { //, textStatus, errorThrown
                page_controller.showAlert('Failed!  Reason: ' + jqXHR.responseText, 'Success');
            }
        });
        $('.admin-area-file').fileupload({
            dataType: 'json',
            url: '/admin-area/reload',
            change: function() {
                page_controller.showLoadingMessage('Loading...');
            },
            success: function () { //result, textStatus, jqXHR
                page_controller.showAlert('Completed successfully!', 'Success');
            },
            error: function(jqXHR) { //, textStatus, errorThrown
                page_controller.showAlert('Failed!  Reason: ' + jqXHR.responseText, 'Success');
            }
        });
        $('.customer-platforms-file').fileupload({
            dataType: 'json',
            url: '/customer-platforms/reload',
            change: function() {
                page_controller.showLoadingMessage('Loading...');
            },
            success: function () { //result, textStatus, jqXHR
                page_controller.showAlert('Completed successfully!', 'Success');
            },
            error: function(jqXHR) { //, textStatus, errorThrown
                page_controller.showAlert('Failed!  Reason: ' + jqXHR.responseText, 'Success');
            }
        });
        $('.danone-platforms-file').fileupload({
            dataType: 'json',
            url: '/danone-platform/reload',
            change: function() {
                page_controller.showLoadingMessage('Loading...');
            },
            success: function () { //result, textStatus, jqXHR
                page_controller.showAlert('Completed successfully!', 'Success');
            },
            error: function(jqXHR) { //, textStatus, errorThrown
                page_controller.showAlert('Failed!  Reason: ' + jqXHR.responseText, 'Success');
            }
        });

        $('button.admin-button-restart-server').click(function() {
            page_controller.showLoadingMessage('Loading...');
            $.ajax({
                type: 'POST',
                url: '/admin/restart'
            }).done(function() {
                page_controller.showAlert('Completed!', 'Complete');
            });
        });
    }

    return {
        init : init
    };
}(admin_button_array));
