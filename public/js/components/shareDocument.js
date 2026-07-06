(function ($) {
    "use strict";
    let currentDocId = null;
    let currentFileId = null;
    let customFlatpickr = null;
    let downloadFileId = null;
    let restoreVerionId = null;
    let restoreTarget = {};
    const baseUrl = window.location.origin;

    // Initialize Flatpickr only once
    function initFlatpickr() {
        if (!customFlatpickr && document.getElementById('flatpickr-range')) {
            customFlatpickr = flatpickr("#flatpickr-range", {
                mode: "range",
                dateFormat: "d-m-Y",
                conjunction: " to "
            });
        }
    }

    // Load users for invite dropdown
    function loadUsersForInvite($select) {
        $.ajax({
            url: `${baseUrl}/api/user?includeAllProfiles=true`,
            method: 'GET',
            success: function (response) {
                $select.empty().append('<option value="">Search user...</option>');
                if (response.data && response.data.length) {
                    response.data.forEach(user => {
                        $select.append(`<option value="${user.email}">${user.name} (${user.email})</option>`);
                    });
                }
            },
            error: function () {
                console.error('Failed to load users for invite');
            }
        });
    }

    // -------------------------
    // Open Share Modal
    // -------------------------
    $(document).on('show.bs.modal', '#sharedoc-modal', function (event) {
        const button = $(event.relatedTarget);
        currentDocId = button.data('doc-id');
        currentFileId = button.data('file-id');
        const modal = $(this);

        // Reset modal state
        modal.find('#userInviteSelect').val('');
        modal.find('#accessLevelSelect').val('view');
        modal.find('input[name="time"]').prop('checked', false);
        modal.find('#customDateWrapper').hide();
        modal.find('#usersWithAccessContainer').empty();
        modal.find('#sharelink').val('');
        modal.find('#accessType').val('anyone');
        modal.find('#roleType').val('viewer');
        modal.find('#infoText').text('Anyone on the internet with the link can view');

        if (!currentDocId || !currentFileId) {
            showToast('Invalid document or file', 'error');
            modal.modal('hide');
            return;
        }

        initFlatpickr();

        // Load Share Link
        $.get(`${baseUrl}/api/documents/${currentDocId}/${currentFileId}/share-link`)
            .done(res => {
                if (res.success && res.link) {
                    modal.find('#sharelink').val(res.link);
                    modal.find('#accessType').val(res.isPublic ? 'anyone' : 'restricted').trigger('change');
                }
            })
            .fail(() => showToast('Failed to load share link', 'warning'));

        // Load Shared Users
        $.get(`${baseUrl}/api/documents/${currentDocId}/shared-users`)
            .done(res => {
                const container = modal.find('#usersWithAccessContainer');
                container.empty();
                if (!res.success || !Array.isArray(res.data)) {
                    container.append('<div class="text-muted">No users found.</div>');
                    return;
                }

                let rows = '';
                res.data.forEach(user => {
                    const isOwner = user.accessLevel === 'owner';
                    const checkboxId = `download-${user.userId}`;
                    rows += `
                        <div class="user-accssrow dynamic d-flex justify-content-between align-items-center mb-2 p-2">
                            <div class="empname_eml flex-grow-1">
                                <div class="fw-normal">${user.name}</div>
                                <small class="text-muted">${user.email}</small>
                                ${user.inviteStatus === 'pending' ? '<span class="badge bg-warning ms-2">Pending</span>' : ''}
                            </div>
                            <div class="d-flex align-items-center gap-2">
                            ${!isOwner ? `
                            <!--
                            <div class="form-check form-switch me-2">
                                <input class="form-check-input download-access" type="checkbox" id="${checkboxId}"
                                    data-user-id="${user.userId}" ${user.canDownload ? 'checked' : ''}>
                                <label class="form-check-label" for="${checkboxId}">Download</label>
                            </div>
                            -->
                            <select class="form-select form-select-sm access-level" data-user-id="${user.userId}">
                                <option value="edit" ${user.accessLevel === 'edit' ? 'selected' : ''}>Edit</option>
                                <option value="view" ${user.accessLevel === 'view' ? 'selected' : ''}>View</option>
                            </select>
                            <button class="btn btn-sm remvaccessbtn remove-user" data-user-id="${user.userId}">Remove</button>
                        ` : `<div class="fw-bold text-primary">Owner</div>`}
                        
                            </div>
                        </div>`;
                });
                container.html(rows);
            })
            .fail(() => {
                modal.find('#usersWithAccessContainer').html('<div class="text-danger">Failed to load users.</div>');
            });

        // Load invite users
        loadUsersForInvite(modal.find('#userInviteSelect'));
    });
    // Invite user button
    $('#sharedoc-modal').on('click', '#inviteUserBtn', function () {
        const $btn = $(this);
        const originalText = $btn.html();

        // Set button to loading state
        $btn.prop('disabled', true)
            .addClass('btn-light')
            .removeClass('btn-primary')
            .html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true">');

        const userEmail = $('#userInviteSelect').val();
        const accessLevel = $('#accessLevelSelect').val();
        const duration = $('input[name="time"]:checked').attr('id');

        let customStart = null;
        let customEnd = null;

        // Read dates from Flatpickr range if "Custom" is selected
        if (duration === 'custom' && customFlatpickr?.selectedDates.length) {
            customStart = customStart = flatpickr.formatDate(customFlatpickr.selectedDates[0], "Y-m-d");
        
            if (customFlatpickr.selectedDates.length === 2) {
                customEnd = flatpickr.formatDate(customFlatpickr.selectedDates[1], "Y-m-d");
            } else {
                customEnd = customStart;
            }
        }
        

        if (!currentDocId) {
            showToast('No document selected', 'info');
            resetBtn();
            return;
        }

        if (!userEmail) {
            showToast('Please enter user email', 'info');
            resetBtn();
            return;
        }

        if (!$('input[name="time"]:checked').length) {
            showToast('Please select a time duration', 'info');
            resetBtn();
            return;
        }

        if (duration === 'custom' && (!customStart || !customEnd)) {
            showToast('Please select a start and end date for custom duration', 'info');
            resetBtn();
            return;
        }

        const inviteData = {
            userEmail: userEmail,
            accessLevel: accessLevel,
            duration: duration
        };

        if (duration === 'custom') {
            inviteData.customStart = customStart;
            inviteData.customEnd = customEnd;
        }

        $.ajax({
            url: `${baseUrl}/api/documents/${currentDocId}/invite`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(inviteData),
            success: function (response) {
                showToast('Invitation sent successfully!', 'success');
                $('#userInviteSelect').val(''); // Clear the input
                $('#sharedoc-modal').modal('hide');
            },
            error: function (err) {
                const errorMsg = err.responseJSON?.message || 'Failed to send invitation';
                showToast(errorMsg, 'error');
            },
            complete: function () {
                resetBtn();
            }
        });

        function resetBtn() {
            $btn.prop('disabled', false)
                .removeClass('btn-light')
                .addClass('btn-primary')
                .html(originalText);
        }
    });
    // Custom Date Visibility
    $('#sharedoc-modal input[name="time"]').on('change', function () {
        const isCustom = $(this).attr('id') === 'custom';

        if (isCustom) {
            $('#customDateWrapper').slideDown(200, function () {
                if (!customFlatpickr) {
                    customFlatpickr = flatpickr("#flatpickr-range", {
                        mode: "range",
                        dateFormat: "d-m-Y",
                        conjunction: " to "
                    });
                }
            });
        } else {
            $('#customDateWrapper').slideUp(200);
        }
    });


    // Access Type & Role Info Text
    $(document).on('change', '#sharedoc-modal #accessType, #sharedoc-modal #roleType', function () {
        const accessType = $('#accessType').val();
        const roleType = $('#roleType').val();
        const infoText = $('#infoText');

        if (accessType === 'anyone') {
            infoText.text(roleType === 'viewer'
                ? 'Anyone on the internet with the link can view'
                : 'Anyone on the internet with the link can edit');
        } else {
            infoText.text('Only people with access can view');
        }
    });

    // Invite User
    $(document).on('click', '#inviteUserBtn', function () {
        const $btn = $(this).prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span>');
        const userEmail = $('#userInviteSelect').val();
        const accessLevel = $('#accessLevelSelect').val();
        const duration = $('input[name="time"]:checked').attr('id');
        let customStart = null, customEnd = null;

        if (duration === 'custom' && customFlatpickr?.selectedDates.length === 2) {
            customStart = customFlatpickr.selectedDates[0].toISOString();
            customEnd = customFlatpickr.selectedDates[1].toISOString();
        }

        if (!userEmail || !$('input[name="time"]:checked').length || (duration === 'custom' && (!customStart || !customEnd))) {
            $btn.prop('disabled', false).html('Invite');
            return;
        }

        const data = { userEmail, accessLevel, duration };
        if (duration === 'custom') {
            data.customStart = customStart;
            data.customEnd = customEnd;
        }

        $.ajax({
            url: `${baseUrl}/api/documents/${currentDocId}/invite`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data),
            success: () => {
                showToast('Invitation sent!', 'success');
                $('#sharedoc-modal').modal('hide');
            },
            error: (err) => {
                showToast(err.responseJSON?.message || 'Failed to send invite', 'error');
            },
            complete: () => $btn.prop('disabled', false).html('Invite')
        });
    });
    // Time duration radio buttons
    // Remove User Access
    $('#sharedoc-modal').on('click', '.remove-user', function () {
        const userId = $(this).data('user-id');
        const userRow = $(this).closest('.user-accssrow');

        if (!currentDocId || !userId) {
            userRow.remove();
            return;
        }

        // Update modal content dynamically for removing user access
        $('#trashdocLabel').html(`
                        <img src="/img/icons/bin.png" alt="Remove User" width="40" class="mb-2"><br>
                        Remove User Access
                    `);
        $('#trashdoc-modal .modal-body').text(
            'Are you sure you want to remove this user’s access to the document? This action cannot be undone.'
        );
        $('#confirm-trash-folder').text('Yes, Remove');

        // Show confirmation modal
        $('#trashdoc-modal').modal('show');

        // Ensure previous click handler is removed before reattaching
        $('#confirm-trash-folder').off('click').on('click', function () {
            $.ajax({
                url: `${baseUrl}/api/documents/share/${currentDocId}`,
                method: 'DELETE',
                contentType: 'application/json',
                data: JSON.stringify({ userId: userId }),
                success: function () {
                    userRow.remove();
                    $('#trashdoc-modal').modal('hide'); // Hide modal after success
                    showToast('User access removed successfully!', 'success');
                },
                error: function (err) {
                    $('#trashdoc-modal').modal('hide');
                    showToast(
                        err.responseJSON?.message || 'Failed to remove user access',
                        'error'
                    );
                }
            });
        });
    });

    // Update Permissions (Done button)
    $(document).on('click', '#sharedoc-modal #shareBtn', function () {
        const users = $('#usersWithAccessContainer .user-accssrow').map(function () {
            const userId = $(this).find('.access-level').data('user-id');
            if (!userId) return null;
            return {
                userId,
                accessLevel: $(this).find('.access-level').val(),
                canDownload: $(this).find('.download-access').is(':checked')
            };
        }).get().filter(Boolean);

        const generalAccess = $('#accessType').val() === 'anyone';
        const generalRole = $('#roleType').val();

        if (users.length === 0 && !generalAccess) {
            showToast('Add at least one user or enable public access', 'info');
            return;
        }

        $.ajax({
            url: `${baseUrl}/api/documents/${currentDocId}/permissions`,
            method: 'PATCH',
            contentType: 'application/json',
            data: JSON.stringify({ users, generalAccess, generalRole }),
            success: (res) => {
                showToast(res.message || 'Permissions updated!', 'success');
                $('#sharedoc-modal').modal('hide');
            },
            error: (err) => {
                const errorMsg =
                    err.responseJSON?.message ||err.responseJSON?.errors?.[0]?.message || err.responseText || 'Update failed';
                     showToast(errorMsg, 'error');}            
        });
    });

    // Copy Link
    $(document).on('click', '#copyLinkBtn', function () {
        const link = $('#sharelink').val();
        const accessType = $('#accessType').val();
        const duration = $('input[name="time"]:checked').attr('id');
        const isCustom = duration === 'custom';

        if (!link) return showToast('No link to copy', 'info');
        if (!currentDocId) return showToast('Invalid document ID', 'error');

        // --- Check duration BEFORE copying text ---
        if (accessType === 'anyone' && !duration) {
            showToast('Please select a time duration before copying the link', 'warning');
            return;
        }

        // --- Copy link to clipboard ---
        navigator.clipboard.writeText(link)
            .then(() => showToast('Link copied!', 'success'))
            .catch(() => {
                const temp = document.createElement('textarea');
                temp.value = link;
                document.body.appendChild(temp);
                temp.select();
                document.execCommand('copy');
                document.body.removeChild(temp);
                showToast('Link copied!', 'success');
            });

        // --- Build query string ---
        let query = '';

        if (accessType === 'anyone') {
            if (isCustom && customFlatpickr?.selectedDates.length === 2) {
                const start = customFlatpickr.selectedDates[0].toISOString();
                const end = customFlatpickr.selectedDates[1].toISOString();
                query = `?ispublic=true&duration=custom&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
            } else {
                query = `?ispublic=true&duration=${duration}`;
            }
        } else {
            query = `?ispublic=false`;
        }

        // --- Send PATCH request ---
        $.ajax({
            url: `${baseUrl}/api/documents/${currentDocId}/sharelink${query}`,
            method: 'PATCH',
            success: function (res) {
                // showToast(res.message || 'Share settings updated!', 'success');
            },
            error: function (err) {
                showToast(err.responseJSON?.message || 'Failed to update share settings', 'error');
            }
        });
    });


    // -------------------------
    // Archive Document
    // -------------------------
    $(document).on('click', '.archive-document', function (e) {
        e.preventDefault();
        const docId = $(this).data('id');
        const docName = $(this).closest('tr').find('td:nth-child(2) p').text().trim() || 'this document';

        $('#archivedoc-modal .modal-body').text(`Are you sure you want to archive "${docName}"?`);
        $('#archivedoc-modal .modal-title').html(`<img src="/img/icons/archvbin.png" alt="Archive" class="me-2"> Move to Archive`);
        $('#archivedoc-modal').modal('show');

        $('#archivedoc-modal .btn-primary').off('click').on('click', function () {
            $.ajax({
                url: `${baseUrl}/api/documents/${docId}/archive?isArchived=true`,
                method: 'PATCH',
                success: function (res) {
                    $('#archivedoc-modal').modal('hide');
                    if (typeof table !== 'undefined') table.ajax.reload(null, false);
                    showToast(res.message || 'Document archived!', 'success');
                },
                error: function (err) {
                    showToast(err.responseJSON?.message || 'Failed to archive', 'error');
                }
            });
        });
    });

    // When opening the download modal
    $(document).on("show.bs.modal", "#downloaddoc-modal", function (event) {
        const button = $(event.relatedTarget);
        downloadFileId = button.data("file-id");

        if (!downloadFileId) {
            showToast("Invalid file", "error");
            return;
        }

        // Load file info for display
        $.get(`${baseUrl}/api/download/${downloadFileId}`)
            .done(res => {
                $("#downloadFileLabel").text(res.data.originalName || "Original File");
                $("#downloadFileSize").text(res.data.size || "(—)");
                $("#downloadFileIcon").attr("src", res.data.icon || "/img/icons/fn2big.png");
            })
            .fail(() => {
                $("#downloadFileLabel").text("Original File");
                $("#downloadFileSize").text("(—)");
            });
    });

    // Confirm download
    $(document).on("click", "#confirmDownload", function () {
        if (!downloadFileId) {
            showToast("No file selected", "error");
            return;
        }

        const downloadBtn = $(this);
        downloadBtn.prop("disabled", true).text("Downloading...");

        fetch(`${baseUrl}/api/download/${downloadFileId}`, {
            method: "GET",
            credentials: "include"
        })
            .then(res => {
                if (!res.ok) throw new Error("Download failed");

                // Extract filename
                const disposition = res.headers.get("Content-Disposition");
                let filename = "download.zip";

                if (disposition && disposition.includes("filename=")) {
                    const match = disposition.match(/filename\*?=(?:UTF-8''|")(.*?)"?$/);
                    if (match && match[1]) {
                        filename = decodeURIComponent(match[1]);
                    }
                }

                return res.blob().then(blob => ({ blob, filename }));
            })
            .then(({ blob, filename }) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");

                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();

                window.URL.revokeObjectURL(url);

                $("#downloaddoc-modal").modal("hide");
                showToast("Downloaded", "success");
            })
            .catch(() => showToast("Failed to download file", "error"))
            .finally(() => {
                downloadBtn.prop("disabled", false).text("Download");
            });
    });


    // -------------------------
    // Trash (Delete) Document
    // -------------------------
    $(document).on('click', '.btn-delete', function (e) {
        e.preventDefault();
        const docId = $(this).data('id');
        $('#trashdoc-modal').modal('show');

        $('#confirm-trash-folder').off('click').on('click', function () {
            $.ajax({
                url: `${baseUrl}/api/documents/${docId}`,
                method: 'DELETE',
                success: function (res) {
                    $('#trashdoc-modal').modal('hide');
                    if (typeof table !== 'undefined') table.ajax.reload();
                    showToast(res.message || 'Document moved to trash!', 'success');
                },
                error: function (err) {
                    showToast(err.responseJSON?.message || 'Failed to delete', 'error');
                }
            });
        });
    });
    document.addEventListener('DOMContentLoaded', function () {
        function getPreviousVersion(version) {
            const parts = String(version).split('.').map(Number);

            let major = parts[0];
            let minor = parts[1];

            // If minor > 0 → decrease minor (1.3 → 1.2)
            if (minor > 0) {
                minor -= 1;
            } else {
                // If minor is 0 → go back to previous major (2.0 → 1.0)
                major -= 1;
                minor = 0;
            }

            return `${major}.${minor}`;
        }

        function loadVersionHistory(docId) {
            const versionList = document.querySelector('#versionhistory-modal .version-list');
            if (!versionList) return;

            versionList.innerHTML = '<p class="text-center">Loading...</p>';

            fetch(`/api/documents/${docId}/versions/history`)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .then(res => {
                    if (!res.success || !res.data?.versions) {
                        versionList.innerHTML = '<p class="text-danger">No version history found.</p>';
                        return;
                    }

                    const versions = res.data.versions;
                    const currentVersion = res.data.currentVersion;

                    versionList.innerHTML = '';

                    versions.forEach(item => {
                        const documentName = item.documentName;
                        const versionValue = item.versionLabel;
                        const modifiedDate = formatDateTime(item.createdAt);
                        const changedBy = item.createdBy?.name || "Unknown";
                        const changeReason = item.changeReason || "Updated";

                        const versionNumber = parseFloat(versionValue);
                        const hideRestore = versionNumber <= 1.0;

                        const restoreButton = hideRestore ? '' : `
                    <button class="btn btn-outline-light rounded-pill btn-restore-version"
                        data-version="${versionValue}"
                        data-versionid="${item.versionId}"
                        data-prev="${versionValue}">
                        Restore to v${versionValue}
                    </button>`;

                        // Build HTML block
                        const html = `
                <div class="version-item border-bottom pb-3 mb-3">
                    <div class="dflexbtwn align-items-start">
                        <div class="flxtblleft">
                            <span class="avatar rounded bg-light mb-2">
                                <img src="/img/icons/fn2.png" alt="User">
                            </span>

                            <div class="flxtbltxt">
                                <p class="fs-18 mb-1 fw-normal">
                                    ${documentName} v${versionValue}
                                    ${currentVersion === versionValue
                                ? '<span class="badge bg-success ms-2">Current</span>'
                                : ''}
                                </p>

                                <span class="fs-16 fw-normal d-block mb-2">
                                    Modified by ${changedBy}
                                </span>

                                <h5 class="fs-18 fw-light text-black mb-3">
                                    ${changeReason}
                                </h5>

                                <div class="version-actions">
                                    <button class="site-btnmd fw-light btn-view-version"
                                            data-version="${versionValue}">
                                        View
                                    </button>

                                    ${restoreButton}
                                </div>
                            </div>
                        </div>

                        <p class="text-muted">Modified on ${modifiedDate}</p>
                    </div>
                </div>
                `;

                        versionList.insertAdjacentHTML('beforeend', html);
                    });
                })
                .catch(error => {
                    console.error('Error loading version history:', error);
                    versionList.innerHTML = '<p class="text-danger">Failed to load version history.</p>';
                });
        }

        const shareModal = document.getElementById('sharedoc-modal');
        const versionModal = document.getElementById('versionhistory-modal');

        if (shareModal) {
            shareModal.addEventListener('show.bs.modal', function (event) {
                const button = event.relatedTarget;
                const $button = $(button);
                currentDocId = $button.data('doc-id');
                currentFileId = $button.data('file-id');

                if (!currentDocId || !currentFileId) {
                    console.warn('Missing docId or fileId for share modal');
                    return;
                }
            });
        }

        if (versionModal) {
            versionModal.addEventListener('show.bs.modal', function (event) {
                const button = event.relatedTarget;
                const dropdownItem = button.closest('.dropdown-item');
                const docId = dropdownItem?.getAttribute('data-id');

                if (!docId) {
                    console.error('No document ID for version history');
                    return;
                }

                currentDocId = docId;
                loadVersionHistory(docId);
            });
        }
    });
    // Handle View Version button
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('btn-view-version')) {
            const version = e.target.getAttribute('data-version');
            if (!currentDocId || !version) return;
            window.location.href = `/documents/${currentDocId}/versions/view?version=${version}`;
        }
    });
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('btn-restore-version')) {

            const versionId = e.target.getAttribute('data-versionid');
            const previousVersion = e.target.getAttribute('data-prev');

            if (!currentDocId || !versionId) return;

            restoreTarget = {
                docId: currentDocId,
                versionId,
                targetVersion: previousVersion
            };

            const modal = document.getElementById('restore-folder-modal');
            modal.querySelector('.modal-body').textContent =
                `Are you sure you want to restore this document to version ${previousVersion}?`;

            new bootstrap.Modal(modal).show();
        }
    });



    // Confirm restore action
    document.getElementById('confirm-restore-folder')?.addEventListener('click', function () {

        if (!restoreTarget.docId || !restoreTarget.versionId) return;

        fetch(`/api/documents/${restoreTarget.docId}/versions/${restoreTarget.versionId}/restore`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targetVersion: restoreTarget.targetVersion
            })
        })
            .then(res => res.json())
            .then(res => {
                showToast(res.message || 'Version restored successfully', 'success');

                // Hide restore confirmation modal
                const restoreModalInstance = bootstrap.Modal.getInstance(
                    document.getElementById('restore-folder-modal')
                );
                restoreModalInstance?.hide();

                // Hide version history modal
                const versionModalInstance = bootstrap.Modal.getInstance(
                    document.getElementById('versionhistory-modal')
                );
                versionModalInstance?.hide();

                // Optionally reload document list
                if (typeof loadDocuments === 'function') loadDocuments();

                // Clear restoreTarget
                restoreTarget = {};
            })
            .catch(() => showToast('Failed to restore version', 'error'));
    });

    // Search functionality for versions
    document.getElementById('versionSearch')?.addEventListener('input', function (e) {
        const searchTerm = e.target.value.toLowerCase();
        const versionItems = document.querySelectorAll('#versionhistory-modal .version-item');

        versionItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(searchTerm) ? 'block' : 'none';
        });
    });

})(jQuery);