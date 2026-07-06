// Global API Fetch Utility
async function apiFetch(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                ...options.headers
            },
            credentials: "include",
            ...options
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${text}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}

// Success Notification
function showSuccess(message) {
    Toastify({
        text: message,
        duration: 4000,
        gravity: "top",
        position: "right",
        backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)",
        stopOnFocus: true
    }).showToast();
}

// Error Notification
function showError(message) {
    Toastify({
        text: ` ${message}`,
        duration: 5000,
        gravity: "top",
        position: "right",
        backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)",
        stopOnFocus: true
    }).showToast();
}

// Debounce Utility
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Format Date
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}
/**
 * Formats a date into a readable format (e.g. "Nov 3, 2025 08:45 PM")
 * @param {string|Date|number} dateInput - A date string, timestamp, or Date object
 * @returns {string} Formatted date and time
 */
function formatDateTime(dateInput) {
    const date = new Date(dateInput);
    if (isNaN(date)) return 'Invalid date';

    const formattedDate = date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    const formattedTime = date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    return `${formattedDate} ${formattedTime}`;
}

function getFileIcon(fileName) {
    if (!fileName) return fileIcons.default;
    const ext = fileName.split('.').pop().toLowerCase();
    return fileIcons[ext] || fileIcons.default;
}


// File Icons Map
// const fileIcons = {
//     ppt: "/img/icons/fn1.png",
//     pptx: "/img/icons/fn1.png",
//     doc: "/img/icons/fn2.png",
//     docx: "/img/icons/fn2.png",
//     xls: "/img/icons/fn3.png",
//     xlsx: "/img/icons/fn3.png",
//     pdf: "/img/icons/fn4.png",
//     default: "/img/icons/fn1.png"
// };

// Status Class Map
const statusClass = {
    draft: 'bg-soft-info',
    pending: 'bg-soft-warning',
    approved: 'bg-soft-success',
    rejected: 'bg-soft-danger',
    underreview: 'bg-soft-warning',
    archived: 'bg-soft-secondary'
};

// GLOBAL UNIQUE KEY CHECK FUNCTION
function checkDuplicateValue(field, value, $input) {
    if (!value) return;

    $.ajax({
        url: `${baseUrl}/api/check`,
        type: 'GET',
        data: { [field]: value },
        success: function (res) {

            // Remove old duplicate message
            $input.next(".duplicate-msg").remove();

            if (res.exists) {
                // mark as invalid
                $input.addClass("is-invalid").removeClass("is-valid");
                $input.after(`<small class="duplicate-msg text-danger">${field.replace('_', ' ')} already exists</small>`);
            } else {
                // mark as valid
                $input.addClass("is-valid").removeClass("is-invalid");
            }
        }
    });
}

function showLoader(btn) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Submitting...`;
    btn.disabled = true;
}

function hideLoader(btn) {
    btn.innerHTML = btn.dataset.originalText;
    btn.disabled = false;
}

function timeAgo(date) {
    const now = new Date();
    const past = new Date(date);
    const diff = Math.floor((now - past) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + " mins ago"; // less than 1 hour
    if (diff < 86400) return Math.floor(diff / 3600) + " hours ago"; // less than 1 day
    if (diff < 604800) return Math.floor(diff / 86400) + " days ago"; // less than 1 week
    if (diff < 2419200) return Math.floor(diff / 604800) + " weeks ago"; // less than 1 month
    if (diff < 29030400) return Math.floor(diff / 2419200) + " months ago"; // less than 1 year
    return Math.floor(diff / 29030400) + " years ago";
}

function getRetentionStatus(archivedAt, docExpiresAt) {
    const NOW = new Date();
    const EXPIRING_THRESHOLD_DAYS = 30;
    const EXPIRING_SOON_DATE = new Date(NOW.getTime() + EXPIRING_THRESHOLD_DAYS * 86400000);

    if (archivedAt && new Date(archivedAt) < NOW) {
        return {
            status: 'Archive',
            icon: '<i class="ti ti-archive fs-20 me-2" style="color:#000000;"></i>'
        };
    }

    if (docExpiresAt) {
        const expiryDate = new Date(docExpiresAt);
        if (expiryDate < NOW) {
            return {
                status: 'Expired',
                icon: '<i class="ti ti-clock-hour-7 fs-20 me-2" style="color:#FF0000;"></i>' // red
            };
        } else if (expiryDate <= EXPIRING_SOON_DATE) {
            return {
                status: 'Expiring',
                icon: '<i class="ti ti-clock-hour-7 fs-20 me-2" style="color:#F9CA24;"></i>'
            };
        }
    }

    return {
        status: 'Active',
        icon: '<i class="ti ti-folder-check fs-20 me-2" style="color:#3C951C;"></i>'
    };
}

/**
 * Creates a new tag object for Select2 when the user types a term that doesn't exist.
 * It prepends a special identifier to the ID so the backend can easily recognize it as a new location name.
 */
