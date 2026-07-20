import mongoose from "mongoose";
const { isValidObjectId, Types } = mongoose;
import { successResponse, failResponse, errorResponse } from "../utils/responseHandler.js";
import Department from "../models/Departments.js";
import User from "../models/User.js";
import Project, { ProjectType } from "../models/Project.js";
import { normalizeToArray, validateObjectIdArray } from "../helper/ValidateObjectId.js";
import logger from "../utils/logger.js";
import { parseDateDDMMYYYY } from "../utils/formatDate.js";
import { renderProjectDetails } from "../utils/renderProjectDetails.js";
import { activityLogger } from "../helper/activityLogger.js";
import { addNotification } from "./NotificationController.js";
import File from "../models/File.js";
import Folder from "../models/Folder.js";
//Page controllers

const extractApprovalAuthority = (body) => {
    let aa = [];

    // Case 1: approvalAuthority is JSON array
    if (Array.isArray(body.approvalAuthority)) {
        aa = body.approvalAuthority;
    }
    else {
        // Case 2: approvalAuthority[x][field]
        const aaEntries = Object.keys(body).filter(k =>
            k.startsWith("approvalAuthority[")
        );

        if (aaEntries.length > 0) {
            const map = {};

            aaEntries.forEach(key => {
                const match = key.match(/approvalAuthority\[(\d+)\]\[(\w+)\]/);
                if (match) {
                    const [, index, field] = match;
                    if (!map[index]) map[index] = {};
                    map[index][field] = body[key];
                }
            });

            aa = Object.values(map);
        }
    }

    // Clean & validate
    aa = aa
        .map(a => ({
            userId: isValidObjectId(a.userId) ? new mongoose.Types.ObjectId(a.userId) : null,
            designation: isValidObjectId(a.designation) ? new mongoose.Types.ObjectId(a.designation) : null,
            priority: Number(a.priority),
            status: a.status || "Pending"
        }))
        .filter(a => a.userId && a.designation);

    // --- Prevent duplicates ---
    const userSet = new Set();
    const prioritySet = new Set();

    for (const entry of aa) {
        if (userSet.has(entry.userId.toString())) {
            throw new Error("Duplicate approvalAuthority found");
        }
        if (prioritySet.has(entry.priority)) {
            throw new Error("Duplicate approvalAuthority priority found");
        }

        userSet.add(entry.userId.toString());
        prioritySet.add(entry.priority);
    }

    return aa;
};


// Show Add Project Type Page
export const showProjectTypePage = (req, res) => {
    try {
        res.render("pages/projects/projectTypes", {
            pageTitle: "Add Project Type",
            pageDescription: "Create a new project type and manage project structure.",
            metaKeywords: "add project type, create project type, project categories",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            projectType: null
        });
    } catch (err) {
        logger.error("Add Project Type render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load the add project type page.",
            metaKeywords: "error, project type error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load add project type page"
        });
    }
};


// Edit Project Type Page
export const showProjectTypeEditPage = async (req, res) => {
    try {
        const projectType = await ProjectType.findById(req.params.id);
        if (!projectType) return res.redirect("/projectTypes/list");

        res.render("pages/projects/projectTypes", {
            pageTitle: "Edit Project Type",
            pageDescription: "Update project type",
            metaKeywords: "edit project type, update project type, project categories",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            projectType
        });
    } catch (err) {
        logger.error("Error loading project type edit page:", err);
        res.redirect("/projects/types/list");
    }
};
// Project Types List Page
export const showProjectTypesListPage = (req, res) => {
    try {
        res.render("pages/projects/projectTypes-list", {
            pageTitle: "Project Types List",
            title: "Project Types List",
            pageDescription: "View and manage all project types within your workspace.",
            metaKeywords: "project types list, project type management",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user
        });
    } catch (err) {
        logger.error("Project Types list render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load the project types list.",
            metaKeywords: "error, project type list error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load project types list"
        });
    }
};


// Projects List page
export const showProjectListPage = async (req, res) => {
    try {
        const designations = await Designation.find({ status: "Active" })
            .sort({ name: 1 })
            .lean();

        res.locals.pageTitle = "Projects List";
        res.locals.pageDescription = "View and manage all projects in your workspace.";
        res.locals.metaKeywords = "projects, project management, workspace, file management";
        res.locals.canonicalUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

        res.render("pages/projects/projectList", {
            designations,
            user: req.user
        });

    } catch (err) {
        logger.error("Error loading project list:", err);

        res.locals.pageTitle = "Error";
        res.locals.pageDescription = "Unable to load the project list.";
        res.locals.metaKeywords = "projects error, project list error";
        res.locals.canonicalUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

        res.status(500).render("pages/error", {
            message: "Unable to load project list",
            user: req.user
        });
    }
};
// Project details (new)
export const showNewProjectDetails = async (req, res) => {
    await renderProjectDetails(req, res, null, {
        pageTitle: "New Project Details",
        pageDescription: "Create and configure a new project in your workspace.",
        metaKeywords: "new project, project creation, project details",
    });
};

export const showExistingProjectDetails = async (req, res) => {
    await renderProjectDetails(req, res, req.params.id, {
        pageTitle: "Project Details",
        pageDescription: "View and manage details of the selected project.",
        metaKeywords: "project details, project management, workspace projects",
    });
};

// Main Projects page
export const showMainProjectsPage = async (req, res) => {
    try {
        const projectId = req.query.id || null;
        res.locals.pageTitle = "Projects";
        res.locals.pageDescription = "Browse and manage all projects in your workspace.";
        res.locals.metaKeywords = "projects, project list, workspace projects";
        res.locals.canonicalUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
        res.render("pages/projects/projects", {
            user: req.user,
            projectId: projectId,
            messages: req.flash()
        });
    } catch (err) {
        logger.error("Error loading projects page:", err);

        res.locals.pageTitle = "Error";
        res.locals.pageDescription = "Unable to load projects page.";
        res.locals.metaKeywords = "projects error, page load error";
        res.locals.canonicalUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

        res.render("pages/projects/projects", {
            user: req.user,
            messages: { error: "Unable to load projects" },
            projects: []
        });
    }
};

//API controllers

/**
 * GET ALL Project Types
 */
export const getProjectTypes = async (req, res) => {
    try {
        const projectTypes = await ProjectType.find({ isActive: true })
            .populate("addedBy", "name email")
            .populate("updatedBy", "name email")
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            data: projectTypes
        });
    } catch (error) {
        console.error("Error fetching project types:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * CREATE Project Type
 */
export const createProjectType = async (req, res) => {
    try {
        const newProjectType = await ProjectType.create({
            ...req.body,
            addedBy: req.user._id,
            updatedBy: req.user._id
        });

        return res.status(201).json({
            success: true,
            message: "Project Type added successfully!",
            data: newProjectType
        });

    } catch (error) {

        // DUPLICATE KEY ERROR (MongoDB 11000)
        if (error.code === 11000) {
            const duplicateField = Object.keys(error.keyValue)[0];

            return res.status(400).json({
                success: false,
                message: `A project type with this ${duplicateField} already exists.`,
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message || "Failed to create project type"
        });
    }
};


/**
 * UPDATE Project Type
 */
export const updateProjectType = async (req, res) => {
    try {
        req.body.updatedBy = req.user._id;

        const updatedProjectType = await ProjectType.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!updatedProjectType) {
            return res.status(404).json({
                success: false,
                message: "Project Type not found"
            });
        }

        return res.json({
            success: true,
            message: "Project Type updated successfully!",
            data: updatedProjectType
        });

    } catch (error) {

        // DUPLICATE KEY ERROR (MongoDB 11000)
        if (error.code === 11000) {
            const duplicateField = Object.keys(error.keyValue)[0];

            return res.status(400).json({
                success: false,
                message: `A project type with this ${duplicateField} already exists.`,
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message || "Failed to update"
        });
    }
};

/**
 * DELETE Project Type
 */
export const deleteProjectType = async (req, res) => {
    try {
        const deleted = await ProjectType.findByIdAndUpdate(
            req.params.id,
            { isActive: false, UpdatedBy: req.user._id },
            { new: true }
        );

        if (!deleted)
            return res.status(404).json({ success: false, message: "Project Type not found" });

        return res.json({
            success: true,
            message: "Project Type disabled successfully",
            data: deleted
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const createProject = async (req, res) => {
    try {
        const body = req.body;
        const user = req.user;

        const requiredFields = [
            "projectName",
            "projectCode",
            "projectManager",
            "projectStartDate",
            "projectEndDate",
            "projectType"
        ];

        // Required fields check
        for (const field of requiredFields) {
            if (!body[field]) {
                return failResponse(res, `Missing required field: ${field}`, 400);
            }
        }

        // Normalize array fields
        body.projectManager = normalizeToArray(body.projectManager);
        body.donor = normalizeToArray(body.donor);
        body.vendor = normalizeToArray(body.vendor);
        body.projectCollaborationTeam = normalizeToArray(body.projectCollaborationTeam);

        // Validate single ObjectId
        if (!isValidObjectId(body.projectType)) {
            return failResponse(res, "Invalid projectType ID", 400);
        }

        // Validate array ObjectIds
        const arrayFields = ["projectManager", "projectCollaborationTeam", "donor", "vendor"];
        for (const field of arrayFields) {
            if (!validateObjectIdArray(body[field], field)) {
                return failResponse(res, `Invalid ID in ${field}`, 400);
            }
        }

        // Validate dates
        const startDate = parseDateDDMMYYYY(body.projectStartDate);
        const endDate = parseDateDDMMYYYY(body.projectEndDate);
        if (!startDate || !endDate)
            return failResponse(res, "Invalid date format", 400);

        if (endDate <= startDate)
            return failResponse(res, "End date must be after start date", 400);

        // Unique project code
        const existingProject = await Project.findOne({
            projectCode: body.projectCode.trim().toUpperCase()
        });
        if (existingProject)
            return failResponse(res, "Project code already exists", 400);

        // --- Extract & Validate approvalAuthority ---
        let approvalAuthority = [];
        try {
            approvalAuthority = extractApprovalAuthority(body);
        } catch (e) {
            return failResponse(res, e.message, 400);
        }

        const projectData = {
            projectName: body.projectName.trim(),
            projectCode: body.projectCode.trim().toUpperCase(),
            projectType: new mongoose.Types.ObjectId(body.projectType),
            addedBy: user._id,
            projectDescription: body.projectDescription?.trim() || "",
            projectManager: body.projectManager.map(id => new mongoose.Types.ObjectId(id)),
            projectCollaborationTeam: body.projectCollaborationTeam || [],
            donor: body.donor || [],
            vendor: body.vendor || [],
            projectStartDate: startDate,
            projectEndDate: endDate,
            projectDuration: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)),
            projectStatus: body.projectStatus || "Active",
            tags: body.tags?.map(tag => tag.trim().toLowerCase()) || [],
            isActive: body.isActive !== undefined ? body.isActive : true,
            approvalAuthority,
            createdBy: user._id
        };

        if (req.file?.location) {
            projectData.projectLogo = req.file.location;
        }

        const project = await Project.create(projectData);

        await activityLogger({
            actorId: user._id,
            entityId: project._id,
            entityType: "Project",
            action: "CREATE",
            details: `Project '${project.projectName}' created by ${user.name}`
        });
        // ---------------------------------------------
        // SEND NOTIFICATIONS TO USERS BY ROLE
        // ---------------------------------------------

        const sendRoleNotification = async (recipientList, roleName) => {
            for (const recipient of recipientList) {
                await addNotification({
                    recipient,
                    sender: user._id,
                    type: "project_assigned",
                    title: `${roleName} Assignment`,
                    message: `You have been added as a ${roleName} in project "${project.projectName}".`,
                    relatedProject: project._id,
                    priority: "medium",
                    actionUrl: `/projects/${project._id}`
                });
            }
        };

        // Notify Managers
        await sendRoleNotification(projectData.projectManager, "Project Manager");
        // Notify Collaboration Team
        if (projectData.projectCollaborationTeam?.length > 0)
            await sendRoleNotification(projectData.projectCollaborationTeam, "Project Collaboration Team");

        return successResponse(res, project, "Project created successfully", 201);

    } catch (err) {
        console.error("Error creating project:", err);
        return errorResponse(res, err);
    }
};


// Get all projects with search
export const getAllProjects = async (req, res) => {
    try {
        const { search, page = 1, limit: limitParam } = req.query;
        const userId = req.user?._id;
        const profileType = req.user?.profile_type;

        let query = {};

        if (search) {
            query.projectName = { $regex: new RegExp(search, "i") };
        }

        if (profileType === "donor") {
            query.donor = userId;
        }

        if (profileType === "vendor") {
            query.vendor = userId;
        }

        const limit = limitParam ? parseInt(limitParam, 10) : (search ? 0 : 10);
        const skip = limit > 0 ? (parseInt(page, 10) - 1) * limit : 0;

        const projectsQuery = Project.find(query, { _id: 1, projectName: 1 })
            .sort({ projectName: 1 });

        if (limit > 0) {
            projectsQuery.skip(skip).limit(limit);
        }

        const projects = await projectsQuery.lean();

        return successResponse(res, projects, "Projects fetched successfully");
    } catch (err) {
        logger.error("Error fetching projects:", err);
        return errorResponse(res, err, "Failed to fetch projects");
    }
};

// Get a single project by ID
export const getProject = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.findById(id)
            .populate("projectManager", "name")
            .populate("projectCollaborationTeam", "name")
            .populate("donor", "name")
            .populate("vendor", "name")
            .populate("projectType", "name")
            .lean();

        if (!project) {
            return failResponse(res, "Project not found", 404);
        }

        return successResponse(res, project, "Project fetched successfully");
    } catch (err) {
        return errorResponse(res, err, "Failed to fetch project");
    }
};

export const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body;

        const project = await Project.findById(id);
        if (!project) return failResponse(res, "Project not found", 404);

        // Permission check
        if (
            ["user"].includes(req.user.profile_type) &&
            !project.canManage(req.user._id)
        ) {
            return failResponse(res, "Unauthorized to update this project", 403);
        }

        // Convert and validate dates
        if (body.projectStartDate) {
            const d = parseDateDDMMYYYY(body.projectStartDate);
            if (!d) return failResponse(res, "Invalid start date", 400);
            body.projectStartDate = d;
        }

        if (body.projectEndDate) {
            const d = parseDateDDMMYYYY(body.projectEndDate);
            if (!d) return failResponse(res, "Invalid end date", 400);
            body.projectEndDate = d;
        }

        if (body.projectStartDate && body.projectEndDate) {
            if (body.projectEndDate <= body.projectStartDate)
                return failResponse(res, "End date must be after start date", 400);

            body.projectDuration = Math.ceil(
                (body.projectEndDate - body.projectStartDate) /
                (1000 * 60 * 60 * 24)
            );
        }

        // Validate single ObjectId
        if (body.projectType) {
            if (!isValidObjectId(body.projectType))
                return failResponse(res, "Invalid projectType ID", 400);

            body.projectType = new mongoose.Types.ObjectId(body.projectType);
        }

        // Arrays
        const arrayFields = ["projectManager", "projectCollaborationTeam", "donor", "vendor"];
        for (const field of arrayFields) {
            if (body[field]) {
                body[field] = normalizeToArray(body[field]);

                for (const v of body[field]) {
                    if (!isValidObjectId(v))
                        return failResponse(res, `Invalid ID in ${field}`, 400);
                }

                body[field] = body[field].map(v => new mongoose.Types.ObjectId(v));
            }
        }

        // --- Extract & Validate approvalAuthority ---
        if (Object.keys(body).some(k => k.startsWith("approvalAuthority"))) {
            try {
                body.approvalAuthority = extractApprovalAuthority(body);
            } catch (e) {
                return failResponse(res, e.message, 400);
            }
        }

        // Logo upload
        if (req.file?.location) {
            body.projectLogo = req.file.location;
        }

        Object.assign(project, body);
        await project.save();

        await activityLogger({
            actorId: req.user._id,
            entityId: project._id,
            entityType: "Project",
            action: "UPDATE",
            details: `Project '${project.projectName}' updated by ${req.user.name}`,
            meta: body
        });

        return successResponse(res, project, "Project updated successfully");

    } catch (err) {
        if (err.code === 11000 && err.keyPattern?.projectCode) {
            return failResponse(res, "Project code already exists", 400);
        }
        return errorResponse(res, err);
    }
};


// Delete a project by ID
export const deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.findById(id);

        if (!project) {
            return failResponse(res, "Project not found", 404);
        }

        await project.deleteOne();
        await activityLogger({
            actorId: req.user?._id || null,
            entityId: project._id,
            entityType: "Project",
            action: "DELETE",
            details: `Project '${project.projectName}' deleted`,
            meta: {}
        });

        return successResponse(res, null, "Project deleted successfully");
    } catch (err) {
        return errorResponse(res, err);
    }
};

// Update project status
export const updateProjectStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ["Planned", "Active", "OnHold", "Completed", "Cancelled"];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status value'
            });
        }

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid project ID'
            });
        }

        const project = await Project.findByIdAndUpdate(
            id,
            { projectStatus: status, updatedBy: req.user._id },
            { new: true, runValidators: true }
        ).populate('department', 'name')
            .populate('projectManager', 'name email');

        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Project status updated successfully',
            data: project
        });
    } catch (error) {
        logger.error('Error updating project status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating project status'
        });
    }
};

export const searchProjects = async (req, res) => {
    try {
        const {
            q,
            status,
            manager,
            priority,
            startDate,
            endDate,
            page = 1,
            limit = 10,
            projectId = ''
        } = req.query;

        // Build base query
        const query = { isActive: true };

        if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
            query._id = new mongoose.Types.ObjectId(projectId);
        }

        if (q) {
            query.$or = [
                { projectName: { $regex: q, $options: 'i' } },
                { projectCode: { $regex: q, $options: 'i' } },
                { projectDescription: { $regex: q, $options: 'i' } },
                { tags: { $in: [new RegExp(q, 'i')] } }
            ];
        }

        if (status) query.projectStatus = status;
        if (manager && mongoose.Types.ObjectId.isValid(manager)) {
            query.projectManager = new mongoose.Types.ObjectId(manager);
        }
        if (priority) query.priority = priority;

        if (startDate || endDate) {
            query.projectStartDate = {};
            if (startDate) query.projectStartDate.$gte = new Date(startDate);
            if (endDate) query.projectStartDate.$lte = new Date(endDate);
        }

        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            sort: { createdAt: -1 },
            select: 'projectName projectDescription projectManager projectStatus totalFiles totalTags createdAt projectCode',
            populate: [
                { path: 'projectManager', select: 'name email' }
            ]
        };

        const result = await Project.paginate(query, options);
        const projectIds = result.docs.map(p => p._id);

        let projectsWithMetrics = result.docs;

        if (projectIds.length > 0) {
            // 1. Get file sizes and counts per project
            const fileAggregation = await File.aggregate([
                {
                    $match: {
                        projectId: { $in: projectIds },
                        status: 'active'
                    }
                },
                {
                    $group: {
                        _id: '$projectId',
                        totalSize: { $sum: '$fileSize' },
                        totalFiles: { $sum: 1 }
                    }
                }
            ]);

            const fileMetricsMap = {};
            fileAggregation.forEach(item => {
                fileMetricsMap[item._id.toString()] = {
                    totalSize: item.totalSize,
                    totalFiles: item.totalFiles
                };
            });

            // 2. Get folder counts per project
            const folderAggregation = await Folder.aggregate([
                {
                    $match: {
                        projectId: { $in: projectIds },
                        isDeleted: false,
                        isArchived: false,
                        parent: { $ne: null },
                        status: 'active'
                    }
                },
                {
                    $group: {
                        _id: '$projectId',
                        totalFolders: { $sum: 1 }
                    }
                }
            ]);

            const folderMetricsMap = {};
            folderAggregation.forEach(item => {
                folderMetricsMap[item._id.toString()] = {
                    totalFolders: item.totalFolders
                };
            });

            // 3. Combine all metrics
            projectsWithMetrics = result.docs.map(project => {
                const projId = project._id.toString();
                const fileMetrics = fileMetricsMap[projId] || { totalSize: 0, totalFiles: 0 };
                const folderMetrics = folderMetricsMap[projId] || { totalFolders: 0 };

                return {
                    ...project.toObject(),
                    totalFiles: fileMetrics.totalFiles,
                    totalFolders: folderMetrics.totalFolders,
                    totalSize: fileMetrics.totalSize,
                    storageConsumed: formatTotalFileSize(fileMetrics.totalSize),
                    formattedTotalSize: formatFileSize(fileMetrics.totalSize)
                };
            });
        }

        // Update totalFiles in Project collection if needed
        for (const project of projectsWithMetrics) {
            if (project.totalFiles !== undefined) {
                await Project.findByIdAndUpdate(
                    project._id,
                    { 
                        $set: { 
                            totalFiles: project.totalFiles 
                        } 
                    },
                    { new: true }
                );
            }
        }

        res.status(200).json({
            success: true,
            query: { q, status, manager, priority, startDate, endDate, projectId },
            count: result.totalDocs,
            data: projectsWithMetrics,
            pagination: {
                page: result.page,
                limit: result.limit,
                totalPages: result.totalPages,
                totalResults: result.totalDocs
            }
        });

    } catch (error) {
        console.error('Error searching projects:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while searching projects',
            error: error.message
        });
    }
};

// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function for total file size formatting (using MB as base)
function formatTotalFileSize(bytes) {
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return bytes / 1024 < 1 ? bytes + ' B' : (bytes / 1024).toFixed(2) + ' KB';
    return mb.toFixed(2) + ' MB';
}

export const searchProjectManager = async (req, res) => {
    try {
        const { projectId } = req.query;

        if (!projectId) {
            return res.status(400).json({
                success: false,
                message: "projectId is required in query"
            });
        }

        // Fetch project with populated projectManager field
        const project = await Project.findById(projectId)
            .populate("projectManager", "name email designation") // select desired fields
            .lean();

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Project managers fetched successfully",
            data: project.projectManager
        });

    } catch (error) {
        console.error("Error searching project managers:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while searching project managers"
        });
    }
};
