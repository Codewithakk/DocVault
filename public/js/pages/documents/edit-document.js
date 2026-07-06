// document-edit.js - Complete Fixed Version
window.selectedFolders = [];
window.selectedProject = { id: null, name: null };
window.selectedDepartment = { id: null, name: null };
window.selectedProjectManager = { id: null, name: null };
window.uploadedFileIds = [];
window.originalFormData = {};
window.existingFileIds = []; // Track existing files

$(document).ready(function () {
    initializeEditDocument();
});

function initializeEditDocument() {
    console.log('🔄 Initializing edit document...', {
        documentId: window.documentId,
        documentData: window.documentData
    });

    // Verify we have the required data
    if (!window.documentId || window.documentId === 'undefined' || !window.documentData) {
        console.error('❌ Missing required data:', {
            documentId: window.documentId,
            documentData: window.documentData
        });

        // Try to get data from DOM as last resort
        const hiddenId = document.getElementById('hiddenDocumentId');
        const hiddenData = document.getElementById('hiddenDocumentData');

        if (hiddenId && hiddenId.value) {
            window.documentId = hiddenId.value;
            console.log('📝 Found documentId from hidden field:', window.documentId);
        }

        if (hiddenData) {
            try {
                const documentDataStr = hiddenData.getAttribute('data-document');
                if (documentDataStr) {
                    window.documentData = JSON.parse(decodeURIComponent(documentDataStr));
                    console.log('📝 Found documentData from hidden field:', window.documentData);
                }
            } catch (e) {
                console.error('❌ Failed to parse hidden data:', e);
            }
        }

        if (!window.documentId || !window.documentData) {
            showToast('Failed to load document data. Please refresh the page.', 'error');
            return;
        }
    }

    // Initialize existing file IDs
    if (window.documentData.files && window.documentData.files.length) {
        window.existingFileIds = window.documentData.files.map(file => file._id);
        window.uploadedFileIds = [...window.existingFileIds]; // Start with existing files
    }

    // Store original form data for change detection
    storeOriginalFormData();

    initializeBasicComponents();
    initializeFormData();
    initializeEditFormSubmission();
    initializeFileUpload();
    initializeExistingFileHandlers();
}

function storeOriginalFormData() {
    // Store original values for change detection
    window.originalFormData = {
        documentName: window.documentData.documentName || '',
        documentType: window.documentData.documentType || '',
        documentStatus: window.documentData.documentStatus || '',
        documentPriority: window.documentData.documentPriority || '',
        documentReference: window.documentData.documentReference || '',
        documentVersion: window.documentData.documentVersion || '',
        project: window.documentData.project?._id || '',
        department: window.documentData.department?._id || '',
        projectManager: window.documentData.projectManager?._id || '',
        documentDonor: window.documentData.documentDonor?._id || '',
        documentVendor: window.documentData.documentVendor?._id || '',
        documentDate: window.documentData.documentDate || '',
        tags: window.documentData.tags ? window.documentData.tags.join(', ') : '',
        description: window.documentData.description || '',
        compliance: window.documentData.compliance || (window.documentData.compliance?.isCompliance ? 'yes' : 'no'),
        expiryDate: window.documentData.expiryDate || (window.documentData.compliance?.expiryDate || ''),
        comment: window.documentData.comment || '',
        link: window.documentData.link || '',
        folderId: window.documentData.folderId?._id || window.documentData.folderId || '',
        // metadata: window.documentData.metadata ? JSON.stringify(window.documentData.metadata) : '{}',
        metadataFileName: window.documentData.metadata?.fileName || '', 
        signature: window.documentData.signature || ''
    };
}
function showSuccessModal(documentData) {
    try {
        const modalElement = document.getElementById('data-success-modal');
        const fileNameElement = document.getElementById('successFileName');
        const modalTitle = document.querySelector('#data-success-modal .fs-24');
        const modalSubtext = document.querySelector('#data-success-modal .fs-20');
        
        // Get document details
        const doc = documentData || window.documentData || {};
        const documentName = doc.documentName || 'Document';
        const documentType = doc.documentType || '';
        const folderName = doc.folderId?.name || '';
        const metadataFileName = doc.metadata?.fileName || '';
        
        // Update modal content
        if (fileNameElement) {
            // Show file name with metadata if available
            let displayName = documentName;
            if (metadataFileName) {
                displayName = `${documentName} (${metadataFileName})`;
            } else if (documentType) {
                displayName = `${documentName} (${documentType})`;
            }
            fileNameElement.textContent = displayName;
        }
        
        if (modalTitle) {
            modalTitle.textContent = 'Your File Updated Successfully';
        }
        
        if (modalSubtext) {
            let subtext = '';
            if (folderName) {
                subtext = `Updated in "${folderName}" folder.You will be redirected to the documents list shortly.`;
            }
            // if (metadataFileName) {
            //     subtext += ` Metadata: "${metadataFileName}"`;
            // }
            modalSubtext.textContent = subtext;
        }

        // Show the modal with static backdrop
        const successModal = new bootstrap.Modal(modalElement, {
            backdrop: 'static',
            keyboard: false
        });
        successModal.show();

        // Handle OK button click
        const okButton = document.getElementById('success-ok-btn');
        if (okButton) {
            const newOkButton = okButton.cloneNode(true);
            okButton.parentNode.replaceChild(newOkButton, okButton);
            
            newOkButton.addEventListener('click', function() {
                successModal.hide();
                window.location.href = '/documents/list';
            });
        }

        const handleModalHidden = function() {
            window.location.href = '/documents/list';
            modalElement.removeEventListener('hidden.bs.modal', handleModalHidden);
        };
        modalElement.addEventListener('hidden.bs.modal', handleModalHidden);

    } catch (error) {
        console.error('❌ Error showing success modal:', error);
        showToast('Document updated successfully!', 'success');
        setTimeout(() => {
            window.location.href = '/documents/list';
        }, 1500);
    }
}
function initializeExistingFileHandlers() {
    // Add event listeners for existing file remove buttons
    document.querySelectorAll('.remove-existing-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const fileId = this.getAttribute('data-file-id');
            const fileName = this.getAttribute('data-file-name');

            // Show confirmation modal
            const trashModal = new bootstrap.Modal(document.getElementById("trashdoc-modal"));
            const trashModalTitle = document.querySelector("#trashdocLabel");
            const trashModalBody = document.querySelector("#trashdoc-modal .modal-body");
            const confirmTrashBtn = document.getElementById("confirm-trash-folder");

            trashModalTitle.innerHTML = `
                <img src="/img/icons/bin.png" class="me-2" style="width:24px; height:24px;">
                Delete File
            `;
            trashModalBody.innerHTML = `
                You are about to delete <strong>"${fileName}"</strong>.<br>
                This action cannot be undone. Are you sure you want to proceed?
            `;

            // Remove previous event listeners and add new one
            confirmTrashBtn.replaceWith(confirmTrashBtn.cloneNode(true));
            const newConfirmBtn = document.getElementById("confirm-trash-folder");

            newConfirmBtn.addEventListener('click', async function () {
                try {
                    const res = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
                    const data = await res.json();

                    if (data.success) {
                        // Remove from uploadedFileIds array
                        window.uploadedFileIds = window.uploadedFileIds.filter(id => id !== fileId);
                        window.existingFileIds = window.existingFileIds.filter(id => id !== fileId);

                        // Remove the file element from DOM
                        const fileElement = document.querySelector(`.file-item[data-file-id="${fileId}"]`);
                        if (fileElement) {
                            fileElement.remove();
                        }

                        trashModal.hide();
                        showToast("File removed successfully!", 'success');

                        // Check if no files left
                        const remainingFiles = document.querySelectorAll('.file-item').length;
                        if (remainingFiles === 0) {
                            document.getElementById('existingFilesList').innerHTML = '<p class="text-muted">No files uploaded</p>';
                        }
                    } else {
                        throw new Error(data.message || "Delete failed");
                    }
                } catch (err) {
                    console.error('❌ Error deleting file:', err);
                    showToast("Error deleting file: " + err.message, 'error');
                    trashModal.hide();
                }
            });

            trashModal.show();
        });
    });
}

function initializeBasicComponents() {
    initializeSummernote();
    initializeSelect2();
    initializeDatepicker();
    initializeComplianceToggle();
    // initializeMetadataModal();
    initializeSignature();
    initializeProjectSelect2();
    initializeDepartmentSelect2();
    initializeProjectManagerSelect2();
    initializeDonorSelect2();
    initializeVendorSelect2();
    initializeFolderManagement();
    initializeEventListeners();
    initializeDateRestrictions();
    $('#projectName, #department').on('change', function () {
        toggleCreateFolderBtn();
    });

    toggleCreateFolderBtn();
}

function initializeFormData() {

    // Set basic form fields
    if (window.documentData.documentName) {
        $('#documentName').val(window.documentData.documentName);
    }

    if (window.documentData.documentType) {
        $('#documentType').val(window.documentData.documentType).trigger('change');
    }

    if (window.documentData.documentStatus) {
        $('#documentStatus').val(window.documentData.documentStatus).trigger('change');
    }

    if (window.documentData.documentPriority) {
        $('#documentPriority').val(window.documentData.documentPriority).trigger('change');
    }

    if (window.documentData.documentReference) {
        $('#documentReference').val(window.documentData.documentReference);
    }

    if (window.documentData.documentVersion) {
        $('#documentVersion').val(window.documentData.documentVersion);
    }

    // Set project
    if (window.documentData.project) {
        const projectName = window.documentData.project.projectName || window.documentData.project.name;
        const projectId = window.documentData.project._id;

        const projectOption = new Option(projectName, projectId, true, true);
        $('#projectName').empty().append(projectOption).trigger('change');
    }

    // Set department
    if (window.documentData.department) {
        const departmentName = window.documentData.department.name;
        const departmentId = window.documentData.department._id;
        const departmentOption = new Option(departmentName, departmentId, true, true);
        $('#department').empty().append(departmentOption).trigger('change');
    }

    // Set project manager
    if (window.documentData.projectManager) {
        const managerName = window.documentData.projectManager.name;
        const managerId = window.documentData.projectManager._id;
        const managerOption = new Option(managerName, managerId, true, true);
        $('#projectManager').empty().append(managerOption).trigger('change');
    }

    // Set donor
    if (window.documentData.documentDonor) {
        const donorName = window.documentData.documentDonor.name;
        const donorId = window.documentData.documentDonor._id;

        const donorOption = new Option(donorName, donorId, true, true);
        $('#documentDonor').empty().append(donorOption).trigger('change');
    }

    // Set vendor
    if (window.documentData.documentVendor) {
        const vendorName = window.documentData.documentVendor.name;
        const vendorId = window.documentData.documentVendor._id;
        const vendorOption = new Option(vendorName, vendorId, true, true);
        $('#documentVendor').empty().append(vendorOption).trigger('change');
    }

    // Set folder data
    if (window.documentData.folderId) {
        const folderId = window.documentData.folderId._id || window.documentData.folderId;
        const folderName = window.documentData.folderId.name || 'Selected Folder';
        window.selectedFolders = [{ id: folderId, name: folderName }];
        $('#selectedFolderId').val(folderId);
    }

    // Set description in summernote
    if (window.documentData.description) {
        $('.summernote').summernote('code', window.documentData.description);
    }

    // Set comments
    if (window.documentData.comment) {
        $('#comment').val(window.documentData.comment);
    }

    // Set compliance - handle both string and object formats
    let complianceValue = 'no';
    if (window.documentData.compliance === 'yes' ||
        (window.documentData.compliance && window.documentData.compliance.isCompliance)) {
        complianceValue = 'yes';
    }

    $(`input[name="compliance"][value="${complianceValue}"]`).prop('checked', true).trigger('change');

    if (complianceValue === 'yes') {
        let expiryDate = '';
        if (window.documentData.expiryDate) {
            expiryDate = new Date(window.documentData.expiryDate).toLocaleDateString('en-GB');
        } else if (window.documentData.compliance && window.documentData.compliance.expiryDate) {
            expiryDate = new Date(window.documentData.compliance.expiryDate).toLocaleDateString('en-GB');
        }
        $('input[name="expiryDate"]').val(expiryDate);
    }

    // Set metadata if exists
    if (window.documentData.metadata) {
        $('#metadataInput').val(JSON.stringify(window.documentData.metadata));
        const fileName = window.documentData.metadata.fileName || '';
        const fileDescription = window.documentData.metadata.fileDescription || '';
        $('#metadataDisplay').val(fileName + (fileName && fileDescription ? ' - ' : '') + fileDescription);
    }

    // Set signature if exists
    if (window.documentData.signature && window.documentData.signature.fileUrl) {
        const signatureUrl = window.documentData.signature.fileUrl;
        $('#signatureData').val(signatureUrl);
        $('#signaturePreview').html(`
        <img src="${signatureUrl}" alt="Signature" style="max-height:140px; max-width:100%; object-fit:contain;">
    `);
        $('#uploadSignBtn').text("Update Signature");

        // Show clear button
        if (!$('#clearSignBtn').length) {
            $('.signupld').append('<button type="button" class="btn btn-warning rounded-pill" id="clearSignBtn">Clear Signature</button>');
        }
    }

    // Set document date
    if (window.documentData.documentDate) {
        const documentDate = new Date(window.documentData.documentDate).toLocaleDateString('en-GB');
        $('input[name="documentDate"]').val(documentDate);
    }

    // Set tags
    if (window.documentData.tags && window.documentData.tags.length) {
        $('input[name="tags"]').val(window.documentData.tags.join(', '));
    }

    // Set link
    if (window.documentData.link) {
        $('input[name="link"]').val(window.documentData.link);
    }

    // Load folders after a short delay to ensure selects are initialized
    setTimeout(() => {
        loadFolders();
        updateDirectoryPath();
    }, 1000);
}
function validateDates() {
    const expiryDate = $('input[name="expiryDate"]').val();
    if (expiryDate && expiryDate.trim() !== '') {
        const formattedExpiry = formatDateForSubmission(expiryDate);
        if (!formattedExpiry) {
            showToast('Please enter a valid expiry date in DD-MM-YYYY format', 'error');
            return false;
        }
    }
    return true;
}
function formatDateForSubmission(dateString) {
    if (!dateString || dateString.trim() === '') return '';
    try {
        // Normalize: change / to -
        let normalized = dateString.replace(/\//g, '-');

        // Validate DD-MM-YYYY format
        const regex = /^(\d{2})-(\d{2})-(\d{4})$/;
        const match = normalized.match(regex);

        if (match) {
            const [_, day, month, year] = match;

            // Build ISO date string
            const isoDate = `${year}-${month}-${day}`;
            const date = new Date(isoDate);

            if (!isNaN(date.getTime())) {
                return date.toISOString();
            }

            return '';
        }
        return '';
    } catch (error) {
        return '';
    }
}


function validateSignature(signatureData) {
    if (!signatureData) return true; // No signature is valid

    // Check if it's a valid base64 image data URL
    const base64Regex = /^data:image\/(png|jpeg|jpg|gif);base64,[A-Za-z0-9+/]+=*$/;
    if (base64Regex.test(signatureData)) {
        return true;
    }

    // Check if it's a valid URL
    const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
    if (urlRegex.test(signatureData)) {
        return true;
    }

    console.error('❌ Invalid signature format:', signatureData.substring(0, 100) + '...');
    return false;
}

function getChangedFormData() {
    const formData = new FormData();
    let hasChanges = false;

    // Helper function to check if value changed
    const valueChanged = (fieldName, currentValue) => {
        const originalValue = window.originalFormData[fieldName];
        return currentValue !== originalValue;
    };

    // Check each field for changes
    const documentName = $('#documentName').val();
    if (valueChanged('documentName', documentName)) {
        formData.append('documentName', documentName);
        hasChanges = true;
    }

    const documentType = $('#documentType').val();
    if (valueChanged('documentType', documentType)) {
        formData.append('documentType', documentType);
        hasChanges = true;
    }

    const documentStatus = $('#documentStatus').val();
    if (valueChanged('documentStatus', documentStatus)) {
        formData.append('documentStatus', documentStatus);
        hasChanges = true;
    }

    const documentPriority = $('#documentPriority').val();
    if (valueChanged('documentPriority', documentPriority)) {
        formData.append('documentPriority', documentPriority);
        hasChanges = true;
    }

    const documentReference = $('#documentReference').val();
    if (valueChanged('documentReference', documentReference)) {
        formData.append('documentReference', documentReference);
        hasChanges = true;
    }

    const documentVersion = $('#documentVersion').val();
    if (valueChanged('documentVersion', documentVersion)) {
        formData.append('documentVersion', documentVersion);
        hasChanges = true;
    }

    const project = $('#projectName').val();
    if (valueChanged('project', project)) {
        formData.append('project', project);
        hasChanges = true;
    }

    const department = $('#department').val();
    if (valueChanged('department', department)) {
        formData.append('department', department);
        hasChanges = true;
    }

    const projectManager = $('#projectManager').val();
    if (valueChanged('projectManager', projectManager)) {
        formData.append('projectManager', projectManager);
        hasChanges = true;
    }

    const documentDonor = $('#documentDonor').val();
    if (valueChanged('documentDonor', documentDonor)) {
        formData.append('documentDonor', documentDonor);
        hasChanges = true;
    }

    const documentVendor = $('#documentVendor').val();
    if (valueChanged('documentVendor', documentVendor)) {
        formData.append('documentVendor', documentVendor);
        hasChanges = true;
    }

    const documentDate = $('input[name="documentDate"]').val();
    if (valueChanged('documentDate', documentDate)) {
        const formattedDate = formatDateForSubmission(documentDate);
        if (formattedDate) {
            formData.append('documentDate', formattedDate);
            hasChanges = true;
        }
    }

    const tags = $('input[name="tags"]').val();
    if (valueChanged('tags', tags)) {
        formData.append('tags', tags);
        hasChanges = true;
    }

    const description = $('#summernote').val();
    if (valueChanged('description', description)) {
        formData.append('description', description);
        hasChanges = true;
    }

    const compliance = $('input[name="compliance"]:checked').val();
    if (valueChanged('compliance', compliance)) {
        formData.append('compliance', compliance);
        hasChanges = true;
    }

    const expiryDate = $('input[name="expiryDate"]').val();
    if (compliance === 'yes' && valueChanged('expiryDate', expiryDate)) {
        const formattedExpiryDate = formatDateForSubmission(expiryDate);
        if (formattedExpiryDate) {
            formData.append('expiryDate', formattedExpiryDate);
            hasChanges = true;
        } else if (expiryDate) {
            console.error('❌ Invalid expiry date format:', expiryDate);
            showToast('Please enter a valid expiry date in DD-MM-YYYY format', 'error');
            return { formData: null, hasChanges: false };
        }
    }

    const comment = $('input[name="comment"]').val();
    if (valueChanged('comment', comment)) {
        formData.append('comment', comment);
        hasChanges = true;
    }

    const link = $('input[name="link"]').val();
    if (valueChanged('link', link)) {
        formData.append('link', link);
        hasChanges = true;
    }

    const folderId = $('#selectedFolderId').val();
    if (valueChanged('folderId', folderId)) {
        formData.append('folderId', folderId);
        hasChanges = true;
    }

    const metadata = $('#metadataInput').val();
    if (valueChanged('metadata', metadata)) {
        formData.append('metadata', metadata);
        hasChanges = true;
    }
    const metadataFileName = $('#metadataFileName').val();
    if (valueChanged('metadataFileName', metadataFileName)) {
        // Send as simple string, not JSON
        formData.append('metadataFileName', metadataFileName);
        hasChanges = true;
    }

    const signature = $('#signatureData').val();
    if (valueChanged('signature', signature)) {
        // Validate signature format
        if (signature && !validateSignature(signature)) {
            showToast('Invalid signature format. Please upload a valid image or draw a new signature.', 'error');
            return { formData: null, hasChanges: false };
        }
        formData.append('signature', signature);
        hasChanges = true;
    }

    // Always include file IDs if there are any changes
    const currentFileIds = window.uploadedFileIds || [];
    const originalFileIds = window.existingFileIds || [];

    // Check if file IDs have changed
    const filesChanged = JSON.stringify(currentFileIds.sort()) !== JSON.stringify(originalFileIds.sort());
    if (filesChanged && currentFileIds.length > 0) {
        formData.append('fileIds', JSON.stringify(currentFileIds));
        hasChanges = true;
    }

    console.log('📊 Change detection:', {
        hasChanges,
        changedFields: Array.from(formData.keys()),
        filesChanged,
        currentFiles: currentFileIds.length,
        originalFiles: originalFileIds.length
    });

    return { formData, hasChanges };
}

function initializeEditFormSubmission() {
    $('#documentForm').on('submit', async function (e) {
        e.preventDefault();
        
        // Validate dates first
        if (!validateDates()) {
            return;
        }

        // Update summernote content
        $('#summernote').val($('.summernote').summernote('code'));

        $('#submitBtn').prop('disabled', true).html(
            '<span class="spinner-border spinner-border-sm" role="status"></span> Updating...'
        );

        try {
            // Get only changed form data
            const { formData, hasChanges } = getChangedFormData();

            if (!hasChanges || !formData) {
                $('#submitBtn').prop('disabled', false).html("Update Document");
                if (!formData) {
                    return;
                }
                showToast('No changes detected to update.', 'info');
                return;
            }

            // Clear file input to avoid multer issues
            const rawFileInput = document.getElementById('fileInput');
            if (rawFileInput) rawFileInput.value = '';

            console.log('🔄 Sending PATCH request...');

            const response = await fetch(`/api/documents/${window.documentId}`, {
                method: 'PATCH',
                body: formData
            });

            const data = await response.json();
            
            if (data.success) {
                storeOriginalFormData();

                // Update uploaded/existing file tracking
                window.existingFileIds = [...window.uploadedFileIds];

                // --- SHOW SUCCESS MODAL INSTEAD OF TOAST ---
                showSuccessModal(data.document || window.documentData);
                
                // Optional: Remove the automatic redirect, let user click "Ok" button
                // setTimeout(() => {
                //     window.location.href = '/documents/list';
                // }, 1500);

                return;
            } else {
                throw new Error(data.message || 'Unknown error occurred during update');
            }
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            $('#submitBtn').prop('disabled', false).html("Update Document");
        }
    });
}

/**
 * Update file display after changes
 */
function updateFileDisplay() {
    const totalFiles = window.uploadedFileIds.length;

    if (totalFiles === 0) {
        document.getElementById('existingFilesList').innerHTML = '<p class="text-muted">No files uploaded</p>';
    }
}

function removeUploadedFile(fileId, fileName, fileElement) {
    const trashModal = new bootstrap.Modal(document.getElementById("trashdoc-modal"));
    const trashModalTitle = document.querySelector("#trashdocLabel");
    const trashModalBody = document.querySelector("#trashdoc-modal .modal-body");
    const confirmTrashBtn = document.getElementById("confirm-trash-folder");

    trashModalTitle.innerHTML = `
        <img src="/img/icons/bin.png" class="me-2" style="width:24px; height:24px;">
        Delete File
    `;
    trashModalBody.innerHTML = `
        You are about to delete <strong>"${fileName}"</strong>.<br>
        This action cannot be undone. Are you sure you want to proceed?
    `;

    // Remove previous event listeners and add new one
    confirmTrashBtn.replaceWith(confirmTrashBtn.cloneNode(true));
    const newConfirmBtn = document.getElementById("confirm-trash-folder");

    newConfirmBtn.addEventListener('click', async function () {
        try {
            console.log('🗑️ Deleting file:', fileId);

            // Remove from uploadedFileIds array
            window.uploadedFileIds = window.uploadedFileIds.filter(id => id !== fileId);

            // Remove from DOM
            if (fileElement && fileElement.parentNode) {
                fileElement.parentNode.remove();
            }

            trashModal.hide();
            showToast("File removed successfully!", 'success');

            // Update file display
            updateFileDisplay();

        } catch (err) {
            console.error('❌ Error in file removal:', err);
            showToast("Error removing file: " + err.message, 'error');
            trashModal.hide();
        }
    });

    trashModal.show();
}

function initializeDateRestrictions() {
    const $startDateInput = $('input[name="documentDate"]');
    const $expiryDateInput = $('input[name="expiryDate"]');
    const $complianceYes = $('#complianceYes');
    const $complianceNo = $('#complianceNo');

    $startDateInput.datetimepicker({
        format: 'DD-MM-YYYY',
        useCurrent: false
    });

    const expiryPicker = $expiryDateInput.datetimepicker({
        format: 'DD-MM-YYYY',
        useCurrent: false
    });

    function updateExpiryMinDate() {
        const startDate = $startDateInput.data("DateTimePicker")?.date();

        if (startDate) {
            expiryPicker.data("DateTimePicker").minDate(startDate);
            const currentExpiry = expiryPicker.data("DateTimePicker").date();
            if (currentExpiry && currentExpiry.isBefore(startDate)) {
                expiryPicker.data("DateTimePicker").clear();
                showToast('Expiry date cleared because it was earlier than the document date.', 'warning');
            }
        } else {
            expiryPicker.data("DateTimePicker").minDate(false);
        }
    }

    $startDateInput.on('dp.change', function () {
        if ($complianceYes.is(':checked')) {
            updateExpiryMinDate();
        }
    });


    $complianceYes.on('change', function () {
        if (this.checked) {
            $('#expiryDateContainer').show();
            $('input[name="expiryDate"]').prop('required', true);
            updateExpiryMinDate();
        }
    });


    $complianceNo.on('change', function () {
        if (this.checked) {
            $('#expiryDateContainer').hide();
            $('input[name="expiryDate"]').prop('required', false).val('');
            expiryPicker.data("DateTimePicker").clear();
        }
    });


    if ($complianceYes.is(':checked')) {
        updateExpiryMinDate();
    }
}

function initializeFileUpload() {
    const uploadBox = document.getElementById("uploadBox");
    const fileInput = document.getElementById("fileInput");
    const newFilesContainer = document.getElementById("newFilesContainer");

    if (!uploadBox || !fileInput || !newFilesContainer) {
        console.warn('⚠️ Upload elements not found');
        return;
    }

    console.log('📤 Initializing file upload...');

    uploadBox.addEventListener("click", () => {
        const folderId = $('#selectedFolderId').val();
        if (folderId) {
            fileInput.click();
        } else {
            showToast('Please select a folder first.', 'error');
        }
    });

    fileInput.addEventListener("change", async (e) => {
        if (e.target.files.length > 0) {
            await handleFileUpload(e.target.files);
        }
    });

    // Drag & drop
    uploadBox.addEventListener("dragover", e => {
        e.preventDefault();
        uploadBox.classList.add("dragover");
    });

    uploadBox.addEventListener("dragleave", () => {
        uploadBox.classList.remove("dragover");
    });

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

        console.log('📁 Uploading files to folder:', folderId);

        for (const file of files) {
            const tempId = 'temp_' + Date.now() + Math.random().toString(36).substring(2, 8);

            const fileItem = document.createElement("div");
            fileItem.className = "col-sm-6 col-md-4 mb-3";
            fileItem.innerHTML = `
            <div class="file-item card p-3" data-file-id="${tempId}">
                <div class="file-info d-flex align-items-center">
                    <i class="fa-solid fa-file fa-2x me-3 text-primary"></i>
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
                <button class="remove-btn btn btn-sm btn-danger mt-2" data-file-id="${tempId}" disabled>
                    <i class="fa-solid fa-xmark"></i> Remove
                </button>
            </div>
        `;
            newFilesContainer.appendChild(fileItem);

            const fileItemDiv = fileItem.querySelector('.file-item');
            const progressBar = fileItem.querySelector(".progress-bar");
            const removeBtn = fileItem.querySelector(".remove-btn");

            try {
                const formData = new FormData();
                formData.append('file', file);

                console.log('🔼 Uploading file:', file.name);

                const res = await fetch(`/api/tempfiles/upload/${folderId}`, {
                    method: 'POST',
                    body: formData
                });

                const data = await res.json();

                if (!data.success) throw new Error(data.message || "Upload failed");

                const uploadedFile = data.files[0];
                const fileId = uploadedFile.fileId;

                // CRITICAL: Add to uploadedFileIds array immediately
                window.uploadedFileIds.push(fileId);

                fileItemDiv.setAttribute("data-file-id", fileId);
                removeBtn.setAttribute("data-file-id", fileId);
                removeBtn.disabled = false;

                progressBar.style.width = "100%";
                progressBar.textContent = "Uploaded";
                removeBtn.addEventListener('click', function () {
                    const fileId = this.getAttribute('data-file-id');
                    removeUploadedFile(fileId, file.name, fileItem);
                });

            } catch (err) {
                console.error('❌ Upload failed:', err);
                progressBar.classList.remove("bg-success");
                progressBar.classList.add("bg-danger");
                progressBar.textContent = "Error";
                showToast('Upload failed: ' + err.message, 'error');
            }
        }
    }

}

function initializeSignature() {
    const fileSign = document.getElementById('fileSign');
    const uploadSignBtn = document.getElementById('uploadSignBtn');
    const drawSignBtn = document.getElementById('drawSignBtn');
    const clearSignBtn = document.getElementById('clearSignBtn');
    const signaturePreview = document.getElementById('signaturePreview');
    const signatureData = document.getElementById('signatureData');

    if (!fileSign || !uploadSignBtn) {
        console.warn('⚠️ Signature elements not found');
        return;
    }

    // Upload signature from file
    uploadSignBtn.addEventListener('click', () => fileSign.click());

    fileSign.addEventListener('change', function () {
        if (this.files && this.files[0]) {
            const file = this.files[0];
            // Validate file type
            if (!file.type.startsWith('image/')) {
                showToast('Please select a valid image file for signature.', 'error');
                return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast('Signature image must be less than 5MB.', 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = function (e) {
                signaturePreview.innerHTML = `<img src="${e.target.result}" alt="Signature" style="max-height:140px; max-width:100%; object-fit:contain;">`;
                signatureData.value = e.target.result;
                uploadSignBtn.textContent = "Update Signature";

                // Show clear button if not already shown
                if (!clearSignBtn) {
                    $('.signupld').append('<button type="button" class="btn btn-warning rounded-pill" id="clearSignBtn">Clear Signature</button>');
                    initializeClearSignature();
                }
            };
            reader.onerror = function () {
                showToast('Error reading signature file.', 'error');
            };
            reader.readAsDataURL(this.files[0]);
        }
    });

    // Draw signature functionality
    const modalEl = document.getElementById('signatureModal');
    if (!modalEl) {
        console.warn('⚠️ Signature modal not found');
        return;
    }

    const modal = new bootstrap.Modal(modalEl);
    const canvas = document.getElementById('sigCanvas');
    const ctx = canvas.getContext('2d');
    let drawing = false, paths = [], currentPath = [];

    function resizeCanvas() {
        if (!canvas) return;
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        redraw();
    }

    function redraw() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000';

        paths.forEach(path => {
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            path.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.stroke();
        });

        if (currentPath.length > 1) {
            ctx.beginPath();
            ctx.moveTo(currentPath[0].x, currentPath[0].y);
            currentPath.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.stroke();
        }
    }

    function addPoint(e) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        currentPath.push({ x, y });
    }

    function startDraw(e) {
        e.preventDefault();
        drawing = true;
        currentPath = [];
        addPoint(e);
    }

    function draw(e) {
        if (!drawing) return;
        e.preventDefault();
        addPoint(e);
        redraw();
    }

    function endDraw(e) {
        if (!drawing) return;
        drawing = false;
        if (currentPath.length > 0) paths.push([...currentPath]);
        currentPath = [];
        redraw();
    }

    if (canvas) {
        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', endDraw);
        canvas.addEventListener('mouseleave', endDraw);
        canvas.addEventListener('touchstart', startDraw);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', endDraw);
    }

    $('#undoSignBtn').on('click', () => {
        paths.pop();
        redraw();
    });

    $('#clearSignBtnModal').on('click', () => {
        paths = [];
        redraw();
    });

    $('#saveSignBtn').on('click', () => {
        if (paths.length === 0) {
            showToast('Please draw a signature first.', 'info');
            return;
        }
        const dataURL = canvas.toDataURL('image/png');
        signaturePreview.innerHTML = `<img src="${dataURL}" style="max-height:140px; max-width:100%; object-fit:contain;">`;
        signatureData.value = dataURL;
        uploadSignBtn.textContent = "Update Signature";

        // Show clear button
        if (!clearSignBtn) {
            $('.signupld').append('<button type="button" class="btn btn-warning rounded-pill" id="clearSignBtn">Clear Signature</button>');
            initializeClearSignature();
        }

        modal.hide();
    });

    // Clear signature functionality
    function initializeClearSignature() {
        const clearBtn = document.getElementById('clearSignBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                signaturePreview.innerHTML = '<div class="text-muted">No signature uploaded</div>';
                signatureData.value = '';
                uploadSignBtn.textContent = "Browse from system";
                this.remove();
            });
        }
    }

    // Initialize clear button if signature exists
    if (clearSignBtn) {
        initializeClearSignature();
    }

    if (drawSignBtn) {
        drawSignBtn.addEventListener('click', () => {
            paths = [];
            redraw();
            modal.show();
        });
    }

    modalEl.addEventListener('shown.bs.modal', resizeCanvas);
    $(window).on('resize', resizeCanvas);
}

// ... (keep all other functions the same as your working version)
// initializeSummernote, initializeSelect2, initializeDatepicker, etc.
// All the other utility functions should remain

// Enhanced showToast function
function showToast(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);

    // Try to use Bootstrap toast if available
    const toastEl = document.getElementById('liveToast');
    if (toastEl) {
        const toast = new bootstrap.Toast(toastEl);
        const toastBody = toastEl.querySelector('.toast-body');
        if (toastBody) {
            toastBody.textContent = message;
            toastEl.className = `toast ${type === 'error' ? 'bg-danger' : type === 'success' ? 'bg-success' : 'bg-info'} text-white`;
            toast.show();
            return;
        }
    }

    // Fallback to alert
    if (type === 'error') {
        alert('❌ ' + message);
    } else if (type === 'success') {
        alert('✅ ' + message);
    } else {
        alert('ℹ️ ' + message);
    }
}