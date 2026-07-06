import Department from "../models/Departments.js";
import Designation from "../models/Designation.js";
import Project, { ProjectType } from "../models/Project.js";
import User from "../models/User.js";
import { formatDateDDMMYYYY } from "./formatDate.js";
import logger from "./logger.js";

/**
 * renderProjectDetails
 * @param {Request} req Express request object
 * @param {Response} res Express response object
 * @param {string|null} projectId MongoDB ID of project (null for new project)
 * @param {Object} meta SEO metadata: { pageTitle, pageDescription, metaKeywords }
 */
export async function renderProjectDetails(req, res, projectId = null, meta = {}) {
    try {
        const project = projectId
            ? await Project.findById(projectId)
                .populate("projectManager", "name")
                .populate("projectCollaborationTeam", "name")
                .populate("approvalAuthority.userId", "name")
                .populate("approvalAuthority.designation", "name")
                .populate("donor", "name profile_type")
                .populate("vendor", "name profile_type")
                .populate("projectType", "name")
                .lean()
            : null;

        if (project) {
            project.projectStartDateFormatted = formatDateDDMMYYYY(project.projectStartDate);
            project.projectEndDateFormatted = formatDateDDMMYYYY(project.projectEndDate);
            project.projectStartDateISO = formatDateDDMMYYYY(project.projectStartDate);
            project.projectEndDateISO = formatDateDDMMYYYY(project.projectEndDate);
        }

        const [users, departments, donors, vendors, projectTypes, designations] = await Promise.all([
            User.find({ profile_type: "user", status: "Active" })
                .select("name userDetails")
                .populate("userDetails.department", "name")
                .populate("userDetails.designation", "name")
                .lean(),
            Department.find({ status: "Active" }, "name").lean(),
            User.find({ profile_type: "donor" }, "name").lean(),
            User.find({ profile_type: "vendor" }, "name").lean(),
            ProjectType.find({ status: "Active", isActive: true }, "name").lean(),
            Designation.find({ status: "Active", isDonorOrVendor: false }, "name").lean(),
        ]);

        // Set SEO metadata
        res.locals.pageTitle = meta.pageTitle || (project ? "Project Details" : "Add Project");
        res.locals.pageDescription = meta.pageDescription || "Manage project details.";
        res.locals.metaKeywords = meta.metaKeywords || "project, workspace, management";
        res.locals.canonicalUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

        res.render("pages/projects/project-details", {
            title: project ? "Project Details" : "Add Project",
            project,
            users,
            departments,
            donors,
            vendors,
            projectTypes,
            designations,
            user: req.user,
        });

    } catch (err) {
        logger.error("Error loading project:", err);

        // Error SEO metadata
        res.locals.pageTitle = "Error";
        res.locals.pageDescription = "Unable to load project details.";
        res.locals.metaKeywords = "project error, page load error";
        res.locals.canonicalUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

        res.status(500).render("pages/projects/project-details", {
            title: "Project Details",
            project: null,
            users: [],
            departments: [],
            donors: [],
            vendors: [],
            projectTypes: [],
            designations: [],
            user: req.user,
            error: "Unable to load project details.",
        });
    }
}