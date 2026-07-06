import { body, param, query } from "express-validator";
import mongoose from "mongoose";

/**
 * PATCH /permission-logs/requestStatus
 */
export const updateRequestStatusValidator = [
    body("logId")
        .notEmpty().withMessage("logId is required")
        .custom((val) => mongoose.Types.ObjectId.isValid(val))
        .withMessage("Invalid logId format"),

    body("requestStatus")
        .notEmpty().withMessage("requestStatus is required")
        .isIn(["approved", "pending", "rejected"])
        .withMessage("requestStatus must be one of: approved, pending, rejected"),
];

/**
 * POST /permission-logs/grant-access
 */
export const grantAccessValidator = [
    body("logId")
        .notEmpty().withMessage("logId is required")
        .custom((val) => mongoose.Types.ObjectId.isValid(val))
        .withMessage("Invalid logId format"),

    body("duration")
        .notEmpty().withMessage("duration is required")
        .isIn(["oneday", "oneweek", "onemonth", "lifetime", "onetime", "custom"])
        .withMessage("Invalid duration value"),

        body("customDates")
        .if(body("duration").equals("custom"))
        .notEmpty().withMessage("customDates is required when duration is 'custom'")
        .matches(/^\d{2}-\d{2}-\d{4}\s+to\s+\d{2}-\d{2}-\d{4}$/)
        .withMessage("customDates must be in format 'DD-MM-YYYY to DD-MM-YYYY'")    
];
