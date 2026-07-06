import mongoose from 'mongoose';
import { successResponse, failResponse, errorResponse } from '../utils/responseHandler.js';
import Designation from '../models/Designation.js';
import Menu from '../models/Menu.js';
import MenuAssignment from '../models/MenuAssignment.js';
import { activityLogger } from "../helper/activityLogger.js";
//Page Controllers

// Render Add Designation page
export const showAddDesignationPage = (req, res) => {
    try {
        res.render("pages/designation/designation", {
            pageTitle: "Add Designation",
            pageDescription: "Create a new designation and manage organizational roles.",
            metaKeywords: "add designation, create designation, job roles, organization structure",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            designation: null,
            user: req.user
        });
    } catch (err) {
        logger.error("Add designation render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load the add designation page.",
            metaKeywords: "error, designation error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load add designation page"
        });
    }
};


// Render Edit Designation page
export const showEditDesignationPage = async (req, res) => {
    try {
        const designation = await Designation.findById(req.params.id).lean();

        if (!designation) {
            req.flash("error", "Designation not found");
            return res.status(404).render("pages/error", {
                pageTitle: "Designation Not Found",
                title: "Designation Not Found",
                pageDescription: "The requested designation does not exist.",
                metaKeywords: "designation not found, edit designation error",
                canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
                user: req.user,
                message: "Designation not found"
            });
        }

        res.render("pages/designation/designation", {
            pageTitle: "Edit Designation",
            title: "Edit Designation",
            pageDescription: "Edit role details and update designation information.",
            metaKeywords: "edit designation, update role, job roles management",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            designation,
            user: req.user
        });

    } catch (err) {
        logger.error("Error loading designation edit page:", err);
        req.flash("error", "Something went wrong");
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            title: "Error",
            pageDescription: "Unable to load the edit designation page.",
            metaKeywords: "edit error, designation error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load edit designation page"
        });
    }
};

// Render Designation List page
export const showDesignationListPage = (req, res) => {
    try {
        res.render("pages/designation/designations-list", {
            pageTitle: "Designation List",
            title: "Designation List",
            pageDescription: "View and manage all designations created in your organization.",
            metaKeywords: "designation list, job roles, organization roles, designation management",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user
        });
    } catch (err) {
        logger.error("Designation list render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            title: "Error",
            pageDescription: "Unable to load the designation list.",
            metaKeywords: "designation list error, page error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load designation list"
        });
    }
};

//API Controllers

// Get all designations
export const getAllDesignations = async (req, res) => {
    try {
        let filter = {};

        if (req.user?.profile_type !== "superadmin") {
            filter.isDonorOrVendor = false;
        }

        const data = await Designation.find(filter).lean();
        res.json({ success: true, data });

    } catch (err) {
        return errorResponse(res, err);
    }
};

export const searchDesignations = async (req, res) => {
    try {
        const { search = '', page = 1, limit = 10 } = req.query;

        const query = { status: "Active", isDonorOrVendor: false };

        if (req.user?.profile_type !== "superadmin") {
            query.isDonorOrVendor = false;
        }

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [data, total] = await Promise.all([
            Designation.find(query)
                .select('name priority')
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Designation.countDocuments(query)
        ]);

        res.json({
            success: true,
            data,
            pagination: { more: skip + data.length < total }
        });

    } catch (err) {
        return errorResponse(res, err);
    }
};

// Get designation by ID
export const getDesignationById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id))
            return failResponse(res, 'Invalid designation ID', 400);

        const designation = await Designation.findById(id).lean();
        if (!designation)
            return failResponse(res, 'Designation not found', 404);

        // Restrict donor/vendor for non-superadmin
        if (!req.user || req.user.profile_type !== "superadmin") {
            if (designation.isDonorOrVendor) {
                return failResponse(res, "You are not allowed to view this designation", 403);
            }
        }

        return successResponse(res, designation, 'Designation fetched successfully');

    } catch (err) {
        return errorResponse(res, err);
    }
};

// Create new designation
export const createDesignation = async (req, res) => {
    try {
        if (!req.user) return failResponse(res, 'Unauthorized', 401);

        // Restrict creation of donor/vendor roles
        if (req.body.isDonorOrVendor && req.user.profile_type !== "superadmin") {
            return failResponse(res, "Only superadmin can create donor/vendor designations", 403);
        }

        const designationData = {
            name: req.body.name,
            priority: req.body.priority || 0,
            status: req.body.status || 'Active',
            description: req.body.description || '',
            isDonorOrVendor: req.body.isDonorOrVendor || false,
            added_by: {
                user_id: req.user._id,
                name: req.user.name,
                email: req.user.email
            },
            updated_by: {
                user_id: req.user._id,
                name: req.user.name,
                email: req.user.email
            }
        };

        const designation = new Designation(designationData);
        await designation.save();

        //If designation is donor/vendor → DO NOT assign menus  
        if (!designation.isDonorOrVendor) {
            const allMenus = await Menu.find({}, '_id').lean();

            const assignments = allMenus.map(menu => ({
                designation_id: designation._id,
                menu_id: menu._id,
                permissions: { read: true, write: true, delete: true },
                assigned_date: new Date()
            }));

            if (assignments.length > 0) {
                await MenuAssignment.insertMany(assignments);
            }
        }

        // Log activity
        await activityLogger({
            actorId: req.user._id,
            entityId: designation._id,
            entityType: "Designation",
            action: "CREATE",
            details: `Designation '${designation.name}' created by ${req.user.name}`,
            meta: designationData
        });

        return successResponse(
            res,
            designation,
            `Designation created successfully${designation.isDonorOrVendor ? '' : ' and menus assigned'}`
        );

    } catch (err) {
        if (err.code === 11000 && err.keyValue?.name) {
            return failResponse(res, 'Designation name already exists', 400);
        }
        return errorResponse(res, err);
    }
};
// Update designation
export const updateDesignation = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id))
            return failResponse(res, 'Invalid designation ID', 400);

        const designation = await Designation.findById(id);
        if (!designation)
            return failResponse(res, 'Designation not found', 404);

        // Restrict update
        if (designation.isDonorOrVendor && req.user?.profile_type !== "superadmin") {
            return failResponse(res, "You are not allowed to update this designation", 403);
        }

        // Restrict user from changing "isDonorOrVendor"
        if (req.body.isDonorOrVendor !== undefined && req.user.profile_type !== "superadmin") {
            return failResponse(res, "Only superadmin can modify donor/vendor flag", 403);
        }

        const updateData = {
            name: req.body.name,
            priority: req.body.priority,
            status: req.body.status,
            description: req.body.description,
            isDonorOrVendor: req.body.isDonorOrVendor,
            updated_by: {
                user_id: req.user._id,
                name: req.user.name,
                email: req.user.email
            }
        };

        const updated = await Designation.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true
        });

        return successResponse(res, updated, 'Designation updated successfully');

    } catch (err) {
        return errorResponse(res, err);
    }
};
// Delete designation
export const deleteDesignation = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id))
            return failResponse(res, 'Invalid designation ID', 400);

        const designation = await Designation.findById(id);
        if (!designation)
            return failResponse(res, 'Designation not found', 404);

        // Restriction for delete
        if (designation.isDonorOrVendor && req.user?.profile_type !== "superadmin") {
            return failResponse(res, "You are not allowed to delete this designation", 403);
        }

        const deleted = await Designation.findByIdAndDelete(id);

        return successResponse(res, {}, 'Designation deleted successfully');

    } catch (err) {
        return errorResponse(res, err);
    }
};