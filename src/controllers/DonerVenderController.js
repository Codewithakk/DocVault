import { API_CONFIG } from "../config/ApiEndpoints.js";
import { generateRandomPassword } from "../helper/GenerateRandomPassword.js";
import User from "../models/User.js";
import { sendEmail } from "../services/emailService.js";
import { activityLogger } from "../helper/activityLogger.js";
import { getDesignationId } from "../helper/CommonHelper.js";
import { generateEmailTemplate } from "../helper/emailTemplate.js";
//Page controller for Donor and Vendor Registration

// GET /donors/register
export const showDonorForm = async (req, res) => {
    try {
        const donor = req.query.id ? await User.findById(req.query.id).lean() : null;

        res.render("pages/registerations/donor-registration", {
            pageTitle: donor ? "Edit Donor" : "Register Donor",
            pageDescription: donor
                ? "Edit donor profile information and update their details."
                : "Register a new donor by filling in essential profile details.",
            metaKeywords: "donor registration, add donor, edit donor, manage donors",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            donor,
            isEdit: Boolean(donor),
            user: req.user
        });

    } catch (err) {
        logger.error("Error loading donor register page:", err);

        res.render("pages/registerations/donor-registration", {
            pageTitle: "Register Donor",
            pageDescription: "Register a new donor profile.",
            metaKeywords: "donor registration, donor form",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            donor: null,
            isEdit: false,
            user: req.user
        });
    }
};


// GET /donors/list
export const listDonors = async (req, res) => {
    try {
        const donors = await User.find({ profile_type: "donor" }).lean();

        res.render("pages/registerations/donor-listing", {
            pageTitle: "Donor List",
            pageDescription: "View all registered donors and manage their profiles.",
            metaKeywords: "donor list, donor records, manage donors",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            donors,
            user: req.user
        });

    } catch (err) {
        logger.error("Error fetching donor list:", err);

        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load donor list.",
            metaKeywords: "donor list error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load donor list"
        });
    }
};



// GET /vendors/register
export const showVendorForm = async (req, res) => {
    try {
        const vendor = req.query.id ? await User.findById(req.query.id).lean() : null;

        res.render("pages/registerations/vendor-registration", {
            pageTitle: vendor ? "Edit Vendor" : "Register Vendor",
            pageDescription: vendor
                ? "Update vendor information and manage details."
                : "Register a new vendor by filling in required information.",
            metaKeywords: "vendor registration, add vendor, edit vendor, vendor form",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            vendor,
            isEdit: Boolean(vendor),
            user: req.user
        });

    } catch (err) {
        logger.error("Error loading vendor register page:", err);

        res.render("pages/registerations/vendor-registration", {
            pageTitle: "Register Vendor",
            pageDescription: "Register a new vendor and add required details.",
            metaKeywords: "vendor registration, vendor form",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            vendor: null,
            isEdit: false,
            user: req.user
        });
    }
};

// GET /vendors/list
export const listVendors = async (req, res) => {
    try {
        const vendors = await User.find({ profile_type: "vendor" }).lean();

        res.render("pages/registerations/vendor-registration-list", {
            pageTitle: "Vendor List",
            pageDescription: "View and manage all registered vendors.",
            metaKeywords: "vendor list, vendor records, manage vendors",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,

            vendors,
            user: req.user
        });

    } catch (err) {
        logger.error("Error fetching vendor list:", err);

        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load vendor list.",
            metaKeywords: "vendor list error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load vendor list"
        });
    }
};



//API Controller for Donor and Vendor Registration

export const registerDonorVendor = async (req, res, next) => {
    try {
        const profile_image = req.file ? req.file.location : undefined;
        const designationId = await getDesignationId("donor");
        const {
            id,
            user_name,
            email_id,
            user_mobile,
            address,
            profile_type,
            donor_type,
            user_organization,
            pan_tax_id
        } = req.body || {};

        const role = profile_type || "donor";
        if (!["donor", "vendor"].includes(role)) {
            return res.status(400).json({ success: false, message: "Invalid profile type" });
        }


        // UPDATE FLOW
        if (id) {
            const existing = await User.findById(id);
            if (!existing) {
                return res.status(404).json({ success: false, message: "Record not found" });
            }

            // Resolve new values falling back to existing when missing
            const nextName = (typeof user_name !== 'undefined' && user_name !== '') ? user_name : existing.name;
            const nextEmail = (typeof email_id !== 'undefined' && email_id !== '') ? email_id : existing.email;
            const nextPhone = (typeof user_mobile !== 'undefined' && user_mobile !== '') ? user_mobile : existing.phone_number;
            const nextAddress = (typeof address !== 'undefined') ? address : existing.address;

            // If email is changing, ensure uniqueness
            if (nextEmail !== existing.email) {
                const emailUsed = await User.findOne({ email: nextEmail, _id: { $ne: id } });
                if (emailUsed) return res.status(400).json({ success: false, message: "Email already in use" });
            }

            const updateDoc = {
                name: nextName,
                email: nextEmail,
                phone_number: nextPhone,
                address: nextAddress,
                profile_type: role,
                donorDetails: role === "donor" ? {
                    donor_type: (typeof donor_type !== 'undefined' && donor_type !== '') ? donor_type : (existing.donorDetails?.donor_type),
                    organization_name: (typeof user_organization !== 'undefined') ? user_organization : (existing.donorDetails?.organization_name),
                    id_proof: (typeof pan_tax_id !== 'undefined') ? pan_tax_id : (existing.donorDetails?.id_proof),
                } : existing.donorDetails,
            };
            if (profile_image) updateDoc.profile_image = profile_image;

            const updated = await User.findByIdAndUpdate(id, { $set: updateDoc }, { new: true });
            return res.status(200).json({ success: true, message: "Donor updated successfully", data: updated });
        }

        // CREATE FLOW (require required fields)
        if (!user_name || !email_id || !user_mobile) {
            return res.status(400).json({ success: false, message: "Name, Email and Phone are required" });
        }
        const emailExists = await User.findOne({ email: email_id });
        if (emailExists) {
            return res.status(400).json({ success: false, message: "Email already in use" });
        }
        // Generate random password
        const randomPassword = generateRandomPassword();

        const newUser = new User({
            name: user_name,
            email: email_id,
            phone_number: user_mobile,
            raw_password: randomPassword,
            address,
            profile_type: role,
            profile_image,
            donorDetails: role === "donor" ? {
                donor_type,
                organization_name: user_organization,
                id_proof: pan_tax_id,
                designation: designationId
            } : undefined,
            vendorDetails: role === "vendor" ? { /* add vendor fields if needed */ } : undefined
        });

        await newUser.save();
        // Prepare HTML email content
        const data = {
            name: user_name,
            email: email_id,
            password: randomPassword,
            companyName: res.locals.companyName || "Our Company",
            logoUrl: res.locals.logo || "",
            bannerUrl: res.locals.mailImg || "",
            BASE_URL: API_CONFIG.baseUrl
        }
        // Generate HTML using your central email generator
        const html = generateEmailTemplate('registeration', data);

        await sendEmail({
            to: email_id,
            subject: "Welcome to E-Sangrah",
            html,
            fromName: "E-Sangrah Team",
        });
        await activityLogger({
            actorId: req.user._id,
            action: "ADDED_USER",
            details: `Donor Added by ${req.user?.name}`,
            meta: { email_id }
        });
        return res.status(201).json({ success: true, message: "Registration successful", data: newUser });

    } catch (error) {
        next(error);
    }
}

// Vendor registration endpoint (separate from donor), mirrors donor response style
export const registerVendor = async (req, res, next) => {
    try {
        // Multer file (optional)
        const uploadedProfileImage = req.file ? req.file.location : undefined;
        const designationId = await getDesignationId("vendor");
        // Extract vendor-specific fields from multipart/form-data
        const {
            id, // if present -> update existing vendor
            vendor_name,
            vendor_email,
            vendor_mobile,
            company_name,
            gst_number,
            contact_person,
            services_offered,
            vendor_address
        } = req.body || {};

        // UPDATE FLOW
        if (id) {
            const existing = await User.findById(id);
            if (!existing) {
                return res.status(404).json({ success: false, message: "Record not found" });
            }

            // Resolve next values falling back to existing
            const nextName = (typeof vendor_name !== 'undefined' && vendor_name !== '') ? vendor_name : existing.name;
            const nextEmail = (typeof vendor_email !== 'undefined' && vendor_email !== '') ? vendor_email : existing.email;
            const nextPhone = (typeof vendor_mobile !== 'undefined' && vendor_mobile !== '') ? vendor_mobile : existing.phone_number;
            const nextAddress = (typeof vendor_address !== 'undefined') ? vendor_address : existing.address;

            // If email is changing, ensure uniqueness
            if (nextEmail !== existing.email) {
                const emailUsed = await User.findOne({ email: nextEmail, _id: { $ne: id } });
                if (emailUsed) return res.status(400).json({ success: false, message: "Email already in use" });
            }

            // services_offered can be string, array, or omitted
            let servicesArray;
            if (typeof services_offered === 'string') {
                servicesArray = services_offered.split(',').map(s => s.trim()).filter(Boolean);
            } else if (Array.isArray(services_offered)) {
                servicesArray = services_offered.map(s => String(s).trim()).filter(Boolean);
            } else {
                servicesArray = existing.vendorDetails?.services_offered || [];
            }

            const nextGst = (typeof gst_number !== 'undefined' && gst_number !== '')
                ? String(gst_number).toUpperCase()
                : (existing.vendorDetails?.gst_number || '');

            const nextCompany = (typeof company_name !== 'undefined' && company_name !== '')
                ? company_name
                : (existing.vendorDetails?.company_name || '');

            const nextContact = (typeof contact_person !== 'undefined' && contact_person !== '')
                ? contact_person
                : (existing.vendorDetails?.contact_person || '');

            const updateDoc = {
                name: nextName,
                email: nextEmail,
                phone_number: nextPhone,
                address: nextAddress,
                profile_type: 'vendor',
                vendorDetails: {
                    company_name: nextCompany,
                    gst_number: nextGst,
                    contact_person: nextContact,
                    services_offered: servicesArray,
                }
            };
            if (uploadedProfileImage) updateDoc.profile_image = uploadedProfileImage;

            const updated = await User.findByIdAndUpdate(id, { $set: updateDoc }, { new: true });
            await activityLogger({
                actorId: req.user._id,
                action: "ADDED_USER",
                details: `Vendor Added by ${req.user?.name}`,
                meta: { vendor_email }
            });
            return res.status(200).json({ success: true, message: "Vendor updated successfully", data: updated });
        }

        // CREATE FLOW (require required fields)
        if (!vendor_name || !vendor_email || !vendor_mobile || !company_name || !gst_number || !contact_person || !services_offered) {
            return res.status(400).json({ success: false, message: "All required fields must be provided" });
        }

        // Email uniqueness for create
        const existingEmail = await User.findOne({ email: vendor_email });
        if (existingEmail) {
            return res.status(400).json({ success: false, message: "Email already in use" });
        }

        // Normalize fields
        const gst = String(gst_number).toUpperCase();
        let servicesArrayCreate = services_offered;
        if (typeof services_offered === 'string') {
            servicesArrayCreate = services_offered.split(',').map(s => s.trim()).filter(Boolean);
        } else if (!Array.isArray(services_offered)) {
            servicesArrayCreate = [];
        }
        // Generate random password
        const randomPassword = generateRandomPassword();
        // Create vendor user
        const user = new User({
            name: vendor_name,
            email: vendor_email,
            phone_number: vendor_mobile,
            raw_password: randomPassword, // will be hashed by pre-save middleware
            address: vendor_address || '',
            profile_type: 'vendor',
            profile_image: uploadedProfileImage,
            vendorDetails: {
                company_name,
                gst_number: gst,
                contact_person,
                services_offered: servicesArrayCreate,
                designation: designationId
            }
        });
        const data = {
            name: vendor_name,
            email: vendor_email,
            password: randomPassword,
            companyName: res.locals.companyName || "Our Company",
            logoUrl: res.locals.logo || "",
            bannerUrl: res.locals.mailImg || "",
            BASE_URL: API_CONFIG.baseUrl
        }
        // Generate HTML using your central email generator
        const html = generateEmailTemplate('registeration', data);

        await sendEmail({
            to: vendor_email,
            subject: "Welcome to E-Sangrah",
            html,
            fromName: "E-Sangrah Team",
        });

        await user.save();
        return res.status(201).json({ success: true, message: "Registration successful", data: user });
    } catch (error) {
        next(error);
    }
}

// same make the register vender api as register donor api but keep follow the response of register donor api
export const getAllVendor = async (req, res, next) => {
    try {
        const src = Object.keys(req.body || {}).length ? req.body : req.query || {};

        const parseIntSafe = (v, d = 0) => {
            const n = parseInt(v, 10);
            return Number.isFinite(n) ? n : d;
        };

        // Build columns[]
        let columns = Array.isArray(src.columns) ? src.columns : [];
        if (!columns.length) {
            const colMap = {};
            for (const k of Object.keys(src)) {
                const m = k.match(/^columns\[(\d+)\]\[(\w+)\]$/);
                if (m) {
                    const idx = parseIntSafe(m[1]);
                    colMap[idx] = colMap[idx] || {};
                    colMap[idx][m[2]] = src[k];
                }
            }
            const maxIdx = Math.max(-1, ...Object.keys(colMap).map(i => parseIntSafe(i)));
            columns = Array.from({ length: maxIdx + 1 }, (_, i) => colMap[i] || {});
        }

        // Build order[]
        let orderArr = Array.isArray(src.order) ? src.order : [];
        if (!orderArr.length) {
            const ordMap = {};
            for (const k of Object.keys(src)) {
                const m = k.match(/^order\[(\d+)\]\[(\w+)\]$/);
                if (m) {
                    const idx = parseIntSafe(m[1]);
                    ordMap[idx] = ordMap[idx] || {};
                    ordMap[idx][m[2]] = src[k];
                }
            }
            const maxIdx = Math.max(-1, ...Object.keys(ordMap).map(i => parseIntSafe(i)));
            orderArr = Array.from({ length: maxIdx + 1 }, (_, i) => ordMap[i] || {});
        }

        const draw = parseIntSafe(src.draw, 0);
        const start = parseIntSafe(src.start, 0);
        const length = parseIntSafe(src.length, 10) || 10;
        const order = orderArr[0] || { column: 0, dir: 'asc' };
        const searchVal = (src.search && src.search.value) || src['search[value]'] || '';
        const globalSearch = String(searchVal || '').trim();

        // Column name to DB field map
        const columnMap = {
            '#': null,
            'id': '_id',
            'full_name': 'name',
            'email': 'email',
            'phone': 'phone_number',
            'company_name': 'vendorDetails.company_name',
            'gst_tax_id': 'vendorDetails.gst_number',
            'contact_person': 'vendorDetails.contact_person',
            'services_offered': 'vendorDetails.services_offered',
            'address': 'address'
        };

        let sortField = '_id';
        if (columns.length && order && typeof order.column !== 'undefined') {
            const colIndex = parseIntSafe(order.column, 0);
            const colDef = columns[colIndex];
            const requestedDataKey = colDef && (colDef.data || colDef.name);
            if (requestedDataKey && columnMap[requestedDataKey]) {
                sortField = columnMap[requestedDataKey];
            }
        }
        const sortDir = (order.dir || 'asc').toLowerCase() === 'desc' ? -1 : 1;

        const baseFilter = { profile_type: 'vendor' };
        let queryFilter = { ...baseFilter };
        if (globalSearch && String(globalSearch).trim().length > 0) {
            const regex = new RegExp(String(globalSearch).trim(), 'i');
            queryFilter = {
                ...baseFilter,
                $or: [
                    { name: regex },
                    { email: regex },
                    { phone_number: regex },
                    { address: regex },
                    { 'vendorDetails.company_name': regex },
                    { 'vendorDetails.gst_number': regex },
                    { 'vendorDetails.contact_person': regex },
                    { 'vendorDetails.services_offered': regex },
                ]
            };
        }

        const recordsTotal = await User.countDocuments(baseFilter);
        const recordsFiltered = await User.countDocuments(queryFilter);

        const vendors = await User.find(queryFilter)
            .select({ _id: 1, name: 1, email: 1, phone_number: 1, address: 1, vendorDetails: 1 })
            .sort({ [sortField]: sortDir })
            .skip(start)
            .limit(length);

        const data = vendors.map(v => ({
            id: String(v._id),
            full_name: v.name || '-',
            email: v.email || '-',
            phone: v.phone_number || '-',
            company_name: v.vendorDetails?.company_name || '-',
            gst_tax_id: v.vendorDetails?.gst_number || '-',
            contact_person: v.vendorDetails?.contact_person || '-',
            services_offered: Array.isArray(v.vendorDetails?.services_offered)
                ? v.vendorDetails.services_offered.join(', ')
                : (v.vendorDetails?.services_offered || '-'),
            address: v.address || '-',
        }));

        return res.json({ draw, recordsTotal, recordsFiltered, data });
    } catch (error) {
        try {
            const draw = parseInt((req.body && req.body.draw) || (req.query && req.query.draw) || 0, 10) || 0;
            return res.status(200).json({ draw, recordsTotal: 0, recordsFiltered: 0, data: [] });
        } catch (_) {
            return next(error);
        }
    }
}



// DataTables server-side endpoint for donors
export const getAllDonors = async (req, res, next) => {
    try {
        // Helpers to collect DataTables params from POST body or GET bracket-notation query
        const src = Object.keys(req.body || {}).length ? req.body : req.query || {};

        const parseIntSafe = (v, d = 0) => {
            const n = parseInt(v, 10);
            return Number.isFinite(n) ? n : d;
        };

        // Build columns[] from either structured body or query like columns[0][data]
        let columns = Array.isArray(src.columns) ? src.columns : [];
        if (!columns.length) {
            const colMap = {};
            for (const k of Object.keys(src)) {
                const m = k.match(/^columns\[(\d+)\]\[(\w+)\]$/);
                if (m) {
                    const idx = parseIntSafe(m[1]);
                    colMap[idx] = colMap[idx] || {};
                    colMap[idx][m[2]] = src[k];
                }
            }
            const maxIdx = Math.max(-1, ...Object.keys(colMap).map(i => parseIntSafe(i)));
            columns = Array.from({ length: maxIdx + 1 }, (_, i) => colMap[i] || {});
        }

        // Build order[] similarly
        let orderArr = Array.isArray(src.order) ? src.order : [];
        if (!orderArr.length) {
            const ordMap = {};
            for (const k of Object.keys(src)) {
                const m = k.match(/^order\[(\d+)\]\[(\w+)\]$/);
                if (m) {
                    const idx = parseIntSafe(m[1]);
                    ordMap[idx] = ordMap[idx] || {};
                    ordMap[idx][m[2]] = src[k];
                }
            }
            const maxIdx = Math.max(-1, ...Object.keys(ordMap).map(i => parseIntSafe(i)));
            orderArr = Array.from({ length: maxIdx + 1 }, (_, i) => ordMap[i] || {});
        }

        // Primitive params
        const draw = parseIntSafe(src.draw, 0);
        const start = parseIntSafe(src.start, 0);
        const length = parseIntSafe(src.length, 10) || 10;
        const order = orderArr[0] || { column: 0, dir: 'asc' };
        const searchVal = (src.search && src.search.value) || src['search[value]'] || '';
        const globalSearch = String(searchVal || '').trim();

        // Map DataTable column index/name to Mongo sort field
        // Column data keys expected by the frontend
        const columnMap = {
            '#': null,
            'id': '_id',
            'full_name': 'name',
            'email': 'email',
            'phone': 'phone_number',
            'organization_name': 'donorDetails.organization_name',
            'donor_type': 'donorDetails.donor_type',
            'pan_tax_id': 'donorDetails.id_proof',
            'address': 'address'
        };

        let sortField = '_id';
        if (columns.length && order && typeof order.column !== 'undefined') {
            const colIndex = parseIntSafe(order.column, 0);
            const colDef = columns[colIndex];
            const requestedDataKey = colDef && (colDef.data || colDef.name);
            if (requestedDataKey && columnMap[requestedDataKey]) {
                sortField = columnMap[requestedDataKey];
            }
        }
        const sortDir = (order.dir || 'asc').toLowerCase() === 'desc' ? -1 : 1;

        const baseFilter = { profile_type: 'donor' };

        // Global search across relevant fields
        let queryFilter = { ...baseFilter };
        if (globalSearch && String(globalSearch).trim().length > 0) {
            const regex = new RegExp(String(globalSearch).trim(), 'i');
            queryFilter = {
                ...baseFilter,
                $or: [
                    { name: regex },
                    { email: regex },
                    { phone_number: regex },
                    { address: regex },
                    { 'donorDetails.organization_name': regex },
                    { 'donorDetails.donor_type': regex },
                    { 'donorDetails.id_proof': regex }
                ]
            };
        }

        // Totals
        const recordsTotal = await User.countDocuments(baseFilter);
        const recordsFiltered = await User.countDocuments(queryFilter);

        // Fetch page
        const donors = await User.find(queryFilter)
            .select({
                _id: 1,
                name: 1,
                email: 1,
                phone_number: 1,
                address: 1,
                donorDetails: 1
            })
            .sort({ [sortField]: sortDir })
            .skip(start)
            .limit(length);

        // Shape data to match frontend columns
        const data = donors.map((u) => ({
            id: String(u._id),
            full_name: u.name || '-',
            email: u.email || '-',
            phone: u.phone_number || '-',
            organization_name: u.donorDetails?.organization_name || '-',
            donor_type: u.donorDetails?.donor_type || '-',
            pan_tax_id: u.donorDetails?.id_proof || '-',
            address: u.address || '-'
        }));

        return res.json({
            draw,
            recordsTotal,
            recordsFiltered,
            data
        });
    } catch (error) {
        try {
            // Return a safe DataTables envelope to avoid front-end retry loops
            const draw = parseInt((req.body && req.body.draw) || (req.query && req.query.draw) || 0, 10) || 0;
            return res.status(200).json({ draw, recordsTotal: 0, recordsFiltered: 0, data: [] });
        } catch (_) {
            return next(error);
        }
    }
}

/* ===========================
   Delete Dover by ID
=========================== */
export const deleteDonorVendor = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, message: "ID is required" });
        }
        const deleted = await User.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Record not found" });
        }
        return res.status(200).json({ success: true, message: "Record deleted successfully" });
    } catch (error) {
        next(error);
    }
}
