import Document from "../models/Document.js";
import logger from "../utils/logger.js";

/**
 * Get department-wise upload percentage
 * @route GET /api/reports/uploads
 * @query period=daily|monthly|yearly
 */
export const getDepartmentUploadStats = async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const userId = req.session.user._id;
        const today = new Date();

        // Date ranges
        const dailyStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const monthlyStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const yearlyStart = new Date(today.getFullYear(), 0, 1);

        // Fetch all documents owned by this user
        const docs = await Document.find({ owner: userId }).populate("department", "name");

        // Helper: filter and count by department
        const buildReport = (startDate) => {
            const filtered = docs.filter(d => d.createdAt >= startDate);

            const departmentCounts = {};
            filtered.forEach(doc => {
                const deptId = doc.department ? doc.department._id.toString() : "unknown";
                const deptName = doc.department ? doc.department.name : "Unknown";

                if (!departmentCounts[deptId]) {
                    departmentCounts[deptId] = { name: deptName, count: 0 };
                }
                departmentCounts[deptId].count++;
            });

            const total = filtered.length;
            return {
                total,
                departments: Object.entries(departmentCounts).map(([id, info]) => ({
                    departmentId: id,
                    departmentName: info.name,
                    count: info.count,
                    percentage: total > 0 ? ((info.count / total) * 100).toFixed(2) : "0.00"
                }))
            };
        };

        res.json({
            daily: buildReport(dailyStart),
            monthly: buildReport(monthlyStart),
            yearly: buildReport(yearlyStart)
        });

    } catch (err) {
        logger.error("Error in getDepartmentUploadStats:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};
