export const calculateExpiration = (duration, customEnd = null) => {
    const now = new Date();
    let expiresAt = null;

    switch (duration) {
        case "oneday":
            expiresAt = new Date(now.getTime() + 86400000);
            break;
        case "oneweek":
            expiresAt = new Date(now.getTime() + 7 * 86400000);
            break;
        case "onemonth":
            expiresAt = new Date(new Date(now).setMonth(now.getMonth() + 1));
            break;
        case "custom":
            if (customEnd) expiresAt = new Date(customEnd);
            break;
        case "lifetime":
            expiresAt = new Date(new Date(now).setFullYear(now.getFullYear() + 50));
            break;
        default:
            expiresAt = null;
    }

    return expiresAt;
};
