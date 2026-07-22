const fileIcons = {
    ppt: "/img/icons/fn1.png",
    pptx: "/img/icons/fn1.png",
    doc: "/img/icons/fn2.png",
    docx: "/img/icons/fn2.png",
    xls: "/img/icons/fn3.png",
    xlsx: "/img/icons/fn3.png",
    pdf: "/img/icons/fn4.png",
    default: "/img/icons/fn1.png"
};



// =================== Dashboard Stats ===================
async function loadDashboardStats(filter = 'year') {
    try {
        const response = await fetch(`/api/dashboard/stats?filter=${filter}`);
        const result = await response.json();

        if (result.success) {
            const stats = result.data;
            document.getElementById('pendingCount').innerText = stats.pending || 0;
            document.getElementById('approvedCount').innerText = stats.approved || 0;
            document.getElementById('rejectedCount').innerText = stats.rejected || 0;
        } else {
            console.error('Failed to load dashboard stats:', result.message);
        }
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
    }
}


// =================== File Status Logs ===================
async function loadFileStatusLogs(filter = 'year') {
    const tableBody = document.getElementById('fileStatusTableBody');
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">Loading...</td></tr>`;
    try {
        const response = await fetch('/api/permission-logs');
        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
            const rows = result.data.map(entry => {
                const user = entry.user?.username || "Unknown User";
                const fileObj = entry.document?.files?.[0] || {};
                const fileName = fileObj.originalName || "Untitled";
                const fileSize = fileObj.fileSize ? formatFileSize(fileObj.fileSize) : "-"; // Optional: format bytes
                const icon = getFileIcon(fileName);
                const action = entry.requestStatus || "—";
                const formattedDate = formatDateTime(entry.requestedAt);

                return `
                <tr>
                    <td><p>${user}</p></td>
                    <td>
                        <div class="flxtblleft">
                            <span class="avatar rounded bg-light mb-2">
                                <img src="${icon}" alt="${fileName}">
                            </span>
                            <div class="flxtbltxt">
                                <p class="fs-14 mb-1 fw-normal text-neutral">${fileName}</p>
                                <span class="fs-11 fw-light text-black">${fileSize}</span>
                            </div>
                        </div>
                    </td>
                    <td><p class="tbl_date">${formattedDate}</p></td>
                    <td><p>${action}</p></td>
                </tr>
            `;
            }).join('');

            tableBody.innerHTML = rows || `<tr><td colspan="4" class="text-center py-3 text-muted">No records found.</td></tr>`;
        } else {
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-danger">Failed to load logs</td></tr>`;
        }
    } catch (error) {
        console.error('Error fetching file status logs:', error);
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-danger">Error loading data</td></tr>`;
    }


}
// Optional helper to format bytes nicely
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

async function loadStorageData(projectId = '') {
    try {
        const url = `/api/myStorage`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success && result.data) {
            const data = result.data;
            
            // Use the percentage directly from API
            const usedPercentage = data.usedPercentage || 0;
            const remainingPercentage = data.remainingPercentage || 100;
            
            // Update progress bar (show used percentage)
            const progressBar = document.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = `${usedPercentage}%`;
                progressBar.setAttribute('aria-valuenow', usedPercentage);
                
                // Color coding based on usage
                if (usedPercentage > 90) {
                    progressBar.className = 'progress-bar bg-danger rounded';
                } else if (usedPercentage > 75) {
                    progressBar.className = 'progress-bar bg-warning rounded';
                } else {
                    progressBar.className = 'progress-bar bg-info rounded';
                }
            }
            
            // Update storage summary text
            const summaryText = document.querySelector('.d-flex.align-items-center.justify-content-between p:first-child');
            if (summaryText) {
                const usedGB = data.usedStorage || 0;
                const totalGB = data.totalStorage || 0;
                summaryText.textContent = `${usedGB.toFixed(2)} GB used of ${totalGB.toFixed(2)} GB`;
            }
            
            // Update percentage text
            const percentageText = document.querySelector('.d-flex.align-items-center.justify-content-between p.text-title');
            if (percentageText) {
                percentageText.textContent = `${Math.round(usedPercentage)}%`;
            }
            
            // Update storage distribution
            updateStorageDistribution(data);
        } else {
            console.error('Failed to load storage data:', result.message);
            showStorageError();
        }
    } catch (error) {
        console.error('Error loading storage data:', error);
        showStorageError();
    }
}

// Helper function to show error state
function showStorageError() {
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', 0);
    }
    const summaryText = document.querySelector('.d-flex.align-items-center.justify-content-between p:first-child');
    if (summaryText) {
        summaryText.textContent = 'Error loading storage data';
    }
    const percentageText = document.querySelector('.d-flex.align-items-center.justify-content-between p.text-title');
    if (percentageText) {
        percentageText.textContent = '0%';
    }
}

function updateStorageDistribution(data) {
    const folderWraps = document.querySelectorAll('.folder-wrap');
    
    if (folderWraps.length >= 3) {
        // Get storage values in GB - use the exact values from API
        const docSize = data.documents || 0;
        const mediaSize = data.media || 0;
        const othersSize = data.others || 0;
        
        // Get the percentage values from API (optional - if you want to show percentages)
        const docPercentage = data.documentsPercentage || 0;
        const mediaPercentage = data.mediaPercentage || 0;
        const othersPercentage = data.othersPercentage || 0;
        
        // Get counts
        const docCount = data.documentsCount || 0;
        const mediaCount = data.mediaCount || 0;
        const othersCount = data.othersCount || 0;
        
        // Update the h6 elements with GB values
        // For very small values, show in MB instead of GB
        const docDisplay = docSize < 0.001 ? `${(docSize * 1024).toFixed(2)} MB` : `${docSize.toFixed(2)} GB`;
        const mediaDisplay = mediaSize < 0.001 ? `${(mediaSize * 1024).toFixed(2)} MB` : `${mediaSize.toFixed(2)} GB`;
        const othersDisplay = othersSize < 0.001 ? `${(othersSize * 1024).toFixed(2)} MB` : `${othersSize.toFixed(2)} GB`;
        
        folderWraps[0].querySelector('h6').textContent = docDisplay;
        folderWraps[1].querySelector('h6').textContent = mediaDisplay;
        folderWraps[2].querySelector('h6').textContent = othersDisplay;
        
        // Update the labels with file counts (showing the count from API)
        const labels = document.querySelectorAll('.folder-wrap .fs-12');
        if (labels.length >= 3) {
            // Update the labels to show counts (if you want)
            // labels[0].textContent = `Files (${docCount} files)`;
            // labels[1].textContent = `Media (${mediaCount} files)`;
            // labels[2].textContent = `Others (${othersCount} files)`;
            
            // OR update to show percentages
            // labels[0].textContent = `Files (${docPercentage.toFixed(1)}%)`;
            // labels[1].textContent = `Media (${mediaPercentage.toFixed(1)}%)`;
            // labels[2].textContent = `Others (${othersPercentage.toFixed(1)}%)`;
            
            // Keep original labels but maybe add count as tooltip or secondary text
            // Currently keeping the labels as "Files", "Media", "Others"
        }
    }
}
// =================== Documents ===================
async function loadDocuments(selectedDept = "", sortBy = "") {
    try {
        let url = `/api/documents/compliance?limit=10&page=1`;

        if (selectedDept) url += `&department=${selectedDept}`;
        if (sortBy) {
            if (sortBy === "name") url += `&orderColumn=1&orderDir=asc`;
            else if (sortBy === "date") url += `&orderColumn=2&orderDir=desc`;
            else if (sortBy === "status") url += `&orderColumn=14&orderDir=asc`;
        }

        const response = await fetch(url);
        const result = await response.json();

        const tbody = document.querySelector("#documentsTable tbody");
        tbody.innerHTML = "";

        if (!result.success || !result.data.documents.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3">No documents found</td></tr>`;
            return;
        }

        result.data.documents.forEach(doc => {
            const { metadata, department, compliance, files, archivedAt } = doc;

            // FIX: files is an object, not an array
            const file = files || {}; 
            
            // Use originalName from files object as display name
            const displayName = file?.originalName?.trim() || metadata?.fileName?.trim() || 'Untitled Document';
            
            const expiry = compliance?.isCompliance && compliance.expiryDate
                ? formatDateTime(compliance.expiryDate)
                : 'N/A';
                
            // Call the function to get the status and icon
            const retentionStatus = getRetentionStatus(archivedAt, compliance?.expiryDate);
            const retentionDisplay = `
    <p class="mb-0 d-flex align-items-center fw-medium text-neutral">
        ${retentionStatus.icon} 
        ${retentionStatus.status}
    </p>
`;
            
            // Get file extension and determine if it's an image
            const ext = file?.originalName?.split('.').pop()?.toLowerCase() || '';
            const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'];
            const isImage = imageExtensions.includes(ext);
            const imagePath = file?.fileUrl || '';
            const fileId = file?._id || doc?._id || '';
            
            // For images, use the actual image URL; for other files, use icon
            let thumbnailSrc;
            if (isImage && imagePath) {
                thumbnailSrc = imagePath;
            } else {
                thumbnailSrc = fileIcons[ext] || fileIcons.default;
            }

            // Format file size - already in KB/MB format from backend
            const fileSizeKB = file?.fileSize || '—';

            const versionLabel = file?.version || '1.0';

            const isCompliant = compliance?.isCompliance
                ? `<p class="text-success d-flex align-items-center gap-2 mb-0">
                        <span class="d-inline-flex align-items-center justify-content-center rounded-circle bg-success-subtle" style="width: 28px; height: 28px;">
                            <i class="ti ti-check"></i>
                        </span>
                        Compliant
                   </p>`
                : `<p class="text-danger d-flex align-items-center gap-2 mb-0">
                        <span class="d-inline-flex align-items-center justify-content-center rounded-circle bg-danger-subtle" style="width: 28px; height: 28px;">
                            <i class="ti ti-x"></i>
                        </span>
                        Non-Compliant
                   </p>`;

            const actionsDropdown = `
                <div class="btn-group" role="group">
                    <button type="button" class="btn border-0" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="ti ti-settings"></i>
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="/documents/${doc._id}/versions/view?version=""><i class="ti ti-eye"></i> View</a></li>
                        <li><a class="dropdown-item" href="/documents/edit/${doc._id}"><i class="ti ti-pencil-minus"></i> Edit</a></li>
                        <li>
                            <a class="dropdown-item share-btn" href="#" data-doc-id="${doc._id}" data-file-id="${file?._id || ''}" data-bs-toggle="modal" data-bs-target="#sharedoc-modal">
                                <i class="ti ti-share"></i> Share
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item" href="#" data-id="${doc._id}" data-bs-toggle="modal" data-bs-target="#versionhistory-modal">
                                <i class="ti ti-history"></i> Version History
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item" href="#" data-bs-toggle="modal" data-file-id="${doc._id || ''}" data-bs-target="#downloaddoc-modal">
                                <i class="ti ti-download"></i> Download
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item btn-delete" href="#" data-id="${doc._id}" data-bs-toggle="modal" data-bs-target="#trashdoc-modal">
                                <i class="ti ti-trash"></i> Move to Trash
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item archive-document" href="#" data-id="${doc._id}" data-bs-toggle="modal" data-bs-target="#archivedoc-modal">
                                <i class="ti ti-archive"></i> Move to Archive
                            </a>
                        </li>
                    </ul>
                </div>`;

            // --- Row HTML with click handler on file name ---
            const rowHTML = `
                <tr>
                    <td>${actionsDropdown}</td>
                    <td>
                        <div class="flxtblleft" style="cursor: pointer;" onclick="window.open('/folders/view/${fileId}', '_blank')">
                            <span class="avatar rounded bg-light">
                                <img src="${thumbnailSrc}" 
                                     alt="icon" 
                                     style="width: 32px; height: 32px; object-fit: cover;"
                                     onerror="this.src='${fileIcons.default}'">
                            </span>
                            <div class="flxtbltxt">
                                <p class="fs-14 mb-1 fw-medium text-neutral text-truncate" style="max-width: 200px;" title="${escapeHtml(displayName)}">
                                    ${escapeHtml(displayName)}
                                    <span class="text-success ms-1">v${versionLabel}</span>
                                </p>
                                <span class="fs-11 text-muted">${fileSizeKB}</span>
                            </div>
                        </div>
                    </td>
                    <td><p class="mb-0">${escapeHtml(department?.name || 'N/A')}</p></td>
                    <td>${isCompliant}</td>
                    <td>${retentionDisplay}</td>
                    <td><p class="mb-0 tbl_date">${expiry}</p></td>
                </tr>`;

            tbody.insertAdjacentHTML('beforeend', rowHTML);
        });

    } catch (err) {
        console.error(err);
    }
}

// --- Helper: Escape HTML to prevent XSS ---
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    return fileIcons[ext] || fileIcons.default;
}

function formatDateTime(iso) {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function loadFileUsage() {
    try {
        const res = await fetch('/api/analytics/department-file-usage');
        const data = await res.json();

        Highcharts.chart('fileUsageChart', {
            chart: { type: 'line' },
            title: { text: null },
            xAxis: { categories: data.categories },
            yAxis: { title: null },
            series: data.series,
            credits: false
        });
    } catch (error) {
        console.error("Error loading chart:", error);
    }
}

async function loadAnalyticsStats() {
    try {
        const res = await fetch("/api/analytics/stats");
        const { data } = await res.json();

        // Update numbers
        document.querySelector("#total-documents").textContent = data.totalDocuments;
        document.querySelector("#uploaded-this-month").textContent = data.uploadedThisMonth;
        document.querySelector("#modified-documents").textContent = data.modifiedDocuments;
        document.querySelector("#deleted-archive").textContent = data.deletedOrArchived;

        // Update badges using correct API fields
        updateGrowthBadge('#total-documents', data.totalDocumentsGrowth);
        updateGrowthBadge('#uploaded-this-month', data.uploadedThisMonthGrowth ?? 0);
        updateGrowthBadge('#modified-documents', data.modifiedDocumentsGrowth);
        updateGrowthBadge('#deleted-archive', data.deletedOrArchivedGrowth);

    } catch (err) {
        console.error("Failed to load document stats:", err);
    }
}


function updateGrowthBadge(cardSelector, growthPercent) {
    const $card = $(cardSelector).closest('.card');
    const $badge = $card.find('.fs-12.fw-medium').first(); // finds growth section

    if (growthPercent === undefined || growthPercent === null) {
        $badge.html(`
            <span class="sm-avatar avatar rounded bg-soft-secondary">
                <i class="ti ti-minus"></i>
            </span> 
            0%
        `);
        return;
    }

    const isPositive = growthPercent >= 0;
    const icon = isPositive ? 'ti ti-trending-up' : 'ti ti-trending-down';
    const colorClass = isPositive ? 'bg-soft-success text-success' : 'bg-soft-danger text-danger';

    $badge.html(`
        <span class="sm-avatar avatar rounded ${colorClass.split(' ')[0]}">
            <i class="${icon}"></i>
        </span>
        ${isPositive ? '+' : ''}${growthPercent}%
    `);
}

// =================== Event Listeners ===================
document.addEventListener('DOMContentLoaded', () => {
    let currentDept = "";
    let currentSort = "";
    
    // Department Filter
    $("#analyticsDepartment").on("change", function () {
        currentDept = $(this).val();
        loadDocuments(currentDept, currentSort);
    });

    // Sort by
    document.getElementById("sortBySelect").addEventListener("change", function () {
        currentSort = this.value;
        loadDocuments(currentDept, currentSort);
    });

    // Load all data
    loadDashboardStats();
    loadFileStatusLogs();
    loadDocuments();
    loadAnalyticsStats();
    loadFileUsage();
    loadStorageData(); // <-- ADD THIS LINE
    
    document.getElementById('filterRange')?.addEventListener('change', (e) => {
        loadDashboardStats(e.target.value);
    });
});
document.getElementById('logFilter')?.addEventListener('change', (e) => {
    loadFileStatusLogs(e.target.value);
});