import { body, param, query } from "express-validator";

// Validator for creating a designation
export const createDesignationValidator = [
    body("name")
        .trim()
        .notEmpty().withMessage("Designation name is required")
        .isLength({ min: 2, max: 250 }).withMessage("Name must be 2-250 characters long"),

    body("priority")
        .optional()
        .isInt({ min: 0, max: 100 }).withMessage("Priority must be between 0 and 100"),

    body("status")
        .optional()
        .isIn(["Active", "Inactive"]).withMessage("Status must be either Active or Inactive"),

    body("description")
        .optional()
        .isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),

    // Permission fields - custom validation to handle both string and boolean
    body("isDonorOrVendor")
        .optional()
        .custom(value => {
            if (value === 'true' || value === 'false' || typeof value === 'boolean') {
                return true;
            }
            throw new Error("isDonorOrVendor must be a boolean value");
        }),

    body("ownFiles")
        .optional()
        .custom(value => {
            if (value === 'true' || value === 'false' || typeof value === 'boolean') {
                return true;
            }
            throw new Error("ownFiles must be a boolean value");
        }),

    body("ownFolders")
        .optional()
        .custom(value => {
            if (value === 'true' || value === 'false' || typeof value === 'boolean') {
                return true;
            }
            throw new Error("ownFolders must be a boolean value");
        }),

    body("teamFiles")
        .optional()
        .custom(value => {
            if (value === 'true' || value === 'false' || typeof value === 'boolean') {
                return true;
            }
            throw new Error("teamFiles must be a boolean value");
        }),

    body("deptFiles")
        .optional()
        .custom(value => {
            if (value === 'true' || value === 'false' || typeof value === 'boolean') {
                return true;
            }
            throw new Error("deptFiles must be a boolean value");
        }),

    body("otherDepts")
        .optional()
        .custom(value => {
            if (value === 'true' || value === 'false' || typeof value === 'boolean') {
                return true;
            }
            throw new Error("otherDepts must be a boolean value");
        }),

    body("allOrgs")
        .optional()
        .custom(value => {
            if (value === 'true' || value === 'false' || typeof value === 'boolean') {
                return true;
            }
            throw new Error("allOrgs must be a boolean value");
        }),
];

// Validator for updating a designation
export const updateDesignationValidator = [
    body("name")
        .optional()
        .trim()
        .isLength({ min: 2, max: 250 }).withMessage("Name must be 2-250 characters long"),

    body("priority")
        .optional()
        .isInt({ min: 0, max: 100 }).withMessage("Priority must be between 0 and 100"),

    body("status")
        .optional()
        .isIn(["Active", "Inactive"]).withMessage("Status must be either Active or Inactive"),

    body("description")
        .optional()
        .isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),

    // Permission fields for update
    body("isDonorOrVendor")
        .optional()
        .custom(value => {
            if (value === 'true' || value === 'false' || typeof value === 'boolean') {
                return true;
            }
            throw new Error("isDonorOrVendor must be a boolean value");
        }),

    body("ownFiles")
        .optional()
        .custom(value => {
            if (value === 'true' || value === 'false' || typeof value === 'boolean') {
                return true;
            }
            throw new Error("ownFiles must be a boolean value");
        }),

    body("ownFolders")
        .optional()
        .custom(value => {
            if (value === 'true' || value === 'false' || typeof value === 'boolean') {
                return true;
            }
            throw new Error("ownFolders must be a boolean value");
        }),

    body("teamFiles")
        .optional()
        .custom(value => {
            if (value === 'true' || value === 'false' || typeof value === 'boolean') {
                return true;
            }
            throw new Error("teamFiles must be a boolean value");
        }),

    body("deptFiles")
        .optional()
        .custom(value => {
            if (value === 'true' || value === 'false' || typeof value === 'boolean') {
                return true;
            }
            throw new Error("deptFiles must be a boolean value");
        }),

    body("otherDepts")
        .optional()
        .custom(value => {
            if (value === 'true' || value === 'false' || typeof value === 'boolean') {
                return true;
            }
            throw new Error("otherDepts must be a boolean value");
        }),

    body("allOrgs")
        .optional()
        .custom(value => {
            if (value === 'true' || value === 'false' || typeof value === 'boolean') {
                return true;
            }
            throw new Error("allOrgs must be a boolean value");
        }),
];