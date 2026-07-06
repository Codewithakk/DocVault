import mongoose from "mongoose";
import Designation from "../models/Designation.js"
import Menu from "../models/Menu.js";
import MenuAssignment from "../models/MenuAssignment.js";
import { buildMenuTree } from "../utils/buildMenuTree.js";
import logger from "../utils/logger.js";
import { profile_type } from "../constant/Constant.js";
import Department from "../models/Departments.js";
import User from "../models/User.js";
import UserPermission from "../models/UserPermission.js";
import { API_CONFIG } from "../config/ApiEndpoints.js";
import { activityLogger } from "../helper/activityLogger.js";
//Page Controllers

// Assign Permissions page
export const showAssignPermissionsPage = async (req, res) => {
    try {
        const departments = await Department.find({ status: "Active" }, "name").lean();
        const designations = await Designation.find({ status: "Active" })
            .sort({ name: 1 })
            .lean();

        res.render("pages/permissions/assign-permissions", {
            pageTitle: "Assign Permissions",
            pageDescription: "Assign permissions to users based on their roles, departments, and designations.",
            metaKeywords: "assign permissions, user roles, department access, designation permissions",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            Roles: profile_type,
            designations,
            departments,
            profile_type
        });
    } catch (err) {
        logger.error("Error rendering assign permissions page:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load assign permissions page.",
            metaKeywords: "assign permissions error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            message: "Something went wrong while loading assign permissions page"
        });
    }
};


// Get user permissions page
export const showUserPermissionsPage = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId)
            .populate("userDetails.designation")
            .populate("userDetails.department")
            .lean();

        if (!user) {
            return res.status(404).render("pages/error", {
                pageTitle: "User Not Found",
                pageDescription: "The requested user does not exist.",
                metaKeywords: "user not found, permissions error",
                canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

                user: req.user,
                message: "User not found"
            });
        }

        const menus = await Menu.find({ isActive: true })
            .sort({ priority: 1, add_date: -1 })
            .lean();

        const masterMenus = buildMenuTree(menus);

        const userPermissions = await UserPermission.find({ user_id: userId })
            .populate("menu_id")
            .lean();

        const permissionMap = {};
        userPermissions.forEach(perm => {
            if (perm.menu_id) {
                permissionMap[perm.menu_id._id.toString()] = perm.permissions;
            } else {
                logger.warn(`Missing menu for permission ID: ${perm._id}`);
            }
        });

        res.render("pages/permissions/assign-user-permissions", {
            pageTitle: "User Permissions",
            pageDescription: `View and manage permissions for ${user.name || "the user"}.`,
            metaKeywords: "user permissions, assign permissions, access management",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            targetUser: user,
            masterMenus,
            permissionMap
        });
    } catch (err) {
        logger.error("Error loading user permissions page:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load user permissions page.",
            metaKeywords: "user permissions error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            message: "Something went wrong while loading user permissions"
        });
    }
};


// Get user permissions API
export const getUserPermissions = async (req, res) => {
    try {
        const userId = req.params.id;
        const userPermissions = await UserPermission.find({ user_id: userId })
            .populate("menu_id", "name type master_id")
            .lean();

        res.json({ success: true, data: userPermissions });
    } catch (error) {
        logger.error("Error fetching user permissions:", error);
        res.status(500).json({ success: false, message: "Error fetching user permissions" });
    }
};

// Save user permissions
export const saveUserPermissions = async (req, res) => {
    try {
        const { user_id, permissions } = req.body;
        const assigned_by = req.user;

        if (!user_id || !permissions || Object.keys(permissions).length === 0) {
            return res.status(400).json({
                success: false,
                message: "User ID and permissions are required"
            });
        }

        await UserPermission.deleteMany({ user_id });

        const permissionDocs = [];

        for (const [menuId, permData] of Object.entries(permissions)) {
            permissionDocs.push({
                user_id,
                menu_id: menuId,
                permissions: {
                    read: !!permData.read,
                    write: !!permData.write,
                    delete: !!permData.delete
                },
                assigned_by: {
                    user_id: assigned_by._id,
                    name: assigned_by.name,
                    email: assigned_by.email
                }
            });
        }

        if (permissionDocs.length > 0) {
            await UserPermission.insertMany(permissionDocs);
        }

        res.json({
            success: true,
            message: "User permissions saved successfully"
        });
    } catch (error) {
        logger.error("Error saving user permissions:", error);
        res.status(500).json({ success: false, message: "Error saving user permissions" });
    }
};



//API Controllers


export const getAssignMenuPage = async (req, res) => {
    try {
        let designations;


        if (req.user.profile_type === "superadmin") {

            designations = await Designation.find()
                .select("name status")
                .sort({ name: 1 })
                .lean();
        } else {

            designations = await Designation.find({
                status: "Active",
                isDonorOrVendor: false
            })
                .select("name status")
                .sort({ name: 1 })
                .lean();
        }
        const menus = await Menu.find()
            .sort({ priority: 1, add_date: -1 })
            .populate("added_by updated_by", "name email")
            .lean();

        const masterMenus = buildMenuTree(menus);

        res.render("pages/permissions/assign-menu", {
            pageTitle: "Assign Menu",
            pageDescription: "Assign menus and submenus to designations and manage access control.",
            metaKeywords: "assign menu, menu permissions, designation access, manage menus",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            masterMenus,
            designations,
            user: req.user
        });

    } catch (error) {
        logger.error("Error in getAssignMenuPage:", error);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load assign menu page.",
            metaKeywords: "assign menu error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            message: "Failed to load assign menu page"
        });
    }
};

// ------------------
// GET PAGINATED MENUS
// ------------------
export const getMenus = async (req, res) => {
    try {
        const search = req.query.search?.trim() || "";
        let filter = {};

        if (search) {
            filter = {
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { type: { $regex: search, $options: "i" } },
                    { url: { $regex: search, $options: "i" } }
                ]
            };
        }

        // If limit = 0 → return all
        if (req.query.limit === "0") {
            const menus = await Menu.find(filter)
                .sort({ priority: 1, add_date: -1 })
                .populate("added_by updated_by", "name email")
                .lean();

            const total = await Menu.countDocuments();
            const filtered = await Menu.countDocuments(filter);

            return res.json({
                success: true,
                data: menus,
                pagination: {
                    page: 1,
                    limit: 0,
                    total,
                    filtered,
                    pages: 1,
                }
            });
        }

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.max(parseInt(req.query.limit) || 10, 1);
        const skip = (page - 1) * limit;

        const [menus, total, filtered] = await Promise.all([
            Menu.find(filter)
                .sort({ priority: 1, add_date: -1 })
                .skip(skip)
                .limit(limit)
                .populate("added_by updated_by", "name email")
                .lean(),

            Menu.countDocuments(),
            Menu.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: menus,
            pagination: {
                page,
                limit,
                total,
                filtered,
                pages: Math.ceil(filtered / limit)
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------
// CREATE MENU
// ------------------
export const createMenu = async (req, res) => {
    try {
        const user = req.user;
        const { type, master_id, name, icon_code, url, priority, is_show, isActive } = req.body;

        if (type === "SubMenu" && !master_id) {
            return res.status(400).json({ success: false, message: "SubMenu requires master_id" });
        }
        if (type === "Menu" && master_id) {
            return res.status(400).json({ success: false, message: "Menu cannot have master_id" });
        }

        const menu = new Menu({
            type,
            master_id: master_id || null,
            name,
            icon_code: icon_code || "",
            url: url || "#",
            priority: Number(priority) || 1,
            is_show: !!is_show,
            isActive: !!isActive,
            added_by: {
                user_id: user._id,
                name: user.name,
                email: user.email
            },
            updated_by: {
                user_id: user._id,
                name: user.name,
                email: user.email
            }
        });

        await menu.save();

        res.json({ success: true, data: menu });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "URL must be unique" });
        }
        if (error.name === "ValidationError") {
            return res.status(400).json({ success: false, message: error.message });
        }

        res.status(500).json({ success: false, message: "Error creating menu" });
    }
};

// ------------------
// UPDATE MENU
// ------------------
export const updateMenu = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, master_id, name, icon_code, url, priority, is_show, isActive } = req.body;

        if (type === "SubMenu" && !master_id) {
            return res.status(400).json({ success: false, message: "SubMenu requires master_id" });
        }
        if (type === "Menu" && master_id) {
            return res.status(400).json({ success: false, message: "Menu cannot have master_id" });
        }

        const menu = await Menu.findByIdAndUpdate(
            id,
            {
                type,
                master_id: master_id || null,
                name,
                icon_code,
                url,
                priority: Number(priority) || 1,
                is_show: is_show === "true" || is_show === true,
                isActive: isActive === "true" || isActive === true,
                updated_by: {
                    user_id: req.user._id,
                    name: req.user.name,
                    email: req.user.email
                }
            },
            { new: true, runValidators: true }
        );

        if (!menu) {
            return res.status(404).json({ success: false, message: "Menu not found" });
        }

        res.json({ success: true, data: menu });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "URL must be unique" });
        }
        if (error.name === "ValidationError") {
            return res.status(400).json({ success: false, message: error.message });
        }

        res.status(500).json({ success: false, message: "Error updating menu" });
    }
};

// ------------------
// DELETE MENU
// ------------------
export const deleteMenu = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid menu ID" });
        }

        const menu = await Menu.findByIdAndDelete(req.params.id);
        if (!menu) {
            return res.status(404).json({ success: false, message: "Menu not found" });
        }

        await MenuAssignment.deleteMany({ menu_id: req.params.id });

        res.json({ success: true, message: "Menu deleted successfully" });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------
// GET MENUS BY TYPE
// ------------------
export const getMenusByType = async (req, res) => {
    try {
        const menus = await Menu.find({ type: req.params.type })
            .sort({ priority: 1, name: 1 })
            .lean();

        res.json({ success: true, data: menus });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ------------------
// TOGGLE SHOW/STATUS
// ------------------
export const toggleMenuStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const field = req.query.field;

        if (!["is_show", "isActive"].includes(field)) {
            return res.status(400).json({
                success: false,
                message: "Invalid field. Allowed: is_show, isActive"
            });
        }

        const menu = await Menu.findById(id);
        if (!menu) {
            return res.status(404).json({ success: false, message: "Menu not found" });
        }

        const updatedValue = !menu[field];

        const updated = await Menu.findByIdAndUpdate(
            id,
            {
                $set: {
                    [field]: updatedValue,
                    updated_by: req.user
                        ? {
                            user_id: req.user._id,
                            name: req.user.name,
                            email: req.user.email
                        }
                        : menu.updated_by
                }
            },
            { new: true }
        );

        res.json({
            success: true,
            message: `${field} updated successfully`,
            data: {
                id: updated._id,
                [field]: updated[field]
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ------------------
// ASSIGN MENUS
// ------------------
export const assignMenus = async (req, res) => {
    try {
        const { designation_id, menu_ids } = req.body;

        if (!designation_id || !Array.isArray(menu_ids)) {
            return res.status(400).json({ success: false, message: "Designation ID and menu IDs array required" });
        }

        if (!mongoose.Types.ObjectId.isValid(designation_id)) {
            return res.status(400).json({ success: false, message: "Invalid designation ID" });
        }

        for (const id of menu_ids) {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({ success: false, message: `Invalid menu ID: ${id}` });
            }
        }

        await MenuAssignment.deleteMany({ designation_id });

        const assignments = menu_ids.map(menu_id => ({ designation_id, menu_id }));
        const savedAssignments = await MenuAssignment.insertMany(assignments);

        res.status(201).json({ success: true, data: savedAssignments });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get assigned menus for a designation
export const getAssignedMenus = async (req, res) => {
    try {
        const { designation_id } = req.params;

        const assignedMenus = await MenuAssignment.find({ designation_id })
            .populate("menu_id", "name")
            .select("menu_id permissions");
        const menuData = assignedMenus.map(a => ({
            menu_id: a.menu_id?._id?.toString(),
            permissions: a.permissions || { read: false, write: false, create: false, delete: false }
        }));

        res.json({ success: true, data: menuData });
    } catch (error) {
        logger.error("Error fetching assigned menus:", error);
        res.status(500).json({ success: false, message: "Error fetching assigned menus" });
    }
};

// Assign menus to designation
export const assignMenusToDesignation = async (req, res) => {
    try {
        const { designation_id, menus } = req.body;

        if (!designation_id || !Array.isArray(menus)) {
            return res.status(400).json({
                success: false,
                message: "Designation ID and menus array are required"
            });
        }

        // Remove existing assignments
        await MenuAssignment.deleteMany({ designation_id });

        if (menus.length > 0) {
            const assignments = menus.map(m => ({
                designation_id,
                menu_id: m.menu_id,
                permissions: m.permissions || { read: false, write: false, delete: false }
            }));

            await MenuAssignment.insertMany(assignments);
        }
        await activityLogger({
            actorId: req.user._id,
            entityId: designation_id,
            entityType: "Designation",
            action: "ASSIGN_MENUS",
            details: ` ${req.user?.name} assigned menus to designation`,
            meta: { menus }
        });
        // incrementGlobalPermissionsVersion(designation_id);
        res.json({
            success: true,
            message: "Menus assigned successfully",
            data: menus
        });
    } catch (error) {
        logger.error("Error assigning menus:", error);
        res.status(500).json({ success: false, message: "Error assigning menus" });
    }
};

// Unassign menus from designation
export const unAssignMenu = async (req, res) => {
    try {
        const { designation_id, menu_ids } = req.body;

        if (!designation_id || !Array.isArray(menu_ids) || menu_ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Designation ID and menu_ids are required"
            });
        }

        const result = await MenuAssignment.deleteMany({
            designation_id,
            menu_id: { $in: menu_ids }
        });

        // Update Designation audit info
        await Designation.findByIdAndUpdate(designation_id, {
            updated_by: {
                user_id: req.user._id,
                name: req.user.name,
                email: req.user.email
            },
            updated_date: Date.now()
        });
        await activityLogger({
            actorId: req.user._id,
            entityId: designation_id,
            entityType: "Designation",
            action: "UNASSIGN_MENUS",
            details: `${req.user?.name} unassigned menus`,
            meta: { menu_ids, deletedCount: result.deletedCount }
        });
        return res.json({
            success: true,
            message: "Menus unassigned successfully",
            deletedCount: result.deletedCount
        });
    } catch (error) {
        logger.error("Error in unAssignMenu:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// Get sidebar menus for logged-in user

export const getSidebarForUser = async (req, res) => {
    try {
        const profileType = req.user?.profile_type;
        const userId = req.user?._id;
        let designationId = null;

        // ================================
        // GET DESIGNATION FOR ALL USER TYPES
        // ================================
        if (!["superadmin", "admin"].includes(profileType)) {
            switch (profileType) {
                case "user":
                    designationId = req.user?.userDetails?.designation;
                    break;
                case "vendor":
                    designationId = req.user?.vendorDetails?.designation;
                    break;
                case "donor":
                    designationId = req.user?.donorDetails?.designation;
                    break;
                default:
                    designationId = null;
            }
        }

        let assignedMenus = [];

        // ================================
        // 1. SUPERADMIN - All menus
        // ================================
        if (profileType === "superadmin") {
            assignedMenus = await Menu.find(
                {},
                { name: 1, url: 1, icon_code: 1, type: 1, master_id: 1, priority: 1 }
            )
                .sort({ priority: 1 })
                .lean();

        // ================================
        // 2. ADMIN - All active menus
        // ================================
        } else if (profileType === "admin") {
            assignedMenus = await Menu.find(
                { is_show: true, isActive: true },
                { name: 1, url: 1, icon_code: 1, type: 1, master_id: 1, priority: 1 }
            )
                .sort({ priority: 1 })
                .lean();

        // ================================
        // 3. REGULAR USERS (user/vendor/donor)
        // ================================
        } else {
            if (!designationId) {
                return res.status(400).json({
                    success: false,
                    message: "No designation assigned to user",
                });
            }

            // Step 1: Get ALL designation-based menus (THIS IS THE SOURCE OF TRUTH)
            const designationMenus = await MenuAssignment.aggregate([
                {
                    $match: {
                        designation_id: new mongoose.Types.ObjectId(designationId)
                    }
                },
                {
                    $lookup: {
                        from: "menus",
                        localField: "menu_id",
                        foreignField: "_id",
                        as: "menu",
                    },
                },
                { $unwind: "$menu" },
                { 
                    $match: { 
                        "menu.isActive": true, 
                        "menu.is_show": true 
                    } 
                },
                {
                    $project: {
                        menu_id: "$menu._id",
                        name: "$menu.name",
                        url: "$menu.url",
                        icon_code: "$menu.icon_code",
                        type: "$menu.type",
                        master_id: "$menu.master_id",
                        priority: "$menu.priority",
                        designation_permissions: "$permissions",
                        source: { $literal: "designation" }
                    },
                }
            ]);

            // Step 2: Get user-specific permissions (ONLY for menus that exist in designation)
            const userPermissions = await UserPermission.aggregate([
                {
                    $match: {
                        user_id: new mongoose.Types.ObjectId(userId)
                    }
                },
                {
                    $lookup: {
                        from: "menus",
                        localField: "menu_id",
                        foreignField: "_id",
                        as: "menu",
                    },
                },
                { $unwind: "$menu" },
                { 
                    $match: { 
                        "menu.isActive": true, 
                        "menu.is_show": true 
                    } 
                },
                {
                    $project: {
                        menu_id: "$menu._id",
                        name: "$menu.name",
                        url: "$menu.url",
                        icon_code: "$menu.icon_code",
                        type: "$menu.type",
                        master_id: "$menu.master_id",
                        priority: "$menu.priority",
                        user_permissions: "$permissions",
                        source: { $literal: "user" }
                    },
                }
            ]);

            // Step 3: Create maps for quick lookup
            const designationMap = new Map();
            const userPermissionMap = new Map();

            // Build designation map (SOURCE OF TRUTH)
            for (const menu of designationMenus) {
                const menuId = menu.menu_id.toString();
                designationMap.set(menuId, menu);
            }

            // Build user permission map (ONLY for override)
            for (const menu of userPermissions) {
                const menuId = menu.menu_id.toString();
                userPermissionMap.set(menuId, menu);
            }

            // Step 4: Merge with correct logic
            const mergedMenus = new Map();

            // ONLY iterate over designation menus (designation is the source of truth)
            for (const [menuId, designationMenu] of designationMap) {
                let finalMenu = null;
                let permissionSource = "";
                let finalPermissions = {};

                // Check if user has permission override for this menu
                const userMenu = userPermissionMap.get(menuId);

                // CASE 1: Designation has menu + User has permission record
                if (userMenu) {
                    // User permissions OVERRIDE designation permissions
                    finalPermissions = {
                        read: userMenu.user_permissions.read !== undefined ? 
                              userMenu.user_permissions.read : 
                              designationMenu.designation_permissions.read,
                        write: userMenu.user_permissions.write !== undefined ? 
                               userMenu.user_permissions.write : 
                               designationMenu.designation_permissions.write,
                        delete: userMenu.user_permissions.delete !== undefined ? 
                                userMenu.user_permissions.delete : 
                                designationMenu.designation_permissions.delete,
                    };

                    // Check if user has at least one permission
                    if (finalPermissions.read || finalPermissions.write || finalPermissions.delete) {
                        finalMenu = {
                            ...designationMenu,
                            permissions: finalPermissions,
                            source: "user-override"
                        };
                    }
                    // If all permissions false, menu is hidden (user denied access)
                    
                // CASE 2: Designation has menu + User has NO permission record
                } else {
                    // Use designation permissions as baseline
                    finalPermissions = {
                        read: designationMenu.designation_permissions.read || false,
                        write: designationMenu.designation_permissions.write || false,
                        delete: designationMenu.designation_permissions.delete || false,
                    };
                    
                    // Check if designation has at least one permission
                    if (finalPermissions.read || finalPermissions.write || finalPermissions.delete) {
                        finalMenu = {
                            ...designationMenu,
                            permissions: finalPermissions,
                            source: "designation-only"
                        };
                    }
                }

                // Add to merged map if menu is allowed
                if (finalMenu) {
                    mergedMenus.set(menuId, finalMenu);
                }
            }

            // Step 5: Fetch parent menus for hierarchy
            const menuIds = Array.from(mergedMenus.keys());
            
            if (menuIds.length === 0) {
                assignedMenus = [];
            } else {
                // Get all parents for these menus
                const allMenusWithParents = await Menu.aggregate([
                    {
                        $match: {
                            _id: { $in: menuIds.map(id => new mongoose.Types.ObjectId(id)) }
                        }
                    },
                    {
                        $graphLookup: {
                            from: "menus",
                            startWith: "$master_id",
                            connectFromField: "master_id",
                            connectToField: "_id",
                            as: "ancestors",
                            restrictSearchWithMatch: {
                                isActive: true,
                                is_show: true,
                            },
                        },
                    }
                ]);

                // Build complete menu list with permissions
                const allMenus = [];

                // Add assigned menus with their permissions
                for (const [menuId, menuData] of mergedMenus) {
                    allMenus.push({
                        _id: menuData.menu_id,
                        name: menuData.name,
                        url: menuData.url,
                        icon_code: menuData.icon_code,
                        type: menuData.type,
                        master_id: menuData.master_id,
                        priority: menuData.priority,
                        permissions: menuData.permissions,
                        source: menuData.source
                    });
                }

                // Add parent menus (ancestors)
                for (const doc of allMenusWithParents) {
                    if (Array.isArray(doc.ancestors)) {
                        for (const ancestor of doc.ancestors) {
                            const ancestorId = ancestor._id.toString();
                            if (!mergedMenus.has(ancestorId)) {
                                allMenus.push({
                                    _id: ancestor._id,
                                    name: ancestor.name,
                                    url: ancestor.url,
                                    icon_code: ancestor.icon_code,
                                    type: ancestor.type,
                                    master_id: ancestor.master_id,
                                    priority: ancestor.priority,
                                    permissions: { read: true, write: false, delete: false },
                                    source: "parent"
                                });
                            }
                        }
                    }
                }

                // Deduplicate
                const uniqueMenus = new Map();
                for (const menu of allMenus) {
                    const id = menu._id.toString();
                    if (!uniqueMenus.has(id)) {
                        uniqueMenus.set(id, menu);
                    }
                }
                assignedMenus = Array.from(uniqueMenus.values());
            }
        }

        // ================================
        // BUILD HIERARCHY
        // ================================
        const buildHierarchy = (menus, parentId = null) => {
            return menus
                .filter(menu => {
                    const mid = menu.master_id ? menu.master_id.toString() : null;
                    const pid = parentId ? parentId.toString() : null;
                    return mid === pid;
                })
                .sort((a, b) => (a.priority || 0) - (b.priority || 0))
                .map(menu => ({
                    _id: menu._id,
                    name: menu.name,
                    url: menu.url,
                    icon_code: menu.icon_code,
                    type: menu.type,
                    permissions: menu.permissions,
                    source: menu.source || "designation",
                    children: buildHierarchy(menus, menu._id)
                }));
        };

        const sidebar = buildHierarchy(assignedMenus);

        return res.status(200).json({
            success: true,
            data: sidebar,
            meta: {
                profileType,
                designationId,
                totalMenus: assignedMenus.length,
                permissionSource: profileType === "superadmin" ? "all" : 
                                 profileType === "admin" ? "admin" : 
                                 "designation-based"
            }
        });

    } catch (error) {
        console.error("Error in getSidebarForUser:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching sidebar",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// Render menu list with pagination
export const getMenuList = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const skip = (page - 1) * limit;

        const [menus, total] = await Promise.all([
            Menu.find()
                .sort({ priority: 1, add_date: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Menu.countDocuments()
        ]);

        const totalPages = Math.ceil(total / limit);

        res.render("pages/permissions/list", {
            pageTitle: "Menu List",
            pageDescription: "View and manage all menus and submenus for your system.",
            metaKeywords: "menu list, system menus, permissions, menu management",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            menus,
            currentPage: page,
            totalPages,
            user: req.user,
            total,
            limit,
            layout: !req.xhr
        });
    } catch (error) {
        console.error("Error loading menu list:", error);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load menu list.",
            metaKeywords: "menu error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            message: error.message,
            user: req.user
        });
    }
};

// Render add menu form
export const getAddMenu = async (req, res) => {
    try {
        const masters = await Menu.find({ type: "Menu", isActive: true }).sort({ name: 1 });

        res.render("pages/permissions/add", {
            pageTitle: "Add Menu",
            pageDescription: "Create a new menu or submenu for the system.",
            metaKeywords: "add menu, create menu, menu management",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            masters,
            menu: null,
            user: req.user
        });
    } catch (error) {
        console.error("Error loading add menu form:", error);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load add menu page.",
            metaKeywords: "add menu error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            message: error.message,
            user: req.user
        });
    }
};

// Render edit menu form
export const getEditMenu = async (req, res) => {
    try {
        const menu = await Menu.findById(req.params.id);

        if (!menu) {
            return res.status(404).render("pages/error", {
                pageTitle: "Menu Not Found",
                pageDescription: "The requested menu does not exist.",
                metaKeywords: "menu not found, edit menu error",
                canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

                message: "Menu not found",
                user: req.user
            });
        }

        const masters = await Menu.find({ type: "Menu", is_show: true }).sort({ name: 1 });
        res.render("pages/permissions/add", {
            pageTitle: "Edit Menu",
            pageDescription: "Edit the details of an existing menu or submenu.",
            metaKeywords: "edit menu, menu management, update menu",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            masters,
            menu,
            user: req.user
        });
    } catch (error) {
        console.error("Error loading edit menu form:", error);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load edit menu page.",
            metaKeywords: "edit menu error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            message: error.message,
            user: req.user
        });
    }
};
