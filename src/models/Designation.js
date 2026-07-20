import mongoose from "mongoose";

const designationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    priority: {
        type: Number,
        required: true,
        default: 0
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    description: {
        type: String,
        default: ''
    },
    isDonorOrVendor: {
        type: Boolean,
        required: true,
        default: false
    },
    //permission fields
    ownFiles: {
        type: Boolean,
        default: false
    },
    ownFolders: {
        type: Boolean,
        default: false
    },
    teamFiles: {
        type: Boolean,
        default: false
    },
    deptFiles: {
        type: Boolean,
        default: false
    },
    otherDepts: {
        type: Boolean,
        default: false
    },
    allOrgs: {
        type: Boolean,
        default: false
    },
    added_by: {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        name: { type: String, required: true },
        email: { type: String, required: true }
    },
    updated_by: {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        name: { type: String },
        email: { type: String }
    }
}, {
    timestamps: { createdAt: 'add_date', updatedAt: 'updated_date' }
});

const Designation = mongoose.model("Designation", designationSchema);

export default Designation;