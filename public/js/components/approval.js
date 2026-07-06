// Modal state management
let currentApprovalData = null;

// Function to show approval modal
function showApprovalModal(approvalData) {
    currentApprovalData = approvalData;

    // Populate modal with data
    document.getElementById('requesterName').textContent = approvalData.requesterName || 'A. Arun';
    document.getElementById('documentName').textContent = approvalData.documentName || 'Project Proposal v1';
    document.getElementById('documentSize').textContent = approvalData.documentSize || '250KB';
    document.getElementById('requestDate').textContent = formatDate(approvalData.requestDate) || 'July 17th, 2025';
    document.getElementById('documentDescription').textContent = approvalData.description || 'This document is about the project proposal which need to sent to the client';
    document.getElementById('complianceStatus').textContent = approvalData.compliance ? 'Yes' : 'No';
    document.getElementById('expiryDate').textContent = formatDate(approvalData.expiryDate) || '21st August 2025';
    document.getElementById('notifyUsers').textContent = approvalData.notifyUsers || 'Arun and other approver members';

    // Set up view file button
    const viewFileBtn = document.getElementById('viewFileBtn');
    if (approvalData.fileUrl) {
        viewFileBtn.onclick = () => window.open(approvalData.fileUrl, '_blank');
    } else {
        viewFileBtn.style.display = 'none';
    }

    // Reset form
    resetApprovalForm();

    // Show modal
    document.getElementById('approvalModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// Function to hide modal
function hideApprovalModal() {
    document.getElementById('approvalModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
    currentApprovalData = null;
}

// Reset approval form
function resetApprovalForm() {
    const radioButtons = document.querySelectorAll('input[name="approvalAction"]');
    radioButtons.forEach(radio => radio.checked = false);
    document.getElementById('approvalComment').value = '';
    updateSubmitButton();
}

// Update submit button based on selection
function updateSubmitButton() {
    const submitBtn = document.getElementById('submitApprovalBtn');
    const selectedAction = document.querySelector('input[name="approvalAction"]:checked');

    if (selectedAction) {
        submitBtn.disabled = false;
        if (selectedAction.value === 'approve') {
            submitBtn.textContent = 'Approve';
            submitBtn.className = 'px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors';
        } else {
            submitBtn.textContent = 'Decline';
            submitBtn.className = 'px-6 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors';
        }
    } else {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Approve';
        submitBtn.className = 'px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors';
    }
}

// Submit approval function
async function submitApproval() {
    const selectedAction = document.querySelector('input[name="approvalAction"]:checked');
    const comment = document.getElementById('approvalComment').value;

    if (!selectedAction || !currentApprovalData) {
        showToast('Please select an approval action.', 'info');
        return;
    }

    const submitBtn = document.getElementById('submitApprovalBtn');
    const originalText = submitBtn.textContent;

    // Show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';

    try {
        const response = await fetch('/api/approvals/action', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                approvalId: currentApprovalData.approvalId,
                documentId: currentApprovalData.documentId,
                action: selectedAction.value,
                comment: comment,
                requesterId: currentApprovalData.requesterId
            })
        });

        const result = await response.json();

        if (response.ok) {
            // Success - show confirmation and close modal
            showNotification(`Document ${selectedAction.value}d successfully!`, 'success');
            hideApprovalModal();

            // Refresh the page or update UI as needed
            if (typeof refreshApprovalsList === 'function') {
                refreshApprovalsList();
            }
        } else {
            throw new Error(result.error || 'Failed to process approval');
        }
    } catch (error) {
        showNotification('Error processing approval: ' + error.message, 'error');

        // Reset button state
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Notification function
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.fixed-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `fixed-notification fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium z-50 transform transition-transform duration-300 ${type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
            'bg-blue-500'
        }`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.classList.add('translate-x-0');
    }, 100);

    // Remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('translate-x-0');
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function () {
    // Approval action radio buttons
    const radioButtons = document.querySelectorAll('input[name="approvalAction"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', updateSubmitButton);
    });

    // Cancel button
    document.getElementById('cancelBtn').addEventListener('click', hideApprovalModal);

    // Submit button
    document.getElementById('submitApprovalBtn').addEventListener('click', submitApproval);

    // Close modal when clicking outside
    document.getElementById('approvalModal').addEventListener('click', function (e) {
        if (e.target.id === 'approvalModal') {
            hideApprovalModal();
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !document.getElementById('approvalModal').classList.contains('hidden')) {
            hideApprovalModal();
        }
    });

    // Enter key in comment field
    document.getElementById('approvalComment').addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            submitApproval();
        }
    });
});

// Example usage function to trigger the modal
function triggerApprovalModalExample() {
    const approvalData = {
        approvalId: '12345',
        documentId: 'doc_67890',
        requesterName: 'A. Arun',
        requesterId: 'user_123',
        documentName: 'Project Proposal v1',
        documentSize: '250KB',
        requestDate: '2025-07-17',
        description: 'This document is about the project proposal which need to sent to the client',
        compliance: true,
        expiryDate: '2025-08-21',
        fileUrl: '/documents/project-proposal-v1.pdf',
        notifyUsers: 'Arun and other approver members'
    };

    showApprovalModal(approvalData);
}

// CSS for additional styles
const additionalStyles = `
.fixed-notification {
    transform: translateX(100%);
}
.fixed-notification.translate-x-0 {
    transform: translateX(0);
}
.fixed-notification.translate-x-full {
    transform: translateX(100%);
}

/* Smooth transitions for modal */
#approvalModal {
    transition: opacity 0.3s ease;
}
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);