document.addEventListener('DOMContentLoaded', function () {
    const userPermissionsForm = document.getElementById('userPermissionsForm');
    const menuAllCheckboxes = document.querySelectorAll('.menu-all');
    const menuReadCheckboxes = document.querySelectorAll('.menu-read');
    const menuWriteCheckboxes = document.querySelectorAll('.menu-write');
    const menuDeleteCheckboxes = document.querySelectorAll('.menu-delete');
    const moduleCheckboxes = document.querySelectorAll('.menu-checkbox'); // <-- main module checkboxes

    // --- MODULE (menu) checkbox logic ---
    moduleCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const menuId = this.value; // uses the value attribute which holds menu._id
            const readCheck = document.querySelector(`.menu-read[data-menu-id="${menuId}"]`);
            const writeCheck = document.querySelector(`.menu-write[data-menu-id="${menuId}"]`);
            const deleteCheck = document.querySelector(`.menu-delete[data-menu-id="${menuId}"]`);
            const allCheck = document.querySelector(`.menu-all[data-menu-id="${menuId}"]`);

            if (this.checked) {
                // If module is checked, at least enable Read
                readCheck.checked = true;
            } else {
                // If module is unchecked, remove all permissions
                readCheck.checked = false;
                writeCheck.checked = false;
                deleteCheck.checked = false;
                allCheck.checked = false;
            }

            updateAllCheckbox(menuId);
        });
    });

    // --- "All" checkbox controls all permissions for that menu ---
    menuAllCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const menuId = this.dataset.menuId;
            const readCheck = document.querySelector(`.menu-read[data-menu-id="${menuId}"]`);
            const writeCheck = document.querySelector(`.menu-write[data-menu-id="${menuId}"]`);
            const deleteCheck = document.querySelector(`.menu-delete[data-menu-id="${menuId}"]`);

            if (this.checked) {
                readCheck.checked = true;
                writeCheck.checked = true;
                deleteCheck.checked = true;
            } else {
                readCheck.checked = false;
                writeCheck.checked = false;
                deleteCheck.checked = false;
            }
            updateAllCheckbox(menuId);
        });
    });

    // Menu permission checkboxes (read, write, delete) - update "All" checkbox
    menuReadCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const menuId = this.dataset.menuId;
            updateAllCheckbox(menuId);
        });
    });

    menuWriteCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const menuId = this.dataset.menuId;
            updateAllCheckbox(menuId);
        });
    });

    menuDeleteCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const menuId = this.dataset.menuId;
            updateAllCheckbox(menuId);
        });
    });

    // Helper function to update "All" checkbox based on individual permissions
    function updateAllCheckbox(menuId) {
        const allCheck = document.querySelector(`.menu-all[data-menu-id="${menuId}"]`);
        const readCheck = document.querySelector(`.menu-read[data-menu-id="${menuId}"]`);
        const writeCheck = document.querySelector(`.menu-write[data-menu-id="${menuId}"]`);
        const deleteCheck = document.querySelector(`.menu-delete[data-menu-id="${menuId}"]`);

        // Update "All" checkbox
        if (readCheck.checked && writeCheck.checked && deleteCheck.checked) {
            allCheck.checked = true;
        } else {
            allCheck.checked = false;
        }
    }

    // Initialize all checkboxes on page load
    function initializeCheckboxes() {
        menuAllCheckboxes.forEach(checkbox => {
            const menuId = checkbox.dataset.menuId;
            updateAllCheckbox(menuId);
        });
    }

    // Call initialization
    initializeCheckboxes();

    // Form submission
    userPermissionsForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const formData = new FormData(this);
        const userId = formData.get('user_id');

        // Collect all permissions
        const permissions = {};
        menuReadCheckboxes.forEach(checkbox => {
            const menuId = checkbox.dataset.menuId;
            if (!permissions[menuId]) {
                permissions[menuId] = {};
            }
            permissions[menuId].read = checkbox.checked;
        });

        menuWriteCheckboxes.forEach(checkbox => {
            const menuId = checkbox.dataset.menuId;
            if (!permissions[menuId]) {
                permissions[menuId] = {};
            }
            permissions[menuId].write = checkbox.checked;
        });

        menuDeleteCheckboxes.forEach(checkbox => {
            const menuId = checkbox.dataset.menuId;
            if (!permissions[menuId]) {
                permissions[menuId] = {};
            }
            permissions[menuId].delete = checkbox.checked;
        });

        // Send permissions to server
        try {
            const response = await fetch('/user/permissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    permissions: permissions
                })
            });

            const result = await response.json();

            if (result.success) {
                showToast('Permissions saved successfully!', 'success');
                // Reload the page after 1.5 seconds
                setTimeout(() => {
                    location.reload();
                }, 1500);
            } else {
                showToast('Error: ' + result.message, 'error');
            }
        } catch (error) {
            showToast('Error saving permissions', 'error');
        }
    });
});