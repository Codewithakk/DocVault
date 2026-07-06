import { body, param, check, validationResult } from "express-validator";
import mongoose from "mongoose";
import User from "../models/User.js";

// --- helper validators / regex ---
const isE164 = (val) => /^\+?[1-9]\d{1,14}$/.test(val); // basic E.164
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
// GST (simple) — India GST is 15 chars: 2 digits state + PAN (10) + 1 char entity + 1 checksum
const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

// normalize boolean helper
const toLowerIfString = (v) => (typeof v === "string" ? v.toLowerCase() : v);

// --- Validators ---

/**
 * Registration validator
 * - Requires name, email, raw_password (client should use raw_password field)
 * - profile_type controls required fields for nested objects
 * - Performs async email uniqueness check
 */
export const registerValidator = [
    body("name")
        .trim()
        .notEmpty().withMessage("Name is required")
        .isLength({ min: 2, max: 100 }).withMessage("Name must be between 2 and 100 characters")
        .escape(),

    body("email")
        .trim()
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Invalid email format")
        .bail()
        .custom(async (value) => {
            const existing = await User.findOne({ email: value }).lean().select("_id");
            if (existing) throw new Error("Email already in use");
            return true;
        }),

    // Use raw_password field because model uses raw_password -> hashed in pre-save
    body("raw_password")
        .notEmpty().withMessage("Password is required")
        .isLength({ min: 8 }).withMessage("Password must be at least 8 characters long")
        .matches(strongPasswordRegex).withMessage("Password must include upper, lower, number and special char"),

    // optional confirm
    body("confirmPassword")
        .optional()
        .custom((val, { req }) => val === req.body.raw_password)
        .withMessage("Passwords do not match"),

    body("phone_number")
        .optional({ nullable: true })
        .trim()
        .custom((val) => isE164(val)).withMessage("Phone number must be in valid E.164 format (e.g. +911234567890)"),

    body("profile_type")
        .optional()
        .customSanitizer(toLowerIfString)
        .isIn(["donor", "vendor", "user", "admin", "superadmin"])
        .withMessage("Invalid profile_type"),

    // userDetails (for profile_type === 'user')
    body("userDetails").optional(),
    body("userDetails.employee_id")
        .if((value, { req }) =>
            !req.body.profile_type || req.body.profile_type === "user"
        )
        .notEmpty()
        .withMessage("Employee ID is required for user profile")
        .isAlphanumeric()
        .withMessage("Employee ID must be alphanumeric")
        .trim(),

    body("userDetails.designation")
        .optional()
        .custom((val) => mongoose.Types.ObjectId.isValid(val))
        .withMessage("Invalid designation id"),

    body("userDetails.department")
        .optional()
        .custom((val) => mongoose.Types.ObjectId.isValid(val))
        .withMessage("Invalid department id"),

    // vendorDetails
    body("vendorDetails").optional(),
    body("vendorDetails.company_name")
        .if(body("profile_type").equals("vendor"))
        .notEmpty().withMessage("Company name is required for vendors")
        .trim()
        .isLength({ max: 200 }).withMessage("Company name is too long"),

    body("vendorDetails.gst_number")
        .optional({ nullable: true })
        .trim()
        .custom((val) => gstRegex.test(val)).withMessage("Invalid GST number format")
        .toUpperCase(),

    body("vendorDetails.contact_person")
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage("Contact person name is too long"),

    body("vendorDetails.services_offered")
        .optional()
        .isArray().withMessage("services_offered must be an array")
        .bail()
        .custom((arr) => arr.every((s) => typeof s === "string" && s.length > 0))
        .withMessage("Each service must be a non-empty string"),

    // donorDetails
    body("donorDetails").optional(),
    body("donorDetails.donor_type")
        .optional()
        .isIn(["individual", "corporate", "ngo"]).withMessage("Invalid donor type"),

    body("donorDetails.organization_name")
        .if(body("donorDetails.donor_type").exists().custom((v) => v === "corporate" || v === "ngo"))
        .notEmpty().withMessage("Organization name required for corporate or NGO donors")
        .trim(),

    // profile_image
    body("profile_image")
        .optional({ nullable: true })
        .isURL().withMessage("profile_image must be a valid URL"),

    // optional address
    body("address").optional().trim().isLength({ max: 1000 }).withMessage("Address too long"),
];


/**
 * Login validator
 */
export const loginValidator = [
    body("email")
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Invalid email"),
    body("password")
        .notEmpty().withMessage("Password is required"),
];


/**
 * Send OTP validator
 */
export const sendOtpValidator = [
    body("email")
        .optional({ nullable: true })
        .trim()
        .if(body("email").exists())
        .isEmail().withMessage("Invalid email"),
    body("phone_number")
        .optional({ nullable: true })
        .trim()
        .if((value, { req }) => !req.body.email) // if email not present, phone required
        .notEmpty().withMessage("Provide phone_number if email is not provided")
        .custom((val) => isE164(val)).withMessage("Phone number must be in E.164 format"),
    // ensure at least one of email or phone_number is provided
    body().custom((value, { req }) => {
        if (!req.body.email && !req.body.phone_number) {
            throw new Error("Either email or phone_number is required");
        }
        return true;
    }),
];


/**
 * Verify OTP validator
 */
export const verifyOtpValidator = [
    body("email")
        .optional()
        .trim()
        .isEmail().withMessage("Invalid email"),
    body("phone_number")
        .optional()
        .trim()
        .custom((val) => isE164(val)).withMessage("Phone number must be in E.164 format"),

    body("otp")
        .notEmpty().withMessage("OTP is required")
        .isLength({ min: 4, max: 8 }).withMessage("Invalid OTP length")
        .isNumeric().withMessage("OTP must be numeric"),

    // require at least one contact method
    body().custom((value, { req }) => {
        if (!req.body.email && !req.body.phone_number) {
            throw new Error("Either email or phone_number is required");
        }
        return true;
    }),
];


/**
 * Reset password (using OTP or token) validator
 * - expects email + password fields OR token route usage
 */
export const resetPasswordValidator = [
    body("email")
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Invalid email"),

    body("password")
        .notEmpty().withMessage("Password is required")
        .isLength({ min: 8 }).withMessage("Password too short")
        .matches(strongPasswordRegex).withMessage("Password must include upper, lower, number and special char"),

    body("confirmPassword")
        .notEmpty().withMessage("Confirm password is required")
        .custom((val, { req }) => val === req.body.password)
        .withMessage("Passwords do not match"),

    // optional token or otp checks (if client sends them)
    body("token").optional().trim().isLength({ min: 20 }).withMessage("Invalid token"),
    body("otp").optional().isNumeric().withMessage("Invalid OTP"),
];


/**
 * Send reset link validator
 */
export const sendResetLinkValidator = [
    // body("email")
    //     .notEmpty().withMessage("Email is required")
    //     .isEmail().withMessage("Invalid email")
    //     .normalizeEmail()
];


/**
 * Verify reset link (token as URL param)
 */
export const verifyResetTokenValidator = [
    param("token")
        .exists().withMessage("Token parameter is required")
        .isString().withMessage("Invalid token")
        .isLength({ min: 20 }).withMessage("Invalid or expired token"),
];


/**
 * Verify token OTP route validator (if you have a route /auth/verify/token)
 * expecting token in body
 */
export const verifyTokenValidator = [
    body("token")
        .notEmpty().withMessage("Token is required")
        .isString().withMessage("Invalid token"),
];


/**
 * Change password validator (when user is logged-in or admin resets)
 */
export const changePasswordValidator = [
    body("currentPassword")
        .optional()
        .notEmpty().withMessage("Current password is required when changing password"),

    body("password")
        .notEmpty().withMessage("Password is required")
        .isLength({ min: 8 }).withMessage("Password must be at least 8 characters long")
        .matches(strongPasswordRegex).withMessage("Password must include upper, lower, number and special char"),

    body("confirmPassword")
        .notEmpty().withMessage("Confirm password is required")
        .custom((val, { req }) => val === req.body.password)
        .withMessage("Passwords do not match"),
];


export default {
    registerValidator,
    loginValidator,
    sendOtpValidator,
    verifyOtpValidator,
    resetPasswordValidator,
    sendResetLinkValidator,
    verifyResetTokenValidator,
    verifyTokenValidator,
    changePasswordValidator
};