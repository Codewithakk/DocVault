import mongoose from 'mongoose';
import Department from '../models/Departments.js';
import { successResponse, failResponse, errorResponse } from "../utils/responseHandler.js";
import logger from '../utils/logger.js';
import { activityLogger } from "../helper/activityLogger.js";
import Document from '../models/Document.js';
//Page Controllers

// Render Add Department page
export const showAddDepartmentPage = (req, res) => {
    try {
        res.render("pages/department/department", {
            pageTitle: "Add Department",
            pageDescription: "Create a new department and manage organizational structure.",
            metaKeywords: "add department, create department, organization structure, department management",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            department: null
        });
    } catch (err) {
        logger.error("Add department render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load the add department page.",
            metaKeywords: "error, department error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load add department page"
        });
    }
};


// Department List page
export const showDepartmentListPage = (req, res) => {
    try {
        res.render("pages/department/departments-list", {
            pageTitle: "Departments List",
            title: "Departments List",
            pageDescription: "View and manage all departments within your workspace.",
            metaKeywords: "departments list, department management, organizational units",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user
        });
    } catch (err) {
        logger.error("Department list render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load the departments list.",
            metaKeywords: "error, departments list error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load departments list"
        });
    }
};


// Edit Department page
export const showEditDepartmentPage = async (req, res) => {
    try {
        const department = await Department.findById(req.params.id).lean();
        if (!department) return res.redirect("/departments/list");

        res.render("pages/department/department", {
            title: "E-Sangrah - Edit Department",
            department,
            pageTitle: "Departments List",
            title: "Departments List",
            pageDescription: "View and manage all departments within your workspace.",
            metaKeywords: "departments list, department management, organizational units",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user
        });
    } catch (err) {
        logger.error("Department list render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load the departments.",
            metaKeywords: "error, departments list error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load departments"
        });
    }
};

//API Controllers

// Get all active departments
export const getAllDepartments = async (req, res) => {
    try {
        let filter = {};

        // non-superadmin users → only items created by them
        if (req.user.profile_type !== 'superadmin') {
            filter["addedBy.email"] = req.user.email;
        }

        const departments = await Department.find(filter)
            .select('name priority status addedBy add_date')
            .lean();

        return successResponse(res, departments, 'Departments fetched successfully');
    } catch (err) {
        return errorResponse(res, err);
    }
};

// Get all active departments
export const searchDepartments = async (req, res) => {
    try {
        const { search = '', page = 1, limit = 10 } = req.query;
        const userId = req.user?._id;
        const profileType = req.user?.profile_type;

        let query = { status: "Active" };

        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        // ---------------------------------------------------------
        // RESTRICT DEPARTMENTS FOR DONOR / VENDOR ONLY
        // ---------------------------------------------------------
        if (profileType === "donor" || profileType === "vendor") {

            const documentFilter = {
                isDeleted: false
            };

            if (profileType === "donor") {
                documentFilter.documentDonor = userId;
            }

            if (profileType === "vendor") {
                documentFilter.documentVendor = userId;
            }

            const departmentIds = await Document.distinct("department", documentFilter);

            if (departmentIds.length === 0) {
                return res.json({
                    success: true,
                    data: [],
                    pagination: { more: false }
                });
            }

            query._id = { $in: departmentIds };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [data, total] = await Promise.all([
            Department.find(query)
                .select("name priority")
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),

            Department.countDocuments(query)
        ]);

        return res.json({
            success: true,
            data,
            pagination: {
                more: skip + data.length < total
            }
        });

    } catch (err) {
        return errorResponse(res, err);
    }
};

// Get department by ID
export const getDepartmentById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return failResponse(res, 'Invalid department ID', 400);

        const department = await Department.findById(id).lean();
        if (!department) return failResponse(res, 'Department not found', 404);

        return successResponse(res, department, 'Department fetched successfully');
    } catch (err) {
        return errorResponse(res, err);
    }
};

// Create Department
export const createDepartment = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

        const { name, priority, status } = req.body;

        if (!name) return res.status(400).json({ error: 'Department name is required' });
        if (priority !== undefined && priority < 1) return res.status(400).json({ error: 'Priority must be greater than 0' });

        const departmentData = {
            name,
            priority,
            status,
            addedBy: {
                user_id: req.user._id,
                name: req.user.name,
                email: req.user.email
            }
        };

        const department = new Department(departmentData);
        await department.save();
        await activityLogger({
            actorId: req.user._id,
            entityId: department._id,
            entityType: "Department",
            action: "CREATE",
            details: `Department '${department.name}' created by ${req.user.name}`,
            meta: departmentData
        });

        res.status(200).json({ message: 'Department added successfully!' });
    } catch (err) {
        // Handle Mongoose validation errors
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ error: messages.join(', ') });
        }

        // Handle duplicate name error
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Department name already exists' });
        }

        return errorResponse(res, err);
    }
};

// Update Department
export const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid department ID' });
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

        const { name, priority, status } = req.body;

        // Validate fields
        if (priority !== undefined && priority < 1) return res.status(400).json({ error: 'Priority must be greater than 0' });

        const updateData = {
            ...(name && { name }),
            ...(priority !== undefined && { priority }),
            ...(status && { status }),
            updatedBy: {
                user_id: req.user._id,
                name: req.user.name,
                email: req.user.email
            },
            updated_date: Date.now()
        };

        const department = await Department.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true
        });

        if (!department) return failResponse(res, 'Department not found', 404);
        await activityLogger({
            actorId: req.user._id,
            entityId: id,
            entityType: "Department",
            action: "UPDATE",
            details: `Department updated by ${req.user.name}`,
            meta: updateData
        });

        return successResponse(res, department, 'Department updated successfully');
    } catch (err) {
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ error: messages.join(', ') });
        }

        if (err.code === 11000) {
            return res.status(400).json({ error: 'Department name already exists' });
        }

        return errorResponse(res, err);
    }
};

// Delete department
export const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return failResponse(res, 'Invalid department ID', 400);

        const deleted = await Department.findByIdAndDelete(id);
        if (!deleted) return failResponse(res, 'Department not found', 404);
        await activityLogger({
            actorId: req.user?._id || null,
            entityId: id,
            entityType: "Department",
            action: "DELETE",
            details: `Department '${deleted.name}' deleted`,
            meta: {}
        });

        return successResponse(res, {}, 'Department deleted successfully');
    } catch (err) {
        return errorResponse(res, err);
    }
};
