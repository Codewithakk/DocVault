import Menu from "../models/Menu.js";
import MenuAssignment from "../models/MenuAssignment.js";
import UserPermission from "../models/UserPermission.js";

// Normalize URL helper
const normalizeUrl = (url) => {
    url = url.split('?')[0];
    if (url.startsWith('/api')) url = url.substring(4);
    if (!url.startsWith('/')) url = '/' + url;
    url = url.replace(/\/[0-9a-fA-F]{24}/g, '/:id').replace(/\/\d+/g, '/:id');
    url = url.replace(/\/+$/, '') || '/';
    return url;
};

const methodMap = { GET: 'read', POST: 'write', PUT: 'write', PATCH: 'write', DELETE: 'delete' };

// 🔥 NEW — FETCH DESIGNATION FOR ALL USER TYPES
function getUserDesignationId(user) {
    return (
        user?.userDetails?.designation ||
        user?.vendorDetails?.designation ||
        user?.donorDetails?.designation ||
        null
    );
}

const fetchUserPermissions = async (userId, designationId, menuId) => {
    const [designationPermission, userPermission] = await Promise.all([
        MenuAssignment.findOne({ designation_id: designationId, menu_id: menuId }).lean(),
        UserPermission.findOne({ user_id: userId, menu_id: menuId }).lean()
    ]);

    return {
        designation: designationPermission?.permissions || {},
        user: userPermission?.permissions || {}
    };
};

const checkPermissions = async (req, res, next) => {
    try {
        const user = req.user || req.session.user;

        const isApi = req.originalUrl.startsWith('/api') || req.headers.accept?.includes('application/json');

        if (!user) {
            return isApi
                ? res.status(401).json({ error: 'Unauthorized' })
                : res.redirect('/login');
        }

        // Superadmin/Admin bypass
        if (['superadmin', 'admin'].includes(user.profile_type)) {
            return next();
        }

        const userId = user._id.toString();

        const designationId = getUserDesignationId(user);

        if (!designationId) {
            console.warn("[RBAC] No designation found for user:", userId);
            return res.status(403).json({ error: "No designation assigned" });
        }

        const url = normalizeUrl(req.originalUrl);

        const menu = await Menu.findOne({
            isActive: true,
            $or: [
                { url },
                { url: url.replace(/\/:id/g, '/:id') }
            ]
        }).lean();

        if (!menu) {
            return isApi
                ? res.status(404).json({ error: 'Menu not found or inactive', requestedUrl: url })
                : res.status(404).render('error', { title: 'Menu Not Found', message: 'Menu not found or inactive' });
        }

        const menuId = menu._id.toString();
        const requiredPermission = methodMap[req.method] || "read";

        const perms = await fetchUserPermissions(userId, designationId.toString(), menuId);

        const hasPermission = !!(
            perms.designation[requiredPermission] ||
            perms.user[requiredPermission]
        );

        if (hasPermission) return next();

        return isApi
            ? res.status(403).json({ error: 'Forbidden', required: requiredPermission })
            : res.status(403).render('no-permission', { title: '403 - Forbidden', message: 'You do not have permission.' });

    } catch (error) {
        console.error('[RBAC Error]', error);
        return req.originalUrl.startsWith('/api') || req.headers.accept?.includes('application/json')
            ? res.status(500).json({ error: 'Internal Server Error', details: error.message })
            : res.status(500).render('error', { title: 'Internal Server Error', message: error.message });
    }
};

export default checkPermissions;
