import mongoose from "mongoose";

const PermissionLogsSchema = new mongoose.Schema({
    document: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    user: {
        type: { username: String, email: String },
        required: true
    },
    access: {
        type: String,
        enum: ["view", "edit", "download", "none"],
        required: true
    },
    isExternal: { type: Boolean, default: false },
    requestStatus: {
        type: String,
        enum: ["approved", "pending", "rejected"],
        required: true
    },
    expiresAt: { type: Date, default: null }, // for timed shares
    duration: { type: String, enum: ['oneday', 'oneweek', 'onemonth', 'custom', 'onetime', 'lifetime'], default: 'lifetime' },
    used: { type: Boolean, default: false }, // for onetime shares
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    requestedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Unique index to prevent duplicate user permissions per document
PermissionLogsSchema.index({ document: 1, user: 1 }, { unique: true });

export default mongoose.model("PermissionLogs", PermissionLogsSchema);