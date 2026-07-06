// ---------------------------
// Core dependencies
// ---------------------------
import express from "express";
import mongoose from "mongoose";
// ---------------------------
// Controller imports
// ---------------------------
import * as AuthController from "../controllers/AuthController.js";
import * as AdminController from "../controllers/AdminController.js";
import * as EmployeeController from "../controllers/EmployeeController.js";
import * as UserController from "../controllers/UserController.js";
import * as DonerVenderController from "../controllers/DonerVenderController.js";
import * as AdminDashboard from "../controllers/DashboardController.js"
import * as DepartmentController from "../controllers/DepartmentController.js";
import * as DesignationController from "../controllers/DesignationController.js";
import * as DocumentController from "../controllers/DocumentController.js";
import * as ProjectController from "../controllers/ProjectController.js";
import * as PermissionController from "../controllers/PermisssionsController.js";
import * as FolderController from "../controllers/FolderController.js";
import * as NotificationController from "../controllers/NotificationController.js";
import * as TempController from "../controllers/FileController.js";
import * as CommonController from "../controllers/CommonController.js"
import * as LocationController from "../controllers/LocationController.js"
import * as WebSettings from "../controllers/WebSettingController.js"

// ---------------------------
// Middleware imports
// ---------------------------
import { authenticate, authorize, optionalAuth } from "../middlewares/authMiddleware.js";
import checkPermissions from '../middlewares/checkPermission.js';
import upload from "../middlewares/fileUploads.js";

// Validation middlewares
import * as AuthValidators from "../validation/AuthValidators.js";
import * as PermissionLogsValidators from "../validation/PermissionLogsValidators.js";
import * as DocumentValidators from "../validation/DocumentValidators.js";
import * as DepartmentValidators from "../validation/DepartmentValidators.js";
import * as DesignationValidators from "../validation/DesignationValidators.js";
import * as ProjectValidator from "../validation/ProjectValidator.js";
import * as VenderDonorValidation from "../validation/VenderDonorValidation.js";
import * as PermissionValidator from "../validation/PermissionValidator.js";
import * as ProjectTypeValidators from "../validation/ProjectTypeValidators.js";

import { registerVendor, registerVendorOrDonor } from "../validation/VenderDonorValidation.js";
import { assignMenusValidator, getAssignedMenusValidator, unAssignMenusValidator } from "../validation/PermissionValidator.js";

// ---------------------------
// Model imports
// ---------------------------
import Menu from "../models/Menu.js";
import UserPermission from "../models/UserPermission.js";
import MenuAssignment from "../models/MenuAssignment.js";
import Folder from "../models/Folder.js";
import logger from "../utils/logger.js";
import Project from "../models/Project.js";
import UserFolderHistory from "../models/UserFolderHistory.js";

// ---------------------------
// Utils & middlewares imports
// ---------------------------

import { createS3Uploader, s3uploadfolder } from "../middlewares/multer-s3.js";
import { ParentFolderName } from "../middlewares/parentFolderName.js";
import { validators } from "../middlewares/validate.js";
import { uploadWebImages } from "../middlewares/imagesUpload.js";

const router = express.Router();
// ---------------------------
// Auth routes
// ---------------------------

router.post("/auth/register", AuthValidators.registerValidator, validators, AuthController.register);
router.post("/auth/login", AuthValidators.loginValidator, validators, AuthController.login);

router.post("/auth/send-otp", AuthController.sendOtp);
router.post("/auth/verify-otp", AuthController.verifyOtp);
router.post("/auth/verify/token", AuthController.verifyTokenOtp);

router.post("/auth/reset-password", AuthController.resetPassword);
router.post("/auth/send-reset-link", AuthController.sendResetLink);
router.get("/auth/verify-reset/:token", AuthController.verifyResetLink);


//public routes
router.get('/file/pdf/:fileId', optionalAuth, CommonController.servePDF);
router.get('/documents/:id/versions/view', DocumentController.viewDocumentVersion);
router.get("/download/:documentId", optionalAuth, CommonController.downloadFilesZip);
router.get("/download/file/:fileId", optionalAuth, CommonController.downloadFile);
router.post("/approval/submit", optionalAuth, DocumentController.submitApprovalByToken);

// Apply authentication to all routes
router.use(authenticate);

//encryption

router.get('/documents/download/:fileId/:token', authenticate, async (req, res) => {
    const { fileId, token } = req.params;

    // Check if token exists in session
    if (!req.session.fileTokens || req.session.fileTokens[fileId] !== token) {
        return res.status(403).send('Access Denied');
    }

    const file = await File.findById(fileId).exec();
    if (!file) return res.status(404).send('File not found');

    const decryptedUrl = decrypt(token);
    res.redirect(decryptedUrl);
});

// ---------------------------
// Session-protected routes
// ---------------------------
router.get("/auth/profile", authenticate, AuthController.getProfile);
router.patch("/auth/edit-profile", authenticate, upload.single("profile_image"), AuthController.updateProfile);
router.post("/auth/logout", authenticate, AuthController.logout);


// ---------------------------
// Common routes
// ---------------------------

router.get('/check', CommonController.checkDuplicate);
router.post("/session/project", authenticate, CommonController.saveSessionProject);
router.get("/session/project", CommonController.getSessionProject);
router.get("/download/folder/:folderId", authenticate, CommonController.downloadFolderAsZip);
router.post('/export', authenticate, CommonController.exportDocuments);
router.get('/export/formats', authenticate, CommonController.getExportFormats);

// ---------------------------
// Private routes
// ---------------------------
router.get("/settings/web-settings", authenticate, authorize('superadmin'), WebSettings.getWebSettings);
router.post("/settings/web-settings", authenticate, authorize('superadmin'), uploadWebImages, WebSettings.updateWebSettings);

// ---------------------------
// Location routes
// ---------------------------
// Country
router.post("/country", LocationController.createCountry);
router.get("/country", LocationController.getCountries);
router.put("/country/:id", LocationController.updateCountry);
router.delete("/country/:id", LocationController.deleteCountry);

// State
router.post("/state", LocationController.createState);
router.get("/state", LocationController.getStates);
router.put("/state/:id", LocationController.updateState);
router.delete("/state/:id", LocationController.deleteState);

// City
router.post("/city", LocationController.createCity);
router.get("/city", LocationController.getCities);
router.put("/city/:id", LocationController.updateCity);
router.delete("/city/:id", LocationController.deleteCity);

// ---------------------------
// Admin routes
// ---------------------------
router.get("/dashboard/stats", AdminDashboard.getDashboardStats);
router.get("/dashboard/file-status", AdminDashboard.getFileStatus);
router.get("/dashboard/recent-activity", AdminDashboard.getRecentActivities);
router.get("/dashboard/donorVendorProjects", AdminDashboard.getDonorVendorProjects);
router.get("/dashboard/uploads", AdminDashboard.getDepartmentDocumentUploads);
router.get("/dashboard/documentUploads", AdminDashboard.getDepartmentDocumentChart);
router.get("/dashboard/documentsTypeUploads", AdminDashboard.getDocumentsTypeUploads);
router.get("/dashboard/summary", AdminDashboard.getDocumentsStatusSummary);
router.get("/analytics/stats", AdminDashboard.getAnalyticsStats);
router.get("/analytics/department-file-usage", AdminDashboard.getDepartmentFileUsage);

// Permission Logs
router.get("/my-approvals", AdminController.getMyApprovals);
router.get("/permission-logs", authorize('admin', 'superadmin', 'user'), AdminController.getPermissionLogs);
router.patch("/permission-logs/requestStatus", authorize('admin', 'superadmin', 'user'), PermissionLogsValidators.updateRequestStatusValidator, validators, AdminController.updateRequestStatus);
router.post("/permission-logs/grant-access", authorize('admin', 'superadmin', 'user'), PermissionLogsValidators.grantAccessValidator, validators, AdminController.grantAccess)

// ---------------------------
// Employee routes
// ---------------------------
router.get("/approval-requests", EmployeeController.getApprovalRequests);



// ---------------------------
// Document Routes
// ---------------------------

router.get("/documents", DocumentController.getDocuments);
router.get("/documents/compliance", DocumentController.getComplianceDocuments);
router.get("/documents/folder/:folderId", authenticate, DocumentController.getDocumentsByFolder);
router.get("/documents/search", DocumentController.searchDocuments);
router.post("/documents", upload.fields([{ name: "signatureFile", maxCount: 1 }]), DocumentValidators.createDocumentValidator, validators, DocumentController.createDocument);
router.patch("/documents/:id", upload.fields([{ name: "signature", maxCount: 1 }]), DocumentController.updateDocument);
router.patch('/documents/:id/sharelink', DocumentController.updateShareSettings);
router.delete("/documents/permanent", DocumentValidators.deleteDocumentValidator, validators, DocumentController.deleteDocument);
router.delete("/documents/:id", DocumentValidators.softDeleteDocumentValidator, validators, DocumentController.softDeleteDocument);
router.patch("/documents/:id/status", DocumentValidators.updateDocumentStatusValidator, validators, DocumentController.updateDocumentStatus);
router.patch("/documents/:id/archive", DocumentValidators.archiveDocumentValidator, validators, DocumentController.archiveDocuments);
router.get("/documents/archive", DocumentController.getArchivedDocuments);
router.patch("/documents/:id/restore", DocumentValidators.restoreDocumentValidator, validators, DocumentController.restoreDocument);
router.get("/documents/recyclebin", DocumentController.getRecycleBinDocuments);

/**
 * Document Sharing & Permissions
 */

// Share a document
router.patch("/documents/:id/share", DocumentValidators.shareDocumentValidator, validators, DocumentController.shareDocument);

// List all users a document is shared with
router.get("/documents/:documentId/shared-users", DocumentController.getSharedUsers);

//updating the permission of all people with access
router.patch("/documents/:documentId/permissions", DocumentValidators.bulkPermissionUpdateValidator, validators, DocumentController.bulkPermissionUpdate);

// Update user access level for a shared document
router.put("/documents/share/:documentId", DocumentValidators.updateSharedUserValidator, validators, DocumentController.updateSharedUser);

// Remove user from shared list
router.delete("/documents/share/:documentId", DocumentValidators.removeSharedUserValidator, validators, DocumentController.removeSharedUser);

// Invite a user to a document (sends email)
router.post("/documents/:documentId/invite", DocumentValidators.inviteUserValidator, validators, DocumentController.inviteUser);

// Accept or reject an invite automatically
router.get("/documents/:documentId/invite/:userId/auto-accept", DocumentController.autoAcceptInvite);

// Request access again
router.post("/documents/:documentId/request-access", DocumentValidators.requestAccessValidator, validators, DocumentController.requestAccessAgain);

// Grant access via token
router.post("/documents/grant-access/:token", DocumentValidators.grantAccessViaTokenValidator, validators, DocumentController.grantAccessViaToken);

// Generate shareable link for a document file
router.get('/documents/:documentId/:fileId/share-link', DocumentController.generateShareableLink)

/**
 * Document Versioning
 */

// Get version history
router.get('/documents/:id/versions/history', DocumentController.getVersionHistory);

// View a specific version
router.get('/documents/:id/versions/:version/view', DocumentController.viewVersion);

// Restore a previous version
router.patch('/documents/:id/versions/:versionId/restore', DocumentController.restoreVersion);


/**
 * Document Approval Workflow
 */

// Create an approval request
router.post('/documents/:documentId/add', authenticate, DocumentValidators.createApprovalRequestValidator, validators, DocumentController.createOrUpdateApprovalRequest);

// Track approvals
router.get('/documents/:documentId/approval/track', authenticate, DocumentController.getApprovals);

// Approval Mail
router.get('/documents/:documentId/approval/:approverId/mail', authenticate, DocumentController.sendApprovalMail);

router.get('/verify-approval/:token', authenticate, DocumentController.verifyApprovalMail);

// Update approval for a document
router.patch('/documents/:documentId/approval', authenticate, DocumentValidators.updateApprovalStatusValidator, validators, DocumentController.updateApprovalStatus);
// routes/document.js


// ---------------------------
// Departments routes
// ---------------------------

router.get('/departments', authenticate, DepartmentController.getAllDepartments);
router.get('/departments/search', authenticate, DepartmentController.searchDepartments);
router.get('/departments/:id', authenticate, DepartmentController.getDepartmentById);

router.post('/departments', authenticate, checkPermissions, DepartmentValidators.createDepartmentValidator, validators, DepartmentController.createDepartment);
router.patch('/departments/:id', authenticate, checkPermissions, DepartmentValidators.updateDepartmentValidator, validators, DepartmentController.updateDepartment);
router.delete('/departments/:id', authenticate, DepartmentController.deleteDepartment);

// ---------------------------
// Designation routes
// ---------------------------

router.get('/designations', authenticate, DesignationController.getAllDesignations);
router.get('/designations/search', authenticate, DesignationController.searchDesignations)
router.get('/designations/:id', authenticate, DesignationController.getDesignationById);

router.post('/designations', authenticate, authorize('admin', 'superadmin'), DesignationValidators.createDesignationValidator, validators, DesignationController.createDesignation);
router.patch('/designations/:id', authenticate, authorize('admin', 'superadmin'), DesignationValidators.updateDesignationValidator, validators, DesignationController.updateDesignation);
router.delete('/designations/:id', authenticate, authorize('admin', 'superadmin'), DesignationController.deleteDesignation);



// ---------------------------
// Projects routes
// ---------------------------

router.get("/projectTypes", ProjectController.getProjectTypes);
router.post("/projectTypes", ProjectTypeValidators.createProjectTypeValidator, validators, ProjectController.createProjectType);
router.patch("/projectTypes/:id", ProjectTypeValidators.updateProjectTypeValidator, validators, ProjectController.updateProjectType);
router.delete("/projectTypes/:id", ProjectController.deleteProjectType);

// Basic CRUD routes
router.route('/projects')
    .get(
        ProjectController.getAllProjects
    )
    .post(
        ProjectValidator.createProjectValidator, upload.single('projectLogo'), ProjectController.createProject);

router.route('/projects/:id/status')
    .patch(ProjectController.updateProjectStatus);

// Search route
router.route('/projects/search').get(ProjectController.searchProjects);
router.route('/projects/projectManagers/search').get(ProjectController.searchProjectManager);

// Single project operations
router.route('/projects/:id')
    .get(authorize('superadmin', 'admin', 'manager', 'user', 'viewer'), ProjectController.getProject)
    .patch(authorize('superadmin', 'admin', 'manager', 'user'), ProjectValidator.updateProjectValidator, validators, upload.single('projectLogo'), ProjectController.updateProject)
    .delete(authorize('superadmin', 'admin'), ProjectController.deleteProject);



// ---------------------------
// Notifications routes
// ---------------------------

// CRUD endpoints
router.post("/notifications", NotificationController.createNotification);
router.get("/notifications", NotificationController.getUserNotifications);
router.patch("/notifications/:id/read", NotificationController.markAsRead);
router.delete("/notifications/:id", NotificationController.deleteNotification);


// ---------------------------
// Permissions routes
// ---------------------------

router.get("/menu", authenticate, PermissionController.getMenus);
router.post("/menu", authenticate, PermissionController.createMenu);
router.put("/menu/:id", authenticate, PermissionController.updateMenu);
router.delete("/menu/:id", authenticate, PermissionController.deleteMenu);
router.get("/menu/type/:type", authenticate, PermissionController.getMenusByType);
router.patch("/menu/:id/toggle-status", authenticate, PermissionController.toggleMenuStatus);

// Assign menus to designation
router.post("/menu/assign", authenticate, PermissionController.assignMenus);
router.delete("/assign-menu/unselect", authenticate, unAssignMenusValidator, PermissionController.unAssignMenu)
router.get("/sidebar", authenticate, PermissionController.getSidebarForUser);
router.get("/assign-menu/designation/:designation_id/menus", authenticate, getAssignedMenusValidator, PermissionController.getAssignedMenus);
router.post("/assign-menu/assign", authenticate, assignMenusValidator, PermissionController.assignMenusToDesignation);

// Save user permissions
router.post("permisssions/user/permissions/:userId", authenticate, async (req, res) => {
    try {
        const { permissions } = req.body;
        const userId = req.params.userId;

        for (const perm of permissions) {
            await UserPermission.findOneAndUpdate(
                { user_id: userId, menu_id: perm.menu_id },
                {
                    $set: {
                        permissions: {
                            read: perm.read || false,
                            write: perm.write || false,
                            delete: perm.delete || false
                        },
                        assigned_by: {
                            user_id: req.user._id,
                            name: req.user.name,
                            email: req.user.email
                        },
                        assigned_date: new Date()
                    }
                },
                { upsert: true, new: true }
            );
        }
        // Increment global permissions version to auto-refresh sessions
        // incrementGlobalPermissionsVersion(designation_id);
        res.json({ success: true, message: "Permissions assigned successfully." });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ success: false, message: "Failed to assign permissions." });
    }
});

router.get("/permissions/user/:id/permissions", async (req, res) => {
    try {
        const userPermissions = await UserPermission.find({ user_id: req.params.id })
            .populate("menu_id", "name type master_id")
            .lean();
        logger.log(userPermissions);
        res.json({ success: true, data: userPermissions });
    } catch (err) {
        logger.error("Error fetching user permissions:", err);
        res.status(500).json({ success: false, message: "Error fetching user permissions" });
    }
});

// Get user permissions

router.post("/user/register", upload.single("profile_image"), UserController.registerUser);
router.get("/user", UserController.getAllUsers);
router.get("/user/search", UserController.searchUsers);
router.get("/user/:id", UserController.getUserById);
router.put("/user/:id",upload.single("profile_image"),UserController.updateUser);
router.delete("/user/:id", authorize('admin', 'superadmin', 'user'), UserController.deleteUser);


// ---------------------------
// TempFile routes
// ---------------------------

// ---------------------------
router.post("/tempfiles/upload/:folderId", async (req, res, next) => {
    try {
        const { folderId } = req.params;
        const folder = await Folder.findById(folderId);
        if (!folder) return res.status(404).json({ success: false, message: "Folder not found" });

        // Dynamically create uploader for the selected folder
        const uploader = createS3Uploader(folder.name);
        uploader.array("file")(req, res, (err) => {
            if (err) return next(err);
            TempController.tempUploadFile(req, res); // call your controller
        });
    } catch (err) {
        next(err);
    }
});

router.post("/files/upload/:folderId", async (req, res, next) => {
    try {
        const { folderId } = req.params;
        const folder = await Folder.findById(folderId);
        if (!folder) return res.status(404).json({ success: false, message: "Folder not found" });

        // Dynamically create uploader for the selected folder
        const uploader = createS3Uploader(folder.name);
        uploader.array("file")(req, res, (err) => {
            if (err) return next(err);
            TempController.uploadFile(req, res, folder); // call your controller
        });
    } catch (err) {
        next(err);
    }
});

// uploader to read folderName from body
router.post("/files/upload-folder/:folderId", ParentFolderName, s3uploadfolder.array('file'), async (req, res, next) => {
    try {
        const { folderId } = req.params;
        const parentfolder = await Folder.findById(folderId).select("name departmentId projectId ");

        if (!parentfolder)
            return res.status(404).json({ success: false, message: "Folder not found" });
        await TempController.handleFolderUpload(req, res, parentfolder);

    } catch (err) {
        next(err);
    }
});

router.get("/files/download/:fileName", TempController.download);
router.delete("/files/:fileId", TempController.deleteFile);
router.get("/files/:fileId/status", TempController.getFileStatus);


// ---------------------------
// Folder/Files Visted History
// ---------------------------


// Track folder visit
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

router.post('/session/track-folder-visit', async (req, res) => {
    try {
        let { folderId, projectId, departmentId } = req.body;

        if (!folderId || !isValidObjectId(folderId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid folder ID is required'
            });
        }

        // Convert IDs to ObjectId if valid
        folderId = new mongoose.Types.ObjectId(folderId);
        projectId = projectId && isValidObjectId(projectId) ? new mongoose.Types.ObjectId(projectId) : null;
        departmentId = departmentId && isValidObjectId(departmentId) ? new mongoose.Types.ObjectId(departmentId) : null;

        // Get folder details
        const folder = await Folder.findById(folderId);
        if (!folder) {
            return res.status(404).json({
                success: false,
                message: 'Folder not found'
            });
        }

        // Use folder's projectId/departmentId if not provided
        projectId = projectId || (folder.projectId && isValidObjectId(folder.projectId) ? new mongoose.Types.ObjectId(folder.projectId) : null);
        departmentId = departmentId || (folder.departmentId && isValidObjectId(folder.departmentId) ? new mongoose.Types.ObjectId(folder.departmentId) : null);

        // Find or create session
        let session = await UserFolderHistory.findOne({ userId: req.user._id });
        if (!session) {
            session = new UserFolderHistory({
                userId: req.user._id,
                projectId,
                departmentId,
                recentFolders: []
            });
        }

        // Build folder path
        let path = folder.name;
        if (folder.ancestors && folder.ancestors.length > 0) {
            const ancestors = await Folder.find({
                _id: { $in: folder.ancestors.filter(isValidObjectId) }
            }).select('name');

            const ancestorNames = ancestors.map(a => a.name).join(' / ');
            path = `${ancestorNames} / ${folder.name}`;
        }

        // Add to recent folders safely
        await session.addRecentFolder({
            folderId,
            folderName: folder.name,
            projectId,
            departmentId,
            path
        });

        res.json({
            success: true,
            message: 'Folder visit tracked successfully'
        });

    } catch (error) {
        console.error('Error tracking folder visit:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get recent folders
router.get('/session/recent-folders', async (req, res) => {
    try {
        const userFolderHistory = await UserFolderHistory.findOne({ userId: req.user._id })
            .populate('recentFolders.projectId', 'projectName')
            .populate('recentFolders.departmentId', 'name');

        if (!userFolderHistory || !userFolderHistory.recentFolders.length) {
            return res.json({ success: true, recentFolders: [], lastVisitedFolder: null });
        }

        // Sort recent folders by visitedAt descending
        const folders = userFolderHistory.recentFolders
            .filter(f => f.folderId)
            .sort((a, b) => b.visitedAt - a.visitedAt)
            .slice(0, 5);

        const projectMap = {};

        folders.forEach(f => {
            const projectId = f.projectId?._id.toString() || 'no_project';
            if (!projectMap[projectId]) {
                projectMap[projectId] = {
                    projectId: f.projectId?._id,
                    projectName: f.projectId?.projectName || 'No Project',
                    folders: []
                };
            }

            // Build nested folder tree using path
            const pathParts = f.path ? f.path.split('/').map(p => p.trim()) : [f.folderName];
            let currentLevel = projectMap[projectId].folders;

            pathParts.forEach((name, index) => {
                let existing = currentLevel.find(c => c.folderName === name);
                if (!existing) {
                    existing = {
                        folderId: index === pathParts.length - 1 ? f.folderId : null,
                        folderName: name,
                        path: pathParts.slice(0, index + 1).join(' / '),
                        department: index === pathParts.length - 1 && f.departmentId ? {
                            departmentId: f.departmentId._id,
                            name: f.departmentId.name
                        } : null,
                        visitedAt: index === pathParts.length - 1 ? f.visitedAt : null,
                        children: []
                    };
                    currentLevel.push(existing);
                }
                currentLevel = existing.children;
            });
        });

        // Last visited folder
        const lastVisitedFolder = userFolderHistory.lastVisitedFolder?.folderId ? {
            folderId: userFolderHistory.lastVisitedFolder.folderId._id,
            folderName: userFolderHistory.lastVisitedFolder.folderName,
            path: userFolderHistory.lastVisitedFolder.path,
            project: userFolderHistory.lastVisitedFolder.projectId ? {
                projectId: userFolderHistory.lastVisitedFolder.projectId._id,
                projectName: userFolderHistory.lastVisitedFolder.projectId.projectName
            } : null,
            department: userFolderHistory.lastVisitedFolder.departmentId ? {
                departmentId: userFolderHistory.lastVisitedFolder.departmentId._id,
                name: userFolderHistory.lastVisitedFolder.departmentId.name
            } : null,
            visitedAt: userFolderHistory.lastVisitedFolder.visitedAt
        } : null;

        res.json({
            success: true,
            recentFolders: Object.values(projectMap),
            lastVisitedFolder
        });

    } catch (error) {
        console.error('Error fetching recent folders:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});



// ---------------------------
// Folder Routes
// ---------------------------

/**
 * Folder Management
 */
// Create a new folder
router.post('/folders', FolderController.createFolder);
router.patch('/folderstatus/:folderId', FolderController.updateFolderStatus);

router.post('/folders/automatic', optionalAuth,FolderController.automaticProjectDepartmentFolderCreate);
// List folders (optionally filter by parent)
router.get('/folders', FolderController.listFolders);
router.get('/folders/all', FolderController.getAllFolders);

// Get folder details along with its contents
router.get('/folders/details/:id', FolderController.getFolder);

// Rename a folder
router.patch('/folders/:id/rename', FolderController.renameFolder);

// Update Folder status

// Soft delete a folder
router.delete('/folders/:id', FolderController.deleteFolder);
router.delete('/folders/recyclebin/empty', FolderController.emptyRecycleBin);

// Archive a folder
router.patch('/folders/:id/archive', FolderController.archiveFolder);

// Restore an archived folder
router.patch('/folders/:id/restore', FolderController.restoreFolder);

// Get all RecycleBin folders for the current user
router.get('/folders/recyclebin', FolderController.getRecycleBinFolders);

// Get all archived folders for the current user
router.get('/folders/archived', FolderController.getArchivedFolders);

// Get folder tree structure
router.get('/folders/tree/structure', FolderController.getFolderTree);


/**
 * Folders Permissions Management
 */

// GET list
router.get("/folders/permissions", FolderController.getFolderPermissions);
router.get('/folders/:folderId/access', FolderController.getFolderAccessByEmail);
//  PATCH update
router.patch("/folders/permissions/:logId", FolderController.updateFolderLogPermission);

// DELETE remove
router.delete("/folders/permissions/:logId", FolderController.deleteFolderPermission);


/**
 * File Management within Folders
 */
// Upload files to a specific folder
router.post('/folders/:folderId/upload', upload.array("files"), FolderController.uploadToFolder);

// Download a specific file
router.get('/folders/download/:fileId', authenticate, FolderController.downloadFile);


/**
 * Folder Sharing & Permissions
 */
// Update folder permissions
router.patch('/update/folders/:id/permissions', FolderController.updateFolderPermission);

// Fetch users with access and folder share info
router.get('/folders/:folderId', FolderController.getFolderShareInfo);

// Invite user to folder
router.post('/folders/:folderId/share', FolderController.shareFolder);

// Request access to folder
router.post('/folders/:folderId/request-access', FolderController.requestFolderAccess);

// Grant access to a user
router.post('/folders/:folderId/grant-access', FolderController.grantFolderAccess);

// Get folder access permissions
router.get('/folders/:folderId/access', FolderController.getFolderAccess);

// Remove user access
router.post('/folders/:folderId/unshare', FolderController.unshareFolder);

// Generate shareable link for a folder
router.post('/folders/:folderId/link', FolderController.generateShareLink);

// Access folder via shareable link
router.get('/folders/:folderId/access/:token', FolderController.accessViaToken);


// ---------------------------
// Donors and Vendors routes
// ---------------------------

// CRUD endpoints
router.post("/add-vendor-donor",
    upload.single('profile_image'),
    VenderDonorValidation.registerVendorOrDonor,
    DonerVenderController.registerDonorVendor
);

router.post("/add-vendor",
    upload.single('profile_image'),
    VenderDonorValidation.registerVendor,
    DonerVenderController.registerVendor
);


// get all donor base on the DataTable api (use POST for DataTables server-side)
router.post("/donors-list", DonerVenderController.getAllDonors);
// get all vendors based on the DataTable api
router.post("/vendors-list", DonerVenderController.getAllVendor);
// delete donor by id
router.delete("/donor-delete/:id", DonerVenderController.deleteDonorVendor);


export default router;
