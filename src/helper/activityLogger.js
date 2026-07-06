// utils/activityLogger.js
import ActivityLog from '../models/ActivityLog.js';

/**
 * Log an activity in the database.
 *
 * @param {Object} params
 * @param {String|ObjectId} params.actorId     - User performing the action
 * @param {String|ObjectId} params.entityId    - Target object ID
 * @param {String} params.entityType           - Type (Document, Folder, User...)
 * @param {String} params.action               - Action (CREATE, UPDATE...)
 * @param {Object} [params.meta]               - Optional metadata (extra info)
 */
export async function activityLogger({
    actorId,
    entityId,
    entityType,
    action,
    details,
    meta = {}
}) {
    try {
        await ActivityLog.create({
            actorId,
            entityId,
            entityType,
            details,
            action,
            meta
        });

    } catch (error) {
        console.error('Failed to log activity:', error);
    }
}
