import { body, param, query } from "express-validator";
import mongoose from "mongoose";

// Validator for creating a department
export const createDepartmentValidator = [
    body("name")
        .trim()
        .notEmpty().withMessage("Department name is required")
        .isLength({ min: 2, max: 50 }).withMessage("Name must be 2-50 characters long")
        .matches(/^[a-zA-Z0-9\s\-]+$/).withMessage("Name contains invalid characters"),

    body("priority")
        .optional()
        .isInt({ min: 0, max: 100 }).withMessage("Priority must be a number between 0 and 100"),

    body("status")
        .optional()
        .isIn(["Active", "Inactive"]).withMessage("Status must be either Active or Inactive")
];

// Validator for updating a department
export const updateDepartmentValidator = [
    param("id")
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage("Invalid department ID"),

    body("name")
        .optional()
        .trim()
        .isLength({ min: 2, max: 250 }).withMessage("Name must be 2-250 characters long")
        .matches(/^[a-zA-Z0-9\s\-]+$/).withMessage("Name contains invalid characters"),

    body("priority")
        .optional()
        .isInt({ min: 0, max: 100 }).withMessage("Priority must be a number between 0 and 100"),

    body("status")
        .optional()
        .isIn(["Active", "Inactive"]).withMessage("Status must be either Active or Inactive")
];
