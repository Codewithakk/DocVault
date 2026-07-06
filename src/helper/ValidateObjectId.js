import mongoose from "mongoose";

export const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const validateObjectIdArray = (arr) => {
    if (!Array.isArray(arr)) return false;
    return arr.every((id) => isValidObjectId(id));
};

// normalize to arrays
export const normalizeToArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
};