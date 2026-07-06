import mongoose from "mongoose";

const WebSettingSchema = new mongoose.Schema({
    companyName: { type: String, required: true, default: "" },
    supportTeamName: { type: String, required: true, default: "" },
    metaTitle: { type: String, default: "" },
    metaDescription: { type: String, default: "" },
    metaKeywords: { type: String, default: "" },

    companyEmail: { type: String, required: true, default: "" },
    supportEmail: { type: String, required: true, default: "" },

    logo: String,
    favicon: String,
    banner: String,
    mailImg: String,
    forgetpasswordImg: String,
    checkMailImg: String,

}, { timestamps: true });

export default mongoose.models.WebSetting || mongoose.model("WebSetting", WebSettingSchema);
