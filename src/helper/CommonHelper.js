import mongoose from "mongoose";
import Designation from "../models/Designation.js";
import Document from "../models/Document.js";
import File from "../models/File.js";
import Project from "../models/Project.js";
import WebSetting from "../models/WebSetting.js";

// Helper to pick an icon for each file type (optional)
export const getFileIcon = (file) => {
    if (!file) return "/img/icons/file.png";
 
    const type = file.fileType?.toLowerCase() || "";
    if (type.includes("png") || type.includes("jpg") || type.includes("jpeg") || type.includes("gif")) {
        if (file.s3Url) return file.s3Url;
        return `/uploads/${file.file}`;
    }
 
    // File-type icons
    if (type.includes("pdf")) return "/img/icons/fn1.png";
    if (type.includes("doc") || type.includes("word")) return "/img/icons/fn2.png";
    if (type.includes("xls") || type.includes("spreadsheet")  || type.includes("application/vnd.ms-excel") || type.includes("vnd.ms-powerpoint")) return "/img/icons/fn3.png";
    if (type.includes("ppt")) return "/img/icons/fn4.png";
    if (type.includes("txt")) return "/img/icons/txt.png";
 
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
        .replace(/\b\w/g, ch => ch.toUpperCase())
        .replace(/\s+/g, " ")
        .trim();
}

// if (!projectId) return;

// const distinctTags = await Document.distinct("tags", { project: projectId });
// const totalFiles = await File.countDocuments({
    //     projectId,
    //     status: "active"
    // });
    
    // const cleaned = (distinctTags || [])
    //     .map(t => (typeof t === "string" ? t.trim().toLowerCase() : null))
    //     .filter(Boolean);
    
    // const unique = [...new Set(cleaned)];
    // const totalTags = unique.length;
    
    // await Project.findByIdAndUpdate(projectId, {
        //     $set: { totalTags, totalFiles, tags: unique },
        // }, { new: true }).exec();
export const recomputeProjectTotalTags = async (projectId) => {
    if (!projectId) return;

    const result = await Document.aggregate([
        {
            $match: {
                project: new mongoose.Types.ObjectId(projectId),
                isDeleted: false
            }
        },
        { $unwind: "$tags" },
        {
            $group: {
                _id: "$tags"
            }
        }
    ]);

    const uniqueTags = result.map(t => t._id);

    await Project.updateOne(
        { _id: projectId },
        {
            totalTags: uniqueTags.length,
            tags: uniqueTags
        }
    );
};

export const recomputeProjectTotalFiles = async () => {
    if (!projectId) return;

    await Project.updateOne(
        { _id: projectId },
        { $inc: { totalFiles: count } },
        { session }
    );
};

export const recomputeProjectStats = async (projectId) => {
    if (!projectId) return;

    const projectObjectId = new mongoose.Types.ObjectId(projectId);

    const [fileCount, tagData] = await Promise.all([

        // Count documents
        Document.countDocuments({
            project: projectObjectId,
            isDeleted: false
        }),

        // Get unique tags
        Document.aggregate([
            {
                $match: {
                    project: projectObjectId,
                    isDeleted: false
                }
            },
            { $unwind: "$tags" },
            {
                $group: {
                    _id: "$tags"
                }
            }
        ])
    ]);

    const tags = tagData.map(t => t._id);

    await Project.updateOne(
        { _id: projectObjectId },
        {
            totalFiles: fileCount,
            totalTags: tags.length,
            tags
        }
    );
};

let cachedSettings = null;

export const getCompanySettings = async () => {
    if (cachedSettings) return cachedSettings;
    cachedSettings = await WebSetting.findOne({}) || {};
    return cachedSettings;
};

export const refreshCompanySettings = async () => {
    cachedSettings = await WebSetting.findOne({}) || {};
    return cachedSettings;
};

export const getGrowth = (cur, prev) => {
    if (prev === 0) return cur > 0 ? 100 : 0;

    let growth = Math.round(((cur - prev) / prev) * 100);

    if (growth > 100) growth = 100;
    if (growth < -100) growth = -100;

    return growth;
};

export async function getDesignationId(profile_type) {
    const names = profile_type === "vendor" ? ["vendor", "vendors"] : ["donor", "donors"];
    const designation = await Designation.findOne({
        name: { $in: names.map(n => new RegExp(`^${n}$`, "i")) },
        status: "Active"
    });
    if (!designation) throw new Error(`No active designation found for ${profile_type}`);
    return designation._id;
}

export async function getDateRange(filter) {
    const now = new Date();

    switch (filter) {
        case "today": {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const end = new Date(start);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }

        case "week": {
            const start = new Date(now);
            start.setDate(start.getDate() - 7);
            start.setHours(0, 0, 0, 0);

            return { start, end: now };
        }

        case "month": {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            start.setHours(0, 0, 0, 0);
            return { start, end: now };
        }

        case "year": {
            const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            start.setHours(0, 0, 0, 0);
            return { start, end: now };
        }

        default:
            return null;
    }
};


export const formatTotalFileSize = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    if (!bytes || bytes < 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

export const formatDate=(date)=> {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
    });
}
/**
 * Get display name for file type
 */
export const getFileTypeDisplay=(fileType)=> {
    if (!fileType) return 'Unknown';
    const types = {
        // Images
        'image/jpeg': 'Image',
        'image/png': 'Image',
        'image/gif': 'Image',
        'image/webp': 'Image',
        'image/svg+xml': 'Image',
        'image/bmp': 'Image',
        'image/tiff': 'Image',
        'image/x-icon': 'Icon',
        
        // Documents
        'application/pdf': 'PDF',
        'application/msword': 'Word',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
        'application/vnd.ms-excel': 'Excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
        'application/vnd.ms-powerpoint': 'PowerPoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
        'application/vnd.oasis.opendocument.text': 'ODT',
        'application/vnd.oasis.opendocument.spreadsheet': 'ODS',
        'application/vnd.oasis.opendocument.presentation': 'ODP',
        
        // Text
        'text/plain': 'Text',
        'text/csv': 'CSV',
        'text/html': 'HTML',
        'text/xml': 'XML',
        'text/json': 'JSON',
        'application/json': 'JSON',
        
        // Archives
        'application/zip': 'Zip',
        'application/x-rar-compressed': 'RAR',
        'application/x-7z-compressed': '7z',
        'application/gzip': 'GZIP',
        'application/x-tar': 'TAR',
        
        // Videos
        'video/mp4': 'Video',
        'video/mpeg': 'Video',
        'video/quicktime': 'Video',
        'video/x-msvideo': 'Video',
        'video/x-matroska': 'Video',
        'video/webm': 'Video',
        'video/3gpp': 'Video',
        
        // Audio
        'audio/mpeg': 'Audio',
        'audio/wav': 'Audio',
        'audio/ogg': 'Audio',
        'audio/mp4': 'Audio',
        'audio/webm': 'Audio',
        'audio/aac': 'Audio',
        'audio/flac': 'Audio',
        
        // Code
        'application/javascript': 'JavaScript',
        'text/css': 'CSS',
        'text/x-python': 'Python',
        'text/x-java-source': 'Java',
        'text/x-csrc': 'C',
        'text/x-c++src': 'C++',
        'text/x-php': 'PHP',
        'text/x-ruby': 'Ruby',
        'text/x-go': 'Go',
        
        // Others
        'application/octet-stream': 'Binary',
        'application/x-msdownload': 'Executable',
        'application/x-shockwave-flash': 'Flash',
        'application/x-font-ttf': 'Font',
        'application/x-font-woff': 'Font',
        'application/rtf': 'RTF'
    };
    return types[fileType] || 'File';
}

/**
 * Get icon class for file type
 */
export const getFileIconClass=(fileType)=> {
    if (!fileType) return 'ti ti-file';
    const iconMap = {
        // Images
        'image/jpeg': 'ti ti-photo',
        'image/png': 'ti ti-photo',
        'image/gif': 'ti ti-photo',
        'image/webp': 'ti ti-photo',
        'image/svg+xml': 'ti ti-photo',
        'image/bmp': 'ti ti-photo',
        
        // Documents
        'application/pdf': 'ti ti-file-pdf',
        'application/msword': 'ti ti-file-word',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'ti ti-file-word',
        'application/vnd.ms-excel': 'ti ti-file-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'ti ti-file-excel',
        'application/vnd.ms-powerpoint': 'ti ti-file-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ti ti-file-powerpoint',
        
        // Text
        'text/plain': 'ti ti-file-text',
        'text/csv': 'ti ti-file-text',
        'text/html': 'ti ti-file-code',
        'text/xml': 'ti ti-file-code',
        'application/json': 'ti ti-file-code',
        
        // Archives
        'application/zip': 'ti ti-file-zip',
        'application/x-rar-compressed': 'ti ti-file-zip',
        'application/x-7z-compressed': 'ti ti-file-zip',
        
        // Videos
        'video/mp4': 'ti ti-video',
        'video/mpeg': 'ti ti-video',
        'video/quicktime': 'ti ti-video',
        'video/webm': 'ti ti-video',
        
        // Audio
        'audio/mpeg': 'ti ti-music',
        'audio/wav': 'ti ti-music',
        'audio/ogg': 'ti ti-music',
        
        // Code
        'application/javascript': 'ti ti-file-code',
        'text/css': 'ti ti-file-code',
        'text/x-python': 'ti ti-file-code',
        'text/x-java-source': 'ti ti-file-code',
        'text/x-csrc': 'ti ti-file-code',
        'text/x-c++src': 'ti ti-file-code',
        'text/x-php': 'ti ti-file-code',
        'text/x-ruby': 'ti ti-file-code',
        'text/x-go': 'ti ti-file-code'
    };
    return iconMap[fileType] || 'ti ti-file';
}

/**
 * Get file extension from filename or fileType
 */
export const getFileExtension=(filename, fileType)=> {
    if (filename && filename.includes('.')) {
        return filename.split('.').pop().toLowerCase();
    }
    if (fileType) {
        const extMap = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'application/pdf': 'pdf',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'application/vnd.ms-excel': 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'application/vnd.ms-powerpoint': 'ppt',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
            'text/plain': 'txt',
            'text/csv': 'csv',
            'application/zip': 'zip',
            'video/mp4': 'mp4',
            'audio/mpeg': 'mp3'
        };
        return extMap[fileType] || 'file';
    }
    return 'file';
}

/**
 * Check if item is shared
 */
export const isItemShared=(permissions)=> {
    return permissions && permissions.length > 0;
}

/**
 * Get sharing status text
 */
export const getSharingStatus=(permissions)=> {
    if (!permissions || permissions.length === 0) return 'Private';
    const hasExpired = permissions.some(p => p.expiresAt && new Date(p.expiresAt) < new Date());
    if (hasExpired) return 'Expired';
    return 'Shared';
}