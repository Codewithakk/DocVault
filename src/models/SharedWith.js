import mongoose from "mongoose";

const sharedWithSchema = new mongoose.Schema({
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedby: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    accessLevel: { type: String, enum: ['view', 'edit'], default: 'view' },
    canDownload: { type: Boolean, default: false },
    inviteStatus: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
    expiresAt: { type: Date, default: null }, // for timed shares
    duration: { type: String, enum: ['oneday', 'oneweek', 'onemonth', 'custom', 'onetime', 'lifetime'], default: 'lifetime' },
    customStart: { type: Date, default: null }, 
    used: { type: Boolean, default: false }, // for onetime shares
    generalAccess: { type: Boolean, default: false }, // add this for general role shares
    generalRole: { type: String, enum: ['viewer', 'editor'], default: 'viewer' }
}, { timestamps: true });

// Useful indexes
sharedWithSchema.index({ document: 1, user: 1 }, { unique: true }); // Prevent duplicate shares
sharedWithSchema.index({ user: 1 });
sharedWithSchema.index({ document: 1 });
sharedWithSchema.index({ expiresAt: 1 });

const SharedWith = mongoose.model("SharedWith", sharedWithSchema);
export default SharedWith;
