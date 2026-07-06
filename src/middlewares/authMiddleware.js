import SharedWith from "../models/SharedWith.js";
import User from "../models/User.js"; // note the .js extension
import logger from "../utils/logger.js";

/**
 * Authentication middleware (checks session)
 */
export const authenticate = async (req, res, next) => {
    try {
        if (!req.session.user) {
            if (req.originalUrl.startsWith("/api")) {
                return res.redirect("/login");
            } else {
                return res.redirect("/login");
            }
        }

        // Fetch fresh user data from DB
        const user = await User.findById(req.session.user._id).select("-password -raw_password");
        if (!user) {
            if (req.originalUrl.startsWith("/api")) {
                return res.status(401).json({ success: false, message: "User not found." });
            } else {
                return res.redirect("/login");
            }
        }

        if (user.status !== "Active") {
            if (req.originalUrl.startsWith("/api")) {
                return res.status(401).json({ success: false, message: "Account is not active." });
            } else {
                return res.redirect("/login");
            }
        }

        req.user = user;
        next();
    } catch (error) {
        logger.error("Auth error:", error);
        if (req.originalUrl.startsWith("/api")) {
            return res.status(401).json({ success: false, message: "Authentication failed." });
        } else {
            return res.redirect("/login");
        }
    }
};

/**
 * Authorization middleware (checks profile_type)
 */
export const authorize = (...allowedProfiles) => {
    return (req, res, next) => {
        if (!req.session.user || !allowedProfiles.includes(req.session.user.profile_type)) {
            return res.status(403).render('no-permission', {
                title: '403 - Forbidden',
                message: 'You don\'t have permission to access this resource.'
            });
        }
        next();
    };
};

export const canAccessDocument = async (userId, documentId) => {
    const shared = await SharedWith.findOne({
        document: documentId,
        user: userId,
        inviteStatus: 'accepted'
    });
    return !!shared;
};

export const optionalAuth = async (req, res, next) => {
    try {
        // If no session exists → public request
        if (!req.session || !req.session.user) {
            req.user = null;
            return next();
        }

        // Try to load user
        const user = await User.findById(req.session.user._id).select("-password -raw_password");

        if (!user) {
            req.user = null;
            return next();
        }

        if (user.status !== "Active") {
            req.user = null;
            return next();
        }

        req.user = user;
        next();
    } catch (err) {
        logger.error("Optional Auth Error:", err);
        req.user = null;
        next(); // DO NOT block request
    }
};