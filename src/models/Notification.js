import mongoose from "mongoose";


const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    type: {
        type: String,
        required: true,
        enum: [
            "document",
            "document_approved",
            'document',
            'document_discussion',
            "approval_request",
            "approval_update",
            "project_assigned",
            "project",
            "mention",
            "system_alert",
            "storage_warning",
        ]
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    relatedDocument: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
        default: null
    },
    relatedProject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
        default: null
    },
    isRead: {
        type: Boolean,
        default: false
    },
    priority: {
        type: String,
        enum: ["low", "medium", "high", "urgent"],
        default: "medium"
    },
    actionUrl: {
        type: String,
        default: null
    },
    expiresAt: {
        type: Date,
        default: function () {
            return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        }
    }
}, {
    timestamps: true
});

// Indexes
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ createdAt: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
notificationSchema.index({ type: 1 });

// Method to mark as read
notificationSchema.methods.markAsRead = function () {
    this.isRead = true;
    return this.save();
};

// Static method to create a notification
notificationSchema.statics.createNotification = function (data) {
    return this.create(data);
};

// Static method to get unread count for user
notificationSchema.statics.getUnreadCount = function (userId) {
    return this.countDocuments({ recipient: userId, isRead: false });
};

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;