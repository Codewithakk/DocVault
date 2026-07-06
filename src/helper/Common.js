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
