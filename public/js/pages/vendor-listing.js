
(function waitForjQuery() {
  if (window.jQuery) {
    $(document).ready(function () {
      // Notification helpers (use showToast if available)
      function notifySuccess(message) {
        if (typeof showToast === 'function') { try { showToast(message, 'success'); return; } catch (e) { } }
      }

      const $table = $('#vendorTable');

      // Build header dynamically
      (function buildDynamicHeader() {
        const headers = [
          { title: '#', width: '5%' },
          { title: 'Action', width: '15%' },
          { title: 'Full Name' },
          { title: 'Email Address' },
          { title: 'Phone Number' },
          { title: 'Company Name' },
          { title: 'GST/tax ID' },
          { title: 'Contact Person Name' },
          { title: 'Services / Products Offered' },
          { title: 'Address (Optional)' }
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

      // Initialize DataTable (server-side)
      var table = $table.DataTable({
        processing: true,
        serverSide: true,
        responsive: true,
        lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'All']],
        pageLength: 10,
        language: {
          processing: '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>',
          emptyTable: 'No vendor records found',
          zeroRecords: 'No matching records found',
          info: 'Showing _START_ to _END_ of _TOTAL_ entries',
          infoEmpty: 'Showing 0 to 0 of 0 entries',
          infoFiltered: '(filtered from _MAX_ total entries)',
          lengthMenu: 'Show _MENU_ entries',
          search: 'Search:',
          paginate: { first: 'First', last: 'Last', next: 'Next', previous: 'Previous' }
        },
        ajax: {
          url: `${baseUrl}/api/vendors-list`,
          type: 'post',
          dataSrc: function (json) {
            $table.show();
            return (json && Array.isArray(json.data)) ? json.data : [];
          },
          error: function (xhr, error) {
            showToast('Error loading data:' + (xhr.responseJSON?.message || error), 'error');
            $table.show();
            if (table && table.clear) table.clear();
            notifyError('Failed to load vendor data. Showing empty list.');
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
            render: function (data) {
              return `
                <div class="btn-group" role="group">
                  <a href="/vendors/register?id=${data}" class="btn btn-sm btn-info me-1" data-bs-toggle="tooltip" title="Edit">
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
            render: function (data) { return data || '-'; }
          },
          {
            data: 'phone',
            name: 'phone',
            render: function (data) { return data || '-'; }
          },
          {
            data: 'company_name',
            name: 'company_name',
            render: function (data) { return data || '-'; }
          },
          {
            data: 'gst_tax_id',
            name: 'gst_tax_id',
            render: function (data) { return data || '-'; }
          },
          {
            data: 'contact_person',
            name: 'contact_person',
            render: function (data) { return data || '-'; }
          },
          {
            data: 'services_offered',
            name: 'services_offered',
            render: function (data) { return data || '-'; }
          },
          {
            data: 'address',
            name: 'address',
            render: function (data) {
              return data ? (data.length > 60 ? data.substring(0, 60) + '...' : data) : '-';
            }
          }
        ],
        dom: "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>>" +
          "<'row'<'col-sm-12'tr>>" +
          "<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
        initComplete: function () {
          // Tooltips
          var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
          tooltipTriggerList.map(function (tooltipTriggerEl) { return new bootstrap.Tooltip(tooltipTriggerEl); });

          // Style search input and length menu
          $('.dataTables_filter input').addClass('form-control form-control-sm').attr('placeholder', 'Search vendors...');
          $('.dataTables_length select').addClass('form-select form-select-sm');
        },
        drawCallback: function () {
          // Re-initialize tooltips after each draw
          var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
          tooltipTriggerList.map(function (tooltipTriggerEl) { return new bootstrap.Tooltip(tooltipTriggerEl); });
        }
      });

      // Delete confirmation via Bootstrap modal
      let pendingDeleteId = null;
      const $confirmModal = $('#confirmDeleteModal');
      const $confirmBtn = $('#confirmDeleteBtn');

      // Open modal and store id
      $(document).on('click', '.delete-btn', function () {
        pendingDeleteId = $(this).data('id');
        $confirmModal.modal('show');
      });

      // Confirm delete
      $confirmBtn.off('click').on('click', function () {
        if (!pendingDeleteId) {
          $confirmModal.modal('hide');
          return;
        }
        const $btn = $(this);
        $btn.prop('disabled', true).text('Deleting...');

        // Reuse existing delete endpoint (works for any user id)
        $.ajax({
          url: `${baseUrl}/api/donor-delete/${pendingDeleteId}`,
          type: 'DELETE',
          success: function () {
            notifySuccess('Vendor deleted successfully');
            table.ajax.reload(null, false);
          },
          error: function (xhr) {
            notifyError('Error deleting vendor: ' + (xhr.responseJSON?.message || 'Unknown error'));
          },
          complete: function () {
            pendingDeleteId = null;
            $btn.prop('disabled', false).text('Delete');
            $confirmModal.modal('hide');
          }
        });
      });
    });
  } else {
    // Retry until jQuery is available (this page includes jQuery in footer)
    setTimeout(waitForjQuery, 50);
  }
})();