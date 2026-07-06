// versionManager.js - Frontend version management
class VersionManager {
    // View specific version
    static async viewVersion(documentId, version) {
        try {
            const response = await fetch(`/api/documents/${documentId}/versions/${version}/view`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch version');
            }

            const result = await response.json();

            // Open version in new tab or modal
            this.openVersionViewer(result.data.document);

            return result.data;
        } catch (error) {
            showToast('Failed to load version', 'error');
        }
    }

    // Restore to specific version
    static async restoreVersion(documentId, version, notes = '') {
        if (!confirm(`Are you sure you want to restore to version ${version}? This will create a new version with the restored content.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/documents/${documentId}/versions/${version}/restore`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    restoreNotes: notes
                })
            });

            if (!response.ok) {
                throw new Error('Failed to restore version');
            }

            const result = await response.json();

            showToast(`Successfully restored to version ${version}`, 'success');

            // Refresh the page or update UI
            setTimeout(() => {
                window.location.reload();
            }, 1500);

            return result.data;
        } catch (error) {
            showToast('Failed to restore version', 'error');
        }
    }

    // Open version viewer modal
    static openVersionViewer(versionDocument) {
        // Create and show version viewer modal
        const modalHtml = `
            <div class="modal fade" id="version-viewer-modal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-history me-2"></i>
                                Viewing: ${versionDocument.metadata?.mainHeading || 'Document'} - v${versionDocument.version}
                                ${versionDocument.isHistorical ? '<span class="badge bg-warning ms-2">Historical Version</span>' : ''}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="version-info alert alert-info">
                                <div class="row">
                                    <div class="col-md-6">
                                        <strong>Version:</strong> v${versionDocument.version}<br>
                                        <strong>Modified:</strong> ${formatDateTime(versionDocument.versionInfo.timestamp)}<br>
                                        <strong>By:</strong> ${versionDocument.versionInfo.changedBy?.name}
                                    </div>
                                    <div class="col-md-6">
                                        <strong>Changes:</strong> ${versionDocument.versionInfo.changes}<br>
                                        ${versionDocument.versionInfo.changesDetail ?
                `<strong>Details:</strong> ${versionDocument.versionInfo.changesDetail.map(c => c.field).join(', ')}` : ''}
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Document Content -->
                            <div class="document-content">
                                <h4>${versionDocument.metadata?.mainHeading || 'Document'}</h4>
                                <p class="text-muted">${versionDocument.description || 'No description'}</p>
                                
                                <!-- Files -->
                                ${versionDocument.files && versionDocument.files.length > 0 ? `
                                <div class="files-section mt-4">
                                    <h6>Files in this version:</h6>
                                    <div class="list-group">
                                        ${versionDocument.files.map(file => `
                                            <div class="list-group-item">
                                                <div class="d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <i class="fas fa-file me-2"></i>
                                                        ${file.originalName}
                                                        <small class="text-muted ms-2">v${file.version}</small>
                                                    </div>
                                                    <a href="${file.s3Url}" target="_blank" class="btn btn-sm btn-outline-primary">
                                                        <i class="fas fa-download"></i> Download
                                                    </a>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                                ` : '<p class="text-muted">No files in this version</p>'}
                            </div>
                        </div>
                        <div class="modal-footer">
                            ${versionDocument.isHistorical ? `
                            <button type="button" class="btn btn-primary" 
                                onclick="VersionManager.restoreVersion('${versionDocument._id}', '${versionDocument.version}')">
                                <i class="fas fa-undo me-1"></i> Restore this Version
                            </button>
                            ` : ''}
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('version-viewer-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to DOM and show it
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('version-viewer-modal'));
        modal.show();
    }
}

// Global functions for HTML onclick handlers
function viewVersion(documentId, version) {
    VersionManager.viewVersion(documentId, version);
}

function restoreVersion(documentId, version) {
    const notes = prompt('Add restoration notes (optional):');
    VersionManager.restoreVersion(documentId, version, notes);
}