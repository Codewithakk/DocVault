// =============================================
// DOCUMENT ADD/EDIT - COMPLETE SCRIPT
// =============================================

// Global state
$(document).ready(function () {
    // Force header project select to work independently
    if (typeof initializeHeaderComponents === 'function') {
        setTimeout(initializeHeaderComponents, 100);
    }
});

window.selectedFolders = [];
window.selectedProject = { id: null, name: null };
window.selectedDepartment = { id: null, name: null };
window.selectedProjectManager = { id: null, name: null };
window.uploadedFilesMetadata = []; // Store metadata for ALL uploaded files
window.folderTreeData = []; // Store the complete folder tree data
window.uploadedFileIds = []; // Store server-side file IDs

const folderForm = document.getElementById('folderForm');
const folderContainer = document.getElementById('folderContainer');
const selectedFolderInput = document.getElementById('selectedFolderId');

// =============================================
// UTILITY FUNCTIONS
// =============================================

function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// =============================================
// DYNAMIC FOLDER TREE FUNCTIONS
// =============================================

/**
 * Fetch and build the dynamic folder tree
 */
async function buildDynamicFolderTree() {
    const projectId = $('#projectName').val();
    const departmentId = $('#department').val();
    
    // Reset tree and grid if nothing selected
    if ((!projectId || projectId === 'all') || (!departmentId || departmentId === 'all')) {
        $('#dynamicFolderTree').html('<li class="text-muted p-3">Please select project and department</li>');
        $('#dynamicFolderGrid').html('<p class="text-muted p-3">Please select project and department</p>');
        window.folderTreeData = [];
        return;
    }
    
    const query = new URLSearchParams();
    if (departmentId && departmentId !== 'all') query.append('departmentId', departmentId);
    if (projectId && projectId !== 'all') query.append('projectId', projectId);
    
    try {
        // Show loaders
        $('#folderTreeLoader').removeClass('d-none');
        $('#folderGridLoader').removeClass('d-none');
        
        const res = await fetch(`/api/folders/tree/structure?${query.toString()}`);
        const data = await res.json();
        
        if (!data.success || !data.tree || data.tree.length === 0) {
            $('#dynamicFolderTree').html('<li class="text-muted p-3">No folders found</li>');
            $('#dynamicFolderGrid').html('<p class="text-muted p-3">No folders found</p>');
            return;
        }
        
        window.folderTreeData = data.tree;
        
        // Build tree view
        renderFolderTree(data.tree);
        
        // Build grid view
        renderFolderGrid(data.tree);
        
    } catch (err) {
        console.error("Error building folder tree:", err);
        $('#dynamicFolderTree').html('<li class="text-danger p-3">Error loading folders</li>');
        $('#dynamicFolderGrid').html('<p class="text-danger p-3">Error loading folders</p>');
    } finally {
        $('#folderTreeLoader').addClass('d-none');
        $('#folderGridLoader').addClass('d-none');
    }
}

/**
 * Render the folder tree recursively
 */
function renderFolderTree(treeData, parentElement = null, level = 0) {
    const container = parentElement || $('#dynamicFolderTree');
    
    if (!parentElement) {
        container.empty();
    }
    
    treeData.forEach(folder => {
        const hasChildren = folder.children && folder.children.length > 0;
        const folderId = folder._id;
        const folderName = folder.name;
        
        // Create folder node
        const li = document.createElement('li');
        li.className = 'folder-tree-item';
        
        const nodeDiv = document.createElement('div');
        nodeDiv.className = 'folder-node';
        nodeDiv.setAttribute('data-folder', folderId);
        nodeDiv.onclick = function(e) { selectFolderFromTree(e, folder); };
        
        // Build folder node HTML
        let nodeHTML = '';
        
        if (hasChildren) {
            nodeHTML += `
                <button type="button" class="folder-toggle expanded" onclick="toggleFolderTree(event, '${folderId}')">
                    <i class="ti ti-chevron-right"></i>
                </button>
            `;
        } else {
            nodeHTML += `<div style="width:15px;"></div>`;
        }
        
        nodeHTML += `
            <i class="folder-icon ${level === 0 ? 'root' : 'sub'} ti ti-folder"></i>
            <div class="folder-content">
                <div class="folder-info">
                    <div class="folder-name">${folderName}</div>
                    ${hasChildren ? `<div class="folder-count">${folder.children.length} sub-folders</div>` : ''}
                </div>
            </div>
        `;
        
        nodeDiv.innerHTML = nodeHTML;
        li.appendChild(nodeDiv);
        
        // Create nested UL for children
        if (hasChildren) {
            const nestedUl = document.createElement('ul');
            nestedUl.className = 'folder-nested';
            nestedUl.id = `nested-tree-${folderId}`;
            li.appendChild(nestedUl);
            
            // Recursively render children
            renderFolderTree(folder.children, nestedUl, level + 1);
        }
        
        container.append(li);
    });
}

/**
 * Render the folder grid (Frequently Used section)
 */
function renderFolderGrid(treeData) {
    const gridContainer = $('#dynamicFolderGrid');
    gridContainer.empty();
    
    // Flatten tree to get all folders for grid
    const allFolders = flattenFolderTree(treeData);
    
    if (allFolders.length === 0) {
        gridContainer.html('<p class="text-muted p-3">No folders available</p>');
        return;
    }
    
    // Display all folders or limit to first 8 for "Frequently Used"
    const displayFolders = allFolders.slice(0, 8);
    
    displayFolders.forEach(folder => {
        const card = document.createElement('div');
        card.className = 'folder-card';
        card.setAttribute('data-folder', folder._id);
        card.onclick = function(e) { selectFolderFromGrid(e, folder); };
        
        const subCount = folder.children ? folder.children.length : 0;
        
        card.innerHTML = `
            <div class="fldicn">
                <i class="folder-card-icon ti ti-folder" style="color: var(--folder-yellow);"></i>
            </div>
            <div class="frq_fldrtxt">
                <div class="folder-card-name">${folder.name}</div>
                <div class="folder-card-count">${subCount} Documents</div>
            </div>
        `;
        
        gridContainer.append(card);
    });
}

/**
 * Flatten folder tree to array
 */
function flattenFolderTree(tree, result = []) {
    tree.forEach(folder => {
        result.push(folder);
        if (folder.children && folder.children.length > 0) {
            flattenFolderTree(folder.children, result);
        }
    });
    return result;
}

/**
 * Toggle folder tree expansion
 */
function toggleFolderTree(event, folderId) {
    event.stopPropagation();
    const btn = event.currentTarget;
    const nested = document.getElementById(`nested-tree-${folderId}`);
    
    if (btn && nested) {
        btn.classList.toggle('expanded');
        nested.classList.toggle('collapsed');
    }
}

/**
 * Select folder from tree
 */
function selectFolderFromTree(event, folder) {
    event.stopPropagation();
    
    // Remove selected class from all tree nodes
    document.querySelectorAll('#dynamicFolderTree .folder-node').forEach(node => {
        node.classList.remove('selected');
    });
    
    // Add selected class to clicked node
    const clickedNode = event.currentTarget;
    clickedNode.classList.add('selected');
    
    // Update selection
    updateFolderSelection(folder);
}

/**
 * Select folder from grid
 */
function selectFolderFromGrid(event, folder) {
    event.stopPropagation();
    
    // Remove selected class from all grid cards
    document.querySelectorAll('#dynamicFolderGrid .folder-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Add selected class to clicked card
    const clickedCard = event.currentTarget;
    clickedCard.classList.add('selected');
    
    // Update selection
    updateFolderSelection(folder);
}

/**
 * Update folder selection logic
 */
function updateFolderSelection(folder) {
    // Find the full path to this folder
    const folderPath = findFolderPath(folder._id);
    
    // Update global state
    window.selectedFolders = folderPath;
    $('#selectedFolderId').val(folder._id);
    
    // Update UI
    updateDynamicBreadcrumb(folderPath);
    updateDirectoryPath();
    updateFolderBreadcrumb();
    
    // Also update the folder container
    loadFoldersIntoContainer(folder._id, folderPath);
    
    // Update grid/tree cross-selection
    updateGridSelection(folder._id);
    updateTreeSelection(folder._id);
}

/**
 * Find the path from root to a specific folder
 */
function findFolderPath(folderId, treeData = null, currentPath = []) {
    if (!treeData) {
        treeData = window.folderTreeData;
    }
    
    for (const folder of treeData) {
        const newPath = [...currentPath, { id: folder._id, name: folder.name }];
        
        if (folder._id === folderId) {
            return newPath;
        }
        
        if (folder.children && folder.children.length > 0) {
            const found = findFolderPath(folderId, folder.children, newPath);
            if (found) return found;
        }
    }
    
    return currentPath;
}

/**
 * Update tree selection from grid
 */
function updateTreeSelection(folderId) {
    document.querySelectorAll('#dynamicFolderTree .folder-node').forEach(node => {
        node.classList.remove('selected');
    });
    
    const treeNode = document.querySelector(`#dynamicFolderTree .folder-node[data-folder="${folderId}"]`);
    if (treeNode) {
        treeNode.classList.add('selected');
        treeNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Update grid selection from tree
 */
function updateGridSelection(folderId) {
    document.querySelectorAll('#dynamicFolderGrid .folder-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    const card = document.querySelector(`#dynamicFolderGrid .folder-card[data-folder="${folderId}"]`);
    if (card) {
        card.classList.add('selected');
    }
}

/**
 * Update the dynamic breadcrumb
 */
function updateDynamicBreadcrumb(folderPath) {
    const breadcrumbNav = $('#dynamicBreadcrumb');
    
    if (!folderPath || folderPath.length === 0) {
        breadcrumbNav.html(`
            <i class="ti ti-folder" style="color: var(--primary-blue); font-size: 1rem;"></i>
            <span class="text-muted">Select a folder</span>
        `);
        return;
    }
    
    let html = '<i class="ti ti-folder" style="color: var(--primary-blue); font-size: 1rem;"></i>';
    
    folderPath.forEach((folder, index) => {
        if (index < folderPath.length - 1) {
            html += `<a href="javascript:void(0)" onclick="navigateToFolder('${folder.id}')">${folder.name}</a>`;
            html += '<span class="breadcrumb-separator"> > </span>';
        } else {
            html += `<span class="active">${folder.name}</span>`;
        }
    });
    
    breadcrumbNav.html(html);
}

/**
 * Navigate to a specific folder in the breadcrumb
 */
function navigateToFolder(folderId) {
    const folder = findFolderById(folderId);
    if (folder) {
        updateFolderSelection(folder);
    }
}

/**
 * Find folder by ID in tree data
 */
function findFolderById(folderId, treeData = null) {
    if (!treeData) {
        treeData = window.folderTreeData;
    }
    
    for (const folder of treeData) {
        if (folder._id === folderId) return folder;
        
        if (folder.children && folder.children.length > 0) {
            const found = findFolderById(folderId, folder.children);
            if (found) return found;
        }
    }
    
    return null;
}

/**
 * Load folders into the folder container
 */
async function loadFoldersIntoContainer(folderId, folderPath) {
    await loadFolders(folderId, folderPath);
}

// =============================================
// METADATA DISPLAY - SHOW ALL UPLOADED FILES
// =============================================

/**
 * Update metadata display to show ALL uploaded files
 */
function updateMetadataDisplay() {
    const metadataContainer = $('#metadataDisplay');
    if (!metadataContainer.length) return;
    
    if (window.uploadedFilesMetadata.length === 0) {
        metadataContainer.html('<p class="text-muted">No files uploaded yet</p>');
        return;
    }
    
    let html = '<div class="table-responsive" style="max-height: 400px; overflow-y: auto;">';
    html += '<table class="table table-sm table-hover mb-0">';
    html += `
        <thead class="table-light sticky-top">
            <tr>
                <th>#</th>
                <th>File Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Uploaded By</th>
                <th>Upload Date</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    window.uploadedFilesMetadata.forEach((file, index) => {
        const fileTypeIcon = getFileTypeIcon(file.fileType);
        const fileStatus = file.fileId && !file.fileId.startsWith('temp_') ? 'Uploaded' : 'Pending';
        const statusBadgeClass = fileStatus === 'Uploaded' ? 'bg-success' : 'bg-warning';
        
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <i class="${fileTypeIcon} me-2"></i>
                    <strong>${file.fileName}</strong>
                </td>
                <td><span class="badge bg-info">${file.fileType.split('/').pop().toUpperCase()}</span></td>
                <td>${file.fileSize}</td>
                <td>${file.uploadedBy}</td>
                <td><small>${file.uploadDate}</small></td>
                <td><span class="badge ${statusBadgeClass}">${fileStatus}</span></td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    
    // Add summary footer
    const uploadedCount = window.uploadedFilesMetadata.filter(f => f.fileId && !f.fileId.startsWith('temp_')).length;
    const pendingCount = window.uploadedFilesMetadata.filter(f => f.fileId && f.fileId.startsWith('temp_')).length;
    
    html += `
        <div class="d-flex justify-content-between align-items-center mt-2 p-2 bg-light rounded">
            <div>
                <span class="badge bg-primary me-2">Total: ${window.uploadedFilesMetadata.length}</span>
                <span class="badge bg-success me-2">Uploaded: ${uploadedCount}</span>
                ${pendingCount > 0 ? `<span class="badge bg-warning">Pending: ${pendingCount}</span>` : ''}
            </div>
            <small class="text-muted">Last updated: ${new Date().toLocaleTimeString()}</small>
        </div>
    `;
    
    metadataContainer.html(html);
}

/**
 * Get file type icon based on MIME type
 */
function getFileTypeIcon(fileType) {
    if (!fileType) return 'ti ti-file';
    
    if (fileType.includes('pdf')) return 'ti ti-file-text';
    if (fileType.includes('word') || fileType.includes('document')) return 'ti ti-file-word';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'ti ti-file-spreadsheet';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'ti ti-file-powerpoint';
    if (fileType.includes('image')) return 'ti ti-photo';
    if (fileType.includes('video')) return 'ti ti-video';
    if (fileType.includes('audio')) return 'ti ti-music';
    if (fileType.includes('zip') || fileType.includes('compressed')) return 'ti ti-file-zip';
    if (fileType.includes('csv')) return 'ti ti-file-spreadsheet';
    if (fileType.includes('text')) return 'ti ti-file-text';
    
    return 'ti ti-file';
}

// =============================================
// INITIALIZATION
// =============================================

$(document).ready(function () {
    // --------------------------
    // Initialize with edit data if available
    // --------------------------
    function initializeEditData() {
        if (!window.isEdit || !window.documentData) return;

        // Initialize folders if exists
        if (window.documentData.folderId) {
            window.selectedFolders = [{
                id: window.documentData.folderId._id || window.documentData.folderId,
                name: window.documentData.folderId.name || 'Selected Folder'
            }];
            $('#selectedFolderId').val(window.documentData.folderId._id || window.documentData.folderId);
        }

        // Initialize metadata if exists
        if (window.documentData.metadata) {
            populateMetadataFields(window.documentData.metadata);
        }

        // Initialize uploaded files metadata if editing
        if (window.documentData.files && window.documentData.files.length > 0) {
            window.uploadedFilesMetadata = window.documentData.files.map(file => ({
                fileName: file.originalName || file.name || 'Unknown',
                fileType: file.mimetype || file.type || 'Unknown',
                fileSize: formatFileSize(file.size || 0),
                uploadedBy: file.uploadedBy?.name || 'Unknown',
                uploadDate: file.createdAt ? new Date(file.createdAt).toLocaleString() : 'Unknown',
                fileId: file._id || file.id
            }));
            updateMetadataDisplay();
        }
    }

    // --------------------------
    // Populate metadata fields
    // --------------------------
    function populateMetadataFields(metadata) {
        if (metadata.fileName) {
            $('input[name="metadata[fileName]"]').val(metadata.fileName);
        }
    }

    // --------------------------
    // Summernote
    // --------------------------
    $('.summernote').summernote({
        height: 200,
        callbacks: {
            onChange: function (contents) {
                $('#summernote').val(contents);
            }
        }
    });

    // --------------------------
    // Select2
    // --------------------------
    $('.select2').select2();

    // --------------------------
    // Datepicker
    // --------------------------
    $('.datetimepicker').datetimepicker({
        format: 'DD-MM-YYYY',
        useCurrent: false
    });

    // --------------------------
    // Date Restrictions for Compliance
    // --------------------------
    setupEnhancedDateRestrictions();

    // --------------------------
    // Compliance radio buttons
    // --------------------------
    $('#complianceSwitch').change(function () {
        if ($(this).is(':checked')) {
            $('#expiryDateContainer').show();
            $('input[name="expiryDate"]').prop('required', true);
        } else {
            $('#expiryDateContainer').hide();
            $('input[name="expiryDate"]').prop('required', false);
        }
    });

    // --------------------------
    // Metadata modal
    // --------------------------
    $('#metadataForm').on('submit', function (e) {
        e.preventDefault();
        const formData = $(this).serializeArray();
        const metadata = {};
        formData.forEach(item => metadata[item.name] = item.value);

        $('#metadataInput').val(JSON.stringify(metadata));
        $('#metadataDisplay').val(metadata.fileName + ' - ' + metadata.fileDescription);
        $('#metadata-modal').modal('hide');
    });

    // --------------------------
    // Toggle Create Folder Button
    // --------------------------
    function toggleCreateFolderBtn() {
        const projectSelected = !!$('#projectName').val() && $('#projectName').val() !== 'all';
        const departmentSelected = !!$('#department').val() && $('#department').val() !== 'all';
        const isEnabled = projectSelected && departmentSelected;
    
        $('#createFolderBtn')
            .prop('disabled', !isEnabled)
            .css({
                'opacity': isEnabled ? '1' : '0.5',
                'cursor': isEnabled ? 'pointer' : 'not-allowed'
            })
            .attr('title', isEnabled ? 'Create new folder' : 'Please select both Project and Department');
    
        if (projectSelected && departmentSelected) {
            $('#uploadBox').css({ 'pointer-events': '', 'opacity': '' });
        } else {
            $('#uploadBox').css({ 'pointer-events': 'none', 'opacity': 0.6 });
        }
    }

    // --------------------------
    // Load Folders
    // --------------------------
    async function loadFolders(rootId = null, parentPath = []) {
        const departmentId = $('#department').val();
        const projectId = $('#projectName').val();

        if ((!projectId || projectId === 'all') && (!departmentId || departmentId === 'all')) {
            $('#folderContainer').empty();
            window.selectedFolders = [];
            $('#selectedFolderId').val('');
            updateDirectoryPath();
            return;
        }

        const query = new URLSearchParams();
        if (departmentId && departmentId !== 'all') query.append('departmentId', departmentId);
        if (projectId && projectId !== 'all') query.append('projectId', projectId);
        if (rootId !== null && rootId !== undefined) {
            query.append('rootId', rootId);
        }

        try {
            const res = await fetch(`/api/folders/tree/structure?${query.toString()}`);
            const data = await res.json();
            if (!data.success) return;

            let foldersToRender = [];

            if (departmentId && departmentId !== 'all') {
                if (rootId === null || rootId === undefined) {
                    const allFolders = flattenTree(data.tree);
                    const childFolderIds = new Set();
                    data.tree.forEach(folder => {
                        if (folder.children) {
                            folder.children.forEach(child => {
                                childFolderIds.add(child._id);
                            });
                        }
                    });

                    foldersToRender = data.tree.filter(folder => {
                        if (folder.parent) {
                            const parentExists = data.tree.some(f => f._id === folder.parent);
                            const isChild = childFolderIds.has(folder._id);
                            return !isChild && !parentExists;
                        }
                        return true;
                    });

                    if (foldersToRender.length === 0) {
                        foldersToRender = data.tree || [];
                    }
                } else {
                    const foundFolder = findFolderInTree(data.tree, rootId);
                    if (foundFolder) {
                        foldersToRender = foundFolder.children || [];
                    } else {
                        foldersToRender = [];
                    }
                }
            } else if (projectId && projectId !== 'all' && !departmentId) {
                if (rootId === null || rootId === undefined) {
                    const allFolders = flattenTree(data.tree);
                    const rootFolderIds = new Set();
                    data.tree.forEach(folder => {
                        rootFolderIds.add(folder._id);
                    });

                    foldersToRender = allFolders.filter(folder => {
                        if (folder.parent) {
                            const parentExists = rootFolderIds.has(folder.parent);
                            const isRoot = rootFolderIds.has(folder._id);
                            return parentExists && !isRoot;
                        }
                        return false;
                    });

                    if (foldersToRender.length === 0) {
                        foldersToRender = [];
                    }
                } else {
                    const foundFolder = findFolderInTree(data.tree, rootId);
                    foldersToRender = foundFolder?.children || [];
                }
            } else {
                foldersToRender = rootId
                    ? (data.tree[0]?.children || [])
                    : (data.tree || []);
            }

            function flattenTree(tree) {
                let result = [];
                tree.forEach(folder => {
                    result.push(folder);
                    if (folder.children && folder.children.length > 0) {
                        result = result.concat(flattenTree(folder.children));
                    }
                });
                return result;
            }

            function findFolderInTree(tree, folderId) {
                for (const folder of tree) {
                    if (folder._id === folderId) return folder;
                    if (folder.children && folder.children.length > 0) {
                        const found = findFolderInTree(folder.children, folderId);
                        if (found) return found;
                    }
                }
                return null;
            }

            const container = $('#folderContainer').empty();
            let foundSelectedFolder = false;

            foldersToRender.forEach((folder, index) => {
                const subCount = folder.children?.length || 0;
                const folderCard = $(`
                <div class="folder-card" style="width:80px; cursor:pointer;">
                    <div class="fldricon">
                        <img src="/img/icons/folder.png" alt="${folder.name}">
                        ${subCount ? `<span class="badge bg-info">${subCount}</span>` : ''}
                    </div>
                    <div class="fldrname text-truncate" title="${folder.name}">${folder.name}</div>
                    ${subCount ? `<span class="badge">${subCount}</span>` : ''}
                </div>
            `);

                folderCard.data('folder', folder);

                const isSelectedFolder = window.isEdit &&
                    window.documentData &&
                    window.documentData.folderId &&
                    (folder._id === window.documentData.folderId._id || folder._id === window.documentData.folderId);

                if (isSelectedFolder) {
                    folderCard.addClass('active border-primary');
                    window.selectedFolders = [...parentPath, { id: folder._id, name: folder.name }];
                    $('#selectedFolderId').val(folder._id);
                    foundSelectedFolder = true;
                }

                folderCard.on('click', function () {
                    $('.folder-card').removeClass('active border-primary').addClass('border');
                    folderCard.addClass('active border-primary');

                    window.selectedFolders = [...parentPath, { id: folder._id, name: folder.name }];
                    $('#selectedFolderId').val(folder._id);
                    updateDirectoryPath();
                    updateFolderBreadcrumb();
                });

                if (subCount > 0) {
                    folderCard.on('dblclick', async function () {
                        const newPath = [...parentPath, { id: folder._id, name: folder.name }];
                        await loadFolders(folder._id, newPath);
                        updateFolderBreadcrumb();
                    });
                }

                container.append(folderCard);
            });

            if (!window.isEdit && (rootId === null || rootId === undefined)) {
                const projectSelected = $('#projectName').val() && $('#projectName').val() !== 'all';
                const departmentSelected = departmentId && departmentId !== 'all';
                const isEnabled = projectSelected && departmentSelected;
            
                const addFolderBtn = $(`
                    <button
                        type="button"
                        class="btn btn-sm btn-outline-primary ms-2"
                        id="createFolderBtn"
                        data-bs-toggle="modal"
                        data-bs-target="#folder-modal"
                        ${!isEnabled ? 'disabled' : ''}
                        style="
                            height: 36px;
                            padding: 0.25rem 0.75rem;
                            white-space: nowrap;
                            align-self: center;
                            ${!isEnabled ? 'opacity: 0.5; cursor: not-allowed;' : ''}
                        "
                    >
                        <i class="ti ti-plus"></i> Folder
                    </button>
                `);
            
                if (!isEnabled) {
                    addFolderBtn.attr('title', 'Please select both Project and Department to create a folder');
                }
            
                container.append(addFolderBtn);
            }

            if (!rootId && !window.isEdit && !foundSelectedFolder && foldersToRender.length > 0) {
                const firstFolder = foldersToRender[0];
                window.selectedFolders = [{
                    id: firstFolder._id,
                    name: firstFolder.name
                }];
                $('#selectedFolderId').val(firstFolder._id);
                updateDirectoryPath();
                updateFolderBreadcrumb();
            }

            updateDirectoryPath();
            updateFolderBreadcrumb();

            if (foldersToRender.length === 0 && !window.isEdit) {
                let message = 'No folders found';
                if (projectId && projectId !== 'all' && !departmentId) {
                    message = 'No sub-folders found. Please select a department to see root folders.';
                } else if (departmentId && departmentId !== 'all' && rootId) {
                    message = 'No sub-folders found in this folder.';
                }

                container.append(`
                <div class="text-center text-muted p-4 w-100">
                    <i class="fas fa-folder-open fa-3x mb-2"></i>
                    <p>${message}</p>
                    ${!window.isEdit && (departmentId && departmentId !== 'all' && !rootId) ? '<small>Create a new folder using the + button above</small>' : ''}
                </div>
            `);
            }

        } catch (err) {
            console.error("Error loading folders:", err);
            showToast('Error loading folders: ' + err.message, 'error');
        }
    }

    // --------------------------
    // Update Folder Breadcrumb
    // --------------------------
    function updateFolderBreadcrumb() {
        const breadcrumbNav = document.querySelector('.breadcrumb-nav');
        if (!breadcrumbNav) return;

        const projectText = $('#projectName option:selected').text();
        const departmentText = $('#department option:selected').text();
        const folders = window.selectedFolders || [];

        let html = '<i class="ti ti-folder" style="color: var(--primary-blue); font-size: 1rem;"></i>';

        const pathSegments = [];

        if (projectText && projectText !== '-- Select Project Name --') {
            pathSegments.push({ name: projectText, type: 'project' });
        }

        if (departmentText && departmentText !== '-- Select Department --') {
            pathSegments.push({ name: departmentText, type: 'department' });
        }

        folders.forEach(folder => {
            pathSegments.push({ name: folder.name, type: 'folder', id: folder.id });
        });

        pathSegments.forEach((segment, index) => {
            if (index < pathSegments.length - 1) {
                html += `<a href="javascript:void(0)" class="breadcrumb-link" data-type="${segment.type}" data-id="${segment.id || ''}">${segment.name}</a>`;
                html += '<span class="breadcrumb-separator"> > </span>';
            } else {
                html += `<span class="active">${segment.name}</span>`;
            }
        });

        breadcrumbNav.innerHTML = html;

        breadcrumbNav.querySelectorAll('.breadcrumb-link').forEach(link => {
            link.addEventListener('click', async function(e) {
                e.preventDefault();
                const type = this.dataset.type;
                const id = this.dataset.id;

                if (type === 'folder' && id) {
                    const index = window.selectedFolders.findIndex(f => f.id === id);
                    if (index !== -1) {
                        const newPath = window.selectedFolders.slice(0, index + 1);
                        window.selectedFolders = newPath;
                        $('#selectedFolderId').val(id);
                        await loadFolders(id, newPath);
                        updateDirectoryPath();
                        updateFolderBreadcrumb();
                    }
                } else if (type === 'project' || type === 'department') {
                    window.selectedFolders = [];
                    $('#selectedFolderId').val('');
                    await loadFolders(null, []);
                    updateDirectoryPath();
                    updateFolderBreadcrumb();
                }
            });
        });
    }

    // --------------------------
    // Folder Modal
    // --------------------------
    $('#folder-modal').on('show.bs.modal', function () {
        const projectText = $('#projectName option:selected').text();
        const projectId = $('#projectName').val();
        const departmentText = $('#department option:selected').text();
        const departmentId = $('#department').val();
        const folders = window.selectedFolders || [];

        const parentFolderSelect = $('#parentFolder');
        parentFolderSelect.empty();

        parentFolderSelect.append(
            new Option('-- Top-Level (No Parent) --', '', false, false)
        );

        if (projectId && projectId !== 'all' && departmentId && departmentId !== 'all') {
            const isSelected = folders.length === 0;
            parentFolderSelect.append(
                new Option(`${projectText} / ${departmentText}`, 'root', false, isSelected)
            );
        }

        folders.forEach((f, i) => {
            const fullPath = `${folders.slice(0, i + 1).map(ff => ff.name).join(' / ')}`;
            const isSelected = i === folders.length - 1;
            parentFolderSelect.append(new Option(fullPath, f.id, false, isSelected));
        });

        parentFolderSelect.trigger('change');
    });

    // --------------------------
    // Handle folder creation
    // --------------------------
    $('#createFolderForm').on('submit', async function (e) {
        e.preventDefault();

        const folderName = $('#folderName').val().trim();
        const projectId = $('#projectName').val();
        const departmentId = $('#department').val();
        let parentId = $('#parentFolder').val();

        if (!parentId || parentId === '') {
            parentId = null;
        }
        else if (parentId === 'root') parentId = null;

        if (!folderName || !projectId || !departmentId) {
            showToast('Please select Project, Department, and provide folder name.', 'error');
            return;
        }

        try {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: folderName, parentId, projectId, departmentId })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.message || 'Could not create folder');

            $('#folder-modal').modal('hide');
            $('#createFolderForm')[0].reset();

            let newPath = [];

            if (parentId) {
                const parentIndex = window.selectedFolders.findIndex(f => f.id === parentId);
                if (parentIndex >= 0) {
                    newPath = window.selectedFolders.slice(0, parentIndex + 1);
                } else {
                    newPath = [...window.selectedFolders];
                    const parentName = $('#parentFolder option:selected').text();
                    if (parentName) {
                        newPath.push({ id: parentId, name: parentName });
                    }
                }
            }

            await loadFolders(parentId, newPath);
            
            // Refresh the dynamic tree
            await buildDynamicFolderTree();

            const container = $('#folderContainer');
            const newFolderCard = container.find('.folder-card').filter(function () {
                return $(this).find('.fldrname').text() === folderName;
            }).first();

            if (newFolderCard.length) {
                newFolderCard.trigger('click');
            }

            window.selectedFolders = newPath;
            $('#selectedFolderId').val(parentId);
            updateDirectoryPath();
            updateFolderBreadcrumb();

            showToast('Folder created successfully!', 'success');
        } catch (err) {
            showToast(err.message || 'Something went wrong while creating the folder.', 'error');
        }
    });

    // --------------------------
    // File Upload Handling
    // --------------------------
    const uploadBox = document.getElementById("uploadBox");
    const fileInput = document.getElementById("fileInput");
    const fileList = document.getElementById("fileList");
    window.uploadedFileIds = [];

    const trashModal = new bootstrap.Modal(document.getElementById("trashdoc-modal"));
    const trashModalTitle = document.querySelector("#trashdocLabel");
    const trashModalBody = document.querySelector("#trashdoc-modal .modal-body");
    const confirmTrashBtn = document.getElementById("confirm-trash-folder");

    let fileToDelete = null;

    uploadBox.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", async (e) => {
        await handleFileUpload(e.target.files);
    });

    uploadBox.addEventListener("dragover", e => {
        e.preventDefault();
        uploadBox.classList.add("dragover");
    });
    uploadBox.addEventListener("dragleave", () => uploadBox.classList.remove("dragover"));
    uploadBox.addEventListener("drop", async e => {
        e.preventDefault();
        uploadBox.classList.remove("dragover");
        await handleFileUpload(e.dataTransfer.files);
    });

    async function handleFileUpload(files) {
        const folderId = document.getElementById('selectedFolderId').value;
        if (!folderId) {
            showToast("Please select a folder.", 'info');
            return;
        }
    
        const filesArray = Array.from(files);
    
        for (const file of filesArray) {
            const tempId = 'temp_' + Date.now() + Math.random().toString(36).substring(2, 8);
    
            const fileItem = document.createElement("div");
            fileItem.className = "file-item col-sm-5 mb-3 p-3 border rounded";
            fileItem.setAttribute("data-file-id", tempId);
    
            fileItem.innerHTML = `
                <div class="file-info d-flex align-items-center">
                    <i class="fa-solid fa-file fa-2x me-3"></i>
                    <div class="flex-grow-1">
                        <h6 class="mb-0 text-truncate">${file.name}</h6>
                        <small class="text-muted">${(file.size / 1024 / 1024).toFixed(2)} MB</small>
                    </div>
                </div>
                <div class="file-progress mt-2">
                    <div class="progress">
                        <div class="progress-bar bg-success" role="progressbar" style="width:0%">0%</div>
                    </div>
                </div>
                <button type="button" class="remove-btn btn btn-sm btn-danger mt-2" data-file-id="${tempId}" disabled>
                 Remove
                </button>
            `;
            fileList.appendChild(fileItem);
    
            const progressBar = fileItem.querySelector(".progress-bar");
            const removeBtn = fileItem.querySelector(".remove-btn");
    
            try {
                const formData = new FormData();
                formData.append('file', file);
    
                progressBar.style.width = "50%";
                progressBar.textContent = "Uploading...";
    
                const res = await fetch(`/api/tempfiles/upload/${folderId}`, { 
                    method: 'POST', 
                    body: formData 
                });
                
                const data = await res.json();
    
                if (!data.success) {
                    fileItem.remove();
                    
                    // Remove from metadata if it was added
                    window.uploadedFilesMetadata = window.uploadedFilesMetadata.filter(f => f.fileId !== tempId);
                    updateMetadataDisplay();
                    
                    showToast(data.message || "Upload failed", "error");
                    continue;
                }
    
                const uploadedFile = data.files[0];
                const fileId = uploadedFile.fileId;
                
                window.uploadedFileIds.push(fileId);
                fileItem.setAttribute("data-file-id", fileId);
                removeBtn.setAttribute("data-file-id", fileId);
                removeBtn.disabled = false;
    
                fileItem.addEventListener('dblclick', () => {
                    window.location.href = `/folders/view/${fileId}`;
                });
    
                progressBar.style.width = "100%";
                progressBar.textContent = "Uploaded";
                progressBar.classList.remove("bg-success");
                progressBar.classList.add("bg-success");
    
                // Update metadata - replace temp entry with actual file ID
                const tempIndex = window.uploadedFilesMetadata.findIndex(f => f.fileId === tempId);
                if (tempIndex !== -1) {
                    window.uploadedFilesMetadata[tempIndex].fileId = fileId;
                } else {
                    // Add new metadata if temp wasn't added
                    window.uploadedFilesMetadata.push({
                        fileName: file.name,
                        fileType: file.type || 'Unknown',
                        fileSize: formatFileSize(file.size),
                        uploadedBy: 'Current User',
                        uploadDate: new Date().toLocaleString(),
                        fileId: fileId
                    });
                }
                
                updateMetadataDisplay();
                
                showToast(`${file.name} uploaded successfully!`, "success");
    
            } catch (err) {
                console.error("Upload failed:", err);
                
                fileItem.remove();
                
                // Remove from metadata
                window.uploadedFilesMetadata = window.uploadedFilesMetadata.filter(f => f.fileId !== tempId);
                updateMetadataDisplay();
                
                showToast(`Failed to upload ${file.name}: ${err.message || "Network error"}`, "error");
                
                continue;
            }
        }
    }

    // Remove file handler
    fileList.addEventListener("click", function (e) {
        const btn = e.target.closest(".remove-btn");
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();

        fileToDelete = btn.closest(".file-item");
        const fileId = btn.getAttribute("data-file-id");
        if (!fileToDelete || !fileId) return;

        trashModalTitle.innerHTML = `
    <img src="/img/icons/bin.png" class="me-2" style="width:24px; height:24px;">
    Delete File
`;
        trashModalBody.innerHTML = `
    You are about to delete <strong>"${fileToDelete.querySelector("h6").textContent}"</strong>.<br>
    This action cannot be undone. Are you sure you want to proceed?
`;

        trashModal.show();
    });

    confirmTrashBtn.addEventListener("click", async () => {
        if (!fileToDelete) return;

        const fileId = fileToDelete.getAttribute("data-file-id");

        try {
            if (window.uploadedFileIds.includes(fileId)) {
                const res = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
                const data = await res.json();
                if (!data.success) throw new Error(data.message || "Delete failed");
                window.uploadedFileIds = window.uploadedFileIds.filter(id => id !== fileId);
                
                // Remove from metadata
                window.uploadedFilesMetadata = window.uploadedFilesMetadata.filter(f => f.fileId !== fileId);
                updateMetadataDisplay();
            }

            fileToDelete.remove();
            fileToDelete = null;
            trashModal.hide();
            showToast("File removed successfully!", 'success');

        } catch (err) {
            showToast("Error deleting file: " + err.message, 'error');
            trashModal.hide();
        }
    });

    // --------------------------
    // Select2 Initializations
    // --------------------------
    $('#parentFolder').select2({
        dropdownParent: $('#folder-modal'),
        width: '100%',
        placeholder: "-- Root (No Parent) --",
        allowClear: true
    });

    $("#projectName").select2({
        placeholder: "-- Select Project Name --",
        allowClear: true,
        ajax: {
            delay: 300,
            transport: function (params, success, failure) {
                const search = params.data.term || "";
                $.ajax({
                    url: `/api/projects?search=${encodeURIComponent(search)}`,
                    type: "GET",
                    success: function (res) {
                        let data = res.data || [];
                        success(data);
                    },
                    error: failure
                });
            },
            processResults: function (data) {
                return {
                    results: data.map(project => ({
                        id: project._id,
                        text: project.projectName
                    }))
                };
            }
        }
    });

    if (!window.isEdit && window.selectedProject && window.selectedProject.id) {
        const userProj = window.selectedProject;
        const option = new Option(userProj.name, userProj.id, true, true);
        $('#projectName').append(option).trigger('change');
    }

    $("#department").select2({
        placeholder: "-- Select Department --",
        allowClear: true,
        ajax: {
            url: '/api/departments/search',
            dataType: 'json',
            delay: 250,
            data: function (params) {
                return { search: params.term || '', page: params.page || 1, limit: 10 };
            },
            processResults: function (data, params) {
                params.page = params.page || 1;
                let results = data.data.map(dep => ({ id: dep._id, text: dep.name }));
                return { results, pagination: { more: data.pagination.more } };
            },
            cache: true
        }
    });

    if (window.isEdit && window.documentData && window.documentData.department) {
        const departmentOption = new Option(
            window.documentData.department.name,
            window.documentData.department._id,
            true,
            true
        );
        $('#department').append(departmentOption).trigger('change');
    }

    function initializeDonorSelect2() {
        $('#documentDonor').select2({
            placeholder: '-- Select Donor Name --',
            allowClear: true,
            ajax: {
                url: '/api/user/search',
                dataType: 'json',
                delay: 250,
                data: function (params) {
                    const projectId = $('#projectName').val();
                    return {
                        search: params.term || '',
                        page: params.page || 1,
                        limit: 10,
                        projectId: projectId,
                        profile_type: 'donor'
                    };
                },
                processResults: function (data, params) {
                    params.page = params.page || 1;
                    const results = data.users.map(u => ({ id: u._id, text: u.name }));
                    return {
                        results,
                        pagination: { more: params.page * 10 < data.pagination.total }
                    };
                },
                cache: true
            },
            minimumInputLength: 0
        });

        if (window.isEdit && window.documentData && window.documentData.documentDonor) {
            const donorOption = new Option(
                window.documentData.documentDonor.name,
                window.documentData.documentDonor._id,
                true,
                true
            );
            $('#documentDonor').append(donorOption).trigger('change');
        }
    }

    function initializeVendorSelect2() {
        $('#documentVendor').select2({
            placeholder: '-- Select Vendor Name --',
            allowClear: true,
            ajax: {
                url: '/api/user/search',
                dataType: 'json',
                delay: 250,
                data: function (params) {
                    const projectId = $('#projectName').val();
                    return {
                        search: params.term || '',
                        page: params.page || 1,
                        limit: 10,
                        projectId: projectId,
                        profile_type: 'vendor'
                    };
                },
                processResults: function (data, params) {
                    params.page = params.page || 1;
                    const results = data.users.map(u => ({ id: u._id, text: u.name }));
                    return {
                        results,
                        pagination: { more: params.page * 10 < data.pagination.total }
                    };
                },
                cache: true
            },
            minimumInputLength: 0
        });

        if (window.isEdit && window.documentData && window.documentData.documentVendor) {
            const vendorOption = new Option(
                window.documentData.documentVendor.name,
                window.documentData.documentVendor._id,
                true,
                true
            );
            $('#documentVendor').append(vendorOption).trigger('change');
        }
    }

    // --------------------------
    // Date Restrictions
    // --------------------------
    function setupEnhancedDateRestrictions() {
        const today = moment().startOf('day');

        const expiryDatePicker = $('input[name="expiryDate"]').datetimepicker({
            format: 'DD-MM-YYYY',
            useCurrent: false,
            minDate: today
        });

        expiryDatePicker.data("DateTimePicker").disable();

        $('#complianceSwitch').change(function () {
            const expiryPicker = expiryDatePicker.data("DateTimePicker");

            if ($(this).is(':checked')) {
                expiryPicker.enable();
                expiryPicker.minDate(today);
            } else {
                expiryPicker.clear();
                expiryPicker.disable();
            }
        });
    }

    // --------------------------
    // Update Directory Path
    // --------------------------
    function updateDirectoryPath() {
        const projectText = $('#projectName option:selected').text();
        const projectId = $('#projectName').val();
        const folders = window.selectedFolders || [];
    
        const pathSegments = [];
    
        if (projectText && projectText !== '-- Select Project Name --') {
            pathSegments.push({
                text: projectText,
                type: 'project',
                id: projectId
            });
        }
    
        folders.forEach(folder => {
            pathSegments.push({
                text: folder.name,
                type: 'folder',
                id: folder.id
            });
        });
    
        const breadcrumbHtml = pathSegments.map((seg, i) => {
            return `
                <a href="javascript:void(0)"
                   class="dir-link"
                   data-type="${seg.type}"
                   data-id="${seg.id}"
                   data-level="${i}">
                    ${seg.text}
                </a>`;
        }).join(' / ');
    
        $('#uploadDirectoryPath').html(breadcrumbHtml);
    
        $('#uploadDirectoryPath .dir-link').off('click').on('click', async function () {
    
            const type = $(this).data('type');
            const id = $(this).data('id');
            const level = $(this).data('level');
    
            if (type === 'project') {
                window.selectedFolders = [];
                $('#selectedFolderId').val('');
                await loadFolders(null, []);
                updateDirectoryPath();
                updateFolderBreadcrumb();
            }
            else if (type === 'folder') {
                const newPath = window.selectedFolders.slice(0, level);
                window.selectedFolders = newPath;
                $('#selectedFolderId').val(id);
                await loadFolders(id, newPath);
                updateDirectoryPath();
                updateFolderBreadcrumb();
            }
        });
    }

    // --------------------------
    // Event Handlers
    // --------------------------
    $('#projectName, #department').on('change select2:select select2:clear', function () {
        window.selectedFolders = [];
        $('#selectedFolderId').val('');
        toggleCreateFolderBtn();
        loadFolders();
        buildDynamicFolderTree(); // Build the dynamic tree
        updateDirectoryPath();
        updateFolderBreadcrumb();
        initializeDonorSelect2();
        initializeVendorSelect2();
    });

    $('#projectName').on('change', function () {
        const projectId = $(this).val();
        if (!projectId || projectId === 'all') {
            $('#department').val(null).trigger('change');
            $('#documentDonor').val(null).trigger('change');
            $('#documentVendor').val(null).trigger('change');
        }

        initializeDonorSelect2();
        initializeVendorSelect2();
    });

    // --------------------------
    // Form Submission
    // --------------------------
    $('#documentForm').on('submit', async function (e) {
        e.preventDefault();
    
        const submitBtn = $('#submitBtn');
    
        if (submitBtn.prop('disabled')) return;
    
        if (!validateForm()) return;
    
        $('#summernote').val($('.summernote').summernote('code'));
    
        submitBtn.prop('disabled', true).html(
            '<span class="spinner-border spinner-border-sm" role="status"></span> ' +
            (window.isEdit ? "Updating..." : "Adding...")
        );
    
        try {
            const fileIdsInput = document.createElement('input');
            fileIdsInput.type = 'hidden';
            fileIdsInput.name = 'fileIds';
            fileIdsInput.value = JSON.stringify(window.uploadedFileIds || []);
            this.appendChild(fileIdsInput);
    
            const rawFileInput = document.getElementById('fileInput');
            if (rawFileInput) {
                rawFileInput.removeAttribute('required');
                rawFileInput.value = '';
            }
    
            const formData = new FormData(this);
            const url = window.isEdit
                ? `/api/documents/${window.documentId}`
                : `/api/documents`;
            const method = window.isEdit ? 'PATCH' : 'POST';
    
            const response = await fetch(url, { method, body: formData });
    
            if (!response.ok) {
                let serverMessage = `HTTP ${response.status}`;
    
                try {
                    const json = await response.json();
                    if (json?.message) serverMessage = json.message;
                    else serverMessage = JSON.stringify(json);
                } catch {
                    try {
                        const text = await response.text();
                        if (text) serverMessage = text;
                    } catch {
                        // Use default
                    }
                }
    
                throw new Error(serverMessage);
            }
    
            const data = await response.json();
    
            if (!data.success) {
                throw new Error(data.message || "Unknown server error");
            }
    
            const doc = data.data.document;
            if (doc?.metadata?.fileName) {
                document.getElementById('successFileName').textContent =
                    doc.metadata.fileName;
            }
    
            const modalElement = document.getElementById('data-success-modal');
            const successModal = new bootstrap.Modal(modalElement);
            
            successModal.show();
    
            let redirectTimer = setTimeout(() => {
                successModal.hide();
            }, 2000);
    
            modalElement.addEventListener('hidden.bs.modal', function onHidden() {
                clearTimeout(redirectTimer);
                modalElement.removeEventListener('hidden.bs.modal', onHidden);
                
                if (!window.isEdit) {
                    window.location.href = '/documents/list';
                } else {
                    window.location.href = '/documents/list';
                }
            }, { once: false });
    
            modalElement.addEventListener('hide.bs.modal', function() {
                clearTimeout(redirectTimer);
            }, { once: true });
    
            submitBtn
                .prop('disabled', false)
                .html(window.isEdit ? "Update Document" : "Add Document");
    
        } catch (error) {
            console.error('Form submission error:', error);
    
            showToast(error.message || "An unknown error occurred.", "error");
    
            submitBtn
                .prop('disabled', false)
                .html(window.isEdit ? "Update Document" : "Add Document");
        }
    });

    // --------------------------
    // Form Validation
    // --------------------------
    function validateForm() {
        const projectName = $('#projectName').val();
        const department = $('#department').val();
        const folderId = $('#selectedFolderId').val();

        if (!window.isEdit && window.uploadedFileIds.length === 0) {
            showToast('Please upload at least one file.', 'error');
            document.getElementById('uploadBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
            return false;
        }

        if (!projectName || projectName === 'all') {
            showToast('Please select a project name.', 'error');
            $('#projectName').focus();
            return false;
        }

        if (!department || department === 'all') {
            showToast('Please select a department.', 'error');
            $('#department').focus();
            return false;
        }

        if (!folderId) {
            showToast('Please select a folder.', 'error');
            $('#folderContainer').scrollIntoView({ behavior: 'smooth', block: 'center' });
            return false;
        }

        return true;
    }

    // --------------------------
    // Initialize Everything
    // --------------------------
    initializeEditData();
    toggleCreateFolderBtn();
    loadFolders();
    buildDynamicFolderTree();
    updateDirectoryPath();
    updateFolderBreadcrumb();
    initializeDonorSelect2();
    initializeVendorSelect2();
});