let selectedDateRange = null;

const fp = flatpickr("#documentDate", {
    mode: "range",
    dateFormat: "d-m-Y",
    allowInput: false,           // ← Blocks typing completely
    clickOpens: true,
    locale: {
        rangeSeparator: " to "
    },

    // When user selects both dates
    onChange: function (selectedDates, dateStr, instance) {
        if (selectedDates.length === 2) {
            selectedDateRange = {
                start: selectedDates[0],
                end: selectedDates[1]
            };
            document.getElementById("clearDateRange").style.display = "block";
            table.ajax.reload(); // Refresh table with new date range
        }
    },

    // When user clears or closes without full range
    onClose: function (selectedDates) {
        if (selectedDates.length < 2 && selectedDates.length > 0) {
            setTimeout(() => {
                fp.clear();
            }, 100);
        }
        if (selectedDates.length === 0) {
            selectedDateRange = null;
            document.getElementById("clearDateRange").style.display = "none";
            table.ajax.reload();
        }
    }
});

// Clear button functionality
document.getElementById("clearDateRange").addEventListener("click", function () {
    fp.clear();
    selectedDateRange = null;
    this.style.display = "none";
    table.ajax.reload();
});