// models/MenuAssignment.js
import mongoose from "mongoose";


const menuAssignmentSchema = new mongoose.Schema(
    {
        designation_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Designation',
            required: true,
        },
        menu_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Menu',
            required: true,
        },
        permissions: {
            read: { type: Boolean, default: true },
            write: { type: Boolean, default: true },
            delete: { type: Boolean, default: true },
        },
        assigned_date: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index to ensure unique assignment
menuAssignmentSchema.index({ designation_id: 1, menu_id: 1 }, { unique: true });


const MenuAssignment = mongoose.models.MenuAssignment || mongoose.model('MenuAssignment', menuAssignmentSchema);

export default MenuAssignment;