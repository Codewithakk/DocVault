// Helper to pick an icon for each file type (optional)
export const getFileIcon = (fileType = "") => {
    const lower = fileType.toLowerCase();
    if (lower.includes("pdf")) return "/img/icons/fn1.png";
    if (lower.includes("word") || lower.includes("doc")) return "/img/icons/fn2.png";
    if (lower.includes("excel") || lower.includes("spreadsheet")) return "/img/icons/fn3.png";
    if (lower.includes("ppt")) return "/img/icons/fn4.png";
    if (lower.includes("image")) return "/img/icons/fn5.png";
    return "/img/icons/file.png";
};

export const formatFileSize = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export function toProperCase(str = "") {
    if (!str) return "";
    return str
        .toLowerCase()
        .replace(/\b\w/g, ch => ch.toUpperCase())         // Capitalize first letter
        .replace(/\s+/g, " ")                              // Remove extra spaces
        .trim();
}

// Update your existing bytesToGB function
export const bytesToGB = (bytes) => {
    if (bytes === 0) return 0;
    const gb = bytes / (1024 * 1024 * 1024);
    // If less than 0.01 GB, show with 6 decimal places
    if (gb < 0.01) {
        return parseFloat(gb.toFixed(6));
    }
    return parseFloat(gb.toFixed(2));
};

export const formatStorage = (bytes) => {
    if (!bytes || bytes === 0) {
        return { value: 0, unit: 'GB', bytes: 0 };
    }
    
    const gb = bytes / (1024 * 1024 * 1024);
    const mb = bytes / (1024 * 1024);
    const kb = bytes / 1024;
    
    if (gb >= 1) {
        return { 
            value: parseFloat(gb.toFixed(2)), 
            unit: 'GB'
        };
    } else if (mb >= 1) {
        return { 
            value: parseFloat(mb.toFixed(2)), 
            unit: 'MB'
        };
    } else if (kb >= 1) {
        return { 
            value: parseFloat(kb.toFixed(2)), 
            unit: 'KB'
        };
    } else {
        return { 
            value: bytes, 
            unit: 'Bytes'
        };
    }
};
