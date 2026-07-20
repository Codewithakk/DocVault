// controllers/documentController.js
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import Document from "../models/Document.js";
import { errorResponse, successResponse, failResponse } from "../utils/responseHandler.js";
import TempFile from "../models/TempFile.js";
import logger from "../utils/logger.js";
import { sendEmail } from "../services/emailService.js";
import User from "../models/User.js";
import Designation from "../models/Designation.js";
import SharedWith from "../models/SharedWith.js";
import File from "../models/File.js";
import { bumpVersion } from "../utils/bumpVersion.js";
import _ from "lodash";
import { getObjectUrl } from "../utils/s3Helpers.js";
import { decrypt, encrypt } from "../helper/SymmetricEncryption.js";
import { generateShareLink } from "../helper/GenerateUniquename.js";
import { accessExpiredTemplate, alertRedirectTemplate } from "../emailTemplates/accessExpiredTemplate.js";
import { API_CONFIG } from "../config/ApiEndpoints.js";
import PermissionLogs from "../models/PermissionLogs.js";
import { addNotification } from "./NotificationController.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../config/S3Client.js";
import { deleteObject } from "../utils/s3Helpers.js";
import { generateEmailTemplate } from "../helper/emailTemplate.js";
import { activityLogger } from "../helper/activityLogger.js";
import DocumentVersion from "../models/DocumentVersion.js";
import { formatTotalFileSize, recomputeProjectStats, recomputeProjectTotalFiles, recomputeProjectTotalTags } from "../helper/CommonHelper.js";
import Folder from "../models/Folder.js";
import Notification from "../models/Notification.js";
import Department from "../models/Departments.js";
import Project from "../models/Project.js";


// Document List page
export const showDocumentListPage = async (req, res) => {
    try {
        const { status, q, filter, month, year, documentId, project } = req.query;

        const designations = await Designation.find({ status: "Active" })
            .sort({ name: 1 })
            .lean();

        res.render("pages/document/document-list", {
            pageTitle: "Documents List",
            pageDescription: "Browse, filter, and manage all documents in your workspace.",
            metaKeywords: "documents list, document management, search documents, filter documents",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            designations,
            project,
            user: req.user,
            searchQuery: q || "",
            status,
            filter,
            documentId,
            month,
            year
        });
    } catch (err) {
        logger.error("Error loading document list:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load the document list.",
            metaKeywords: "error, document list error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load documents"
        });
    }
};

// Add Document page
export const showAddDocumentPage = async (req, res) => {
    try {
        res.render("pages/document/add-document", {
            pageTitle: "Add Document",
            pageDescription: "Create a new document and upload related files.",
            metaKeywords: "add document, create document, upload files, document creation",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            selectedProject: {
                _id: req.session.selectedProject,
                projectName: req.session.selectedProjectName
            },
            isEdit: false
        });
    } catch (err) {
        logger.error("Error loading add-document page:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load add document page.",
            metaKeywords: "error, add document error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load add document"
        });
    }
};

// Edit Document page
export const showEditDocumentPage = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).render("pages/error", {
                pageTitle: "Invalid Document",
                pageDescription: "The document ID provided is invalid.",
                metaKeywords: "invalid document id, document error",
                canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
                user: req.user,
                message: "Invalid document ID"
            });
        }

        const document = await Document.findById(id)
            .populate("project department projectManager documentDonor documentVendor folderId")
            .populate({
                path: "files",
                populate: {
                    path: "uploadedBy",
                    select: "name"
                }
            })
            .lean();

        if (!document) {
            return res.status(404).render("pages/error", {
                pageTitle: "Document Not Found",
                pageDescription: "The document you are trying to access does not exist.",
                metaKeywords: "document not found, edit document error",
                canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
                user: req.user,
                message: "Document not found"
            });
        }

        res.render("pages/document/edit", {
            pageTitle: "Edit Document",
            pageDescription: "Modify document details, update metadata, and manage file attachments.",
            metaKeywords: "edit document, update document, document management",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            document,
            isEdit: true
        });

    } catch (err) {
        logger.error("Error loading edit-document page:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load edit document page.",
            metaKeywords: "edit document error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load edit document page"
        });
    }
};

// View Document page
export const showViewDocumentPage = async (req, res) => {
    try {
        res.render("pages/document/viewDocument", {
            pageTitle: "View Document",
            pageDescription: "View full details, metadata, and file attachments for the selected document.",
            metaKeywords: "view document, document details, document preview",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            documentId: req.params.id
        });
    } catch (err) {
        logger.error("Error loading view document page:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load document viewer.",
            metaKeywords: "view document error, document viewer error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load document"
        });
    }
};

// Archived Document page
export const showArchivedDocumentPage = async (req, res) => {
    try {
        res.render("pages/document/archiveDocuments", {
            pageTitle: "Archived Documents",
            pageDescription: "Browse and manage archived documents stored in the system.",
            metaKeywords: "archived documents, archive, document archive",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user
        });
    } catch (err) {
        logger.error("Error loading archive document page:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load archived documents.",
            metaKeywords: "archived documents error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load archived documents"
        });
    }
};


/**
 * GET /documents/:id/view
 * Render a page to view files of a document
 */

export const viewDocumentFiles = async (req, res) => {
    try {
        const { token, documentId: queryDocumentId, version: queryVersion } = req.query;
        let documentId, version;

        // Handle token or query params
        if (token) {
            let decrypted;
            try {
                decrypted = JSON.parse(decrypt(token));
            } catch {
                return renderExpiredPage(res, "Invalid or corrupted link.", req.user);
            }
            documentId = decrypted.id;
            version = decrypted.version;
        } else {
            if (!queryDocumentId) {
                return renderExpiredPage(res, "Document ID is missing.", req.user);
            }
            documentId = queryDocumentId;
            version = queryVersion;
        }

        // Fetch document
        const now = new Date();
        const document = await Document.findById(documentId)
            .populate('currentVersion')
            .lean();

        if (!document) {
            return renderExpiredPage(res, "Document not found.", req.user, version, documentId);
        }

        // Check if document is deleted, archived, or expired
        let expiredMessage = null;
        let docExpired = false;

        if (document.isDeleted) {
            expiredMessage = "This document has been deleted.";
            docExpired = true;
        } else if (document.isArchived) {
            expiredMessage = "This document is archived and cannot be accessed.";
            docExpired = true;
        } else if (document.docExpiresAt && now > document.docExpiresAt) {
            expiredMessage = "This public document link has expired.";
            docExpired = true;
        } else if (document.docExpireDuration === "custom") {
            if (document.DoccustomStart && document.DoccustomEnd &&
                (now < document.DoccustomStart || now > document.DoccustomEnd)) {
                expiredMessage = "This document is not available in the selected date range.";
                docExpired = true;
            }
        } else if (document.compliance?.expiryDate && now > document.compliance.expiryDate) {
            expiredMessage = "This document has expired due to compliance rules.";
            docExpired = true;
        }
        if (!docExpired) {
            let canView = false;
            let canEdit = false;
            let canDownload = false;
        
            const userId = req.user?._id?.toString();
        
            let sharedRecord = null;
        
            if (userId) {
                sharedRecord = await SharedWith.findOne({
                    document: document._id,
                    user: new mongoose.Types.ObjectId(userId),
                    $or: [
                        { expiresAt: null },
                        { expiresAt: { $gt: now } }
                    ]
                }).lean();
            }
        
            // =========================
            // 🌍 PUBLIC DOCUMENT
            // =========================
            if (document.ispublic) {
        
                // Default public access
                canView = true;
                canDownload = true;
        
                // 👉 If logged-in user has specific permission → override
                if (sharedRecord) {
                    canView = true;
                    canEdit = sharedRecord.accessLevel === 'edit';
                    canDownload = sharedRecord.canDownload === true;
                }
        
            }
            // =========================
            // 🔐 PRIVATE DOCUMENT
            // =========================
            else {
        
                if (!userId) {
                    expiredMessage = "You must be logged in to access this private document.";
                    docExpired = true;
                } else {
                    const isOwner = document.owner?.toString() === userId;
                    const isSharedWithUser = document.sharedWithUsers?.some(
                        u => u.toString() === userId
                    );
        
                    canView = isOwner || isSharedWithUser || !!sharedRecord;
                    canEdit = sharedRecord?.accessLevel === 'edit';
                    canDownload = sharedRecord?.canDownload === true;
        
                    if (!canView) {
                        expiredMessage = "You do not have permission to access this private document.";
                        docExpired = true;
                    }
                }
            }
        
            // Set final permissions
            req.filePermissions = { canView, canEdit, canDownload };
        }
        

        // Fetch version files only if document is accessible
        let versionData = null;
        if (!docExpired) {
            if (version) {
                versionData = await DocumentVersion.findOne({
                    documentId,
                    versionLabel: version
                }).populate("files").lean();
            } else if (document.currentVersion) {
                versionData = await DocumentVersion.findById(document.currentVersion._id)
                    .populate("files").lean();
                version = document.currentVersionLabel;
            }

            // Attach file URLs and permissions
            if (versionData?.files) {
                for (let file of versionData.files) {
                    file.fileUrl = file.s3Url || (file.file ? await getObjectUrl(file.file, 3600) : null);
                    file.canView = req.filePermissions?.canView || false;
                    file.canEdit = req.filePermissions?.canEdit || false;
                    file.canDownload = req.filePermissions?.canDownload || false;
                }
            }
        }

        // Render page
        res.render("pages/document/publicDocumentView", {
            pageTitle: document?.metadata?.fileName || "Public Document",
            pageDescription: "View document files and details.",
            metaKeywords: "document viewer, file sharing, online document",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            documentTitle: document?.metadata?.fileName || "Document",
            expiredMessage,
            docExpired,
            version,
            documentId,
            user: req.user,
            document,
            versionData
        });

    } catch (error) {
        console.error("viewDocumentFiles Error:", error);
        renderExpiredPage(res, "Server error while fetching file.", req.user);
    }
};


// ------------------------
// Helper
// ------------------------
const renderExpiredPage = (res, message, user, version = null, documentId = null) => {
    return res.render("pages/document/publicDocumentView", {
        pageTitle: "Document Unavailable",
        pageDescription: "This document link is invalid, expired, or inaccessible.",
        metaKeywords: "document expired, restricted document, invalid document link",
        canonicalUrl: "",
        documentTitle: "Document",
        expiredMessage: message,
        file: null,
        user,
        version,
        document: null,
        documentId,
        versionData: null,
        docExpired: true
    });
};

/**
 * GET /documents/:id/view
 * Render a page to view files of a document
 */
export const viewInvitedDocumentFiles = async (req, res) => {
    try {
        const { token } = req.params;
        if (!token) throw new Error("Invalid link");

        let decrypted;
        try {
            decrypted = JSON.parse(decrypt(token));
        } catch {
            return res.render("pages/document/viewInvitedDocumentFiles", {
                pageTitle: "Access Denied",
                documentTitle: "Access Denied",
                pageDescription: "This invitation link is invalid or corrupted.",
                metaKeywords: "",
                canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
                expiredMessage: "Invalid or corrupted link.",
                canRenew: false,
                user: req.user,
                email: req.user?.email || null,
                sharedAccess: null,
                document: null,
                versionData: null,
                files: []
            });
        }

        const { id: documentId } = decrypted;
        const userId = req.user?._id;
        const now = new Date();

        let sharedAccess = await SharedWith.findOne({
            document: documentId,
            user: userId,
            generalAccess: true
        }).populate("document");

        let expiredMessage = null;

        if (!sharedAccess) {
            expiredMessage = "You don't have access to this document.";
        } else {
            const expired = sharedAccess.expiresAt && now > sharedAccess.expiresAt;
            const usedOnce = sharedAccess.duration === "onetime" && sharedAccess.used;

            if (expired) expiredMessage = "This link has expired.";
            if (usedOnce) expiredMessage = "This one-time link has already been used.";

            if (sharedAccess.duration === "onetime" && !sharedAccess.used) {
                sharedAccess.used = true;
                await sharedAccess.save();
            }
        }

        let document = null;
        let versionData = null;
        let files = [];

        if (sharedAccess && !expiredMessage) {

            document = await Document.findById(documentId)
                .populate({
                    path: "currentVersion",
                    populate: { path: "files", model: "File" }
                })
                .populate("files")
                .lean();

            versionData = document?.currentVersion;


            let versionFiles = versionData?.files || [];

            let legacyFiles = document?.files || [];

            let selectedFiles = versionFiles.length ? versionFiles : legacyFiles;

            files = await Promise.all(
                selectedFiles.map(async (file) => {
                    let fileUrl = file.s3Url ||
                        (file.file ? await getObjectUrl(file.file, 3600) : null);

                    const ext = file.originalName.split(".").pop().toLowerCase();

                    return {
                        _id: file._id,
                        originalName: file.originalName,
                        fileSize: file.fileSize || 0,
                        formattedSize: formatFileSize(file.fileSize),
                        fileUrl,
                        fileType: {
                            isPDF: ext === "pdf",
                            isWord: ["doc", "docx"].includes(ext),
                            isExcel: ["xls", "xlsx"].includes(ext),
                            isPowerPoint: ["ppt", "pptx"].includes(ext),
                            isText: ["txt", "md", "json", "xml", "html", "csv"].includes(ext),
                            extension: ext
                        }
                    };
                })
            );
        }

        res.render("pages/document/viewInvitedDocumentFiles", {
            pageTitle: document?.metadata?.fileName || "Invited Document",
            title: document?.metadata?.fileName || "Invited Document",
            documentTitle: document?.metadata?.fileName || "Invited Document",
            pageDescription: "Access the document shared with you.",
            metaKeywords: "",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            expiredMessage,
            documentId: documentId,
            canRenew: !!expiredMessage,
            currentVersionLabel: document?.currentVersionLabel || "N/A",
            user: req.user,
            sharedAccess,
            document,
            files
        });

    } catch (error) {
        console.error("Error in viewInvitedDocumentFiles:", error);
        res.render("pages/document/viewInvitedDocumentFiles", {
            pageTitle: "Document Error",
            title: "Document Error",
            pageDescription: "Server error while opening invited document.",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            expiredMessage: "Server error while loading the document.",
            canRenew: false,
            user: req.user,
            sharedAccess: null,
            document: null,
            files: []
        });
    }
};



// Helper
const formatFileSize = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};


export const viewGrantAccessPage = async (req, res) => {
    try {
        const { token } = req.params;
        const decoded = jwt.verify(token, API_CONFIG.ACCESS_GRANT_SECRET || "supersecretkey");

        const { docId, userId, action } = decoded;
        if (action !== "approveAccess") throw new Error("Invalid token");

        const doc = await Document.findById(docId);
        const user = await User.findById(userId);

        if (!doc || !user) throw new Error("Invalid document or user");

        res.render("pages/admin/grantAccess", {
            pageTitle: "Grant Document Access",
            pageDescription: "Approve or deny access to the requested document.",
            metaKeywords: "grant access, approve document request",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            document: doc,
            requester: user,
            user: req.user,
            token
        });

    } catch (err) {
        res.send(`<h2>Invalid or expired link</h2><p>${err.message}</p>`);
    }
};

//API Controllers


/**
 * Get all documents with filtering, pagination, and search
 */
export const getDocuments = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            status,
            department,
            project,
            dateRange,
            date,
            orderColumn,
            orderDir,
            role,
            docType,
            designation,
            documentId
        } = req.query;

        const userId = req.user?._id;
        const profile_type = req.user?.profile_type;
        console.log("userId", userId)
        // --- Base filter ---
        const filter = {
            isDeleted: false,
            isArchived: false,
        };

        /** -------------------- DOCUMENT ID FILTER -------------------- **/
        if (documentId && mongoose.Types.ObjectId.isValid(documentId)) {
            filter._id = documentId;
        }

        // --- FIXED ACCESS CONTROL ---
        // Superadmin: can see all documents (no restrictions)
        // Admin: can see their own documents + documents they own
        // User: can see their own documents
        // Vendor/Donor: can see Approved documents where they are the vendor/donor
        
        if (profile_type !== "superadmin") {
            const accessRules = [];

            // For admin and user, they can only see documents they own
            if (profile_type === "admin" || profile_type === "user") {
                accessRules.push({ owner: userId });
            }

            // For vendor, they can see approved documents where they are the vendor
            if (profile_type === "vendor") {
                accessRules.push({
                    $and: [
                        { documentVendor: userId },
                        { status: "Approved" }
                    ]
                });
            }

            // For donor, they can see approved documents where they are the donor
            if (profile_type === "donor") {
                accessRules.push({
                    $and: [
                        { documentDonor: userId },
                        { status: "Approved" }
                    ]
                });
            }

            // Apply access rules ONLY if we have any
            if (accessRules.length > 0) {
                // If we have multiple rules, use $or
                if (accessRules.length === 1) {
                    // If only one rule, merge it directly
                    Object.assign(filter, accessRules[0]);
                } else {
                    filter.$or = accessRules;
                }
            }
        }

        // --- IMPORTANT: If filter already has $or from access control, 
        // we need to be careful when adding other $or conditions ---
        
        const toArray = val => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            return val.split(',').map(v => v.trim()).filter(Boolean);
        };

        // --- Search ---
        if (search?.trim()) {
            const safeSearch = search.trim();
            const searchConditions = {
                $or: [
                    { "metadata.fileName": { $regex: safeSearch, $options: "i" } },
                    { "metadata.fileDescription": { $regex: safeSearch, $options: "i" } },
                    { "metadata.mainHeading": { $regex: safeSearch, $options: "i" } },
                    { description: { $regex: safeSearch, $options: "i" } },
                    { remark: { $regex: safeSearch, $options: "i" } },
                    { tags: { $in: [new RegExp(safeSearch, "i")] } },
                    { "files.originalName": { $regex: safeSearch, $options: "i" } },
                    { "project.projectName": { $regex: safeSearch, $options: "i" } }
                ]
            };

            // If filter already has $or (from access control), we need to use $and
            if (filter.$or) {
                filter.$and = filter.$and || [];
                filter.$and.push(searchConditions);
            } else {
                Object.assign(filter, searchConditions);
            }
        }

        // --- Status ---
        if (status) {
            const normalizedStatus = status.replace(/\s+/g, ' ').trim();
            if (normalizedStatus === "uploaded") {
                const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                const startOfNextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
                filter.createdAt = { $gte: startOfMonth, $lt: startOfNextMonth };
            }
            else if (normalizedStatus === "deletedarchive") {
                delete filter.isDeleted;
                delete filter.isArchived;
                filter.$or = [
                    { isDeleted: true },
                    { isArchived: true }
                ];
            }
            else if (normalizedStatus === "modified") {
                filter["currentVersionNumber"] = {
                    $ne: mongoose.Types.Decimal128.fromString("1.0")
                };
            }
            else if (normalizedStatus === "Compliance and Retention") {
                filter["compliance.isCompliance"] = true;
            } else {
                filter.status = normalizedStatus;
            }
        }

        // --- Department filter ---
        if (department) {
            const deptArray = toArray(department).filter(id => mongoose.Types.ObjectId.isValid(id));
            if (deptArray.length > 0) {
                filter.department = deptArray.length === 1 ? deptArray[0] : { $in: deptArray };
            }
        }

        // --- Project filter (from query or session) ---
        const sessionProjectId = req.session?.selectedProject;
        const projectIds = [];

        if (sessionProjectId && mongoose.Types.ObjectId.isValid(sessionProjectId)) {
            projectIds.push(sessionProjectId);
        }

        if (project) {
            const projArray = toArray(project).filter(id => mongoose.Types.ObjectId.isValid(id));
            projectIds.push(...projArray);
        }

        if (projectIds.length > 0) {
            filter.project = projectIds.length === 1 ? projectIds[0] : { $in: projectIds };
        }

        /** -------------------- DATE RANGE FILTER -------------------- **/
        if (dateRange) {
            const rangeMatch = dateRange.match(/(\d{2}-\d{2}-\d{4})\s+to\s+(\d{2}-\d{2}-\d{4})/);
            if (rangeMatch) {
                const [_, startStr, endStr] = rangeMatch;
                const [startDay, startMonth, startYear] = startStr.split('-').map(Number);
                const [endDay, endMonth, endYear] = endStr.split('-').map(Number);

                const startDate = new Date(startYear, startMonth - 1, startDay);
                const endDate = new Date(endYear, endMonth - 1, endDay);
                endDate.setHours(23, 59, 59, 999);

                if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                    filter.createdAt = {
                        $gte: startDate,
                        $lte: endDate
                    };
                }
            }
        }
        else if (date) {
            const [day, month, year] = date.split("-").map(Number);
            const selectedDate = new Date(year, month - 1, day);
            if (!isNaN(selectedDate.getTime())) {
                const nextDate = new Date(selectedDate);
                nextDate.setDate(nextDate.getDate() + 1);
                filter.createdAt = { $gte: selectedDate, $lt: nextDate };
            }
        }
        
        // --- Year filter from session ---
        if (req.session?.selectedYear) {
            const year = parseInt(req.session.selectedYear, 10);
            if (!isNaN(year)) {
                const startOfYear = new Date(year, 0, 1);
                const endOfYear = new Date(year + 1, 0, 1);

                if (!filter.createdAt) {
                    filter.createdAt = { $gte: startOfYear, $lt: endOfYear };
                } else {
                    filter.createdAt.$gte = startOfYear;
                    filter.createdAt.$lt = endOfYear;
                }
            }
        }

        /** -------------------- ROLE FILTER -------------------- **/
        if (role?.trim()) {
            const usersByRole = await mongoose
                .model("User")
                .find({ "userDetails.role": role.trim() }, { _id: 1 });
            if (usersByRole.length > 0) {
                filter.owner = { $in: usersByRole.map((u) => u._id) };
            } else {
                filter.owner = null;
            }
        }

        /** -------------------- DESIGNATION FILTER -------------------- **/
        if (designation?.trim() && mongoose.Types.ObjectId.isValid(designation)) {
            const usersByDesg = await mongoose
                .model("User")
                .find({ "userDetails.designation": designation }, { _id: 1 });
            if (usersByDesg.length > 0) {
                filter.owner = { $in: usersByDesg.map((u) => u._id) };
            } else {
                filter.owner = null;
            }
        }

        /** -------------------- DOC TYPE FILTER -------------------- **/
        if (!filter._id && docType?.trim()) {
            const filesByType = await mongoose
                .model("File")
                .find({ fileType: docType.trim() }, { document: 1 });
            const docIds = filesByType.map((f) => f.document).filter(Boolean);
            if (docIds.length > 0) {
                filter._id = { $in: docIds };
            } else {
                filter._id = null;
            }
        }

        /** -------------------- SORTING -------------------- **/
        const columnMap = {
            1: "metadata.fileName",
            2: "updatedAt",
            3: "owner.name",
            4: "department.name",
            5: "project.projectName",
            9: "tags",
            10: "metadata",
            14: "status",
        };
        const sortField = columnMap[orderColumn] || "createdAt";
        const sortOrder = orderDir === "asc" ? 1 : -1;

        /** -------------------- PAGINATION -------------------- **/
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        // --- Fetch documents ---
        let documents = await Document.find(filter)
            .select(`
                files updatedAt createdAt wantApprovers signature isDeleted isArchived archivedAt
                comment sharedWithUsers compliance status metadata tags owner versioning
                documentVendor documentDonor department project description
                documentApprovalAuthority currentVersionLabel
            `)
            .populate("department", "name")
            .populate("project", "projectName")
            .populate({
                path: "owner",
                select: "name email profile_image profile_type userDetails.employee_id userDetails.designation",
                populate: { path: "userDetails.designation", select: "name" },
            })
            .populate("documentDonor", "name profile_image")
            .populate("documentVendor", "name profile_image")
            .populate("sharedWithUsers", "name profile_image email")
            .populate("files", "originalName version fileSize")
            .populate({
                path: "documentApprovalAuthority.userId",
                select: "name email profile_image profile_type userDetails.employee_id"
            })
            .sort({ [sortField]: sortOrder })
            .skip(skip)
            .limit(limitNum)
            .lean();

        documents.forEach(doc => {
            const filesArray = doc.files || [];
            const totalBytes = filesArray.reduce((sum, file) => {
                return sum + (Number(file.fileSize) || 0);
            }, 0);

            const formatted = formatTotalFileSize(totalBytes);
            const firstFile = filesArray[0] || {};
            const firstFileOriginalName = firstFile.originalName || null;
            const firstFileId = firstFile._id || null;
            doc.files = {
                _id: firstFileId,
                originalName: firstFileOriginalName,
                version: doc.currentVersionLabel || null,
                fileSize: formatted
            };
        });
        
        const totalDocuments = await Document.countDocuments(filter);

        return successResponse(res, {
            documents,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalDocuments / limitNum),
                totalDocuments,
                hasNext: pageNum * limitNum < totalDocuments,
                hasPrev: pageNum > 1
            }
        }, "Documents retrieved successfully");

    } catch (error) {
        console.error(error);
        return errorResponse(res, error, "Failed to retrieve documents");
    }
};
export const getDocumentsCount = async (req, res) => { 
    try {        
        const { department, project, status } = req.query;
        const userId = req.user?._id;
        const profileType = req.user?.profile_type;

        // --- Build base filter ---
        const filter = { 
            isDeleted: false, 
            isArchived: false 
        };

        // --- FIXED ACCESS CONTROL (same as getDocuments) ---
        if (profileType !== "superadmin") {
            const accessRules = [];

            if (profileType === "admin" || profileType === "user") {
                accessRules.push({ owner: new mongoose.Types.ObjectId(userId) });
            }

            if (profileType === "vendor") {
                accessRules.push({ 
                    documentVendor: new mongoose.Types.ObjectId(userId),
                    status: "Approved" 
                });
            }

            if (profileType === "donor") {
                accessRules.push({ 
                    documentDonor: new mongoose.Types.ObjectId(userId),
                    status: "Approved" 
                });
            }

            if (accessRules.length > 0) {
                if (accessRules.length === 1) {
                    Object.assign(filter, accessRules[0]);
                } else {
                    filter.$or = accessRules;
                }
            }
        }

        // --- NEW: Status filter ---
        if (status) {
            const normalizedStatus = status.replace(/\s+/g, ' ').trim();
            
            // Handle special status types
            if (normalizedStatus === "uploaded") {
                const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                const startOfNextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
                filter.createdAt = { $gte: startOfMonth, $lt: startOfNextMonth };
            }
            else if (normalizedStatus === "deletedarchive") {
                delete filter.isDeleted;
                delete filter.isArchived;
                if (filter.$or) {
                    // If we already have $or, combine with $and
                    filter.$and = filter.$and || [];
                    filter.$and.push({
                        $or: [
                            { isDeleted: true },
                            { isArchived: true }
                        ]
                    });
                } else {
                    filter.$or = [
                        { isDeleted: true },
                        { isArchived: true }
                    ];
                }
            }
            else if (normalizedStatus === "modified") {
                filter["currentVersionNumber"] = {
                    $ne: mongoose.Types.Decimal128.fromString("1.0")
                };
            }
            else if (normalizedStatus === "Compliance and Retention") {
                filter["compliance.isCompliance"] = true;
            } 
            else {
                // Regular status filter
                filter.status = normalizedStatus;
            }
        }

        // --- Department filter ---
        if (department) {
            const deptArray = department
                .split(',')
                .filter(id => mongoose.Types.ObjectId.isValid(id));
            
            if (deptArray.length > 0) {
                filter.department = deptArray.length === 1 
                    ? new mongoose.Types.ObjectId(deptArray[0]) 
                    : { $in: deptArray.map(id => new mongoose.Types.ObjectId(id)) };
            }
        }

        // --- Project filter ---
        const selectedProject = project || req.session?.selectedProject;
        
        if (selectedProject && mongoose.Types.ObjectId.isValid(selectedProject)) {
            filter.project = new mongoose.Types.ObjectId(selectedProject);
        }

        // --- Get ALL matching documents for debugging ---
        const allMatchingDocs = await Document.find(filter)
            .select('_id status name department project owner documentVendor documentDonor')
            .lean();

        if (allMatchingDocs.length > 0) {
            allMatchingDocs.forEach((doc, index) => {
                console.log(`  ${index + 1}. ID: ${doc._id}, Status: ${doc.status}, Name: ${doc.name || 'N/A'}`);
            });
        } else {
            console.log('⚠️ No matching documents found!');
        }

        const [statusResult, complianceResult] = await Promise.all([
            // Get all status counts in one go
            Document.aggregate([
                { $match: filter },
                { 
                    $group: { 
                        _id: "$status", 
                        count: { $sum: 1 } 
                    } 
                },
                { $sort: { _id: 1 } }
            ]),
            // Get compliance count
            Document.countDocuments({
                ...filter,
                "compliance.isCompliance": true
            })
        ]);

        // --- Build response with defaults ---
        const statusMap = {
            Draft: 0,
            Pending: 0,
            Approved: 0,
            Rejected: 0
        };

        // Map status results
        statusResult.forEach(({ _id, count }) => {
            console.log(`  ↳ Processing status "${_id}": ${count} documents`);
            if (statusMap.hasOwnProperty(_id)) {
                statusMap[_id] = count;
            } else {
                console.log(`  ⚠️ Unknown status "${_id}" found - ignoring`);
            }
        });

        // Calculate totals
        const totalCount = statusResult.reduce((sum, item) => sum + item.count, 0);
        const allCount = statusMap.Draft + statusMap.Pending + statusMap.Approved + statusMap.Rejected;

        // --- Get detailed status breakdown with document IDs ---
        const detailedStatusBreakdown = {};
        
        // If a specific status is requested, only show that status in details
        const statusesToShow = status ? [status] : ['Draft', 'Pending', 'Approved', 'Rejected'];
        
        for (const statusType of statusesToShow) {
            const docs = await Document.find({ ...filter, status: statusType })
                .select('_id metadata status')
                .lean();
            
            if (docs.length > 0) {
                detailedStatusBreakdown[statusType] = docs.map(doc => ({
                    id: doc._id,
                    name: doc.metadata || 'Unnamed',
                    status: doc.status
                }));
            }
        }

        // --- Response ---
        const responseData = {
            totalCount,
            counts: {
                All: allCount,
                ...statusMap,
                Compliance: complianceResult
            },
        };

        return successResponse(res, responseData, "Document counts retrieved successfully");

    } catch (error) {
        console.error('Stack trace:', error.stack);
        return errorResponse(res, error, "Failed to retrieve document counts");
    }
};
export const getComplianceDocuments = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            department,
            project,
            date,
            orderColumn,
            orderDir,
            docType,
            documentId
        } = req.query;

        const userId = req.user?._id;
        const profile_type = req.user?.profile_type;
        // --- Base filter ---
        const filter = {
            isDeleted: false
        };
        /** -------------------- DOCUMENT ID FILTER -------------------- **/
        if (documentId && mongoose.Types.ObjectId.isValid(documentId)) {
            filter._id = documentId;
        }

        if (profile_type !== "superadmin") {

            // Base condition for normal users
            const baseAccess = [
                { owner: userId },
                // { sharedWithUsers: userId }  // enable if needed
            ];

            if (profile_type === "vendor") {
                baseAccess.push({ documentVendor: userId });
            }

            if (profile_type === "donor") {
                baseAccess.push({ documentDonor: userId });
            }

            filter.$or = baseAccess;
        }

        const toArray = val => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            return val.split(',').map(v => v.trim()).filter(Boolean);
        };

        // --- Search ---
        if (search?.trim()) {
            const safeSearch = search.trim();
            filter.$and = filter.$and || [];
            filter.$and.push({
                $or: [
                    // Metadata fields
                    { "metadata.fileName": { $regex: safeSearch, $options: "i" } },
                    { "metadata.fileDescription": { $regex: safeSearch, $options: "i" } },
                    { "metadata.mainHeading": { $regex: safeSearch, $options: "i" } },

                    { description: { $regex: safeSearch, $options: "i" } },
                    { remark: { $regex: safeSearch, $options: "i" } },
                    { tags: { $in: [new RegExp(safeSearch, "i")] } },

                    { "files.originalName": { $regex: safeSearch, $options: "i" } },
                    { "project.projectName": { $regex: safeSearch, $options: "i" } }
                ]
            });
        }

        // --- Department filter ---
        if (department) {
            const deptArray = toArray(department).filter(id => mongoose.Types.ObjectId.isValid(id));
            if (deptArray.length > 0) {
                filter.department = deptArray.length === 1 ? deptArray[0] : { $in: deptArray };
            }
        }

        // --- Project filter (from query or session) ---
        const sessionProjectId = req.session?.selectedProject;
        const projectIds = [];

        if (sessionProjectId && mongoose.Types.ObjectId.isValid(sessionProjectId)) {
            projectIds.push(sessionProjectId);
        }

        if (project) {
            const projArray = toArray(project).filter(id => mongoose.Types.ObjectId.isValid(id));
            projectIds.push(...projArray);
        }

        if (projectIds.length > 0) {
            filter.project = projectIds.length === 1 ? projectIds[0] : { $in: projectIds };
        }

        /** -------------------- DATE -------------------- **/
        if (date) {
            const [day, month, year] = date.split("-").map(Number);
            const selectedDate = new Date(year, month - 1, day);
            if (!isNaN(selectedDate.getTime())) {
                const nextDate = new Date(selectedDate);
                nextDate.setDate(nextDate.getDate() + 1);
                filter.createdAt = { $gte: selectedDate, $lt: nextDate };
            }
        }
        // --- Year filter from session ---
        if (req.session?.selectedYear) {
            const year = parseInt(req.session.selectedYear, 10);
            if (!isNaN(year)) {
                const startOfYear = new Date(year, 0, 1);
                const endOfYear = new Date(year + 1, 0, 1);

                // Merge year filter with possible existing date filter
                if (!filter.createdAt) {
                    filter.createdAt = { $gte: startOfYear, $lt: endOfYear };
                } else {
                    filter.createdAt.$gte = startOfYear;
                    filter.createdAt.$lt = endOfYear;
                }
            }
        }

        /** -------------------- DOC TYPE FILTER -------------------- **/
        if (!filter._id && docType?.trim()) {
            const filesByType = await mongoose
                .model("File")
                .find({ fileType: docType.trim() }, { document: 1 });
            const docIds = filesByType.map((f) => f.document).filter(Boolean);
            if (docIds.length > 0) {
                filter._id = { $in: docIds };
            } else {
                filter._id = null;
            }
        }

        /** -------------------- SORTING -------------------- **/
        const columnMap = {
            1: "metadata.fileName",
            2: "updatedAt",
            3: "owner.name",
            4: "department.name",
            5: "project.projectName",
            9: "tags",
            10: "metadata",
            14: "status",
        };
        const sortField = columnMap[orderColumn] || "createdAt";
        const sortOrder = orderDir === "asc" ? 1 : -1;

        /** -------------------- PAGINATION -------------------- **/
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        // --- Fetch documents ---
        const documents = await Document.find(filter)
            .select(`
                files updatedAt createdAt wantApprovers signature isDeleted isArchived archivedAt
                comment sharedWithUsers compliance status metadata tags owner versioning
                documentVendor documentDonor department project description
                documentApprovalAuthority currentVersionLabel
            `)
            .populate("department", "name")
            .populate("project", "projectName")
            .populate({
                path: "owner",
                select: "name email profile_image profile_type userDetails.employee_id userDetails.designation",
                populate: { path: "userDetails.designation", select: "name" },
            })
            .populate("documentDonor", "name profile_image")
            .populate("documentVendor", "name profile_image")
            .populate("sharedWithUsers", "name profile_image email")
            .populate("files", "originalName version fileSize")
            .populate({
                path: "documentApprovalAuthority.userId",
                select: "name email profile_image profile_type userDetails.employee_id"
            })
            .sort({ [sortField]: sortOrder })
            .skip(skip)
            .limit(limitNum)
            .lean();

        const totalDocuments = await Document.countDocuments(filter);

        return successResponse(res, {
            documents,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalDocuments / limitNum),
                totalDocuments,
                hasNext: pageNum * limitNum < totalDocuments,
                hasPrev: pageNum > 1
            }
        }, "Documents retrieved successfully");

    } catch (error) {
        console.error(error);
        return errorResponse(res, error, "Failed to retrieve documents");
    }
};

/**
 * @desc Get all documents by folderId
 * @route GET /api/documents/folder/:folderId
 * @access Private
 */
export const getDocumentsByFolder = async (req, res) => {
    try {
        const { folderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(folderId)) {
            return res.status(400).json({ success: false, message: "Invalid folder ID" });
        }

        // DataTables parameters
        const start = parseInt(req.query.start) || 0;
        const length = parseInt(req.query.length) || 20;
        const searchValue = req.query.search?.value || "";
        const orderColumnIndex = req.query.order?.[0]?.column || 0;
        const orderDirection = req.query.order?.[0]?.dir === "desc" ? -1 : 1;

        // Columns mapping
        const columns = ["fileName", "owner.name", "owner.email", "department.name", "project.projectName", "tags", "status", "createdAt", "updatedAt"];
        const sortField = columns[orderColumnIndex] || "createdAt";

        // Base query
        let query = { folderId };

        // Search
        if (searchValue) {
            query.$text = { $search: searchValue };
        }

        const totalRecords = await Document.countDocuments({ folderId });
        const filteredRecords = await Document.countDocuments(query);

        const documents = await Document.find(query)
            .populate("project", "projectName")
            .populate("department", "name")
            .populate("owner", "name email")
            .lean() // improves performance on large datasets
            .sort({ [sortField]: orderDirection })
            .skip(start)
            .limit(length);

        res.json({
            success: true,
            data: documents,
            recordsTotal: totalRecords,
            recordsFiltered: filteredRecords
        });

    } catch (err) {
        console.error("Error fetching documents:", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};


/**
 * Get single document by ID
 */
export const getDocument = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return failResponse(res, "Invalid document ID", 400);
        }

        const document = await Document.findById(id)
            .select("")
            .populate("department", "name")
            .populate("project", "name")
            .populate("owner", "name email")
            .populate("projectManager", "name email")
            // .populate("department", "name")
            .populate("sharedWithUsers", "name email")
            // .populate("sharedWithDepartments.department", "name")
            .populate("files.file", "filename originalName size mimetype url")
            .populate("folderId", "name");

        if (!document) {
            return failResponse(res, "Document not found", 404);
        }

        return successResponse(res, { document }, "Document retrieved successfully");
    } catch (error) {
        return errorResponse(res, error, "Failed to retrieve document");
    }
};

/**
 * Get all documents in Recycle Bin
 * @route GET /api/documents/recycle-bin
 * @query page, limit, search (optional), department (optional)
 */
export const getRecycleBinDocuments = async (req, res) => {
    try {
        const userId = req.user?._id;
        const profileType = req.user?.profile_type;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Filters
        const search = req.query.search ? req.query.search.trim() : "";
        const department = req.query.department || "";

        // --- Base query: only deleted documents ---
        const query = { isDeleted: true };

        // --- Restrict to user's own docs if NOT superadmin ---
        if (profileType !== "superadmin") {
            query.owner = userId;
        }

        // --- Department filter ---
        if (department && department !== "all") {
            query.department = department;
        }

        // --- Search filter ---
        if (search) {
            query.$or = [
                { "metadata.fileName": { $regex: search, $options: "i" } },
                { tags: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } }
            ];
        }

        // --- Fetch documents & total count ---
        const [documents, total] = await Promise.all([
            Document.find(query)
                .select("files tags createdAt isDeleted deletedAt department metadata")
                .populate("department", "name")
                .populate("files", "originalName version fileSize")
                .populate("owner", "name email")
                .sort({ deletedAt: -1 })
                .skip(skip)
                .limit(limit),
            Document.countDocuments(query)
        ]);

        return res.json({
            success: true,
            message: "Recycle bin documents fetched successfully",
            data: documents,
            total,
            page,
            limit
        });

    } catch (err) {
        console.error("Get recycle bin documents error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch documents",
            error: err.message
        });
    }
};

/**
 * Archive or unarchive a document
 * @route PATCH /api/documents/:id/archive?isArchived=true|false
 */
export const archiveDocuments = async (req, res) => {
    try {
        const { id } = req.params;
        const { isArchived } = req.query;

        if (typeof isArchived === "undefined") {
            return failResponse(res, "Missing query parameter: isArchived", 400);
        }

        const archiveStatus = isArchived === "true";

        // Find and update document
        const updatedDoc = await Document.findByIdAndUpdate(
            id,
            { isArchived: archiveStatus },
            { new: true }
        );

        if (!updatedDoc) {
            return failResponse(res, "Document not found", 404);
        }

        return successResponse(
            res,
            updatedDoc,
            archiveStatus
                ? "Document archived successfully"
                : "Document unarchived successfully"
        );
    } catch (err) {
        console.error("Archive document error:", err);
        return errorResponse(res, err, "Failed to archive/unarchive document");
    }
};

/**
 * Get archived or unarchived documents
 * @route GET /api/documents/archive?isArchived=true|false
 */
export const getArchivedDocuments = async (req, res) => {
    try {
        const draw = parseInt(req.query.draw) || 1;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 500);
        const skip = (page - 1) * limit;

        const search = req.query.search?.trim() || "";
        const orderColumn = req.query.orderColumn || "updatedAt";
        const orderDir = req.query.orderDir === "asc" ? 1 : -1;

        const userId = req.user?._id;
        const profileType = req.user?.profile_type;

        const query = {
            isArchived: true,
            isDeleted: false,
        };

        if (profileType !== "superadmin") {
            query.owner = userId;
        }

        if (req.query.department && req.query.department !== "all") {
            query.department = new mongoose.Types.ObjectId(req.query.department);
        }

        // Use text search if available
        if (search) {
            query.$text = { $search: search };
        }

        // === Optimized Pipeline ===
        const pipeline = [
            { $match: query },

            // Early: Get only primary file
            {
                $lookup: {
                    from: "files",
                    let: { fileIds: "$files" },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$fileIds"] }, isPrimary: true } },
                        { $limit: 1 },
                        { $project: { originalName: 1, fileSize: 1 } }
                    ],
                    as: "primaryFile"
                }
            },
            { $unwind: { path: "$primaryFile", preserveNullAndEmptyArrays: true } },

            // Department lookup
            {
                $lookup: {
                    from: "departments",
                    localField: "department",
                    foreignField: "_id",
                    as: "department"
                }
            },
            { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },

            // Final projection
            {
                $project: {
                    _id: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    tags: 1,
                    metadata: 1,
                    department: { name: "$department.name" },
                    file: "$primaryFile"
                }
            },

            { $sort: { [orderColumn]: orderDir } },
            { $skip: skip },
            { $limit: limit }
        ];

        // Parallel: data + count
        const [documents, countResult] = await Promise.all([
            Document.aggregate(pipeline).allowDiskUse(true),
            Document.aggregate([
                { $match: query },
                { $count: "total" }
            ]).allowDiskUse(true)
        ]);

        const total = countResult[0]?.total || 0;
        const filtered = search ? documents.length : total;

        res.json({
            draw,
            recordsTotal: total,
            recordsFiltered: filtered,
            data: documents
        });

    } catch (err) {
        console.error("Error fetching archived documents:", err);
        res.status(500).json({ success: false, message: "Server error. Try again." });
    }
};

// Restore a soft-deleted document
export const restoreDocument = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid document ID." });
    }

    try {
        const document = await Document.findOne({ _id: id, isDeleted: true });

        if (!document) {
            return res.status(404).json({ message: "Document not found or not deleted." });
        }

        document.isDeleted = false;
        document.deletedAt = null;

        await document.save();

        return res.status(200).json({
            message: "Document restored successfully.",
            document
        });
    } catch (error) {
        console.error("Error restoring document:", error);
        return res.status(500).json({ message: "Server error while restoring document." });
    }
};
/**
 * Compare old & new document values.
 */
const computeDiff = (oldDoc, newDoc, changedFields) => {
    const diff = {};

    changedFields.forEach(field => {
        const oldVal = _.get(oldDoc, field);
        const newVal = _.get(newDoc, field);

        // Deep comparison for arrays and objects
        if (Array.isArray(oldVal) && Array.isArray(newVal)) {
            if (JSON.stringify(oldVal.sort()) !== JSON.stringify(newVal.sort())) {
                diff[field] = {
                    old: oldVal,
                    new: newVal,
                    type: 'array'
                };
            }
        } else if (_.isObject(oldVal) && _.isObject(newVal)) {
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                diff[field] = {
                    old: oldVal,
                    new: newVal,
                    type: 'object'
                };
            }
        } else if (oldVal !== newVal) {
            diff[field] = {
                old: oldVal,
                new: newVal,
                type: 'primitive'
            };
        }
    });

    return diff;
};


/**
 * Convert versioned changes into human-readable text
 */
const createReadableChangeReason = (diff) => {
    let reasons = [];

    for (const field in diff) {
        const change = diff[field];

        // Simple string fields: description, comment, link
        if (typeof change.old === "string" || typeof change.new === "string") {
            reasons.push(`${field} changed`);
        }

        // Tags
        else if (field === "tags") {
            reasons.push(`Tags changed`);
        }

        // Compliance (nested)
        else if (field.startsWith("compliance")) {
            reasons.push(`${field} updated`);
        }

        // Files
        else if (field === "files") {
            reasons.push(`Files updated`);
        }
    }

    return reasons.join(" | ");   // combine all changes
};

/**
 * Create new document
 */
export const createDocument = async (req, res) => {
    try {
        const {
            project,
            department,
            projectManager,
            documentDonor,
            documentVendor,
            tags,
            metadata,
            description,
            compliance,
            expiryDate,
            folderId,
            documentDate,
            comment,
            link,
            wantApprovers,
            fileIds
        } = req.body;
        const userId = req.user?._id || null;
        const userName = req.user?.name || "Unknown User";

        // ------------------- Parse Inputs -------------------
        const validFolderId = folderId && mongoose.Types.ObjectId.isValid(folderId) ? folderId : null;
        const parsedWantApprovers = wantApprovers === "true";
        const parsedTags =
            tags && typeof tags === "string"
                ? tags.split(",").map((t) => t.trim())
                : Array.isArray(tags)
                    ? tags
                    : [];

        // ------------------- Parse documentDate as startDate -------------------
        let startDate = null;

        if (documentDate) {
            const [day, month, year] = documentDate.split(/[\/\-]/);
            startDate = new Date(`${year}-${month}-${day}`);
        
            if (isNaN(startDate.getTime())) {
                return failResponse(res, "Invalid documentDate format", 400);
            }
        } else {
            startDate = new Date(); // Current date
        }
        // ------------------- Parse metadata -------------------
        let parsedMetadata = {};
        if (metadata) {
            try {
                parsedMetadata = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
            } catch (err) {
                logger.error("Error parsing metadata:", err);
            }
        }

        // ------------------- Parse compliance and expiry -------------------
        let isCompliance = false;
        let parsedExpiryDate = null;

        if (typeof compliance === "string") {
            isCompliance = compliance.toLowerCase() === "yes";
        } else if (typeof compliance === "boolean") {
            isCompliance = compliance;
        }

        if (isCompliance) {
            if (!expiryDate || expiryDate.trim() === "") {
                return failResponse(res, "Expiry date required when compliance is 'Yes'", 400);
            }

            const parts = expiryDate.split("-");
            if (parts.length === 3) {
                if (parts[0].length === 2) {
                    // DD-MM-YYYY
                    parsedExpiryDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                } else {
                    // YYYY-MM-DD
                    parsedExpiryDate = new Date(expiryDate);
                }
            } else {
                return failResponse(res, "expiryDate must be DD-MM-YYYY or YYYY-MM-DD", 400);
            }

            if (isNaN(parsedExpiryDate.getTime())) {
                return failResponse(res, "Invalid expiry date format", 400);
            }
        }

        // ------------------- Get Project Approval Authority -------------------
        let documentApprovalAuthority = [];
        if (parsedWantApprovers && project && mongoose.Types.ObjectId.isValid(project)) {
            try {
                const projectData = await mongoose.model("Project").findById(project)
                    .populate("approvalAuthority.userId", "name email")
                    .select("approvalAuthority");

                if (projectData && projectData.approvalAuthority) {
                    documentApprovalAuthority = projectData.approvalAuthority.map(auth => ({
                        userId: auth.userId,
                        priority: auth.priority,
                        designation: auth.designation,
                        isMailSent: false,
                        status: "Pending",
                        isApproved: false,
                        remark: "",
                        approvedOn: null,
                        addDate: new Date()
                    }));
                }
            } catch (error) {
                logger.error("Error fetching project approval authority:", error);
            }
        }

        // ------------------- Parse file IDs -------------------
        let parsedFileIds = [];
        if (fileIds) {
            try {
                parsedFileIds = typeof fileIds === "string" ? JSON.parse(fileIds) : fileIds;
            } catch {
                parsedFileIds = [fileIds];
            }
        }
        parsedFileIds = [...new Set(parsedFileIds)]
            .filter((id) => mongoose.Types.ObjectId.isValid(id))
            .map((id) => new mongoose.Types.ObjectId(id));
        
            const projectManagerexist = await Project.findById(project).select('projectManager');
            const projectManagerexists =
                projectManager ||
                projectManagerexist?.projectManager?.[0] ||
                null;
        // ------------------- Create Document -------------------
        const document = await Document.create({
            project: project || null,
            department,
            projectManager: projectManagerexists || null,
            documentDonor: documentDonor || null,
            documentVendor: documentVendor || null,
            folderId: validFolderId,
            owner: req.user._id,
            status: parsedWantApprovers ? "Pending" : "Approved",
            tags: parsedTags,
            metadata: parsedMetadata,
            startDate,
            description,
            compliance: {
                isCompliance,
                expiryDate: parsedExpiryDate
            },
            link: link || null,
            comment: comment || null,
            wantApprovers: parsedWantApprovers,
            documentApprovalAuthority: documentApprovalAuthority,
            currentVersionLabel: "1.0",
            currentVersionNumber: mongoose.Types.Decimal128.fromString("1.0"),
        });

        // ------------------- Process Files -------------------
        let fileDocs = [];
        if (parsedFileIds.length > 0) {
            const tempFiles = await TempFile.find({
                _id: { $in: parsedFileIds },
                status: "temp",
            });

            if (tempFiles.length > 0) {
                // Create File documents
                const fileCreateDocs = tempFiles.map((tempFile, index) => ({
                    document: document._id,
                    file: tempFile.s3Filename,
                    s3Url: tempFile.s3Url,
                    originalName: tempFile.originalName,
                    fileType: tempFile.fileType,
                    folder: validFolderId || tempFile.folder || null,
                    projectId: document.project || null,
                    departmentId: document.department || null,
                    version: mongoose.Types.Decimal128.fromString("1.0"),
                    uploadedBy: req.user._id,
                    uploadedAt: new Date(),
                    fileSize: tempFile.size,
                    hash: tempFile.hash || null,
                    isPrimary: index === 0,
                    status: "active",
                }));

                fileDocs = await File.insertMany(fileCreateDocs);

                // Mark TempFiles as permanent
                await TempFile.updateMany(
                    { _id: { $in: tempFiles.map(t => t._id) } },
                    { $set: { status: "permanent", linkedDocument: document._id } }
                );

                // -----------------------
                // Update Document files
                // -----------------------
                document.files = fileDocs.map(f => f._id);

                // -----------------------
                // Update Folder files
                // -----------------------
                if (validFolderId) {
                    const folder = await Folder.findById(validFolderId);
                    if (folder) {
                        // Remove temp file IDs if they exist
                        folder.files = folder.files
                            .filter(fId => !parsedFileIds.includes(fId.toString()));

                        // Add new File IDs
                        folder.files.push(...fileDocs.map(f => f._id));

                        // Remove duplicates
                        folder.files = [...new Set(folder.files.map(f => f.toString()))];

                        await folder.save();
                        // ------------------- Assign Donor/Vendor permissions to Folder ONLY -------------------
                        if (validFolderId) {
                            const folder = await Folder.findById(validFolderId);

                            if (folder) {
                                const newPermissions = [];

                                // Assign Donor Permission
                                if (documentDonor && mongoose.Types.ObjectId.isValid(documentDonor)) {
                                    const donorExists = folder.permissions.some(
                                        p => String(p.principal) === String(documentDonor)
                                    );

                                    if (!donorExists) {
                                        newPermissions.push({
                                            principal: documentDonor,
                                            model: "User",
                                            access: "view",
                                            canDownload: true
                                        });
                                    }
                                }

                                // Assign Vendor Permission
                                if (documentVendor && mongoose.Types.ObjectId.isValid(documentVendor)) {
                                    const vendorExists = folder.permissions.some(
                                        p => String(p.principal) === String(documentVendor)
                                    );

                                    if (!vendorExists) {
                                        newPermissions.push({
                                            principal: documentVendor,
                                            model: "User",
                                            access: "view",
                                            canDownload: true
                                        });
                                    }
                                }

                                // Push new permissions
                                if (newPermissions.length > 0) {
                                    folder.permissions.push(...newPermissions);
                                    await folder.save();
                                }
                            }
                        }

                    }
                }
            }
        }
        // ------------------- Handle Signature (optional) -------------------
        if (req.files?.signatureFile?.[0]) {
            const file = req.files.signatureFile[0];
            if (!file.mimetype.startsWith("image/")) {
                return failResponse(res, "Signature must be an image", 400);
            }
            document.signature = {
                fileName: file.originalname,
                fileUrl: file.location,
                uploadedAt: new Date(),
            };
        } else if (req.body.signature?.startsWith("data:image/")) {
            try {
                const base64Data = req.body.signature.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, "base64");
                const fileName = `signatures/signature-${Date.now()}.png`;

                const uploadParams = {
                    Bucket: API_CONFIG.AWS_BUCKET,
                    Key: fileName,
                    Body: buffer,
                    ContentEncoding: "base64",
                    ContentType: "image/png",
                };

                await s3Client.send(new PutObjectCommand(uploadParams));

                const fileUrl = `https://${API_CONFIG.AWS_BUCKET}.s3.amazonaws.com/${fileName}`;

                document.signature = {
                    fileName,
                    fileUrl,
                    uploadedAt: new Date(),
                };
            } catch (err) {
                logger.error("Signature upload error (S3):", err);
            }
        }

        // ------------------- Save Document -------------------
        await document.save();
        if (document.project) {
            try {
                await recomputeProjectStats(document.project);
            } catch (err) {
                logger.error("Failed to recompute project total tags after create:", err);
            }
        }
        // ------------------- Notifications -------------------
        try {

            // 1) Notify Approval Authority
            if (parsedWantApprovers && documentApprovalAuthority.length > 0) {
                for (const authority of documentApprovalAuthority) {
                    await addNotification({
                        recipient: authority.userId._id || authority.userId,
                        sender: userId,
                        type: "approval_request",
                        title: "Document Approval Required",
                        message: `${userName} uploaded a new document that requires your approval.`,
                        relatedDocument: document._id,
                        relatedProject: project || null,
                        priority: "high",
                        actionUrl: `/documents/${document._id}?tab=approval`
                    });
                }
            }

            // 2) Notify Project Manager
            if (projectManager && mongoose.Types.ObjectId.isValid(projectManager)) {
                await addNotification({
                    recipient: projectManager,
                    sender: userId,
                    type: "document",
                    title: "New Document Uploaded",
                    message: `${userName} uploaded a document under your project.`,
                    relatedDocument: document._id,
                    relatedProject: project || null,
                    priority: "medium",
                    actionUrl: `/documents/${document._id}`
                });
            }

            // 3) Notify Document Donor
            if (documentDonor && mongoose.Types.ObjectId.isValid(documentDonor)) {
                await addNotification({
                    recipient: documentDonor,
                    sender: userId,
                    type: "document",
                    title: "Document Added (Donor)",
                    message: `${userName} uploaded a new document involving you as Donor.`,
                    relatedDocument: document._id,
                    relatedProject: project || null,
                    priority: "medium",
                    actionUrl: `/documents/${document._id}`
                });
            }

            //4) Notify Document Vendor
            if (documentVendor && mongoose.Types.ObjectId.isValid(documentVendor)) {
                await addNotification({
                    recipient: documentVendor,
                    sender: userId,
                    type: "document",
                    title: "Document Added (Vendor)",
                    message: `${userName} uploaded a new document involving you as Vendor.`,
                    relatedDocument: document._id,
                    relatedProject: project || null,
                    priority: "medium",
                    actionUrl: `/documents/${document._id}`
                });
            }

            // 5) Notify Department Manager if needed
            if (department) {
                const dept = await Department.findById(department).select("manager");
                if (dept?.manager) {
                    await addNotification({
                        recipient: dept.manager,
                        sender: userId,
                        type: "document",
                        title: "Department Document Update",
                        message: `${userName} added a new document to your department.`,
                        relatedDocument: document._id,
                        relatedProject: project || null,
                        priority: "low",
                        actionUrl: `/documents/${document._id}`
                    });
                }
            }

        } catch (notifyErr) {
            logger.error("Notification sending failed:", notifyErr);
        }

        await activityLogger({
            actorId: userId,
            entityId: document._id,
            entityType: "Document",
            action: "ADDED DOCUMENT",
            details: `${userName} added document ${document?.metadata?.fileName}`,
            meta: { changes: ["Document added"] }
        });

        // ------------------- Populate and Respond -------------------
        await document.populate([
            { path: "department", select: "name" },
            { path: "project", select: "projectName" },
            { path: "owner", select: "name email" },
            { path: "files", select: "originalName fileType s3Url" },
            { path: "documentApprovalAuthority.userId", select: "name email" },
        ]);

        await createVersionSnapshot(document, {}, userId, "Initial document creation");

        return successResponse(res, { document }, "Document created successfully", 201);
    } catch (error) {
        logger.error("Document creation error:", error);
        if (error.name === "ValidationError") {
            const errors = Object.values(error.errors).map((err) => err.message);
            return failResponse(res, "Validation failed", 400, errors);
        }
        return errorResponse(res, error, "Failed to create document");
    }
};


const createVersionSnapshot = async (document, changesMade, userId, reason) => {
    try {
        const snapshot = {
            description: document.description,
            metadata: document.metadata,
            tags: document.tags,
            compliance: document.compliance,
            signature: document.signature,
            link: document.link,
            comment: document.comment,
            status: document.status,
            wantApprovers: document.wantApprovers,
            folderId: document.folderId,
            project: document.project,
            department: document.department,
            projectManager: document.projectManager,
            documentDonor: document.documentDonor,
            documentVendor: document.documentVendor,
            updatedAt: document.updatedAt,
            files: document.files,
        };

        const versionNumber = document.currentVersionNumber;
        const versionLabel = document.currentVersionLabel;

        const versionDoc = await DocumentVersion.create({
            documentId: document._id,
            snapshot,
            changesMade,
            createdBy: userId,
            changeReason: reason,
            versionNumber,
            versionLabel,
            files: document.files,
            timestamp: new Date(),
        });

        return versionDoc;
    } catch (error) {
        console.error('Error creating version snapshot:', error);
        throw error;
    }
};

export const updateDocument = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Invalid document ID" });
        }
        const document = await Document.findById(id).session(session);
        if (!document) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: "Document not found" });
        }

        // Permission check
        const isOwner = document.owner.toString() === req.user._id.toString();

        const isSuperAdmin = req?.user?.profile_type === "superadmin";

        if (!req.user || (!isOwner && !isSuperAdmin)) {
            await session.abortTransaction();
            return res.status(403).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const originalDoc = document.toObject();
        const updateData = { ...req.body };

if (typeof updateData.compliance === "string") {
    updateData.compliance = {
        isCompliance: updateData.compliance.toLowerCase() === "yes"
    };
}

if (updateData.expiryDate) {
    if (!updateData.compliance) updateData.compliance = {};

    updateData.compliance.expiryDate = updateData.expiryDate;
    delete updateData.expiryDate;
}

        const changedFields = [];
        const versionedChanges = [];

        const VERSIONED_FIELDS = [
            "description", "comment", "link", "files",
            "signature", "compliance", "tags", "metadata", "startDate", "metadataFileName"
        ];

        if (updateData.fileIds) {
            try {
                let fileIds = [];
                if (typeof updateData.fileIds === 'string') {
                    fileIds = JSON.parse(updateData.fileIds);
                } else if (Array.isArray(updateData.fileIds)) {
                    fileIds = updateData.fileIds;
                }

                if (fileIds.length === 0 && some_condition_files_are_required) {
                    await session.abortTransaction();
                    return res.status(400).json({ success: false, message: "Files are required for this type of update." });
                }

                if (fileIds.length > 0) {
                    const newFiles = await processFileUpdates(document, fileIds, req.user, changedFields, session);

                    if (newFiles?.length) {
                        if (!versionedChanges.includes("files")) {
                            versionedChanges.push("files");
                        }
                    }
                }
                delete updateData.fileIds;
            } catch (error) {
                console.error('Error processing fileIds:', error);
                throw new Error('Invalid fileIds format or file processing error');
            }
        }

        for (let [key, value] of Object.entries(updateData)) {
            // normalize
            if (typeof value === "string") {
                const v = value.trim().toLowerCase();
            
                if (v === "undefined") continue;
                if (v === "null" || v === "") value = null;
            }
            
            if (value === undefined) continue;
        
          
            const objectIdFields = ["documentDonor", "documentVendor", "project", "department", "folderId", "projectManager"];
        
            if (objectIdFields.includes(key)) {
        
                if (value === null) {
                    if (document[key] !== null) {
                        document[key] = null;
                        changedFields.push(key);
                    }
                    continue;
                }
        
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        message: `Invalid ObjectId for ${key}`
                    });
                }
            }
            switch (key) {
                case "metadata":
                    try {
                        const newMeta = typeof value === "string" ? JSON.parse(value) : value;
                        const currentMetaStr = JSON.stringify(document.metadata);
                        const newMetaStr = JSON.stringify({ ...document.metadata, ...newMeta });

                        if (currentMetaStr !== newMetaStr) {
                            document.metadata = { ...document.metadata, ...newMeta };
                            changedFields.push("metadata");
                            versionedChanges.push("metadata");
                        }
                    } catch (e) {
                        console.warn("Invalid metadata format:", e);
                    }
                    break;

                case "metadataFileName":
                    if (!document.metadata) {
                        document.metadata = {};
                    }
                    if (document.metadata.fileName !== value) {
                        document.metadata.fileName = value;
                        changedFields.push("metadata.fileName");
                        versionedChanges.push("metadata");
                    }
                    break;
                case "tags":
                    const newTags = Array.isArray(value)
                        ? value.map(x => x.trim().toLowerCase())
                        : value.split(",").map(x => x.trim().toLowerCase());

                    const currentTags = document.tags.map(t => t.toLowerCase()).sort();
                    const newTagsSorted = [...newTags].sort();

                    if (JSON.stringify(currentTags) !== JSON.stringify(newTagsSorted)) {
                        document.tags = newTags;
                        changedFields.push("tags");
                        versionedChanges.push("tags");
                    }
                    break;

                case "description":
                case "comment":
                case "link":
                    if (document[key] !== value) {
                        document[key] = value;
                        changedFields.push(key);
                        versionedChanges.push(key);
                    }
                    break;

                case "compliance":
                    let complianceUpdated = false;
                    if (typeof value === 'string') {
                        const isCompliance = value.toLowerCase() === 'yes';
                        if (document.compliance.isCompliance !== isCompliance) {
                            document.compliance.isCompliance = isCompliance;
                            changedFields.push("compliance.isCompliance");
                            complianceUpdated = true;
                        }
                    } else if (typeof value === 'object') {
                        Object.keys(value).forEach(subKey => {
                            const currentValue = document.compliance[subKey];
                            const newValue = value[subKey];

                            if (currentValue?.toString() !== newValue?.toString()) {
                                document.compliance[subKey] = newValue;
                                changedFields.push(`compliance.${subKey}`);
                                complianceUpdated = true;
                            }
                        });
                    }
                    if (complianceUpdated && !versionedChanges.includes("compliance")) {
                        versionedChanges.push("compliance");
                    }
                    break;

                default:
                    if (document.schema.path(key) && document[key] !== value) {
                        document[key] = value;
                        changedFields.push(key);
                
                        if (VERSIONED_FIELDS.includes(key) && !versionedChanges.includes(key)) {
                            versionedChanges.push(key);
                        }
                    }
                    break;
            }
        }

        // ------------------------
        // DATE VALIDATION AND APPLICATION
        // ------------------------

        let dateChanges = false;
        let newStartDate = document.startDate;
        let newExpiryDate = document.compliance?.expiryDate;

        // Parse startDate (documentDate)
        if (updateData.documentDate) {
            let parsed = new Date(updateData.documentDate);
            if (isNaN(parsed.getTime())) {
                const p = updateData.documentDate.split(/[-\/]/);
                if (p.length === 3) parsed = new Date(`${p[2]}-${p[1]}-${p[0]}`);
            }
            if (!isNaN(parsed.getTime())) newStartDate = parsed;
        }

        // Parse expiryDate
        if (updateData.compliance?.expiryDate) {
            let exp = new Date(updateData.compliance.expiryDate);
        
            if (!isNaN(exp.getTime())) {
                newExpiryDate = exp;
            }
        }
        
        // Validate ONLY when compliance = true
        const isCompliance =
        updateData.compliance?.isCompliance !== undefined
            ? updateData.compliance.isCompliance
            : document.compliance.isCompliance;
    
        if (isCompliance && newStartDate && newExpiryDate) {
            if (newStartDate > newExpiryDate) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: "Start cannot be greater than or equal to expiry date."
                });
            }
        }

        if (updateData.documentDate && newStartDate && document.startDate?.getTime() !== newStartDate.getTime()) {
            document.startDate = newStartDate;
            changedFields.push("startDate");
            versionedChanges.push("startDate");
            dateChanges = true;
        }

        if (updateData.compliance?.expiryDate && newExpiryDate && document.compliance.expiryDate?.getTime() !== newExpiryDate.getTime()) {
            document.compliance.expiryDate = newExpiryDate;
            changedFields.push("compliance.expiryDate");
            if (!versionedChanges.includes("compliance")) versionedChanges.push("compliance"); // Compliance is a versioned parent field
            dateChanges = true;
        }


        // ------------------------
        // SIGNATURE HANDLING
        // ------------------------

        const signatureUpdated = await handleSignatureUpdate(document, req);
        if (signatureUpdated) {
            changedFields.push("signature");
            versionedChanges.push("signature");
        }

        if (changedFields.length === 0) {
            await session.abortTransaction();
            return res.status(200).json({
                success: true,
                message: "No changes detected",
                data: document
            });
        }

        // Update timestamp
        document.updatedAt = new Date();


        // ------------------------
        // VERSIONING
        // ------------------------
        if (versionedChanges.length > 0) {

            const latestVersionDoc = await DocumentVersion.findOne({ documentId: document._id })
                .sort({ versionNumber: -1 })
                .session(session)
                .lean();

            const baseVersionLabel = latestVersionDoc
                ? latestVersionDoc.versionLabel
                : document.currentVersionLabel; 
            const updatedDoc = document.toObject();
            const diff = computeDiff(originalDoc, updatedDoc, versionedChanges);
            const readableReason = createReadableChangeReason(diff);

            const { versionLabel, versionNumber } = bumpVersion(baseVersionLabel);

            document.previousVersionLabel = document.currentVersionLabel;
            document.currentVersionLabel = versionLabel;
            document.currentVersionNumber = versionNumber;
            document.__versionDiff = diff;
            document.__readableReason = readableReason;
        }
        await document.save({ session });


        // ------------------------
        // CREATE VERSION
        // ------------------------
        if (versionedChanges.length > 0) {
            await createVersionSnapshot(
                document,
                document.__versionDiff,
                req.user._id,
                document.__readableReason
            );

            // Clean up temporary properties
            delete document.__versionDiff;
            delete document.__readableReason;
        }


        await session.commitTransaction();


        try {
            if (versionedChanges.includes("tags")) {
                if (document.project) {
                    await recomputeProjectStats(document.project);
                }
            }

            const originalProjectId = originalDoc.project ? originalDoc.project.toString() : null;
            const newProjectId = document.project ? document.project.toString() : null;

            if (originalProjectId !== newProjectId) {
                if (originalProjectId) {
                    await recomputeProjectStats(originalProjectId);
                }
                if (newProjectId) {
                    await recomputeProjectStats(newProjectId);
                }
            }

            // Always recompute files when files changed
            if (versionedChanges.includes("files") && document.project) {
                await recomputeProjectStats(document.project);
            }
        } catch (err) {
            // NOTE: logger must be available in scope
            logger.error("Failed to recompute project totals after update:", err);
        }


        // ------------------------
        // POPULATE AND RESPOND
        // ------------------------
        const responseDoc = await Document.findById(document._id)
            .populate("files")
            .populate("owner", "name email")
            .populate("folderId", "name")
            .populate("project", "projectName name")
            .populate("department", "name")
            .populate("projectManager", "name email")
            .populate("documentDonor", "name email")
            .populate("documentVendor", "name email");

        return res.status(200).json({
            success: true,
            message: "Document updated successfully",
            data: {
                document: responseDoc,
                changes: changedFields,
                version: document.currentVersionLabel,
                filesUpdated: versionedChanges.includes("files")
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("❌ Document update error:", error);
        return res.status(500).json({
            success: false,
            message: "Error updating document",
            error: error.message
        });
    } finally {
        session.endSession();
    }
};


const processFileUpdates = async (document, fileIds, user, changedFields, session = null) => {
    try {

        const validFileIds = fileIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validFileIds.length === 0) {
            return [];
        }

        // Fetch temp files
        const tempFiles = await TempFile.find({
            _id: { $in: validFileIds },
            status: "temp"
        }).session(session);

        if (tempFiles.length === 0) {
            return [];
        }

        // Deactivate current primary files in document
        await File.updateMany(
            { document: document._id, isPrimary: true, status: "active" },
            { $set: { isPrimary: false, status: "inactive", deactivatedAt: new Date() } },
            { session }
        );

        // Compute new version for files
        const currentVersion = document.currentVersionNumber
            ? parseFloat(document.currentVersionNumber.toString())
            : 1.0;
        const newVersion = (currentVersion + 0.1).toFixed(1);

        // Prepare File documents
        const fileCreateDocs = tempFiles.map((tempFile, index) => ({
            document: document._id,
            file: tempFile.s3Filename,
            s3Url: tempFile.s3Url,
            originalName: tempFile.originalName,
            fileType: tempFile.fileType,
            folder: document.folderId || null,
            projectId: document.project || null,
            departmentId: document.department || null,
            version: mongoose.Types.Decimal128.fromString(newVersion),
            uploadedBy: user._id,
            uploadedAt: new Date(),
            fileSize: tempFile.size,
            hash: tempFile.hash || null,
            isPrimary: index === 0,
            status: "active",
            mimeType: tempFile.mimeType || tempFile.fileType
        }));

        // Insert new files
        const newFiles = await File.insertMany(fileCreateDocs, { session });
        const newFileIds = newFiles.map(f => f._id);

        // Update TempFiles to permanent
        await TempFile.updateMany(
            { _id: { $in: tempFiles.map(t => t._id) } },
            { $set: { status: "permanent", linkedDocument: document._id } },
            { session }
        );

        // -----------------------
        // Update Document Files
        // -----------------------
        // CLEAR old files and set only new ones
        document.files = newFileIds;  // FULL REPLACEMENT
        if (!changedFields.includes("files")) {
            changedFields.push("files");
        }

        // -----------------------
        // Update Folder Files
        // -----------------------
        if (document.folderId) {
            const folder = await Folder.findById(document.folderId).session(session);
            if (folder) {
                const folderFileIds = folder.files.map(id => id.toString());

                // Remove tempFile IDs from folder
                const filteredFolderFiles = folder.files.filter(fId => !validFileIds.includes(fId.toString()));

                // Add new File IDs
                folder.files = [...new Set([...filteredFolderFiles, ...newFileIds])];
                await folder.save({ session });
            }
        }
        return newFileIds;

    } catch (error) {
        console.error('Error in processFileUpdates:', error);
        throw error;
    }
};

/**
 * Handle signature updates
 */
const handleSignatureUpdate = async (document, req) => {
    let signatureUpdated = false;

    try {
        // If user uploaded a file via multipart
        if (req.files?.signature?.[0]) {
            const file = req.files.signature[0];
            if (!file.mimetype.startsWith("image/")) {
                throw new Error("Signature must be an image");
            }

            document.signature = {
                fileName: file.originalname,
                fileUrl: file.location, // multer-s3 URL
                uploadedAt: new Date(),
            };
            signatureUpdated = true;
        }
        // If signature is sent as base64 string
        else if (req.body.signature?.startsWith("data:image/")) {
            const base64Data = req.body.signature.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, "base64");
            const fileName = `signatures/signature-${document._id}-${Date.now()}.png`;

            const uploadParams = {
                Bucket: API_CONFIG.AWS_BUCKET,
                Key: fileName,
                Body: buffer,
                ContentEncoding: "base64",
                ContentType: "image/png",
            };

            await s3Client.send(new PutObjectCommand(uploadParams));

            const fileUrl = `https://${API_CONFIG.AWS_BUCKET}.s3.amazonaws.com/${fileName}`;

            document.signature = {
                fileName,
                fileUrl,
                uploadedAt: new Date(),
            };

            signatureUpdated = true;
        }
    } catch (error) {
        console.error("Signature update error (S3):", error);
        throw error;
    }

    return signatureUpdated;
};


/**
 * Create version history entry
 */
export const createDocumentVersion = async (document, user, reason, changedFields) => {
    const snapshot = {};

    changedFields.forEach(field => {
        if (document[field] !== undefined && field !== "files") {
            snapshot[field] = JSON.parse(JSON.stringify(document[field]));
        }
    });
    // const newFiles = document.__newFiles || [];
    await DocumentVersion.create({
        documentId: document._id,
        versionNumber: document.currentVersionNumber,
        versionLabel: document.currentVersionLabel,
        createdBy: user?._id || null,
        changeReason: reason,
        snapshot,
        files: document.files
    });
};

/**
 * Restore to specific version
 */
export const restoreVersion = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const profile_type = req.user?.profile_type;

        // bypass superadmin
        if (!req.user || !profile_type) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        session.startTransaction();

        const { id, versionId } = req.params;

        // Validate Document ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid document ID"
            });
        }

        // Load document
        const document = await Document.findById(id).session(session);
        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        // Load version (accepts ObjectId OR versionNumber)
        let version;

        if (mongoose.Types.ObjectId.isValid(versionId)) {
            version = await DocumentVersion.findById(versionId).session(session);
        } else {
            version = await DocumentVersion.findOne({
                documentId: id,
                versionNumber: Number(versionId)
            }).session(session);
        }

        if (!version) {
            return res.status(404).json({
                success: false,
                message: "Version not found"
            });
        }

        //Permission check
        const isOwner = document.owner.toString() === req.user._id.toString();
        const isSuperAdmin = profile_type?.toLowerCase() === "superadmin";

        if (!isOwner && !isSuperAdmin) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized"
            });
        }

        // Apply snapshot to current document
        const snapshot = version.snapshot;

        Object.keys(snapshot).forEach(field => {
            if (document[field] !== undefined) {
                document[field] = snapshot[field];
            }
        });

        // Update version pointers
        document.currentVersion = version._id;
        document.latestVersion = version._id;
        document.currentVersionLabel = version.versionLabel;
        document.currentVersionNumber = version.versionNumber;

        await document.save({ session });

        await session.commitTransaction();

        return res.status(200).json({
            success: true,
            message: `Document restored to version ${version.versionLabel} successfully`,
            data: {
                currentVersionLabel: version.versionLabel,
                currentVersionNumber: version.versionNumber,
                versionId: version._id
            }
        });

    } catch (err) {
        await session.abortTransaction();
        console.error("Restore error:", err);

        return res.status(500).json({
            success: false,
            message: "Failed to restore document version",
            error: err.message
        });
    } finally {
        session.endSession();
    }
};

/**
 * View specific version of document
 */
export const viewVersion = async (req, res) => {
    try {
        const { id, versionId } = req.params;

        // Validate IDs
        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(versionId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid document or version ID"
            });
        }

        // Get version with populated data
        const version = await DocumentVersion.findById(versionId)
            .populate('createdBy', 'name email avatar')
            .populate('files');

        if (!version || version.documentId.toString() !== id) {
            return res.status(404).json({
                success: false,
                message: "Version not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Version details retrieved successfully",
            data: {
                version: {
                    id: version._id,
                    versionNumber: version.versionNumber,
                    versionLabel: version.versionLabel,
                    changeReason: version.changeReason,
                    createdAt: version.createdAt,
                    createdBy: version.createdBy,
                    snapshot: version.snapshot,
                    files: version.files
                }
            }
        });

    } catch (error) {
        console.error('View version error:', error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve version details",
            error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
        });
    }
};

export const compareVersions = async (req, res) => {
    try {
        const { id } = req.params;
        const { fromVersion, toVersion } = req.query;

        if (!fromVersion || !toVersion) {
            return res.status(400).json({
                success: false,
                message: "Both fromVersion and toVersion parameters are required"
            });
        }

        // Get both versions
        const [version1, version2] = await Promise.all([
            DocumentVersion.findOne({
                documentId: id,
                $or: [
                    { versionLabel: fromVersion },
                    { versionNumber: parseInt(fromVersion) }
                ]
            }),
            DocumentVersion.findOne({
                documentId: id,
                $or: [
                    { versionLabel: toVersion },
                    { versionNumber: parseInt(toVersion) }
                ]
            })
        ]);

        if (!version1 || !version2) {
            return res.status(404).json({
                success: false,
                message: "One or both versions not found"
            });
        }

        // Simple field comparison (you can enhance this with deep diff)
        const changes = {};
        const snapshot1 = version1.snapshot || {};
        const snapshot2 = version2.snapshot || {};

        Object.keys(snapshot2).forEach(key => {
            if (JSON.stringify(snapshot1[key]) !== JSON.stringify(snapshot2[key])) {
                changes[key] = {
                    from: snapshot1[key],
                    to: snapshot2[key]
                };
            }
        });

        return res.status(200).json({
            success: true,
            message: "Versions compared successfully",
            data: {
                fromVersion: version1.versionLabel,
                toVersion: version2.versionLabel,
                changes,
                summary: {
                    changedFields: Object.keys(changes),
                    totalChanges: Object.keys(changes).length
                }
            }
        });

    } catch (error) {
        console.error('Compare versions error:', error);

        return res.status(500).json({
            success: false,
            message: "Failed to compare versions",
            error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
        });
    }
};

/**
 * Get complete version history for a document
 */
export const getVersionHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 20, search } = req.query;

        // Validate document ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid document ID"
            });
        }

        // Check if document exists
        const document = await Document.findById(id);
        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        // Build query
        const query = { documentId: id };
        if (search) {
            query.$or = [
                { changeReason: { $regex: search, $options: 'i' } },
                { versionLabel: { $regex: search, $options: 'i' } }
            ];
        }

        // Get paginated version history
        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { versionNumber: -1 },
            populate: {
                path: 'createdBy',
                select: 'name email avatar'
            }
        };

        const versions = await DocumentVersion.paginate(query, options);

        return res.status(200).json({
            success: true,
            message: "Version history retrieved successfully",
            data: {
                documentId: document._id,
                currentVersion: document.currentVersionLabel,
                totalVersions: versions.totalDocs,
                currentPage: versions.page,
                totalPages: versions.totalPages,
                hasNext: versions.hasNextPage,
                hasPrev: versions.hasPrevPage,
                versions: versions.docs.map(version => ({
                    versionId: version._id,
                    documentName: version.snapshot?.metadata?.fileName || null,
                    versionLabel: version.versionLabel,
                    changeReason: version.changeReason,
                    createdAt: version.createdAt,
                    createdBy: version.createdBy,
                    fileCount: version.files?.length || 0
                }))
            }
        });

    } catch (error) {
        console.error('Get version history error:', error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve version history",
            error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
        });
    }
};

export const viewDocumentVersion = async (req, res) => {
    try {
        const { id } = req.params;
        let { version } = req.query;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ message: "Invalid document ID" });

        const baseDoc = await Document.findById(id)
            .populate("project", 'projectName')
            .populate("department", 'name priority')
            .populate("folderId", 'name')
            .populate("projectManager", 'name email profile_image')
            .populate("documentDonor", 'name email profile_image')
            .populate("documentVendor", 'name email profile_image')
            .populate("files", 'originalName fileType fileSize fileUrl')
            .populate({
                path: "owner",
                select: "name email userDetails",
                populate: [
                    { path: "userDetails.designation", select: "name" },
                    { path: "userDetails.department", select: "name" }
                ]
            })
            .lean();

        if (!baseDoc)
            return res.status(404).json({ message: "Document not found" });

        if (!version) {
            version = baseDoc.currentVersionLabel || baseDoc.currentVersionNumber;
        }

        const entry = await DocumentVersion.findOne({
            documentId: id,
            $or: [
                { versionLabel: version },
                { versionNumber: Number(version) }
            ]
        })
            .populate("files", 'originalName fileType fileSize fileUrl')
            .populate("createdBy", "name email")
            .lean();

        if (!entry)
            return res.status(404).json({ message: "Version not found" });

        /** Merge snapshot */
        let mergedDoc = {
            ...baseDoc,
            ...entry.snapshot,
            files: entry.files?.length ? entry.files : baseDoc.files
        };

        /** Re-populate merged document */
        mergedDoc = await Document.populate(mergedDoc, [
            { path: "project", select: "projectName" },
            { path: "department", select: "name priority" },
            { path: "folderId", select: "name" },
            { path: "projectManager", select: "name email profile_image" },
            { path: "documentDonor", select: "name email profile_image" },
            { path: "documentVendor", select: "name email profile_image" },
            { path: "files", select: "originalName fileType fileSize fileUrl" },

            {
                path: "owner",
                select: "name email userDetails",
                populate: [
                    { path: "userDetails.designation", select: "name" },
                    { path: "userDetails.department", select: "name" }
                ]
            },

            {
                path: "documentApprovalAuthority.userId",
                select: "name email profile_image"
            },
            {
                path: "documentApprovalAuthority.designation",
                select: "name"
            },

            { path: "sharedWithUsers", select: "name email profile_image" }
        ]);

        return res.json({
            versionLabel: entry.versionLabel,
            versionNumber: entry.versionNumber,
            timestamp: entry.createdAt,
            changedBy: entry.createdBy,
            changeReason: entry.changeReason,
            document: mergedDoc
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error", error: err.message });
    }
};


/**
 * Soft Delete document (Recycle Bin)
 */
export const softDeleteDocument = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return failResponse(res, "Invalid document ID", 400);
        }

        const document = await Document.findById(id);
        if (!document) {
            return failResponse(res, "Document not found", 404);
        }

        if (
            document.owner.toString() !== req.user._id.toString() &&
            req.user.profile_type !== "superadmin"
        ) {
            return failResponse(res, "Only the owner or a superadmin can delete this document", 403);
        }

        // Soft delete
        const updatedDocument = await Document.findByIdAndUpdate(
            id,
            { isDeleted: true, deletedAt: new Date() },
            { new: true }
        );

        // Activity Logger
        await activityLogger({
            actorId: req.user._id,
            entityId: updatedDocument._id,
            entityType: "Document",
            action: "SOFT_DELETE",
            details: `Document ${document?.metadata?.fileName ?? "Untitled"} moved to recycle bin by ${req.user?.name ?? "User"}`,
            meta: { changes: ["Document Soft Deleted"] }
        });

        return successResponse(res, { document: updatedDocument }, "Document moved to recycle-bin");
    } catch (error) {
        return errorResponse(res, error, "Failed to delete document");
    }
};
/**
 * Delete document(s) permanently
 */
export const deleteDocument = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const userId = req.user?._id ?? null;
        const userName = req.user?.name ?? 'Guest';
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Please provide an array of document IDs to delete."
            });
        }

        const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));

        // Fetch documents
        const docs = await Document.aggregate([
            { $match: { _id: { $in: objectIds } } },
            {
                $project: {
                    owner: 1,
                    files: 1,
                    approvalHistory: 1,
                    versionFiles: "$versionHistory.file",
                    project: 1,
                    metadata: 1
                }
            }
        ]);

        if (!docs.length) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "No documents found for the provided IDs."
            });
        }

        if (req.user.profile_type !== "superadmin") {
            const unauthorizedDocs = docs.filter(
                d => d.owner?.toString() !== userId?.toString()
            );

            if (unauthorizedDocs.length > 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(403).json({
                    success: false,
                    message: "You can delete only your own documents. Superadmins can delete any document."
                });
            }
        }

        const fileIds = docs.flatMap(d => [...(d.files || []), ...(d.versionFiles || [])]);
        const approvalIds = docs.flatMap(d => d.approvalHistory || []);

        let filesToDelete = [];
        if (fileIds.length) {
            const files = await File.find({ _id: { $in: fileIds } }).session(session);
            filesToDelete = files.map(f => f.s3Key || f.key).filter(Boolean);
        }

        // Delete dependencies
        const deletions = [];
        if (fileIds.length) deletions.push(File.deleteMany({ _id: { $in: fileIds } }).session(session));
        if (approvalIds.length) deletions.push(Approval.deleteMany({ _id: { $in: approvalIds } }).session(session));
        deletions.push(Notification.deleteMany({ relatedDocument: { $in: objectIds } }).session(session));
        deletions.push(Document.deleteMany({ _id: { $in: objectIds } }).session(session));

        for (const op of deletions) await op;

        await session.commitTransaction();
        session.endSession();

        // Recompute project totals
        try {
            const uniqueProjectIds = [...new Set(docs.map(d => d.project?.toString()).filter(Boolean))];
            for (const projectId of uniqueProjectIds) {
    await recomputeProjectStats(projectId);
            }
        } catch (err) {
            console.error("Failed to recompute project totalTags after delete:", err);
        }

        // S3 file delete
        if (filesToDelete.length) {
            await Promise.allSettled(
                filesToDelete.map(async (key) => {
                    try { await deleteObject(key); }
                    catch (err) { console.error(`Failed to delete S3 object ${key}:`, err.message); }
                })
            );
        }

        // Activity Logging
        await Promise.allSettled(
            docs.map(async (doc) => {
                const fileName = doc?.metadata?.fileName || "Unnamed Document";
                return activityLogger({
                    actorId: userId,
                    entityId: doc._id,
                    entityType: "Document",
                    action: "DELETE",
                    details: `Document '${fileName}' permanently deleted by ${userName}`,
                    meta: { changes: ["Document Deleted"] }
                });
            })
        );

        return res.status(200).json({
            success: true,
            message: `${docs.length} document(s) and related data permanently deleted.`,
            s3FilesDeleted: filesToDelete.length
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error deleting documents permanently:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while deleting documents.",
            error: error.message
        });
    }
};

/**
 * Update document status
 */
export const updateDocumentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, comment } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return failResponse(res, "Invalid document ID", 400);
        }

        const validStatuses = ["Draft", "Pending", "UnderReview", "Approved", "Rejected", "Archived"];
        if (!validStatuses.includes(status)) {
            return failResponse(res, "Invalid status", 400);
        }

        const document = await Document.findById(id);
        if (!document) {
            return failResponse(res, "Document not found", 404);
        }

        // Check permissions
        const permission = document.getUserPermission(req.user._id, req.user.department);
        if (!permission || permission === "view") {
            return failResponse(res, "Insufficient permissions", 403);
        }

        document.status = status;
        if (comment) {
            document.comment = comment;
        }

        // Add audit log
        document.auditLog.push({
            action: "status_update",
            performedBy: req.user._id,
            details: { previousStatus: document.status, newStatus: status, comment }
        });

        await document.save();
        await activityLogger({
            actorId: req.user._id,
            entityId: id,
            entityType: "Document",
            action: "UPDATE STATUS",
            details: `${req.user.name} updated status from ${previousStatus} → ${status}`,
            meta: { previousStatus, newStatus: status, comment }
        });
        return successResponse(res, { document }, "Document status updated successfully");
    } catch (error) {
        return errorResponse(res, error, "Failed to update document status");
    }
};

export const updateShareSettings = async (req, res) => {
    try {
        const { id } = req.params;
        const { ispublic, duration, start, end } = req.query;
        const userId = req.user?._id || null;
        const userName = req.user?.name || "Unknown User";
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid document ID" });
        }

        const document = await Document.findById(id);
        if (!document) {
            return res.status(404).json({ success: false, message: "Document not found" });
        }

        const now = new Date();
        document.ispublic = ispublic === "true";
        document.docExpireDuration = duration;

        let expiresAt = null;
        let used = undefined;

        switch (duration) {
            case "oneday":
                expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                break;
            case "oneweek":
                expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                break;
            case "onemonth":
                expiresAt = new Date(now);
                expiresAt.setMonth(expiresAt.getMonth() + 1);
                break;
            case "custom":
                if (!start || !end)
                    return res.status(400).json({ success: false, message: "Custom start and end dates are required" });

                const startDate = new Date(start);
                const endDate = new Date(end);

                if (isNaN(startDate) || isNaN(endDate))
                    return res.status(400).json({ success: false, message: "Invalid custom date format" });

                if (endDate <= startDate)
                    return res.status(400).json({ success: false, message: "End date must be after start date" });

                // Save custom range
                document.DoccustomStart = startDate;
                document.DoccustomEnd = endDate;
                expiresAt = endDate;
                break;
            case "onetime":
                used = false;
                break;
            case "lifetime":
                expiresAt = new Date(now);
                expiresAt.setFullYear(expiresAt.getFullYear() + 50);
                break;
            default:
                expiresAt = null;
        }

        document.docExpiresAt = expiresAt;
        if (typeof used !== "undefined") document.used = used;

        // If not public, clear expiration fields
        if (ispublic !== "true") {
            document.docExpireDuration = "lifetime";
            document.docExpiresAt = null;
            document.DoccustomStart = null;
            document.DoccustomEnd = null;
        }

        await document.save();
        await activityLogger({
            actorId: userId,
            entityId: document._id,
            entityType: "Document",
            action: "UPDATE SHARE SETTINGS",
            details: `${userName} updated share settings for '${document.metadata.fileName}'`,
            meta: {
                ispublic: document.ispublic,
                expiration: document.docExpiresAt,
                duration: document.docExpireDuration
            }
        });
        return res.status(200).json({
            success: true,
            message: "Document share settings updated successfully",
            data: {
                ispublic: document.ispublic,
                docExpireDuration: document.docExpireDuration,
                docExpiresAt: document.docExpiresAt,
                DoccustomStart: document.DoccustomStart,
                DoccustomEnd: document.DoccustomEnd
            }
        });
    } catch (error) {
        console.error("Error updating share settings:", error);
        return res.status(500).json({ success: false, message: "Failed to update document share settings" });
    }
};


/**
 * Share document with users or departments
 */
export const shareDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const {
            accessLevel = "view",
            duration = "lifetime",
            customEnd,
            generalAccess = false,
            userIds = []
        } = req.body;

        // --- Validate IDs ---
        if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid document or user ID" });
        }

        const doc = await Document.findById(id);
        if (!doc) return res.status(404).json({ success: false, message: "Document not found" });

        const isOwner = doc.owner.toString() === userId.toString();
        const existingEditAccess = await SharedWith.findOne({ document: id, user: userId, accessLevel: "edit" });

        if (!isOwner && !existingEditAccess) {
            return res.status(403).json({ success: false, message: "You don't have permission to share this document" });
        }

        // --- Determine expiration date ---
        const now = new Date();
        let expiresAt = null;
        let used;

        switch (duration) {
            case "oneday":
                expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                break;
            case "oneweek":
                expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                break;
            case "onemonth":
                expiresAt = new Date(now);
                expiresAt.setMonth(expiresAt.getMonth() + 1);
                break;
            case "custom":
                if (!customEnd)
                    return res.status(400).json({ success: false, message: "Custom end date required" });
                expiresAt = new Date(customEnd);
                if (expiresAt <= now)
                    return res.status(400).json({ success: false, message: "Custom end date must be in the future" });
                break;
            case "onetime":
                used = false;
                break;
            case "lifetime":
                expiresAt = new Date(now);
                expiresAt.setFullYear(expiresAt.getFullYear() + 50);
                break;
            default:
                expiresAt = null;
        }


        const finalAccessLevel = accessLevel;
        const generalRole = (accessLevel === "edit") ? "editor" : "viewer";

        const shareData = {
            accessLevel: finalAccessLevel,
            duration,
            expiresAt,
            generalAccess,
            generalRole
        };
        if (used !== undefined) shareData.used = used;

        let updatedShares = [];


        if (generalAccess) {
            const generalShare = await SharedWith.findOneAndUpdate(
                { document: id, generalAccess: true },
                shareData,
                { upsert: true, new: true }
            );
            if (generalShare) updatedShares.push(generalShare);
        }

        // --- Handle user-specific shares ---
        if (userIds.length) {
            const validUserIds = userIds.filter(uid => mongoose.Types.ObjectId.isValid(uid));

            if (validUserIds.length) {
                const bulkOps = validUserIds.map(uid => ({
                    updateOne: {
                        filter: { document: id, user: uid },
                        update: { $set: shareData, $setOnInsert: { document: id, user: uid } },
                        upsert: true
                    }
                }));

                await SharedWith.bulkWrite(bulkOps);

                const userShares = await SharedWith.find({ document: id, user: { $in: validUserIds } });
                updatedShares = updatedShares.concat(userShares);
            }
        }

        if (!updatedShares.length) {
            return res.status(404).json({ success: false, message: "No share records found or created" });
        }
        // ACTIVITY LOG
        await activityLogger({
            actorId: req.user._id,
            entityId: id,
            entityType: "Document",
            action: "SHARE DOCUMENT",
            details: `${req.user.name} updated share permissions for document '${doc.metadata.fileName}'`,
            meta: {
                accessLevel,
                duration,
                userIds,
                generalAccess
            }
        });

        return res.json({ success: true, message: "Share data updated successfully", data: updatedShares });
    } catch (err) {
        console.error("Update document share error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};


/**
 * Update user access level permission
 * PUT /api/documents/:documentId/permissions
 */
export const bulkPermissionUpdate = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { users } = req.body; // [{ userId, accessLevel, canDownload }]

        if (!mongoose.Types.ObjectId.isValid(documentId)) {
            return res.status(400).json({ success: false, message: "Invalid document ID" });
        }

        // if (!Array.isArray(users) || users.length === 0) {
        //     return res.status(400).json({ success: false, message: "No users provided" });
        // }

        const operations = [];
        const invalidIds = [];

        users.forEach(user => {
            const { userId, accessLevel, canDownload } = user;

            if (!mongoose.Types.ObjectId.isValid(userId)) {
                invalidIds.push(userId);
                return;
            }

            const updateFields = {};
            if (accessLevel) updateFields.accessLevel = accessLevel;
            if (canDownload !== undefined) updateFields.canDownload = canDownload;

            operations.push({
                updateOne: {
                    filter: { document: documentId, user: userId },
                    update: { $set: updateFields }
                }
            });
        });

        // if (operations.length === 0) {
        //     return res.status(400).json({ success: false, message: "No valid users to update", invalidIds });
        // }

        const bulkResult = await SharedWith.bulkWrite(operations);
        await activityLogger({
            actorId: req.user._id,
            entityId: documentId,
            entityType: "Document",
            action: "PERMISSION UPDATE",
            details: `${req.user.name} updated permissions for multiple users`,
            meta: { updates: users }
        });
        res.json({
            success: true,
            message: "Permission updated",
            bulkResult,
            invalidIds
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


/**
 * Update user access level or download permission
 * PUT /api/documents/share/:documentId
 */
export const updateSharedUser = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { userId, accessLevel, canDownload } = req.body;

        if (!mongoose.Types.ObjectId.isValid(documentId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid ID" });
        }

        const share = await SharedWith.findOne({ document: documentId, user: userId });
        if (!share) return res.status(404).json({ success: false, message: "User not found in shared list" });

        if (accessLevel) share.accessLevel = accessLevel;
        if (canDownload !== undefined) share.canDownload = canDownload;

        await share.save();
        await activityLogger({
            actorId: req.user._id,
            entityId: documentId,
            entityType: "Document",
            action: "UPDATE USER SHARE",
            details: `${req.user.name} updated access for user ${userId}`,
            meta: { accessLevel, canDownload }
        });
        res.json({ success: true, message: "User access updated successfully", data: share });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Remove a user from shared list
 * DELETE /api/documents/share/:documentId
 */
export const removeSharedUser = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { userId } = req.body;

        if (!mongoose.Types.ObjectId.isValid(documentId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid ID" });
        }

        const doc = await Document.findById(documentId);
        if (!doc) return res.status(404).json({ success: false, message: "Document not found" });

        await SharedWith.deleteOne({ document: documentId, user: userId });
        await Document.findByIdAndUpdate(documentId, { $pull: { sharedWithUsers: userId } });
        await activityLogger({
            actorId: req.user._id,
            entityId: documentId,
            entityType: "Document",
            action: "REMOVE SHARED USER",
            details: `${req.user.name} removed user ${userId} from shared list`,
            meta: { removedUser: userId }
        });
        res.json({ success: true, message: "User removed from shared list" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


/**
 * @desc    Get list of users a document is shared with
 * @route   GET /api/documents/:id/shared-users
 * @access  Private
 */
export const getSharedUsers = async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user?._id;
        const profileType = req.user?.profile_type;

        // --- Validate IDs and Auth ---
        if (!mongoose.Types.ObjectId.isValid(documentId)) {
            return res.status(400).json({ success: false, message: "Invalid document ID" });
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // --- Fetch the document ---
        const document = await Document.findById(documentId).populate("owner", "name email");
        if (!document) {
            return res.status(404).json({ success: false, message: "Document not found" });
        }

        // --- Build base query ---
        const query = {
            document: documentId,
            inviteStatus: "accepted"
        };

        // --- Access control ---
        const isOwner = document.owner._id.toString() === userId.toString();
        const isSuperAdmin = profileType === "superadmin";

        // For non-owner and non-superadmin users:
        if (!isOwner && !isSuperAdmin) {
            // Ensure user has access to this document
            const userHasAccess = await SharedWith.exists({
                document: documentId,
                user: userId,
                inviteStatus: "accepted"
            });

            if (!userHasAccess) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to view this document's shared users"
                });
            }

            // Restrict visibility to only shares this user created
            query.addedby = userId;
        }

        // --- Fetch shared users ---
        const shares = await SharedWith.find(query)
            .populate("user", "name email")
            .populate("addedby", "name email");

        const sharedUsers = shares.map(sw => ({
            userId: sw.user?._id,
            name: sw.user?.name,
            email: sw.user?.email,
            accessLevel: sw.accessLevel,
            canDownload: sw.canDownload,
            addedBy: sw.addedby ? {
                id: sw.addedby._id,
                name: sw.addedby.name,
                email: sw.addedby.email
            } : null
        }));

        // --- Always include the owner ---
        const ownerData = {
            userId: document.owner._id,
            name: document.owner.name,
            email: document.owner.email,
            accessLevel: "owner",
            canDownload: true
        };

        const data = [ownerData, ...sharedUsers];

        return res.json({
            success: true,
            message: "Shared users fetched successfully",
            data
        });
    } catch (err) {
        console.error("Get shared users error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

// export const inviteUser = async (req, res) => {
//     try {
//         const { documentId } = req.params;
//         const { userEmail, accessLevel = "view", duration = "oneweek", customEnd } = req.body;
//         const inviterId = req.session.user?._id;

//         if (!inviterId) return res.status(401).json({ success: false, message: "Unauthorized" });
//         if (!userEmail) return res.status(400).json({ success: false, message: "User email is required" });
//         if (!mongoose.Types.ObjectId.isValid(documentId)) return res.status(400).json({ success: false, message: "Invalid document ID" });

//         const doc = await Document.findById(documentId);
//         if (!doc) return res.status(404).json({ success: false, message: "Document not found" });

//         // Only owner or editor can share
//         const isOwner = doc.owner.toString() === inviterId.toString();
//         const existingShare = await SharedWith.findOne({ document: documentId, user: inviterId, accessLevel: "edit" });
//         if (!isOwner && !existingShare) {
//             return res.status(403).json({ success: false, message: "No permission to share this document" });
//         }

//         // Find or create user
//         let user = await User.findOne({ email: userEmail.toLowerCase().trim() });
//         if (!user) {
//             user = new User({
//                 email: userEmail,
//                 name: userEmail.split("@")[0],
//                 password: Math.random().toString(36).slice(-8),
//                 isTemporary: true,

//             });
//             await user.save();
//         }

//         // Calculate expiry
//         const now = new Date();
//         let expiresAt = null;
//         switch (duration) {
//             case "oneday": expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); break;
//             case "oneweek": expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); break;
//             case "onemonth": expiresAt = new Date(now.setMonth(now.getMonth() + 1)); break;
//             case "lifetime": expiresAt = new Date(now); expiresAt.setFullYear(expiresAt.getFullYear() + 50); break;
//             case "custom": if (customEnd) expiresAt = new Date(customEnd); break;
//         }
//         // Create or update share entry
//         const share = await SharedWith.findOneAndUpdate(
//             { document: documentId, user: user._id },
//             { accessLevel, expiresAt, duration, inviteStatus: "pending", generalAccess: true, addedby: inviterId },
//             { new: true, upsert: true }
//         );

//         await Document.findByIdAndUpdate(documentId, { $addToSet: { sharedWithUsers: user._id } });
//         await activityLogger({
//             actorId: inviterId,
//             entityId: documentId,
//             entityType: "Document",
//             action: "INVITE_USER",
//             details: `Invited ${user.name} with ${accessLevel} access for document ${doc.metadata?.fileName}`,
//             meta: { duration, expiresAt }
//         });

//         const inviteLink = `${API_CONFIG.baseUrl}/api/documents/${documentId}/invite/${user._id}/auto-accept`;

//         const data = {
//             fileName: doc.metadata?.fileName,
//             name: user.name,
//             accessLevel,
//             expiresAt,
//             companyName: res.locals.companyName || "Our Company",
//             logoUrl: res.locals.logo || "",
//             bannerUrl: res.locals.mailImg || "",
//             inviteLink
//         }
//         // Generate HTML using your central email generator
//         const html = generateEmailTemplate('documentInvitation', data);
//         // Send the email
//         await sendEmail({
//             to: userEmail,
//             subject: "Document Access Invitation - E-Sangrah",
//             html,
//             fromName: "E-Sangrah Team",
//         });
//         res.json({ success: true, message: "Invite sent successfully" });

//     } catch (err) {
//         console.error("inviteUser error:", err);
//         res.status(500).json({ success: false, message: "Server error: " + err.message });
//     }
// };

export const inviteUser = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { userEmail, accessLevel = "view", duration = "oneweek", customStart,customEnd } = req.body;
        const inviterId = req.session.user?._id;

        if (!inviterId) return res.status(401).json({ success: false, message: "Unauthorized" });
        if (!userEmail || (Array.isArray(userEmail) && userEmail.length === 0)) {
            return res.status(400).json({ success: false, message: "User email is required" });
        }
        if (!mongoose.Types.ObjectId.isValid(documentId)) return res.status(400).json({ success: false, message: "Invalid document ID" });

        const emails = Array.isArray(userEmail) ? userEmail : [userEmail];

        const doc = await Document.findById(documentId);
        if (!doc) return res.status(404).json({ success: false, message: "Document not found" });

        // Only owner or editor can share
        const isOwner = doc.owner.toString() === inviterId.toString();
        const existingShare = await SharedWith.findOne({ document: documentId, user: inviterId, accessLevel: "edit" });
        if (!isOwner && !existingShare) {
            return res.status(403).json({ success: false, message: "No permission to share this document" });
        }

        for (const email of emails) {

            // Find or create user
            let user = await User.findOne({ email: email.toLowerCase().trim() });

            if (!user) {
                user = new User({
                    email: email,
                    name: email.split("@")[0],
                    password: Math.random().toString(36).slice(-8),
                    isTemporary: true,
                });
                await user.save();
            }

            // Calculate expiry
            const now = new Date();
            let expiresAt = null;
            let startAt = null;
            
            switch (duration) {
                case "oneday":
                    expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                    break;
            
                case "oneweek":
                    expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    break;
            
                case "onemonth":
                    expiresAt = new Date(now.setMonth(now.getMonth() + 1));
                    break;
            
                case "lifetime":
                    expiresAt = new Date(now);
                    expiresAt.setFullYear(expiresAt.getFullYear() + 50);
                    break;
            
                case "custom":
                    if (customStart) startAt = new Date(customStart);
                    if (customEnd) expiresAt = new Date(customEnd);
                    break;
            }
            
            // Create or update share entry
            const share = await SharedWith.findOneAndUpdate(
                { document: documentId, user: user._id },
                { accessLevel, expiresAt, customStart: startAt, duration, inviteStatus: "pending", generalAccess: true, addedby: inviterId },
                { new: true, upsert: true }
            );

            await Document.findByIdAndUpdate(documentId, { $addToSet: { sharedWithUsers: user._id } });

            await activityLogger({
                actorId: inviterId,
                entityId: documentId,
                entityType: "Document",
                action: "INVITE_USER",
                details: `Invited ${user.name} with ${accessLevel} access for document ${doc.metadata?.fileName}`,
                meta: { duration, expiresAt }
            });

            const inviteLink = `${API_CONFIG.baseUrl}/api/documents/${documentId}/invite/${user._id}/auto-accept`;

            const data = {
                fileName: doc.metadata?.fileName,
                name: user.name,
                accessLevel,
                expiresAt,
                companyName: res.locals.companyName || "Our Company",
                logoUrl: res.locals.logo || "",
                bannerUrl: res.locals.mailImg || "",
                inviteLink
            };

            // Generate HTML using your central email generator
            const html = generateEmailTemplate('documentInvitation', data);

            // Send the email
            await sendEmail({
                to: email,
                subject: "Document Access Invitation - E-Sangrah",
                html,
                fromName: "E-Sangrah Team",
            });
        }

        res.json({ success: true, message: "Invite sent successfully" });

    } catch (err) {
        console.error("inviteUser error:", err);
        res.status(500).json({ success: false, message: "Server error: " + err.message });
    }
};

export const autoAcceptInvite = async (req, res) => {
    try {
        const { documentId, userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(documentId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).send(alertRedirectTemplate('Invalid link.', '/documents/list'));
        }

        const share = await SharedWith.findOne({ document: documentId, user: userId }).populate("document");
        if (!share) return res.status(404).send(alertRedirectTemplate('You are removed from invitation list.', '/documents/list'));

        if (share.expiresAt && new Date() > share.expiresAt) {
            return res.send(accessExpiredTemplate(documentId));
        }

        if (share.inviteStatus === "rejected") {
            return res.status(403).send(alertRedirectTemplate('This invitation was rejected.', '/documents/list'));
        }

        if (share.inviteStatus !== "accepted") {
            share.inviteStatus = "accepted";
            share.acceptedAt = new Date();
            await share.save();
        }
        await activityLogger({
            actorId: userId,
            entityId: documentId,
            entityType: "Document",
            action: "INVITE_ACCEPTED",
            details: "User auto-accepted document invitation"
        });
        await Document.findByIdAndUpdate(documentId, { $addToSet: { sharedWithUsers: userId } });
        req.session.user = await User.findById(userId);

        const fileId = share.document?.files?.[0]?._id || "default";
        const payload = JSON.stringify({ id: documentId, fileId });
        const token = encrypt(payload);
        const viewDocLink = `${API_CONFIG.baseUrl}/documents/invited/${encodeURIComponent(token)}`;
        return res.redirect(viewDocLink);

    } catch (err) {
        console.error("autoAcceptInvite error:", err);
        return res.status(500).send(alertRedirectTemplate('Something went wrong.', '/documents/list'));
    }
};

export const requestAccessAgain = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { email } = req.body;
        const sessionUser = req.session.user;
        const userId = sessionUser?._id;

        /** -------- VALIDATION -------- */
        if (!userId && !email) {
            return res.status(401).json({
                success: false,
                message: "Not logged in or email not provided"
            });
        }

        /** -------- DOCUMENT CHECK -------- */
        const doc = await Document.findById(documentId)
            .populate("owner", "email name");

        if (!doc) {
            return res.status(404).json({ success: false, message: "Document not found" });
        }

        const owner = doc.owner;
        if (!owner?.email) {
            return res.status(400).json({ success: false, message: "Owner email not found" });
        }

        /** Prevent self-request */
        if (userId && owner._id.toString() === userId.toString()) {
            return res.status(400).json({
                success: false,
                message: "You already own this document"
            });
        }

        /** -------- USER HANDLING -------- */
        let user = null;
        let isExternal = false;
        let userName = "";
        let userEmail = email;

        if (userId) {
            user = await User.findById(userId);
            userName = user?.name || "";
            userEmail = user?.email;
        } else {
            user = await User.findOne({ email });
            if (user) {
                isExternal = false;
                userName = user.name;
                userEmail = user.email;
            } else {
                isExternal = true;
                userName = ""; // Unknown external user
                userEmail = email;
            }
        }

        /** -------- TOKEN FOR APPROVAL LINK -------- */
        const token = jwt.sign(
            {
                docId: documentId,
                userId: user?._id || null,
                userEmail,
                userName,
                isExternal,
                action: "approveAccess"
            },
            API_CONFIG.ACCESS_GRANT_SECRET || "supersecretkey",
            { expiresIn: "3d" }
        );

        /** -------- PERMISSION LOGS -------- */
        const log = await PermissionLogs.findOneAndUpdate(
            {
                document: documentId,
                "user.email": userEmail
            },
            {
                document: documentId,
                owner: owner._id,
                user: { username: userName, email: userEmail },
                access: "view",
                isExternal,
                requestStatus: "pending",
                token
            },
            { new: true, upsert: true }
        );

        const logId = log._id;

        const baseUrl = API_CONFIG.baseUrl || "http://localhost:5000";
        const approvalLink = `${baseUrl}/permissionslogs?id=${logId}`;

        /** -------- EMAIL PREPARATION -------- */
        const data = {
            userName,
            email: userEmail,
            user,
            doc,
            approvalLink,
            companyName: res.locals.companyName || "Our Company",
            logoUrl: res.locals.logo || "",
            bannerUrl: res.locals.mailImg || "",
        };

        const html = generateEmailTemplate("documentAccessRequest", data);

        /** -------- SEND EMAIL -------- */
        await sendEmail({
            to: owner.email,
            subject: `Access Request for Document: ${doc.metadata?.fileName || "Untitled"}`,
            html,
            fromName: "E-Sangrah Team"
        });

        /** -------- ACTIVITY LOG -------- */
        await activityLogger({
            actorId: userId || null,
            entityId: documentId,
            entityType: "Document",
            action: "REQUEST_ACCESS",
            details: `${userEmail} requested access to document ${doc.metadata?.fileName || "Untitled"}`
        });

        res.json({
            success: true,
            message: `Request sent to ${owner.name || owner.email}`
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "Server error: " + err.message
        });
    }
};

export const grantAccessViaToken = async (req, res) => {
    try {
        const { token } = req.params;
        const { duration } = req.body;

        const decoded = jwt.verify(token, API_CONFIG.ACCESS_GRANT_SECRET || "supersecretkey");
        const { docId, userId, userEmail, userName, action } = decoded;

        if (action !== "approveAccess") return res.status(403).send("Invalid action");

        const doc = await Document.findById(docId).populate("owner");
        if (!doc) return res.status(404).send("Document not found");

        // Calculate expiration
        const now = new Date();
        let expiresAt;
        switch (duration) {
            case "oneday": expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); break;
            case "oneweek": expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); break;
            case "onemonth": expiresAt = new Date(now); expiresAt.setMonth(expiresAt.getMonth() + 1); break;
            case "lifetime": expiresAt = new Date(now); expiresAt.setFullYear(expiresAt.getFullYear() + 50); break;
            default: expiresAt = null;
        }

        // Check if user exists (internal) or external
        let user = null;
        let isExternal = false;
        if (userId) {
            user = await User.findById(userId);
            isExternal = false;
        } else {
            user = await User.findOne({ email: userEmail });
            if (!user) isExternal = true;
        }

        if (!isExternal) {
            // Internal user → update or create SharedWith
            await SharedWith.findOneAndUpdate(
                { document: docId, user: user._id },
                { accessLevel: "view", duration, expiresAt, generalAccess: true },
                { new: true, upsert: true }
            );
        }

        // Update PermissionLogs as approved
        await PermissionLogs.findOneAndUpdate(
            { document: docId, "user.email": userEmail },
            {
                approved: true,
                approvedBy: doc.owner._id,
                isExternal
            },
            { new: true }
        );
        await activityLogger({
            actorId: doc.owner._id,
            entityId: docId,
            entityType: "Document",
            action: "ACCESS_GRANTED",
            details: `Access granted to ${userEmail}`,
            meta: { duration, isExternal }
        });

        // Send EJS-based email notification for internal users
        if (!isExternal && user) {
            const data = {
                name: user.name || userEmail,
                fileName: doc.metadata?.fileName,
                duration,
                companyName: res.locals.companyName || "Our Company",
                logoUrl: res.locals.logo || "",
                bannerUrl: res.locals.mailImg || "",
                ownerName: doc.owner?.name || "Document Owner"
            }
            // Generate HTML using your central email generator
            const html = generateEmailTemplate('fileaccessGranted', data);
            await sendEmail({
                to: user.email,
                subject: "Access Granted",
                html,
                fromName: "E- sangrah"
            });
        }

        res.send(`
            <h2>Access granted to ${userName || userEmail}</h2>
            <p>${isExternal
                ? "External user logged in PermissionLogs only."
                : "Email notification sent using EJS template."}</p>
        `);
    } catch (err) {
        res.send(`<h2>Error</h2><p>${err.message}</p>`);
    }
};

export const generateShareableLink = async (req, res) => {
    const { documentId, fileId } = req.params;

    try {

        const document = await Document.findById(documentId).select("currentVersionLabel ispublic");

        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }


        const versionLabel = document.currentVersionLabel;
const isPublic = document.ispublic;
        const link = await generateShareLink(documentId, fileId, versionLabel);

        res.json({ success: true, link, isPublic });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "Failed to generate share link"
        });
    }
};

/**
 * Search documents
 */
export const searchDocuments = async (req, res) => {
    try {
        const { q, fields = "title description tags" } = req.query;

        if (!q) {
            return failResponse(res, "Search query is required", 400);
        }

        const searchFields = fields.split(",").map(field => field.trim());
        const searchConditions = searchFields.map(field => ({
            [field]: { $regex: q, $options: "i" }
        }));

        const documents = await Document.find({
            $or: searchConditions
        })
            .populate("department", "name")
            .populate("owner", "firstName lastName email")
            .limit(50);

        return successResponse(res, { documents }, "Search results retrieved successfully");
    } catch (error) {
        return errorResponse(res, error, "Failed to search documents");
    }
};

// Upload new version
export const uploadDocumentVersion = async (req, res) => {
    try {
        const { id } = req.params;
        const document = await Document.findById(id);
        if (!document) return failResponse(res, "Document not found", 404);

        const fileData = {
            file: req.body.fileUrl,
            s3Url: req.body.s3Url,
            originalName: req.body.originalName,
            hash: req.body.hash
        };

        await document.addNewVersion(fileData, req.user._id);
        return successResponse(res, { document }, "New version uploaded successfully");
    } catch (err) {
        return errorResponse(res, err, "Failed to upload new version");
    }
};


/**
 * Get document versions
 */
export const getDocumentVersions = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return failResponse(res, "Invalid document ID", 400);
        }

        const document = await Document.findById(id)
            .populate("files.uploadedBy", "firstName lastName email")
            .select("files currentVersion");

        if (!document) {
            return failResponse(res, "Document not found", 404);
        }

        // Group files by version and include status
        const versions = document.files.map(file => ({
            version: file.version,
            file: file.file,
            originalName: file.originalName,
            uploadedBy: file.uploadedBy,
            uploadedAt: file.uploadedAt,
            isPrimary: file.isPrimary,
            status: file.status,
            hash: file.hash
        })).sort((a, b) => b.version - a.version);

        return successResponse(res, {
            versions,
            currentVersion: document.currentVersion
        }, "Document versions retrieved successfully");

    } catch (error) {
        logger.error("Error fetching document versions:", error);
        return errorResponse(res, error, "Failed to retrieve document versions");
    }
};

export const getDocumentApprovalsPage = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        // Get document with populated data
        const document = await Document.findById(id)
            .populate('owner', 'name email designation')
            .populate('project', 'name')
            .populate('department', 'name')
            .populate('projectManager', 'name designation')
            .populate('documentDonor', 'name designation')
            .populate('documentVendor', 'name designation')
            .populate({
                path: 'files',
                select: 'fileName originalName size url mimetype'
            });

        if (!document) {
            return res.status(404).render('error', {
                message: 'Document not found'
            });
        }

        const approvals = await Approval.find({ document: id })
            .populate('approver', 'name designation email')
            .sort({ level: 1 });
        if (approvals.length === 0) {
            const defaultApprovers = await createDefaultApprovalWorkflow(id, document);
            approvals.push(...defaultApprovers);
        }

        // Calculate approval progress
        const totalApprovals = approvals.length;
        const completedApprovals = approvals.filter(a =>
            a.status === 'Approved' || a.status === 'Rejected'
        ).length;
        const progressPercentage = totalApprovals > 0 ?
            (completedApprovals / totalApprovals) * 100 : 0;

        // Format dates for display
        const formatDate = (date) => {
            if (!date) return null;
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };

        // Get file size for display
        const getFileSize = () => {
            if (document.files && document.files.length > 0) {
                const sizeInBytes = document.files[0].size;
                const sizeInKB = Math.round(sizeInBytes / 1024);
                return `${sizeInKB}KB`;
            }
            return 'N/A';
        };

        res.render('pages/employee/trackStatus', {
            document: {
                ...document.toObject(),
                formattedDate: formatDate(document.documentDate || document.createdAt),
                fileSize: getFileSize()
            },
            approvals: approvals.map(approval => ({
                ...approval.toObject(),
                formattedApprovedOn: formatDate(approval.approvedOn),
                isCurrentUser: user && approval.approver._id.toString() === user.id
            })),
            progress: {
                percentage: Math.round(progressPercentage),
                completed: completedApprovals,
                total: totalApprovals
            },
            user: user,
            currentUser: user
        });

    } catch (error) {
        console.error('Error loading document approvals:', error);
        res.status(500).render('error', {
            message: 'Error loading document approvals'
        });
    }
};


export const createOrUpdateApprovalRequest = async (req, res) => {
    try {
        const documentId = req.params.documentId?.trim();
        const {
            approverId: rawApproverId,
            priority,
            remark,
            isMailSent,
            designation: rawDesignation
        } = req.body;

        const approverId = rawApproverId?.trim();
        const designation = rawDesignation?.trim();

        // --- Validate required fields ---
        if (!documentId || !approverId || priority == null) {
            return res.status(400).json({
                error: "Missing required fields: documentId, approverId, or priority"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(documentId)) {
            return res.status(400).json({ error: "Invalid documentId" });
        }
        if (!mongoose.Types.ObjectId.isValid(approverId)) {
            return res.status(400).json({ error: "Invalid approverId" });
        }

        // --- Verify document existence ---
        const document = await Document.findById(documentId);
        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }

        // --- Check if an approval already exists for this document and approver ---
        let approval = await Approval.findOne({ document: documentId, approver: approverId });

        if (approval) {
            // === UPDATE EXISTING APPROVAL ===
            approval.priority = priority;
            if (designation) approval.designation = designation;
            if (remark?.trim()) approval.remark = remark.trim();
            if (typeof isMailSent === "boolean") approval.isMailSent = isMailSent;
            approval.addDate = new Date();

            await approval.save();

            // Optionally update document status if still in draft
            if (document.status === "Draft") {
                document.status = "Pending";
                await document.save();
            }
            await activityLogger({
                actorId: req.user?._id,
                entityId: documentId,
                entityType: "Document",
                action: "UPDATE_APPROVAL_REQUEST",
                details: `Updated approval request for approver ${approverId}`,
                meta: { priority, remark }
            });

            return res.status(200).json({
                success: true,
                message: "Approval successfully",
                approval
            });
        }

        // === CREATE NEW APPROVAL ===
        approval = await Approval.create({
            document: documentId,
            approver: approverId,
            priority,
            designation: designation || null,
            status: "Pending",
            remark: remark?.trim() || "",
            isMailSent: typeof isMailSent === "boolean" ? isMailSent : false,
            addDate: new Date()
        });

        // === Add approval to document ===
        if (!document.approvalHistory.includes(approval._id)) {
            document.approvalHistory.push(approval._id);
        }

        // Optionally set document status to “Pending” when an approval request is made
        if (document.status === "Draft") {
            document.status = "Pending";
        }

        await document.save();
        await activityLogger({
            actorId: req.user?._id,
            entityId: documentId,
            entityType: "Document",
            action: "CREATE_APPROVAL_REQUEST",
            details: `created approval request for approver ${approverId}`,
            meta: { priority, remark }
        });

        res.status(201).json({
            success: true,
            message: "Approval request created successfully",
            approval
        });

    } catch (error) {
        console.error("Error creating/updating approval request:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateApprovalStatus = async (req, res) => {
    try {
        const userId = req.user._id;
        const { documentId } = req.params;
        const { action, comment } = req.body;
        const approved = action === 'approve';
        // Fetch document
        const document = await Document.findById(documentId)
            .populate('documentApprovalAuthority.userId', 'name email')
            .populate('department', 'name')
            .populate('owner', 'name email');

        if (!document) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

        // Find approver record
        let approverRecord = document.documentApprovalAuthority.find(
            a => String(a.userId?._id) === String(userId)
        );
        
        if (!approverRecord) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to approve this document'
            });
        }
        
        /** ---------------- Update Approver Record ---------------- **/
        if (action === 'need_discussion') {
            // Only update approver’s record, not document status
            approverRecord.status = 'Pending';
            approverRecord.isApproved = false;
            approverRecord.remark = comment;
            approverRecord.approvedOn = null; // no timestamp since not a final decision
        } else if (action === 'approve') {
            approverRecord.status = 'Approved';
            approverRecord.isApproved = true;
            approverRecord.remark = comment || '';
            approverRecord.approvedOn = new Date();
        } else if (action === 'reject') {
            approverRecord.status = 'Rejected';
            approverRecord.isApproved = false;
            approverRecord.remark = comment || '';
            approverRecord.approvedOn = new Date();
        } else {
            return res.status(400).json({success: false, message: 'Invalid action' });
        }

        /** ---------------- Document Status Recalculation ---------------- **/
        // DO NOT include “Need Discussion” in document status update
        if (action !== 'need_discussion') {
            const anyRejected = document.documentApprovalAuthority.some(a => a.status === 'Rejected');
            const allApproved = document.documentApprovalAuthority.every(a => a.status === 'Approved');

            if (anyRejected) document.status = 'Rejected';
            else if (allApproved) document.status = 'Approved';
            else document.status = 'Pending';
        }

        await document.save();
        await activityLogger({
            actorId: userId,
            entityId: documentId,
            entityType: "Document",
            action: 'UPDATE APPROVAL STATUS',
            details: `Approver performed ${action} action on document`,
            meta: { comment }
        });

        /** ---------------- Notifications ---------------- **/
        const otherApprovers = document.documentApprovalAuthority
            .filter(a => String(a.userId?._id) !== String(userId))
            .map(a => a.userId)
            .filter(Boolean);

        // Handle notifications separately for “need discussion”
        if (action === 'need_discussion') {
            await addNotification({
                recipient: document.owner._id,
                sender: userId,
                type: 'document_discussion',
                title: 'Discussion Requested',
                message: `${req.user.name} requested a discussion on document "${document.metadata?.fileName || document._id}". Remark: ${comment}`,
                relatedDocument: documentId,
                priority: 'medium'
            });
            const data = {
                ownerName: document.owner.name,
                requesterName: req.user.name,
                fileName: document.metadata?.fileName || "Untitled Document",
                companyName: res.locals.companyName || "Our Company",
                logoUrl: res.locals.logo || "",
                bannerUrl: res.locals.mailImg || "",
                documentLink: `${API_CONFIG.baseUrl}/employee/approval?id=${document._id}`,
                comment,
            }
            // Generate HTML using your central email generator
            const html = generateEmailTemplate('discussionRequested', data);

            await sendEmail({
                to: document.owner.email,
                subject: `Discussion Requested - ${document.metadata?.fileName || "Document"}`,
                html,
                fromName: "E-sangrah",
            });
        } else {
            // Notify other approvers + owner for approve/reject
            for (const approver of otherApprovers) {
                await addNotification({
                    recipient: approver._id,
                    sender: userId,
                    type: 'approval_update',
                    title: `Document ${approved ? 'Approved' : 'Rejected'}`,
                    message: `${req.user.name} has ${approved ? 'approved' : 'rejected'} the document "${document.metadata?.fileName || document._id}".`,
                    relatedDocument: documentId,
                    priority: approved ? 'low' : 'high'
                });
            }

            if (String(document.owner._id) !== String(userId)) {
                await addNotification({
                    recipient: document.owner._id,
                    sender: userId,
                    type: 'approval_update',
                    title: `Document ${approved ? 'Approved' : 'Rejected'}`,
                    message: `${req.user.name} has ${approved ? 'approved' : 'rejected'} your document "${document.metadata?.fileName || document._id}".`,
                    relatedDocument: documentId,
                    priority: approved ? 'low' : 'high'
                });
            }
        }

        /** ---------------- Next Approver Email ---------------- **/
        if (approved && document.status === 'Pending') {
            const currentPriority = approverRecord.priority;
            const nextApprover = document.documentApprovalAuthority.find(
                a => a.priority === currentPriority + 1 && a.status === 'Pending'
            );

            if (nextApprover && nextApprover.userId) {
                nextApprover.isMailSent = true;
                await document.save();

                await addNotification({
                    recipient: nextApprover.userId._id,
                    sender: userId,
                    type: 'approval_request',
                    title: 'Document Pending Approval',
                    message: `${req.user.name} has approved "${document.metadata?.fileName || document._id}". It's now your turn to review.`,
                    relatedDocument: documentId,
                    priority: 'medium'
                });

                const approvalLink = `${API_CONFIG.baseUrl}/approval-requests`;
                // Render EJS email template
                const data = {
                    approverName: nextApprover.userId.name,
                    documentName: document.metadata?.fileName || "Untitled Document",
                    description: document.description || "No description provided",
                    departmentName: document.department?.name || "General",
                    requesterName: req.user.name,
                    approvalLink,
                    companyName: res.locals.companyName || "Our Company",
                    logoUrl: res.locals.logo || "",
                    bannerUrl: res.locals.mailImg || "",
                    BASE_URL: API_CONFIG.baseUrl,
                }
                // Generate HTML using your central email generator
                const html = generateEmailTemplate('documentAccessRequest', data);

                // Send email
                await sendEmail({
                    to: nextApprover.userId.email,
                    subject: `Document Approval Request - ${document.metadata?.fileName || "Document"}`,
                    html,
                    from: "E-Sangrah Team",
                });
            }
        }

        res.json({
            success: true,
            message: 'Approval submitted successfully',
            data: {
                approval: approverRecord,
                approvals: document.documentApprovalAuthority,
                status: document.status
            }
        });

    } catch (error) {
        console.error('Error updating approval:', error);
        res.status(500).json({   success: false,message: error.message || 'Internal server error' });
    }
};

export const submitApprovalByToken = async (req, res) => {
    try {
        const { token, documentId, action, comment } = req.body;

        if (!token || !documentId || !action) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // Verify JWT token
        let payload;
        try {
            payload = jwt.verify(token, API_CONFIG.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ success: false, message: "Invalid or expired link" });
        }

        if (payload.documentId !== documentId || !payload.approverId) {
            return res.status(403).json({ success: false, message: "Invalid token" });
        }

        const document = await Document.findById(documentId)
            .populate('documentApprovalAuthority.userId', 'name email')
            .populate('owner', 'name email');

        if (!document) {
            return res.status(404).json({ success: false, message: "Document not found" });
        }

        const approverRecord = document.documentApprovalAuthority.find(
            a => a.userId && a.userId._id.toString() === payload.approverId
        );

        if (!approverRecord) {
            return res.status(403).json({ success: false, message: "You are not authorized" });
        }

        // Already acted?
        if (approverRecord.isApproved || approverRecord.status === "Rejected") {
            return res.json({
                success: true,
                alreadyActed: true,
                message: "Already acted",
                status: approverRecord.status
            });
        }

        // Apply action
        if (action === 'approve') {
            approverRecord.status = 'Approved';
            approverRecord.isApproved = true;
            approverRecord.remark = comment || '';
            approverRecord.approvedOn = new Date();
        } else if (action === 'reject') {
            approverRecord.status = 'Rejected';
            approverRecord.isApproved = false;
            approverRecord.remark = comment || '';
            approverRecord.approvedOn = new Date();
        } else if (action === 'need_discussion') {
            approverRecord.status = 'Pending';
            approverRecord.remark = comment || 'Discussion needed';
        } else {
            return res.status(400).json({ success: false, message: "Invalid action" });
        }

        // Update overall document status (only for approve/reject)
        if (action !== 'need_discussion') {
            const anyRejected = document.documentApprovalAuthority.some(a => a.status === 'Rejected');
            const allApproved = document.documentApprovalAuthority.every(a => a.isApproved || a.status !== 'Pending');
            document.status = anyRejected ? 'Rejected' : allApproved ? 'Approved' : 'Pending';
        }

        await document.save();

        // Log activity
        await activityLogger({
            actorId: payload.approverId,
            entityId: documentId,
            entityType: "Document",
            action: "ACCESS_APPROVED",
            details: `${action} via email link`,
            meta: { comment }
        });

        // Get approver name
        const approverUser = await User.findById(payload.approverId).select('name email');
        const approverName = approverUser?.name || 'Approver';

        const fileName = document.metadata?.fileName || 'Document';

        // Helper: Notify user
        const notifyUser = async (userId, type, title, message, priority = 'medium') => {
            if (!userId) return;
            await addNotification({
                recipient: userId,
                sender: payload.approverId,
                type,
                title,
                message,
                relatedDocument: documentId,
                priority
            });
        };

        // CASE: Need Discussion
        if (action === 'need_discussion') {
            const ownerId = document.owner?._id || document.owner;
            await notifyUser(ownerId, 'document_discussion', 'Discussion Requested',
                `${approverName} requested discussion on "${fileName}"`, 'high');

            const html = generateEmailTemplate('discussionRequested', {
                ownerName: document.owner?.name || 'User',
                requesterName: approverName,
                fileName,
                comment: comment || 'No comment',
                documentLink: `${API_CONFIG.baseUrl}/employee/approval?id=${documentId}`,
                companyName: res.locals.companyName || "Company",
                logoUrl: res.locals.logo || "",
                bannerUrl: res.locals.mailImg || "",
            });

            await sendEmail({
                to: document.owner?.email,
                subject: `Discussion Requested - ${fileName}`,
                html,
                fromName: "Document System"
            });

            return res.json({ success: true, message: "Discussion request sent", status: 'Pending' });
        }

        const isApproved = action === 'approve';

        // Notify other approvers
        for (const auth of document.documentApprovalAuthority) {
            if (!auth.userId || auth.userId._id.toString() === payload.approverId) continue;
            await notifyUser(auth.userId._id, 'approval_update',
                `Document ${isApproved ? 'Approved' : 'Rejected'}`,
                `${approverName} has ${isApproved ? 'approved' : 'rejected'} "${fileName}"`,
                isApproved ? 'low' : 'high'
            );
        }

        // Notify owner
        if (document.owner && document.owner._id.toString() !== payload.approverId) {
            await notifyUser(document.owner._id, 'approval_update',
                `Document ${isApproved ? 'Approved' : 'Rejected'}`,
                `${approverName} has ${isApproved ? 'approved' : 'rejected'} your document "${fileName}"`,
                isApproved ? 'low' : 'high'
            );

            const templateKey = isApproved ? 'documentApproved' : 'documentRejected';
            const html = generateEmailTemplate(templateKey, {
                ownerName: document.owner.name,
                approverName,
                fileName,
                action: isApproved ? 'approved' : 'rejected',
                documentLink: `${API_CONFIG.baseUrl}/employee/documents/${documentId}`,
                companyName: res.locals.companyName || "Company",
                logoUrl: res.locals.logo || "",
                bannerUrl: res.locals.mailImg || "",
            });

            await sendEmail({
                to: document.owner.email,
                subject: `Document ${isApproved ? 'Approved' : 'Rejected'} - ${fileName}`,
                html,
                fromName: "Document System"
            });
        }

        // Sequential approval: send to next approver
        if (isApproved && document.status === 'Pending') {
            const currentPriority = approverRecord.priority;
            const nextApprover = document.documentApprovalAuthority.find(
                a => a.priority === currentPriority + 1 && !a.isApproved && a.status !== 'Rejected'
            );

            if (nextApprover?.userId) {
                const nextToken = jwt.sign(
                    { documentId: document._id, approverId: nextApprover.userId._id },
                    API_CONFIG.JWT_SECRET,
                    { expiresIn: '7d' }
                );

                nextApprover.isMailSent = true;
                await document.save();

                const nextLink = `${API_CONFIG.baseUrl}/approve/document?token=${nextToken}`;

                await notifyUser(nextApprover.userId._id, 'approval_request',
                    'Your Approval Required',
                    `${approverName} approved "${fileName}". Your review is now needed.`,
                    'high'
                );

                const nextHtml = generateEmailTemplate('documentApprovalRequest', {
                    approverName: nextApprover.userId.name,
                    documentName: fileName,
                    description: document.description || "No description",
                    requesterName: approverName,
                    approvalLink: nextLink,
                    companyName: res.locals.companyName || "Company",
                    logoUrl: res.locals.logo || "",
                    bannerUrl: res.locals.mailImg || "",
                });

                await sendEmail({
                    to: nextApprover.userId.email,
                    subject: `Approval Required: ${fileName}`,
                    html: nextHtml,
                    fromName: "Document System"
                });
            }
        }

        res.json({
            success: true,
            message: "Action recorded successfully",
            status: document.status
        });

    } catch (error) {
        console.error("submitApprovalByToken error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
/**
 * Send approval mail for a given document approver.
 */

export const sendApprovalMail = async (req, res) => {
    try {
        const { documentId, approverId } = req.params;

        const document = await Document.findById(documentId)
            .populate("owner", "name email")
            .populate("department", "name")
            .populate("documentApprovalAuthority.userId", "name email");

        if (!document) return res.status(404).json({ success: false, message: "Document not found" });

        const approverEntry = document.documentApprovalAuthority.find(
            a => a.userId && a.userId._id.toString() === approverId
        );

        if (!approverEntry || !approverEntry.userId?.email) {
            return res.status(400).json({ success: false, message: "Invalid approver" });
        }

        // Generate secure token
        const token = jwt.sign(
            { documentId: document._id, approverId: approverId },
            API_CONFIG.JWT_SECRET,
            { expiresIn: '15d' }
        );

        const approvalLink = `${API_CONFIG.baseUrl}/approve/document?token=${token}`;

        const data = {
            approverName: approverEntry.userId.name,
            documentName: document.metadata?.fileName || "Untitled Document",
            description: document.description || "No description provided",
            departmentName: document.department?.name || "N/A",
            requesterName: document.owner?.name || "Unknown",
            companyName: res.locals.companyName || "Our Company",
            logoUrl: res.locals.logo || "",
            bannerUrl: res.locals.mailImg || "",
            approvalLink,  // Direct link to approval page
            reviewUrl: approvalLink,
            verifyUrl: approvalLink,
            BASE_URL: API_CONFIG.baseUrl
        };

        const html = generateEmailTemplate('documentApprovalRequest', data);

        await sendEmail({
            to: approverEntry.userId.email,
            subject: `Approval Required: ${document.metadata?.fileName}`,
            html,
            fromName: "Document Management System"
        });

        approverEntry.isMailSent = true;
        await document.save();

        return res.json({ success: true, message: "Approval email sent" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to send email" });
    }
};
/**
 * Verify approval mail link and approve the document for current approver.
 */
export const verifyApprovalMail = async (req, res) => {
    try {
        const { token } = req.params;
        const decoded = jwt.verify(token, API_CONFIG.JWT_SECRET);
        const { documentId, approverId } = decoded;

        // Immediately redirect user to /admin/approval (non-blocking background task)
        res.redirect(`${API_CONFIG.baseUrl}/admin/approval`);

        // Perform all background operations asynchronously
        (async () => {
            const document = await Document.findById(documentId)
                .populate("project", "projectName")
                .populate("owner", "name email");

            if (!document) return console.warn("Document not found:", documentId);

            const currentApprover = document.documentApprovalAuthority.find(
                (a) => a.approver._id.toString() === approverId
            );

            if (!currentApprover) return console.warn("Approver not found:", approverId);

            // Mark current approver as approved
            currentApprover.status = "Approved";
            currentApprover.isApproved = true;
            currentApprover.approvedOn = new Date();

            // Find next pending approver
            const remainingApprovers = document.documentApprovalAuthority
                .filter((a) => !a.isApproved)
                .sort((a, b) => a.priority - b.priority);

            if (remainingApprovers.length > 0) {
                const nextApprover = remainingApprovers[0];
                const nextUser = nextApprover.approver;

                if (nextUser?.email) {
                    const nextToken = jwt.sign(
                        { documentId: document._id, approverId: nextUser._id },
                        API_CONFIG.JWT_SECRET,
                        { expiresIn: "7d" }
                    );

                    const verifyUrl = `${API_CONFIG.baseUrl}/api/verify-approval/${nextToken}`;
                    const reviewUrl = `${API_CONFIG.baseUrl}/documents/${document._id}/versions/view?version=${currentVersion}`;
                    const data = {
                        approverName: nextUser.name,
                        documentName: document.description.replace(/<[^>]+>/g, "") || "Untitled Document",
                        description: document.comment || "No description provided",
                        departmentName: nextUser.userDetails?.department?.name || "N/A",
                        requesterName: document.owner?.name || "System",
                        verifyUrl,
                        companyName: res.locals.companyName || "Our Company",
                        logoUrl: res.locals.logo || "",
                        bannerUrl: res.locals.mailImg || "",
                        reviewUrl
                    }
                    // Generate HTML using your central email generator
                    const html = generateEmailTemplate('documentApprovalRequest', data);
                    // Send the email
                    await sendEmail({
                        to: nextUser.email,
                        subject: `Document Approval Request`,
                        html,
                        fromName: "E-sangrah",
                    });
                    nextApprover.isMailSent = true;
                }
            }
            await activityLogger({
                actorId: approverId,
                entityId: documentId,
                entityType: "Document",
                action: "APPROVAL_MAIL_VERIFIED",
                details: "Approver verified via email link"
            });

            await document.save();
        })();

    } catch (error) {
        console.error("Error verifying approval:", error);
        return res.redirect(`${API_CONFIG.baseUrl}/admin/approval?error=invalid`);
    }
};


export const getApprovals = async (req, res) => {
    try {
        const { documentId } = req.params;

        const document = await Document.findById(documentId)
            .select('owner files description createdAt updatedAt documentApprovalAuthority currentVersionLabel slug isDeleted status isArchived compliance files comment versioning project')
            .populate("owner files")
            .populate({
                path: "documentApprovalAuthority.userId",
                model: "User",
                select: "name email phone_number profile_type userDetails",
                populate: [
                    { path: "userDetails.designation", model: "Designation", select: "name" },
                    { path: "userDetails.department", model: "Department", select: "name" },
                ]
            })
            .populate({ path: "documentApprovalAuthority.designation", model: "Designation", select: "name" })
            .lean();

        if (!document) {
            return failResponse(res, "Document not found", 404);
        }

        const approvals = document.documentApprovalAuthority || [];

        if (!approvals.length) {
            return failResponse(res, "No approval authorities found for this document", 404);
        }

        approvals.sort((a, b) => (a.priority || 0) - (b.priority || 0));

        const filesArray = document.files || [];
        const totalBytes = filesArray.reduce((sum, file) => sum + (Number(file.fileSize) || 0), 0);
        const formatted = formatTotalFileSize(totalBytes);
        const firstFile = filesArray[0] || {};
        const firstFileOriginalName = firstFile.originalName || null;
        const firstFileId = firstFile._id || null;

        document.files = {
            _id: firstFileId,
            originalName: firstFileOriginalName,
            version: document.currentVersionLabel || null,
            fileSize: formatted
        };

        return successResponse(res, { document, approvals }, "Approvals fetched successfully from document");
    } catch (error) {
        console.error("Error fetching approvals from document:", error);
        return failResponse(res, "Server Error", 500);
    }
};

export const createApprovalRequest = async (req, res) => {
    try {
        // Trim and validate IDs
        const documentId = req.params.documentId?.trim();
        const { approverId: rawApproverId, level, dueDate, remark, designation: rawDesignation } = req.body;

        const approverId = rawApproverId?.trim();
        const designation = rawDesignation?.trim();

        // Validate required fields
        if (!documentId || !approverId || level == null) {
            return res.status(400).json({
                error: "Missing required fields: documentId, approverId, or level"
            });
        }

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(documentId)) {
            return res.status(400).json({ error: "Invalid documentId" });
        }
        if (!mongoose.Types.ObjectId.isValid(approverId)) {
            return res.status(400).json({ error: "Invalid approverId" });
        }
        if (designation && !mongoose.Types.ObjectId.isValid(designation)) {
            return res.status(400).json({ error: "Invalid designation" });
        }

        // Check if document exists
        const document = await Document.findById(documentId);
        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }

        // Check if approval already exists for same level and approver
        const existingApproval = await Approval.findOne({ document: documentId, approver: approverId, level });
        if (existingApproval) {
            return res.status(400).json({ error: "Approval request already exists for this approver and level" });
        }

        // Create approval request
        const approval = await Approval.create({
            document: documentId,
            approver: approverId,
            level,
            designation: designation || null,
            status: "Pending",
            remark: remark?.trim() || "",
            dueDate: dueDate ? new Date(dueDate) : null
        });

        // Add approval to document's approval history
        document.approvalHistory = document.approvalHistory || [];
        document.approvalHistory.push(approval._id);
        await document.save();
        await activityLogger({
            actorId: req.user?._id,
            entityId: documentId,
            entityType: "Document",
            action: "CREATE_APPROVAL_REQUEST",
            details: `Approval created for approver ${approverId}`,
            meta: { level, dueDate }
        });

        // Respond success
        res.status(201).json({
            success: true,
            message: "Approval request created successfully",
            approval: {
                id: approval._id,
                document: approval.document,
                approver: approval.approver,
                level: approval.level,
                status: approval.status,
                remark: approval.remark,
                dueDate: approval.dueDate
            }
        });

    } catch (error) {
        console.error("Error creating approval request:", error);
        res.status(500).json({ error: "Internal server error creating approval request" });
    }
};