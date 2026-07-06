// models/Session.js
import mongoose from 'mongoose';

const UserFolderHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
    },
    departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department'
    },
    recentFolders: [{
        folderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Folder',
            required: true
        },
        folderName: { type: String, required: true },
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
        departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
        visitedAt: { type: Date, default: Date.now },
        path: { type: String } // Full folder path
    }],
    lastVisitedFolder: {
        folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder' },
        folderName: { type: String },
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
        departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
        visitedAt: { type: Date }
    }
}, {
    timestamps: true
});

// Index for quick access
UserFolderHistorySchema.index({ userId: 1 });
UserFolderHistorySchema.index({ 'recentFolders.visitedAt': -1 });

// Method to add folder to recent visits
UserFolderHistorySchema.methods.addRecentFolder = function (folderData) {
    const { folderId, folderName, projectId, departmentId, path } = folderData;

    const toObjectId = (id) => {
        if (!id) return null;
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        return new mongoose.Types.ObjectId(id);
    };

    // Remove if already exists
    this.recentFolders = this.recentFolders.filter(
        f => f.folderId.toString() !== folderId.toString()
    );

    // Add to beginning
    this.recentFolders.unshift({
        folderId: toObjectId(folderId),
        folderName,
        projectId: toObjectId(projectId),
        departmentId: toObjectId(departmentId),
        path,
        visitedAt: new Date()
    });

    // Keep only last 5 folders
    if (this.recentFolders.length > 5) {
        this.recentFolders = this.recentFolders.slice(0, 5);
    }

    // Update last visited folder
    this.lastVisitedFolder = {
        folderId: toObjectId(folderId),
        folderName,
        projectId: toObjectId(projectId),
        departmentId: toObjectId(departmentId),
        visitedAt: new Date()
    };

    return this.save();
};


const UserFolderHistory = mongoose.model('UserFolderHistory', UserFolderHistorySchema);
export default UserFolderHistory;