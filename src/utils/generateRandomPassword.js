export const generateRandomPassword = (length = 12) => {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString("hex") // convert to hexadecimal string
        .slice(0, length);
};