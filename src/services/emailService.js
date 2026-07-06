import nodemailer from "nodemailer";
import logger from "../utils/logger.js";

const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USER,
    EMAIL_PASSWORD,
    EMAIL_FROM_MAIL
} = process.env;

const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: Number(EMAIL_PORT) === 465,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
    },
    tls: {
        rejectUnauthorized: false,
    },
});

/**
 * Send an email
 * @param {Object} options
 * @param {string} options.to - Recipient
 * @param {string} options.subject - Subject
 * @param {string} options.html - HTML body
 * @param {string} [options.fromName="DMS Support Team"]
 */
export const sendEmail = async ({ to, subject, html, fromName = "DMS Support Team" }) => {
    try {
        await transporter.sendMail({
            from: `"${fromName}" <${EMAIL_FROM_MAIL}>`,
            to,
            subject,
            html,
            replyTo: EMAIL_USER,
        });
        logger.info(`Email sent to ${to}`);
    } catch (error) {
        logger.error("Email sending failed:", error);
        throw new Error("Email could not be sent");
    }
};
