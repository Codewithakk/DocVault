document.addEventListener('DOMContentLoaded', () => {
    const designationSelect = document.getElementById('designation_id');
    const assignMenuForm = document.getElementById('assignMenuForm');
    const selectAllBtn = document.getElementById('btnSelectAll');

    // Only menu checkboxes (not permissions)
    const menuCheckboxes = () => assignMenuForm.querySelectorAll('.menu-checkbox');

    let assignedMenus = [];

    // Function to set up row-level event listeners
    function setupRowEventListeners() {
        assignMenuForm.querySelectorAll('table tbody tr').forEach(row => {
            // Skip if this is a master menu row (no checkboxes)
            if (row.classList.contains('table-primary')) return;

            const allCb = row.querySelector('td:nth-child(2) input[type="checkbox"]'); // "All" column
            if (!allCb) return;

            const readCb = row.querySelector('td:nth-child(3) input[type="checkbox"]');
            const writeCb = row.querySelector('td:nth-child(4) input[type="checkbox"]');
            const deleteCb = row.querySelector('td:nth-child(5) input[type="checkbox"]');
            const menuCb = row.querySelector('.menu-checkbox');

            // Check/uncheck Read/Write/Delete when "All" toggled
            allCb.addEventListener('change', () => {
                const checked = allCb.checked;
                if (readCb) readCb.checked = checked;
                if (writeCb) writeCb.checked = checked;
                if (deleteCb) deleteCb.checked = checked;

                // Also check the menu checkbox if "All" is checked
                if (menuCb && checked) {
                    menuCb.checked = checked;
                }
            });

            // Auto-update "All" checkbox when permissions change
            [readCb, writeCb, deleteCb].forEach(permCb => {
                if (permCb) {
                    permCb.addEventListener('change', () => {
                        if (readCb && writeCb && deleteCb) {
                            allCb.checked = readCb.checked && writeCb.checked && deleteCb.checked;

                            // Ensure menu is checked if any permission is checked
                            if (menuCb && (readCb.checked || writeCb.checked || deleteCb.checked)) {
                                menuCb.checked = true;
                            }
                        }
                    });
                }
            });

            // Ensure permissions are updated when menu checkbox changes
            // Ensure permissions are updated when menu checkbox changes
            if (menuCb) {
                menuCb.addEventListener('change', () => {
                    if (menuCb.checked) {
                        // If menu is checked → auto-check Read
                        if (readCb) readCb.checked = true;
                    } else {
                        // If unchecked → uncheck all permissions
                        if (readCb) readCb.checked = false;
                        if (writeCb) writeCb.checked = false;
                        if (deleteCb) deleteCb.checked = false;
                        if (allCb) allCb.checked = false;
                    }

                    // Keep "All" synced
                    if (readCb && writeCb && deleteCb && allCb) {
                        allCb.checked = readCb.checked && writeCb.checked && deleteCb.checked;
                    }
                });
            }
        });
    }

    // Initial setup
    setupRowEventListeners();

    // --- Load assigned menus ---
    designationSelect.addEventListener('change', async function () {
        const designationId = this.value;
        assignedMenus = [];

        // Uncheck all menu checkboxes and all permissions
        menuCheckboxes().forEach(cb => cb.checked = false);
        assignMenuForm.querySelectorAll('.perm-read, .perm-write, .perm-delete, .all-checkbox')
            .forEach(cb => cb.checked = false);

        if (!designationId) return;

        try {
            const res = await fetch(`${baseUrl}/api/assign-menu/designation/${designationId}/menus`);
            const data = await res.json();

            if (data.success && Array.isArray(data.data)) {
                assignedMenus = data.data;

                assignedMenus.forEach(menu => {
                    const cb = assignMenuForm.querySelector(`.menu-checkbox[value="${menu.menu_id}"]`);
                    if (cb) {
                        cb.checked = true;

                        // Set permissions
                        if (menu.permissions) {
                            const readCb = document.getElementById(`read_${menu.menu_id}`);
                            const writeCb = document.getElementById(`write_${menu.menu_id}`);
                            const deleteCb = document.getElementById(`delete_${menu.menu_id}`);
                            const allCb = cb.closest('tr').querySelector('.all-checkbox');

                            if (readCb) readCb.checked = menu.permissions.read;
                            if (writeCb) writeCb.checked = menu.permissions.write;
                            if (deleteCb) deleteCb.checked = menu.permissions.delete;

                            // Update row-level "All" checkbox
                            if (allCb && readCb && writeCb && deleteCb) {
                                allCb.checked = readCb.checked && writeCb.checked && deleteCb.checked;
                            }
                        }
                    }
                });
            } else {
                showToast('Failed to fetch assigned menus. Invalid response format.', "error");
            }
        } catch (err) {
            showToast('Failed to fetch assigned menus.', "error");
        }

        // Re-setup event listeners after content changes
        setTimeout(setupRowEventListeners, 100);
    });

    // --- Select All toggle ---
    selectAllBtn.addEventListener('click', () => {
        const boxes = Array.from(menuCheckboxes());
        const allChecked = boxes.every(cb => cb.checked);

        boxes.forEach(cb => {
            cb.checked = !allChecked;

            const menuId = cb.value;
            const readCb = document.getElementById(`read_${menuId}`);
            const writeCb = document.getElementById(`write_${menuId}`);
            const deleteCb = document.getElementById(`delete_${menuId}`);
            const row = cb.closest('tr');
            const allCb = row.querySelector('.all-checkbox');

            if (readCb) readCb.checked = !allChecked;
            if (writeCb) writeCb.checked = !allChecked;
            if (deleteCb) deleteCb.checked = !allChecked;
            if (allCb) allCb.checked = !allChecked;
        });
    });

    // --- Save assignment ---
    assignMenuForm.addEventListener('submit', async e => {
        e.preventDefault();

        const designationId = designationSelect.value;
        if (!designationId) return showToast('Please select a designation first.', "warning");

        // Prepare selected menus with permissions
        const selectedMenus = Array.from(menuCheckboxes())
            .filter(cb => cb.checked)
            .map(cb => {
                const menuId = cb.value;
                return {
                    menu_id: menuId,
                    permissions: {
                        read: document.getElementById(`read_${menuId}`)?.checked || false,
                        write: document.getElementById(`write_${menuId}`)?.checked || false,
                        delete: document.getElementById(`delete_${menuId}`)?.checked || false,
                    }
                };
            });

        // Check if there are any changes (menu selection or permission changes)
        const hasChanges = checkForChanges(selectedMenus, assignedMenus);

        if (!hasChanges) {
            return showToast('No changes to save.', "info");
        }

        try {
            // Always send all selected menus with their permissions
            const response = await fetch(`${baseUrl}/api/assign-menu/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    designation_id: designationId,
                    menus: selectedMenus
                })
            });

            const result = await response.json();

            if (result.success) {
                assignedMenus = selectedMenus;
                showToast('Menu assignments saved successfully!', 'success', 1000);
                setTimeout(() => window.location.reload(), 1200);
            } else {
                showToast(`Failed to save assignments: ${result.message}`, "error");
            }
        } catch (err) {
            showToast('Error updating menus.', 'error');
        }
    });

    // Helper function to check for changes
    function checkForChanges(selectedMenus, assignedMenus) {
        // If no menus were previously assigned but now we have selections
        if (assignedMenus.length === 0 && selectedMenus.length > 0) {
            return true;
        }

        // If menus were assigned but now none are selected
        if (assignedMenus.length > 0 && selectedMenus.length === 0) {
            return true;
        }

        // Check if any menu was added or removed
        const selectedIds = selectedMenus.map(m => m.menu_id);
        const assignedIds = assignedMenus.map(m => m.menu_id);

        const menusAdded = selectedIds.some(id => !assignedIds.includes(id));
        const menusRemoved = assignedIds.some(id => !selectedIds.includes(id));

        if (menusAdded || menusRemoved) {
            return true;
        }

        // Check if permissions changed for any menu
        for (const selectedMenu of selectedMenus) {
            const assignedMenu = assignedMenus.find(m => m.menu_id === selectedMenu.menu_id);

            if (!assignedMenu) continue;

            if (selectedMenu.permissions.read !== assignedMenu.permissions.read ||
                selectedMenu.permissions.write !== assignedMenu.permissions.write ||
                selectedMenu.permissions.delete !== assignedMenu.permissions.delete) {
                return true;
            }
        }

        return false;
    }
});