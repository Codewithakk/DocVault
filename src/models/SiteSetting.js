// models/SiteSetting.js
import mongoose from "mongoose";


const siteSettingSchema = new mongoose.Schema({
    site_title: {
        type: String,
        required: true
    },
    meta_title: {
        type: String,
        default: ''
    },
    meta_description: {
        type: String,
        default: ''
    },
    logo_image: {
        type: String,
        default: ''
    },
    fav_icon_image: {
        type: String,
        default: ''
    },
    currency: {
        type: String,
        default: 'INR'
    },
    office_address: {
        type: String,
        default: ''
    },
    office_city: {
        type: String,
        default: ''
    },
    office_latitude: {
        type: String,
        default: ''
    },
    office_longitude: {
        type: String,
        default: ''
    },
    time_zone: {
        type: String,
        default: 'Asia/Calcutta'
    },
    website_link: {
        type: String,
        default: ''
    },
    organization_email_id: {
        type: String,
        default: ''
    },
    organization_mobile_no: {
        type: String,
        default: ''
    },
    organization_name: {
        type: String,
        default: ''
    },
    organization_whatsapp_no: {
        type: String,
        default: ''
    },
    add_date: {
        type: Date,
        default: Date.now
    },
    updated_on: {
        type: Date,
        default: Date.now
    }
});

const SiteSetting = mongoose.model("SiteSetting", siteSettingSchema);

export default SiteSetting;