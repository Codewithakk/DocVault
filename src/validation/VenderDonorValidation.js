import { body } from "express-validator";

export const registerVendorOrDonor = [
    // user_name: required on create, optional on update but must be valid if provided
    body("user_name")
        .if(body("id").exists().notEmpty().bail().custom(() => true))
        .optional({ nullable: true })
        .trim()
        .isLength({ min: 2 }).withMessage("Name must be at least 2 characters long")
        .bail()
        .if(body("id").not().exists())
        .notEmpty().withMessage("Name is required"),

    // email_id: required on create, optional on update; if provided must be email
    body("email_id")
        .if(body("id").exists())
        .optional({ nullable: true })
        .trim()
        .isEmail().withMessage("Invalid email format")
        .bail()
        .if(body("id").not().exists())
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Invalid email format"),
    
    // user_mobile: required on create, optional on update, validate format if provided
    body("user_mobile")
        .if(body("id").exists())
        .optional({ nullable: true })
        .trim()
        .matches(/^\d{10}$/).withMessage("Mobile number must be exactly 10 digits")
        .bail()
        .if(body("id").not().exists())
        .notEmpty().withMessage("Mobile number is required")
        .matches(/^\d{10}$/).withMessage("Mobile number must be exactly 10 digits"),

    // donor_type: optional; if provided, accept lower-case values used by model
    body("donor_type")
        .optional({ nullable: true })
        .isIn(["individual", "corporate", "ngo", "Individual", "Corporate", "NGO"]).withMessage("Invalid donor type"),

    body("profile_type")
        .optional({ nullable: true })
        .isIn(["vendor", "donor"]).withMessage("Invalid profile type"),
    
    // user_organization: required on create, optional on update
    body("user_organization")
        .if(body("id").exists())
        .optional({ nullable: true })
        .trim()
        .bail()
        .if(body("id").not().exists())
        .notEmpty().withMessage("Organization / Individual Name is required"),

    // pan_tax_id: required on create, optional on update; validate if provided
    body("pan_tax_id")
        .if(body("id").exists())
        .optional({ nullable: true })
        .trim()
        .matches(/^[A-Z0-9]{10}$/).withMessage("PAN / Tax ID must be 10 alphanumeric characters")
        .bail()
        .if(body("id").not().exists())
        .notEmpty().withMessage("PAN / Tax ID is required")
        .matches(/^[A-Z0-9]{10}$/).withMessage("PAN / Tax ID must be 10 alphanumeric characters"),

    body("address")
        .optional({ nullable: true })
        .trim()
        .isLength({ min: 5 }).withMessage("Address must be at least 5 characters long"),
];

// Vendor registration (multipart/form-data)
// Expected fields from form-data:
// vendor_name, vendor_email, vendor_mobile, company_name, gst_number,
// contact_person, services_offered, vendor_address (optional), profile_image (optional)
export const registerVendor = [
    // vendor_name: required on create, optional on update
    body("vendor_name")
        .if(body("id").exists())
        .optional({ nullable: true })
        .trim()
        .isLength({ min: 2 }).withMessage("Full name must be at least 2 characters")
        .bail()
        .if(body("id").not().exists())
        .notEmpty().withMessage("Full name is required")
        .isLength({ min: 2 }).withMessage("Full name must be at least 2 characters"),

    // vendor_email: required on create, optional on update; if provided, must be email
    body("vendor_email")
        .if(body("id").exists())
        .optional({ nullable: true })
        .trim()
        .isEmail().withMessage("Invalid email format")
        .bail()
        .if(body("id").not().exists())
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Invalid email format"),

    // vendor_mobile: required on create, optional on update; if provided must be 10 digits
    body("vendor_mobile")
        .if(body("id").exists())
        .optional({ nullable: true })
        .trim()
        .matches(/^\d{10}$/).withMessage("Mobile number must be exactly 10 digits")
        .bail()
        .if(body("id").not().exists())
        .notEmpty().withMessage("Mobile number is required")
        .matches(/^\d{10}$/).withMessage("Mobile number must be exactly 10 digits"),

    // company_name: required on create, optional on update
    body("company_name")
        .if(body("id").exists())
        .optional({ nullable: true })
        .trim()
        .bail()
        .if(body("id").not().exists())
        .notEmpty().withMessage("Company name is required"),

    // GST/tax ID: allow 10-15 alphanumeric; required on create, optional on update
    body("gst_number")
        .if(body("id").exists())
        .optional({ nullable: true })
        .trim()
        .matches(/^[A-Za-z0-9]{10,15}$/).withMessage("GST/Tax ID must be 10-15 alphanumeric characters")
        .bail()
        .if(body("id").not().exists())
        .notEmpty().withMessage("GST/Tax ID is required")
        .matches(/^[A-Za-z0-9]{10,15}$/).withMessage("GST/Tax ID must be 10-15 alphanumeric characters"),

    // contact_person: required on create, optional on update
    body("contact_person")
        .if(body("id").exists())
        .optional({ nullable: true })
        .trim()
        .bail()
        .if(body("id").not().exists())
        .notEmpty().withMessage("Contact person name is required"),

    // services_offered: required on create, optional on update; allow string or array
    body("services_offered")
        .if(body("id").exists())
        .optional({ nullable: true })
        .custom((val) => {
            if (Array.isArray(val)) return val.length > 0;
            if (typeof val === 'string') return val.trim().length > 0;
            return true;
        }).withMessage("Services/Products offered is required")
        .bail()
        .if(body("id").not().exists())
        .custom((val) => {
            if (Array.isArray(val)) return val.length > 0;
            if (typeof val === 'string') return val.trim().length > 0;
            return false;
        }).withMessage("Services/Products offered is required"),

    body("vendor_address")
        .optional({ nullable: true })
        .trim()
        .isLength({ min: 5 }).withMessage("Address must be at least 5 characters long"),

    // Optional file validation via multer present in req.file
    body("profile_image").custom((value, { req }) => {
        if (!req.file) return true;
        const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
        if (!allowed.includes(req.file.mimetype)) {
            throw new Error("Only JPEG, PNG, JPG, or WEBP images are allowed");
        }
        return true;
    }),

    // Optional: if provided, ensure it's 'vendor'
    body("profile_type")
        .optional({ nullable: true })
        .isIn(["vendor"]).withMessage("profile_type must be 'vendor'")
];
