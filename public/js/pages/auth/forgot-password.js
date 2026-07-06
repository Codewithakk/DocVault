const baseUrl = window.baseUrl || "";
function showLoader(btn) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Submitting...`;
    btn.disabled = true;
}

function hideLoader(btn) {
    btn.innerHTML = btn.dataset.originalText;
    btn.disabled = false;
}

// Show/Hide Password
function togglePassword(id, el) {
    const input = document.getElementById(id);
    const icon = el.querySelector("i");
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
    }
}

// Simple toast function
function showToast(message, type = "success") {
    const toastEl = document.createElement("div");
    toastEl.textContent = message;
    toastEl.style.position = "fixed";
    toastEl.style.bottom = "20px";
    toastEl.style.right = "20px";
    toastEl.style.padding = "10px 20px";
    toastEl.style.background = type === "success" ? "#28a745" : "#dc3545";
    toastEl.style.color = "#fff";
    toastEl.style.borderRadius = "5px";
    toastEl.style.zIndex = 9999;
    document.body.appendChild(toastEl);
    setTimeout(() => toastEl.remove(), 3000);
}

document.addEventListener("DOMContentLoaded", function () {
    const emailInput = document.getElementById("emailInput");
    const sendOtpBtn = document.querySelector(".submit-btn");
    const resendBtn = document.querySelector(".resend-btn");
    const otpSection = document.querySelector(".otp-section");
    const otpInputs = document.querySelectorAll(".otp-input");
    const otpVerifiedText = otpSection.querySelector(".text-success");
    const countdownDisplay = document.getElementById("otp-timer");
    const resetForm = document.getElementById("resetPasswordForm");
    const params = new URLSearchParams(window.location.search);
    let otpSent = false, countdownInterval;
    if (params.has("error")) {
        showToast(params.get("error"), "error");
    }

    if (params.has("success")) {
        showToast(params.get("success"), "success");
    }
    function resetAllFields() {
        emailInput.value = "";
        otpInputs.forEach(i => i.value = "");
        otpSection.style.display = "none";
        otpVerifiedText.style.display = "none";
        resetForm.style.display = "none";
        sendOtpBtn.disabled = false;
        countdownDisplay.style.display = "block";
        countdownDisplay.textContent = "";
        clearInterval(countdownInterval);
        otpSent = false;
    }

    resetAllFields();

    function startCountdown(duration = 600) {
        let timer = duration;
        clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            let m = Math.floor(timer / 60);
            let s = timer % 60;
            countdownDisplay.textContent = `OTP expires in ${m}:${s < 10 ? "0" + s : s}`;
            if (--timer < 0) {
                clearInterval(countdownInterval);
                countdownDisplay.textContent = "OTP expired. Please resend.";
                otpInputs.forEach(i => i.disabled = true);
            }
        }, 1000);
    }

    async function sendOtp() {
        const email = emailInput.value.trim();
        if (!email) { showToast("Enter email", "error"); return; }
        sendOtpBtn.disabled = true;
        try {
            const res = await fetch(`${baseUrl}/api/auth/send-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ email })
            });
            const data = await res.json();

            if (data.success) {
                showToast("OTP sent to your email!");
                emailInput.disabled = true;
                otpSection.style.display = "block";
                otpInputs.forEach(i => { i.disabled = false; i.value = ""; });
                otpInputs[0].focus();
                otpSent = true;
                startCountdown(600);
            } else {
                showToast(data.message || "Failed to send OTP", "error");
                sendOtpBtn.disabled = false;
            }
        } catch (err) {
            showToast("Something went wrong", "error");
            sendOtpBtn.disabled = false;
        }
    }

    sendOtpBtn.addEventListener("click", sendOtp);

    resendBtn.addEventListener("click", () => {
        otpInputs.forEach(i => i.value = "");
        otpVerifiedText.style.display = "none";
        resetForm.style.display = "none";
        otpSection.style.display = "block";
        emailInput.disabled = true;
        otpSent = false;
        sendOtp();
    });

    otpInputs.forEach((input, idx) => {
        input.addEventListener("input", () => {
            if (input.value.length === 1 && idx < otpInputs.length - 1) {
                otpInputs[idx + 1].focus();
            }
            if (otpSent && [...otpInputs].every(i => i.value.length === 1)) {
                verifyOtp();
            }
        });
    });

    async function verifyOtp() {
        if (!otpSent) { showToast("Request OTP first", "error"); return; }

        const email = emailInput.value.trim();
        const otp = [...otpInputs].map(i => i.value).join("");

        try {
            const res = await fetch(`${baseUrl}/api/auth/verify-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ email, otp })
            });
            const data = await res.json();

            if (data.success) {
                clearInterval(countdownInterval);
                countdownDisplay.style.display = "none";

                otpVerifiedText.style.display = "block";
                document.getElementById("hiddenEmail").value = email;
                emailInput.disabled = true;


                setTimeout(() => {
                    otpSection.style.display = "none";
                    document.querySelector(".submitrow.sendotprow").style.display = "none";
                    otpVerifiedText.style.display = "none";
                    resetForm.style.display = "block";
                    resetForm.scrollIntoView({ behavior: "smooth", block: "center" });

                    document.getElementById("newPassword").focus();
                }, 1500);
            }
            else {
                showToast("Invalid OTP", "error");
                otpInputs.forEach(i => i.value = "");
                otpInputs[0].focus();
            }
        } catch (err) {
            showToast("Error verifying OTP", "error");
        }
    }

    resetForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const resetBtn = resetForm.querySelector("button[type=submit]");
        showLoader(resetBtn);

        const email = document.getElementById("hiddenEmail").value;
        const password = document.getElementById("newPassword").value.trim();
        const confirmPassword = document.getElementById("confirmPassword").value.trim();

        if (!password || !confirmPassword) {
            hideLoader(resetBtn);
            showToast("Fill password fields", "error");
            return;
        }
        if (password !== confirmPassword) {
            hideLoader(resetBtn);
            showToast("Passwords do not match", "error");
            return;
        }

        try {
            const res = await fetch(`${baseUrl}/api/auth/send-reset-link`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, confirmPassword })
            });

            const data = await res.json();
            hideLoader(resetBtn);

            if (data.success) {
                showToast("Password reset successful! Please verify via email.");
                resetAllFields();
                setTimeout(() => window.location.href = "/checkmail", 1000);
            } else {
                showToast(data.message || "Failed", "error");
            }
        } catch (err) {
            hideLoader(resetBtn);
            showToast("Error", "error");
        }
    });
});