import Notification from "../models/Notification.js";
import logger from "../utils/logger.js";
import { successResponse, failResponse, errorResponse } from "../utils/responseHandler.js";

//Page Controllers

// Render Notifications page
export const showNotificationsPage = (req, res) => {
    try {
        res.render("pages/notifications", {
            pageTitle: "Notifications",
            pageDescription: "View all your notifications, alerts, and updates in one place.",
            metaKeywords: "notifications, alerts, user updates, activity alerts",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user
        });
    } catch (err) {
        console.error("Error loading notifications page:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load notifications page.",
            metaKeywords: "notifications error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            message: "Unable to load notifications",
            user: req.user
        });
    }
};

//API Controllers

export const addNotification = async ({
    recipient,
    sender = null,
    type,
    title,
    message,
    relatedDocument = null,
    relatedProject = null,
    priority = "medium",
    actionUrl = null
}) => {
    try {
        const data = {
            recipient,
            sender,
            type,
            title,
            message,
            relatedDocument,
            relatedProject,
            priority,
            actionUrl
        };

        const notification = await Notification.create(data);
        return notification;
    } catch (error) {
        console.error("Error creating notification:", error);
        throw error; // rethrow so the parent function can handle it
    }
};



// ------------------- Create Notification -------------------
export const createNotification = async (req, res) => {
    try {
        const data = {
            recipient: req.body.recipient,
            sender: req.user?._id || null,
            type: req.body.type,
            title: req.body.title,
            message: req.body.message,
            relatedDocument: req.body.relatedDocument || null,
            relatedProject: req.body.relatedProject || null,
            priority: req.body.priority || "medium",
            actionUrl: req.body.actionUrl || null
        };

        const notification = await Notification.create(data);
        return successResponse(res, notification, "Notification created successfully", 201);
    } catch (error) {
        return errorResponse(res, error);
    }
};

// ------------------- Get User Notifications -------------------
export const getUserNotifications = async (req, res) => {
    try {
        const userId = req.user._id;

        const draw = parseInt(req.query.draw) || 1;
        const limit = parseInt(req.query.length, 10) || 10;
        const start = parseInt(req.query.start, 10) || 0;
        const searchValue = req.query.search?.value || "";

        const orderColumnIndex = req.query.order?.[0]?.column || 2;
        const orderDir = req.query.order?.[0]?.dir || "desc";
        const columns = ["_id", "message", "createdAt", "action"];
        const sortField = columns[orderColumnIndex] || "createdAt";
        const sort = { [sortField]: orderDir === "asc" ? 1 : -1 };

        // Build query
        const query = { recipient: userId };
        if (searchValue) {
            query.message = { $regex: searchValue, $options: 'i' };
        }

        const notifications = await Notification.find(query)
            .sort(sort)
            .skip(start)
            .limit(limit)
            .populate("sender", "name")
            .populate("relatedDocument", "metadata.fileName")
            .populate("relatedProject", "projectName")
            .lean();

        const total = await Notification.countDocuments({ recipient: userId });
        const filtered = await Notification.countDocuments(query);
        const totalUnread = await Notification.countDocuments({ recipient: userId, isRead: false });

        return res.json({
            draw,
            recordsTotal: total,
            recordsFiltered: filtered,
            data: notifications,
            totalUnread
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server Error", error });
    }
};



// ------------------- Get Unread Count -------------------
// Controller: getUnreadNotifications.js
export const getUnreadNotifications = async (req, res) => {
    try {
        const userId = req.user._id;

        // Pagination parameters
        const page = parseInt(req.query.page, 10) || 1; // default page 1
        const limit = parseInt(req.query.limit, 10) || 10; // default 50 per page
        const skip = (page - 1) * limit;

        // Fetch unread notifications with pagination
        const notifications = await Notification.find({ recipient: userId, isRead: false })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("sender", "name")
            .populate("relatedDocument", "metadata.fileName")
            .populate("relatedProject", "projectName");

        // Total unread count
        const totalUnread = await Notification.countDocuments({ recipient: userId, isRead: false });

        return successResponse(res, {
            page,
            limit,
            totalUnread,
            totalPages: Math.ceil(totalUnread / limit),
            notifications
        }, "Unread notifications fetched successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};


// ------------------- Mark Single Notification as Read -------------------
export const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user._id },
            { isRead: true },
            { new: true }
        );

        if (!notification) return failResponse(res, "Notification not found or unauthorized", 404);

        return successResponse(res, notification, "Notification marked as read");
    } catch (error) {
        return errorResponse(res, error);
    }
};

// ------------------- Delete Notification -------------------
export const deleteNotification = async (req, res) => {
    try {
        const result = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
        if (!result) return failResponse(res, "Notification not found or unauthorized", 404);

        return successResponse(res, null, "Notification deleted successfully");
    } catch (error) {
        return errorResponse(res, error);
    }
};
