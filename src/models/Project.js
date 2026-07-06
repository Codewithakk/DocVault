import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";


const projectTypeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Project type name is required"],
            trim: true,
            maxlength: [100, "Name cannot exceed 100 characters"],
            unique: true,
            index: true,
        },
        priority: {
            type: Number,
            default: 0,
            min: [0, "Priority cannot be negative"],
        },
        status: {
            type: String,
            enum: ["Active", "Inactive"],
            default: "Active",
            index: true,
        },
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        isActive: { type: Boolean, default: true, index: true },
    },
    { timestamps: true }
);

projectTypeSchema.plugin(mongoosePaginate);

const ProjectType =
    mongoose.models.ProjectType ||
    mongoose.model("ProjectType", projectTypeSchema);

/**
 * Project Schema
 */
const projectSchema = new mongoose.Schema(
    {
        projectName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
            index: true,
        },
        projectCode: {
            type: String,
            required: true,
            uppercase: true,
            unique: true,
            maxlength: 20,
            index: true,
        },

        // Reference ProjectType master
        projectType: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProjectType",
            required: true,
            index: true,
        },
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        projectDescription: { type: String, trim: true, maxlength: 1000 },

        projectManager: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true
            }
        ],
        projectCollaborationTeam: [
            { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        ], // multiple select
        approvalAuthority: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                designation: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Designation",
                    required: true,
                },
                priority: {
                    type: Number, // smaller number = higher priority (e.g., 1, 2, 3)
                    required: true,
                },
                isMailSent: {
                    type: Boolean,
                    default: false
                },
                status: {
                    type: String,
                    enum: ["Pending", "Approved", "Rejected"],
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
            },
        ],
        donor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // multiple select
        vendor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // multiple select
        projectLogo: { type: String }, // URL or file path
        projectStartDate: { type: Date, required: true, index: true },
        projectEndDate: { type: Date, required: true, index: true },
        totalTags: { type: Number, default: 0 },
        totalFiles: { type: Number, default: 0 },
        projectStatus: {
            type: String,
            enum: ["Active", "Inactive", "Closed"],
            default: "Active",
            index: true,
        },
        projectDuration: { type: Number, default: 0 },
        priority: {
            type: String,
            enum: ["Low", "Medium", "High", "Critical"],
            default: "Medium",
        },
        tags: [{ type: String, lowercase: true, trim: true }],
        isActive: { type: Boolean, default: true, index: true },
    },
    { timestamps: true }
);

projectSchema.plugin(mongoosePaginate);

// Virtuals
projectSchema.virtual("duration").get(function () {
    if (!this.projectStartDate || !this.projectEndDate) return 0;
    return Math.ceil(
        (this.projectEndDate - this.projectStartDate) /
        (1000 * 60 * 60 * 24)
    );
});

projectSchema.virtual("isOverdue").get(function () {
    return this.projectEndDate < new Date() && this.projectStatus !== "Closed";
});

// Instance methods
projectSchema.methods.canManage = function (userId) {
    return this.projectManager.toString() === userId.toString();
};

const Project =
    mongoose.models.Project || mongoose.model("Project", projectSchema);

export default Project;
export { ProjectType };

