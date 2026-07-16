import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import { s3Client } from "../config/S3Client.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

/**
 * Blocked extensions: executables, scripts, installers, and other
 * file types that can run code on a machine that opens/executes them.
 * Everything else (docs, images, media, archives, etc.) is allowed.
 */
const BLOCKED_EXTENSIONS = [
    // Windows executables / installers
    "exe","ejs", "bat", "cmd", "com", "msi", "msp", "msc", "scr", "pif", "gadget",
    "cpl", "hta", "reg", "inf", "job", "lnk", "vb", "vbe", "vbs",
    "ws", "wsc", "wsf", "wsh",
    "ps1", "ps1xml", "ps2", "ps2xml", "psc1", "psc2",
    "msh", "msh1", "msh2", "mshxml", "msh1xml", "msh2xml",
    // Java / cross-platform executables & archives that run code
    "jar", "jnlp",
    // macOS / Unix executables & installers
    "app", "action", "command", "workflow", "dmg", "pkg",
    "deb", "rpm", "run", "bin", "elf", "out", "so",
    // Mobile installers
    "apk", "ipa",
    // Scripts / shell
    "sh", "bash", "zsh", "csh", "ksh",
    // Windows library / driver files
    "dll", "sys", "drv", "ocx", "cpl",
    // Autorun / config that can trigger execution
    "scf", "shs", "url",
];

// Secondary defense-in-depth check against known executable MIME types
// (in case the extension check is somehow bypassed or the type is spoofed)
const BLOCKED_MIME_TYPES = [
    "application/x-msdownload",
    "application/x-msdos-program",
    "application/x-executable",
    "application/x-sh",
    "application/x-shellscript",
    "application/x-bat",
    "application/bat",
    "application/x-msi",
    "application/vnd.microsoft.portable-executable",
    "application/java-archive",
];

const getExtension = (filename = "") => {
    // Handles double extensions like "invoice.pdf.exe" by only
    // ever looking at the actual final extension.
    return path.extname(filename).replace(".", "").toLowerCase();
};

const isBlockedFile = (file) => {
    const ext = getExtension(file.originalname);
    if (BLOCKED_EXTENSIONS.includes(ext)) return true;
    if (BLOCKED_MIME_TYPES.includes((file.mimetype || "").toLowerCase())) return true;
    return false;
};

const fileFilter = (req, file, cb) => {
    if (isBlockedFile(file)) {
        cb(new Error(`File type not allowed: ${file.originalname}`), false);
    } else {
        cb(null, true);
    }
};

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
        fileFilter,
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
    fileFilter,
});