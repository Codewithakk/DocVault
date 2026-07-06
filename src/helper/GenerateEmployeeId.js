import User from "../models/User.js";

// Generate employee ID
export const generateEmployeeId = async () => {
    const count = await User.countDocuments({ profile_type: "user" });
    return `EMP${String(count + 1).padStart(4, "0")}`;
};