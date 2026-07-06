
let menuIdToDelete = null; // Global variable to track which menu to delete
let menuTable;
let allMenuData = [];

// Fetch all menu data and initialize DataTable
function fetchAllMenuData() {
    fetch(`${baseUrl}/api/menu?limit=0`, { credentials: 'include' })
        .then(res => res.json())
        .then(result => {
            if (!result.success || !Array.isArray(result.data)) {
                showToast("Invalid API response:" + result, 'error');
                return;
            }
            allMenuData = result.data;
            initializeDataTable();
        })
        .catch(err => showToast("Error loading data:" + err, 'error'));
}

// Initialize DataTable
function initializeDataTable() {

    if ($.fn.DataTable.isDataTable('#menuTable')) {
        $('#menuTable').DataTable().clear().destroy();
    }

    menuTable = $('#menuTable').DataTable({
        processing: true,
        serverSide: true,
        ordering: true,
        searching: true,
        pageLength: 10,
        lengthMenu: [10, 25, 50, 100],

        ajax: function (data, callback) {
            const page = Math.floor(data.start / data.length) + 1;
            const limit = data.length;
            const search = data.search.value || "";

            fetch(`${baseUrl}/api/menu?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
                credentials: 'include'
            })
                .then(res => res.json())
                .then(result => {
                    callback({
                        draw: data.draw,
                        recordsTotal: result.pagination.total,
                        recordsFiltered: result.pagination.filtered,
                        data: result.data
                    });
                });
        },
        columns: [
            { data: null, render: (d, t, r, meta) => meta.row + 1 },
            { data: "type" },
            { data: "name" },
            { data: "url", render: data => (!data || data === "#") ? "#" : (data.startsWith("/") ? data : `/${data}`) },
            { data: "priority" },

            // FIX 1: isActive FIRST (matches table header)
            {
                data: "isActive",
                render: (data, type, row) => `
            <div class="form-check form-switch">
                <input class="form-check-input toggleActive" 
                       type="checkbox" 
                       data-id="${row._id}" 
                       ${data ? "checked" : ""}>
                <label class="form-check-label">${data ? "Active" : "Inactive"}</label>
            </div>`
            },

            // FIX 2: is_show SECOND
            {
                data: "is_show",
                render: (data, type, row) => `
            <div class="form-check form-switch">
                <input class="form-check-input toggleShow" 
                       type="checkbox" 
                       data-id="${row._id}" 
                       ${data ? "checked" : ""}>
                <label class="form-check-label">${data ? "Yes" : "No"}</label>
            </div>`
            },

            { data: "add_date", render: d => d ? new Date(d).toLocaleDateString("en-IN") : "-" },

            {
                data: "_id",
                orderable: false,
                render: id => `
            <div class="action-icon d-inline-flex">
                <a href="/permissions/menu/add/${id}" class="me-2"><i class="ti ti-edit"></i></a>
                <a href="javascript:void(0);" onclick="confirmDelete('${id}')">
                    <i class="ti ti-trash"></i>
                </a>
            </div>`
            }
        ]


    });

    menuTable.on('draw', function () {
        attachToggleHandlers();
    });
}

// Attach toggle switch handlers
function attachToggleHandlers() {

    // is_show toggle
    $('.toggleShow').off('change').on('change', function () {
        const id = $(this).data("id");
        const checked = $(this).is(":checked");
        const label = $(this).siblings("label");

        fetch(`${baseUrl}/api/menu/${id}/toggle-status?field=is_show`, {
            method: "PATCH"
        })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    label.text(result.data.is_show ? "Yes" : "No");
                } else {
                    $(this).prop("checked", !checked);
                    showToast("Toggle failed", "error");
                }
            })
            .catch(() => {
                $(this).prop("checked", !checked);
                showToast("Server Error", "error");
            });
    });

    // isActive toggle
    $('.toggleActive').off('change').on('change', function () {
        const id = $(this).data("id");
        const checked = $(this).is(":checked");
        const label = $(this).siblings("label");

        fetch(`${baseUrl}/api/menu/${id}/toggle-status?field=isActive`, {
            method: "PATCH"
        })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    label.text(result.data.isActive ? "Active" : "Inactive");
                } else {
                    $(this).prop("checked", !checked);
                    showToast("Toggle failed", "error");
                }
            })
            .catch(() => {
                $(this).prop("checked", !checked);
                showToast("Server Error", "error");
            });
    });
}


// Show delete confirmation modal
function confirmDelete(menuId) {
    menuIdToDelete = menuId;
    const deleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
    deleteModal.show();
}

// Delete menu
document.getElementById('confirmDeleteBtn').addEventListener('click', function () {
    if (!menuIdToDelete) return;

    fetch(`${baseUrl}/api/menu/${menuIdToDelete}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {

                showToast('Menu deleted successfully', "success");

                menuTable.ajax.reload(null, false);

            } else {
                showToast('Error deleting menu: ' + data.message, "error");
            }
        }).catch(err => {
            showToast('Error deleting menu', "error");
        })
        .finally(() => {
            const deleteModal = bootstrap.Modal.getInstance(document.getElementById('confirmDeleteModal'));
            deleteModal.hide();
            menuIdToDelete = null;
        });
});

// Initial fetch on document ready
$(document).ready(function () {
    initializeDataTable();
});
