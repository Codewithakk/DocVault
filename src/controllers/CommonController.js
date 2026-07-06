import File from "../models/File.js";
import Folder from "../models/Folder.js";
import jwt from "jsonwebtoken";
import { s3Client } from "../config/S3Client.js";
import { ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import archiver from "archiver";
import Document from '../models/Document.js';
import ExcelJS from 'exceljs';
import XLSX from "xlsx";
import PDFDocument from 'pdfkit';
import { Parser } from 'json2csv';
import { API_CONFIG } from "../config/ApiEndpoints.js";
import mongoose from "mongoose";
import { activityLogger } from "../helper/activityLogger.js";
import { toProperCase } from "../helper/CommonHelper.js";
import User from "../models/User.js";
import WebSetting from "../models/WebSetting.js";
import PQueue from 'p-queue';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import Project from "../models/Project.js";
import DocumentVersion from "../models/DocumentVersion.js";

function formatHeader(text) {
    if (!text) return "";
    return text
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, str => str.toUpperCase());
}

//Pages
export const showCheckMailPage = (req, res) => {
    try {
        res.render("pages/checkMail", {
            pageTitle: "Mail Verification",
            pageDescription: "Get help, explore FAQs, and contact support for issues related to your e-Sangrah workspace.",
            metaKeywords: "support, help center, esangrah support, customer support, faq",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user
        });
    } catch (err) {
        logger.error("support page render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "There was an issue loading the Mail page.",
            user: req.user,
            message: "Unable to load mail page"
        });
    }
};
export const showSupportPage = (req, res) => {
    try {
        res.render("pages/support", {
            pageTitle: "Support",
            pageDescription: "Get help, explore FAQs, and contact support for issues related to your e-Sangrah workspace.",
            metaKeywords: "support, help center, esangrah support, customer support, faq",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user
        });
    } catch (err) {
        logger.error("support page render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "There was an issue loading the support page.",
            user: req.user,
            message: "Unable to load support"
        });
    }
};

export const showSettingPage = async (req, res) => {
    try {
        const settings = await WebSetting.findOne();

        res.render("pages/setting", {
            pageTitle: "Settings",
            pageDescription: "Manage your account, preferences, and workspace settings in e-Sangrah.",
            metaKeywords: "settings, account settings, user preferences, esangrah settings",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            settings
        });
    } catch (err) {
        logger.error("Web settings page render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "There was an issue loading the settings page.",
            user: req.user,
            message: "Unable to load settings"
        });
    }
};

export const showApproverPage = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).send("Missing approval token.");
        }

        // 1. Verify JWT token (this is what you actually use)
        let payload;
        try {
            payload = jwt.verify(token, API_CONFIG.JWT_SECRET);
        } catch (err) {
            return res.status(400).send("Invalid or expired approval link.");
        }

        const { documentId, approverId } = payload;

        // 2. Fetch document
        const document = await Document.findById(documentId)
            .populate("owner", "name email")
            .lean();

        if (!document) {
            return res.status(404).send("Document not found.");
        }

        // 3. Optional: Check if this approver is still valid
        const approverEntry = document.documentApprovalAuthority?.find(
            a => a.userId && a.userId.toString() === approverId
        );

        if (!approverEntry) {
            return res.status(403).send("You are not authorized to approve this document.");
        }

        if (approverEntry.status !== "Pending") {
            return res.render("pages/document/alreadyActed", {
                message: `You have already ${approverEntry.status.toLowerCase()} this document.`,
                status: approverEntry.status
            });
        }
        // 4. Get current version files
        const versionLabel = document.currentVersionLabel || "1.0";

        const versionData = await DocumentVersion.findOne({
            documentId,
            versionLabel
        })
            .populate("files")
            .lean();

        if (versionData?.files) {
            for (const file of versionData.files) {
                file.fileUrl = file.s3Url || (file.file ? await getObjectUrl(file.file, 3600) : null);
            }
        }

        // 5. Render the beautiful approval page
        res.render("pages/document/approveDocument", {
            pageTitle: document.metadata?.fileName || "Approve Document",
            documentTitle: document.metadata?.fileName || "Document",
            document,
            versionData: versionData || { files: [] },
            version: versionLabel,
            token,
            approverId,
            currentUserName: approverEntry.userId?.name || "Approver"
        });

    } catch (error) {
        console.error("approveDocument error:", error);
        res.status(500).send("Server error.");
    }
};

// Check duplicate fields
export const checkDuplicate = async (req, res) => {
    try {
        const { email, phone_number, employee_id, gst_number, id_proof } = req.query;

        let query = {};

        if (email) query.email = email.toLowerCase();
        if (phone_number) query.phone_number = phone_number;
        if (employee_id) query["userDetails.employee_id"] = employee_id;
        if (gst_number) query["vendorDetails.gst_number"] = gst_number.toUpperCase();
        if (id_proof) query["donorDetails.id_proof"] = id_proof;

        const user = await User.findOne(query);

        if (user) {
            let field = 'unknown';
            if (email && user.email === email.toLowerCase()) field = 'email';
            else if (phone_number && user.phone_number === phone_number) field = 'phone_number';
            else if (employee_id && user.userDetails?.employee_id === employee_id) field = 'employee_id';
            else if (gst_number && user.vendorDetails?.gst_number === gst_number.toUpperCase()) field = 'gst_number';
            else if (id_proof && user.donorDetails?.id_proof === id_proof) field = 'id_proof';

            return res.json({ exists: true, field });
        }

        return res.json({ exists: false });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Save selected project & year to session
export const saveSessionProject = async (req, res) => {
    const { projectId, selectedYear } = req.body;
    try {
        // Handle projectId
        if (projectId) {
            const project = await Project.findById(projectId).select("projectName");

            if (!project) {
                return res.status(404).json({ error: "Project not found" });
            }

            req.session.selectedProject = projectId;
            req.session.selectedProjectName = project.projectName;
        } else {
            // Clear session if projectId is null or not provided
            req.session.selectedProject = null;
            req.session.selectedProjectName = null;
        }

        // Handle selectedYear
        if (selectedYear) {
            req.session.selectedYear = selectedYear;
        } else {
            // Clear session if selectedYear is null or not provided
            req.session.selectedYear = null;
        }

        req.session.save((err) => {
            if (err) return res.status(500).json({ error: "Failed to save session" });

            res.json({
                success: true,
                selectedProject: req.session.selectedProject,
                selectedProjectName: req.session.selectedProjectName,
                selectedYear: req.session.selectedYear,
            });
        });
    } catch (err) {
        console.error("Error saving session project:", err);
        res.status(500).json({ error: "Server error" });
    }
};

// Get selected project from session
export const getSessionProject = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                error: "Not logged in",
                selectedProject: null,
                selectedProjectName: null,
                selectedYear: null,
            });
        }

        res.json({
            selectedProject: req.session.selectedProject || null,
            selectedProjectName: req.session.selectedProjectName || null,
            selectedYear: req.session.selectedYear || null,
        });
    } catch (err) {
        console.error("Error in getSessionProject:", err);
        res.status(500).json({
            error: "Server error",
            selectedProject: null,
            selectedProjectName: null,
            selectedYear: null,
        });
    }
};

function sanitize(str) {
    return String(str)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 30);
}
function safe(val) {
    if (val === null || val === undefined) return "";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
}

function buildApproverString(doc) {
    if (!doc.wantApprovers || !doc.documentApprovalAuthority?.length) {
        return "N/A";
    }

    return doc.documentApprovalAuthority
        .sort((a, b) => (a.priority || 0) - (b.priority || 0))
        .map(approver => {
            const name = approver.userId?.name || 'Unknown';
            const status = approver.status || 'Pending';
            return `${name} (${status})`;
        })
        .join('; ');
}

export const servePDF = async (req, res) => {
    try {
        const { fileId } = req.params;
        const file = await File.findById(fileId);

        if (!file) {
            return res.status(404).send("File not found");
        }

        const command = new GetObjectCommand({
            Bucket: API_CONFIG.AWS_BUCKET,
            Key: file.file,
        });

        const response = await s3Client.send(command);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${file.originalName}"`);
        res.setHeader("Content-Length", response.ContentLength);

        // Stream the PDF to the browser
        response.Body.pipe(res);

        // await activityLogger({
        //     actorId: null,
        //     entityId: fileId,
        //     entityType: 'File',
        //     action: 'VIEW',
        //     details: `PDF ${file.originalName} viewed in browser by ${req.user ? req.user.name : "Guest User"}`
        // });

    } catch (error) {
        console.error("Error serving PDF:", error);
        res.status(500).send("Error loading PDF");
    }
};
export const downloadFilesZip = async (req, res) => {
    try {
        const userId = req.user?._id || null;
        const { documentId } = req.params;

        const document = await Document.findById(documentId)
            .populate("currentVersion")
            .lean();

        if (!document) {
            return res.status(404).json({ message: "Document not found" });
        }

        if (!document.metadata?.fileName) {
            return res.status(400).json({ message: "Document has no metadata.fileName" });
        }

        if (!document.folderId) {
            return res.status(400).json({ message: "Document has no folder" });
        }

        const folder = await Folder.findById(document.folderId);
        if (!folder) {
            return res.status(404).json({ message: "Folder not found" });
        }

        const currentVersion = document.currentVersionNumber?.toString() || "1.0";

        const zipName = `${document.metadata.fileName}.zip`;
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

        const archive = archiver("zip", { zlib: { level: 9 } });

        archive.on("error", err => {
            console.error("ZIP Error:", err);
            return res.status(500).send({ message: "Error creating ZIP" });
        });

        archive.pipe(res);

        const queue = new PQueue({ concurrency: 15 });

        const files = await File.find({
            folder: document.folderId,
            version: currentVersion,
            status: "active"
        });

        if (!files.length) {
            return res.status(404).json({
                message: "No files found for current version inside folder"
            });
        }

        for (const file of files) {
            queue.add(async () => {
                const command = new GetObjectCommand({
                    Bucket: process.env.AWS_BUCKET,
                    Key: file.file
                });

                const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

                const response = await fetch(signedUrl);

                if (!response.ok) {
                    throw new Error(`Fetch failed: ${response.statusText}`);
                }

                const nodeStream = Readable.fromWeb(response.body);

                archive.append(nodeStream, {
                    name: file.originalName
                });
            });
        }
        await queue.onIdle();
        await archive.finalize();
        await activityLogger({
            actorId: userId || null,
            entityId: documentId,
            entityType: 'Document',
            action: 'DOWNLOAD',
            details: `${document?.metadata?.fileName}'s files downloaded by ${req.user ? req.user.name : "Guest User"}`
        });
    } catch (error) {
        console.error("Download ZIP error:", error);
        return res.status(500).json({ message: "Failed to download document files" });
    }
};
export const downloadFolderAsZip = async (req, res) => {
    try {
        const userId = req.user._id;
        const { folderId } = req.params;

        const folder = await Folder.findById(folderId);
        if (!folder) return res.status(404).json({ message: "Folder not found" });

        const isOwner = String(folder.owner) === String(userId);
        const isSuperadmin = req.user.profile_type === "superadmin";

        const hasACLDownload = folder.permissions?.some(p =>
            String(p.principal) === String(userId) && p.canDownload === true
        );

        if (!isOwner && !isSuperadmin && !hasACLDownload) {
            return res.status(403).json({ message: "You do not have permission to download this folder" });
        }

        const zipName = `${folder.name}.zip`;

        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

        const archive = archiver("zip", { zlib: { level: 9 } });

        archive.on("error", (err) => {
            console.error("Archive Error:", err);
            return res.status(500).send({ message: "Error creating ZIP" });
        });

        archive.pipe(res);

        const queue = new PQueue({ concurrency: 5 });

        const addFolderToZip = async (folderId, zipPath) => {
            const currentFolder = await Folder.findById(folderId);
            if (!currentFolder) return;

            const files = await File.find({ folder: folderId, status: "active" });

            for (const file of files) {
                queue.add(async () => {
                    const command = new GetObjectCommand({
                        Bucket: process.env.AWS_BUCKET,
                        Key: file.file,
                    });

                    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

                    /** -------------------------
                     *     NATURAL FETCH()
                     * ---------------------------- */
                    const response = await fetch(signedUrl);

                    if (!response.ok) {
                        throw new Error(`Fetch failed: ${response.statusText}`);
                    }

                    // Convert browser stream -> Node.js readable stream
                    const nodeStream = Readable.fromWeb(response.body);

                    const fileNameInsideZip = `${zipPath}/${file.originalName}`;

                    archive.append(nodeStream, { name: fileNameInsideZip });
                });
            }

            const subfolders = await Folder.find({
                parent: folderId,
                isDeleted: false
            });

            for (const sub of subfolders) {
                const subZipPath = `${zipPath}/${sub.name}`;
                await addFolderToZip(sub._id, subZipPath);
            }
        };

        await addFolderToZip(folderId, folder.name);
        await queue.onIdle();
        await archive.finalize();

        await activityLogger({
            actorId: userId || null,
            entityId: req.params.fileId,
            entityType: "File",
            action: "DOWNLOAD",
            details: `Folder ${folder.name} downloaded by ${req.user ? req.user.name : "Guest User"}`
        });

    } catch (error) {
        console.error("Download ZIP error:", error);
        return res.status(500).json({ message: "Failed to download folder" });
    }
};

// Download file
export const downloadFile = async (req, res) => {
    try {
        const file = await File.findById(req.params.fileId);
        if (!file) return res.status(404).json({ message: "File not found" });

        const command = new GetObjectCommand({
            Bucket: API_CONFIG.AWS_BUCKET,
            Key: file.file
        });

        const s3Object = await s3Client.send(command);
        res.setHeader("Content-Disposition", `attachment; filename="${file.originalName}"`);
        res.setHeader("Content-Type", file.fileType || "application/octet-stream");

        s3Object.Body.pipe(res);

        const userId = req.user?._id;

        await activityLogger({
            actorId: userId || null,
            entityId: req.params.fileId,
            entityType: 'File',
            action: 'DOWNLOAD',
            details: `File ${file.originalName} downloaded by ${req.user ? req.user.name : "Guest User"}`
        });
        // await file.save();

    } catch (error) {
        console.error("Download error:", error);
        res.status(500).json({ message: "Failed to download file", error: error.message });
    }
};

export const exportDocuments = async (req, res) => {
    try {
        const { format, filters = {}, exportAll = false } = req.body;

        if (!["xlsx", "csv", "pdf", "ods"].includes(format)) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid export format" });
        }

        // Use the SAME filtering logic as getDocuments
        const {
            search,
            status,
            department,
            project,
            date,
            role,
            docType,
            designation,
        } = filters;

        const userId = req.user?._id;
        const userName = req.user?.name;
        const profile_type = req.user?.profile_type;

        // --- Base filter (SAME as getDocuments) ---
        const query = {
            isDeleted: false,
            isArchived: false,
        };

        // --- If not superadmin, restrict documents ---
        if (profile_type !== "superadmin") {
            query.$or = [
                { owner: userId },
                // { sharedWithUsers: userId }
            ];
        }

        const toArray = val => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            return val.split(',').map(v => v.trim()).filter(Boolean);
        };

        // --- Search ---
        if (search?.trim()) {
            const safeSearch = search.trim();
            query.$and = query.$and || [];
            query.$and.push({
                $or: [
                    // Metadata fields
                    { "metadata.fileName": { $regex: safeSearch, $options: "i" } },
                    { "metadata.fileDescription": { $regex: safeSearch, $options: "i" } },
                    { "metadata.mainHeading": { $regex: safeSearch, $options: "i" } },

                    // Document-level fields
                    { description: { $regex: safeSearch, $options: "i" } },
                    { remark: { $regex: safeSearch, $options: "i" } },
                    { tags: { $in: [new RegExp(safeSearch, "i")] } },

                    // Files
                    { "files.originalName": { $regex: safeSearch, $options: "i" } },

                    // Project name (via populated field)
                    { "project.projectName": { $regex: safeSearch, $options: "i" } }
                ]
            });
        }

        // --- Status ---
        if (status) {
            const normalizedStatus = status.replace(/\s+/g, ' ').trim();
            if (normalizedStatus === "Compliance and Retention") {
                query["compliance.isCompliance"] = true;
            } else {
                query.status = normalizedStatus;
            }
        }

        // --- Department filter ---
        if (department) {
            const deptArray = toArray(department).filter(id => mongoose.Types.ObjectId.isValid(id));
            if (deptArray.length > 0) {
                query.department = deptArray.length === 1 ? deptArray[0] : { $in: deptArray };
            }
        }

        // --- Project filter (from session) ---
        const sessionProjectId = req.session?.selectedProject;
        if (sessionProjectId && mongoose.Types.ObjectId.isValid(sessionProjectId)) {
            query.project = sessionProjectId;
        }

        // --- Date filter ---
        if (date) {
            const [day, month, year] = date.split("-").map(Number);
            const selectedDate = new Date(year, month - 1, day);
            if (!isNaN(selectedDate.getTime())) {
                const nextDate = new Date(selectedDate);
                nextDate.setDate(nextDate.getDate() + 1);
                query.createdAt = { $gte: selectedDate, $lt: nextDate };
            }
        }

        // --- Year filter from session ---
        if (req.session?.selectedYear) {
            const year = parseInt(req.session.selectedYear, 10);
            if (!isNaN(year)) {
                const startOfYear = new Date(year, 0, 1);
                const endOfYear = new Date(year + 1, 0, 1);

                if (!query.createdAt) {
                    query.createdAt = { $gte: startOfYear, $lt: endOfYear };
                } else {
                    query.createdAt.$gte = startOfYear;
                    query.createdAt.$lt = endOfYear;
                }
            }
        }

        /** -------------------- ROLE FILTER -------------------- **/
        if (role?.trim()) {
            const usersByRole = await mongoose
                .model("User")
                .find({ "userDetails.role": role.trim() }, { _id: 1 });
            if (usersByRole.length > 0) {
                query.owner = { $in: usersByRole.map((u) => u._id) };
            } else {
                query.owner = null; // no matching users
            }
        }

        /** -------------------- DESIGNATION FILTER -------------------- **/
        if (designation?.trim() && mongoose.Types.ObjectId.isValid(designation)) {
            const usersByDesg = await mongoose
                .model("User")
                .find({ "userDetails.designation": designation }, { _id: 1 });
            if (usersByDesg.length > 0) {
                query.owner = { $in: usersByDesg.map((u) => u._id) };
            } else {
                query.owner = null;
            }
        }

        /** -------------------- DOC TYPE FILTER -------------------- **/
        if (docType?.trim()) {
            const filesByType = await mongoose
                .model("File")
                .find({ fileType: docType.trim() }, { document: 1 });
            const docIds = filesByType.map((f) => f.document).filter(Boolean);
            if (docIds.length > 0) {
                query._id = { $in: docIds };
            } else {
                query._id = null;
            }
        }

        // --- Fetch documents with SAME population as getDocuments ---
        const docsQuery = Document.find(query)
            .select(`
                files updatedAt createdAt wantApprovers signature isDeleted isArchived 
                comment sharedWithUsers compliance status metadata tags owner versioning
                documentVendor documentDonor department project description
                documentApprovalAuthority
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
            .sort({ updatedAt: -1 });

        const documents = exportAll ? await docsQuery : await docsQuery.limit(1000);
        const exportData = formatExportData(documents);
        await activityLogger({
            actorId: userId || null,
            action: 'EXPORT',
            details: `Report exported by ${userName || "unknown user"}`
        });
        // ----- file name -------------------------------------------------
        const parts = [];
        if (filters.role) parts.push(`Role_${sanitize(filters.role)}`);
        if (filters.department) parts.push(`Dept_${sanitize(filters.department)}`);
        if (filters.docType) parts.push(`Type_${sanitize(filters.docType)}`);
        if (filters.designation) parts.push(`Desig_${sanitize(filters.designation)}`);
        if (filters.date) parts.push(`Date_${filters.date}`);
        if (filters.search) parts.push(`Search_${sanitize(filters.search)}`);
        const suffix = parts.length ? parts.join("-") + "-" : "";
        const fileName = `documents-${suffix}${new Date()
            .toISOString()
            .split("T")[0]}.${format}`;

        // ----- generate --------------------------------------------------
        switch (format) {
            case "xlsx":
                await generateExcel(exportData, res, fileName);
                break;
            case "csv":
                generateCSV(exportData, res, fileName);
                break;
            case "pdf":
                await generatePDF(exportData, res, fileName);
                break;
            case "ods":
                await generateODS(exportData, res, fileName);
                break;
        }
    } catch (error) {
        console.error("Export error:", error);
        res.status(500).json({
            success: false,
            message: "Export failed",
            error: error.message
        });
    }
};

function buildQuery(filters) {
    const query = {};

    if (filters.role) {
        query.role = filters.role;
    }

    if (filters.department) {
        query.department = filters.department;
    }

    if (filters.docType) {
        query['metadata.docType'] = filters.docType;
    }

    if (filters.designation) {
        query['owner.designation'] = filters.designation;
    }

    if (filters.search) {
        query.$or = [
            { 'metadata.fileName': { $regex: filters.search, $options: 'i' } },
            { 'metadata.fileDescription': { $regex: filters.search, $options: 'i' } },
            { 'owner.name': { $regex: filters.search, $options: 'i' } },
            { tags: { $regex: filters.search, $options: 'i' } }
        ];
    }

    if (filters.date) {
        const startDate = new Date(filters.date);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        query.createdAt = {
            $gte: startDate,
            $lt: endDate
        };
    }

    return query;
}

// Format data for export
function formatExportData(documents) {
    return documents.map(doc => {
        const file = doc.files?.[0] || {};

        return {
            fileName: safe(doc.metadata?.fileName),
            fileSize: safe(file.fileSize
                ? `${(file.fileSize / 1024).toFixed(2)} KB`
                : ""),
            owner: safe(doc.owner?.name),
            empcode: safe(doc.owner?.userDetails?.employee_id),
            designation: safe(doc.owner?.userDetails?.designation?.name || "N/A"),
            department: safe(doc.department?.name || "N/A"),
            approver: safe(buildApproverString(doc)),
            lastModified: safe(doc.updatedAt
                ? new Date(doc.updatedAt).toLocaleString()
                : ""),
            tags: safe(doc.tags?.join(", ")),
            metadata: safe(doc.metadata?.fileDescription || "N/A"),
            sharedWith: safe(doc.sharedWithUsers?.map(u => u.name).join(", ") || "N/A"),
            createdOn: safe(doc.createdAt
                ? new Date(doc.createdAt).toLocaleString()
                : "N/A"),
            description: safe(doc.description
                ? doc.description.replace(/<\/?[^>]+(>|$)/g, "").trim()
                : "N/A"),
            signature: safe(doc.signature?.fileUrl ? "Signature Attached" : "No Signature"),
            signatureUrl: safe(doc.signature?.fileUrl || "")
        };
        
    });
}

function mapColumnNameToKey(columnName) {
    const columnMap = {
        'File Name': 'fileName',
        'Owner': 'owner',
        'Designation': 'designation',
        'Department': 'department',
        'Role': 'role',
        'Approver': 'approver',
        'Last Modified On': 'lastModified',
        'Tags': 'tags',
        'Meta data': 'metadata',
        'Shared with': 'sharedWith',
        'Created on': 'createdOn',
        'Description': 'description',
        'Signature': 'signature',
        'Status': 'status'
    };

    return columnMap[columnName] || columnName.toLowerCase().replace(/\s+/g, '');
}

// Generate Excel file
async function generateExcel(data, res, fileName) {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Documents Report");

    if (!data || !data.length) {
        return res.status(400).json({ message: "No data to export" });
    }

    // ❗ REMOVE signatureUrl (not needed in excel)
    const cleanedData = data.map(row => {
        const { signatureUrl, ...rest } = row;
        return rest;
    });

    const keys = Object.keys(cleanedData[0]);

    ws.columns = keys.map(key => ({
        header: toProperCase(key.replace(/([A-Z])/g, " $1")),
        key: key,
        width: 25
    }));

    cleanedData.forEach(row => {
        const newRow = ws.addRow(row);
    
        newRow.eachCell((cell) => {
            // Force everything as TEXT
            if (cell.value !== null && cell.value !== undefined) {
                cell.value = String(cell.value);
                cell.numFmt = '@';
            }
        });
    });
    ws.columns.forEach(col => {
        col.style = { numFmt: '@' }; // Force entire column as TEXT
    });
        
    ws.getRow(1).font = { bold: true };
    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
}


function generateCSV(data, res, fileName) {
    if (!data.length) {
        return res
            .status(400)
            .json({ success: false, message: "No data to export" });
    }
    const fields = Object.keys(data[0]).map(h =>
        formatHeader(h.replace(/([A-Z])/g, " $1"))
    );
    const parser = new Parser({ fields });

    const csv = parser.parse(data);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(csv);
}

async function generatePDF(data, res, fileName) {
    const doc = new PDFDocument({
        margins: { top: 50, left: 50, right: 50, bottom: 50 }
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    doc.pipe(res);

    // ---------- HEADER ----------
    doc.fontSize(20).font("Helvetica-Bold").text("Documents Report", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").text(`Exported on: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown(1.5);

    let y = doc.y;

    const addNewPageIfNeeded = () => {
        if (y > 720) {
            doc.addPage();
            y = 50;
        }
    };

    // ---------- DOCUMENT LOOP ----------
    data.forEach((row, i) => {
        addNewPageIfNeeded();

        doc.fontSize(12)
            .font("Helvetica-Bold")
            .text(`Document ${i + 1}`, 50, y);

        y += 20;

        Object.entries(row).forEach(([key, value]) => {

            // Skip raw URL field
            if (key === "signatureUrl") return;

            addNewPageIfNeeded();

            doc.fontSize(10)
                .font("Helvetica-Bold")
                .text(`${formatHeader(key.replace(/([A-Z])/g, " $1"))}:`, 50, y);

            // ---------- SIGNATURE TEXT + HYPERLINK ----------
            if (key === "signature" && row.signatureUrl) {
                doc.font("Helvetica")
                    .fillColor("blue")
                    .text(value, 140, y, {
                        link: row.signatureUrl,
                        underline: true,
                        width: 400
                    })
                    .fillColor("black");

                y += 15;
                return;
            }

            // ---------- NORMAL TEXT ----------
            const cleanVal = value ? String(value) : "";
            const height = doc.font("Helvetica").fontSize(10).heightOfString(cleanVal, { width: 400 });

            doc.font("Helvetica").text(cleanVal, 140, y, { width: 400 });

            y += height + 5;
        });

        y += 10; // separation between documents
    });

    doc.end();
}

async function generateODS(data, res, fileName) {
    try {
        if (!data.length) {
            return res.status(400).json({
                success: false,
                message: "No data to export"
            });
        }

        // Remove signatureUrl from ODS completely (ODS cannot hyperlink)
        const cleanData = data.map(row => {
            const copy = { ...row };
            delete copy.signatureUrl;
            return copy;
        });

        const worksheet = XLSX.utils.json_to_sheet(cleanData);
        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, "Documents Report");

        const odsBuffer = XLSX.write(workbook, {
            bookType: "ods",
            type: "buffer"
        });

        res.setHeader(
            "Content-Type",
            "application/vnd.oasis.opendocument.spreadsheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${fileName}"`
        );

        return res.send(odsBuffer);

    } catch (err) {
        console.error("ODS Export Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to export ODS",
            error: err.message
        });
    }
}

// Get available export formats
export const getExportFormats = async (req, res) => {
    try {
        const formats = [
            {
                type: 'xlsx',
                label: 'Excel (XLSX)',
                description: 'Microsoft Excel format',
                icon: 'ti ti-file-spreadsheet'
            },
            {
                type: 'csv',
                label: 'CSV',
                description: 'Comma Separated Values',
                icon: 'ti ti-file-type-csv'
            },
            {
                type: 'pdf',
                label: 'PDF',
                description: 'Portable Document Format',
                icon: 'ti ti-file-type-pdf'
            },
            {
                type: 'ods',
                label: 'ODS',
                description: 'OpenDocument Spreadsheet',
                icon: 'ti ti-file-spreadsheet'
            }
        ];

        res.json({
            success: true,
            data: formats
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get export formats',
            error: error.message
        });
    }
};