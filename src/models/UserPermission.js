// models/UserPermission.js
import mongoose from "mongoose";

const userPermissionSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
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
            delete: { type: Boolean, default: true }
        },
        assigned_by: {
            user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
            name: { type: String, required: true },
            email: { type: String, required: true }
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
userPermissionSchema.index({ user_id: 1, menu_id: 1 }, { unique: true });

const UserPermission = mongoose.model('UserPermission', userPermissionSchema);
export default UserPermission;