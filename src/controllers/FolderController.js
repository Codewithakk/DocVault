// controllers/folderController.js
import Folder from '../models/Folder.js';
import Document from '../models/Document.js';
import crypto from 'crypto'
import mongoose from 'mongoose';
import { generateUniqueFileName } from '../helper/GenerateUniquename.js';
import { getObjectUrl, putObject } from '../utils/s3Helpers.js';
import logger from '../utils/logger.js';
import TempFile from '../models/TempFile.js';
import User from '../models/User.js';
import { API_CONFIG } from '../config/ApiEndpoints.js';
import { sendEmail } from '../services/emailService.js';
import File from '../models/File.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../config/S3Client.js';
import checkFolderAccess from '../utils/checkFolderAccess.js';
import FolderPermissionLogs from '../models/FolderPermissionLogs.js';
import { calculateExpiration } from '../helper/CalculateExpireDate.js';
import Project from '../models/Project.js';
import Department from '../models/Departments.js';
import { getSessionFilters } from '../helper/sessionHelpers.js';
import { generateEmailTemplate } from '../helper/emailTemplate.js';
import { activityLogger } from "../helper/activityLogger.js";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
//Page controlers

// Folder list by ID
export const showFolderListById = async (req, res) => {
    try {
        const { folderId } = req.params;

        res.render("pages/document/documentFolderList", {
            pageTitle: "Documents List",
            pageDescription: "View all documents within this folder.",
            metaKeywords: "documents list, folder documents, document management",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            folderId
        });
    } catch (err) {
        logger.error("Error loading document list:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load documents in folder.",
            metaKeywords: "document folder error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            message: "Unable to load documents"
        });
    }
};
// Upload Folder page
export const showUploadFolderPage = (req, res) => {
    const selectedProjectId = req.session.selectedProject || null;
    const selectedProjectName = req.session.selectedProjectName || '';

    res.render("pages/folders/upload-folder", {
        pageTitle: "Upload Folder",
        pageDescription: "Upload a new folder and add documents to your project.",
        metaKeywords: "upload folder, add folder, project folder",
        canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

        user: req.user,
        selectedProjectId,
        selectedProjectName
    });
};

// Archived Folders page
export const showArchivedFoldersPage = (req, res) => {
    res.render("pages/folders/archivedFolders", {
        pageTitle: "Archived Folders",
        pageDescription: "Browse all archived folders in your workspace.",
        metaKeywords: "archived folders, old folders, document archive",
        canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

        user: req.user
    });
};

// Recycle-bin Folders page
export const showRecycleBinPage = async (req, res) => {
    try {
        const documents = await Document.find({ isDeleted: true })
            .select("department deletedAt tag createdAt files")
            .populate("department", "name")
            .populate("files", "originalName fileSize");

        return res.render('pages/folders/recycleBin', {
            pageTitle: "Recycle Bin",
            pageDescription: "View deleted documents and restore them if needed.",
            metaKeywords: "recycle bin, deleted documents, restore documents",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            documents,
            user: req.user
        });
    } catch (error) {
        console.error(error);
        return res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load recycle bin documents.",
            metaKeywords: "recycle bin error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            message: "Failed to load recycle bin documents."
        });
    }
};
// Main Folders page
export const showMainFoldersPage = (req, res) => {
    res.render("pages/folders/folders", {
        pageTitle: "Folders",
        pageDescription: "View all folders for the selected project.",
        metaKeywords: "project folders, folder management, document folders",
        canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

        user: req.user,
        projectId: req.query.id || req.session.selectedProject
    });
};
export const showviewFoldersPage = async (req, res) => {
    const { folderId } = req.params;

    try {
        const folder = await Folder.findById(folderId).lean();
        if (!folder) return res.status(404).send("Folder not found");

        const access = await checkFolderAccess(folder, req) || {};
        const defaults = {
            canView: false,
            canRequestAccess: false,
            folderExpired: false,
            isExternal: false,
            canDownload: false,
            reason: "none"
        };

        res.render("pages/folders/viewFolders", {
            pageTitle: folder.name || "Folder Details",
            pageDescription: "View folder contents and manage access permissions.",
            metaKeywords: "folder details, view folder, folder access",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            folder,
            user: req.user,
            ...defaults,
            ...access
        });

    } catch (err) {
        console.error("Error rendering folder view:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load folder contents.",
            metaKeywords: "folder view error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            message: "Server error"
        });
    }
};
export const viewFile = async (req, res) => {
    try {
        const { fileId } = req.params;

        const formatFileSize = (bytes) => {
            if (!bytes) return "0 Bytes";
            const k = 1024;
            const sizes = ["Bytes", "KB", "MB", "GB"];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
        };

        const getFileType = (filename, mimeType) => {
            const ext = filename.split('.').pop().toLowerCase();
            const mime = mimeType || '';

            return {
                isPDF: ext === 'pdf' || mime.includes('pdf'),
                isWord: ['doc', 'docx'].includes(ext) || mime.includes('word'),
                isExcel: ['xls', 'xlsx'].includes(ext) || mime.includes('excel'),
                isPowerPoint: ['ppt', 'pptx'].includes(ext) || mime.includes('powerpoint'),
                isImage: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext),
                isText: ['txt', 'md', 'json', 'xml', 'html', 'csv'].includes(ext),
                extension: ext,
                mimeType: mime
            };
        };

        const file = await File.findById(fileId);
        if (!file) {
            return res.render("pages/folders/viewFile", {
                pageTitle: "File Not Found",
                pageDescription: "The requested file could not be found.",
                metaKeywords: "file not found, file error",
                canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

                file: null,
                documentTitle: "Document",
                user: req.user
            });
        }

        const fileUrl = file.s3Url || await getObjectUrl(file.file, 3600);

        await activityLogger({
            actorId: req.user?._id || null,
            entityId: file._id,
            entityType: "File",
            action: "VIEW",
            details: `${req.user ? req.user.name : "Guest User"} viewed ${file.originalName} file`
        });

        res.render("pages/folders/viewFile", {
            pageTitle: file.originalName,
            pageDescription: "View file details, preview, and download options.",
            metaKeywords: "view file, file details, file preview, download file",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            file: {
                ...file.toObject(),
                formattedSize: formatFileSize(file.fileSize),
                fileUrl,
                fileType: getFileType(file.originalName, file.mimeType)
            },
            documentTitle: file.originalName,
            user: req.user
        });

    } catch (error) {
        console.error("Error viewing file:", error);
        res.render("pages/folders/viewFile", {
            pageTitle: "Error",
            pageDescription: "Unable to view file.",
            metaKeywords: "file view error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            file: null,
            documentTitle: "Document",
            user: req.user
        });
    }
};

//API controllers

// Create folder
export const createFolder = async (req, res) => {
    try {
        const { name, parentId, projectId, departmentId } = req.body;
        const ownerId = req.user._id;

        const existingFolder = await Folder.findOne({
            name,
            parent: parentId || null,
            owner: ownerId,
            isDeleted: false
        });

        if (existingFolder) {
            return res.status(400).json({
                success: false,
                message: 'A folder with this name already exists in this location'
            });
        }

        const folder = new Folder({
            owner: ownerId,
            parent: parentId || null,
            name,
            projectId: projectId || null,
            departmentId: departmentId || null,
            createdBy: ownerId,
            updatedBy: ownerId
        });
        await folder.save();
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "Folder",
            action: "CREATE",
            details: `Folder created: ${folder.name} by ${req.user?.name}`,
            meta: { parent: folder.parent }
        });

        res.status(201).json({
            success: true,
            message: 'Folder created successfully',
            folder: {
                _id: folder._id,
                name: folder.name,
                slug: folder.slug,
                parent: folder.parent,
                path: folder.path,
                owner: folder.owner,
                createdAt: folder.createdAt,
                updatedAt: folder.updatedAt
            }
        });
    } catch (err) {
        logger.error('Create folder error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error while creating folder'
        });
    }
};

// Auto-create root folder if none exists
export const automaticProjectDepartmentFolderCreate = async (req, res) => {
    try {
        const { projectId, departmentId } = req.body;
        const ownerId = req.user._id;

        if (!projectId) {
            return res.status(400).json({ success: false, message: "Project ID is required." });
        }

        // --- Ensure project exists ---
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found." });
        }

        // ---Find or create project folder ---
        const projectName = project.projectName.replace(/\s+/g, "_");

        let projectFolder = await Folder.findOne({
            owner: ownerId,
            projectId,
            parent: null,
            name: projectName,
            isArchived: false,
            deletedAt: null,
        });

        if (!projectFolder) {
            try {
                projectFolder = await Folder.create({
                    owner: ownerId,
                    name: projectName,
                    projectId,
                    parent: null,
                    createdBy: ownerId,
                    updatedBy: ownerId,
                });
            } catch (err) {
                // Handle race condition if folder was just created
                if (err.code === 11000) {
                    projectFolder = await Folder.findOne({
                        owner: ownerId,
                        projectId,
                        parent: null,
                        name: projectName,
                        isArchived: false,
                        deletedAt: null,
                    });
                } else {
                    throw err;
                }
            }
        }

        // --- If no department, return project folder only ---
        if (!departmentId) {
            return res.status(200).json({
                success: true,
                message: "Project folder ensured successfully.",
                projectFolder,
                departmentFolder: null,
            });
        }

        // --- Ensure department exists ---
        const department = await Department.findById(departmentId);
        if (!department) {
            return res.status(404).json({ success: false, message: "Department not found." });
        }

        // --- Find or create department folder under project ---
        const departmentName = department.name.replace(/\s+/g, "_");

        let departmentFolder = await Folder.findOne({
            owner: ownerId,
            projectId,
            departmentId,
            parent: projectFolder._id,
            name: departmentName,
            isArchived: false,
            deletedAt: null,
        });

        if (!departmentFolder) {
            try {
                departmentFolder = await Folder.create({
                    owner: ownerId,
                    name: departmentName,
                    projectId,
                    departmentId,
                    parent: projectFolder._id,
                    createdBy: ownerId,
                    updatedBy: ownerId,
                });
            } catch (err) {
                if (err.code === 11000) {
                    // Folder already created in parallel request
                    departmentFolder = await Folder.findOne({
                        owner: ownerId,
                        projectId,
                        departmentId,
                        parent: projectFolder._id,
                        name: departmentName,
                        isArchived: false,
                        deletedAt: null,
                    });
                } else {
                    throw err;
                }
            }
        }
        await activityLogger({
            actorId: req.user._id,
            entityId: projectFolder._id,
            entityType: "Folder",
            action: "SYSTEM",
            details: `Automatically Folder created ${departmentName} by system`,
            meta: {}
        });

        // --- Success response ---
        return res.status(200).json({
            success: true,
            message: "Project and department folders ensured successfully.",
            projectFolder,
            departmentFolder,
        });

    } catch (err) {
        console.error("Auto folder creation failed:", err);
        return res.status(500).json({
            success: false,
            message: "Server error.",
            error: err.message,
        });
    }
};
// List all folders for a user (ignoring parent)
export const getAllFolders = async (req, res) => {
    try {
        const { departmentId, projectId } = req.query;

        const filter = { status: "active", deletedAt: null };

        if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
            filter.departmentId = departmentId;
        }

        if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
            filter.projectId = projectId;
        }

        const folders = await Folder.find(filter)
            .select("_id name slug size path createdAt updatedAt departmentId projectId")
            .populate("departmentId", "name")
            .populate("projectId", "projectName")
            .sort({ name: 1 })
            .lean();

        return res.json({
            success: true,
            message: "Folders retrieved successfully",
            folders
        });
    } catch (error) {
        logger.error("Error fetching folders:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve folders",
            error: error.message
        });
    }
};


// List folders with optional content (files/documents)
export const listFolders = async (req, res) => {
    try {
        const parentId = req.query.parentId || null;
        const ownerId = req.user._id;
        const { includeContent } = req.query;

        const folders = await Folder.find({
            parent: parentId,
            owner: ownerId,
            isDeleted: false
        }).select('name slug path createdAt updatedAt size projectId departmentId').sort({ name: 1 })
            .populate('projectId', 'name')
            .populate('departmentId', 'name');;

        let content = [];


        if (includeContent === 'true') {
            content = await Document.find({
                folder: parentId,
                owner: ownerId,
                isDeleted: false
            }).select('name description status files createdAt updatedAt metadata')
                .populate('department', 'name')
                .populate('project', 'name')
                .sort({ createdAt: -1 });
        }

        res.json({
            success: true,
            folders,
            content
        });
    } catch (err) {
        logger.error('List folders error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching folders'
        });
    }
};

export const getFoldersProjectDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const { projectId } = req.query;

        const filter = { status: "active", deletedAt: null };

        if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
            filter.departmentId = departmentId;
        }

        if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
            filter.projectId = projectId;
        }

        const folders = await Folder.find(filter)
            .select("_id name")
            .sort({ name: 1 })
            .lean();

        return successResponse(res, { folders }, "Folders retrieved successfully");
    } catch (error) {
        logger.error("Error fetching folders:", error);
        return errorResponse(res, error, "Failed to retrieve folders");
    }
};

// Get folder details with contents
export const getFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const ownerId = req.user._id;
        const folder = await Folder.findOne({ _id: id, "deletedAt": null, status: "active" })
            .populate('parent', 'name path')
            .populate('owner', 'name email')
            .populate('projectId', 'name')
            .populate('departmentId', 'name')
            .populate('files');
        if (!folder) {
            return res.status(404).json({
                success: false,
                message: 'Folder not found'
            });
        }

        // Get subfolders
        const subfolders = await Folder.find({
            parent: id,
            owner: ownerId,
            isDeleted: false
        }).select('name slug path createdAt updatedAt size projectId departmentId').populate('projectId', 'name').populate('departmentId', 'name').sort({ name: 1 });


        const documents = await Document.find({
            folder: id,
            owner: ownerId,
            isDeleted: false
        }).select('name description status files createdAt updatedAt metadata compliance')
            .populate('department', 'name')
            .populate('project', 'name')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            folder,
            subfolders,
            documents
        });
    } catch (err) {
        logger.error('Get folder error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching folder details'
        });
    }
};

// Rename folder
export const renameFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const ownerId = req.user._id;

        const folder = await Folder.findOne({ _id: id, owner: ownerId, deletedAt: null });
        if (!folder) {
            return res.status(404).json({
                success: false,
                message: 'Folder not found'
            });
        }

        const existingFolder = await Folder.findOne({
            name,
            parent: folder.parent,
            owner: ownerId,
            deletedAt: null,
            _id: { $ne: id }
        });

        if (existingFolder) {
            return res.status(400).json({
                success: false,
                message: 'A folder with this name already exists in this location'
            });
        }

        // Rename
        folder.name = name;
        folder.updatedBy = ownerId;
        await folder.save();
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "Folder",
            action: "RENAME",
            details: `Folder renamed to: ${folder.name} by ${req.user?.name}`,
            meta: {}
        });

        res.json({
            success: true,
            message: 'Folder renamed successfully',
            folder: {
                _id: folder._id,
                name: folder.name,
                slug: folder.slug,
                path: folder.path
            }
        });
    } catch (err) {
        logger.error('Rename folder error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error while renaming folder'
        });
    }
};

// Update FolderStatus
export const updateFolderStatus = async (req, res) => {
    try {
        const { folderId } = req.params;
        const { isDeleted = 'true', cascade = 'true' } = req.query;
        const userId = req.user?._id;

        // Convert query params to proper boolean values
        const markDeleted = isDeleted === 'true' || isDeleted === true;
        const cascadeBool = cascade === 'true' || cascade === true;

        // Find the folder
        const folder = await Folder.findById(folderId);
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found.' });
        }

        // Update the main folder
        folder.isDeleted = markDeleted;
        folder.deletedAt = markDeleted ? new Date() : null;
        folder.status = markDeleted ? 'inactive' : 'active';
        folder.updatedBy = userId;
        await folder.save();

        // Cascade to descendants if requested
        if (cascadeBool) {
            await Folder.updateMany(
                { ancestors: folder._id },
                {
                    $set: {
                        isDeleted: markDeleted,
                        deletedAt: markDeleted ? new Date() : null,
                        status: markDeleted ? 'inactive' : 'active',
                        updatedBy: userId
                    }
                }
            );
        }
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "Folder",
            action: markDeleted ? "RECYCLE" : "RESTORE",
            details: markDeleted
                ? `Folder moved to recycle bin${cascadeBool ? " with all subfolders" : ""}: ${folder.name} by ${req.user?.name}`
                : `Folder restored${cascadeBool ? " with all subfolders" : ""}: ${folder.name} by ${req.user?.name}`,
            meta: {
                cascade: cascadeBool,
                previousStatus: markDeleted ? "active" : "inactive",
                newStatus: markDeleted ? "inactive" : "active"
            }
        });

        return res.json({
            message: markDeleted
                ? `Folder moved to recycle bin${cascadeBool ? ' (including subfolders)' : ''}.`
                : `Folder restored${cascadeBool ? ' (including subfolders)' : ''}.`,
            folder
        });
    } catch (err) {
        console.error('Error updating folder recycle status:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
};

// Delete folder (soft delete)
export const deleteFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const ownerId = req.user._id;
        // Find the folder
        const folder = await Folder.findOne({ _id: id, owner: ownerId });
        if (!folder) {
            return res.status(404).json({ success: false, message: "Folder not found" });
        }

        // Check if folder is empty
        const fileCount = folder.files?.length || 0;
        const subfolderCount = await Folder.countDocuments({ parent: id, owner: ownerId, isDeleted: false });

        if (fileCount > 0 || subfolderCount > 0) {
            // Folder is not empty → cannot delete
            return res.status(400).json({
                success: false,
                message: "Folder is not empty. Delete files/subfolders first."
            });
        }

        // Folder is empty → permanently delete
        await Folder.deleteOne({ _id: id, owner: ownerId });
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "Folder",
            action: "SOFT_DELETE",
            details: `Folder moved to recycle bin: ${folder.name} by ${req.user?.name}`,
            meta: {}
        });

        return res.json({ success: true, message: "Folder permanently deleted" });

    } catch (err) {
        console.error("Error deleting folder:", err);
        res.status(500).json({ success: false, message: err.message || "Server error while deleting folder" });
    }
};

export const emptyRecycleBin = async (req, res) => {
    try {
        const ownerId = req.user._id;
        const { folderIds } = req.body;

        if (!folderIds || folderIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No folder IDs provided."
            });
        }

        const folders = await Folder.find({
            _id: { $in: folderIds },
            owner: ownerId,
            // isDeleted: true
        });

        if (!folders.length) {
            return res.status(404).json({
                success: false,
                message: "No deleted folders found for provided IDs."
            });
        }

        for (const folder of folders) {
            const fileCount = folder.files?.length || 0;

            const subfolderCount = await Folder.countDocuments({
                parent: folder._id,
                owner: ownerId,
                isDeleted: false
            });

            if (fileCount > 0 || subfolderCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Folder "${folder.name}" is not empty.`
                });
            }
        }

        // delete selected folders
        await Folder.deleteMany({
            _id: { $in: folderIds },
            owner: ownerId,
            // isDeleted: true
        });

        // activity logs
        for (const folder of folders) {
            await activityLogger({
                actorId: ownerId,
                entityId: folder._id,
                entityType: "Folder",
                action: "DELETE",
                details: `Folder permanently deleted: ${folder.name} by ${req.user?.name}`,
                meta: {}
            });
        }

        res.json({
            success: true,
            message: "Selected folders permanently deleted."
        });

    } catch (err) {
        console.error("Error emptying recycle bin:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Server error"
        });
    }
};


// Upload files to folder
export const uploadToFolder = async (req, res) => {
    try {
        const { folderId } = req.params;
        const ownerId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(folderId)) {
            return res.status(400).json({ success: false, message: "Invalid folder ID" });
        }

        const folder = await Folder.findOne({ _id: folderId, owner: ownerId });
        if (!folder) {
            return res.status(404).json({ success: false, message: "Folder not found" });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: "No files uploaded" });
        }
        const uploadedFiles = [];

        for (const file of req.files) {
            const { originalname, mimetype, buffer } = file;
            const s3Filename = generateUniqueFileName(originalname);

            // Upload to S3 under the folder name
            const { url, key } = await putObject(buffer, s3Filename, mimetype, folder.name);

            // Save as TempFile
            const tempFile = await TempFile.create({
                fileName: originalname,
                originalName: originalname,
                s3Filename: key,
                s3Url: url,
                fileType: mimetype,
                folder: folder._id,
                status: "permanent",
                size: buffer.length
            });

            uploadedFiles.push({
                fileId: tempFile._id,
                originalName: originalname,
                s3Filename: key,
                s3Url: url,
                size: buffer.length
            });
        }

        // Update folder size
        const totalSize = uploadedFiles.reduce((sum, f) => sum + (f.size || 0), 0);
        folder.size += totalSize;
        await folder.save();
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "Folder",
            action: "UPLOAD",
            details: `${uploadedFiles.length} files uploaded to folder: ${folder.name} by ${req.user?.name}`,
            meta: { files: uploadedFiles }
        });

        res.status(201).json({
            success: true,
            message: "Files uploaded successfully",
            folderId: folder._id,
            files: uploadedFiles,
        });
    } catch (err) {
        logger.error("Upload to folder error:", err);
        res.status(500).json({ success: false, message: "File upload failed" });
    }
};


// Get folder tree structure including files with selected fields

export const getFolderTree = async (req, res) => {
    try {
        const { rootId, departmentId, projectId } = req.query;
        const userId = req.user?._id;
        const profileType = req.user?.profile_type;
        const { selectedProjectId } = getSessionFilters(req);
console.log("Get folder tree called with:", { rootId, departmentId, projectId, selectedProjectId, userId, profileType });
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        /* -----------------------------------
         * SET PROJECT FILTER PRIORITY
         * ----------------------------------- */
        let finalProjectId = null;

        if (projectId && projectId !== "all") {
            finalProjectId = new mongoose.Types.ObjectId(projectId);
        } else if (selectedProjectId && selectedProjectId !== "all") {
            finalProjectId = new mongoose.Types.ObjectId(selectedProjectId);
        }

        /* -----------------------------------
         * BASE MATCH QUERY
         * ----------------------------------- */
        const match = {
            isArchived: false,
            deletedAt: null,
        };

        if (finalProjectId) {
            match.projectId = finalProjectId;
        }

        // Permission filtering (same as before)
        if (profileType !== "superadmin") {
            const accessConditions = [
                { owner: userId },
                { "permissions.principal": userId }
            ];

            if (profileType === "vendor") {
                accessConditions.push({
                    _id: {
                        $in: await Document.distinct("folderId", {
                            documentVendor: userId,
                            isDeleted: false,
                            isArchived: false
                        })
                    }
                });
            }

            if (profileType === "donor") {
                accessConditions.push({
                    _id: {
                        $in: await Document.distinct("folderId", {
                            documentDonor: userId,
                            isDeleted: false,
                            isArchived: false
                        })
                    }
                });
            }

            match.$or = accessConditions;
        }


        /* -----------------------------------
         * OPTIONAL: DEPARTMENT FILTER
         * ----------------------------------- */
        let departmentFolderId = null;

        if (departmentId && departmentId !== "all") {
            const departmentFilter = {
                isArchived: false,
                deletedAt: null,
                departmentId: new mongoose.Types.ObjectId(departmentId),
            };

            // department must belong to same project
            if (finalProjectId) {
                departmentFilter.projectId = finalProjectId;
            }

            const deptFolder = await Folder.findOne(departmentFilter).lean();

            if (!deptFolder) {
                return res.json({ success: true, tree: [] });
            }

            departmentFolderId = deptFolder._id;

            // Ensure department subtree is included
            if (!match.$or) match.$or = [];
            match.$or.push(
                { _id: deptFolder._id },
                { ancestors: deptFolder._id }
            );
        }

        const folders = await Folder.aggregate([
            { $match: match },

            {
                $lookup: {
                    from: "projects",
                    localField: "projectId",
                    foreignField: "_id",
                    as: "projectId"
                }
            },
            {
                $lookup: {
                    from: "departments",
                    localField: "departmentId",
                    foreignField: "_id",
                    as: "departmentId"
                }
            },
            {
                $lookup: {
                    from: "files",
                    localField: "files",
                    foreignField: "_id",
                    as: "files"
                }
            },

            {
                $project: {
                    name: 1,
                    slug: 1,
                    path: 1,
                    parent: 1,
                    status: 1,
                    owner: 1,
                    permissions: 1,
                    projectId: { $arrayElemAt: ["$projectId", 0] },
                    departmentId: { $arrayElemAt: ["$departmentId", 0] },
                    files: {
                        $map: {
                            input: "$files",
                            as: "f",
                            in: {
                                _id: "$$f._id",
                                file: "$$f.file",
                                originalName: "$$f.originalName",
                                fileType: "$$f.fileType",
                                fileUrl: "$$f.s3Url",
                                size: "$$f.fileSize",
                            }
                        }
                    }
                }
            },

            { $sort: { name: 1 } }
        ]);

        if (!folders.length) {
            return res.json({ success: true, tree: [] });
        }

        const enhanced = folders.map(f => ({
            ...f,
            isOwner: f.owner?.toString() === userId.toString()
        }));

        const map = new Map();
        enhanced.forEach(f => {
            map.set(f._id.toString(), { ...f, children: [] });
        });

        const roots = [];

        for (const folder of map.values()) {
            if (folder.parent) {
                const parent = map.get(folder.parent.toString());
                if (parent) parent.children.push(folder);
                else roots.push(folder);
            } else {
                roots.push(folder);
            }
        }

        let tree = [];

        if (rootId) {
            const root = map.get(rootId.toString());
            if (root) tree = [root];
        } else if (departmentFolderId) {
            const root = map.get(departmentFolderId.toString());
            if (root) tree = [root];
        } else {
            tree = roots;
        }

        return res.json({
            success: true,
            tree
        });

    } catch (err) {
        console.error("Get folder tree error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching folder tree",
            error: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};

export const archiveFolder = async (req, res) => {
    try {
        const { id } = req.params;
        let { isArchived = true } = req.query;
        const ownerId = req.user._id;

        // Convert string to boolean if needed
        if (typeof isArchived === 'string') {
            isArchived = isArchived === 'true';
        }
        const folder = await Folder.findOne({ _id: id, owner: ownerId, deletedAt: null });
        if (!folder) {
            return res.status(404).json({ success: false, message: "Folder not found" });
        }

        folder.isArchived = isArchived;
        folder.updatedBy = ownerId;
        await folder.save();
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "Folder",
            action: isArchived ? "ARCHIVE" : "UNARCHIVE",
            details: `${isArchived ? "Archived" : "Unarchived"} folder: ${folder.name} by ${req.user?.name}`,
            meta: {}
        });

        res.json({
            success: true,
            message: isArchived
                ? "Folder archived successfully"
                : "Folder unarchived successfully",
            folder: {
                _id: folder._id,
                name: folder.name,
                path: folder.path,
                isArchived: folder.isArchived
            }
        });
    } catch (err) {
        console.error("Archive/Unarchive folder error:", err);
        res.status(500).json({ success: false, message: "Server error while updating folder archive state" });
    }
};
;

export const getRecycleBinFolders = async (req, res) => {
    try {
        const user = req.user;
        const ownerId = user._id;
        const profileType = user.profile_type;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || "";
        const sortBy = req.query.sortBy || "updatedAt";
        const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
        const departmentFilter = req.query.department || "all";

        // Base filter
        const filter = {
            isDeleted: true,
            ...(departmentFilter !== "all" ? { departmentId: departmentFilter } : {})
        };

        // Apply owner restriction for non-superadmins
        if (profileType !== "superadmin") {
            filter.owner = ownerId;
        }

        // Search filter
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { status: { $regex: search, $options: "i" } }
            ];
        }

        const total = await Folder.countDocuments(filter);

        const folders = await Folder.find(filter)
            .sort({ [sortBy]: sortOrder })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('departmentId', 'name')
            .populate('owner', 'name email')
            .populate('projectId', 'projectName')
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name')
            .lean();

        res.json({
            success: true,
            folders,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error("Error fetching archived folders:", err);
        res.status(500).json({ success: false, message: "Server error while fetching archived folders" });
    }
};

export const getArchivedFolders = async (req, res) => {
    try {
        const user = req.user;
        const ownerId = user._id;
        const profileType = user.profile_type;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || "";
        const sortBy = req.query.sortBy || "updatedAt";
        const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
        const departmentFilter = req.query.department || "all";

        // Base filter
        const filter = {
            isArchived: true,
            deletedAt: null,
            ...(departmentFilter !== "all" ? { departmentId: departmentFilter } : {})
        };

        // Restrict by owner for non-superadmins
        if (profileType !== "superadmin") {
            filter.owner = ownerId;
        }

        // Search
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { status: { $regex: search, $options: "i" } }
            ];
        }

        const total = await Folder.countDocuments(filter);

        const folders = await Folder.find(filter)
            .sort({ [sortBy]: sortOrder })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate("departmentId", "name")
            .populate("owner", "name email")
            .populate("projectId", "projectName")
            .populate("createdBy", "name")
            .populate("updatedBy", "name")
            .lean();

        res.json({
            success: true,
            folders,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) {
        console.error("Error fetching archived folders:", err);
        res.status(500).json({
            success: false,
            message: "Server error while fetching archived folders",
        });
    }
};

export const restoreFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const { cascade = 'true' } = req.query;
        const ownerId = req.user._id;

        const cascadeBool = cascade === 'true' || cascade === true;

        // Find the folder owned by the user
        const folder = await Folder.findOne({ _id: id, owner: ownerId });
        if (!folder) {
            return res.status(404).json({ success: false, message: "Folder not found" });
        }

        // Restore main folder
        folder.isDeleted = false;
        folder.deletedAt = null;
        folder.status = 'active';
        folder.updatedBy = ownerId;
        await folder.save();

        // Cascade restoration if requested
        if (cascadeBool) {
            await Folder.updateMany(
                { ancestors: folder._id },
                {
                    $set: {
                        isDeleted: false,
                        deletedAt: null,
                        status: 'active',
                        updatedBy: ownerId
                    }
                }
            );
        }
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "Folder",
            action: "RESTORE",
            details: `Folder restored: ${folder.name} by ${req.user?.name}`,
            meta: { cascade: cascadeBool }
        });

        return res.json({
            success: true,
            message: `Folder restored successfully${cascadeBool ? ' (including subfolders)' : ''}`,
            folder
        });
    } catch (err) {
        console.error('Error restoring folder from recycle bin:', err);
        return res.status(500).json({
            success: false,
            message: "Server error while restoring folder"
        });
    }
};

/**
 * Get folder details for sharing
 * - List of users with access
 * - Shareable links
 */
export const getFolderShareInfo = async (req, res) => {
    const { folderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(folderId)) {
        return res.status(400).json({ error: 'Invalid folder ID' });
    }

    try {
        const folder = await Folder.findById(folderId)
            .populate('permissions.principal', 'name email') // populate user info
            .lean();

        if (!folder) return res.status(404).json({ error: 'Folder not found' });

        const usersWithAccess = (folder.permissions || [])
            .filter(p => p.model === 'User')
            .map(p => ({
                id: p.principal?._id,
                name: p.principal?.name || "Unknown",
                email: p.principal?.email || "",
                canDownload: p.canDownload || false,
                access: p.access
            }));

        const shareLinks = folder.metadata?.shareLinks || [];

        res.json({
            success: true,
            folderId: folder._id,
            folderName: folder.name,
            usersWithAccess,
            shareLinks
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

export const shareFolder = async (req, res) => {
    const { folderId } = req.params;
    const { userId, access, shareLink, duration, expiresAt, customStart, customEnd } = req.body;

    if (!mongoose.Types.ObjectId.isValid(folderId)) {
        return res.status(400).json({ error: 'Invalid folder ID' });
    }
    if (!userId || !access) {
        return res.status(400).json({ error: 'User email and access level are required' });
    }

    try {
        const user = await User.findOne({ email: userId }).select('_id name');
        if (!user) return res.status(404).json({ error: 'User not found' });

        const folder = await Folder.findById(folderId);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });

        // Add/update permissions
        const existing = folder.permissions.find(
            p => String(p.principal) === String(user._id) && p.model === "User"
        );
        if (existing) {
            existing.access = access;
            existing.duration = duration;
            existing.expiresAt = expiresAt ? new Date(expiresAt) : null;
            existing.customStart = customStart ? new Date(customStart) : null;
            existing.customEnd = customEnd ? new Date(customEnd) : null;
        } else {
            folder.permissions.push({
                principal: user._id,
                model: "User",
                access,
                duration,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                customStart: customStart ? new Date(customStart) : null,
                customEnd: customEnd ? new Date(customEnd) : null,
                addedby: req.user?._id
            });
        }

        await folder.save();
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "Folder",
            action: "SHARE",
            details: `Folder shared with ${user.name} by ${req.user?.name}`,
            meta: { access }
        });
        const data = {
            userName: user.name,
            senderName: req.user?.name,
            folderName: folder.name,
            access,
            companyName: res.locals.companyName || "Our Company",
            logoUrl: res.locals.logo || "",
            bannerUrl: res.locals.mailImg || "",
            expiresAt: expiresAt ? new Date(expiresAt).toLocaleString() : 'N/A',
            folderLink: shareLink || '#',
        };

        const html = generateEmailTemplate("folderShared", data)

        // Send the email
        await sendEmail({
            to: userId,
            subject: `Folder Shared with You: ${folder.name}`,
            html,
            fromName: "E-sangrah",
        });

        res.json({
            message: "Folder shared and invitation email sent successfully",
            folder,
            link: shareLink,
        });

    } catch (err) {
        console.error("Error sharing folder:", err);
        res.status(500).json({ error: "Server error" });
    }
};


/**
 * Remove a user's access
 */
export const unshareFolder = async (req, res) => {
    const { folderId } = req.params;
    const { userId } = req.body;

    try {
        const folder = await Folder.findById(folderId);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });

        folder.permissions = folder.permissions.filter(
            p => !(String(p.principal) === userId && p.model === 'User')
        );

        await folder.save();
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "Folder",
            action: "UNSHARE",
            details: `Folder access revoked for user: ${userId} by ${req.user?.name}`,
            meta: {}
        });

        res.json({ message: 'Access revoked successfully', folder });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};


export const downloadFile = async (req, res) => {
    try {
        const { fileId } = req.params;
        const file = await File.findById(fileId).lean();
        if (!file) return res.status(404).send("File not found");

        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: file.file,
            ResponseContentDisposition: `attachment; filename="${file.originalName}"`,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        res.redirect(url);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error generating download link");
    }
};

/**
 * Generate shareable link for a folder
 * POST /api/folders/:folderId/share
 * body: { access: 'viewer' | 'editor' }
 */
export const generateShareLink = async (req, res) => {
    const { folderId } = req.params;
    const { access } = req.body;

    if (!mongoose.Types.ObjectId.isValid(folderId)) {
        return res.status(400).json({ error: "Invalid folder ID" });
    }
    if (!access) {
        return res.status(400).json({ error: "Access level is required" });
    }

    try {
        const folder = await Folder.findById(folderId);
        if (!folder) return res.status(404).json({ error: "Folder not found" });

        // Clean expired share links
        folder.metadata = folder.metadata || {};
        folder.metadata.shareLinks = folder.metadata.shareLinks || [];
        const now = new Date();
        folder.metadata.shareLinks = folder.metadata.shareLinks.filter(
            l => !l.expiresAt || new Date(l.expiresAt) > now
        );

        // Generate token
        const token = crypto.randomBytes(20).toString('hex');

        folder.metadata.shareLinks.push({
            token,
            access,
            createdAt: now,
            expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });

        await folder.save();

        // Include access in URL
        const shareableUrl = `${API_CONFIG.baseUrl}/folders/${access}/${folder._id}?${token}`;

        res.json({ message: 'Shareable link generated', link: shareableUrl });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Access folder via token
 * GET /api/folders/:folderId/:access/:token
 */
export const accessViaToken = async (req, res) => {
    const { folderId, access } = req.params;
    const { token } = req.query;
    if (!mongoose.Types.ObjectId.isValid(folderId)) {
        return res.status(400).json({ error: 'Invalid folder ID' });
    }

    try {
        const folder = await Folder.findById(folderId).lean();
        if (!folder) return res.status(404).json({ error: 'Folder not found' });

        const now = new Date();

        const link = folder.metadata?.shareLinks?.find(
            l => l.token === token && l.access === access && (!l.expiresAt || new Date(l.expiresAt) > now)
        );

        if (!link) return res.status(403).json({ error: 'Invalid or expired link' });
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "Folder",
            action: "ACCESS_REQUEST",
            details: `Requested access to folder: ${folder.name} by ${req.user?.name}`,
            meta: {}
        });

        res.json({
            success: true,
            folder,
            access: link.access,
        });

    } catch (err) {
        console.error('Error accessing folder via token:', err);
        res.status(500).json({ error: 'Server error' });
    }
};


export const updateFolderLogPermission = async (req, res) => {
    try {
        const { logId } = req.params;
        const { requestStatus, access, duration, customEnd } = req.body;
        const updatedBy = req.user?._id || null;

        const log = await FolderPermissionLogs.findById(logId).populate("user", "name email");
        if (!log) return res.status(404).json({ message: "Log not found" });

        const folder = await Folder.findById(log.folder);
        if (!folder) return res.status(404).json({ message: "Folder not found" });

        const isExternal = log.isExternal;
        const principalId = log.user._id;
        const userEmail = log.user.email;
        const userName = log.user.name || "User";
        const folderName = folder.name;

        // REJECTED REQUEST
        if (requestStatus === "rejected") {
            log.requestStatus = "rejected";
            log.rejectedBy = updatedBy;
            log.rejectedAt = new Date();
            log.expiresAt = null;
            await log.save();

            // send rejection email
            const data = {
                userName,
                folderName,
                companyName: res.locals.companyName || "Our Company",
                logoUrl: res.locals.logo || "",
                bannerUrl: res.locals.mailImg || ""
            }
            const html = generateEmailTemplate("folderAccessRejected", data)
            await sendEmail({
                to: userEmail,
                subject: `Folder Access Rejected: ${folderName}`,
                html,
                fromName: "E-Sangrah Team",
            });

            return res.json({
                message: "Permission request rejected successfully",
                status: "rejected",
            });
        }

        // APPROVED REQUEST
        const expiresAt = calculateExpiration(duration, customEnd);

        log.requestStatus = "approved";
        log.approvedBy = updatedBy;
        log.approvedAt = new Date();
        log.access = access;
        log.duration = duration;
        log.expiresAt = expiresAt;

        if (!isExternal) {
            let existingPermission = folder.permissions.find(item => item.principal.equals(principalId));
            if (existingPermission) {
                if (access) existingPermission.access = access;
                existingPermission.expiresAt = expiresAt;
                existingPermission.duration = duration;
            } else {
                folder.permissions.push({
                    principal: principalId,
                    model: "User",
                    access: access || "view",
                    canDownload: false,
                    expiresAt,
                    duration,
                });
            }
            folder.updatedBy = updatedBy;
            await folder.save();
        }

        await log.save();
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "Folder",
            action: "UPDATE_LOG_PERMISSION",
            details: `Updated log Permissions for folder: ${folder.name} by ${req.user?.name}`
        });

        // send approval email
        const folderLink = `${API_CONFIG.baseUrl}/folders/${access}er/${folder._id}`;
        const data = {
            userName,
            folderName,
            access,
            expiresAt,
            folderLink,
            companyName: res.locals.companyName || "Our Company",
            logoUrl: res.locals.logo || "",
            bannerUrl: res.locals.mailImg || ""
        }
        const html = generateEmailTemplate('folderAccessApproved', data)
        await sendEmail({
            to: userEmail,
            subject: `Folder Access Approved: ${folderName}`,
            html,
            fromName: "E-Sangrah Team",
        });

        return res.json({
            message: "Permission updated successfully and email sent",
            user: principalId,
            access,
            duration,
            expiresAt,
            isExternal,
        });

    } catch (err) {
        return res.status(500).json({ message: "Server Error", error: err.message });
    }
};

/**
 * Toggle or update permission for a folder.
 * @param req.params.id - Folder ID
 * @param req.body.principalId - User ID
 * @param req.body.canDownload - Boolean (optional)
 * @param req.body.access - Array of access strings: ['view','edit','owner'] (optional)
 */

export const updateFolderPermission = async (req, res) => {
    const { id } = req.params;
    const { permissions, principalId, canDownload, access, status } = req.body;
    const updatedBy = req.user?._id || null;

    // ---------- 1. Helper ----------
    const normalizeEntry = (e) => ({
        principalId: e.principalId || e.principal || null,
        canDownload: typeof e.canDownload === 'boolean' ? e.canDownload : undefined,
        access: typeof e.access === 'string' ? e.access : undefined,
        model: e.model || 'User',
        expiresAt: e.expiresAt ?? null,
        customStart: e.customStart ?? null,
        customEnd: e.customEnd ?? null,
        duration: e.duration ?? undefined
    });

    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid folder id' });
        }

        const folder = await Folder.findById(id);
        if (!folder) return res.status(404).json({ message: 'Folder not found' });

        // ---------- 2. STATUS (Block / Unblock) ----------
        if (status && ['active', 'inactive'].includes(status)) {
            folder.status = status;
        }

        // ---------- 3. PERMISSIONS ----------
        let entriesToProcess = [];

        // a) Bulk array
        if (Array.isArray(permissions) && permissions.length) {
            entriesToProcess = permissions.map(normalizeEntry).filter(Boolean);
        }
        // b) Single-object shorthand (old UI)
        else if (principalId) {
            entriesToProcess = [normalizeEntry({ principalId, canDownload, access })];
        }

        // Process each ACE
        for (const entry of entriesToProcess) {
            const pid = entry.principalId;
            if (!pid || !mongoose.Types.ObjectId.isValid(pid)) continue;

            let ace = folder.permissions.find(p => String(p.principal) === String(pid));

            if (ace) {
                // update only the fields that were sent
                if (entry.access !== undefined) ace.access = entry.access;
                if (entry.canDownload !== undefined) ace.canDownload = entry.canDownload;
                if (entry.expiresAt !== null) ace.expiresAt = entry.expiresAt;
                if (entry.customStart !== null) ace.customStart = entry.customStart;
                if (entry.customEnd !== null) ace.customEnd = entry.customEnd;
                if (entry.duration) ace.duration = entry.duration;
            } else {
                // create new ACE
                folder.permissions.push({
                    principal: pid,
                    model: entry.model,
                    access: entry.access ?? 'view',
                    canDownload: entry.canDownload ?? false,
                    expiresAt: entry.expiresAt ?? null,
                    customStart: entry.customStart ?? null,
                    customEnd: entry.customEnd ?? null,
                    duration: entry.duration ?? 'lifetime'
                });
            }
        }

        folder.updatedBy = updatedBy;
        await folder.save();
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "Folder",
            action: "UPDATE_FOLDER_PERMISSION",
            details: `Permissions updated for folder: ${folder.name} by ${req.user?.name}`,
            meta: { permissions }
        });

        // ---------- 4. Response ----------
        return res.json({
            success: true,
            message: 'Folder updated',
            folderStatus: folder.status,
            permissions: folder.permissions   // send back the whole array (frontend expects it)
        });

    } catch (err) {
        console.error('updateFolderPermission error:', err);
        return res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};
export const getFolderAccess = async (req, res) => {
    try {
        const { folderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(folderId))
            return res.status(400).json({ success: false, message: "Invalid folder ID" });

        const folder = await Folder.findById(folderId)
            .populate('permissions.principal', 'name email')
            .lean();

        if (!folder) return res.status(404).json({ success: false, message: "Folder not found" });

        const accessList = folder.permissions.map(p => ({
            userId: p.principal._id,
            name: p.principal.name,
            email: p.principal.email,
            access: p.access,
            expiresAt: p.expiresAt
        }));

        res.json({ success: true, accessList });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Request access to a folder (internal/external logic)
export const requestFolderAccess = async (req, res) => {
    try {
        const { folderId } = req.params;
        const user = req.user;

        if (!mongoose.Types.ObjectId.isValid(folderId))
            return res.status(400).json({ success: false, message: "Invalid folder ID" });

        const folder = await Folder.findById(folderId).populate("owner", "name email");
        if (!folder) return res.status(404).json({ success: false, message: "Folder not found" });

        const owner = folder.owner;
        if (!owner?.email) return res.status(400).json({ success: false, message: "Owner email not found" });

        // Is internal? (Existing permission)
        const isInternal = folder.permissions.some(
            p => p.principal.toString() === user._id.toString()
        );

        const logData = {
            folder: folder._id,
            owner: owner._id,
            user: { username: user.name, email: user.email, _id: user._id },
            access: "none",
            isExternal: !isInternal,
            requestStatus: "pending"
        };

        await FolderPermissionLogs.findOneAndUpdate(
            { folder: folder._id, "user.email": user.email },
            logData,
            { upsert: true, new: true }
        );

        if (!isInternal) {
            const baseUrl = API_CONFIG.baseUrl;
            const manageLink = `${baseUrl}/admin/folders/permission`;
            const data = {
                user,
                folder,
                manageLink,
                companyName: res.locals.companyName || "Our Company",
                logoUrl: res.locals.logo || "",
                bannerUrl: res.locals.mailImg || "",
            }
            const htmlContent = generateEmailTemplate("folderAccessRequest", data)
            await sendEmail({
                to: owner.email,
                subject: `Access Request for Folder: ${folder.name}`,
                html: htmlContent,
                fromName: "E-Sangrah Team",
            });
        }
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "Folder",
            action: "FOLDER_ACCESS_REQUEST",
            details: `Requested access to folder: ${folder.name} by ${req.user.name}`,
            meta: {}
        });

        return res.json({
            success: true,
            message: isInternal
                ? "You already have access — waiting update by owner."
                : `Access request sent to ${owner.name || owner.email}.`
        });

    } catch (err) {
        console.error("requestFolderAccess error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

export const grantFolderAccess = async (req, res) => {
    try {
        const { folderId } = req.params;
        const { userEmail, access, duration, customEnd } = req.body;
        const owner = req.user;

        // Validate folder ID
        if (!mongoose.Types.ObjectId.isValid(folderId))
            return res.status(400).json({ success: false, message: "Invalid folder ID" });

        const folder = await Folder.findById(folderId);
        if (!folder) return res.status(404).json({ success: false, message: "Folder not found" });

        // Check ownership
        if (folder.owner.toString() !== owner._id.toString())
            return res.status(403).json({ success: false, message: "Not authorized" });

        const user = await User.findOne({ email: userEmail });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // Calculate expiration date
        let expiresAt = null;
        const now = new Date();
        if (duration === "oneday") expiresAt = new Date(now.getTime() + 86400000);
        if (duration === "oneweek") expiresAt = new Date(now.getTime() + 7 * 86400000);
        if (duration === "onemonth") expiresAt = new Date(now.setMonth(now.getMonth() + 1));
        if (duration === "custom" && customEnd) expiresAt = new Date(customEnd);
        if (duration === "lifetime") expiresAt = new Date(now.setFullYear(now.getFullYear() + 50));

        const existingPermission = folder.permissions.find(
            p => p.principal.toString() === user._id.toString()
        );

        if (existingPermission) {
            existingPermission.access = access;
            existingPermission.duration = duration;
            existingPermission.expiresAt = expiresAt;
            existingPermission.used = false;
        } else {
            folder.permissions.push({
                principal: user._id,
                model: "User",
                access,
                duration,
                expiresAt
            });
        }

        folder.updatedBy = owner._id;
        await folder.save();

        // Update logs
        await FolderPermissionLogs.findOneAndUpdate(
            { folder: folder._id, "user.email": user.email },
            {
                requestStatus: "approved",
                expiresAt,
                duration,
                isExternal: false, // Now internal
                approvedBy: owner._id
            },
            { new: true }
        );
        const data = {
            userName: user.name || "User",
            folderName: folder.name,
            access: duration || "Full Access",
            expiresAt,
            companyName: res.locals.companyName || "Our Company",
            logoUrl: res.locals.logo || "",
            bannerUrl: res.locals.mailImg || "",
            folderLink: `${API_CONFIG.baseUrl}/${access}er/${folder._id}`,
            approvedByName: owner.name || "Unknown"
        }
        const html = generateEmailTemplate("folderAccessApproved", data)

        // Send the email
        await sendEmail({
            to: user.email,
            subject: `Folder Access Approved: ${folder.name}`,
            html,
            fromName: "E-sangrah",
        });
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "FolderPermissionLogs",
            action: "ACCESS_APPROVED",
            details: `Approved folder access for user: ${userEmail}`,
            meta: { access, duration }
        });

        return res.json({ success: true, message: "Access granted successfully." });

    } catch (err) {
        console.error("grantFolderAccess error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};


//Folder Permission Logs Controllers

// GET — List permissions for a Folder
export const getFolderPermissions = async (req, res) => {
    try {
        let {
            page = 1,
            limit = 10,
            search = "",
            sortField = "createdAt",
            sortOrder = -1,
            status
        } = req.query;

        const userId = req.user?._id;
        const profileType = req.session?.user.profile_type;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        page = parseInt(page);
        limit = parseInt(limit);

        const query = {};

        // Only restrict by owner if not superadmin
        if (profileType !== 'superadmin') {
            query.owner = userId;
        }

        // Search by username or email
        if (search) {
            query.$or = [
                { "user.username": { $regex: search, $options: "i" } },
                { "user.email": { $regex: search, $options: "i" } }
            ];
        }

        // Filter by status (except "all")
        if (status && status !== "all") {
            query.requestStatus = status;
        }

        const total = await FolderPermissionLogs.countDocuments(query);

        const logs = await FolderPermissionLogs.find(query)
            .populate("owner", "username email")
            .populate("approvedBy", "username email")
            .populate("user", "username email")
            .populate("folder", "name")
            .sort({ [sortField]: sortOrder })
            .skip((page - 1) * limit)
            .limit(limit);

        res.status(200).json({
            success: true,
            data: logs,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("getFolderPermissions error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


export const getFolderAccessByEmail = async (req, res) => {
    try {
        const { folderId } = req.params;
        const { email } = req.query;

        const access = await FolderPermissionLogs.findOne({
            "user.email": email,
            folder: folderId
        }).populate("user", "email.username");

        if (!access)
            return res.json({ success: true, userAccess: null });

        res.json({
            success: true,
            userAccess: {
                access: access.access[0],
                duration: access.duration
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH — Update access or status
export const updateFolderPermissionlog = async (req, res) => {
    try {
        const { logId } = req.params;

        const updated = await FolderPermissionLogs.findByIdAndUpdate(
            logId,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updated)
            return res.status(404).json({ success: false, message: "Permission not found" });
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "FolderPermissionLogs",
            action: "UPDATE_FOLDER_PERMISSION",
            details: `Log Permissions updated for folder: ${folder.name} by ${req.user?.name}`,
            meta: { permissions }
        });

        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE — Remove permission log
export const deleteFolderPermission = async (req, res) => {
    try {
        const { logId } = req.params;

        const removed = await FolderPermissionLogs.findByIdAndDelete(logId);
        if (!removed)
            return res.status(404).json({ success: false, message: "Permission not found" });
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "FolderPermissionLogs",
            action: "REMOVE_FOLDER_PERMISSION",
            details: `Removed Permission for folder: ${folder.name} by ${req.user.name}`,
            meta: { permissions }
        });
        res.status(200).json({ success: true, message: "Permission log deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
