// utils/responseHandler.js

/**
 * Success Response
 * @param {object} res - Express response
 * @param {any} data - Response data (default empty object)
 * @param {string} message - Response message (default "Success")
 * @param {number} statusCode - HTTP status code (default 200)
 */
// export const successResponse = (res, data = {}, message = 'Success', statusCode = 200) => {
//     return res.status(statusCode).json({
//         success: true,
//         message,
//         ...data // spread the data to avoid unnecessary nesting
//     });
// };
/**
 * Success Response
 * @param {object} res - Express response
 * @param {any} data - Response data (default empty object)
 * @param {string} message - Response message (default "Success")
 * @param {number} statusCode - HTTP status code (default 200)
 */
export const successResponse = (res, data = {}, message = 'Success', statusCode = 200) => {
    if (data?.toObject) {
        data = data.toObject();
    }

    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

/**
 * Fail Response (expected failure like validation, 404, etc.)
 * @param {object} res - Express response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default 400)
 * @param {array} errors - Optional detailed errors
 */
export const failResponse = (res, message = 'Failed', statusCode = 400, errors = []) => {
    return res.status(statusCode).json({
        success: false,
        message: message || 'Failed',
        errors: Array.isArray(errors) ? errors : [errors]
    });
};

/**
 * Error Response (unexpected/internal errors)
 * @param {object} res - Express response
 * @param {any} error - Error object or message
 * @param {string} message - Optional custom message
 * @param {number} statusCode - HTTP status code (default 500)
 */
export const errorResponse = (res, error = null, message = 'Internal Server Error', statusCode = 500) => {
    let errorMessage;

    if (!error) {
        errorMessage = null;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'object') {
        errorMessage = JSON.stringify(error);
    } else {
        errorMessage = String(error);
    }

    return res.status(statusCode || 500).json({
        success: false,
        message: message || 'Internal Server Error',
        error: errorMessage
    });
};
