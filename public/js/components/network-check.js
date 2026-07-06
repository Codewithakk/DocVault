const banner = document.getElementById('network-status-banner');
const overlay = document.getElementById('network-overlay'); // NEW overlay div
const PING_INTERVAL_MS = 15000;

// Show / Hide banner + overlay
function updateScreenState(isConnected) {
    if (isConnected) {
        banner.style.display = 'none';
        overlay.style.display = 'none';
        document.body.classList.remove("no-interaction");
    } else {
        banner.style.display = 'block';
        overlay.style.display = 'flex';
        document.body.classList.add("no-interaction");
    }
}

// Check server ping
async function checkActualConnection() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch('/ping', {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 204 || response.ok) {
            updateScreenState(true);
        } else {
            updateScreenState(false);
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log("Network status: Slow (Timeout)");
        } else {
            console.log("Network status: Offline/Error", error);
        }
        updateScreenState(false);
    }
}

// Initial state check
if (!navigator.onLine) {
    updateScreenState(false);
}

window.addEventListener('online', () => checkActualConnection());
window.addEventListener('offline', () => updateScreenState(false));
setInterval(checkActualConnection, PING_INTERVAL_MS);
