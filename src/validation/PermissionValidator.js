import { body, param, query } from "express-validator";

// Assign menus to designation
export const assignMenusValidator = [
    body("designation_id")
        .notEmpty().withMessage("designation_id is required")
        .isMongoId().withMessage("designation_id must be a valid Mongo ID"),

    body("menu_ids")
        .isArray({ min: 1 }).withMessage("menu_ids must be a non-empty array"),

    body("menu_ids.*")
        .isMongoId().withMessage("Each menu_id must be a valid Mongo ID"),
];

// Unassign menus
export const unAssignMenusValidator = [
    body("designation_id")
        .notEmpty().withMessage("designation_id is required")
        .isMongoId().withMessage("designation_id must be a valid Mongo ID"),

    body("menu_ids")
        .isArray({ min: 1 }).withMessage("menu_ids must be a non-empty array"),

    body("menu_ids.*")
        .isMongoId().withMessage("Each menu_id must be a valid Mongo ID"),
];

// Get assigned menus (params)
export const getAssignedMenusValidator = [
    param("designation_id")
        .notEmpty().withMessage("designation_id is required")
        .isMongoId().withMessage("designation_id must be a valid Mongo ID"),
];

// Menu list pagination
export const getMenuListValidator = [
    query("page")
        .optional()
        .isInt({ min: 1 }).withMessage("page must be a positive integer"),

    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage("limit must be between 1 and 100"),
];

// Menu ID validation (for update/delete/get)
export const menuIdParamValidator = [
    param("id")
        .notEmpty().withMessage("Menu ID is required")
        .isMongoId().withMessage("Menu ID must be valid"),
];
