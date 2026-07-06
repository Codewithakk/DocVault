import crypto from "crypto"
// Helper to generate random password
export const generateRandomPassword = (length = 10) => {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString("hex")
        .slice(0, length);
};