// models/Approval.js
import mongoose from "mongoose";

const approvalSchema = new mongoose.Schema({
    document: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
        required: true
    },
    approver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    priority: {
        type: Number,
        required: true,
        min: 1
    },
    isMailSent: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected", "In Review"],
        default: "Pending"
    },
    isApproved: {
        type: Boolean,
        default: false
    },
    remark: {
        type: String,
        trim: true,
        maxlength: 500
    },
    approvedOn: {
        type: Date
    },
    addDate: {
        type: Date
    }
}, { timestamps: true });

// Index for efficient queries
approvalSchema.index({ document: 1, priority: 1 });
approvalSchema.index({ approver: 1, status: 1 });

const Approval = mongoose.model("Approval", approvalSchema);
export default Approval;