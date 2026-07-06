// login.js

// -------- Utility Functions --------
const baseUrl = window.baseUrl || "";
let deviceId = localStorage.getItem("device_id");

if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("device_id", deviceId);
}

// Show error message
function showError(message) {
    const loginMessage = document.getElementById("loginMessage");
    if (loginMessage) {
        loginMessage.textContent = message;
        loginMessage.classList.remove("text-success");
        loginMessage.classList.add("text-danger");
    }
}

// Show success message
function showSuccess(message) {
    const loginMessage = document.getElementById("loginMessage");
    if (loginMessage) {
        loginMessage.textContent = message;
        loginMessage.classList.remove("text-danger");
        loginMessage.classList.add("text-success");
    }
}
async function logoutUser(event) {
    event.preventDefault();

    try {
        const response = await fetch("api/auth/logout", {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();

        if (response.ok) {
            showToast(data.message || "Logged out successfully", 'success');
            window.location.href = "/login"; // redirect after logout
        } else {
            showToast(data.message || "Logout failed. Try again.", "error");
        }
    } catch (error) {
        console.error("Logout error:", error);
        showToast("An error occurred while logging out.", "error");
    }
}
// Show/Hide Password
function togglePassword(inputId, toggleEl) {
    const input = document.getElementById(inputId);
    const icon = toggleEl.querySelector("i");
    if (!input || !icon) return;

    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
    }
}

// Attach password toggle buttons
function initPasswordToggles() {
    document.querySelectorAll(".password-toggle").forEach(toggle => {
        const targetInput = toggle.previousElementSibling?.id;
        if (targetInput) {
            toggle.addEventListener("click", () => togglePassword(targetInput, toggle));
        }
    });
}

// -------- Auth Handlers --------
function showOtpSection(email) {
    const otpSection = document.querySelector(".otp-section");
    if (!otpSection) return;

    otpSection.style.display = "block";

    // Hide original login inputs
    document.getElementById("emailInput").disabled = true;
    document.getElementById("passwordInput").disabled = true;

    const otpInputs = document.querySelectorAll(".otp-input");

    // Attach event to check OTP when all 4 digits are entered
    otpInputs.forEach((input, index) => {
        input.addEventListener("input", async () => {
            if (Array.from(otpInputs).every(inp => inp.value.length === 1)) {
                const otp = Array.from(otpInputs).map(inp => inp.value).join("");
                await verifyOtp(email, otp);
            }
        });
    });

    // Resend OTP button
    const resendBtn = document.querySelector(".resend-btn");
    if (resendBtn) {
        resendBtn.addEventListener("click", async () => {
            await resendOtp(email);
        });
    }
}

async function verifyOtp(email, otp) {
    try {
        const response = await fetch(`${baseUrl}/api/auth/verify/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, otp, deviceId })
        });
        const data = await response.json().catch(() => ({}));

        if (response.ok && data.success) {
            document.querySelector(".otp-section .text-success").style.display = "block";
            setTimeout(() => {
                const profileType = data?.data?.user?.profile_type;
                if (profileType === "admin" || profileType === "superadmin") {
                    window.location.href = "/admin/dashboard";
                } else if (profileType === "vendor" || profileType === "donor") {
                    window.location.href = "/documents/list";
                } else {
                    window.location.href = "/employee/dashboard";
                }
            }, 2000);
        } else {
            showError(data.message || "Invalid OTP. Try again.");
        }
    } catch (err) {
        showError("Network error while verifying OTP: " + err);
    }
}

// Optional: resend OTP
async function resendOtp(email) {
    try {
        const response = await fetch(`${baseUrl}/api/auth/send-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        const data = await response.json().catch(() => ({}));
        if (data.success) {
            showSuccess("OTP resent successfully.");
        } else {
            showError(data.message || "Failed to resend OTP.");
        }
    } catch (err) {
        showError("Network error while resending OTP: " + err);
    }
}

// Handle login submission
async function handleLogin({ emailInput, passwordInput, loginBtn }) {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailPattern.test(email)) {
        showError("Please enter a valid email.");
        return;
    }
    if (!password) {
        showError("Password is required.");
        return;
    }

    // Disable button while processing
    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";

    try {
        const response = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, deviceId })
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.success) {
            // Check if OTP is required
            if (data?.data?.message?.includes("OTP sent")) {
                showSuccess("OTP sent to your registered email");
                showOtpSection(email); // Show OTP fields
            } else {
                showSuccess("Login successful! Redirecting...");
                setTimeout(() => {
                    const profileType = data?.data?.user?.profile_type;
                    if (profileType === "admin" || profileType === "superadmin") {
                        window.location.href = "/admin/dashboard";
                    } else if (profileType === "vendor" || profileType === "donor") {
                        window.location.href = "/documents/list";
                    } else {
                        window.location.href = "/employee/dashboard";
                    }

                }, 1000);
            }
        } else {
            showError(data.message || "Login failed. Please try again.");
        }
    } catch (error) {
        showError("Network error. Please try again later. " + error);
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = "Submit";
    }
}


// Handle logout link
async function handleLogoutLink(logoutLink) {
    logoutLink.textContent = "Logging out...";

    try {
        const response = await fetch(`${baseUrl}/api/auth/logout`, {
            method: "POST",
            credentials: "include"
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.success) {
            window.location.href = "/login"; // redirect after logout
        } else {
            showError(data.message || "Logout failed. Try again.");
            logoutLink.textContent = "Logout";
        }
    } catch (error) {
        showError("Network error. Please try again later." + error, 'error');
        logoutLink.textContent = "Logout";
    }
}

// -------- Initialization --------
function initLoginPage() {
    const loginBtn = document.getElementById("loginBtn");
    const emailInput = document.getElementById("emailInput");
    const passwordInput = document.getElementById("passwordInput");

    const desktopLogoutLink = document.getElementById("logoutLink");

    const mobileLogoutLink = document.getElementById("mobileLogoutLink");

    initPasswordToggles();

    if (loginBtn && emailInput && passwordInput) {
        loginBtn.addEventListener("click", () =>
            handleLogin({ emailInput, passwordInput, loginBtn })
        );
    }

    if (desktopLogoutLink) {
        desktopLogoutLink.addEventListener("click", (e) => {
            e.preventDefault();
            handleLogoutLink(desktopLogoutLink);
        });
    }

    if (mobileLogoutLink) {
        mobileLogoutLink.addEventListener("click", (e) => {
            e.preventDefault();

            handleLogoutLink(mobileLogoutLink);
        });
    }
}

initLoginPage();
