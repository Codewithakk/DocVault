document.addEventListener('DOMContentLoaded', function () {
    // Show loading spinner initially
    const $table = $('#donorTable');

    const $loadingSpinner = $('#loadingSpinner');

    // Notification helpers (use showToast if available, else console)
    function notifySuccess(message) {
        if (typeof showToast === 'function') {
            try { showToast(message, 'success'); return; } catch (e) { }
        }
    }


    function notifyError(message) {
        if (typeof showToast === 'function') {
            try { showToast(message, 'error'); return; } catch (e) { }
        }
    }

    // Build header dynamically so EJS doesn't need static columns
    (function buildDynamicHeader() {
        const headers = [
            { title: '#', width: '5%' },
            { title: 'Action', width: '15%' },
            { title: 'Full Name' },
            { title: 'Email' },
            { title: 'Phone' },
            { title: 'Organization' },
            { title: 'Donor Type' },
            { title: 'PAN/Tax ID' },
            { title: 'Address' }
        ];
        const $thead = $table.find('thead');
        if ($thead.length) {
            const tr = document.createElement('tr');
            headers.forEach(h => {
                const th = document.createElement('th');
                th.textContent = h.title;
                if (h.width) th.setAttribute('width', h.width);
                tr.appendChild(th);
            });
            $thead.empty().append(tr);
        }
    })();

    // Silence DataTables default alert on ajax errors
    if ($.fn && $.fn.dataTable && $.fn.dataTable.ext) {
        $.fn.dataTable.ext.errMode = 'none';
    }

    // Initialize DataTable with Bootstrap 5 styling (server-side)
    var table = $table.DataTable({
        processing: true,
        serverSide: true, // use server-side endpoint at /api/donors
        responsive: true,
        lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'All']],
        pageLength: 10,
        language: {
            processing: '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>',
            emptyTable: 'No donor records found',
            zeroRecords: 'No matching records found',
            info: 'Showing _START_ to _END_ of _TOTAL_ entries',
            infoEmpty: 'Showing 0 to 0 of 0 entries',
            infoFiltered: '(filtered from _MAX_ total entries)',
            lengthMenu: 'Show _MENU_ entries',
            search: 'Search:',
            paginate: {
                first: 'First',
                last: 'Last',
                next: 'Next',
                previous: 'Previous'
            }
        },
        ajax: {
            url: `${baseUrl}/api/donors-list`,
            type: 'post',
            dataSrc: function (json) {
                // Hide loading spinner when data is loaded
                // if ($loadingSpinner && $loadingSpinner.length) $loadingSpinner.hide();
                $table.show();
                return (json && Array.isArray(json.data)) ? json.data : [];
            },
            error: function (xhr, error, thrown) {
                // if ($loadingSpinner && $loadingSpinner.length) $loadingSpinner.hide();
                $table.show();
                // Do NOT call draw() here in server-side mode to avoid infinite retry loops
                if (table && table.clear) {
                    table.clear();
                }
                notifyError('Failed to load donor data. Showing empty list.');
            }
        },
        columns: [
            {
                data: null,
                orderable: false,
                searchable: false,
                render: function (data, type, row, meta) {
                    return meta.row + meta.settings._iDisplayStart + 1;
                },
                className: 'text-center'
            },
            {
                data: 'id',
                orderable: false,
                searchable: false,
                className: 'text-center',
                render: function (data, type, row) {
                    return `
                        <div class="btn-group" role="group">
                            <a href="/donors/register?id=${data}" class="btn btn-sm btn-info me-1" data-bs-toggle="tooltip" title="Edit">
                                <i class="ti ti-edit"></i>
                            </a>
                            <button class="btn btn-sm btn-danger delete-btn" data-id="${data}" data-bs-toggle="tooltip" title="Delete">
                                <i class="ti ti-trash"></i>
                            </button>
                        </div>
                    `;
                }
            },
            { data: 'full_name', name: 'full_name' },
            {
                data: 'email',
                name: 'email',
                render: function (data) {
                    return data || '-';
                }
            },
            {
                data: 'phone',
                name: 'phone',
                render: function (data) {
                    return data || '-';
                }
            },
            {
                data: 'organization_name',
                name: 'organization_name',
                render: function (data) {
                    return data || '-';
                }
            },
            {
                data: 'donor_type',
                name: 'donor_type',
                render: function (data) {
                    const types = {
                        'individual': 'Individual',
                        'corporate': 'Corporate',
                        'ngo': 'NGO'
                    };
                    return types[data] || data || '-';
                }
            },
            {
                data: 'pan_tax_id',
                name: 'pan_tax_id',
                render: function (data) {
                    return data || '-';
                }
            },
            {
                data: 'address',
                name: 'address',
                render: function (data) {
                    return data ? (data.length > 50 ? data.substring(0, 50) + '...' : data) : '-';
                }
            }
        ],
        dom: "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>>" +
            "<'row'<'col-sm-12'tr>>" +
            "<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
        initComplete: function () {
            // Initialize tooltips
            var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });

            // Style search input and length menu
            $('.dataTables_filter input').addClass('form-control form-control-sm').attr('placeholder', 'Search donors...');
            $('.dataTables_length select').addClass('form-select form-select-sm');
        },
        drawCallback: function () {
            // Re-initialize tooltips after each table draw
            var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });
        }
    });

    // Bootstrap modal based delete confirmation
    let pendingDeleteId = null;
    const $confirmModal = $('#confirmDeleteModal');
    const $confirmBtn = $('#confirmDeleteBtn');

    // Open modal and store the id
    $(document).on('click', '.delete-btn', function () {
        pendingDeleteId = $(this).data('id');
        $confirmModal.modal('show');
    });

    // Ensure we don't double bind
    $confirmBtn.off('click').on('click', function () {
        if (!pendingDeleteId) {
            $confirmModal.modal('hide');
            return;
        }
        // Disable confirm while processing
        const $btn = $(this);
        $btn.prop('disabled', true).text('Deleting...');

        $.ajax({
            url: `${baseUrl}/api/donor-delete/${pendingDeleteId}`,
            type: 'DELETE',
            success: function () {
                notifySuccess('Donor deleted successfully');
                table.ajax.reload(null, false); // stay on the same page
            },
            error: function (xhr) {
                notifyError('Error deleting donor: ' + (xhr.responseJSON?.message || 'Unknown error'));
            },
            complete: function () {
                pendingDeleteId = null;
                $btn.prop('disabled', false).text('Delete');
                $confirmModal.modal('hide');
            }
        });
    });
});
