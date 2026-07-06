import { body, param, query } from "express-validator";
import mongoose from "mongoose";

/**
 * Utility: ObjectId check
 */
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

/**
 * POST /documents  → Create document
 */
export const createDocumentValidator = [
    body("department").notEmpty().withMessage("Department is required"),

    body("project")
        .optional({ nullable: true })
        .custom((val) => !val || isValidObjectId(val))
        .withMessage("Invalid project ID"),

    body("folderId")
        .optional({ nullable: true })
        .custom((val) => !val || isValidObjectId(val))
        .withMessage("Invalid folderId"),

    body("fileIds")
        .optional()
        .custom((val) => {
            try {
                const arr = typeof val === "string" ? JSON.parse(val) : val;
                if (!Array.isArray(arr)) throw new Error();
                return arr.every((id) => isValidObjectId(id));
            } catch {
                throw new Error("fileIds must be an array of valid ObjectIds");
            }
        }),
];

/**
 * PATCH /documents/:id  → Update document
 */
export const updateDocumentValidator = [
    param("id")
        .custom(isValidObjectId)
        .withMessage("Invalid document ID"),

    body("folderId")
        .optional()
        .custom((val) => !val || isValidObjectId(val))
        .withMessage("Invalid folderId"),

    body("tags")
        .optional()
        .custom((val) => {
            if (Array.isArray(val)) return true;
            if (typeof val === "string") return val.split(",").length >= 0;
            throw new Error("Tags must be an array or comma-separated string");
        }),
];

/**
 * DELETE /documents/permanent  → Hard delete multiple
 */
export const deleteDocumentValidator = [
    body("ids")
        .isArray({ min: 1 })
        .withMessage("ids must be a non-empty array")
        .custom((arr) => arr.every((id) => isValidObjectId(id)))
        .withMessage("Each id must be a valid ObjectId"),
];

/**
 * DELETE /documents/:id  → Soft delete single
 */
export const softDeleteDocumentValidator = [
    param("id")
        .custom(isValidObjectId)
        .withMessage("Invalid document ID"),
];

/**
 * PATCH /documents/:id/status  → Update document status
 */
export const updateDocumentStatusValidator = [
    param("id")
        .custom(isValidObjectId)
        .withMessage("Invalid document ID"),

    body("status")
        .notEmpty()
        .isIn(["Draft", "Pending", "UnderReview", "Approved", "Rejected", "Archived"])
        .withMessage("Invalid status value"),
];

/**
 * PATCH /documents/:id/archive  → Archive/unarchive
 */
export const archiveDocumentValidator = [
    param("id")
        .custom(isValidObjectId)
        .withMessage("Invalid document ID"),
    query("isArchived")
        .notEmpty()
        .isIn(["true", "false"])
        .withMessage("isArchived query param must be 'true' or 'false'"),
];

/**
 * PATCH /documents/:id/restore  → Restore deleted doc
 */
export const restoreDocumentValidator = [
    param("id")
        .custom(isValidObjectId)
        .withMessage("Invalid document ID"),
];

/* -------------------------------------------------------------------------- */
/* SHARE DOCUMENT (/documents/:id/share) */
/* -------------------------------------------------------------------------- */
export const shareDocumentValidator = [
    param("id")
        .custom(isValidObjectId)
        .withMessage("Invalid document ID"),

    body("accessLevel")
        .optional()
        .isIn(["view", "edit"])
        .withMessage("accessLevel must be either 'view' or 'edit'"),

    body("duration")
        .optional()
        .isIn(["oneday", "oneweek", "onemonth", "lifetime", "onetime", "custom"])
        .withMessage("Invalid duration value"),

    body("customEnd")
        .if(body("duration").equals("custom"))
        .notEmpty()
        .withMessage("customEnd is required when duration is 'custom'")
        .isISO8601()
        .withMessage("customEnd must be a valid date"),

    body("generalAccess")
        .optional()
        .isBoolean()
        .withMessage("generalAccess must be a boolean"),

    body("userIds")
        .optional()
        .custom((val) => {
            if (!Array.isArray(val)) throw new Error("userIds must be an array");
            const invalid = val.filter((id) => !isValidObjectId(id));
            if (invalid.length) throw new Error(`Invalid user IDs: ${invalid.join(", ")}`);
            return true;
        }),
];

/* -------------------------------------------------------------------------- */
/* BULK PERMISSION UPDATE (/documents/:documentId/permissions) */
/* -------------------------------------------------------------------------- */
export const bulkPermissionUpdateValidator = [
    param("documentId")
        .custom(isValidObjectId)
        .withMessage("Invalid document ID"),

    body("users")
        .optional()
        .isArray({ min: 0 })
        .withMessage("users must be a non-empty array"),

    body("users.*.accessLevel")
        .optional()
        .isIn(["view", "edit"])
        .withMessage("accessLevel must be 'view' or 'edit'"),

    body("users.*.canDownload")
        .optional()
        .isBoolean()
        .withMessage("canDownload must be a boolean"),
];

/* -------------------------------------------------------------------------- */
/* UPDATE SHARED USER (/documents/share/:documentId) */
/* -------------------------------------------------------------------------- */
export const updateSharedUserValidator = [
    param("documentId")
        .custom(isValidObjectId)
        .withMessage("Invalid document ID"),

    body("userId")
        .notEmpty()
        .custom(isValidObjectId)
        .withMessage("Invalid userId"),

    body("accessLevel")
        .optional()
        .isIn(["view", "edit"])
        .withMessage("accessLevel must be 'view' or 'edit'"),

    body("canDownload")
        .optional()
        .isBoolean()
        .withMessage("canDownload must be a boolean"),
];

/* -------------------------------------------------------------------------- */
/* REMOVE SHARED USER (/documents/share/:documentId) */
/* -------------------------------------------------------------------------- */
export const removeSharedUserValidator = [
    param("documentId")
        .custom(isValidObjectId)
        .withMessage("Invalid document ID"),
    body("userId")
        .notEmpty()
        .custom(isValidObjectId)
        .withMessage("Invalid userId"),
];

/* -------------------------------------------------------------------------- */
/* INVITE USER (/documents/:documentId/invite) */
/* -------------------------------------------------------------------------- */
export const inviteUserValidator = [
    param("documentId")
        .custom(isValidObjectId)
        .withMessage("Invalid document ID"),

    body("userEmail")
        .notEmpty()
        .isEmail()
        .withMessage("Valid userEmail is required"),

    body("accessLevel")
        .optional()
        .isIn(["view", "edit"])
        .withMessage("accessLevel must be 'view' or 'edit'"),

    body("duration")
        .optional()
        .isIn(["oneday", "oneweek", "onemonth", "lifetime", "custom"])
        .withMessage("Invalid duration"),

    body("customEnd")
        .if(body("duration").equals("custom"))
        .notEmpty()
        .withMessage("customEnd required for custom duration")
        .isISO8601()
        .withMessage("customEnd must be a valid date"),
];

/* -------------------------------------------------------------------------- */
/* REQUEST ACCESS AGAIN (/documents/:documentId/request-access) */
/* -------------------------------------------------------------------------- */
export const requestAccessValidator = [
    param("documentId")
        .custom(isValidObjectId)
        .withMessage("Invalid document ID"),
    body("email")
        .optional()
        .isEmail()
        .withMessage("Must provide a valid email"),
];

/* -------------------------------------------------------------------------- */
/* GRANT ACCESS VIA TOKEN (/documents/grant-access/:token) */
/* -------------------------------------------------------------------------- */
export const grantAccessViaTokenValidator = [
    param("token")
        .notEmpty()
        .withMessage("Token is required"),
    body("duration")
        .optional()
        .isIn(["oneday", "oneweek", "onemonth", "lifetime"])
        .withMessage("Invalid duration"),
];

/* -------------------------------------------------------------------------- */
/* RESTORE VERSION (/documents/:id/versions/:version/restore) */
/* -------------------------------------------------------------------------- */
export const restoreVersionValidator = [
    param("id")
        .custom(isValidObjectId)
        .withMessage("Invalid document ID"),
    param("version")
        .notEmpty()
        .withMessage("Version is required"),
];

/* ------------------------------------------------------------------------- */
/* CREATE APPROVAL REQUEST (/documents/:documentId/add) */
/* -------------------------------------------------------------------------- */
export const createApprovalRequestValidator = [
    param("documentId")
        .custom(isValidObjectId)
        .withMessage("Invalid document ID"),

    body("approverId")
        .notEmpty()
        .custom(isValidObjectId)
        .withMessage("Invalid approverId"),

    body("designation")
        .optional()
        .custom((val) => !val || isValidObjectId(val))
        .withMessage("Invalid designation"),

    body("priority")
        .notEmpty()
        .isInt({ min: 0 })
        .withMessage("level must be a positive integer"),

    body("addDate")
        .optional()
        .isISO8601()
        .withMessage("addDate must be a valid date"),
];

/* -------------------------------------------------------------------------- */
/* UPDATE APPROVAL STATUS (/documents/:documentId/approval) */
/* -------------------------------------------------------------------------- */
export const updateApprovalStatusValidator = [
    param("documentId")
        .custom(isValidObjectId)
        .withMessage("Invalid document ID"),
    body("comment")
        .optional()
        .isString()
        .withMessage("comment must be a string"),
];
