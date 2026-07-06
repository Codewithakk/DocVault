
// utils/formatDate.js

export function formatDateDDMMYYYY(date) {
    if (!date) return "";
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}




/**
 * parseDateDDMMYYYY
 * Converts dd/mm/yyyy OR yyyy-mm-dd strings into a Date object.
 * @param {string} dateStr
 * @returns {Date|null}
 */
export function parseDateDDMMYYYY(dateStr) {
    if (!dateStr) return null;

    const parts = dateStr.split(/[\/\-]/); // supports "/" or "-"
    if (parts.length !== 3) return null;

    let day, month, year;

    // Detect if format is yyyy-mm-dd or dd/mm/yyyy
    if (parseInt(parts[0], 10) > 31) {
        // likely yyyy-mm-dd
        [year, month, day] = parts.map(p => parseInt(p, 10));
    } else if (parseInt(parts[2], 10) < 100) {
        // malformed year like 25 -> fail fast
        return null;
    } else {
        // default dd/mm/yyyy
        [day, month, year] = parts.map(p => parseInt(p, 10));
    }

    const date = new Date(year, month - 1, day);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null; // invalid day/month combo
    }

    return date;
}

