import { body, param } from "express-validator";

export const createProjectTypeValidator = [
    body("name")
        .notEmpty().withMessage("Project type name is required")
        .isString().withMessage("Name must be a string")
        .isLength({ max: 50 }).withMessage("Name cannot exceed 50 characters"),

    body("priority")
        .optional()
        .isInt({ min: 0 }).withMessage("Priority cannot be negative"),

    body("status")
        .optional()
        .isIn(["Active", "Inactive"])
        .withMessage("Status must be Active or Inactive"),
];

export const updateProjectTypeValidator = [
    param("id")
        .isMongoId().withMessage("Invalid project type ID"),

    body("name")
        .optional()
        .isString().withMessage("Name must be a string")
        .isLength({ max: 50 }).withMessage("Name cannot exceed 50 characters"),

    body("priority")
        .optional()
        .isInt({ min: 0 }).withMessage("Priority cannot be negative"),

    body("status")
        .optional()
        .isIn(["Active", "Inactive"])
        .withMessage("Status must be Active or Inactive")
];
