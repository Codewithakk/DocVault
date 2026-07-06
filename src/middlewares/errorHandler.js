import logger from "../utils/logger.js";

const errorHandler = (err, req, res, next) => {
    // Log error with request context
    logger.error({
        message: err.message,
        stack: err.stack,
        method: req.method,
        url: req.originalUrl,
        user: req.user ? { id: req.user._id, email: req.user.email } : null,
    });

    // Determine status code. Custom errors might have a statusCode already.
    let statusCode = err.statusCode || 500;
    let message = err.message;

    // Handle Multer specific errors
    if (err.name === "MulterError" || err.code?.startsWith("LIMIT_")) {
        statusCode = 400;
        if (err.code === "LIMIT_FILE_SIZE") {
            message = "File size limit exceeded.";
        } else if (err.code === "LIMIT_FILE_COUNT") {
            message = "Too many files uploaded.";
        } else if (err.code === "LIMIT_UNEXPECTED_FIELD") {
            message = "Unexpected upload field.";
        }
    } else if (err.message && err.message.startsWith("Invalid file type")) {
        statusCode = 400;
    }

    const finalMessage =
        process.env.NODE_ENV === "production"
            ? statusCode === 500
                ? "Internal Server Error"
                : message
            : message;

    res.status(statusCode).json({
        success: false,
        message: finalMessage,
        error: process.env.NODE_ENV === "production" ? null : err.errors || err.stack,
    });
};

export default errorHandler;
