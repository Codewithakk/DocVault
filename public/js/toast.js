
(function () {
    'use strict';
    const TOAST_COLORS = {
        success: "#28a745",
        error: "#dc3545",
        warning: "#ffc107",
        info: "#007bff"
    };

    function showToast(message, type = "info", duration = 4000) {
        if (typeof Toastify === 'undefined') {
            console.error("Toastify is not loaded. Please include the Toastify.js library.");
            alert(message);
            return;
        }

        const toastMessage = message ? String(message) : "No message provided";

        const toastType = TOAST_COLORS.hasOwnProperty(type) ? type : 'info';
        const backgroundColor = TOAST_COLORS[toastType];
        Toastify({
            text: toastMessage,
            duration: duration,
            gravity: "bottom",
            position: "right",
            backgroundColor: backgroundColor,
            stopOnFocus: true,
            close: true
        }).showToast();
    }

    document.addEventListener("DOMContentLoaded", () => {
        window.showToast = showToast;
    });
})();