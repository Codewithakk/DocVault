import mongoose from "mongoose";
import Document from "../models/Document.js";
import logger from "../utils/logger.js";
import Designation from "../models/Designation.js";
import Folder from "../models/Folder.js";
import PermissionLogs from "../models/PermissionLogs.js";
import User from "../models/User.js";
import SharedWith from "../models/SharedWith.js";
import { sendEmail } from "../services/emailService.js";
import { API_CONFIG } from "../config/ApiEndpoints.js";
import { generateEmailTemplate } from "../helper/emailTemplate.js";
import { formatTotalFileSize } from "../helper/CommonHelper.js";

//Page controllers

// Render Dashboard page
export const showAdminDashboardPage = (req, res) => {
    try {
        res.render("pages/admin/adminDashboard", {
            pageTitle: "Admin Dashboard",
            pageDescription: "Manage users, documents, permissions, and system configurations from the admin dashboard.",
            metaKeywords: "admin dashboard, esangrah admin, document management, user management",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user
        });
    } catch (err) {
        logger.error("Dashboard render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load the admin dashboard.",
            user: req.user,
            message: "Unable to load dashboard"
        });
    }
};

export const showAdminApprovalPage = (req, res) => {
    const documentId = req.query.documentId;
    try {
        res.render("pages/admin/approval", {
            pageTitle: "Document Approval",
            pageDescription: "Review and approve submitted documents in the admin panel.",
            metaKeywords: "document approval, admin approval, workflow, esangrah",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            documentId
        });
    } catch (err) {
        logger.error("Approval page render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load document approval page.",
            user: req.user,
            message: "Unable to load approval page"
        });
    }
};

export const showApprovalTrackPage = async (req, res) => {
    try {
        const documentId = req.params.id;

        res.render("pages/admin/approval-tracking", {
            pageTitle: "Approval Tracking",
            pageDescription: "Track the status and progress of document approvals.",
            metaKeywords: "approval tracking, workflow monitoring, esangrah",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            documentId,
            user: req.user
        });

    } catch (err) {
        logger.error("Approval tracking render error:", err);
        res.status(500).render("pages/admin/approval-tracking", {
            pageTitle: "Error",
            pageDescription: "Unable to load approval tracking page.",
            documentId: null,
            user: req.user
        });
    }
};

export const showRecycleBinPage = async (req, res) => {
    try {
        const designations = await Designation.find({ status: "Active" })
            .sort({ name: 1 })
            .lean();

        res.render("pages/admin/adminRecycleBin", {
            pageTitle: "Recycle Bin",
            pageDescription: "View and restore deleted items from the admin recycle bin.",
            metaKeywords: "recycle bin, deleted items, restore documents, esangrah",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            designations
        });
    } catch (err) {
        logger.error("Recycle bin render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load recycle bin.",
            user: req.user,
            message: "Unable to load recycle bin"
        });
    }
};

export const showManageAccessPage = async (req, res) => {
    try {
        const { folderId } = req.params;
        const { userEmail } = req.query;
        const owner = req.user;

        if (!folderId || !owner) {
            return res.status(400).send("Invalid request");
        }

        const folder = await Folder.findById(folderId)
            .populate("owner", "name email")
            .populate("permissions.principal", "name email");

        if (!folder) return res.status(404).send("Folder not found");

        if (folder.owner._id.toString() !== owner._id.toString()) {
            return res.status(403).send("Not authorized");
        }

        res.render("pages/admin/manage-access", {
            pageTitle: "Manage Folder Access",
            pageDescription: "Grant, edit, or remove folder access permissions for users.",
            metaKeywords: "folder access, permission management, user permissions, esangrah",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            folder,
            user: req.user,
            userEmail
        });

    } catch (err) {
        logger.error("Manage access render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load manage access page.",
            user: req.user,
            message: "Unable to load manage access page"
        });
    }
};

export const showPermissionLogsPage = async (req, res) => {
    try {
        res.render("pages/reports/permissionLogs", {
            pageTitle: "Permission Logs",
            pageDescription: "Review detailed logs of permission changes within the system.",
            metaKeywords: "permission logs, access logs, audit logs, esangrah",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user
        });

    } catch (err) {
        logger.error("Permission logs render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load permission logs.",
            user: req.user,
            message: "Unable to load permission logs"
        });
    }
};

export const showFolderPermissionLogsPage = async (req, res) => {
    try {
        res.render("pages/reports/folderPermissionLogs", {
            pageTitle: "Folder Permission Logs",
            pageDescription: "Track folder-level permission changes and access events.",
            metaKeywords: "folder permission logs, folder access logs, esangrah audit",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user
        });

    } catch (err) {
        logger.error("Folder permission logs render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load folder permission logs.",
            user: req.user,
            message: "Unable to load folder permission logs"
        });
    }
};

//API Controllers

/**
 * Get documents submitted by current user (My Approvals)
 * GET /api/documents/my-approvals
 */
export const getMyApprovals = async (req, res) => {
    try {
        const user = req.user || req.session.user;
        const userId = new mongoose.Types.ObjectId(user._id);
        const profileType = user.profile_type;
        const userDepartment = user.department ? new mongoose.Types.ObjectId(user.department) : null;
        const documentId = req.query.documentId;
 
        const {
            status,
            department,
            createdAt,
            createdAtStart,
            createdAtEnd,
            page = 1,
            limit = 10,
            sortField = "createdAt",
            sortOrder = "desc"
        } = req.query;
 
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;
 
        const filter = {
            isDeleted: { $ne: true },
            isArchived: { $ne: true },
            documentApprovalAuthority: { $exists: true, $ne: [] }
        };
 
        if (profileType !== "superadmin") {
            filter.documentApprovalAuthority = {
                $elemMatch: {
                    userId,
                    isMailSent: true
                }
            };
 
            const accessConditions = [
                { owner: userId },
                { "documentApprovalAuthority.userId": userId }
            ];
 
            if (userDepartment) {
                accessConditions.push({ department: userDepartment });
            }
 
            filter.$or = accessConditions;
        }
 
 
 
        if (documentId && mongoose.Types.ObjectId.isValid(documentId)) {
            filter._id = new mongoose.Types.ObjectId(documentId);
        }
 
        if (profileType !== "superadmin") {
            const accessConditions = [
                { owner: userId },
                { "documentApprovalAuthority.userId": userId }
            ];
            if (userDepartment) accessConditions.push({ department: userDepartment });
            filter.$or = accessConditions;
        }
 
        if (status && status !== "All") filter.status = status;
 
        if (department && mongoose.Types.ObjectId.isValid(department)) {
            filter.department = new mongoose.Types.ObjectId(department);
        }
 
        if (createdAtStart && createdAtEnd) {
            const start = new Date(createdAtStart);
            const end = new Date(createdAtEnd);
 
            if (!isNaN(start) && !isNaN(end)) {
                filter.createdAt = {
                    $gte: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0),
                    $lte: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999)
                };
            }
        } else if (createdAt) {
            const [day, month, year] = createdAt.split("-").map(Number);
            if (!isNaN(day)) {
                filter.createdAt = {
                    $gte: new Date(year, month - 1, day, 0, 0, 0),
                    $lte: new Date(year, month - 1, day, 23, 59, 59, 999)
                };
            }
        }
 
        const allowedFields = [
            "metadata.fileName",
            "createdAt",
            "documentDonor.name",
            "department.name",
            "status",
            "comment"
        ];
        const sortFieldValidated = allowedFields.includes(sortField) ? sortField : "createdAt";
        const sortOrderValidated = sortOrder === "asc" ? 1 : -1;
 
        const [documents, total] = await Promise.all([
            Document.aggregate([
                { $match: filter },
 
                {
                    $addFields: {
                        pendingPriority: {
                            $cond: [{ $eq: ["$status", "Pending"] }, 0, 1]
                        }
                    }
                },
 
                {
                    $sort: {
                        pendingPriority: 1, // Pending always first
                        [sortFieldValidated]: sortOrderValidated
                    }
                },
 
                { $skip: skip },
                { $limit: limitNum }
            ])
                // populate after aggregation
                .then(docs =>
                    Document.populate(docs, [
                        { path: "department", select: "name" },
                        { path: "documentDonor", select: "name" },
                        { path: "files" },
                        {
                            path: "documentApprovalAuthority.userId",
                            select: "name email profile_type"
                        }
                    ])
                ),
 
            Document.countDocuments(filter)
        ]);
 
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
 
        const filteredDocuments = documents.map(doc => ({
            ...doc,
            documentApprovalAuthority:
                profileType === "superadmin"
                    ? doc.documentApprovalAuthority
                    : doc.documentApprovalAuthority?.filter(
                        auth =>
                            auth.userId?._id?.toString() === userId.toString() &&
                            auth.isMailSent === true
                    ) || []
        }));
 
        res.status(200).json({
            success: true,
            data: filteredDocuments,
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum),
                limit: limitNum
            }
        });
    } catch (error) {
        console.error("Error in getMyApprovals:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const getMyApprovalsCounts = async (req, res) => {
    try {
        const user = req.user || req.session.user;
        const userId = new mongoose.Types.ObjectId(user._id);
        const profileType = user.profile_type;
        const userDepartment = user.department
            ? new mongoose.Types.ObjectId(user.department)
            : null;

        const {
            status,
            department,
            createdAt,
            createdAtStart,
            createdAtEnd,
            documentId
        } = req.query;

        // Base filter
        const filter = {
            isDeleted: { $ne: true },
            isArchived: { $ne: true },
            documentApprovalAuthority: { $exists: true, $ne: [] }
        };

        if (profileType !== "superadmin") {
            filter.documentApprovalAuthority = {
                $elemMatch: {
                    userId,
                    isMailSent: true
                }
            };

            const accessConditions = [
                { owner: userId },
                { "documentApprovalAuthority.userId": userId }
            ];

            if (userDepartment) {
                accessConditions.push({ department: userDepartment });
            }

            filter.$or = accessConditions;
        }

        if (documentId && mongoose.Types.ObjectId.isValid(documentId)) {
            filter._id = new mongoose.Types.ObjectId(documentId);
        }

        if (department && mongoose.Types.ObjectId.isValid(department)) {
            filter.department = new mongoose.Types.ObjectId(department);
        }

        if (createdAtStart && createdAtEnd) {
            const start = new Date(createdAtStart);
            const end = new Date(createdAtEnd);

            if (!isNaN(start) && !isNaN(end)) {
                filter.createdAt = {
                    $gte: new Date(
                        start.getFullYear(),
                        start.getMonth(),
                        start.getDate(),
                        0,
                        0,
                        0,
                        0
                    ),
                    $lte: new Date(
                        end.getFullYear(),
                        end.getMonth(),
                        end.getDate(),
                        23,
                        59,
                        59,
                        999
                    )
                };
            }
        } else if (createdAt) {
            const [day, month, year] = createdAt.split("-").map(Number);

            if (!isNaN(day)) {
                filter.createdAt = {
                    $gte: new Date(year, month - 1, day, 0, 0, 0, 0),
                    $lte: new Date(year, month - 1, day, 23, 59, 59, 999)
                };
            }
        }

        // Filtered count (selected status)
        const filteredFilter = { ...filter };

        if (status && status !== "All") {
            filteredFilter.status = status;
        }

        // Base filter for status-wise counts (without status)
        const statusFilter = { ...filter };

        const [filteredCount, statusAggregation] = await Promise.all([
            Document.countDocuments(filteredFilter),

            Document.aggregate([
                { $match: statusFilter },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        const statusCounts = {
            All: 0,
            Draft: 0,
            Pending: 0,
            Approved: 0,
            Rejected: 0
        };

        statusAggregation.forEach(item => {
            statusCounts[item._id] = item.count;
            statusCounts.All += item.count;
        });

        return res.status(200).json({
            success: true,
            filteredCount,
            statusCounts
        });

    } catch (error) {
        console.error("Error in getMyApprovalsCounts:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

export const getPermissionLogs = async (req, res) => {
    const ownerId = req.user._id;
    const profileType = req.session.user.profile_type;
    const { page = 1, limit = 10, startDate, endDate } = req.query;
    try {
        // Base query
        const query = {};
        // Restrict by owner unless superadmin
        if (profileType !== 'superadmin') {
            query.owner = ownerId;
        }

        // Optional date filter
        if (startDate || endDate) {
            query.requestedAt = {};
            if (startDate) query.requestedAt.$gte = new Date(startDate);
            if (endDate) query.requestedAt.$lte = new Date(endDate);
        }

        const total = await PermissionLogs.countDocuments(query);

        const logs = await PermissionLogs.find(query)
            .select("user document requestedAt isExternal requestStatus access expiresAt duration")
            .populate({
                path: "document",
                select: "files",
                populate: {
                    path: "files",
                    select: "originalName version fileType fileSize"
                }
            })
            .populate("user", "username email")
            .sort({ requestedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();

        res.status(200).json({
            success: true,
            data: logs,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch permission logs' });
    }
};


export const updateRequestStatus = async (req, res) => {
    const { logId, requestStatus } = req.body;;
    if (!["approved", "pending", "rejected"].includes(requestStatus)) {
        return res.status(400).json({ success: false, message: "Invalid request status" });
    }

    try {
        const log = await PermissionLogs.findByIdAndUpdate(
            logId,
            { requestStatus, approvedBy: req.user._id },
            { new: true }
        );
        if (!log) return res.status(404).json({ success: false, message: "Permission log not found" });

        res.status(200).json({ success: true, data: log });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to update request status" });
    }
};

export const grantAccess = async (req, res) => {
    try {
        const { logId, duration, customDates } = req.body;

        if (!logId || !duration) {
            return res.status(400).json({ message: "logId & duration are required." });
        }

        const log = await PermissionLogs.findById(logId).populate("document owner");
        if (!log) return res.status(404).json({ message: "Permission log not found" });

        const doc = log.document;
        if (!doc) return res.status(404).json({ message: "Document not found in log" });

        const loggedUser = log.user; // embedded data
        const userEmail = loggedUser?.email;

        // Determine internal or external user
        const internalUser = await User.findOne({ email: userEmail });
        const isExternal = !internalUser;

        // Duration Handling
        const now = new Date();
        let expiresAt = null;

        const durationMap = {
            oneday: () => new Date(now.getTime() + 24 * 60 * 60 * 1000),
            oneweek: () => new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            onemonth: () => new Date(now.setMonth(now.getMonth() + 1)),
            lifetime: () => new Date(now.setFullYear(now.getFullYear() + 50)),
            onetime: () => null
        };

        if (duration === "custom") {
            if (!customDates || !customDates.includes(" to ")) {
                return res.status(400).json({ message: "Invalid customDates format" });
            }
        
            const parts = customDates.split(" to ");
            const end = parts[1]?.trim();
        
            if (!end) {
                return res.status(400).json({ message: "End date missing" });
            }
        
            // Expecting DD-MM-YYYY
            const [day, month, year] = end.split("-");
        
            if (!day || !month || !year) {
                return res.status(400).json({ message: "Invalid date format. Use DD-MM-YYYY" });
            }
        
            expiresAt = new Date(year, month - 1, day);
        
            if (isNaN(expiresAt)) {
                return res.status(400).json({ message: "Invalid date value" });
            }
        }       

        // Construct Access URL (use current document version)
        const currentVersion = doc.versioning?.currentVersion?.toString() || "1.0";
        const accessUrl = `${API_CONFIG.baseUrl}/documents/${doc._id}/versions/view?version=${currentVersion}`;

        // If Internal User → Update SharedWith
        if (!isExternal && internalUser) {
            await SharedWith.findOneAndUpdate(
                { document: doc._id, user: internalUser._id },
                {
                    accessLevel: "view",
                    duration,
                    expiresAt,
                    generalAccess: true
                },
                { new: true, upsert: true }
            );
        }

        // Update Permission Log
        log.requestStatus = "approved";
        log.approvedBy = doc.owner;
        log.isExternal = isExternal;
        log.duration = duration;
        log.expiresAt = expiresAt;
        log.accessUrl = accessUrl; // optional: store URL in log for reference
        await log.save();

        // Email Notification
        if (!isExternal && userEmail) {
            // Prepare dynamic data for the template
            const data = {
                userName: internalUser?.name || userEmail,
                fileName: doc.metadata?.fileName || "Untitled Document",
                duration,
                expiresAt: expiresAt ? expiresAt.toLocaleString() : "N/A",
                ownerName: doc.owner?.name || "Document Owner",
                accessUrl,
                companyName: res.locals.companyName || "Our Company",
                logoUrl: res.locals.logo || "",
                bannerUrl: res.locals.mailImg || "",
            };

            // Generate HTML using your central email generator
            const html = generateEmailTemplate('accessGranted', data);

            // Send the email
            await sendEmail({
                to: userEmail,
                subject: "Access Granted",
                html,
                fromName: res.locals?.supportTeamName || "DMS Support Team",
            });
        }
        return res.status(200).json({
            message: `Access granted to ${loggedUser?.username || userEmail}`,
            expiresAt,
            isExternal,
            accessUrl
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};