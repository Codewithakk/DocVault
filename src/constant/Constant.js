// Constants for state management and configuration
export const RECENT_DOCS_DEFAULT_STATE = {
    page: 1,
    limit: 10,
    departmentId: '',
    sortBy: ''
};

export const STATUS_CLASSES = {
    Pending: "status-pending",
    Approved: "status-approved",
    Rejected: "status-rejected"
};

export const STATUS_LABELS = {
    Pending: "Pending",
    Approved: "Approved",
    Rejected: "Rejected"
};

export const COMPLIANCE_OPTIONS = {
    YES: "yes",
    NO: "no"
};

export const FILTER_PERIODS = ["today", "week", "month", "year"];


export const Document_STATUS = {
    DRAFT: "Draft",
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected"
};

export const profile_type = ["user", "vendor", "donor"];

// Centralized array of document types
export const docTypes = [
    { value: "application/pdf", label: "PDF" },
    { value: "application/msword", label: "Word (.doc)" },
    { value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word (.docx)" },
    { value: "application/vnd.ms-excel", label: "Excel (.xls)" },
    { value: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Excel (.xlsx)" },
    { value: "application/vnd.ms-powerpoint", label: "PowerPoint (.ppt)" },
    { value: "application/vnd.openxmlformats-officedocument.presentationml.presentation", label: "PowerPoint (.pptx)" },
    { value: "text/plain", label: "Text File (.txt)" },
    { value: "text/csv", label: "CSV File (.csv)" },
    { value: "image/jpeg", label: "Image (.jpg, .jpeg)" },
    { value: "image/png", label: "Image (.png)" },
    { value: "application/zip", label: "ZIP Archive (.zip)" },
];


export const FILE_TYPE_CATEGORIES = {
    word: ["doc", "docx", "odt"],
    excel: ["xls", "xlsx", "csv", "ods"],
    ppt: ["ppt", "pptx", "odp"],
    pdf: ["pdf"],
    media: [
        "jpg", "jpeg", "png", "gif", "mp3", "mp4", "mov", "avi",
        "mkv", "webm", "wav", "svg", "heic", "jfif"
    ]
};