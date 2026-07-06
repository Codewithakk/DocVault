// utils/sessionHelpers.js
import mongoose from "mongoose";

export const getSessionFilters = (req) => {
    const selectedYear = req.session?.selectedYear || null;
    const selectedProjectId = req.session?.selectedProject || null;

    return {
        selectedYear,
        selectedProjectId: selectedProjectId ? new mongoose.Types.ObjectId(selectedProjectId) : null,
    };
};

export const applyFilters = (req, queryFields = {}) => {
    const sessionFilters = getSessionFilters(req);
    const { selectedYear, selectedProjectId } = sessionFilters;

    const filter = { ...queryFields };

    // Apply year filter
    if (selectedYear) {
        const year = parseInt(selectedYear, 10);
        if (!isNaN(year)) {
            filter.createdAt = filter.createdAt || {};
            filter.createdAt.$gte = new Date(year, 0, 1);
            filter.createdAt.$lt = new Date(year + 1, 0, 1);
        }
    }

    // Apply project filter
    if (selectedProjectId && mongoose.Types.ObjectId.isValid(selectedProjectId)) {
        filter.project = filter.project || selectedProjectId;
    }

    return filter;
};
