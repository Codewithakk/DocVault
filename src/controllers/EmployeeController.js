import mongoose from "mongoose";
import Document from "../models/Document.js";
import { formatTotalFileSize } from "../helper/CommonHelper.js";

//Page controllers

// Render Dashboard page
export const showEmployeeDashboardPage = (req, res) => {
    try {
        res.render("pages/employee/employeeDashboard", {
            pageTitle: "Employee Dashboard",
            pageDescription: "Access employee tools, manage tasks, and view activity insights.",
            metaKeywords: "employee dashboard, employee tools, work analytics",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user
        });
    } catch (err) {
        logger.error("Dashboard render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load employee dashboard.",
            metaKeywords: "employee dashboard error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load dashboard"
        });
    }
};

export const showEmployeeApprovalPage = (req, res) => {
    try {
        const documentId = req.query.id || null;
        res.render("pages/employee/approval", {
            pageTitle: "Employee Approvals",
            pageDescription: "View and manage document and task approval requests.",
            metaKeywords: "employee approvals, approval workflow, approval requests",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            documentId,
            user: req.user
        });
    } catch (err) {
        logger.error("Approval page render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load approval page.",
            metaKeywords: "approval page error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load dashboard"
        });
    }
};

export const showEmployeeRecycleBinPage = async (req, res) => {
    try {
        res.render("pages/employee/employeeRecycleBin", {
            pageTitle: "Recycle Bin",
            pageDescription: "View and restore deleted files and documents.",
            metaKeywords: "employee recycle bin, deleted files, restore items",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user
        });
    } catch (err) {
        logger.error("Recycle bin render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load recycle bin.",
            metaKeywords: "recycle bin error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load dashboard"
        });
    }
};

export const showEmployeeAnayticsPage = async (req, res) => {
    try {
        res.render("pages/employee/anaytics", {
            pageTitle: "Analytics",
            pageDescription: "Review analytics, performance insights, and activity trends.",
            metaKeywords: "employee analytics, performance insights, activity metrics",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user
        });
    } catch (err) {
        logger.error("Analytics page render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load analytics page.",
            metaKeywords: "analytics page error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load dashboard"
        });
    }
};

//API Controllers

/**
 * Get all approval requests for managers/admin
 * GET /api/documents/approval-requests?status=&department=
 */
export const getApprovalRequests = async (req, res) => {
    try {
        const user = req.user || req.session.user;
        console.log(req.session)
        const userId = new mongoose.Types.ObjectId(user._id);
        const profileType = user.profile_type;
        const userDepartment = user.department ? new mongoose.Types.ObjectId(user.department) : null;
        const documentId = req.query.documentId;

        let {
            status,
            department,
            createdAt,
            startDate,
            endDate,
            page = 1,
            limit = 10,
            sortField = "createdAt",
            sortOrder = "desc"
        } = req.query;

        page = parseInt(page);
        limit = parseInt(limit);

        const filter = {
            isDeleted: { $ne: true },
            isArchived: { $ne: true },
            wantApprovers: true
        };

        if (profileType !== "superadmin") {
            const accessConditions = [
                { owner: userId }
            ];
            if (userDepartment) accessConditions.push({ department: userDepartment });
            filter.$or = accessConditions;
        }
        if (documentId && mongoose.Types.ObjectId.isValid(documentId)) {
            filter._id = new mongoose.Types.ObjectId(documentId);
        }

        if (status && status !== "All") {
            filter.status = status;
        }
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            filter.createdAt = { $gte: start, $lte: end };
        }

        if (department && mongoose.Types.ObjectId.isValid(department)) {
            filter.department = new mongoose.Types.ObjectId(department);
        }

        if (createdAt) {
            const [day, month, year] = createdAt.split("-").map(Number);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                const start = new Date(year, month - 1, day, 0, 0, 0, 0);
                const end = new Date(year, month - 1, day, 23, 59, 59, 999);
                filter.createdAt = { $gte: start, $lte: end };
            }
        }

        const allowedFields = [
            "metadata.fileName",
            "createdAt",
            "department.name",
            "projectManager.name",
            "status",
            "comment"
        ];
        const sortObj = {};
        sortObj[allowedFields.includes(sortField) ? sortField : "createdAt"] =
            sortOrder === "asc" ? 1 : -1;

        const skip = (page - 1) * limit;


        let [documents, total] = await Promise.all([
            Document.find(filter)
                .select('department createdAt status wantApprovers metadata.fileName files documentApprovalAuthority comment versioning ')
                .populate("department", "name")
                .populate("owner", "name email profile_image")
                .populate("projectManager", "name email profile_image")
                .populate("sharedWithUsers", "name email profile_image")
                .populate("files", "originalName version fileSize")
                .sort(sortObj)
                .skip(skip)
                .limit(limit)
                .lean(),
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

        res.status(200).json({
            success: true,
            data: documents,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            }
        });

    } catch (error) {
        console.error("Error in getApprovalRequests:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const getApprovalRequestsCounts = async (req, res) => {
    try {
        const user = req.user || req.session.user;
        const userId = new mongoose.Types.ObjectId(user._id);
        const profileType = user.profile_type;
        const userDepartment = user.department
            ? new mongoose.Types.ObjectId(user.department)
            : null;

        const { department, createdAt, startDate, endDate, documentId } = req.query;

        const filter = {
            isDeleted: { $ne: true },
            isArchived: { $ne: true },
            wantApprovers: true,
        };

        if (profileType !== "superadmin") {
            const accessConditions = [{ owner: userId }];

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

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            filter.createdAt = {
                $gte: start,
                $lte: end,
            };
        }

        if (createdAt) {
            const [day, month, year] = createdAt.split("-").map(Number);

            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                filter.createdAt = {
                    $gte: new Date(year, month - 1, day, 0, 0, 0),
                    $lte: new Date(year, month - 1, day, 23, 59, 59, 999),
                };
            }
        }

        const [counts] = await Document.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    All: { $sum: 1 },
                    Draft: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "Draft"] }, 1, 0]
                        }
                    },
                    Pending: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "Pending"] }, 1, 0]
                        }
                    },
                    Approved: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "Approved"] }, 1, 0]
                        }
                    },
                    Rejected: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0
                }
            }
        ]);
        
        return res.status(200).json({
            success: true,
            data: counts || {
                All: 0,
                Draft: 0,
                Pending: 0,
                Approved: 0,
                Rejected: 0
            }
        });
    } catch (error) {
        console.error("Error in getApprovalRequestsCounts:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};