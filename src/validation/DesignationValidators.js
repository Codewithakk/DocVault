import { body, param, query } from "express-validator";

// Validator for creating a designation
export const createDesignationValidator = [
    body("name")
        .trim()
        .notEmpty().withMessage("Designation name is required")
        .isLength({ min: 2, max: 250 }).withMessage("Name must be 2-250 characters long"),
        //.matches(/^[a-zA-Z0-9\s\-]+$/).withMessage("Name contains invalid characters"),

    body("priority")
        .optional()
        .isInt({ min: 0, max: 100 }).withMessage("Priority must be between 0 and 100"),

    body("status")
        .optional()
        .isIn(["Active", "Inactive"]).withMessage("Status must be either Active or Inactive"),

    body("description")
        .optional()
        .isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters")
];

// Validator for updating a designation
export const updateDesignationValidator = [
    body("name")
        .optional()
        .trim()
        .isLength({ min: 2, max: 250 }).withMessage("Name must be 2-250 characters long"),
        //.matches(/^[a-zA-Z0-9\s\-]+$/).withMessage("Name contains invalid characters"),

    body("priority")
        .optional()
        .isInt({ min: 0, max: 100 }).withMessage("Priority must be between 0 and 100"),

    body("status")
        .optional()
        .isIn(["Active", "Inactive"]).withMessage("Status must be either Active or Inactive"),

    body("description")
        .optional()
        .isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters")
];
