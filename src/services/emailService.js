import logger from "../utils/logger.js";
/**
 * Send email using Brevo REST API
 * @param {Object} options
 * @param {string} options.to - Recipient
 * @param {string} options.subject - Subject
 * @param {string} options.html - HTML body
 * @param {string} [options.fromName="DMS Support Team"]
 */
export const sendEmail = async ({ to, subject, html, fromName = "DMS Support Team" }) => {
    try {
        // Get Brevo credentials from environment
        const BREVO_API_KEY = process.env.BREVO_API_KEY;
        const SENDER_EMAIL = process.env.EMAIL_FROM_MAIL || process.env.BREVO_SENDER_EMAIL;

        if (!BREVO_API_KEY) {
            throw new Error("BREVO_API_KEY is required in environment variables");
        }

        if (!SENDER_EMAIL) {
            throw new Error("Sender email is required in environment variables");
        }

        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "content-type": "application/json",
                "api-key": BREVO_API_KEY,
            },
            body: JSON.stringify({
                sender: {
                    name: fromName || "DMS Support Team",
                    email: SENDER_EMAIL,
                },
                to: [{ email: to }],
                subject: subject,
                htmlContent: html,
                replyTo: {
                    email: SENDER_EMAIL,
                },
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            logger.error("Brevo Error:", data);
            throw new Error(data.message || "Failed to send email");
        }

        logger.info(`Email sent to ${to}`);
        return data;
    } catch (error) {
        logger.error("Email sending failed:", error);
        throw new Error("Email could not be sent");
    }
};