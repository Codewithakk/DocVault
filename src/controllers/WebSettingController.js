import WebSetting from "../models/WebSetting.js";

export const updateWebSettings = async (req, res) => {
    try {
        let settings = await WebSetting.findOne();
        if (!settings) settings = new WebSetting();

        const { companyName, metaTitle, metaDescription, supportTeamName, metaKeywords, companyEmail, supportEmail } = req.body;
        // Validate required
        if (!companyEmail || !supportEmail || !supportTeamName) {
            return res.status(400).json({
                success: false,
                message: "Company Email and Support Email are required."
            });
        }

        // Update fields (only overwrite if provided)
        settings.companyName = companyName ?? settings.companyName;
        settings.metaTitle = metaTitle ?? settings.metaTitle;
        settings.metaDescription = metaDescription ?? settings.metaDescription;
        settings.metaKeywords = metaKeywords ?? settings.metaKeywords;
        settings.supportTeamName = supportTeamName ?? settings.supportTeamName;
        settings.companyEmail = companyEmail;
        settings.supportEmail = supportEmail;

        // Upload images
        const f = req.files;

        if (f?.logo) settings.logo = "/uploads/web-settings/" + f.logo[0].filename;
        if (f?.favicon) settings.favicon = "/uploads/web-settings/" + f.favicon[0].filename;
        if (f?.banner) settings.banner = "/uploads/web-settings/" + f.banner[0].filename;
        if (f?.mailImg) settings.mailImg = "/uploads/web-settings/" + f.mailImg[0].filename;
        if (f?.forgetpasswordImg) settings.forgetpasswordImg = "/uploads/web-settings/" + f.forgetpasswordImg[0].filename;
        if (f?.checkMailImg) settings.checkMailImg = "/uploads/web-settings/" + f.checkMailImg[0].filename;

        await settings.save();

        return res.json({
            success: true,
            message: "Web settings updated successfully",
            data: settings
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Error updating web settings"
        });
    }
};


export const getWebSettings = async (req, res) => {
    try {
        const settings = await WebSetting.findOne();
        return res.json({ success: true, data: settings });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
