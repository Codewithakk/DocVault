// models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { API_CONFIG } from "../config/ApiEndpoints.js";
import { LocationSchema } from "./Location.js";

// Sub-schema for User Details
const userDetailsSchema = new mongoose.Schema(
    {
        employee_id: {
            type: String,
            trim: true,
            required: true,
        },
        designation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Designation",
        },
        department: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Department",
        },
    },
    { _id: false }
);

// Sub-schema for Vendor Details
const vendorDetailsSchema = new mongoose.Schema(
    {
        company_name: { type: String, trim: true, required: true },
        gst_number: {
            type: String,
            trim: true,
            unique: true,
            sparse: true,
            uppercase: true,
        },
        contact_person: { type: String, trim: true },
        services_offered: { type: [String], default: [] },
        designation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Designation",
        },
    },
    { _id: false }
);

// Sub-schema for Donor Details
const donorDetailsSchema = new mongoose.Schema(
    {
        donor_type: {
            type: String,
            enum: ["individual", "corporate", "ngo"],
            default: "individual",
        },
        organization_name: { type: String, trim: true },
        id_proof: { type: String, trim: true },
        designation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Designation",
        },
    },
    { _id: false }
);

// Main User Schema
const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        phone_number: { type: Number, trim: true },
        location: LocationSchema,
        post_code: { type: String, trim: true },
        address: { type: String, trim: true },
        raw_password: {
            type: String,
            minlength: 8,
            select: false,
        },
        password: {
            type: String,
            select: false,
        },
        profile_type: {
            type: String,
            enum: ["donor", "vendor", "user", "admin", "superadmin"],
            default: "user",
        },
        profile_image: { type: String, default: null },
        status: {
            type: String,
            enum: ["Active", "Inactive", "Blocked"],
            default: "Active",
        },
        passwordVerification: {
            type: String,
            enum: ["pending", "verified"],
            default: "verified"
        },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        otp: { type: String, select: false },              // Stores temporary OTP
        otpExpiresAt: { type: Date, select: false },      // OTP expiration timestamp
        lastLogin: { type: Date, default: null },

        // Role-specific details
        userDetails: userDetailsSchema,
        vendorDetails: vendorDetailsSchema,
        donorDetails: donorDetailsSchema,

    },

    { timestamps: true } // still keeps createdAt and updatedAt
);

// Compound & individual indexes
userSchema.index({ profile_type: 1, createdAt: -1 });
userSchema.index({ name: 1 });
userSchema.index({ phone_number: 1 });
userSchema.index({ addedBy: 1 });
userSchema.index({ status: 1 });
userSchema.index({ "userDetails.department": 1 });
userSchema.index({ "userDetails.designation": 1 });


// Middleware to hash password
userSchema.pre("save", async function (next) {
    if (!this.isModified("raw_password")) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.raw_password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Middleware to update accountUpdatedAt
userSchema.pre("save", function (next) {
    if (!this.isNew) {
        this.accountUpdatedAt = new Date();
    }
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token

userSchema.methods.generateAuthToken = function () {
    return jwt.sign(
        { userId: this._id, email: this.email, profile_type: this.profile_type },
        API_CONFIG.JWT_SECRET,
        { expiresIn: API_CONFIG.TOKEN_LOGIN_EXPIRES_IN || "7d" }
    );
};

userSchema.pre("save", async function (next) {
    if (!this.location) return next();
  
    const City = mongoose.model("City");
  
    const city = await City.findById(this.location.city).populate("state");
  
    if (!city) return next(new Error("Invalid city"));
  
    if (!city.state._id.equals(this.location.state)) {
      return next(new Error("City does not belong to state"));
    }
  
    if (!city.state.country.equals(this.location.country)) {
      return next(new Error("State does not belong to country"));
    }
  
    next();
  });
  
// Hide sensitive fields
userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.raw_password;
    delete user.password;
    return user;
};

const User = mongoose.model("User", userSchema);

export default User;
