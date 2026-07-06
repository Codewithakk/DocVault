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
        require: true,
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
