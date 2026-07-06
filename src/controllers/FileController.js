
import { deleteObject, getObjectUrl } from "../utils/s3Helpers.js";
import TempFile from "../models/TempFile.js";

import path from "path";
import Folder from "../models/Folder.js";
import File from "../models/File.js";
import mongoose from "mongoose";
import logger from "../utils/logger.js";
import { activityLogger } from "../helper/activityLogger.js";

export const showFileStatusPage = async (req, res) => {
    try {
        const projectId = req.query.projectId || null;

        res.render("pages/files/fileStatusListings", {
            pageTitle: "File Status",
            pageDescription: "View and track the current status of files across projects.",
            metaKeywords: "file status, file tracking, project files, document management",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            projectId
        });

    } catch (err) {
        logger.error("File Status render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load the file status page.",
            metaKeywords: "file status error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            message: "Unable to load manage access page"
        });
    }
};


// Upload temporary file
export const uploadFile = async (req, res, folder) => {
    try {
        const ownerId = req.user._id;

        if (!req.files || req.files.length === 0)
            return res.status(400).json({ success: false, message: "No files uploaded" });

        const uploadedFiles = [];

        for (const file of req.files) {
            const { originalname, mimetype, size, key, location } = file;

            // Create file record
            const newFile = await File.create({
                file: key,
                s3Url: location,
                originalName: originalname,
                fileType: mimetype,
                uploadedBy: ownerId,
                folder: folder._id,
                projectId: folder.projectId,
                departmentId: folder.departmentId,
                fileSize: size,
            });

            // ATOMIC MONGO UPDATE
            await Folder.updateOne(
                { _id: folder._id },
                {
                    $push: { files: newFile._id },
                    $inc: { size: size }
                }
            );

            uploadedFiles.push({
                _id: newFile._id,
                originalName: originalname,
                s3Url: location,
                fileType: mimetype,
                size,
            });
        }

        return res.status(201).json({
            success: true,
            message: "Files uploaded successfully",
            folderId: folder._id,
            files: uploadedFiles,
        });

    } catch (err) {
        console.error("Upload to folder error:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "File upload failed",
        });
    }
};

// Upload temporary file
export const tempUploadFile = async (req, res) => {
    try {
        const { folderId } = req.params;
        const ownerId = req.user._id;

        // Validate folderId
        if (!mongoose.Types.ObjectId.isValid(folderId)) {
            return res.status(400).json({ success: false, message: "Invalid folder ID" });
        }

        const folder = await Folder.findById(folderId);
        if (!folder) return res.status(404).json({ success: false, message: "Folder not found" });

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: "No files uploaded" });
        }

        let totalSize = 0;
        const uploadedFiles = [];

        for (const file of req.files) {
            const { originalname, mimetype, size, key, location } = file;

            // Create TempFile document
            const tempFile = await TempFile.create({
                fileName: key,
                originalName: originalname,
                s3Filename: key,
                s3Url: location,
                fileType: mimetype,
                status: "temp",
                size: size || 0,
                folder: folder._id,
            });

            if (!folder.files) folder.files = [];
            folder.files.push(tempFile._id);

            totalSize += size || 0;

            uploadedFiles.push({
                fileId: tempFile._id,
                originalName: originalname,
                s3Filename: key,
                s3Url: location,
            });
        }

        // Update folder size
        folder.size += totalSize;
        await folder.save();

        // Populate files for response
        const populatedFolder = await Folder.findById(folder._id).populate("files");

        return res.status(201).json({
            success: true,
            message: "Files uploaded successfully",
            folderId: folder._id,
            files: uploadedFiles,
            folderFiles: populatedFolder.files,
        });
    } catch (err) {
        console.error("Upload to folder error:", err);
        return res.status(500).json({ success: false, message: "File upload failed" });
    }
};
export const handleFolderUpload = async (req, res, parentFolder) => {
    try {
        const ownerId = req.user._id;
        const { projectId, departmentId } = parentFolder;
        const folderName = req.query.folderName || "New Folder";

        // Create the new subfolder
        const subfolder = await Folder.create({
            name: folderName,
            parent: parentFolder._id,
            owner: ownerId,
            projectId,
            departmentId,
            files: []
        });

        const uploadedFiles = [];
        let totalSize = 0;

        // Upload each file into the new subfolder
        for (const file of req.files) {
            const { originalname, mimetype, size, key, location } = file;
            const fileName = path.basename(originalname);

            const newFile = await File.create({
                file: key,
                s3Url: location,
                originalName: fileName,
                fileType: mimetype,
                uploadedBy: ownerId,
                folder: subfolder._id,
                projectId,
                departmentId,
                fileSize: size,
            });

            // Add file to subfolder and update size
            await Folder.findByIdAndUpdate(subfolder._id, {
                $inc: { size },
                $push: { files: newFile._id }
            });

            totalSize += size;

            uploadedFiles.push({
                fileId: newFile._id,
                folderId: subfolder._id,
                fileName,
                s3Url: location,
            });
        }

        // Update parent folder size
        await Folder.findByIdAndUpdate(parentFolder._id, { $inc: { size: totalSize } });

        return res.status(201).json({
            success: true,
            message: "Files uploaded successfully to subfolder",
            parentFolderId: parentFolder._id,
            subfolderId: subfolder._id,
            uploadedFiles,
        });

    } catch (err) {
        console.error("Folder upload error:", err);
        return res.status(500).json({ success: false, message: "Folder upload failed" });
    }
};

// Cancel/Delete temp file
export const deleteFile = async (req, res) => {
    try {
        const { fileId } = req.params;

        // Try to find file in both collections
        let file = await TempFile.findById(fileId);
        let isTemp = true;

        if (!file) {
            file = await File.findById(fileId);
            isTemp = false;
        }

        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        // Determine S3 key (field name differs in models)
        const s3Key = file.s3Filename || file.file;

        if (!s3Key) {
            logger.error("S3 key missing for file:", fileId);
            return res.status(500).json({ error: "Invalid file record" });
        }

        // Delete from S3
        try {
            await deleteObject(s3Key);
        } catch (s3Err) {
            logger.error("Failed to delete file from S3:", s3Err);
            return res.status(500).json({ error: "Failed to delete file from S3" });
        }

        // Delete from MongoDB
        if (isTemp) {
            await TempFile.deleteOne({ _id: file._id });
        } else {
            await File.deleteOne({ _id: file._id });
        }

        res.status(200).json({
            success: true,
            message: `File deleted successfully from ${isTemp ? "TempFile" : "File"} collection.`,
        });
    } catch (err) {
        logger.error("Delete file error:", err);
        res.status(500).json({ error: "File deletion failed" });
    }
};

export const download = async (req, res) => {
    try {
        const { fileName } = req.params;

        if (!fileName) return res.status(400).json({ error: "Missing file name" });

        // Generate pre-signed URL valid for 5 minutes
        const url = await getObjectUrl(fileName, 300);

        res.status(200).json({ success: true, url });
    } catch (err) {
        console.error("Download error:", err);
        res.status(500).json({ error: "Failed to generate download URL" });
    }
}
// Get file status
export const getFileStatus = async (req, res) => {
    try {
        const { fileId } = req.params;
        const file = await TempFile.findById(fileId);
        if (!file) return res.status(404).json({ error: "File not found" });

        res.json({
            fileId: file._id,
            status: file.status,
            s3Filename: file.s3Filename,
            originalName: file.originalName,
            addDate: file.addDate,
        });
    } catch (err) {
        logger.error("Status check error:", err);
        res.status(500).json({ error: "Status check failed" });
    }
};
