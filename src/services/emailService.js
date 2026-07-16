import nodemailer from "nodemailer";
import logger from "../utils/logger.js";
/**
 * Send email using Brevo REST API
 * @param {Object} options
 * @param {string} options.to - Recipient
 * @param {string} options.subject - Subject
 * @param {string} options.html - HTML body
 * @param {string} [options.fromName="DMS Support Team"]
 */
export const sendEmail = async ({ to, subject, html, fromName = "Doc Vault" }) => {
    try {
        const BREVO_API_KEY = process.env.BREVO_API_KEY;
        // Use SMTP username as sender if available, otherwise use EMAIL_FROM_MAIL
        const SENDER_EMAIL = process.env.BREVO_SMTP_USER ||
            process.env.SENDER_EMAIL ||
            process.env.EMAIL_FROM_MAIL;

        if (!BREVO_API_KEY) {
            throw new Error("BREVO_API_KEY is required");
        }

        if (!SENDER_EMAIL) {
            throw new Error("Sender email is required");
        }

        const requestBody = {
            sender: {
                name: fromName || process.env.SENDER_NAME || "DMS Support Team",
                email: SENDER_EMAIL,  // Use verified sender
            },
            to: [{ email: to }],
            subject: subject,
            htmlContent: html,
            replyTo: {
                email: SENDER_EMAIL,
            },
        };
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "content-type": "application/json",
                "api-key": BREVO_API_KEY,
            },
            body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Brevo Error Response:", {
                status: response.status,
                data: data
            });

            // Handle specific error cases
            if (data.code === "invalid_parameter" && data.message.includes("sender")) {
                throw new Error(`Sender email "${SENDER_EMAIL}" is not verified in Brevo. Please verify it or use a different email.`);
            }

            throw new Error(data.message || `Failed to send email: ${response.status}`);
        }
        logger.info(`Email sent to ${to}`);
        return data;

    } catch (error) {
        logger.error("Email sending failed:", error);
        throw error;
    }
};