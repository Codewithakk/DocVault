// middlewares/validate.js
import { validationResult } from "express-validator";

export const validators = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();

    // map to field: message format (production friendly)
    const extractedErrors = errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
    }));

    return res.status(422).json({
        status: "error",
        errors: extractedErrors,
    });
};

