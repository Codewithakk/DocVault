import Designation from "../models/Designation.js";

const checkAccessPermission = (resource = "files") => {
    return async (req, res, next) => {
        try {
            const user = req.user || req.session.user;
            // Default: No access
            req.accessPermission = {
                own: false,
                team: false,
                department: false,
                otherDepartments: false,
                allOrganizations: false,
            };

            // No user, just continue
            if (!user) {
                return next();
            }

            // Admin/Superadmin -> Full access
            if (["superadmin", "admin"].includes(user.profile_type)) {
                req.accessPermission = {
                    own: true,
                    team: true,
                    department: true,
                    otherDepartments: true,
                    allOrganizations: true
                };

                return next();
            }

            const designationId = user.userDetails?.designation ||   req.session?.user?.userDetails?.designation;

            if (!designationId) {
                return next();
            }

            const designation = await Designation.findById(designationId).lean();

            if (!designation) {
                return next();
            }

            req.accessPermission = {
                own:
                    resource === "folders"
                        ? designation.ownFolders
                        : designation.ownFiles,

                team: designation.teamFiles,
                department: designation.deptFiles,
                otherDepartments: designation.otherDepts,
                allOrganizations: designation.allOrgs,
            };

            next();
        } catch (err) {
            console.error("[Access Permission]", err);

            // Don't block request
            next();
        }
    };
};

export default checkAccessPermission;