import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema(
    {
        actorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },

        entityId: {
            type: mongoose.Schema.Types.ObjectId
        },

        entityType: {
            type: String,
            enum: [
                'Document',
                'Folder',
                'File',
                'UserToken',
                'UserPermission',
                'UserFolderHistory',
                'TempFile',
                'SharedWith',
                'Project',
                'ProjectType',
                'PermissionLogs',
                'MenuAssignment',
                'Menu',
                'FolderPermissionLogs',
                'DocumentVersion',
                'Designation',
                'Department',
                'User',
                'Permission',
                'Workflow',
                'System'
            ]
        },

        action: {
            type: String,
            required: true,
            enum: [
                'CREATE',
                'UPDATE',
                'DELETE',
                'SOFT_DELETE',
                'UPDATE STATUS',
                'VIEW',
                'DOWNLOAD',
                'EXPORT',
                'ADDED DOCUMENT',
                'UPDATED DOCUMENT',
                'UPDATED SHARE',
                'UPDATE SHARE SETTINGS',
                'SHARE DOCUMENT',
                'PERMISSION UPDATE',
                'UPDATE USER SHARE',
                'REMOVE SHARED USER',
                'INVITE_USER',
                'INVITE_ACCEPTED',
                'REQUEST_ACCESS',
                'ACCESS_GRANTED',
                'CREATE_APPROVAL_REQUEST',
                'UPDATE_APPROVAL_REQUEST',
                'UPDATE APPROVAL STATUS',
                'SEND_APPROVAL_MAIL',
                'APPROVAL_MAIL_VERIFIED',
                'CREATE_APPROVAL_REQUEST',
                'RESTORE DOCUMENT',
                'RENEW_ACCESS',
                'ASSIGN_MENUS',
                'UNASSIGN_MENUS',
                'UPLOAD',
                'SYSTEM',
                'MOVE',
                'RENAME',
                'RESTORE',
                'SHARE',
                'UNSHARE',
                'ACCESS_REQUEST',
                'UPDATE_PERMISSION',
                'UPDATE_FOLDER_PERMISSION',
                'UPDATE_LOG_PERMISSION',
                'FOLDER_ACCESS_REQUEST',
                'ACCESS_APPROVED',
                'ADDED_USER',
                'DELETE_USER',
                'RECYCLE',
                'ARCHIVE',
                'UNARCHIVE'
            ]
        },
        details: { type: String },
        meta: {
            type: Object,
            default: {}
        }
    },
    {
        timestamps: true,
        strict: true
    }
);

// Indexes
ActivityLogSchema.index({ entityId: 1, entityType: 1 });
ActivityLogSchema.index({ actorId: 1 });
ActivityLogSchema.index({ action: 1 });
ActivityLogSchema.index({ createdAt: -1 });

export default mongoose.model('ActivityLog', ActivityLogSchema);
