// header.js - Complete version with ALL functionality preserved

document.addEventListener("DOMContentLoaded", function () {
    const baseUrl = window.baseUrl;
    const uploadBtn = document.querySelector("#uploadBtn");

    // 1. Vendor/Donor hide upload button
    if (window.profile_type === "vendor" || window.profile_type === "donor") {
        if (uploadBtn) uploadBtn.style.display = "none";
    }
    
    // 2. Modal cleanup
    document.addEventListener('hidden.bs.modal', () => {
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.body.classList.remove('modal-open');
    });

    // 3. Initialize ALL header components
    initializeHeaderComponents();
});

// Complete function with ALL original functionality
function initializeHeaderComponents() {
    const baseUrl = window.baseUrl;
    const $headerYearSelect = $('#selectHeaderYear');
    const $headerProjectSelect = $('#selectHeaderProject');

    // 4. YEAR SELECT - Fully preserved
    if ($headerYearSelect.length) {
        const currentYear = new Date().getFullYear();
        const startYear = 1995;
    
        $headerYearSelect.append(new Option('All', 'all', false, false));
    
        // for (let year = currentYear; year >= startYear; year--) {
        //     $headerYearSelect.append(new Option(year, year, false, false));
        // }
        for (let year = currentYear; year >= startYear; year--) {
            $headerYearSelect.append(
                new Option(`FY-${year}`, year, false, false)
            );
        }    
        $headerYearSelect.select2({
            placeholder: 'Select Year',
            allowClear: true 
        });
    
        $headerYearSelect.on('change', async function () {
            let selectedYear = $(this).val();
            selectedYear = (selectedYear === 'all' || !selectedYear) ? null : selectedYear;
        
            try {
                await fetch(`${baseUrl}/api/session/project`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        selectedYear: selectedYear,
                        projectId: window.selectedProjectId || null
                    })
                });
        
                location.reload();
            } catch (err) {
                console.error('Error saving year:', err);
            }
        });
        
        // Load saved year
        (async function () {
            try {
                const res = await fetch(`${baseUrl}/api/session/project`, { credentials: 'include' });
                const data = await res.json();
                const savedYear = data.selectedYear || 'all';
                $headerYearSelect.val(savedYear).trigger('change.select2');
            } catch (err) {
                console.error('Error loading saved year:', err);
            }
        })();
    }
    
    // 5. PROJECT SELECT - FIXED to work on document page
    if ($headerProjectSelect.length) {
        // Initialize select2 with AJAX
        $headerProjectSelect.select2({
            placeholder: 'Select Project',
            allowClear: true,
            width: '250px',
            ajax: {
                url: `${baseUrl}/api/projects`,
                dataType: 'json',
                delay: 250,
                data: function(params) {
                    return {
                        search: params.term || '',
                        page: params.page || 1,
                        limit: 10
                    };
                },
                processResults: function(data) {
                    const projects = (data.data || []).map(p => ({
                        id: p._id,
                        text: p.projectName || p.name
                    }));
        
                    return {
                        results: [
                            { id: 'all', text: 'All Projects' },
                            ...projects
                        ]
                    };
                },
                cache: true
            }
        });
        
        // Project change handler
        $headerProjectSelect.on('change', async function () {
            let projectId = $(this).val();
            let projectName = $(this).find('option:selected').text();
   
            if (projectId === 'all' || !projectId) {
                projectId = null;
                projectName = '';
            }
        
            try {
                await fetch(`${baseUrl}/api/session/project`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        projectId: projectId,
                        projectName: projectName,
                        selectedYear: window.selectedYear || null
                    })
                });
        
                location.reload();
            } catch (err) {
                console.error('Error saving project:', err);
            }
        });
        
        // Load saved project
        (async function () {
            try {
                const res = await fetch(`${baseUrl}/api/session/project`, { credentials: 'include' });
                const data = await res.json();
        
                if (data.selectedProject) {
                    if (!$headerProjectSelect.find(`option[value="${data.selectedProject}"]`).length) {
                        $headerProjectSelect.append(
                            new Option(data.selectedProjectName || 'Selected Project', data.selectedProject, true, true)
                        );
                    }
                    $headerProjectSelect.val(data.selectedProject).trigger('change.select2');
                } else {
                    // Add 'All Projects' option if not exists
                    if (!$headerProjectSelect.find('option[value="all"]').length) {
                        $headerProjectSelect.append(new Option('All Projects', 'all', true, true));
                    }
                    $headerProjectSelect.val('all').trigger('change.select2');
                }
            } catch (err) {
                console.error('Error loading saved project:', err);
                // Default to 'All Projects' on error
                if (!$headerProjectSelect.find('option[value="all"]').length) {
                    $headerProjectSelect.append(new Option('All Projects', 'all', true, true));
                }
                $headerProjectSelect.val('all').trigger('change.select2');
            }
        })();
    }

    // 6. SEARCH FUNCTIONALITY - Fully preserved
    (function ($) {
        "use strict";

        function debounce(func, delay) {
            let timeout;
            return function () {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, arguments), delay);
            };
        }

        function isOnDocumentsPage() {
            return window.location.pathname === '/documents/list' ||
                window.location.pathname.startsWith('/documents/list?');
        }

        function getCurrentStatus() {
            const params = new URLSearchParams(window.location.search);
            return params.get('status') || 'all';
        }

        function updateUrl(params) {
            const url = new URL(window.location);
            Object.keys(params).forEach(key => params[key] ? url.searchParams.set(key, params[key]) : url.searchParams.delete(key));
            window.history.pushState({}, '', url);
        }

        function redirectToDocuments(searchTerm = '', status = 'all') {
            const params = new URLSearchParams();
            if (searchTerm) params.append('q', searchTerm);
            if (status && status !== 'all') params.append('status', status);
            window.location.href = `/documents/list?${params.toString()}`;
        }

        function reloadTableWithSearch(searchTerm = '') {
            if (typeof table !== 'undefined' && table.ajax?.reload) {
                $('#searchInput').val(searchTerm);
                table.ajax.reload(null, false);
                updateUrl({ q: searchTerm || null });
            }
        }

        function toggleClearButtons() {
            $('.clear-search-global').toggle(!!(($('#globalSearchInput').val() || '').trim()));
            $('.clear-search-page').toggle(!!(($('#searchInput').val() || '').trim()));
        }

        function clearSearch() {
            $('#globalSearchInput, #searchInput').val('');
            toggleClearButtons();
            if (isOnDocumentsPage()) {
                updateUrl({ q: null });
                if (typeof table !== 'undefined') table.ajax.reload(null, false);
            }
        }

        $(document).ready(function () {
            if ($('#searchInput').length && $('#searchInput').closest('.position-relative').length === 0) {
                $('#searchInput').wrap('<div class="position-relative"></div>');
                $('#searchInput').parent().append(`
                    <button type="button" class="btn btn-sm btn-icon clear-search-page position-absolute end-0 top-50 translate-middle-y me-2"
                        style="display: none; z-index: 10;">
                        <i class="ti ti-x"></i>
                    </button>
                `);
            }

            const params = new URLSearchParams(window.location.search);
            const q = params.get('q') || '';
            $('#globalSearchInput').val(q);
            if (isOnDocumentsPage() && $('#searchInput').length) $('#searchInput').val(q);
            toggleClearButtons();

            $('#globalSearchForm').on('submit', function (e) {
                e.preventDefault();
                const term = $('#globalSearchInput').val().trim();
                const status = getCurrentStatus();
                if (isOnDocumentsPage()) reloadTableWithSearch(term);
                else redirectToDocuments(term, status);
            });

            $('#globalSearchInput').on('keypress', function (e) {
                if (e.which === 13) $('#globalSearchForm').trigger('submit');
            });

            $('#searchInput').on('input', debounce(function () {
                if (isOnDocumentsPage()) reloadTableWithSearch($(this).val().trim());
            }, 500));

            $(document).on('click', '.clear-search-global', function () {
                clearSearch(); 
                $('#globalSearchForm').trigger('submit');
            });

            $(document).on('click', '.clear-search-page', function () {
                clearSearch(); 
                if (isOnDocumentsPage()) reloadTableWithSearch('');
            });

            $('#globalSearchInput, #searchInput').on('input', toggleClearButtons);

            $('#globalSearchInput').on('input', function () {
                if (isOnDocumentsPage()) $('#searchInput').val($(this).val());
                toggleClearButtons();
            });
        });
    })(jQuery);

    // 7. USER INVITE SELECT - Fully preserved
    $('#userInviteSelect').select2({
        placeholder: "Select user or enter email",
        allowClear: true,
        multiple: true,
        width: 'resolve',
        dropdownParent: $('#sharedoc-modal'),
    
        templateSelection: function (data) {
            return data.name || data.text;
        },
    
        ajax: {
            url: `${baseUrl}/api/user/search?wantAllUser=true`,
            dataType: 'json',
            delay: 250,
            data: params => ({ search: params.term }),
            processResults: data => ({
                results: (data.users || []).map(u => {
                    let label = u.name;
                    const designation = u.designation?.trim();
                    const profile = u.profile_type;
    
                    if (designation) {
                        label += ` [${designation}]`;
                    } else {
                        label += ` [${profile}]`;
                    }
    
                    label += ` (${u.email})`;
    
                    return {
                        id: u.email,
                        text: label,
                        name: u.name
                    };
                })
            })
        },
    
        tags: true,
    
        createTag: params => {
            const email = params.term.trim();
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return { id: email, text: email, name: email };
            }
            return null;
        },
    
        minimumInputLength: 0
    });
    
    // 8. TIME RADIO & ACCESS TYPE - Fully preserved
    document.querySelectorAll('input[name="time"]').forEach(radio => {
        radio.addEventListener('change', function () {
            if (this.id === "custom") {
                document.getElementById("customDateWrapper").style.display = "flex";
                document.getElementsByClassName("rangelabel")[0].style.display = "none";
            } else {
                document.getElementById("customDateWrapper").style.display = "none";
                document.getElementsByClassName("rangelabel")[0].style.display = "block";
            }
        });
    });

    const accessType = document.getElementById("accessType");
    const roleType = document.getElementById("roleType");
    const infoText = document.getElementById("infoText");

    if (accessType) {
        accessType.addEventListener("change", function () {
            if (this.value === "anyone") {
                if (roleType) roleType.classList.remove("d-none");
                infoText.textContent = "Anyone on the internet with the link can view";
            } else {
                if (roleType) roleType.classList.add("d-none");
                infoText.textContent = "Only people with access can open this link";
            }
        });
    }

    // 9. NOTIFICATIONS - Fully preserved
    const notificationBtn = document.querySelector("#notification_popup");
    const notificationContainer = document.querySelector(".noti-content .d-flex.flex-column");
    const notificationTitle = document.querySelector(".notification-title");
    const statusDot = document.querySelector(".notification-status-dot");

    let hasLoadedOnce = false;
    const maxNotifications = 10;

    function renderNotifications(notifications) {
        if (!notificationContainer) return;
        notificationContainer.innerHTML = "";
        notifications.forEach(n => {
            const createdTime = timeAgo ? timeAgo(n.createdAt) : n.createdAt;
            let actionUrl = "#";
            let displayButton = "";
            if (n.type === "approval_request") { 
                actionUrl = `/approval-requests?documentId=${n.relatedDocument._id}`; 
                displayButton = `<span class="badge bg-success text-white px-2 py-1 ms-2">Approve</span>`; 
            }
            else if (n.type === "document_approved") actionUrl = `/document/${n.relatedDocument._id}/approval/track`;
            else if (n.type === "document") actionUrl = `/documents/list?documentId=${n.relatedDocument._id}`;
            else if (n.type === "approval_update") actionUrl = `/employee/approval?id=${n.relatedDocument._id}`;
            else if (n.type === "document_discussion") actionUrl = `/employee/approval?id=${n.relatedDocument._id}`;
            else if (n.type === "project_assigned") actionUrl = `/projects?id=${n.relatedProject._id}`;

            const html = `
                <div class="border-bottom mb-3 ${!n.isRead ? 'unread_notf' : ''}">
                    <a href="${actionUrl}" class="notification-link" data-id="${n._id}">
                        <div class="dflexbtwn">
                            <div class="d-flex">
                                <span class="avatar rounded bg-light mb-2">
                                    <img src="/img/icons/fn1.png" alt="icon">
                                </span>
                                <div class="flex-grow-1 ms-2">
                                    <p class="mb-1">
                                        <span class="text-dark fw-semibold">${n.sender.name}</span>
                                        ${n.message.replace(n.sender.name, '')}
                                        ${displayButton}
                                    </p>
                                    <span>${createdTime}</span>
                                </div>
                            </div>
                            <i class="ti ti-chevron-right fs-16 notflinkarrow"></i>
                        </div>
                    </a>
                </div>`;
            notificationContainer.insertAdjacentHTML("beforeend", html);
        });
    }

    async function loadNotifications() {
        if (!notificationContainer) return;
        const loader = document.createElement("p");
        loader.textContent = "Loading...";
        loader.classList.add("text-center", "text-muted", "py-2");
        notificationContainer.appendChild(loader);
        try {
            const res = await fetch(`/api/notifications?limit=${maxNotifications}`);
            const data = await res.json();
            const notifications = data.data || [];
            if (notificationTitle) {
                notificationTitle.textContent = `Notifications (${data.totalUnread || 0})`;
            }
            if (statusDot) {
                statusDot.style.display = (data.totalUnread || 0) > 0 ? "inline-block" : "none";
            }
            loader.remove();
            renderNotifications(notifications.slice(0, maxNotifications));
        } catch (err) {
            console.error(err);
            loader.textContent = "Failed to load notifications.";
        }
    }

    if (notificationBtn) {
        notificationBtn.addEventListener("click", function () {
            if (!hasLoadedOnce) { 
                loadNotifications(); 
                hasLoadedOnce = true; 
            }
        });
    }

    document.addEventListener("click", function (e) {
        const link = e.target.closest(".notification-link");
        if (link) {
            const id = link.dataset.id;
            fetch(`/api/notifications/${id}/read`, { method: "PATCH" }).catch(console.error);
            const url = link.getAttribute("href");
            if (url && url !== "#") window.location.href = url;
        }
    });
}

// Export for use in other parts
window.initializeHeaderComponents = initializeHeaderComponents;