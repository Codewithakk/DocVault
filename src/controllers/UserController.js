import User from "../models/User.js";
import { validationResult } from "express-validator";
import { generateRandomPassword } from "../helper/GenerateRandomPassword.js";
import { sendEmail } from "../services/emailService.js";
import logger from "../utils/logger.js";
import Department from "../models/Departments.js";
import Designation from "../models/Designation.js";
import { Country, State, City } from "../models/Location.js";
import Project from "../models/Project.js";
import UserPermission from "../models/UserPermission.js";
import Menu from "../models/Menu.js";
import { parseDateDDMMYYYY } from "../utils/formatDate.js";
import { API_CONFIG } from "../config/ApiEndpoints.js";
import { generateEmailTemplate } from "../helper/emailTemplate.js";
import { activityLogger } from "../helper/activityLogger.js";
import mongoose from "mongoose";
import MenuAssignment from "../models/MenuAssignment.js";
//page routes controllers

// GET /users/list
export const listUsers = (req, res) => {
    try {
        res.render("pages/registerations/user-listing", {
            pageTitle: "Users List",
            pageDescription: "View and manage all registered users in your workspace.",
            metaKeywords: "users list, user management, workspace users",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user
        });
    } catch (err) {
        console.error("Error loading users list:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load users list.",
            metaKeywords: "users list error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            message: "Unable to load users list"
        });
    }
};


// GET /users/register
export const showRegisterForm = async (req, res) => {
    try {
        const departments = await Department.find({ status: "Active" }, "name").lean();
        const designations = await Designation.find({ status: "Active" }).sort({ name: 1 }).lean();

        res.render("pages/registerations/user-registration", {
            pageTitle: "Register User",
            pageDescription: "Register a new user and assign roles, department, and designation.",
            metaKeywords: "user registration, add user, workspace users",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            departments,
            designations,
            user: req.user
        });
    } catch (err) {
        logger.error("Error loading user registration:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load user registration page.",
            metaKeywords: "user registration error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            message: "Internal Server Error"
        });
    }
};


// GET /users/:mode/:id
export const viewOrEditUser = async (req, res) => {
    try {
        const { mode, id } = req.params;

        const user = await User.findById(id)
            .populate("userDetails.department", "name")
            .populate("userDetails.designation", "name")
            .lean();
        if (!user) {
            return res.status(404).send("User not found");
        }

        // Fetch all required data
        const [departments, designations, countries, states, cities] = await Promise.all([
            Department.find().lean(),
            Designation.find().lean(),
            Country.find().lean(),
            State.find().lean(),
            City.find().lean()
        ]);

        res.render("pages/registerations/user-form", {
            pageTitle: "Edit User",
            pageDescription: "Edit user and assign roles, department, and designation.",
            metaKeywords: "edit user, workspace users",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            title: `User - ${user.name}`,
            user,
            departments,
            designations,
            countries,
            states,
            cities,
            viewOnly: mode === "view"
        });
    } catch (err) {
        logger.error("Error loading user", err);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Error</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
            </head>
            <body>
                <div class="container mt-5">
                    <div class="alert alert-danger">
                        <h4>Error Loading User</h4>
                        <p>${err.message}</p>
                        <a href="/users/list" class="btn btn-primary">Back to User List</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    }
};

// API controllers

// Register user with profile type 'user'
export const registerUser = async (req, res) => {
    try {
        const {
            name,
            email,
            phone_number,
            employee_id,
            department,
            designation,
            address,
            post_code,
            location
        } = req.body;

        let profile_image = null;
        if (req.file) {
            profile_image = req.file.location;
        }

        // Check existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User already exists with this email",
            });
        }

        const randomPassword = generateRandomPassword();

        if (
            !location ||
            !location.country ||
            !location.state ||
            !location.city
        ) {
            return res.status(400).json({
                success: false,
                message: "Country, State and City are required"
            });
        }

        // Validate that designation is provided
        if (!designation) {
            return res.status(400).json({
                success: false,
                message: "Designation is required to assign menu permissions"
            });
        }

        // Find the designation ID from the designation name or ID
        let designationId = designation;
        
        // If designation is a string (name), find the designation document
        if (typeof designation === 'string' && !mongoose.Types.ObjectId.isValid(designation)) {
            const Designation = mongoose.model('Designation');
            const designationDoc = await Designation.findOne({ 
                name: { $regex: new RegExp(`^${designation}$`, 'i') } 
            });
            
            if (!designationDoc) {
                return res.status(404).json({
                    success: false,
                    message: `Designation "${designation}" not found`
                });
            }
            designationId = designationDoc._id;
        }

        const newUser = new User({
            name,
            email,
            phone_number,
            raw_password: randomPassword,
            profile_type: "user",
            profile_image,
            addedBy: req.user ? req.user._id : null,

            userDetails: {
                employee_id,
                department,
                designation: typeof designation === 'string' ? designation : designation.name, // Store the name
            },

            address: address?.trim() || null,
            post_code: post_code?.trim() || null,

            location: {
                country: location.country,
                country_name: location.country_name,

                state: location.state,
                state_name: location.state_name,

                city: location.city,
                city_name: location.city_name
            }
        });

        await newUser.save();

        // === ASSIGN MENU PERMISSIONS BASED ON DESIGNATION ===
        // Get menu assignments for this designation
        const menuAssignments = await MenuAssignment.find({ 
            designation_id: designationId 
        }).populate('menu_id');

        if (menuAssignments.length > 0) {
            const permissionDocs = menuAssignments.map(assignment => ({
                user_id: newUser._id,
                menu_id: assignment.menu_id._id,
                permissions: {
                    read: assignment.permissions?.read ?? true,
                    write: assignment.permissions?.write ?? true,
                    delete: assignment.permissions?.delete ?? true,
                },
                assigned_by: {
                    user_id: req.user._id,
                    name: req.user.name,
                    email: req.user.email,
                },
                assigned_date: new Date()
            }));

            await UserPermission.insertMany(permissionDocs);
        } else {
            // Optional: Assign default read-only permissions or no permissions
            // You can also log this for monitoring
            logger.warn(`No menu assignments found for designation: ${designation}`);
        }

        // Send welcome email
        const data = {
            name,
            email,
            password: randomPassword,
            companyName: res.locals.companyName || "Our Company",
            logoUrl: res.locals.logo || "",
            bannerUrl: res.locals.mailImg || "",
            BASE_URL: API_CONFIG.baseUrl
        };

        const htmlContent = generateEmailTemplate("registeration", data);

        await sendEmail({
            to: email,
            subject: "Welcome to E-Sangrah",
            html: htmlContent,
            fromName: "E-Sangrah Team",
        });

        await activityLogger({
            actorId: req.user._id,
            action: "ADDED_USER",
            details: `User Added by ${req.user?.name} with designation ${designation}`,
            meta: { email, designation }
        });

        res.status(201).json({
            success: true,
            message: `User registered successfully and assigned menu permissions based on designation.`,
            data: { 
                user: newUser,
                assigned_menus: menuAssignments.length
            },
        });

    } catch (error) {
        logger.error("Registration error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        let profile_type = req.query.profile_type || "user";
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || "";
        const sortBy = req.query.sortBy || "createdAt";
        const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
        const designationIds = search
        ? await Designation.find({
              name: { $regex: search, $options: "i" }
          }).distinct("_id")
        : [];
    
    const departmentIds = search
        ? await Department.find({
              name: { $regex: search, $options: "i" }
          }).distinct("_id")
        : [];
        // Build filter
        const filter = {
            profile_type,
            $or: [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { status: { $regex: search, $options: "i" } },
        
                ...(search
                    ? [
                          {
                              $expr: {
                                  $regexMatch: {
                                      input: { $toString: "$phone_number" },
                                      regex: search,
                                      options: "i"
                                  }
                              }
                          }
                      ]
                    : []),
        
                {
                    "userDetails.designation": { $in: designationIds }
                },
                {
                    "userDetails.department": { $in: departmentIds }
                }
            ]
        };

        // Total count
        const total = await User.countDocuments(filter);

        // Fetch users with pagination and sorting
        const users = await User.find(filter)
            .populate("userDetails.department", "name")
            .populate("userDetails.designation", "name")
            .select("+raw_password -password")
            .sort({ [sortBy]: sortOrder })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        const mappedUsers = users.map(user => ({
            _id: user._id,
            name: user.name || "-",
            email: user.email || "-",
            phone_number: user.phone_number || "-",
            password: user.raw_password || "-",
            profile_type: user.profile_type,
            status: user.status || "-",
            userDetails: {
                department: user.userDetails?.department || null,
                designation: user.userDetails?.designation || null
            },
            lastLogin: user.lastLogin || null,
            createdAt: user.createdAt
        }));

        res.json({
            success: true,
            users: mappedUsers,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error("DataTable error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const searchUsers = async (req, res) => {
    try {
        let { page = 1, limit = 10, search = "", profile_type = "user", projectId, wantAllUser = false } = req.query;

        page = parseInt(page, 10);
        limit = parseInt(limit, 10);
        wantAllUser = wantAllUser === "true"; // convert query string to boolean

        let users = [];
        let total = 0;

        if (wantAllUser) {
            // Fetch all types of users: user, donor, vendor
            const filter = {
                profile_type: { $in: ["user", "donor", "vendor"] }
            };
            if (search) filter.name = { $regex: search, $options: "i" };

            users = await User.find(filter)
                .select("name email profile_type userDetails.designation vendorDetails.designation donorDetails.designation")
                .populate("userDetails.designation vendorDetails.designation donorDetails.designation", "name") // populate designation names
                .limit(limit)
                .skip((page - 1) * limit)
                .sort({ name: 1 })
                .lean();

            total = await User.countDocuments(filter);

            // Map designation from nested objects
            users = users.map(u => {
                let designation = null;
                if (u.profile_type === "user" && u.userDetails?.designation) designation = u.userDetails.designation.name;
                else if (u.profile_type === "vendor" && u.vendorDetails?.designation) designation = u.vendorDetails.designation.name;
                else if (u.profile_type === "donor" && u.donorDetails?.designation) designation = u.donorDetails.designation.name;

                return {
                    name: u.name,
                    email: u.email,
                    profile_type: u.profile_type,
                    designation
                };
            });

        } else if ((profile_type === "donor" || profile_type === "vendor") && projectId) {
            const project = await Project.findById(projectId)
                .populate({
                    path: profile_type,
                    select: "name email",
                    match: search ? { name: { $regex: search, $options: "i" } } : {}
                })
                .lean();

            if (project) {
                users = project[profile_type] || [];
                total = users.length;
                const start = (page - 1) * limit;
                const end = start + limit;
                users = users.slice(start, end);
            }
        } else {
            const filter = { profile_type };
            if (search) filter.name = { $regex: search, $options: "i" };

            users = await User.find(filter)
                .select("name email")
                .limit(limit)
                .skip((page - 1) * limit)
                .sort({ name: 1 })
                .lean();

            total = await User.countDocuments(filter);
        }

        res.status(200).json({
            success: true,
            message: "Users fetched successfully",
            users,
            pagination: {
                total,
                currentPage: page,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error("Get users error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// Get single user by ID
export const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate("userDetails.department", "name")
            .populate("userDetails.designation", "name")
            .select("-password -raw_password");

        if (!user || user.profile_type !== "user") {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        logger.error("Get user error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// Update user
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, 
            phone_number, 
            department, 
            designation_id, 
            status, 
            employee_id,
            country,
            state,
            city,
            post_code,
            address
        } = req.body;

        // Find user first
        const existingUser = await User.findById(id);
        if (!existingUser || existingUser.profile_type !== "user") {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Build update object
        const updateData = {};

        // Simple fields
        if (name !== undefined && name !== '') updateData.name = name;
        if (phone_number !== undefined && phone_number !== '') updateData.phone_number = phone_number;
        if (status !== undefined && status !== '') updateData.status = status;
        if (post_code !== undefined) updateData.post_code = post_code;
        if (address !== undefined) updateData.address = address;

        // User details
        if (employee_id !== undefined || department !== undefined || designation_id !== undefined) {
            updateData.userDetails = {};
            if (employee_id !== undefined && employee_id !== '') updateData.userDetails.employee_id = employee_id;
            if (department !== undefined && department !== '') updateData.userDetails.department = department;
            if (designation_id !== undefined && designation_id !== '') updateData.userDetails.designation = designation_id;
        }

        // Location - build from individual fields
        if (country && state && city) {
            // Get the location names from the database
            const countryDoc = await Country.findById(country);
            const stateDoc = await State.findById(state);
            const cityDoc = await City.findById(city);

            if (!countryDoc || !stateDoc || !cityDoc) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid location references provided"
                });
            }

            // Verify hierarchy
            if (stateDoc.country.toString() !== country) {
                return res.status(400).json({
                    success: false,
                    message: "State does not belong to the specified country"
                });
            }

            if (cityDoc.state.toString() !== state) {
                return res.status(400).json({
                    success: false,
                    message: "City does not belong to the specified state"
                });
            }

            updateData.location = {
                country: country,
                country_name: countryDoc.name,
                state: state,
                state_name: stateDoc.name,
                city: city,
                city_name: cityDoc.name
            };
        }

        // If no fields to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid fields provided for update"
            });
        }

        // Handle profile image if uploaded
        if (req.file) {
            updateData.profile_image = req.file.location || req.file.key;
        }

        // Perform update
        const updatedUser = await User.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        )
        .populate("userDetails.department", "name")
        .populate("userDetails.designation", "name")
        .select("-password -raw_password -otp -otpExpiresAt");

        res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: updatedUser,
        });

    } catch (error) {
        logger.error("Update user error:", error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: Object.values(error.errors).map(e => e.message)
            });
        }
        
        res.status(500).json({
            success: false,
            message: error.message || "Internal server error",
        });
    }
};

// Delete user
export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user || user.profile_type !== "user") {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Use deleteOne() on the document
        await user.deleteOne();

        // await User.findByIdAndDelete(req.params.id);
        await activityLogger({
            actorId: req.user._id,
            action: "DELETE_USER",
            details: `User Deleted by${req.user?.name}`,
            meta: { user }
        });

        res.status(200).json({
            success: true,
            message: "User deleted successfully",
        });
    } catch (error) {
        logger.error("Delete user error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

