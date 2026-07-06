import { body, param, query } from "express-validator";

// Create Project

const isValidObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));

/**
 * Accept either a single id or an array of ids.
 * If present, ensure every element is a valid ObjectId.
 */
const objectIdArrayValidator = (fieldName) =>
    body(fieldName)
        .optional()
        .custom((val) => {
            if (val === null || val === undefined) return true;
            const arr = Array.isArray(val) ? val : [val];
            if (!Array.isArray(arr) || arr.length === 0) return true; // allow empty arrays (use controllers to require at least 1 when necessary)
            for (const x of arr) {
                if (!isValidObjectId(x)) throw new Error(`${fieldName} must contain valid ObjectId(s)`);
            }
            return true;
        });

/**
 * approvalAuthority validation:
 * - must be array when present
 * - each element must have userId (ObjectId), designation (ObjectId), priority (positive integer), optional status (enum)
 * - no duplicate userId
 * - no duplicate priority
 */
const approvalAuthorityArrayValidator = body("approvalAuthority")
    .optional()
    .custom((val) => {
        if (!Array.isArray(val)) throw new Error("approvalAuthority must be an array");

        const users = [];
        const priorities = [];
        for (const [i, a] of val.entries()) {
            if (!a) throw new Error(`approvalAuthority[${i}] is invalid`);
            if (!a.userId || !isValidObjectId(a.userId)) throw new Error(`approvalAuthority[${i}].userId is invalid`);
            if (!a.designation || !isValidObjectId(a.designation)) throw new Error(`approvalAuthority[${i}].designation is invalid`);
            if (a.priority === undefined || a.priority === null || String(a.priority).trim() === "") {
                throw new Error(`approvalAuthority[${i}].priority is required`);
            }
            const pr = Number(a.priority);
            if (!Number.isInteger(pr) || pr <= 0) throw new Error(`approvalAuthority[${i}].priority must be a positive integer`);
            if (a.status && !["Pending", "Approved", "Rejected"].includes(a.status)) {
                throw new Error(`approvalAuthority[${i}].status is invalid`);
            }

            users.push(String(a.userId));
            priorities.push(pr);
        }

        const uniqUsers = new Set(users);
        if (uniqUsers.size !== users.length) throw new Error("Duplicate users in approvalAuthority are not allowed");

        const uniqP = new Set(priorities);
        if (uniqP.size !== priorities.length) throw new Error("Duplicate priorities in approvalAuthority are not allowed");

        return true;
    });

const PROJECT_STATUS = ["Active", "Inactive", "Closed"];

// CREATE validators
export const createProjectValidator = [
    body("projectName")
        .notEmpty().withMessage("Project name is required")
        .isLength({ min: 3, max: 200 }).withMessage("Project name must be 3–200 characters"),

    body("projectCode")
        .notEmpty().withMessage("Project code is required")
        .isAlphanumeric().withMessage("Project code must be alphanumeric")
        .isLength({ max: 20 }).withMessage("Project code max length is 20"),

    body("projectManager")
        .notEmpty().withMessage("projectManager is required"), // must provide at least one manager

    body("projectType")
        .notEmpty().withMessage("projectType is required")
        .custom(isValidObjectId).withMessage("Invalid projectType ID"),

    body("projectStartDate")
        .notEmpty().withMessage("Project start date is required"),

    body("projectEndDate")
        .notEmpty().withMessage("Project end date is required"),

    body("department")
        .optional()
        .custom(isValidObjectId).withMessage("Invalid department ID"),

    body("projectDescription")
        .optional()
        .isLength({ max: 1000 }).withMessage("Description max 1000 chars"),

    body("projectStatus")
        .optional()
        .isIn(PROJECT_STATUS).withMessage("Invalid project status"),

    body("priority")
        .optional()
        .isIn(["Low", "Medium", "High", "Critical"]).withMessage("Invalid priority"),

    body("tags")
        .optional()
        .isArray().withMessage("Tags must be an array of strings"),
    body("tags.*")
        .optional()
        .isString().withMessage("Each tag must be a string"),

    // arrays of object ids
    objectIdArrayValidator("projectManager"),
    objectIdArrayValidator("projectCollaborationTeam"),
    objectIdArrayValidator("donor"),
    objectIdArrayValidator("vendor"),

    // approvalAuthority array rules
    approvalAuthorityArrayValidator,
];

// UPDATE validators
export const updateProjectValidator = [
    param("id").isMongoId().withMessage("Invalid project ID"),

    body("projectName")
        .optional()
        .isLength({ min: 3, max: 200 }).withMessage("Project name must be 3–200 characters"),

    body("projectCode")
        .optional()
        .isAlphanumeric().withMessage("Project code must be alphanumeric")
        .isLength({ max: 20 }).withMessage("Project code max length is 20"),

    body("projectStatus")
        .optional()
        .isIn(PROJECT_STATUS).withMessage("Invalid project status"),

    body("priority")
        .optional()
        .isIn(["Low", "Medium", "High", "Critical"]).withMessage("Invalid priority"),

    body("tags")
        .optional()
        .isArray().withMessage("Tags must be an array of strings"),
    body("tags.*")
        .optional()
        .isString().withMessage("Each tag must be a string"),

    objectIdArrayValidator("projectManager"),
    objectIdArrayValidator("projectCollaborationTeam"),
    objectIdArrayValidator("donor"),
    objectIdArrayValidator("vendor"),

    approvalAuthorityArrayValidator,
];

// Donor validators (aligns with schema)
export const donorValidator = [
    param("id").isMongoId().withMessage("Invalid project ID"),
    body("name").notEmpty().withMessage("Donor name is required"),
    body("donor_id").notEmpty().isMongoId().withMessage("Invalid donor ID"),
];

// Vendor validators (aligns with schema)
export const vendorValidator = [
    param("id").isMongoId().withMessage("Invalid project ID"),
    body("name").notEmpty().withMessage("Vendor name is required"),
    body("donor_id").notEmpty().isMongoId().withMessage("Invalid vendor ID"),
];

// Reset / Archive / Delete validators
export const projectIdValidator = [
    param("id").isMongoId().withMessage("Invalid project ID"),
];

// Search / Filter projects
export const searchProjectsValidator = [
    query("q").optional().isString().withMessage("Search query must be a string"),
    query("status").optional().isIn(["Planned", "Active", "OnHold", "Completed", "Cancelled"]),
    query("priority").optional().isIn(["Low", "Medium", "High", "Critical"]),
    query("department").optional().isMongoId().withMessage("Invalid department ID"),
    query("manager").optional().isMongoId().withMessage("Invalid manager ID"),
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be >= 1"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1–100"),
    query("startDate").optional().isISO8601().withMessage("Invalid startDate"),
    query("endDate").optional().isISO8601().withMessage("Invalid endDate"),
];
