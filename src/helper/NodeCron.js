import cron from "node-cron";
import mongoose from "mongoose";
import TempFile from "../models/TempFile.js";
import PermissionLogs from "../models/PermissionLogs.js";
import FolderPermissionLogs from "../models/FolderPermissionLogs.js";
import Document from "../models/Document.js";
import { deleteObject } from "../utils/s3Helpers.js";
import logger from "../utils/logger.js";

let isRunningTempFiles = false;
let isRunningLogs = false;
let isRunningDocumentRetention = false;

/* ----------------------------
  Temp files cleanup
---------------------------- */
const cleanupTempFiles = async () => {
    if (isRunningTempFiles) {
        logger.warn("Temp file cleanup skipped: previous run still in progress.");
        return;
    }
    isRunningTempFiles = true;

    try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const oldFiles = await TempFile.find({ status: "temp", addDate: { $lt: twoHoursAgo } });

        for (const file of oldFiles) {
            try {
                await deleteObject(file.s3Filename);
                await TempFile.deleteOne({ _id: file._id });
                logger.info(`Deleted temp file: ${file.s3Filename}`);
            } catch (err) {
                logger.error(`Failed to delete file ${file.s3Filename}:`, err);
            }
        }

        logger.info(`Temp file cleanup complete. ${oldFiles.length} files removed.`);
    } catch (err) {
        logger.error("Temp file cleanup failed:", err);
    } finally {
        isRunningTempFiles = false;
    }
};

/* ----------------------------
  Document retention job
---------------------------- */
const documentRetentionJob = async () => {
    if (isRunningDocumentRetention) {
        logger.warn("Document retention job skipped: previous run still in progress.");
        return;
    }
    isRunningDocumentRetention = true;

    try {
        const now = new Date();

        // 1️⃣ Archive expired documents
        const archiveResult = await Document.updateMany(
            {
                "compliance.expiryDate": { $lte: now },
                isArchived: false,
                isDeleted: false
            },
            { $set: { isArchived: true, archivedAt: now } } // Make sure archivedAt exists in schema
        );
        logger.info(`Archived ${archiveResult.modifiedCount} expired documents.`);

        // 2️⃣ Delete documents archived 5 months ago
        const fiveMonthsAgo = new Date();
        fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);

        const deleteResult = await Document.updateMany(
            {
                isArchived: true,
                isDeleted: false,
                archivedAt: { $lte: fiveMonthsAgo }
            },
            { $set: { isDeleted: true, deletedAt: now } }
        );
        logger.info(`Permanently deleted ${deleteResult.modifiedCount} archived documents.`);
    } catch (err) {
        logger.error("Document retention job failed:", err);
    } finally {
        isRunningDocumentRetention = false;
    }
};

/* ----------------------------
  Start scheduled jobs
---------------------------- */
export const startCleanupJob = () => {
    // Temp files: every 2 hours on the hour
    cron.schedule(
        "0 */2 * * *",
        async () => {
            logger.info("Triggering temp file cleanup...");
            await cleanupTempFiles();
        },
        { scheduled: true, timezone: "UTC" }
    );

    // Document retention: run daily at midnight UTC
    cron.schedule(
        "0 0 * * *",
        async () => {
            logger.info("Triggering document retention job...");
            await documentRetentionJob();
        },
        { scheduled: true, timezone: "UTC" }
    );
};
