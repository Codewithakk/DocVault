import mongoose from "mongoose";
import Document from "../models/Document.js";
import File from "../models/File.js";
import { successResponse, failResponse, errorResponse } from "../utils/responseHandler.js";
import { calculateStartDate } from "../utils/calculateStartDate.js";
import { formatFileSize, getDateRange, getFileIcon, getGrowth } from "../helper/CommonHelper.js";
import { FILE_TYPE_CATEGORIES, FILTER_PERIODS } from "../constant/Constant.js";
import Project, { ProjectType } from "../models/Project.js";
import { applyFilters, getSessionFilters } from "../helper/sessionHelpers.js";
import Department from "../models/Departments.js";
import ActivityLog from "../models/ActivityLog.js"

//Page controllers

// Render Dashboard page
export const showDashboard = (req, res) => {
    try {
        res.render("pages/dashboard/dashboard", {
            pageTitle: "Dashboard",
            pageDescription: "Access your recent documents, workspace activity, and quick navigation tools in your e-Sangrah dashboard.",
            metaKeywords: "dashboard, esangrah dashboard, workspace overview, document management",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user
        });
    } catch (err) {
        logger.error("Dashboard render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load the dashboard.",
            user: req.user,
            message: "Unable to load dashboard"
        });
    }
};


//API Controllers

// ------------------- Dashboard Stats -------------------
export const getDashboardStats = async (req, res) => {
    try {
        const user = req.user || req.session.user;
        const userId = new mongoose.Types.ObjectId(user._id);
        const profileType = user.profile_type?.toLowerCase();
 
        const { selectedProjectId } = getSessionFilters(req);
        const filter = req.query.filter || "year";
        /* ------------------ DATE RANGE FROM HELPER ------------------ */
        const range = await getDateRange(filter);
 
        if (!range) {
            return errorResponse(res, {}, "Invalid filter option");
        }
 
        const { start, end } = range;
 
        /* ------------------ PREVIOUS PERIOD RANGE ------------------ */
        const diff = end.getTime() - start.getTime();
        const prevStart = new Date(start.getTime() - diff);
        const prevEnd = new Date(end.getTime() - diff);
 
        /* ------------------ BASE MATCH ------------------ */
        const baseMatch = [
            { isDeleted: { $ne: true } },
            { isArchived: { $ne: true } }
        ];
 
        if (profileType !== "superadmin") {
            baseMatch.push({ owner: userId });
        }
 
        if (selectedProjectId) {
            baseMatch.push({ project: selectedProjectId });
        }
 
        /* ------------------ MATCH CURRENT ------------------ */
        const currentMatch = [
            ...baseMatch,
            { createdAt: { $gte: start, $lte: end } }
        ];
 
        /* ------------------ MATCH PREVIOUS ------------------ */
        const previousMatch = [
            ...baseMatch,
            { createdAt: { $gte: prevStart, $lte: prevEnd } }
        ];
        /* ------------------ DEPARTMENT WISE COUNT (NO GROWTH) ------------------ */
        const departmentStats = await Document.aggregate([
            { $match: { $and: baseMatch } },
            {
                $group: {
                    _id: "$department",
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: "departments",
                    localField: "_id",
                    foreignField: "_id",
                    as: "department"
                }
            },
            { $unwind: "$department" },
            {
                $project: {
                    _id: 0,
                    departmentId: "$department._id",
                    departmentName: "$department.name",
                    count: 1
                }
            }
        ]);
 
        /* ------------------ AGGREGATION ------------------ */
        const currentStats = await Document.aggregate([
            { $match: { $and: currentMatch } },
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);
 
        const previousStats = await Document.aggregate([
            { $match: { $and: previousMatch } },
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);
 
        /* ------------------ FORMAT ------------------ */
        const formatStats = (data) => {
            const stats = { total: 0, draft: 0, pending: 0, approved: 0, rejected: 0 };
            data.forEach(s => {
                const key = s._id?.toLowerCase();
                if (stats[key] !== undefined) stats[key] = s.count;
                stats.total += s.count;
            });
            return stats;
        };
 
        const current = formatStats(currentStats);
        const previous = formatStats(previousStats);
 
        /* ------------------ GROWTH FUNCTION ------------------ */
        const getGrowth = (curr, prev) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return ((curr - prev) / prev) * 100;
        };
 
        /* ------------------ RESPONSE ------------------ */
        const response = {
            filter,
            startDate: start,
            endDate: end,
 
            total: current.total,
            totalGrowth: getGrowth(current.total, previous.total),
 
            draft: current.draft,
            draftGrowth: getGrowth(current.draft, previous.draft),
 
            pending: current.pending,
            pendingGrowth: getGrowth(current.pending, previous.pending),
 
            approved: current.approved,
            approvedGrowth: getGrowth(current.approved, previous.approved),
 
            rejected: current.rejected,
            rejectedGrowth: getGrowth(current.rejected, previous.rejected),
 
            departmentDocumentCounts: departmentStats
        };
 
        return successResponse(res, response, "Dashboard stats fetched successfully");
 
    } catch (err) {
        console.error("Dashboard Error:", err);
        return errorResponse(res, err, "Failed to fetch stats");
    }
};



export const getFileStatus = async (req, res) => {
    try {
        const user = req.user;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;
 
        const matchQuery = { entityType: "File" };
        if (user.profile_type !== "superadmin") {
            matchQuery.actorId = user._id;
        }
 
        const pipeline = [
            { $match: matchQuery },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: "$entityId",
                    latestActivity: { $first: "$$ROOT" }
                }
            },
            {
                $addFields: {
                    entityObjectId: {
                        $cond: [
                            { $eq: [{ $type: "$_id" }, "string"] },
                            { $toObjectId: "$_id" },
                            "$_id"
                        ]
                    }
                }
            }
            ,
            { $sort: { "latestActivity.createdAt": -1 } },
 
            // {
            //     $addFields: {
            //         entityObjectId: {
            //             $cond: [
            //                 { $eq: [{ $type: "$_id" }, "string"] },
            //                 { $toObjectId: "$_id" },
            //                 "$_id"
            //             ]
            //         }
            //     }
            // },
            {
                $lookup: {
                    from: "users",
                    localField: "latestActivity.actorId",
                    foreignField: "_id",
                    as: "actor"
                }
            },
            { $unwind: { path: "$actor", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "files",
                    localField: "entityObjectId",
                    foreignField: "_id",
                    as: "file"
                }
            },
            { $unwind: "$file" },
            { $skip: skip },
            { $limit: limit },
 
            {
                $project: {
                    _id: 1,
                    latestActivity: 1,
                    actor: { _id: 1, name: 1, email: 1 },
                    file: { originalName: 1, fileSize: 1, s3Url: 1, fileType: 1 }
                }
            }
        ];
 
        const results = await ActivityLog.aggregate(pipeline);
        const countPipeline = [
            { $match: matchQuery },
            { $group: { _id: "$entityId" } },
            { $count: "total" }
        ];
        const countResult = await ActivityLog.aggregate(countPipeline);
        const totalCount = countResult?.[0]?.total || 0;
 
        const formattedFiles = results.map(item => {
            const act = item.latestActivity;
            const file = item.file;
 
            return {
                _id: item._id,
                name: file?.originalName || "Unknown File",
                fileSize: formatFileSize(file?.fileSize || 0),
                fileType: file?.fileType || "unknown",
                icon: getFileIcon(file || ""),
                status: act.action,
                lastActionTime: act.createdAt,
                performedBy: item.actor
                    ? { name: item.actor.name, email: item.actor.email }
                    : null
            };
        });
 
        return res.status(200).json({
            success: true,
            count: formattedFiles.length,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page,
            hasNextPage: page < Math.ceil(totalCount / limit),
            hasPrevPage: page > 1,
            files: formattedFiles
        });
 
    } catch (error) {
        console.error("Error fetching file activity list:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch file activity list",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};


/** Get Recent Activities */
export const getRecentActivities = async (req, res) => {
    try {
        const { limit = 5 } = req.query;
        const userId = req.user?._id;
        const profile_type = req.user?.profile_type;

        const matchQuery = {};

        // Non-superadmins only see their own activity
        if (profile_type !== "superadmin") {
            matchQuery.actorId = userId;
        }

        const activities = await ActivityLog.aggregate([
            { $match: matchQuery },

            { $sort: { updatedAt: -1 } },
            { $limit: Number(limit) },

            {
                $project: {
                    _id: 0,
                    details: 1,                // ONLY details
                    timestamp: "$updatedAt"    // ONLY updatedAt
                }
            }
        ]);

        res.status(200).json({ recentActivities: activities });
    } catch (error) {
        console.error("Error fetching recent activities:", error);
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};



/**
 * Get Donor & Vendor Project Summary
 * @route GET /api/dashboard/donor-vendor-projects
 * @query donorId, vendorId, period (today|week|month|year)
 */
export const getDonorVendorProjects = async (req, res) => {
    try {
        const { donorId, vendorId, period } = req.query;

        // ---------- DATE FILTER ----------
        const dateFilter = {};
        const now = new Date();

        if (period === "today") {
            dateFilter.projectStartDate = {
                $gte: new Date(now.setHours(0, 0, 0, 0)),
                $lte: new Date(now.setHours(23, 59, 59, 999)),
            };
        } else if (period === "week") {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            dateFilter.projectStartDate = { $gte: startOfWeek };
        } else if (period === "month") {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFilter.projectStartDate = { $gte: startOfMonth };
        }

        // ---------- BASE QUERY ----------
        const baseQuery = { isActive: true, ...dateFilter };
        if (donorId) baseQuery.donor = donorId;
        if (vendorId) baseQuery.vendor = vendorId;

        // ---------- FETCH ALL PROJECT TYPES ----------
        const projectTypes = await ProjectType.find({ isActive: true }).select("name");

        // ---------- AGGREGATE PROJECT COUNTS ----------
        const results = await Promise.all(
            projectTypes.map(async (type) => {
                // find all projects of this type
                const projects = await Project.find({
                    ...baseQuery,
                    projectType: type._id,
                }).select("donor vendor");

                // count unique donors & vendors across projects
                const donorsSet = new Set();
                const vendorsSet = new Set();

                projects.forEach((p) => {
                    p.donor?.forEach((d) => donorsSet.add(d.toString()));
                    p.vendor?.forEach((v) => vendorsSet.add(v.toString()));
                });

                return {
                    projectType: type.name,
                    totalProjects: projects.length,
                    donorCount: donorsSet.size,
                    vendorCount: vendorsSet.size,
                };
            })
        );

        res.json({ success: true, data: results });
    } catch (error) {
        console.error("Error fetching donor/vendor data:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


export const getDepartmentDocumentUploads = async (req, res) => {
    try {
        const { period = "month", projectId } = req.query;
        const user = req.user;
        const userId = user?._id;

        // Validate period
        if (!FILTER_PERIODS.includes(period)) {
            return failResponse(res, "Invalid period. Must be today, week, month, or year", 400);
        }

        const startDate = calculateStartDate(period);

        // Base match filter
        let matchStage = {
            createdAt: { $gte: startDate },
            isDeleted: false,
            department: { $exists: true, $ne: null },
        };

        // Restrict visibility: only owner for non-superadmins
        if (user.profile_type !== "superadmin") {
            matchStage.owner = new mongoose.Types.ObjectId(userId);
        }
        // Apply session + query filters
        matchStage = applyFilters(req, matchStage);
        if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
            matchStage.project = new mongoose.Types.ObjectId(projectId);
        }
        const pipeline = [
            { $match: matchStage },

            // Lookup department name
            {
                $lookup: {
                    from: "departments",
                    localField: "department",
                    foreignField: "_id",
                    as: "dept",
                    pipeline: [{ $project: { name: 1 } }]
                }
            },

            { $unwind: { path: "$dept", preserveNullAndEmptyArrays: false } },

            // Group by department
            {
                $group: {
                    _id: {
                        departmentId: "$department",
                        departmentName: "$dept.name"
                    },
                    documentCount: { $sum: 1 }
                }
            },

            // Compute total and percentage
            {
                $group: {
                    _id: null,
                    totalDocuments: { $sum: "$documentCount" },
                    departments: {
                        $push: {
                            departmentId: "$_id.departmentId",
                            departmentName: "$_id.departmentName",
                            documentCount: "$documentCount"
                        }
                    }
                }
            },

            { $unwind: "$departments" },

            {
                $addFields: {
                    percentage: {
                        $cond: [
                            { $gt: ["$totalDocuments", 0] },
                            {
                                $round: [
                                    {
                                        $multiply: [
                                            { $divide: ["$departments.documentCount", "$totalDocuments"] },
                                            100
                                        ]
                                    },
                                    2
                                ]
                            },
                            0
                        ]
                    }
                }
            },

            {
                $project: {
                    _id: 0,
                    departmentId: "$departments.departmentId",
                    departmentName: "$departments.departmentName",
                    documentCount: "$departments.documentCount",
                    percentage: 1
                }
            },

            { $sort: { documentCount: -1 } },
            { $limit: 10 }
        ];

        const result = await Document.aggregate(pipeline);

        return successResponse(
            res,
            {
                period,
                startDate,
                projectId: projectId || applyFilters.projectId || null,
                departmentUploads: result,
            },
            "Department document uploads fetched successfully"
        );
    } catch (err) {
        console.error("Error in getDepartmentDocumentUploads:", err);
        return errorResponse(res, err);
    }
};

export const getDepartmentDocumentChart = async (req, res) => {
    try {
        const { period = "month", departmentId } = req.query;
        const user = req.user;
        const userId = user?._id;

        if (!FILTER_PERIODS.includes(period)) {
            return res.status(400).json({ success: false, message: "Invalid period" });
        }

        const startDate = calculateStartDate(period);

        let filter = { createdAt: { $gte: startDate }, isDeleted: false };

        // Restrict non-superadmins
        if (user.profile_type !== "superadmin") filter.owner = userId;

        // Apply session filters
        filter = applyFilters(req, filter);

        // Apply department filter
        if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
            filter.department = new mongoose.Types.ObjectId(departmentId);
        }

        const documents = await Document.find(filter).select("createdAt status").lean();

        const monthsData = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1, Draft: 0, Pending: 0, Approved: 0, Rejected: 0, total: 0
        }));

        documents.forEach(doc => {
            const month = doc.createdAt.getMonth() + 1;
            const status = doc.status || "Draft";
            const monthData = monthsData.find(m => m.month === month);
            monthData[status] = (monthData[status] || 0) + 1;
            monthData.total += 1;
        });

        return res.json({
            success: true,
            period,
            projectId: filter.projectId || null,
            startDate,
            monthlyStatusCounts: monthsData
        });

    } catch (err) {
        console.error("Error in getDepartmentDocumentChart:", err);
        return res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
};

export const getDocumentsTypeUploads = async (req, res) => {
    try {
        const { period = "month", projectId, departmentId, uploadedBy } = req.query;
        const user = req.user;
        const userId = user?._id;

        if (!FILTER_PERIODS.includes(period)) {
            return failResponse(res, "Invalid period. Must be today, week, month, or year", 400);
        }

        const startDate = calculateStartDate(period);

        let matchStage = { uploadedAt: { $gte: startDate }, status: "active" };

        if (user.profile_type !== "superadmin") {
            matchStage.uploadedBy = userId;
        }

        // Apply session filters
        matchStage = applyFilters(req, matchStage);

        // Override with query parameters if provided
        if (projectId && mongoose.Types.ObjectId.isValid(projectId)) matchStage.projectId = new mongoose.Types.ObjectId(projectId);
        if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) matchStage.departmentId = new mongoose.Types.ObjectId(departmentId);
        if (uploadedBy && user.profile_type === "superadmin") matchStage.uploadedBy = new mongoose.Types.ObjectId(uploadedBy);

        const pipeline = [
            { $match: matchStage },
            { $addFields: { checkString: { $concat: ["$fileType", " ", "$originalName"] } } },
            {
                $addFields: {
                    category: {
                        $switch: {
                            branches: [
                                { case: { $regexMatch: { input: "$checkString", regex: /pdf/i } }, then: "PDF" },
                                { case: { $regexMatch: { input: "$checkString", regex: /xls|xlsx|excel/i } }, then: "Excel" },
                                { case: { $regexMatch: { input: "$checkString", regex: /doc|docx|word/i } }, then: "Word" },
                                { case: { $regexMatch: { input: "$checkString", regex: /jpg|jpeg|png|image/i } }, then: "Image" },
                                { case: { $regexMatch: { input: "$checkString", regex: /ppt|powerpoint/i } }, then: "PowerPoint" },
                                { case: { $regexMatch: { input: "$checkString", regex: /csv|txt|text/i } }, then: "Text/CSV" }
                            ],
                            default: "Other"
                        }
                    }
                }
            },

            { $group: { _id: "$category", count: { $sum: 1 }, totalSize: { $sum: "$fileSize" } } },
            { $group: { _id: null, totalFiles: { $sum: "$count" }, totalSize: { $sum: "$totalSize" }, types: { $push: { type: "$_id", count: "$count", totalSize: "$totalSize" } } } },
            { $unwind: "$types" },
            {
                $addFields: {
                    "types.percentage": { $cond: [{ $gt: ["$totalFiles", 0] }, { $round: [{ $multiply: [{ $divide: ["$types.count", "$totalFiles"] }, 100] }, 2] }, 0] },
                    "types.sizePercentage": { $cond: [{ $gt: ["$totalSize", 0] }, { $round: [{ $multiply: [{ $divide: ["$types.totalSize", "$totalSize"] }, 100] }, 2] }, 0] }
                }
            },
            { $project: { _id: 0, totalFiles: 1, type: "$types.type", count: "$types.count", percentage: "$types.percentage", totalSizeMB: { $round: [{ $divide: ["$types.totalSize", 1048576] }, 2] }, sizePercentage: "$types.sizePercentage" } },
            { $sort: { count: -1 } }
        ];

        const result = await File.aggregate(pipeline);

        return successResponse(res, {
            period,
            startDate,
            projectId: projectId || req.session.selectedProjectId || null,
            departmentId: departmentId || null,
            uploadedBy: uploadedBy || null,
            fileTypeBreakdown: result
        }, "Project file type uploads fetched successfully");

    } catch (err) {
        console.error("Error in getDocumentsTypeUploads:", err);
        return errorResponse(res, err);
    }
};


// ------------------- Documents Summary -------------------
export const getDocumentsStatusSummary = async (req, res) => {
    try {
        const { period = "month", department, docType } = req.query;
        const { selectedProjectId, selectedYear } = getSessionFilters(req);
        const projectId = selectedProjectId;
        const year = Number(selectedYear);

        // Validate period
        if (!FILTER_PERIODS.includes(period)) {
            return failResponse(res, "Invalid period. Must be today, week, month, or year", 400);
        }

        const startDate = calculateStartDate(period);

        // Base match query
        const match = {
            isDeleted: false,
        };

        // Project filter
        if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
            match.project = new mongoose.Types.ObjectId(projectId);
        }

        // Department filter
        if (department && mongoose.Types.ObjectId.isValid(department)) {
            match.department = new mongoose.Types.ObjectId(department);
        }

        // DocType filter
        if (docType) match.docType = docType;

        // Year filter (takes precedence)
        if (year && !isNaN(year)) {
            const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
            const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);
            match.createdAt = { $gte: yearStart, $lt: yearEnd };
        } else {
            match.createdAt = { $gte: startDate };
        }

        // Define grouping logic based on period
        let dateGroup = null;
        let categories = [];

        switch (period) {
            case "today":
                dateGroup = { $hour: "$createdAt" };
                categories = Array.from({ length: 24 }, (_, i) => `${i}:00`);
                break;
            case "week":
                dateGroup = { $dayOfWeek: "$createdAt" };
                categories = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                break;
            case "month":
                dateGroup = { $dayOfMonth: "$createdAt" };
                const now = new Date();
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                categories = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
                break;
            case "year":
                dateGroup = { $month: "$createdAt" };
                categories = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                break;
        }

        const pipeline = [
            { $match: match },
            {
                $group: {
                    _id: {
                        period: dateGroup,
                        status: "$status",
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { "_id.period": 1 } }
        ];

        const results = await Document.aggregate(pipeline);

        // Build chart data
        const statuses = ["Draft", "Pending", "Approved", "Rejected"];
        const series = statuses.map(status => ({
            name: status,
            data: Array(categories.length).fill(0),
        }));

        results.forEach(item => {
            const idx = (item._id.period || 1) - 1;
            const seriesItem = series.find(s => s.name === item._id.status);
            if (seriesItem && idx >= 0 && idx < seriesItem.data.length) {
                seriesItem.data[idx] += item.count;
            }
        });

        return successResponse(
            res,
            {
                categories,
                series,
                year: year || null,
                projectId: projectId || null,
            },
            "Document status summary fetched successfully"
        );

    } catch (err) {
        console.error("Error in getDocumentsStatusSummary:", err);
        return errorResponse(res, err);
    }
};
//Analytics page
// export const getAnalyticsStats = async (req, res) => {
//     try {
//         const { selectedYear, selectedProjectId } = getSessionFilters(req);
//         const user = req.user;
//         const isSuperAdmin = req.session?.user?.profile_type === "superadmin";

//         const year = selectedYear ? Number(selectedYear) : new Date().getFullYear();

//         const currentStart = new Date(year, 0, 1);
//         const currentEnd = new Date(year, 11, 31, 23, 59, 59);
//         const prevStart = new Date(year - 1, 0, 1);
//         const prevEnd = new Date(year - 1, 11, 31, 23, 59, 59);

//         const baseFilter = {
//             isDeleted: false,
//             isArchived: false
//         };

//         if (!isSuperAdmin) baseFilter.owner = user._id;
//         if (selectedProjectId) baseFilter.project = selectedProjectId;

//         const currentFilter = {
//             ...baseFilter,
//             createdAt: { $gte: currentStart, $lte: currentEnd }
//         };

//         const previousFilter = {
//             ...baseFilter,
//             createdAt: { $gte: prevStart, $lte: prevEnd }
//         };

//         // Yearly totals
//         const totalCurrent = await Document.countDocuments(currentFilter);
//         const totalPrevious = await Document.countDocuments(previousFilter);

//         // ---------- MONTHLY COMPARISON ----------
//         const now = new Date();

//         // Current month
//         const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
//         const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

//         const uploadedThisMonth = await Document.countDocuments({
//             ...baseFilter,
//             createdAt: { $gte: startOfMonth, $lte: endOfMonth }
//         });

//         // Previous month
//         const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
//         const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

//         const uploadedLastMonth = await Document.countDocuments({
//             ...baseFilter,
//             createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd }
//         });

//         const uploadedThisMonthGrowth = getGrowth(uploadedThisMonth, uploadedLastMonth);

//         // Modified documents (year)
//         const modifiedCurrent = await Document.countDocuments({
//             ...currentFilter,
//             currentVersionNumber: { $gt: mongoose.Types.Decimal128.fromString("1.0") }
//         });

//         const modifiedPrevious = await Document.countDocuments({
//             ...previousFilter,
//             currentVersionNumber: { $gt: mongoose.Types.Decimal128.fromString("1.0") }
//         });

//         // Deleted or archived (year)
//         const deletedOrArchivedCurrent = await Document.countDocuments({
//             ...(isSuperAdmin ? {} : { owner: user._id }),
//             ...(selectedProjectId && { project: selectedProjectId }),
//             createdAt: { $gte: currentStart, $lte: currentEnd },
//             $or: [{ isDeleted: true }, { isArchived: true }],
//         });

//         const deletedOrArchivedPrevious = await Document.countDocuments({
//             ...(isSuperAdmin ? {} : { owner: user._id }),
//             ...(selectedProjectId && { project: selectedProjectId }),
//             createdAt: { $gte: prevStart, $lte: prevEnd },
//             $or: [{ isDeleted: true }, { isArchived: true }],
//         });

//         return res.status(200).json({
//             success: true,
//             data: {
//                 selectedYear: year,

//                 totalDocuments: totalCurrent,
//                 totalDocumentsGrowth: getGrowth(totalCurrent, totalPrevious),

//                 uploadedThisMonth,
//                 uploadedThisMonthGrowth,     // <-- NEW

//                 modifiedDocuments: modifiedCurrent,
//                 modifiedDocumentsGrowth: getGrowth(modifiedCurrent, modifiedPrevious),

//                 deletedOrArchived: deletedOrArchivedCurrent,
//                 deletedOrArchivedGrowth: getGrowth(deletedOrArchivedCurrent, deletedOrArchivedPrevious),

//                 filters: { selectedYear, selectedProjectId },
//             },
//         });

//     } catch (err) {
//         console.error("Error fetching document stats:", err);
//         return res.status(500).json({
//             success: false,
//             message: "Server error",
//             error: err.message,
//         });
//     }
// };
export const getAnalyticsStats = async (req, res) => {
    try {
        const { selectedYear, selectedProjectId } = getSessionFilters(req);
        const user = req.user;
        const isSuperAdmin = req.session?.user?.profile_type === "superadmin";

        const year = selectedYear ? Number(selectedYear) : null;

        const baseFilter = {
            isDeleted: false,
            isArchived: false
        };

        if (!isSuperAdmin) baseFilter.owner = user._id;
        if (selectedProjectId) baseFilter.project = selectedProjectId;

        let currentFilter = { ...baseFilter };
        let previousFilter = { ...baseFilter };

        let currentStart, currentEnd, prevStart, prevEnd;

        // Apply year filter only if year exists
        if (year) {
            currentStart = new Date(year, 0, 1);
            currentEnd = new Date(year, 11, 31, 23, 59, 59);

            prevStart = new Date(year - 1, 0, 1);
            prevEnd = new Date(year - 1, 11, 31, 23, 59, 59);

            currentFilter.createdAt = { $gte: currentStart, $lte: currentEnd };
            previousFilter.createdAt = { $gte: prevStart, $lte: prevEnd };
        }

        // ---------- YEARLY TOTALS ----------
        const totalCurrent = await Document.countDocuments(currentFilter);
        const totalPrevious = year
            ? await Document.countDocuments(previousFilter)
            : 0;

        // ---------- MONTHLY COMPARISON ----------
        const now = new Date();

        const startOfMonth = new Date(
            now.getFullYear(),
            now.getMonth(),
            1,
            0,
            0,
            0,
            0
        );

        const endOfMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23,
            59,
            59,
            999
        );

        const uploadedThisMonth = await Document.countDocuments({
            ...baseFilter,
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        });

        const prevMonthStart = new Date(
            now.getFullYear(),
            now.getMonth() - 1,
            1,
            0,
            0,
            0,
            0
        );

        const prevMonthEnd = new Date(
            now.getFullYear(),
            now.getMonth(),
            0,
            23,
            59,
            59,
            999
        );

        const uploadedLastMonth = await Document.countDocuments({
            ...baseFilter,
            createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd }
        });

        const uploadedThisMonthGrowth = getGrowth(
            uploadedThisMonth,
            uploadedLastMonth
        );

        // ---------- MODIFIED DOCUMENTS ----------
        const modifiedCurrent = await Document.countDocuments({
            ...currentFilter,
            currentVersionNumber: { $gt: 1 }
        });

        const modifiedPrevious = year
            ? await Document.countDocuments({
                  ...previousFilter,
                  currentVersionNumber: { $gt: 1 }
              })
            : 0;

        // ---------- DELETED / ARCHIVED ----------
        let deletedCurrentFilter = {
            ...(isSuperAdmin ? {} : { owner: user._id }),
            ...(selectedProjectId && { project: selectedProjectId }),
            $or: [{ isDeleted: true }, { isArchived: true }]
        };

        let deletedPreviousFilter = {
            ...(isSuperAdmin ? {} : { owner: user._id }),
            ...(selectedProjectId && { project: selectedProjectId }),
            $or: [{ isDeleted: true }, { isArchived: true }]
        };

        if (year) {
            deletedCurrentFilter.createdAt = {
                $gte: currentStart,
                $lte: currentEnd
            };

            deletedPreviousFilter.createdAt = {
                $gte: prevStart,
                $lte: prevEnd
            };
        }

        const deletedOrArchivedCurrent =
            await Document.countDocuments(deletedCurrentFilter);

        const deletedOrArchivedPrevious = year
            ? await Document.countDocuments(deletedPreviousFilter)
            : 0;

        // ---------- RESPONSE ----------
        return res.status(200).json({
            success: true,
            data: {
                selectedYear: year || "All",

                totalDocuments: totalCurrent,
                totalDocumentsGrowth: year
                    ? getGrowth(totalCurrent, totalPrevious)
                    : 0,

                uploadedThisMonth,
                uploadedThisMonthGrowth,

                modifiedDocuments: modifiedCurrent,
                modifiedDocumentsGrowth: year
                    ? getGrowth(modifiedCurrent, modifiedPrevious)
                    : 0,

                deletedOrArchived: deletedOrArchivedCurrent,
                deletedOrArchivedGrowth: year
                    ? getGrowth(
                          deletedOrArchivedCurrent,
                          deletedOrArchivedPrevious
                      )
                    : 0,

                filters: { selectedYear, selectedProjectId }
            }
        });
    } catch (err) {
        console.error("Error fetching document stats:", err);

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


const DEFAULT_MEDIA_CATEGORY = "Media";
export const getDepartmentFileUsage = async (req, res) => {
    try {
        const user = req.user;
        const { selectedYear, selectedProjectId } = getSessionFilters(req);

        const departments = await Department.find({ status: "Active" }).sort({ priority: 1 });
        const departmentNames = departments.map(dep => dep.name);
        const deptIndexMap = Object.fromEntries(departmentNames.map((name, i) => [name, i]));

        const fileTypeCounts = {
            Word: Array(departmentNames.length).fill(0),
            Excel: Array(departmentNames.length).fill(0),
            PPT: Array(departmentNames.length).fill(0),
            PDF: Array(departmentNames.length).fill(0),
            Media: Array(departmentNames.length).fill(0)
        };

        // ---- BASE QUERY ----
        const fileQuery = { status: "active" };

        // Restrict non-admin users
        if (user.profile_type !== "superadmin") {
            fileQuery.uploadedBy = user._id;
        }

        // Filter by project
        if (selectedProjectId) {
            fileQuery.projectId = selectedProjectId;
        }

        // Filter by uploaded year
        if (selectedYear) {
            fileQuery.uploadedAt = {
                $gte: new Date(`${selectedYear}-01-01T00:00:00Z`),
                $lte: new Date(`${selectedYear}-12-31T23:59:59Z`)
            };
        }

        const files = await File.find(fileQuery).populate("departmentId", "name");

        const getCategory = (ext) => {
            if (!ext) return DEFAULT_MEDIA_CATEGORY;
            ext = ext.toLowerCase();

            if (FILE_TYPE_CATEGORIES.word.includes(ext)) return "Word";
            if (FILE_TYPE_CATEGORIES.excel.includes(ext)) return "Excel";
            if (FILE_TYPE_CATEGORIES.ppt.includes(ext)) return "PPT";
            if (FILE_TYPE_CATEGORIES.pdf.includes(ext)) return "PDF";
            if (FILE_TYPE_CATEGORIES.media.includes(ext)) return "Media";
            return DEFAULT_MEDIA_CATEGORY;
        };

        for (const file of files) {
            if (!file.departmentId?.name) continue;

            const deptIndex = deptIndexMap[file.departmentId.name];
            if (deptIndex === undefined) continue;

            const ext = (file.originalName?.split(".").pop() || "").toLowerCase();
            const category = getCategory(ext);

            fileTypeCounts[category][deptIndex]++;
        }

        res.status(200).json({
            categories: departmentNames,
            series: [
                { name: "Word", data: fileTypeCounts.Word },
                { name: "Excel", data: fileTypeCounts.Excel },
                { name: "PPT", data: fileTypeCounts.PPT },
                { name: "PDF", data: fileTypeCounts.PDF },
                { name: "Media", data: fileTypeCounts.Media }
            ]
        });

    } catch (err) {
        console.error("Error fetching file usage:", err);
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};