import multer from "multer";
import multerS3 from "multer-s3";
import { s3Client } from "../config/S3Client.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

const ALLOWED_DOC_MIME_TYPES = [
    "application/pdf",                               // PDF
    "application/msword",                            // DOC
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
    "application/vnd.ms-excel",                      // XLS
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",      // XLSX
    "application/vnd.oasis.opendocument.text",      // ODT
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.ms-powerpoint",                // PPT
    "text/plain",                                    // TXT
];

// Add image types
const ALLOWED_IMAGE_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml"
];

// Merge allowed types
const ALLOWED_MIME_TYPES = [...ALLOWED_DOC_MIME_TYPES, ...ALLOWED_IMAGE_MIME_TYPES];

export const createS3Uploader = (folderName) => {
    return multer({
        storage: multerS3({
            s3: s3Client,
            bucket: process.env.AWS_BUCKET,
            acl: "private",
            key: (req, file, cb) => {
                const safeName = file.originalname.replace(/\s+/g, "_");
                cb(null, `${folderName}/${Date.now()}-${safeName}`);
            },
        }),
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter: (req, file, cb) => {
            if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error(`Invalid file type: ${file.originalname} (${file.mimetype})`), false);
            }
        },
    });
};


// Multer S3 uploader
export const s3uploadfolder = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: process.env.AWS_BUCKET,
        acl: "private",
        key: (req, file, cb) => {
            const parentFolderName = req.parentFolderName;

            const safeFileName = file.originalname.replace(/\s+/g, "_");
            const s3Key = `${parentFolderName}/${req.query.folderName}/${Date.now()}_${safeFileName}`;
            cb(null, s3Key);
        },
    }),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type: ${file.originalname} (${file.mimetype})`), false);
        }
    },
});