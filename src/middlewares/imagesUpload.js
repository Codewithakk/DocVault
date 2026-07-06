import multer from "multer";
import fs from "fs";
import path from "path";

// Correct upload folder path
const uploadPath = path.join("public", "uploads", "web-settings");

// Create folder automatically if missing
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const unique = Date.now() + "_" + file.originalname.replace(/\s+/g, "_");
        cb(null, unique);
    }
});

// Allowed mime types
const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/svg+xml"
];

const fileFilter = (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Only PNG, JPEG/JPG, and SVG files are allowed!"), false);
    }
};

export const uploadWebImages = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).fields([
    { name: "logo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
    { name: "banner", maxCount: 1 },
    { name: "mailImg", maxCount: 1 },
    { name: "forgetpasswordImg", maxCount: 1 },
    { name: "checkMailImg", maxCount: 1 }
]);
