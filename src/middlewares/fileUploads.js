import multer from "multer";
import multerS3 from "multer-s3";
import { API_CONFIG } from "../config/ApiEndpoints.js";
import { s3Client } from "../config/S3Client.js";

// Create multer storage using S3
const storage = multerS3({
    s3: s3Client,
    bucket: API_CONFIG.AWS_BUCKET, // your S3 bucket name
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
        const folder = req.uploadFolder || "general";
        const fileName = `${Date.now()}-${file.originalname}`;
        cb(null, `${folder}/${fileName}`);
    },
});

// Configure multer with size limits etc.
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, //50MB
});

export default upload;