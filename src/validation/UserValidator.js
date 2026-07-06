import { body } from "express-validator";

// Validation rules
export const registrationValidation = [
    body("name")
        .notEmpty().withMessage("Full name is required")
        .isLength({ min: 3, max: 50 }).withMessage("Full name must be 3-50 characters long"),

    body("email")
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Invalid email format"),

    body("phone")
        .notEmpty().withMessage("Phone number is required")
        .matches(/^[0-9]{10,15}$/).withMessage("Phone number must be 10-15 digits"),

    body("address")
        .optional()
        .isString().withMessage("Address must be a string"),
];

export const updateValidation = [
    body("name")
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage("Name must be between 2 and 100 characters"),
    body("phone")
        .optional()
        .isLength({ min: 7, max: 10 }) // allow 7–15 digits
        .withMessage("Please provide a valid phone number")
        .matches(/^[0-9]+$/)
        .withMessage("Phone number must contain only digits"),
    body("department")
        .optional()
        .isMongoId()
        .withMessage("Please provide a valid department ID"),
    body("designation_id")
        .optional()
        .isMongoId()
        .withMessage("Please provide a valid designation ID"),
    body("status")
        .optional()
        .isIn(["Active", "Inactive", "Blocked"])
        .withMessage("Status must be Active, Inactive, or Blocked"),
];
