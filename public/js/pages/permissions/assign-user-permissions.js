document.addEventListener('DOMContentLoaded', function () {
    const userPermissionsForm = document.getElementById('userPermissionsForm');
    const saveButton = document.querySelector('button[type="submit"]');
    const originalButtonText = saveButton.textContent;
    
    // Main menu select all checkbox (only this, no permission checkboxes)
    const mainMenuSelectAll = document.querySelectorAll('.main-menu-select-all');
    
    // Submenu checkboxes (have full permissions)
    const submenuSelectAll = document.querySelectorAll('.submenu-select-all');
    const menuAllCheckboxes = document.querySelectorAll('.menu-all');
    const menuReadCheckboxes = document.querySelectorAll('.menu-read');
    const menuWriteCheckboxes = document.querySelectorAll('.menu-write');
    const menuDeleteCheckboxes = document.querySelectorAll('.menu-delete');

    // Function to show loader on save button
    function showLoader() {
        saveButton.disabled = true;
        saveButton.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Saving...
        `;
    }

    // Function to hide loader and restore button
    function hideLoader() {
        saveButton.disabled = false;
        saveButton.innerHTML = originalButtonText;
    }

    // --- MAIN MENU SELECT ALL: Selects/Deselects all submenus under a main menu ---
    mainMenuSelectAll.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const mainMenuId = this.dataset.mainMenu;
            const isChecked = this.checked;
            
            // Find all submenu select-all checkboxes under this main menu
            const submenuCheckboxesUnderMain = document.querySelectorAll(
                `.submenu-select-all[data-parent="${mainMenuId}"]`
            );
            
            // Toggle all submenu select-all checkboxes and their permissions
            submenuCheckboxesUnderMain.forEach(subCheckbox => {
                subCheckbox.checked = isChecked;
                const menuId = subCheckbox.dataset.menuId;
                
                // Find the row containing this checkbox
                const row = subCheckbox.closest('.menu-row');
                if (row) {
                    // Update individual permission checkboxes for this menu
                    const menuAll = row.querySelector(`.menu-all[data-menu-id="${menuId}"]`);
                    const menuRead = row.querySelector(`.menu-read[data-menu-id="${menuId}"]`);
                    const menuWrite = row.querySelector(`.menu-write[data-menu-id="${menuId}"]`);
                    const menuDelete = row.querySelector(`.menu-delete[data-menu-id="${menuId}"]`);
                    
                    if (menuAll) menuAll.checked = isChecked;
                    if (menuRead) menuRead.checked = isChecked;
                    if (menuWrite) menuWrite.checked = isChecked;
                    if (menuDelete) menuDelete.checked = isChecked;
                }
            });
        });
    });

    // --- SUBMENU SELECT ALL: Controls all permissions for a submenu ---
    submenuSelectAll.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const menuId = this.dataset.menuId;
            const isChecked = this.checked;
            const parentMenuId = this.dataset.parent;
            
            // Find the row containing this checkbox
            const row = this.closest('.menu-row');
            if (row) {
                // Update all permission checkboxes in this row
                const menuAll = row.querySelector(`.menu-all[data-menu-id="${menuId}"]`);
                const menuRead = row.querySelector(`.menu-read[data-menu-id="${menuId}"]`);
                const menuWrite = row.querySelector(`.menu-write[data-menu-id="${menuId}"]`);
                const menuDelete = row.querySelector(`.menu-delete[data-menu-id="${menuId}"]`);
                
                // Set all permissions based on submenu select all state
                if (menuAll) menuAll.checked = isChecked;
                if (menuRead) menuRead.checked = isChecked;
                if (menuWrite) menuWrite.checked = isChecked;
                if (menuDelete) menuDelete.checked = isChecked;
            }
            
            // Update main menu select all status
            updateMainMenuSelectAll(parentMenuId);
        });
    });

    // --- INDIVIDUAL PERMISSION CHECKBOXES: Update submenu select all ---
    function updateSubmenuSelectAll(menuId) {
        // Find the row containing this menu
        const row = document.querySelector(`.menu-row .submenu-select-all[data-menu-id="${menuId}"]`)?.closest('.menu-row');
        if (!row) return;
        
        const subSelectAll = row.querySelector(`.submenu-select-all[data-menu-id="${menuId}"]`);
        const menuAll = row.querySelector(`.menu-all[data-menu-id="${menuId}"]`);
        const menuRead = row.querySelector(`.menu-read[data-menu-id="${menuId}"]`);
        const menuWrite = row.querySelector(`.menu-write[data-menu-id="${menuId}"]`);
        const menuDelete = row.querySelector(`.menu-delete[data-menu-id="${menuId}"]`);
        
        if (subSelectAll && menuAll && menuRead && menuWrite && menuDelete) {
            // Update submenu select all based on individual permissions
            // All permissions must be checked for "All" to be checked
            const allChecked = menuAll.checked && menuRead.checked && menuWrite.checked && menuDelete.checked;
            subSelectAll.checked = allChecked;
        }
    }

    // --- Update Main Menu Select All based on submenu selections ---
    function updateMainMenuSelectAll(parentMenuId) {
        if (!parentMenuId) return;
        
        const mainSelectAll = document.querySelector(`.main-menu-select-all[data-main-menu="${parentMenuId}"]`);
        if (!mainSelectAll) return;

        // Find all submenu select-all checkboxes under this parent
        const submenuCheckboxesUnderParent = document.querySelectorAll(
            `.submenu-select-all[data-parent="${parentMenuId}"]`
        );

        if (submenuCheckboxesUnderParent.length === 0) return;

        // Check if all submenus are selected
        const allChecked = Array.from(submenuCheckboxesUnderParent).every(
            checkbox => checkbox.checked === true
        );
        
        mainSelectAll.checked = allChecked;
    }

    // --- Individual permission checkboxes event listeners ---
    menuAllCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const menuId = this.dataset.menuId;
            
            // If "All" is checked, check all individual permissions
            // If "All" is unchecked, uncheck all individual permissions
            const menuRead = document.querySelector(`.menu-read[data-menu-id="${menuId}"]`);
            const menuWrite = document.querySelector(`.menu-write[data-menu-id="${menuId}"]`);
            const menuDelete = document.querySelector(`.menu-delete[data-menu-id="${menuId}"]`);
            
            if (menuRead) menuRead.checked = this.checked;
            if (menuWrite) menuWrite.checked = this.checked;
            if (menuDelete) menuDelete.checked = this.checked;
            
            // Update submenu select all
            updateSubmenuSelectAll(menuId);
            
            // Update parent main menu
            const subSelectAll = document.querySelector(`.submenu-select-all[data-menu-id="${menuId}"]`);
            if (subSelectAll) {
                const parentMenuId = subSelectAll.dataset.parent;
                updateMainMenuSelectAll(parentMenuId);
            }
        });
    });

    menuReadCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const menuId = this.dataset.menuId;
            
            // Update submenu select all
            updateSubmenuSelectAll(menuId);
            
            // Update parent main menu
            const subSelectAll = document.querySelector(`.submenu-select-all[data-menu-id="${menuId}"]`);
            if (subSelectAll) {
                const parentMenuId = subSelectAll.dataset.parent;
                updateMainMenuSelectAll(parentMenuId);
            }
        });
    });

    menuWriteCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const menuId = this.dataset.menuId;
            
            // Update submenu select all
            updateSubmenuSelectAll(menuId);
            
            // Update parent main menu
            const subSelectAll = document.querySelector(`.submenu-select-all[data-menu-id="${menuId}"]`);
            if (subSelectAll) {
                const parentMenuId = subSelectAll.dataset.parent;
                updateMainMenuSelectAll(parentMenuId);
            }
        });
    });

    menuDeleteCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const menuId = this.dataset.menuId;
            
            // Update submenu select all
            updateSubmenuSelectAll(menuId);
            
            // Update parent main menu
            const subSelectAll = document.querySelector(`.submenu-select-all[data-menu-id="${menuId}"]`);
            if (subSelectAll) {
                const parentMenuId = subSelectAll.dataset.parent;
                updateMainMenuSelectAll(parentMenuId);
            }
        });
    });

    // --- Initialize all checkboxes on page load ---
    function initializeCheckboxes() {
        // Initialize submenu select all checkboxes
        submenuSelectAll.forEach(checkbox => {
            const menuId = checkbox.dataset.menuId;
            updateSubmenuSelectAll(menuId);
        });
        
        // Initialize main menu select all checkboxes
        mainMenuSelectAll.forEach(checkbox => {
            const mainMenuId = checkbox.dataset.mainMenu;
            updateMainMenuSelectAll(mainMenuId);
        });
    }

    // Call initialization
    initializeCheckboxes();

    // --- Form submission ---
    userPermissionsForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Show loader
        showLoader();

        const formData = new FormData(this);
        const userId = formData.get('user_id');

        // Collect all permissions only from submenus (not main menus)
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

            // Hide loader
            hideLoader();

            if (result.success) {
                showToast('Permissions saved successfully!', 'success');
                setTimeout(() => {
                    location.reload();
                }, 1500);
            } else {
                showToast('Error: ' + result.message, 'error');
            }
        } catch (error) {
            // Hide loader on error
            hideLoader();
            showToast('Error saving permissions', 'error');
        }
    });
});