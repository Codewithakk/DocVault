document.addEventListener("DOMContentLoaded", loadSidebar);

async function loadSidebar() {
    const fetchJson = async (url) => {
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return await response.json();
    };

    try {
        const data = await fetchJson(`${baseUrl}/api/sidebar`);
        const recentData = await fetchJson(`${baseUrl}/api/session/recent-folders`);

        // Icon helper
        const getIcon = (item) => {
            if (item.type === 'Dashboard') return 'ti ti-layout-dashboard';
            if (item.type === 'Document') return 'ti ti-files';
            if (item.type === 'File') return 'ti ti-file';
            return 'ti ti-folder-filled';
        };

        const buildMenu = (items) => {
            return items.map(item => {
                const title = item.name || item.folderName || 'Untitled';
                const children = item.children || [];
                const hasChildren = children.length > 0;
                const iconClass = getIcon(item);
                const titleAttr = title.length > 20 ? `data-bs-toggle="tooltip" title="${title}"` : '';

                if (hasChildren) {
                    return `
        <li class="submenu">
            <a href="javascript:void(0);" class="menu-link" ${titleAttr}>
                <i class="ti ti-chevron-down arrow-icon"></i>
                <i class="${iconClass}"></i>
                <span class="menuname">${title}</span>
            </a>
            <ul class="dropdown_wrap" style="display:none;">
                ${buildMenu(children)}
            </ul>
        </li>`;
                } else {
                    let href = item.url || (item.folderId ? `/folders/viewer/${item.folderId}` : '#');
                    if (!href.startsWith('http') && !href.startsWith('/')) {
                        href = '/' + href;
                    }
                    return `<li>
        <a href="${href}" ${titleAttr}>
            <i class="${iconClass}"></i> <span class="menuname">${title}</span>
        </a>
    </li>`;
                }
            }).join('');
        };

        const buildRecentMenu = (items) => {
            return items.map(item => {
                const title = item.folderName || item.name || 'Untitled';
                const hasChildren = item.children && item.children.length > 0;
                const titleAttr = title.length > 20 ? `data-bs-toggle="tooltip" title="${title}"` : '';

                return `
                    <li class="recent-parent" data-folder="${item.folderId}">
                       <a href="${hasChildren ? 'javascript:void(0);' : `/folders/viewer/${item.folderId}`}"
   class="menu-link recent-toggle" ${titleAttr}>
                            <i class="ti ti-chevron-down arrow-icon"></i>
                            <i class="ti ti-folder-filled"></i>
                            <span class="truncate-recent">${title}</span>
                        </a>
                        ${hasChildren ? `
                            <ul class="dropdown_wrap recent-child" style="display:none;">
                                ${buildRecentMenu(item.children)}
                            </ul>` : ''}
                    </li>`;
            }).join('');
        };

        const dashboardItems = data.data.filter(m => m.type === "Dashboard");
        const otherItems = data.data.filter(m => m.type !== "Dashboard");

        let menuHtml = '';

        if (dashboardItems.length) {
            menuHtml += `
                <li class="submenu">
                    <a href="javascript:void(0);" class="menu-link subdrop">
                        <span class="ti ti-chevron-down arrow-icon"></span>
                        <i class="ti ti-layout-dashboard"></i>
                        <span class="menuname">Dashboard</span>
                    </a>
                    <ul class="dropdown_wrap" style="display:none;">
                        ${buildMenu(dashboardItems)}
                    </ul>
                </li>`;
        }

        menuHtml += buildMenu(otherItems);

        if (recentData.success && recentData.recentFolders?.length) {
            menuHtml += `
                <li class="submenu">
                    <a href="javascript:void(0);" class="menu-link">
                        <span class="ti ti-chevron-down arrow-icon"></span>
                        <i class="ti ti-folder-filled"></i>
                        <span class="menuname recenthistorymenu">Recent History</span>
                    </a>
                    <ul class="dropdown_wrap recent-folder-wrap" style="display:none;">
                        ${recentData.recentFolders.map(project => {
                const projectTitle = project.projectName || 'Untitled';
                const projectTooltip = projectTitle.length > 20 ? `data-bs-toggle="tooltip" title="${projectTitle}"` : '';
                return `
                                <li class="submenu">
                                    <a href="javascript:void(0);" class="menu-link" ${projectTooltip}>
                                        <span class="ti ti-chevron-down arrow-icon"></span>
                                        <i class="ti ti-folder-filled"></i>
                                        <span class="menuname recenthistorymenu">${projectTitle}</span>
                                    </a>
                                    <ul class="dropdown_wrap" style="display:none;">
                                        ${buildRecentMenu(project.folders)}
                                    </ul>
                                </li>`;
            }).join('')}
                    </ul>
                </li>`;
        }

        document.getElementById("menu-list").innerHTML = menuHtml;

        // Tooltips
        document.querySelectorAll('[data-bs-toggle="tooltip"]')
            .forEach(el => new bootstrap.Tooltip(el));

        // Sidebar toggles
        document.querySelectorAll(".submenu > .menu-link").forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const submenu = link.nextElementSibling;
                if (!submenu) return;

                const parentLi = link.parentElement;
                const parentUl = parentLi.parentElement;

                Array.from(parentUl.children).forEach(li => {
                    if (li !== parentLi) {
                        const siblingSubmenu = li.querySelector(":scope > .dropdown_wrap");
                        if (siblingSubmenu) siblingSubmenu.style.display = "none";
                        const siblingLink = li.querySelector(":scope > .menu-link");
                        if (siblingLink) siblingLink.classList.remove("subdrop");
                    }
                });

                const isVisible = submenu.style.display === "block";
                submenu.style.display = isVisible ? "none" : "block";
                link.classList.toggle("subdrop", !isVisible);
            });
        });

        // Recent folder toggle
        document.addEventListener("click", function (e) {
            const toggleLink = e.target.closest(".recent-toggle");
            if (!toggleLink) return;

            const parent = toggleLink.closest(".recent-parent");
            const submenu = parent.querySelector(":scope > .recent-child");
            if (!submenu) return;

            e.preventDefault();

            const parentUl = parent.parentElement;
            Array.from(parentUl.children).forEach(li => {
                if (li !== parent) {
                    const siblingSubmenu = li.querySelector(":scope > .recent-child");
                    if (siblingSubmenu) siblingSubmenu.style.display = "none";
                    const siblingLink = li.querySelector(":scope > .recent-toggle");
                    if (siblingLink) siblingLink.classList.remove("subdrop");
                }
            });

            const isVisible = submenu.style.display === "block";
            submenu.style.display = isVisible ? "none" : "block";
            toggleLink.classList.toggle("subdrop", !isVisible);
        });

        // Highlight active menu item
        const currentPath = window.location.pathname;
        document.querySelectorAll("#menu-list a").forEach(link => {
            if (link.getAttribute("href") === currentPath) {
                link.classList.add("active");

                let parent = link.closest("ul.dropdown_wrap, ul.recent-child");
                while (parent) {
                    parent.style.display = "block";
                    const parentLink = parent.previousElementSibling;
                    if (parentLink && parentLink.classList.contains("menu-link")) {
                        parentLink.classList.add("subdrop");
                    }
                    parent = parent.parentElement.closest("ul.dropdown_wrap, ul.recent-child");
                }
            }
        });

    } catch (err) {
        showToast("Error loading sidebar: " + err.message, "error");
    }
}