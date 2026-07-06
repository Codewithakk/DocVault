
import mongoose from "mongoose";

const FolderPermissionLogsSchema = new mongoose.Schema({
    folder: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    user: {
        type: { username: String, email: String },
        required: true,
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
        default: "pending"
    },
    expiresAt: { type: Date, default: null },
    duration: {
        type: String,
        enum: ['oneday', 'oneweek', 'onemonth', 'custom', 'onetime', 'lifetime'],
        default: 'lifetime'
    },
    used: { type: Boolean, default: false }, // for onetime shares
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    requestedAt: { type: Date, default: Date.now },
},
    { timestamps: true }
);

//Prevent duplicate logs for same user/folder
FolderPermissionLogsSchema.index({ folder: 1, "user.email": 1 }, { unique: true });

export default mongoose.model("FolderPermissionLogs", FolderPermissionLogsSchema);
