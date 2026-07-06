// models/Document.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const documentSchema = new Schema({
    description: { type: String, trim: true, maxlength: 10000 },
    project: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    department: { type: Schema.Types.ObjectId, ref: "Department" },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", default: null },
    projectManager: { type: Schema.Types.ObjectId, ref: "User", default: null },
    documentDonor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    documentVendor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startDate: { type: Date, default: Date.now },
    status: { type: String, enum: ["Draft", "Pending", "Approved", "Rejected"], default: "Draft" },

    tags: [{ type: String, lowercase: true, trim: true }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    isArchived: { type: Boolean, default: false },
    ispublic: { type: Boolean, default: true },

    docExpiresAt: { type: Date, default: null },
    docExpireDuration: {
        type: String,
        enum: ['oneday', 'oneweek', 'onemonth', 'custom', 'onetime', 'lifetime'],
        default: 'lifetime'
    },
    DoccustomStart: { type: Date, default: null },
    DoccustomEnd: { type: Date, default: null },

    metadata: {
        fileName: { type: String, trim: true },
        fileDescription: { type: String, trim: true },
        mainHeading: { type: String, trim: true }
    },
    archivedAt: { type: Date, default: null },
    compliance: {
        isCompliance: { type: Boolean, default: false },
        expiryDate: { type: Date, default: null },
        retentionPeriod: { type: Number, default: null },
        complianceType: { type: String, trim: true }
    },
    // complianceStatus: { type: Boolean, default: false },
    files: [{ type: Schema.Types.ObjectId, ref: "File", default: null }],

    signature: {
        fileName: { type: String, trim: true },
        fileUrl: { type: String, trim: true }
    },

    link: { type: String },

    documentApprovalAuthority: [{
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        designation: { type: Schema.Types.ObjectId, ref: "Designation", required: true },
        priority: { type: Number, required: true, min: 0 },
        isMailSent: { type: Boolean, default: false },
        status: {
            type: String,
            enum: ["Pending", "Approved", "Rejected"],
            default: "Pending"
        },
        isApproved: { type: Boolean, default: false },
        remark: { type: String, trim: true, maxlength: 500 },
        approvedOn: { type: Date },
        addDate: { type: Date }
    }],

    wantApprovers: { type: Boolean, default: false },
    sharedWithUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    comment: { type: String, trim: true, maxlength: 1000 },

    /** -------- CURRENT VERSION METADATA -------- **/
    currentVersionNumber: {
        type: mongoose.Schema.Types.Decimal128,
        default: mongoose.Types.Decimal128.fromString("1.0")
    },
    currentVersionLabel: { type: String, default: "1.0" },

    /** -------- HIGH-SCALE VERSION TRACKING -------- **/
    currentVersion: { type: Schema.Types.ObjectId, ref: "DocumentVersion" },
    firstVersion: { type: Schema.Types.ObjectId, ref: "DocumentVersion" },
    latestVersion: { type: Schema.Types.ObjectId, ref: "DocumentVersion" }

}, { timestamps: true });

/** -------------------- INDEXES -------------------- **/
documentSchema.index({ status: 1 });
documentSchema.index({ department: 1 });
documentSchema.index({
    "metadata.fileDescription": "text",
    "metadata.mainHeading": "text",
    tags: "text"
});
documentSchema.index({ createdAt: 1 });
documentSchema.index({ "compliance.expiryDate": 1 });
documentSchema.index({ tags: 1 });
documentSchema.index({ isArchived: 1, isDeleted: 1, owner: 1 });
documentSchema.index({ currentVersion: 1 });
documentSchema.index({ latestVersion: 1 });

/** -------------------- VIRTUALS -------------------- **/
documentSchema.virtual("isExpired").get(function () {
    return this.compliance.expiryDate ? this.compliance.expiryDate < new Date() : false;
});

const Document = mongoose.model("Document", documentSchema);
export default Document;
