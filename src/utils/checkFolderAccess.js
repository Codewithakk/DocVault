import FolderPermissionLogs from "../models/FolderPermissionLogs.js";

export default async function checkFolderAccess(folder, req) {
    const now = new Date();

    const result = {
        canView: false,
        canRequestAccess: false,
        folderExpired: false,
        isExternal: false,
        canDownload: false,
        reason: "none"
    };

    try {
        // SUPERADMIN BYPASS (no restrictions)
        if (req.user && req.user.role === "superadmin") {
            return {
                ...result,
                canView: true,
                canDownload: true,
                reason: "superadmin"
            };
        }

        // OWNER BYPASS
        if (req.user && String(folder.owner) === String(req.user._id)) {
            return {
                ...result,
                canView: true,
                canDownload: true,
                reason: "owner"
            };
        }

        // TOKEN-BASED ACCESS
        const token = req.query?.token || req.body?.token;
        if (token) {
            const link = folder.metadata?.shareLinks?.find(l => l.token === token);
            if (link && (!link.expiresAt || new Date(link.expiresAt) > now)) {
                return {
                    ...result,
                    canView: true,
                    canDownload: !!link.canDownload, // respect link’s download flag
                    reason: "token"
                };
            }
        }

        // INTERNAL USER ACCESS (based on folder.permissions)
        if (req.user) {
            const permission = folder.permissions?.find(
                p => String(p.principal) === String(req.user._id)
            );

            if (permission) {
                const valid =
                    (!permission.expiresAt || new Date(permission.expiresAt) > now) &&
                    (!permission.customEnd || new Date(permission.customEnd) > now);

                if (valid) {
                    return {
                        ...result,
                        canView: true,
                        canDownload: !!permission.canDownload,
                        reason: "internal_permission"
                    };
                }
            }
        }

        // EXTERNAL USER ACCESS (FolderPermissionLogs)
        if (req.user?.email) {
            const log = await FolderPermissionLogs.findOne({
                "user.email": req.user.email,
                folder: folder._id,
                requestStatus: "approved",
                isExternal: true
            }).lean();

            if (log) {
                const valid = !log.expiresAt || new Date(log.expiresAt) > now;
                if (valid) {
                    return {
                        ...result,
                        canView: true,
                        isExternal: true,
                        canDownload: !!log.canDownload,
                        reason: "external_permission"
                    };
                } else {
                    return {
                        ...result,
                        folderExpired: true,
                        isExternal: true,
                        reason: "external_expired"
                    };
                }
            }
        }

        // FOLDER EXPIRATION CHECK
        const folderExpired = folder.expiresAt && new Date(folder.expiresAt) <= now;
        if (folderExpired) {
            return { ...result, folderExpired: true, reason: "folder_expired" };
        }

        // DEFAULT: can request access
        return { ...result, canRequestAccess: true, reason: "request_access" };

    } catch (err) {
        console.error("Error in checkFolderAccess:", err);
        return result;
    }
}

