import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Department name is required"],
        trim: true,
        unique: true,
        maxlength: [250, "Department name cannot exceed 250 characters"]
    },
    priority: {
        type: Number,
        default: 0,
        min: [0, 'Priority must be greater than or equal to 0'],
    },
    status: {
        type: String,
        enum: ["Active", "Inactive"],
        default: "Active"
    },
    addedBy: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
    },
    updatedBy: {
        name: { type: String },
        email: { type: String },
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    },
    add_date: {
        type: Date,
        default: Date.now
    },
    updated_date: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false
});

// Pre-save hook to auto-update `updated_date` on save
departmentSchema.pre("save", function (next) {
    this.updated_date = Date.now();
    next();
});

const Department = mongoose.model("Department", departmentSchema);

export default Department;
