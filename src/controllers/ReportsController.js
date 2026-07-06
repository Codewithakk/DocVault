import { docTypes, profile_type } from "../constant/Constant.js";
import Designation from "../models/Designation.js";
import { activityLogger } from "../helper/activityLogger.js";

// Render Dashboard page
export const showReportPage = async (req, res) => {
    try {
        const designation = await Designation.find({ status: 'Active' })
            .select("name priority")
            .sort({ priority: 1 });

        res.render("pages/reports/reports", {
            pageTitle: "Reports",
            pageDescription: "View and generate reports across your workspace projects and documents.",
            metaKeywords: "reports, project reports, document reports, analytics",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            roles: profile_type,
            designation,
            docTypes
        });
    } catch (err) {
        logger.error("Reports page render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load reports page.",
            metaKeywords: "reports error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            message: "Unable to load dashboard"
        });
    }
};

export const showComplianceRetentionPage = async (req, res) => {
    try {
        res.render("pages/reports/complianceRetention", {
            pageTitle: "Compliance Retention",
            pageDescription: "View and manage compliance and retention policies for your documents.",
            metaKeywords: "compliance, retention, document compliance, policies",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            roles: profile_type
        });
    } catch (err) {
        logger.error("Compliance Retention page render error:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load compliance retention page.",
            metaKeywords: "compliance retention error, page load error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            user: req.user,
            message: "Unable to load ComplianceRetention Page"
        });
    }
};
