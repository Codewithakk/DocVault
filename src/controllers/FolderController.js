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
import Designation from '../models/Designation.js';
import { formatStorage } from '../helper/Common.js';
import { formatDate, formatFileSize, getFileExtension, getFileIconClass, getFileTypeDisplay, getSharingStatus, isItemShared } from '../helper/CommonHelper.js';
import checkAccessPermission from '../middlewares/checkAccessPermissions.js';
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
        projectId: req.query.id || req.session.selectedProject,
        selectedProjectName: req.session.selectedProjectName,
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

export const showFoldersandFilesPage = async (req, res) => {
    try {
        res.render("pages/folders/viewAllFoldersFiles", {
            pageTitle: "Folder Permission Logs",
            pageDescription: "Track folder-level permission changes and access events.",
            metaKeywords: "folder permission logs, folder access logs, esangrah audit",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            projectId: req.query.id || req.session.selectedProject,
        });

    } catch (err) {
        logger.error("Folder and Files logs render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load folder permission logs.",
            user: req.user,
            message: "Unable to load folder permission logs"
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

export const folderSummary = async (req, res) => {
    try {
        const { departmentId } = req.query;
        const selectedYear = req.session?.selectedYear || null;
        const selectedProjectId = req.session?.selectedProject || null;
        const user = req.session.user;
        const profileType = user?.profile_type;
        const userId = new mongoose.Types.ObjectId(user._id);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        let finalProjectId = null;
        if (selectedProjectId && selectedProjectId !== "all") {
            finalProjectId = new mongoose.Types.ObjectId(selectedProjectId);
        }

        // ====================== FOLDER FILTER ======================
        const folderFilter = {
            isArchived: false,
            isDeleted: false,
            parent: { $exists: true, $ne: null }
        };

        if (finalProjectId) folderFilter.projectId = finalProjectId;
        if (departmentId && departmentId !== "all") {
            folderFilter.departmentId = new mongoose.Types.ObjectId(departmentId);
        }

        // Permission for Folders
        if (profileType !== "superadmin") {
            const accessConditions = [
                { owner: userId },
                { "permissions.principal": userId }
            ];

            if (profileType === "vendor") {
                const vendorFolderIds = await Document.distinct("folderId", {
                    documentVendor: userId,
                    isDeleted: false,
                    isArchived: false,
                });
                if (vendorFolderIds.length) accessConditions.push({ _id: { $in: vendorFolderIds } });
            }

            if (profileType === "donor") {
                const donorFolderIds = await Document.distinct("folderId", {
                    documentDonor: userId,
                    isDeleted: false,
                    isArchived: false,
                });
                if (donorFolderIds.length) accessConditions.push({ _id: { $in: donorFolderIds } });
            }

            folderFilter.$or = accessConditions;
        }

        const folders = await Folder.find(folderFilter).select('_id').lean();
        const folderIds = folders.map(f => f._id);

        // ====================== DOCUMENT FILTER (For accurate file count) ======================
        const documentMatch = {
            isDeleted: false,
            isArchived: false,
        };

        if (finalProjectId) {
            documentMatch.project = finalProjectId;
        }
        if (departmentId && departmentId !== "all") {
            documentMatch.department = new mongoose.Types.ObjectId(departmentId);
        }

        if (profileType !== "superadmin") {
            documentMatch.$or = [
                { owner: userId },
                { sharedWithUsers: userId },
                { "documentApprovalAuthority.userId": userId }
            ];

            if (profileType === "vendor") documentMatch.$or.push({ documentVendor: userId });
            if (profileType === "donor") documentMatch.$or.push({ documentDonor: userId });
        }

        // ====================== FILE COUNT (Using Document.files - Most Accurate) ======================
        let totalFiles = 0;

        if (folderIds.length > 0 || profileType === "superadmin") {
            const fileCountResult = await Document.aggregate([
                { $match: documentMatch },
                {
                    $project: {
                        fileCount: { $size: "$files" }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalFiles: { $sum: "$fileCount" }
                    }
                }
            ]);

            totalFiles = fileCountResult[0]?.totalFiles || 0;
        }

        // ====================== STORAGE ======================
        const storageResult = await File.aggregate([
            {
                $match: {
                    status: "active",
                    ...(finalProjectId && { projectId: finalProjectId }),
                    ...(departmentId && departmentId !== "all" && {
                        departmentId: new mongoose.Types.ObjectId(departmentId)
                    }),
                    ...(profileType !== "superadmin" && folderIds.length > 0 && {
                        folder: { $in: folderIds }
                    })
                }
            },
            {
                $group: {
                    _id: null,
                    totalSize: { $sum: { $ifNull: ["$fileSize", 0] } }
                }
            }
        ]);

        const totalBytes = storageResult[0]?.totalSize || 0;
        const storage = formatStorage(totalBytes);

        // ====================== RESPONSE ======================
        return res.status(200).json({
            success: true,
            message: "Dashboard summary fetched successfully",
            data: {
                totalFolders: folderIds.length,
                totalFiles,           // Now consistent with getFoldersCount logic
                storage,
                permissions: await Designation.countDocuments({ status: "Active" })
            }
        });

    } catch (error) {
        logger.error("Error fetching dashboard summary:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve dashboard summary",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
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

export const folderDirectory = async (req, res) => {
    try {
        const { folderId } = req.params;

        const folder = await Folder.findById(folderId)
            .populate("ancestors", "name")
            .lean();

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: "Folder not found"
            });
        }

        // Build hierarchy with id and name
        const hierarchy = [
            ...(folder.ancestors || []).map((ancestor) => ({
                id: ancestor._id,
                name: ancestor.name,
            })),
            {
                id: folder._id,
                name: folder.name,
            },
        ];

        // Optional: string path
        const folderPath = hierarchy.map((item) => item.name).join("/");

        return res.status(200).json({
            success: true,
            data: {
                path: folderPath,
                hierarchy,
            },
        });

    } catch (err) {
        logger.error("Folder directory error:", err);

        return res.status(500).json({
            success: false,
            message: "Server error while fetching directory",
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
        const { isDeleted = "true", cascade = "true" } = req.query;
        const userId = req.user?._id;

        // Convert query params to boolean
        const markDeleted = isDeleted === "true" || isDeleted === true;
        const cascadeBool = cascade === "true" || cascade === true;

        // Find folder
        const folder = await Folder.findById(folderId);
        if (!folder) {
            return res.status(404).json({ error: "Folder not found." });
        }

        // Update root folder
        folder.isDeleted = markDeleted;
        folder.deletedAt = markDeleted ? new Date() : null;
        folder.status = markDeleted ? "inactive" : "active";
        folder.updatedBy = userId;
        await folder.save();

        // Folder ids whose files need to be updated
        let folderIds = [folder._id];

        if (cascadeBool) {
            // Update descendant folders
            await Folder.updateMany(
                { ancestors: folder._id },
                {
                    $set: {
                        isDeleted: markDeleted,
                        deletedAt: markDeleted ? new Date() : null,
                        status: markDeleted ? "inactive" : "active",
                        updatedBy: userId
                    }
                }
            );

            // Fetch descendant folder ids
            const descendants = await Folder.find(
                { ancestors: folder._id },
                { _id: 1 }
            ).lean();

            folderIds.push(...descendants.map((f) => f._id));
        }

        // Update all files inside affected folders
        await File.updateMany(
            {
                folder: { $in: folderIds }
            },
            {
                $set: {
                    status: markDeleted ? "inactive" : "active",
                    isPrimary: false
                }
            }
        );

        // Activity log
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "Folder",
            action: markDeleted ? "RECYCLE" : "RESTORE",
            details: markDeleted
                ? `Folder moved to recycle bin${cascadeBool ? " with all subfolders" : ""
                }: ${folder.name} by ${req.user?.name}`
                : `Folder restored${cascadeBool ? " with all subfolders" : ""
                }: ${folder.name} by ${req.user?.name}`,
            meta: {
                cascade: cascadeBool,
                previousStatus: markDeleted ? "active" : "inactive",
                newStatus: markDeleted ? "inactive" : "active"
            }
        });

        return res.status(200).json({
            success: true,
            message: markDeleted
                ? `Folder moved to recycle bin${cascadeBool ? " (including subfolders and files)" : ""
                }.`
                : `Folder restored${cascadeBool ? " (including subfolders and files)" : ""
                }.`,
            folder
        });
    } catch (err) {
        console.error("Error updating folder recycle status:", err);
        return res.status(500).json({
            success: false,
            error: "Internal server error."
        });
    }
};

// Delete folder (soft delete) with files
export const deleteFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const ownerId = req.user._id;

        // Find the folder
        const folder = await Folder.findOne({ _id: id, owner: ownerId });
        if (!folder) {
            return res.status(404).json({ success: false, message: "Folder not found" });
        }

        // Get all files in this folder
        const fileIds = folder.files || [];

        // Delete files from database
        if (fileIds.length > 0) {
            await File.deleteMany({ _id: { $in: fileIds } });
        }

        // Delete subfolders recursively with their files
        const subfolders = await Folder.find({
            parent: id,
            owner: ownerId,
            isDeleted: false
        });

        for (const subfolder of subfolders) {
            // Delete files in subfolder
            if (subfolder.files && subfolder.files.length > 0) {
                await File.deleteMany({ _id: { $in: subfolder.files } });
            }
            // Delete subfolder
            await Folder.deleteOne({ _id: subfolder._id });
        }

        // Delete the main folder
        await Folder.deleteOne({ _id: id, owner: ownerId });

        // Log the deletion
        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "Folder",
            action: "DELETE",
            details: `Folder and its contents permanently deleted: ${folder.name} by ${req.user?.name}`,
            meta: {
                filesDeleted: fileIds.length,
                subfoldersDeleted: subfolders.length
            }
        });

        return res.json({
            success: true,
            message: "Folder and all contents permanently deleted",
            data: {
                filesDeleted: fileIds.length,
                subfoldersDeleted: subfolders.length
            }
        });

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
            // isDeleted: true // Uncomment if you're using soft delete
        });

        if (!folders.length) {
            return res.status(404).json({
                success: false,
                message: "No deleted folders found for provided IDs."
            });
        }

        let totalFilesDeleted = 0;
        let totalSubfoldersDeleted = 0;

        for (const folder of folders) {
            // Get files in this folder
            const fileIds = folder.files || [];

            // Delete files from database
            if (fileIds.length > 0) {
                await File.deleteMany({ _id: { $in: fileIds } });
                totalFilesDeleted += fileIds.length;
            }

            // Get and delete subfolders with their files
            const subfolders = await Folder.find({
                parent: folder._id,
                owner: ownerId,
                // isDeleted: true // Uncomment if using soft delete
            });

            for (const subfolder of subfolders) {
                // Delete files in subfolder
                if (subfolder.files && subfolder.files.length > 0) {
                    await File.deleteMany({ _id: { $in: subfolder.files } });
                    totalFilesDeleted += subfolder.files.length;
                }
                // Delete subfolder
                await Folder.deleteOne({ _id: subfolder._id });
                totalSubfoldersDeleted++;
            }

            // Delete the main folder
            await Folder.deleteOne({ _id: folder._id });
            totalSubfoldersDeleted++;
        }

        // Log the deletion
        for (const folder of folders) {
            await activityLogger({
                actorId: ownerId,
                entityId: folder._id,
                entityType: "Folder",
                action: "DELETE",
                details: `Folder permanently deleted with all contents: ${folder.name} by ${req.user?.name}`,
                meta: {
                    totalFilesDeleted,
                    totalSubfoldersDeleted
                }
            });
        }

        res.json({
            success: true,
            message: "Selected folders and their contents permanently deleted.",
            data: {
                foldersDeleted: folders.length,
                filesDeleted: totalFilesDeleted,
                subfoldersDeleted: totalSubfoldersDeleted
            }
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
export const getFoldersCount = async (req, res) => {
    try {
        const { departmentId } = req.query;
        const userId = req.user?._id;
        const profileType = req.user?.profile_type;
        const { selectedProjectId } = getSessionFilters(req);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const projectId = selectedProjectId;
        let finalProjectId = null;

        if (projectId && projectId !== "all") {
            finalProjectId = new mongoose.Types.ObjectId(projectId);
        } else if (selectedProjectId && selectedProjectId !== "all") {
            finalProjectId = new mongoose.Types.ObjectId(selectedProjectId);
        }

        // ====================== FOLDER FILTERING ======================
        const folderMatch = {
            isArchived: false,
            isDeleted: false,
            parent: { $exists: true, $ne: null }
        };

        if (finalProjectId) {
            folderMatch.projectId = finalProjectId;
        }
        if (departmentId && departmentId !== "all") {
            folderMatch.departmentId = new mongoose.Types.ObjectId(departmentId);
        }

        // Permission filtering for folders (existing logic)
        if (profileType !== "superadmin") {
            const accessConditions = [
                { owner: userId },
                { "permissions.principal": userId }
            ];

            if (profileType === "vendor") {
                const vendorFolderIds = await Document.distinct("folderId", {
                    documentVendor: userId,
                    isDeleted: false,
                    isArchived: false,
                });
                accessConditions.push({ _id: { $in: vendorFolderIds } });
            }

            if (profileType === "donor") {
                const donorFolderIds = await Document.distinct("folderId", {
                    documentDonor: userId,
                    isDeleted: false,
                    isArchived: false,
                });
                accessConditions.push({ _id: { $in: donorFolderIds } });
            }

            folderMatch.$or = accessConditions;
        }

        const folders = await Folder.find(folderMatch)
            .select('_id permissions owner')
            .lean();

        const folderIds = folders.map(f => f._id);

        // ====================== DOCUMENT FILTERING (FIXED) ======================
        const documentMatch = {
            isDeleted: false,
            isArchived: false,
        };

        if (finalProjectId) {
            documentMatch.project = finalProjectId;
        }

        if (departmentId && departmentId !== "all") {
            documentMatch.department = new mongoose.Types.ObjectId(departmentId); // Note: fixed field name
        }

        // ✅ IMPORTANT: Apply proper permission filter for normal users
        if (profileType !== "superadmin") {
            documentMatch.$or = [
                { owner: userId },                    // Owner
                { sharedWithUsers: userId },          // Shared directly with user
                // Optional: Also include documents where user is in approval chain
                { "documentApprovalAuthority.userId": userId }
            ];

            // Add vendor/donor specific access
            if (profileType === "vendor") {
                documentMatch.$or.push({ documentVendor: userId });
            }
            if (profileType === "donor") {
                documentMatch.$or.push({ documentDonor: userId });
            }
        }

        // ====================== COUNTS ======================

        // 1. TOTAL FOLDERS
        const totalFolders = folderIds.length;

        // 2. SHARED FOLDERS
        const sharedFolders = folders.filter(f =>
            f.permissions?.some(p =>
                p.principal && p.principal.toString() === userId.toString()
            )
        ).length;

        // 3. Documents with files (WITH DOCUMENTS)
        const fileCountResult = await Document.aggregate([
            { $match: documentMatch },
            {
                $project: {
                    fileCount: { $size: "$files" }
                }
            },
            {
                $group: {
                    _id: null,
                    totalFiles: { $sum: "$fileCount" }
                }
            }
        ]);

        const withDocuments = fileCountResult[0]?.totalFiles || 0;

        // 4. EMPTY FOLDERS
        const activeFiles = await File.find({
            folder: { $in: folderIds },
            status: "active"
        }).distinct('folder');

        const foldersWithFiles = new Set(activeFiles.map(id => id.toString()));
        const emptyFolders = folders.filter(f =>
            !foldersWithFiles.has(f._id.toString())
        ).length;

        return res.status(200).json({
            success: true,
            data: {
                totalFolders,
                withDocuments,
                emptyFolders,
                sharedFolders
            }
        });

    } catch (err) {
        console.error("Get folders count error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching folders count",
            error: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
// export const getFoldersCount = async (req, res) => {
//     try {
//         const { departmentId, projectId } = req.query;
//         const userId = req.user?._id;
//         const profileType = req.user?.profile_type;
//         const { selectedProjectId } = getSessionFilters(req);

//         if (!userId) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Unauthorized",
//             });
//         }

//         let finalProjectId = null;

//         if (projectId && projectId !== "all") {
//             finalProjectId = new mongoose.Types.ObjectId(projectId);
//         } else if (selectedProjectId && selectedProjectId !== "all") {
//             finalProjectId = new mongoose.Types.ObjectId(selectedProjectId);
//         }

//         const baseMatch = {
//             isArchived: false,
//             isDeleted: false,
//             parent: { $exists: true, $ne: null }
//         };

//         if (finalProjectId) {
//             baseMatch.projectId = finalProjectId;
//         }

//         if (departmentId && departmentId !== "all") {
//             baseMatch.departmentId = new mongoose.Types.ObjectId(departmentId);
//         }

//         // Permission filtering
//         if (profileType !== "superadmin") {
//             const accessConditions = [
//                 { owner: userId },
//                 { "permissions.principal": userId }
//             ];

//             if (profileType === "vendor") {
//                 const vendorFolderIds = await Document.distinct("folderId", {
//                     documentVendor: userId,
//                     isDeleted: false,
//                     isArchived: false,
//                 });

//                 accessConditions.push({
//                     _id: { $in: vendorFolderIds }
//                 });
//             }

//             if (profileType === "donor") {
//                 const donorFolderIds = await Document.distinct("folderId", {
//                     documentDonor: userId,
//                     isDeleted: false,
//                     isArchived: false,
//                 });

//                 accessConditions.push({
//                     _id: { $in: donorFolderIds }
//                 });
//             }

//             baseMatch.$or = accessConditions;
//         }

//         const counts = await Folder.aggregate([
//             {
//                 $match: baseMatch
//             },
//             {
//                 $lookup: {
//                     from: "documents",
//                     let: { folderId: "$_id" },
//                     pipeline: [
//                         {
//                             $match: {
//                                 $expr: {
//                                     $eq: ["$folderId", "$$folderId"]
//                                 },
//                                 isDeleted: false,
//                                 isArchived: false,
//                             }
//                         }
//                     ],
//                     as: "documents"
//                 }
//             },
//             {
//                 $group: {
//                     _id: null,

//                     totalFolders: { $sum: 1 },

//                     withDocuments: {
//                         $sum: {
//                             $size: "$documents"
//                         }
//                     },

//                     emptyFolders: {
//                         $sum: {
//                             $cond: [
//                                 {
//                                     $and: [
//                                         { $eq: [{ $size: "$documents" }, 0] },
//                                         {
//                                             $eq: [
//                                                 {
//                                                     $size: {
//                                                         $ifNull: ["$files", []]
//                                                     }
//                                                 },
//                                                 0
//                                             ]
//                                         }
//                                     ]
//                                 },
//                                 1,
//                                 0
//                             ]
//                         }
//                     },
//                     sharedFolders: {
//                         $sum: {
//                             $cond: [
//                                 {
//                                     $gt: [
//                                         {
//                                             $size: {
//                                                 $filter: {
//                                                     input: "$permissions",
//                                                     as: "permission",
//                                                     cond: {
//                                                         $eq: [
//                                                             "$$permission.principal",
//                                                             new mongoose.Types.ObjectId(userId)
//                                                         ]
//                                                     }
//                                                 }
//                                             }
//                                         },
//                                         0
//                                     ]
//                                 },
//                                 1,
//                                 0
//                             ]
//                         }
//                     }
//                 }
//             }
//         ]);

//         const result = counts.length
//             ? counts[0]
//             : {
//                   totalFolders: 0,
//                   withDocuments: 0,
//                   emptyFolders: 0,
//                   sharedFolders: 0
//               };

//         return res.status(200).json({
//             success: true,
//             data: result
//         });

//     } catch (err) {
//         console.error("Get folders count error:", err);
//         return res.status(500).json({
//             success: false,
//             message: "Server error while fetching folders count",
//             error: process.env.NODE_ENV === "development" ? err.message : undefined,
//         });
//     }
// };
// Get folder tree structure including files with selected fields

// export const getFolderTree = async (req, res) => {
//     try {
//         const { rootId, departmentId, projectId, sort = "name_asc", filter = "lastModified" } = req.query;
//         const userId = req.user?._id;
//         const profileType = req.user?.profile_type;
//         const { selectedProjectId } = getSessionFilters(req);

//         if (!userId) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Unauthorized",
//             });
//         }

//         /* -----------------------------------
//          * SET PROJECT FILTER PRIORITY
//          * ----------------------------------- */
//         let finalProjectId = null;

//         if (projectId && projectId !== "all") {
//             finalProjectId = new mongoose.Types.ObjectId(projectId);
//         } else if (selectedProjectId && selectedProjectId !== "all") {
//             finalProjectId = new mongoose.Types.ObjectId(selectedProjectId);
//         }

//         /* -----------------------------------
//          * SORT CONFIGURATION (for database query)
//          * ----------------------------------- */
//         let sortStage = { name: 1 };

//         if (filter === "lastModified") {
//             sortStage = sort === "updatedAt_asc" ? { updatedAt: 1 } : { updatedAt: -1 };
//         } else {
//             switch (sort) {
//                 case "name_desc":
//                     sortStage = { name: -1 };
//                     break;
//                 case "updatedAt_desc":
//                     sortStage = { updatedAt: -1 };
//                     break;
//                 case "updatedAt_asc":
//                     sortStage = { updatedAt: 1 };
//                     break;
//                 default:
//                     sortStage = { name: 1 };
//             }
//         }

//         /* -----------------------------------
//          * BASE MATCH QUERY
//          * ----------------------------------- */
//         const match = {
//             isArchived: false,
//             deletedAt: null,
//         };

//         if (finalProjectId) {
//             match.projectId = finalProjectId;
//         }

//         // Permission filtering
//         if (profileType !== "superadmin") {
//             const accessConditions = [
//                 { owner: userId },
//                 { "permissions.principal": userId }
//             ];

//             if (profileType === "vendor") {
//                 accessConditions.push({
//                     _id: {
//                         $in: await Document.distinct("folderId", {
//                             documentVendor: userId,
//                             isDeleted: false,
//                             isArchived: false
//                         })
//                     }
//                 });
//             }

//             if (profileType === "donor") {
//                 accessConditions.push({
//                     _id: {
//                         $in: await Document.distinct("folderId", {
//                             documentDonor: userId,
//                             isDeleted: false,
//                             isArchived: false
//                         })
//                     }
//                 });
//             }

//             match.$or = accessConditions;
//         }

//         /* -----------------------------------
//          * OPTIONAL: DEPARTMENT FILTER
//          * ----------------------------------- */
//         let departmentFolderIds = [];

//         if (departmentId && departmentId !== "all") {
//             const departmentFilter = {
//                 isArchived: false,
//                 deletedAt: null,
//                 departmentId: new mongoose.Types.ObjectId(departmentId),
//             };

//             if (finalProjectId) {
//                 departmentFilter.projectId = finalProjectId;
//             }

//             const deptFolders = await Folder.find(
//                 departmentFilter,
//                 { _id: 1 }
//             ).lean();

//             if (!deptFolders.length) {
//                 return res.json({ success: true, tree: [] });
//             }

//             departmentFolderIds = deptFolders.map(f => f._id);

//             if (!match.$or) match.$or = [];

//             match.$or.push(
//                 { _id: { $in: departmentFolderIds } },
//                 { ancestors: { $in: departmentFolderIds } }
//             );
//         }

//         /* -----------------------------------
//          * FETCH FOLDERS
//          * ----------------------------------- */
//         const folders = await Folder.aggregate([
//             { $match: match },
//             {
//                 $lookup: {
//                     from: "projects",
//                     localField: "projectId",
//                     foreignField: "_id",
//                     as: "projectId"
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "departments",
//                     localField: "departmentId",
//                     foreignField: "_id",
//                     as: "departmentId"
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "files",
//                     localField: "files",
//                     foreignField: "_id",
//                     as: "files"
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "documents",
//                     let: { folderId: "$_id" },
//                     pipeline: [
//                         {
//                             $match: {
//                                 $expr: {
//                                     $eq: ["$folderId", "$$folderId"]
//                                 },
//                                 isDeleted: false,
//                                 isArchived: false
//                             }
//                         },
//                         {
//                             $count: "count"
//                         }
//                     ],
//                     as: "documentCount"
//                 }
//             },
//             {
//                 $project: {
//                     name: 1,
//                     slug: 1,
//                     path: 1,
//                     parent: 1,
//                     status: 1,
//                     owner: 1,
//                     updatedAt: 1,
//                     permissions: 1,
//                     projectId: { $arrayElemAt: ["$projectId", 0] },
//                     departmentId: { $arrayElemAt: ["$departmentId", 0] },
//                     totalDocument: {
//                         $ifNull: [
//                             { $arrayElemAt: ["$documentCount.count", 0] },
//                             0
//                         ]
//                     },
//                     files: {
//                         $map: {
//                             input: "$files",
//                             as: "f",
//                             in: {
//                                 _id: "$$f._id",
//                                 file: "$$f.file",
//                                 originalName: "$$f.originalName",
//                                 fileType: "$$f.fileType",
//                                 fileUrl: "$$f.s3Url",
//                                 size: "$$f.fileSize",
//                                 updatedAt: "$$f.updatedAt",
//                             }
//                         }
//                     }
//                 }
//             },
//             // Apply sort at database level for root folders
//             { $sort: sortStage }
//         ]);

//         if (!folders.length) {
//             return res.json({ success: true, tree: [] });
//         }

//         const enhanced = folders.map(f => ({
//             ...f,
//             isOwner: f.owner?.toString() === userId.toString()
//         }));

//         /* -----------------------------------
//          * BUILD TREE STRUCTURE
//          * ----------------------------------- */
//         const map = new Map();
//         enhanced.forEach(f => {
//             map.set(f._id.toString(), { ...f, children: [] });
//         });

//         const roots = [];

//         for (const folder of map.values()) {
//             if (folder.parent) {
//                 const parent = map.get(folder.parent.toString());
//                 if (parent) {
//                     parent.children.push(folder);
//                 } else {
//                     roots.push(folder);
//                 }
//             } else {
//                 roots.push(folder);
//             }
//         }

//         // /* -----------------------------------
//         //  * RECURSIVE SORT FUNCTION FOR CHILDREN
//         //  * ----------------------------------- */
//         // const sortChildrenRecursively = (node) => {
//         //     if (node.children && node.children.length > 0) {
//         //         // Determine sort order based on sort parameter
//         //         const sortBy = sort; // 'name_desc', 'name_asc', etc.
//         //         const sortField = sortBy.includes('updatedAt') ? 'updatedAt' : 'name';
//         //         const sortOrder = sortBy.includes('_desc') ? -1 : 1;

//         //         // Sort children
//         //         node.children.sort((a, b) => {
//         //             if (sortField === 'name') {
//         //                 // Name sort
//         //                 const comparison = a.name.localeCompare(b.name);
//         //                 return sortOrder * comparison;
//         //             } else {
//         //                 // Date sort
//         //                 const dateA = new Date(a.updatedAt);
//         //                 const dateB = new Date(b.updatedAt);
//         //                 return sortOrder * (dateA - dateB);
//         //             }
//         //         });

//         //         // Recursively sort children of children
//         //         node.children.forEach(child => sortChildrenRecursively(child));
//         //     }
//         // };

//         // /* -----------------------------------
//         //  * APPLY FILTERING TO CHILDREN
//         //  * ----------------------------------- */
//         // const filterChildrenRecursively = (node) => {
//         //     if (node.children && node.children.length > 0) {
//         //         if (departmentFolderIds.length > 0) {
//         //             const deptIdSet = new Set(departmentFolderIds.map(id => id.toString()));
//         //             // Keep only children that are in the department folder IDs or have department folders as ancestors
//         //             node.children = node.children.filter(child => {
//         //                 // Check if child itself is a department folder
//         //                 if (deptIdSet.has(child._id.toString())) return true;
//         //                 // Check if any ancestor is a department folder
//         //                 return child.ancestors?.some(ancestor => deptIdSet.has(ancestor.toString()));
//         //             });
//         //         }

//         //         // Recursively filter children of children
//         //         node.children.forEach(child => filterChildrenRecursively(child));

//         //         // After filtering, sort the remaining children
//         //         sortChildrenRecursively(node);
//         //     }
//         // };
//         const searchTerm = req.query.search?.toLowerCase();
//         const applyOperations = (node) => {
//             if (!node.children?.length) return;

//             // Process children first
//             node.children.forEach(child => applyOperations(child));

//             // Department filter
//             if (departmentId && departmentId !== "all") {
//                 node.children = node.children.filter(child => {
//                     const belongs =
//                         child.departmentId &&
//                         child.departmentId._id?.toString() === departmentId;

//                     return belongs || child.children.length > 0;
//                 });
//             }

//             // Search
//             if (searchTerm) {
//                 node.children = node.children.filter(child => {
//                     const match = child.name
//                         .toLowerCase()
//                         .includes(searchTerm);

//                     return match || child.children.length > 0;
//                 });
//             }

//             // Sort
//             node.children.sort((a, b) => {
//                 switch (sort) {
//                     case "name_desc":
//                         return b.name.localeCompare(a.name);

//                     case "updatedAt_desc":
//                         return new Date(b.updatedAt) - new Date(a.updatedAt);

//                     case "updatedAt_asc":
//                         return new Date(a.updatedAt) - new Date(b.updatedAt);

//                     default:
//                         return a.name.localeCompare(b.name);
//                 }
//             });
//         };
//         /* -----------------------------------
//          * BUILD FINAL TREE
//          * ----------------------------------- */
//         let tree = [];

//         if (rootId) {
//             const root = map.get(rootId.toString());
//             if (root) {
//                 // Apply filtering and sorting to the root's children
//                 // filterChildrenRecursively(root);
//                 // sortChildrenRecursively(root);
//                 applyOperations(root);
//                 tree = [root];
//             }
//         } else if (departmentFolderIds.length) {
//             const departmentFolderIdSet = new Set(
//                 departmentFolderIds.map(id => id.toString())
//             );

//             tree = departmentFolderIds
//                 .map(id => map.get(id.toString()))
//                 .filter(folder => {
//                     if (!folder) return false;
//                     return (
//                         !folder.parent ||
//                         !departmentFolderIdSet.has(folder.parent.toString())
//                     );
//                 });

//             // Sort and filter children for each root department folder
//             tree.forEach(root => {
//                 // filterChildrenRecursively(root);
//                 // sortChildrenRecursively(root);
//                 applyOperations(root);
//             });
//         } else {
//             tree = roots;
//             // Sort and filter children for all root folders
//             tree.forEach(root => {
//                 // filterChildrenRecursively(root);
//                 // sortChildrenRecursively(root);
//                 applyOperations(root);
//             });
//         }

//         // If there's a search term (name filter), filter the entire tree
//         // const searchTerm = req.query.search?.toLowerCase();
//         // if (searchTerm) {
//         //     const filterTreeBySearch = (nodes) => {
//         //         return nodes.filter(node => {
//         //             const matchesSearch = node.name.toLowerCase().includes(searchTerm);
//         //             if (matchesSearch) return true;

//         //             // Recursively filter children
//         //             if (node.children && node.children.length > 0) {
//         //                 node.children = filterTreeBySearch(node.children);
//         //                 return node.children.length > 0;
//         //             }

//         //             return false;
//         //         });
//         //     };

//         //     tree = filterTreeBySearch(tree);
//         // }

//         return res.json({
//             success: true,
//             tree
//         });

//     } catch (err) {
//         console.error("Get folder tree error:", err);
//         return res.status(500).json({
//             success: false,
//             message: "Server error while fetching folder tree",
//             error: process.env.NODE_ENV === "development" ? err.message : undefined,
//         });
//     }
// };
export const getFolderTree = async (req, res) => {
    try {
        const { rootId, departmentId, projectId, folderId, sort = "name_asc", filter = "lastModified", show, parentOnly } = req.query;
        const userId = req.user?._id;
        const profileType = req.user?.profile_type;
        const { selectedProjectId } = getSessionFilters(req);
        const permissions = req.accessPermission;

        // Get login user's designation and department (for permission checking)
        const userDesignationId = req.session?.user?.userDetails?.designation;
        const userDepartmentId = req.session?.user?.userDetails?.department;

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
         * SORT CONFIGURATION (for database query)
         * ----------------------------------- */
        let sortStage = { name: 1 };

        if (filter === "lastModified") {
            sortStage = sort === "updatedAt_asc" ? { updatedAt: 1 } : { updatedAt: -1 };
        } else {
            switch (sort) {
                case "name_desc":
                    sortStage = { name: -1 };
                    break;
                case "updatedAt_desc":
                    sortStage = { updatedAt: -1 };
                    break;
                case "updatedAt_asc":
                    sortStage = { updatedAt: 1 };
                    break;
                default:
                    sortStage = { name: 1 };
            }
        }

        /* -----------------------------------
         * BASE MATCH QUERY
         * NOTE: isDeleted (not deletedAt) to match getFoldersCount's baseMatch
         * ----------------------------------- */
        const match = {
            isArchived: false,
            isDeleted: false,
        };

        if (finalProjectId) {
            match.projectId = finalProjectId;
        }

        if (profileType !== "superadmin") {
            if (permissions?.allOrganizations) {
                // No restriction at all - skip building any $or.
            } else {
                const accessConditions = [];

                // OWN: User's own folders
                if (permissions?.own) {
                    accessConditions.push({ owner: userId });
                }

                // TEAM: folders explicitly shared with the user
                if (permissions?.team) {
                    accessConditions.push({ "permissions.principal": userId });
                }

                // DEPARTMENT: user's own department only
                if (permissions?.department && userDepartmentId) {
                    accessConditions.push({
                        $and: [
                            {
                                departmentId: new mongoose.Types.ObjectId(userDepartmentId)
                            },
                            {
                                $or: [
                                    { owner: userId },
                                    { "permissions.principal": userId }
                                ]
                            }
                        ]
                    });
                }

                // OTHER DEPARTMENTS: any department other than the user's own
                if (permissions?.otherDepartments) {
                    const departmentCondition = userDepartmentId
                        ? {
                            departmentId: {
                                $ne: new mongoose.Types.ObjectId(userDepartmentId),
                            },
                        }
                        : {
                            departmentId: { $ne: null },
                        };

                    accessConditions.push({
                        $and: [
                            departmentCondition,
                            {
                                $or: [
                                    { owner: userId },
                                    { "permissions.principal": userId },
                                ],
                            },
                        ],
                    });
                }

                // Vendor specific
                if (profileType === "vendor") {
                    const vendorFolderIds = await Document.distinct("folderId", {
                        documentVendor: userId,
                        isDeleted: false,
                        isArchived: false,
                    });
                    accessConditions.push({ _id: { $in: vendorFolderIds } });
                }

                // Donor specific
                if (profileType === "donor") {
                    const donorFolderIds = await Document.distinct("folderId", {
                        documentDonor: userId,
                        isDeleted: false,
                        isArchived: false,
                    });
                    accessConditions.push({ _id: { $in: donorFolderIds } });
                }

                if (accessConditions.length > 0) {
                    match.$or = accessConditions;
                } else {
                    // No permission flag granted anything -> deny access
                    // entirely instead of defaulting to unrestricted.
                    return res.json({ success: true, tree: [] });
                }
            }
        }

        let departmentFolderIds = [];

        if (departmentId && departmentId !== "all") {
            const departmentFilter = {
                isArchived: false,
                isDeleted: false,
                departmentId: new mongoose.Types.ObjectId(departmentId),
            };

            if (finalProjectId) {
                departmentFilter.projectId = finalProjectId;
            }

            // Respect the same access restriction already computed above.
            if (match.$or) {
                departmentFilter.$or = match.$or;
            }

            const deptFolders = await Folder.find(
                departmentFilter,
                { _id: 1 }
            ).lean();

            if (!deptFolders.length) {
                return res.json({ success: true, tree: [] });
            }

            departmentFolderIds = deptFolders.map(f => f._id);

            const deptOr = [
                { _id: { $in: departmentFolderIds } },
                { ancestors: { $in: departmentFolderIds } },
            ];

            if (match.$or) {
                // AND the permission $or together with the department $or
                match.$and = (match.$and || []).concat([
                    { $or: match.$or },
                    { $or: deptOr },
                ]);
                delete match.$or;
            } else {
                match.$or = deptOr;
            }
        }

        /* -----------------------------------
         * FETCH FOLDERS
         * ----------------------------------- */
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
                $lookup: {
                    from: "users",
                    localField: "files.uploadedBy",
                    foreignField: "_id",
                    as: "uploadedUsers"
                }
            },
            {
                $lookup: {
                    from: "documents",
                    let: { folderId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$folderId", "$$folderId"]
                                },
                                isDeleted: false,
                                isArchived: false
                            }
                        },
                        {
                            $count: "count"
                        }
                    ],
                    as: "documentCount"
                }
            },
            {
                $lookup: {
                    from: "folders",
                    let: { folderId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$parent", "$$folderId"] },
                                isDeleted: false,
                                isArchived: false
                            }
                        },
                        { $count: "count" }
                    ],
                    as: "subfolderCountArr"
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
                    updatedAt: 1,
                    permissions: 1,
                    projectId: { $arrayElemAt: ["$projectId", 0] },
                    departmentId: { $arrayElemAt: ["$departmentId", 0] },
                    totalDocument: {
                        $ifNull: [
                            { $arrayElemAt: ["$documentCount.count", 0] },
                            0
                        ]
                    },
                    subfolderCount: {
                        $ifNull: [
                            { $arrayElemAt: ["$subfolderCountArr.count", 0] },
                            0
                        ]
                    },
                    fileCount: { $size: { $ifNull: ["$files", []] } },
                    itemCount: {
                        $add: [
                            { $ifNull: [{ $arrayElemAt: ["$subfolderCountArr.count", 0] }, 0] },
                            { $size: { $ifNull: ["$files", []] } }
                        ]
                    },
                    files: {
                        $map: {
                            input: "$files",
                            as: "f",
                            in: {
                                _id: "$$f._id",
                                file: "$$f.file",
                                originalName: "$$f.originalName",
                                uploadedBy: {
                                    $let: {
                                        vars: {
                                            user: {
                                                $arrayElemAt: [
                                                    {
                                                        $filter: {
                                                            input: "$uploadedUsers",
                                                            as: "u",
                                                            cond: { $eq: ["$$u._id", "$$f.uploadedBy"] }
                                                        }
                                                    },
                                                    0
                                                ]
                                            }
                                        },
                                        in: "$$user.name"
                                    }
                                },
                                fileType: "$$f.fileType",
                                fileUrl: "$$f.s3Url",
                                status: "$$f.status",
                                size: "$$f.fileSize",
                                updatedAt: "$$f.updatedAt",
                            }
                        }
                    }
                }
            },
            // Apply sort at database level for root folders
            { $sort: sortStage }
        ]);

        if (!folders.length) {
            return res.json({ success: true, tree: [] });
        }

        const enhanced = folders.map(f => ({
            ...f,
            isOwner: f.owner?.toString() === userId.toString()
        }));

        /* -----------------------------------
         * BUILD TREE STRUCTURE
         * ----------------------------------- */
        const map = new Map();
        enhanced.forEach(f => {
            map.set(f._id.toString(), { ...f, children: [] });
        });

        const roots = [];

        for (const folder of map.values()) {
            if (folder.parent) {
                const parent = map.get(folder.parent.toString());
                if (parent) {
                    parent.children.push(folder);
                } else {
                    roots.push(folder);
                }
            } else {
                roots.push(folder);
            }
        }

        const searchTerm = req.query.search?.toLowerCase();
        const applyOperations = (node) => {
            if (!node.children?.length) return;

            // Process children first
            node.children.forEach(child => applyOperations(child));

            // Department filter (from query param - for filtering results)
            if (departmentId && departmentId !== "all") {
                node.children = node.children.filter(child => {
                    const belongs =
                        child.departmentId &&
                        child.departmentId._id?.toString() === departmentId;

                    return belongs || child.children.length > 0;
                });
            }

            // Search
            if (searchTerm) {
                node.children = node.children.filter(child => {
                    const match = child.name
                        .toLowerCase()
                        .includes(searchTerm);

                    return match || child.children.length > 0;
                });
            }

            // Sort
            node.children.sort((a, b) => {
                switch (sort) {
                    case "name_desc":
                        return b.name.localeCompare(a.name);

                    case "updatedAt_desc":
                        return new Date(b.updatedAt) - new Date(a.updatedAt);

                    case "updatedAt_asc":
                        return new Date(a.updatedAt) - new Date(b.updatedAt);

                    default:
                        return a.name.localeCompare(b.name);
                }
            });
        };

        /* -----------------------------------
         * BUILD FINAL TREE
         * ----------------------------------- */
        let tree = [];

        if (rootId) {
            const root = map.get(rootId.toString());
            if (root) {
                applyOperations(root);
                tree = [root];
            }
        } else if (departmentFolderIds.length) {
            const departmentFolderIdSet = new Set(
                departmentFolderIds.map(id => id.toString())
            );

            tree = departmentFolderIds
                .map(id => map.get(id.toString()))
                .filter(folder => {
                    if (!folder) return false;
                    return (
                        !folder.parent ||
                        !departmentFolderIdSet.has(folder.parent.toString())
                    );
                });

            tree.forEach(root => {
                applyOperations(root);
            });
        } else {
            tree = roots;
            tree.forEach(root => {
                applyOperations(root);
            });
        }

        /* -----------------------------------
         * APPLY PARENT-ONLY AND SHOW FILTERS
         * Skip these filters when departmentId is passed
         * ----------------------------------- */
        const hasDepartmentFilter = departmentId && departmentId !== "all";

        if (!hasDepartmentFilter) {
            if (parentOnly !== undefined) {
                const filterByParent = (folders) => {
                    const filteredFolders = folders.filter(folder => {
                        const hasChildren = folder.children && folder.children.length > 0;

                        // Recursively filter children first
                        if (hasChildren) {
                            folder.children = filterByParent(folder.children);
                        }
                        return folder.parent != null || (hasChildren && folder.children.length > 0);
                    });

                    return filteredFolders;
                };

                tree = filterByParent(tree);
            }

            /* -----------------------------------
             * APPLY SHOW FILTER (Empty, Shared, Total)
             * Skip when departmentId is present
             * ----------------------------------- */
            if (show && ['Empty', 'Shared', 'Total'].includes(show)) {
                const flatFolders = enhanced.filter(f => f.parent != null);

                const matchesShow = (folder) => {
                    const hasDocuments = folder.totalDocument > 0;
                    const hasFiles = (folder.files?.length || 0) > 0;
                    const isShared = folder.permissions?.some(
                        p => p.principal?.toString() === userId.toString()
                    );
                    const isNotOwner = folder.owner?.toString() !== userId.toString();

                    switch (show) {
                        case 'Empty':
                            return !hasDocuments && !hasFiles;
                        case 'Shared':
                            return isShared && !folder.isOwner;
                        case 'Total':
                            return true;
                        default:
                            return true;
                    }
                };

                const flatMatched = flatFolders
                    .filter(matchesShow)
                    .map(f => ({ ...f, children: [] })); // flattened: no nested children

                tree = [{
                    _id: "root-folder",
                    name: "All Folders",
                    slug: "folder",
                    path: "/folder",
                    parent: null,
                    status: "active",
                    owner: userId,
                    isOwner: true,
                    totalDocument: flatMatched.reduce((sum, folder) => sum + (folder.totalDocument || 0), 0),
                    children: flatMatched
                }];
            }
        }
        if (folderId) {
            const selectedFolder = map.get(folderId.toString());

            if (!selectedFolder) {
                return res.json({
                    success: true,
                    tree: []
                });
            }

            // If it has a parent, return parent -> selectedFolder
            if (selectedFolder.parent) {
                const parentFolder = map.get(selectedFolder.parent.toString());

                if (parentFolder) {
                    tree = [{
                        ...parentFolder,
                        children: parentFolder.children.filter(
                            child => child._id.toString() === folderId.toString()
                        )
                    }];
                } else {
                    tree = [selectedFolder];
                }
            } else {
                // Selected folder is a root folder
                tree = [selectedFolder];
            }
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

        if (typeof isArchived === "string") {
            isArchived = isArchived === "true";
        }

        const folder = await Folder.findOne({
            _id: id,
            owner: ownerId,
            deletedAt: null
        });

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: "Folder not found"
            });
        }

        // Get current folder + all descendants
        const folders = await Folder.find({
            $or: [
                { _id: folder._id },
                { ancestors: folder._id }
            ]
        }).select("_id");

        const folderIds = folders.map(f => f._id);

        // Archive/Unarchive folders
        await Folder.updateMany(
            { _id: { $in: folderIds } },
            {
                $set: {
                    isArchived,
                    updatedBy: ownerId
                }
            }
        );

        // Make all files inactive/active
        await File.updateMany(
            { folder: { $in: folderIds } },
            {
                $set: {
                    status: isArchived ? "inactive" : "active"
                }
            }
        );

        await activityLogger({
            actorId: req.user._id,
            entityId: folder._id,
            entityType: "Folder",
            action: isArchived ? "ARCHIVE" : "UNARCHIVE",
            details: `${isArchived ? "Archived" : "Unarchived"} folder: ${folder.name} by ${req.user?.name}`,
            meta: {}
        });

        return res.json({
            success: true,
            message: isArchived
                ? "Folder and its files archived successfully"
                : "Folder and its files restored successfully"
        });

    } catch (err) {
        console.error("Archive/Unarchive folder error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while updating folder archive state"
        });
    }
};

export const getRecycleBinFolders = async (req, res) => {
    try {
        const user = req.user;
        const ownerId = user._id;
        const profileType = user.profile_type;
        const selectedProjectId = req.session.selectedProject || null;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || "";
        const sortBy = req.query.sortBy || "deletedAt";
        const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
        const departmentId = req.query.department || null;
        const itemType = req.query.itemType || "all"; // 'all', 'file', 'folder'

        // Base filters
        const baseFilters = {
            ...(departmentId && { departmentId }),
            ...(selectedProjectId && { projectId: selectedProjectId })
        };

        // Build queries for folders and files
        const folderQuery = {
            isDeleted: true,
            ...baseFilters,
            ...(profileType !== "superadmin" && { owner: ownerId })
        };

        const fileQuery = {
            status: "inactive", // Files in recycle bin
            ...baseFilters,
            ...(profileType !== "superadmin" && { uploadedBy: ownerId })
        };

        // Add search
        if (search) {
            folderQuery.$or = [
                { name: { $regex: search, $options: "i" } }
            ];
            fileQuery.$or = [
                { originalName: { $regex: search, $options: "i" } },
                { fileType: { $regex: search, $options: "i" } }
            ];
        }

        // Determine which queries to run
        let folderItems = [];
        let fileItems = [];
        let folderTotal = 0;
        let fileTotal = 0;

        const queryPromises = [];

        // Fetch folders if needed - DO NOT apply skip/limit here
        if (itemType === "all" || itemType === "folder") {
            queryPromises.push(
                Folder.find(folderQuery)
                    .populate("departmentId", "name")
                    .populate("projectId", "projectName")
                    .populate("owner", "name email")
                    .populate("createdBy", "name")
                    .populate("updatedBy", "name")
                    .lean()
                    .then(items => {
                        folderItems = items;
                        return Folder.countDocuments(folderQuery);
                    })
                    .then(count => {
                        folderTotal = count;
                    })
            );
        }

        // Fetch files if needed - DO NOT apply skip/limit here
        if (itemType === "all" || itemType === "file") {
            queryPromises.push(
                File.find(fileQuery)
                    .populate("departmentId", "name")
                    .populate("projectId", "projectName")
                    .populate("uploadedBy", "name email")
                    .populate("folder", "name")
                    .lean()
                    .then(items => {
                        fileItems = items;
                        return File.countDocuments(fileQuery);
                    })
                    .then(count => {
                        fileTotal = count;
                    })
            );
        }

        await Promise.all(queryPromises);

        // Transform items to unified format
        const unifiedItems = [];

        // Add folders
        folderItems.forEach(folder => {
            unifiedItems.push({
                _id: folder._id,
                itemType: 'folder',
                name: folder.name,
                slug: folder.slug,
                path: folder.path,
                depth: folder.depth,
                owner: folder.owner,
                projectId: folder.projectId,
                departmentId: folder.departmentId,
                size: folder.size || 0,
                status: folder.status,
                isDeleted: folder.isDeleted,
                deletedAt: folder.deletedAt,
                isArchived: folder.isArchived,
                parent: folder.parent,
                ancestors: folder.ancestors,
                permissions: folder.permissions,
                createdBy: folder.createdBy,
                updatedBy: folder.updatedBy,
                createdAt: folder.createdAt,
                updatedAt: folder.updatedAt,
                fileCount: folder.files?.length || 0,
                _folderData: {
                    files: folder.files,
                    metadata: folder.metadata
                }
            });
        });

        // Add files
        fileItems.forEach(file => {
            unifiedItems.push({
                _id: file._id,
                itemType: 'file',
                name: file.originalName,
                originalName: file.originalName,
                file: file.file,
                s3Url: file.s3Url,
                fileType: file.fileType,
                version: file.version,
                uploadedBy: file.uploadedBy,
                folder: file.folder,
                projectId: file.projectId,
                departmentId: file.departmentId,
                fileSize: file.fileSize || 0,
                size: file.fileSize || 0,
                hash: file.hash,
                uploadedAt: file.uploadedAt,
                isPrimary: file.isPrimary,
                status: file.status,
                document: file.document,
                createdAt: file.createdAt,
                updatedAt: file.updatedAt,
                _fileData: {
                    activityLog: file.activityLog,
                    version: file.version
                }
            });
        });

        // Sort unified items
        unifiedItems.sort((a, b) => {
            const aVal = a[sortBy] || a.deletedAt || a.createdAt;
            const bVal = b[sortBy] || b.deletedAt || b.createdAt;
            if (sortOrder === 1) {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        // Calculate totals
        const total = folderTotal + fileTotal;
        const totalPages = Math.ceil(total / limit);

        // Paginate unified items - THIS IS WHERE WE APPLY SKIP/LIMIT
        const startIndex = (page - 1) * limit;
        const paginatedItems = unifiedItems.slice(startIndex, startIndex + limit);

        return res.json({
            success: true,
            items: paginatedItems,
            total,
            page,
            totalPages,
            limit,
            stats: {
                folders: folderTotal,
                files: fileTotal
            }
        });

    } catch (err) {
        console.error("Error fetching recycle bin items:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching recycle bin items",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
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

export const restoreFile = async (req, res) => {
    try {
        const { id } = req.params;

        // Use uploadedBy since File schema has no owner field
        const file = await File.findOne({
            _id: id,
            uploadedBy: req.user._id
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                message: "File not found"
            });
        }

        // Restore file
        file.isDeleted = false;      // if this field exists
        file.deletedAt = null;       // if this field exists
        file.status = "active";

        await file.save();

        await activityLogger({
            actorId: req.user._id,
            entityId: file._id,
            entityType: "File",
            action: "RESTORE",
            details: `File restored: ${file.originalName} by ${req.user?.name}`,
            meta: {}
        });

        return res.json({
            success: true,
            message: "File restored successfully",
            file
        });

    } catch (err) {
        console.error("Error restoring file:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while restoring file"
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
            .populate('permissions.principal', 'name email')
            .lean();

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

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

        // If nothing is shared
        if (usersWithAccess.length === 0 && shareLinks.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No sharing information found.",
                folderId: folder._id,
                departmentId: folder.departmentId,
                folderName: folder.name,
                usersWithAccess: [],
                shareLinks: []
            });
        }

        return res.json({
            success: true,
            folderId: folder._id,
            departmentId: folder.departmentId,
            folderName: folder.name,
            usersWithAccess,
            shareLinks
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
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

export const allFoldersFiles = async (req, res) => {
    try {
        const user = req.user;
        const ownerId = user._id;
        const profileType = user.profile_type;
        const selectedProjectId = req.session.selectedProject || null;
        const permissions = req.accessPermission;

        // Get login user's designation and department (for permission checking)
        const userDesignationId = req.session?.user?.userDetails?.designation;
        const userDepartmentId = req.session?.user?.userDetails?.department;

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        // Filter parameters
        const search = req.query.search || "";
        const sortBy = req.query.sortBy || "updatedAt";
        const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
        const departmentId = req.query.department || null;
        const itemType = req.query.itemType || "all";
        const viewFilter = req.query.viewFilter || null;
        const parentFolderId = req.query.parentFolder || null;

        // Base filters for folders
        const folderBaseFilters = {
            isDeleted: false,
            ...(departmentId && departmentId !== 'null' && { departmentId }),
            ...(selectedProjectId && { projectId: selectedProjectId })
        };

        // Base filters for files
        const fileBaseFilters = {
            ...(departmentId && departmentId !== 'null' && { departmentId }),
            ...(selectedProjectId && { projectId: selectedProjectId })
        };

        // Build permission conditions
        let folderPermissionConditions = [];
        let filePermissionConditions = [];

        if (profileType !== "superadmin") {
            if (permissions?.allOrganizations) {
                // No restriction at all
            } else {
                // OWN: User's own folders/files
                if (permissions?.own) {
                    folderPermissionConditions.push({ owner: ownerId });
                    filePermissionConditions.push({ uploadedBy: ownerId });
                }

                // TEAM: items explicitly shared with the user
                if (permissions?.team) {
                    folderPermissionConditions.push({ "permissions.principal": ownerId });
                    filePermissionConditions.push({ "permissions.principal": ownerId });
                }

                // DEPARTMENT: user's own department only
                if (permissions?.department && userDepartmentId) {
                    const deptId = new mongoose.Types.ObjectId(userDepartmentId);

                    folderPermissionConditions.push({
                        $and: [
                            { departmentId: deptId },
                            {
                                $or: [
                                    { owner: ownerId },
                                    { "permissions.principal": ownerId }
                                ]
                            }
                        ]
                    });

                    filePermissionConditions.push({
                        $and: [
                            { departmentId: deptId },
                            {
                                $or: [
                                    { uploadedBy: ownerId },
                                    { "permissions.principal": ownerId }
                                ]
                            }
                        ]
                    });
                }

                // OTHER DEPARTMENTS: any department other than the user's own
                if (permissions?.otherDepartments) {
                    const departmentCondition = userDepartmentId
                        ? {
                            departmentId: {
                                $ne: new mongoose.Types.ObjectId(userDepartmentId),
                            },
                        }
                        : {
                            departmentId: { $ne: null },
                        };

                    folderPermissionConditions.push({
                        $and: [
                            departmentCondition,
                            {
                                $or: [
                                    { owner: ownerId },
                                    { "permissions.principal": ownerId },
                                ],
                            },
                        ],
                    });

                    filePermissionConditions.push({
                        $and: [
                            departmentCondition,
                            {
                                $or: [
                                    { uploadedBy: ownerId },
                                    { "permissions.principal": ownerId },
                                ],
                            },
                        ],
                    });
                }

                // Vendor specific
                if (profileType === "vendor") {
                    const vendorFolderIds = await Document.distinct("folderId", {
                        documentVendor: ownerId,
                        isDeleted: false,
                        isArchived: false,
                    });
                    folderPermissionConditions.push({ _id: { $in: vendorFolderIds } });

                    const vendorFileIds = await Document.distinct("fileId", {
                        documentVendor: ownerId,
                        isDeleted: false,
                        isArchived: false,
                    });
                    filePermissionConditions.push({ _id: { $in: vendorFileIds } });
                }

                // Donor specific
                if (profileType === "donor") {
                    const donorFolderIds = await Document.distinct("folderId", {
                        documentDonor: ownerId,
                        isDeleted: false,
                        isArchived: false,
                    });
                    folderPermissionConditions.push({ _id: { $in: donorFolderIds } });

                    const donorFileIds = await Document.distinct("fileId", {
                        documentDonor: ownerId,
                        isDeleted: false,
                        isArchived: false,
                    });
                    filePermissionConditions.push({ _id: { $in: donorFileIds } });
                }
            }
        }

        // Build queries for folders and files
        let folderQuery = {
            ...folderBaseFilters,
            parent: parentFolderId ? parentFolderId : null,
        };

        let fileQuery = {
            status: "active",
            folder: parentFolderId ? parentFolderId : null,
            ...fileBaseFilters,
        };

        // Apply permission conditions
        if (folderPermissionConditions.length > 0) {
            folderQuery.$or = folderPermissionConditions;
        } else if (profileType !== "superadmin" && !permissions?.allOrganizations) {
            return res.json({ success: true, items: [], total: 0, page: 1, totalPages: 0, limit: limit });
        }

        if (filePermissionConditions.length > 0) {
            fileQuery.$or = filePermissionConditions;
        } else if (profileType !== "superadmin" && !permissions?.allOrganizations) {
            return res.json({ success: true, items: [], total: 0, page: 1, totalPages: 0, limit: limit });
        }

        // Add search
        if (search) {
            const folderSearchConditions = [
                { name: { $regex: search, $options: "i" } },
                { "metadata.tags": { $regex: search, $options: "i" } },
                { "metadata.description": { $regex: search, $options: "i" } },
                { slug: { $regex: search, $options: "i" } }
            ];

            const fileSearchConditions = [
                { originalName: { $regex: search, $options: "i" } },
                { fileType: { $regex: search, $options: "i" } },
                { hash: { $regex: search, $options: "i" } }
            ];

            if (folderQuery.$or) {
                folderQuery.$and = [
                    { $or: folderQuery.$or },
                    { $or: folderSearchConditions }
                ];
                delete folderQuery.$or;
            } else {
                folderQuery.$or = folderSearchConditions;
            }

            if (fileQuery.$or) {
                fileQuery.$and = [
                    { $or: fileQuery.$or },
                    { $or: fileSearchConditions }
                ];
                delete fileQuery.$or;
            } else {
                fileQuery.$or = fileSearchConditions;
            }
        }

        // Determine which queries to run
        let folderItems = [];
        let fileItems = [];
        let folderTotal = 0;
        let fileTotal = 0;

        const queryPromises = [];

        // Fetch folders if needed
        if (itemType === "all" || itemType === "folder") {
            queryPromises.push(
                Folder.find(folderQuery)
                    .populate("departmentId", "name description")
                    .populate("projectId", "projectName")
                    .populate("owner", "name email profile_image")
                    .populate("createdBy", "name")
                    .populate("updatedBy", "name")
                    .lean()
                    .then(items => {
                        folderItems = items;
                        return Folder.countDocuments(folderQuery);
                    })
                    .then(count => {
                        folderTotal = count;
                    })
            );
        }

        // Fetch files if needed
        if (itemType === "all" || itemType === "file") {
            queryPromises.push(
                File.find(fileQuery)
                    .populate("departmentId", "name description")
                    .populate("projectId", "projectName")
                    .populate("uploadedBy", "name email profile_image")
                    .populate("folder", "name slug path")
                    .lean()
                    .then(items => {
                        fileItems = items;
                        return File.countDocuments(fileQuery);
                    })
                    .then(count => {
                        fileTotal = count;
                    })
            );
        }

        await Promise.all(queryPromises);

        // Get immediate children counts for each folder (subfolder count + file count)
        let folderChildrenCountsMap = new Map();

        if (folderItems.length > 0) {
            const folderIds = folderItems.map(f => f._id);

            // Count immediate subfolders
            const subfolderCounts = await Folder.aggregate([
                {
                    $match: {
                        parent: { $in: folderIds },
                        isDeleted: false
                    }
                },
                {
                    $group: {
                        _id: '$parent',
                        subfolderCount: { $sum: 1 }
                    }
                }
            ]);

            // Count immediate files
            const fileCounts = await File.aggregate([
                {
                    $match: {
                        folder: { $in: folderIds },
                        status: "active"
                    }
                },
                {
                    $group: {
                        _id: '$folder',
                        fileCount: { $sum: 1 }
                    }
                }
            ]);

            // Initialize all folders with 0 counts
            folderItems.forEach(folder => {
                folderChildrenCountsMap.set(folder._id.toString(), {
                    subfolderCount: 0,
                    fileCount: 0
                });
            });

            // Populate subfolder counts
            subfolderCounts.forEach(item => {
                folderChildrenCountsMap.set(item._id.toString(), {
                    subfolderCount: item.subfolderCount,
                    fileCount: folderChildrenCountsMap.get(item._id.toString())?.fileCount || 0
                });
            });

            // Populate file counts (merge with existing subfolder counts)
            fileCounts.forEach(item => {
                const existing = folderChildrenCountsMap.get(item._id.toString()) || { subfolderCount: 0, fileCount: 0 };
                folderChildrenCountsMap.set(item._id.toString(), {
                    subfolderCount: existing.subfolderCount,
                    fileCount: item.fileCount
                });
            });
        }

        // Transform items to unified format with all formatting applied
        const unifiedItems = [];

        // Add folders
        folderItems.forEach(folder => {
            const permissions = folder.permissions || [];
            const isShared = isItemShared(permissions);
            const sharingStatus = getSharingStatus(permissions);
            const counts = folderChildrenCountsMap.get(folder._id.toString()) || { subfolderCount: 0, fileCount: 0 };

            unifiedItems.push({
                _id: folder._id,
                itemType: 'folder',
                name: folder.name,
                displayName: folder.name,
                slug: folder.slug,
                path: folder.path,
                depth: folder.depth,
                owner: folder.owner,
                ownerName: folder.owner?.name || 'Unknown',
                ownerEmail: folder.owner?.email || '',
                ownerImage: folder.owner?.profile_image || null,
                projectId: folder.projectId,
                projectName: folder.projectId?.projectName || 'N/A',
                departmentId: folder.departmentId,
                departmentName: folder.departmentId?.name || 'N/A',
                departmentDescription: folder.departmentId?.description || '',
                size: folder.size || 0,
                formattedSize: formatFileSize(folder.size || 0),
                status: folder.status,
                isDeleted: folder.isDeleted,
                deletedAt: folder.deletedAt,
                isArchived: folder.isArchived,
                parent: folder.parent,
                ancestors: folder.ancestors,
                permissions: permissions,
                isShared: isShared,
                sharingStatus: sharingStatus,
                createdBy: folder.createdBy,
                createdByName: folder.createdBy?.name || 'Unknown',
                updatedBy: folder.updatedBy,
                updatedByName: folder.updatedBy?.name || 'Unknown',
                createdAt: folder.createdAt,
                updatedAt: folder.updatedAt,
                formattedCreatedAt: formatDate(folder.createdAt),
                formattedUpdatedAt: formatDate(folder.updatedAt),
                lastViewedAt: folder.lastViewedAt || folder.updatedAt,
                formattedLastViewedAt: formatDate(folder.lastViewedAt || folder.updatedAt),
                fileCount: counts.fileCount,
                itemCount: counts.fileCount,
                subfolderCount: counts.subfolderCount,
                icon: 'ti ti-folder',
                iconClass: 'text-warning',
                type: 'Folder',
                typeBadge: 'Folder',
                typeColor: 'primary',
                _folderData: {
                    files: folder.files,
                    metadata: folder.metadata
                }
            });
        });

        // Add files
        fileItems.forEach(file => {
            const permissions = file.permissions || [];
            const isShared = isItemShared(permissions);
            const sharingStatus = getSharingStatus(permissions);
            const fileType = file.fileType || 'application/octet-stream';
            const displayType = getFileTypeDisplay(fileType);
            const iconClass = getFileIconClass(fileType);
            const extension = getFileExtension(file.originalName, fileType);

            unifiedItems.push({
                _id: file._id,
                itemType: 'file',
                name: file.originalName,
                displayName: file.originalName,
                originalName: file.originalName,
                file: file.file,
                s3Url: file.s3Url,
                fileType: fileType,
                displayType: displayType,
                extension: extension,
                version: file.version || 1,
                uploadedBy: file.uploadedBy,
                uploadedByName: file.uploadedBy?.name || 'Unknown',
                uploadedByEmail: file.uploadedBy?.email || '',
                uploadedByImage: file.uploadedBy?.profile_image || null,
                folder: file.folder,
                folderName: file.folder?.name || 'Root',
                folderPath: file.folder?.path || '/',
                projectId: file.projectId,
                projectName: file.projectId?.projectName || 'N/A',
                departmentId: file.departmentId,
                departmentName: file.departmentId?.name || 'N/A',
                departmentDescription: file.departmentId?.description || '',
                fileSize: file.fileSize || 0,
                size: file.fileSize || 0,
                formattedSize: formatFileSize(file.fileSize || 0),
                hash: file.hash,
                uploadedAt: file.uploadedAt,
                formattedUploadedAt: formatDate(file.uploadedAt),
                isPrimary: file.isPrimary || false,
                status: file.status,
                document: file.document,
                permissions: permissions,
                isShared: isShared,
                sharingStatus: sharingStatus,
                createdAt: file.createdAt,
                updatedAt: file.updatedAt,
                formattedCreatedAt: formatDate(file.createdAt),
                formattedUpdatedAt: formatDate(file.updatedAt),
                lastViewedAt: file.lastViewedAt || file.updatedAt,
                formattedLastViewedAt: formatDate(file.lastViewedAt || file.updatedAt),
                icon: iconClass,
                iconClass: iconClass,
                type: displayType,
                typeBadge: displayType,
                typeColor: fileType.startsWith('image/') ? 'success' :
                    fileType === 'application/pdf' ? 'danger' :
                        fileType.startsWith('video/') ? 'info' :
                            fileType.startsWith('audio/') ? 'warning' : 'secondary',
                _fileData: {
                    activityLog: file.activityLog,
                    version: file.version
                }
            });
        });

        // Apply view filter (sort by last viewed or last modified)
        let sortKey = sortBy;
        if (viewFilter === 'lastView') {
            sortKey = 'lastViewedAt';
        } else if (viewFilter === 'lastModified') {
            sortKey = 'updatedAt';
        }

        // Sort unified items
        unifiedItems.sort((a, b) => {
            const aVal = a[sortKey] || a.updatedAt || a.createdAt;
            const bVal = b[sortKey] || b.updatedAt || b.createdAt;
            if (!aVal && !bVal) return 0;
            if (!aVal) return sortOrder === 1 ? -1 : 1;
            if (!bVal) return sortOrder === 1 ? 1 : -1;

            if (sortOrder === 1) {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        // Calculate totals
        const total = folderTotal + fileTotal;
        const totalPages = Math.ceil(total / limit);

        // Paginate unified items
        const startIndex = (page - 1) * limit;
        const paginatedItems = unifiedItems.slice(startIndex, startIndex + limit);

        // Format items for the table
        const tableItems = paginatedItems.map(item => {
            if (item.itemType === 'folder') {
                return {
                    _id: item._id,
                    itemType: 'folder',
                    name: item.name,
                    displayName: item.displayName,
                    owner: item.owner,
                    ownerName: item.ownerName,
                    ownerInitials: getInitials(item.ownerName),
                    ownerImage: item.ownerImage,
                    department: item.departmentName,
                    departmentId: item.departmentId,
                    type: 'Folder',
                    typeBadge: 'Folder',
                    typeColor: 'primary',
                    size: '-',
                    formattedSize: '-',
                    modified: item.formattedUpdatedAt,
                    modifiedRaw: item.updatedAt,
                    createdAt: item.formattedCreatedAt,
                    createdAtRaw: item.createdAt,
                    updatedAt: item.formattedUpdatedAt,
                    updatedAtRaw: item.updatedAt,
                    lastViewedAt: item.formattedLastViewedAt,
                    lastViewedAtRaw: item.lastViewedAt,
                    fileCount: item.fileCount,
                    itemCount: item.fileCount,
                    subfolderCount: item.subfolderCount,
                    path: item.path,
                    permissions: item.permissions,
                    isShared: item.isShared,
                    sharingStatus: item.sharingStatus,
                    icon: 'ti ti-folder',
                    iconClass: 'text-warning',
                    status: item.status,
                    isArchived: item.isArchived
                };
            } else {
                return {
                    _id: item._id,
                    itemType: 'file',
                    name: item.name,
                    displayName: item.displayName,
                    originalName: item.originalName,
                    owner: item.uploadedBy,
                    ownerName: item.uploadedByName,
                    ownerInitials: getInitials(item.uploadedByName),
                    ownerImage: item.uploadedByImage,
                    department: item.departmentName,
                    departmentId: item.departmentId,
                    type: item.displayType,
                    typeBadge: item.displayType,
                    typeColor: item.typeColor,
                    size: item.formattedSize,
                    formattedSize: item.formattedSize,
                    sizeRaw: item.fileSize,
                    modified: item.formattedUpdatedAt,
                    modifiedRaw: item.updatedAt,
                    createdAt: item.formattedCreatedAt,
                    createdAtRaw: item.createdAt,
                    updatedAt: item.formattedUpdatedAt,
                    updatedAtRaw: item.updatedAt,
                    lastViewedAt: item.formattedLastViewedAt,
                    lastViewedAtRaw: item.lastViewedAt,
                    s3Url: item.s3Url,
                    fileType: item.fileType,
                    displayType: item.displayType,
                    extension: item.extension,
                    version: item.version,
                    folderName: item.folderName,
                    folderPath: item.folderPath,
                    permissions: item.permissions,
                    isShared: item.isShared,
                    sharingStatus: item.sharingStatus,
                    icon: item.icon,
                    iconClass: item.iconClass,
                    status: item.status,
                    isPrimary: item.isPrimary,
                    hash: item.hash
                };
            }
        });

        // Helper function
        function getInitials(name) {
            if (!name) return '??';
            const parts = name.split(' ');
            if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }

        return res.json({
            success: true,
            items: tableItems,
            total: total,
            page: page,
            totalPages: totalPages,
            limit: limit,
            stats: {
                folders: folderTotal,
                files: fileTotal,
                total: total
            },
            filters: {
                search: search,
                department: departmentId,
                sortBy: sortKey,
                sortOrder: sortOrder === 1 ? 'asc' : 'desc',
                viewFilter: viewFilter,
                itemType: itemType
            }
        });

    } catch (err) {
        console.error("Error fetching folder/files:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching items",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};