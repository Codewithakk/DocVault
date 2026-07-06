import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
    successResponse,
    failResponse,
    errorResponse,
} from "../utils/responseHandler.js";

import crypto from "crypto"
import { sendEmail } from "../services/emailService.js";
import logger from "../utils/logger.js";
import { API_CONFIG } from "../config/ApiEndpoints.js";
import UserToken from "../models/UserToken.js";
import { generateEmailTemplate } from "../helper/emailTemplate.js";
import mongoose from "mongoose";
const otpStore = {};

// ---------------------------
// Register
// ---------------------------

export const getRegisterPage = (req, res) => {
    res.render("pages/register", { title: "E-Sangrah - Register" });
};

export const register = async (req, res) => {
    try {
        const {
            name,
            email,
            raw_password,
            password,
            profile_type = "user",
            status = "Active",
            phone_number,
            address,
            userDetails,
            vendorDetails,
            donorDetails
        } = req.body;

        // Required fields
        if (!name || !email || !raw_password) {
            return failResponse(res, "Name, email, and password are required", 400);
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) return failResponse(res, "User already exists with this email", 409);

        // Create user
        const user = new User({
            name,
            email,
            raw_password,
            password,
            profile_type,
            status,
            phone_number,
            address,
            userDetails: userDetails || undefined,
            vendorDetails: vendorDetails || undefined,
            donorDetails: donorDetails || undefined
        });

        await user.save();

        // Convert to object and remove sensitive fields
        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.raw_password;

        return successResponse(res, userResponse, "User registered successfully", 201);
    } catch (err) {
        logger.error("Register error:", err);
        return errorResponse(res, err);
    }
};


// ---------------------------
// Login
// ---------------------------

export const getLoginPage = (req, res) => {
    res.render("pages/login", {
        pageTitle: "Login",
        pageDescription: "Access your e-Sangrah workspace by logging into your account.",
        metaKeywords: "login, user login, esangrah login, sign in, workspace access",
        canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`
    });
};


export const login = async (req, res) => {
    try {
        const { email, password, deviceId } = req.body;
        if (!deviceId) return failResponse(res, "Device ID is required", 400);

        const user = await User.findOne({ email })
            .select("+password +otp +otpExpiresAt status name email isActive preferences profile_type userDetails profile_image passwordVerification");

        if (!user) return failResponse(res, "User not found", 401);

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return failResponse(res, "Password incorrect", 401);

        if (user.status !== "Active") {
            return failResponse(res, "Your account is inactive or blocked.", 403);
        }

        const now = new Date();

        // ===========================
        // CHECK EXISTING TOKEN
        // ===========================
        let existingToken = await UserToken.findOne({ user: user._id });

        if (existingToken) {
            if (existingToken.deviceId !== deviceId) {
                await UserToken.deleteOne({ _id: existingToken._id });
            }
            else if (existingToken.expiresAt > now) {

                try {
                    const decoded = jwt.verify(existingToken.token, API_CONFIG.JWT_SECRET);

                    req.session.user = {
                        _id: user._id,
                        email: user.email,
                        profile_type: user.profile_type,
                        name: user.name,
                    };

                    user.lastLogin = new Date();
                    await user.save();

                    return successResponse(res, {
                        message: "Login successful",
                        requireOTP: false,
                        token: existingToken.token,
                        user
                    });

                } catch (err) {
                    // token expired → delete and send OTP
                    await UserToken.deleteOne({ _id: existingToken._id });
                }
            } else {
                // Token expired
                await UserToken.deleteOne({ _id: existingToken._id });
            }
        }

        // ===========================
        // GENERATE NEW OTP
        // ===========================

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        user.otp = otp;
        user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        await sendEmail({
            to: user.email,
            subject: "Your Login OTP",
            html: generateEmailTemplate("otp", {
                userName: user.name,
                otp,
                expiryMinutes: 10,
            })
        });

        return successResponse(res, {
            message: "OTP sent to your registered email",
            requireOTP: true
        });

    } catch (err) {
        logger.error("Login error:", err);
        return errorResponse(res, "Internal server error");
    }
};


export const verifyTokenOtp = async (req, res) => {
    try {
        const { email, otp, deviceId } = req.body;
        if (!deviceId) return failResponse(res, "Device ID is required", 400);

        const user = await User.findOne({ email }).select("+otp +otpExpiresAt +password +status profile_type userDetails");
        if (!user) return failResponse(res, "User not found", 404);

        if (!user.otp || user.otpExpiresAt < new Date())
            return failResponse(res, "OTP expired, please login again", 400);

        if (user.otp !== otp) return failResponse(res, "Invalid OTP", 400);

        // OTP valid -> generate JWT
        const tokenValue = jwt.sign({ id: user._id, email: user.email }, API_CONFIG.JWT_SECRET, { expiresIn: "15d" });
        const tokenExpiry = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

        // Save or update UserToken for this device
        await UserToken.findOneAndUpdate(
            { user: user._id, deviceId },
            { token: tokenValue, deviceId, expiresAt: tokenExpiry },
            { upsert: true, new: true }
        );

        // Clear OTP
        user.otp = null;
        user.otpExpiresAt = null;
        await user.save();

        // Set session
        req.session.user = {
            _id: user._id,
            email: user.email,
            name: user.name,
            profile_type: user.profile_type,
            designation: user.userDetails?.designation || null,
            department: user.userDetails?.department || null,
        };

        return successResponse(res, { token: tokenValue, user }, "OTP verified, login successful");

    } catch (err) {
        logger.error("OTP verification error:", err);
        return errorResponse(res, "Internal server error");
    }
};

// ---------------------------
// Get Logged-in User
// ---------------------------

export const getForgotPasswordPage = (req, res) => {
    res.render("pages/forgot-password", {
        pageTitle: "Forgot Password",
        pageDescription: "Recover your e-Sangrah account by requesting a password reset.",
        metaKeywords: "forgot password, password recovery, reset password, esangrah",
        canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        otpSent: false,
        otpVerified: false,
        email: "",
        message: null,
        error: null
    });
};

export const getResetPasswordPage = (req, res) => {
    res.render("pages/reset-password", {
        pageTitle: "Reset Password",
        pageDescription: "Reset your account password and regain access to your e-Sangrah workspace.",
        metaKeywords: "reset password, account recovery, esangrah reset, password update",
        canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        otpSent: false,
        otpVerified: false,
        email: req.user.email,
        message: null,
        user: req.user,
        error: null
    });
};



// ---------------------------
// Logout
// ---------------------------
export const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                return errorResponse(res, "Failed to logout. Try again.", 500);
            }

            res.clearCookie("connect.sid", {
                path: "/",
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
            });

            return successResponse(res, {}, "Logged out successfully");
        });
    } catch (err) {
        return errorResponse(res, err.message || "Server error", 500);
    }
};

// ---------------------------
// Send OTP
// ---------------------------
export const sendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) return failResponse(res, "User not found", 404);

        // Generate a 4-digit OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        // Store OTP temporarily
        otpStore[email] = { code: otp, expires: Date.now() + 10 * 60 * 1000 }; // expires in 10 min

        // Prepare template data
        const data = {
            userName: user.name || "User",
            otp,
            companyName: res.locals.companyName || "Our Company",
            logoUrl: res.locals.logo || "",
            bannerUrl: res.locals.mailImg || "",
            expiryMinutes: 10,
            BASE_URL: API_CONFIG.baseUrl
        };

        // Generate HTML using your template system
        const html = generateEmailTemplate('passwordReset', data);

        // Send OTP email
        await sendEmail({
            to: email,
            subject: "Your OTP for Password Reset",
            html,
            fromName: res.locals?.supportTeamName || "DMS Support Team",
        });

        return successResponse(res, {}, "OTP sent to your email");
    } catch (err) {
        logger.error("Error sending OTP:", err);
        return errorResponse(res, err, "Failed to send OTP email");
    }
};

// ---------------------------
// Verify OTP
// ---------------------------
export const verifyOtp = (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!otpStore[email]) return failResponse(res, "Please request an OTP first", 400);
        if (otpStore[email].expires < Date.now()) {
            delete otpStore[email];
            return failResponse(res, "OTP expired. Please request again", 400);
        }
        if (otpStore[email].code !== otp) return failResponse(res, "Invalid OTP", 400);

        delete otpStore[email];
        return successResponse(res, {}, "OTP Verified");
    } catch (err) {
        return errorResponse(res, err);
    }
};

// ---------------------------
// Reset Password (via OTP)
// ---------------------------
export const resetPassword = async (req, res) => {
    try {
        const { email, password, confirmPassword } = req.body;
        if (password !== confirmPassword)
            return failResponse(res, "Passwords do not match", 400);

        const user = await User.findOne({ email });
        if (!user) return failResponse(res, "User not found", 404);
        // --- Delete existing tokens ---
        await UserToken.deleteMany({ user: user._id });
        user.raw_password = password;
        await user.save();

        return successResponse(
            res,
            {},
            "Password successfully updated. You can now login."
        );
    } catch (err) {
        return errorResponse(res, err, "Failed to reset password");
    }
};
// ---------------------------
// Send Password Reset Link (after password entry)
// ---------------------------

export const sendResetLink = async (req, res) => {
    try {
        const { email, password, confirmPassword } = req.body;

        // --- Input Validation ---
        if (!email || !password || !confirmPassword) {
            return failResponse(res, "All fields are required", 400);
        }

        if (password !== confirmPassword) {
            return failResponse(res, "Passwords do not match", 400);
        }

        // --- Find User ---
        const user = await User.findOne({ email });
        if (!user) return failResponse(res, "User not found", 404);

        // --- Generate Secure Token ---
        const token = crypto.randomBytes(32).toString("hex");
        const tokenExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes

        // --- Store Token + New Password Temporarily ---
        otpStore[email] = {
            resetToken: token,
            newPassword: password,
            expires: tokenExpiry,
        };

        user.passwordVerification = "pending";

        await user.save();
        // --- Delete existing UserTokens for  user ---
        await UserToken.deleteMany({ user: user._id });

        // --- Destroy Session ---
        await new Promise((resolve) => {
            req.session.destroy((err) => {
                if (err) logger.error("Session destroy error:", err);

                res.clearCookie("connect.sid", {
                    path: "/",
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "lax",
                });
                resolve();
            });
        });

        // --- Construct Reset Link ---
        const baseUrl = API_CONFIG.baseUrl || "http://localhost:5000";
        const resetLink = `${baseUrl}/api/auth/verify-reset/${token}?email=${encodeURIComponent(email)}`;

        // --- Prepare Email Template Data ---
        const data = {
            name: user.name || "User",
            companyName: res.locals.companyName || "Our Company",
            logoUrl: res.locals.logo || "",
            bannerUrl: res.locals.mailImg || "",
            resetLink,
        };

        // --- Generate Email HTML ---
        const html = generateEmailTemplate("passwordVerify", data);

        // --- Send Email ---
        await sendEmail({
            to: email,
            subject: "Verify Password Change",
            html,
            fromName: res.locals?.supportTeamName || "DMS Support Team",
        });

        // --- Success Response ---
        return successResponse(
            res,
            {},
            "Verification link sent to your email. Please check your inbox to complete the process."
        );

    } catch (err) {
        logger.error("Send reset link error:", err);
        return errorResponse(res, err);
    }
};

export const verifyResetLink = async (req, res) => {
    try {
        const { token } = req.params;
        const { email } = req.query;

        if (!email || !token) {
            return res.redirect("/forgot-password?error=Invalid+reset+link");
        }

        const otpEntry = otpStore[email];

        // Invalid or mismatched token
        if (!otpEntry || otpEntry.resetToken !== token) {
            return res.redirect("/forgot-password?error=Invalid+or+expired+reset+link");
        }

        // Expired token
        if (otpEntry.expires < Date.now()) {
            delete otpStore[email];
            return res.redirect("/forgot-password?error=Reset+link+expired");
        }

        // User not found
        const user = await User.findOne({ email });
        if (!user) {
            return res.redirect("/forgot-password?error=User+not+found");
        }
        // --- Delete existing UserTokens after password update ---
        await UserToken.deleteMany({ user: user._id });
        // Update password
        user.raw_password = otpEntry.newPassword;
        user.passwordVerification = "verified";
        await user.save();

        // Remove OTP entry
        delete otpStore[email];

        // Destroy session and clear cookie
        await new Promise((resolve) => {
            req.session.destroy((err) => {
                if (err) logger.error("Session destroy error:", err);

                res.clearCookie("connect.sid", {
                    path: "/",
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "lax",
                });
                resolve();
            });
        });

        // Success
        return res.redirect("/login?success=Password+updated");

    } catch (err) {
        logger.error("Verify reset link error:", err);
        return errorResponse(res, err);
    }
};

// Render My Profile page
export const showMyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id)
            .populate("userDetails.designation")
            .populate("userDetails.department")
            .lean();

        if (!user) {
            return res.status(404).render("pages/error", {
                pageTitle: "User Not Found",
                pageDescription: "Unable to locate the user profile.",
                metaKeywords: "profile, user profile, esangrah account",
                canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
                message: "User not found",
                user: req.user
            });
        }

        res.render("pages/myprofile", {
            pageTitle: "My Profile",
            pageDescription: "View and edit your personal information and account details.",
            metaKeywords: "profile, my account, user profile, esangrah",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user
        });
    } catch (err) {
        logger.error("Error loading profile:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Server Error",
            pageDescription: "An unexpected error occurred while loading the profile page.",
            metaKeywords: "error, server error, profile error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            message: "Server Error",
            user: req.user
        });
    }
};


// POST update profile
export const getProfile = async (req, res) => {
    try {
        const userId = req.user._id;

        const user = await User.findById(userId)
            // Populate all possible designation fields
            .populate("userDetails.designation", "name")
            .populate("userDetails.department", "name")
            .lean();

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Everything is already included: location, post_code, designation, department
        res.json({ success: true, user });

    } catch (err) {
        logger.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const userId = req.user._id;

        const {
            name,
            phone_number,
            address,
            post_code,
            country,
            country_name,
            state,
            state_name,
            city,
            city_name
        } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Basic fields
        if (name) user.name = name.trim();
        if (phone_number) user.phone_number = String(phone_number);
        if (address) user.address = address.trim();
        if (post_code) user.post_code = post_code.trim();

        // Location fields (store directly)
        if (country || state || city) {
            user.location = {
                country: country || country_id,
                country_name: country_name || req.body.country_name,
                state: state || state_id,
                state_name: state_name || req.body.state_name,
                city: city || city_id,
                city_name: city_name || req.body.city_name
            };
        }

        // Profile image
        if (req.file) {
            user.profile_image = req.file.location || req.file.path || user.profile_image;
        }

        await user.save();

        const updatedUser = await User.findById(userId)
            .populate("location.country", "name")
            .populate("location.state", "name")
            .populate("location.city", "name")
            .populate("userDetails.designation", "name")
            .populate("userDetails.department", "name")
            .lean();

        return res.json({
            success: true,
            message: "Profile updated successfully",
            user: updatedUser
        });

    } catch (err) {
        console.error("Update Profile Error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error during profile update",
            error: err.message
        });
    }
};

