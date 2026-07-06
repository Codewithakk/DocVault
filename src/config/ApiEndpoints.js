// Import dotenv to load environment variables
import dotenv from 'dotenv';
dotenv.config(); // Load variables from .env file

// ----------------------------
// API Endpoints
// ----------------------------
export const API_ENDPOINTS = {
    documents: '/documents',
    users: '/users',
    departments: '/departments',
    projects: '/projects',
    folders: '/folders',
    auth: '/auth',
    notifications: '/notifications',
    reports: '/reports',
    settings: '/settings'
};

// ----------------------------
// Centralized API Configuration
// ----------------------------
export const API_CONFIG = {
    // Application URLs
    FrontendUrl: process.env.FrontendUrl,
    baseUrl: process.env.BASE_URL,

    // Security / Secrets
    SESSION_SECRET: process.env.SESSION_SECRET,
    JWT_SECRET: process.env.JWT_SECRET,
    ACCESS_GRANT_SECRET: process.env.ACCESS_GRANT_SECRET,
    encryptedKey: process.env.URL_ENCRYPTION_KEY || '12345678901234567890123456789012',

    // Environment
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,

    // Database
    MONGO_URI: process.env.MONGO_URI,
    DB_NAME: process.env.DB_NAME,

    // AWS Configuration
    AWS_BUCKET: process.env.AWS_BUCKET,
    AWS_REGION: process.env.AWS_DEFAULT_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_ENDPOINT: process.env.AWS_ENDPOINT,
    AWS_URL: process.env.AWS_URL,

    // Cloudinary
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

    // API Behavior
    TOKEN_LOGIN_EXPIRES_IN: process.env.TOKEN_LOGIN_EXPIRES_IN,
    timeout: Number(process.env.API_TIMEOUT) || 5000,
    retryAttempts: Number(process.env.API_RETRY_ATTEMPTS) || 3,

    //Company Details
    COMPANY_NAME: process.env.COMPANY_NAME,
    LOGO_URL: process.env.LOGO_URL,
    EMAIL_BANNER: process.env.EMAIL_BANNER
};