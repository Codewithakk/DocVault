document.addEventListener("DOMContentLoaded", function () {
    const emailInput = document.getElementById("emailInput");
    const sendOtpBtn = document.querySelector(".submit-btn");
    const otpSection = document.querySelector(".otp-section");
    const otpInputs = document.querySelectorAll(".otp-input");
    const resetForm = document.getElementById("resetPasswordForm");
    const resendBtn = document.querySelector(".resend-btn");
    const otpVerifiedText = otpSection.querySelector(".text-success");
    const countdownDisplay = document.getElementById("otp-timer");
    let isResending = false;
    const baseUrl = window.baseUrl || "";
    let countdownInterval;
    let otpSent = false;
    // Toggle password visibility
    document.querySelectorAll(".toggle-password").forEach(btn => {
        btn.addEventListener("click", () => {
            const inputID = btn.getAttribute("data-target");
            const input = document.getElementById(inputID);
            const icon = btn.querySelector("i");

            if (input.type === "password") {
                input.type = "text";
                icon.classList.replace("fa-eye", "fa-eye-slash");
            } else {
                input.type = "password";
                icon.classList.replace("fa-eye-slash", "fa-eye");
            }
        });
    });

    // Reset all fields
    const resetAllFields = () => {
        otpInputs.forEach(inp => inp.value = "");
        if (otpSection) otpSection.style.display = "none";
        if (resetForm) resetForm.style.display = "none";
        if (otpVerifiedText) otpVerifiedText.style.display = "none";
        if (sendOtpBtn) sendOtpBtn.disabled = false;
        otpSent = false;
        clearInterval(countdownInterval);
    };

    resetAllFields();

    // OTP Countdown
    function startCountdown(duration = 600) {
        let timer = duration;
        clearInterval(countdownInterval);

        countdownInterval = setInterval(() => {
            let minutes = Math.floor(timer / 60);
            let seconds = timer % 60;
            countdownDisplay.textContent = `OTP expires in ${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;

            if (--timer < 0) {
                clearInterval(countdownInterval);
                countdownDisplay.textContent = "⏰ OTP expired. Please resend.";
                otpInputs.forEach(inp => inp.disabled = true);
            }
        }, 1000);
    }

    // Send OTP
    const sendOtp = async (isResend = false) => {
        const email = emailInput.value.trim();

        if (!isResend) {
            sendOtpBtn.disabled = true;
        }

        try {
            const response = await fetch(`${baseUrl}/api/auth/send-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ email })
            });

            const data = await response.json();

            if (data.success) {
                showToast("OTP sent to your email!", "info");
                otpSection.style.display = "block";
                otpInputs[0].focus();
                otpSent = true;
                startCountdown(600);
                otpInputs.forEach(inp => inp.disabled = false);

                // Success → unlock resend after a small delay
                setTimeout(() => {
                    resendBtn.disabled = false;
                    resendBtn.textContent = "Resend";
                    isResending = false;
                }, 1000);

                return true;
            } else {
                showToast(data.message || "Failed to send OTP.", "error");

                if (!isResend) sendOtpBtn.disabled = false;

                return false;
            }
        } catch (err) {
            showToast("Something went wrong. Please try again.", "error");

            if (!isResend) sendOtpBtn.disabled = false;

            return false;
        }
    };


    // Send OTP button
    sendOtpBtn.addEventListener("click", function (e) {
        e.preventDefault();
        sendOtp();
    });

    // Resend OTP button
    resendBtn.addEventListener("click", async function () {
        if (isResending) return;
        isResending = true;
        resendBtn.disabled = true;
        resendBtn.textContent = "Sending...";

        otpInputs.forEach(inp => inp.value = "");
        resetForm.style.display = "none";
        otpVerifiedText.style.display = "none";
        otpSection.style.display = "block";
        otpSent = false;

        const success = await sendOtp(true);
        if (!success) {
            resendBtn.disabled = false;
            resendBtn.textContent = "Resend";
            isResending = false;
        }
    });

    // OTP auto-focus
    otpInputs.forEach((input, index) => {
        input.addEventListener("input", () => {
            if (input.value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }

            if (otpSent && [...otpInputs].every(inp => inp.value.length === 1)) {
                verifyOtp();
            }
        });
    });

    // Verify OTP
    const verifyOtp = async () => {
        if (!otpSent) {
            showToast("Please request an OTP first", "info");
            return;
        }

        const email = emailInput.value.trim();
        const otp = [...otpInputs].map(inp => inp.value).join("");

        try {
            const response = await fetch(`${baseUrl}/api/auth/verify-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ email, otp })
            });
            const data = await response.json();

            if (data.success) {
                clearInterval(countdownInterval);
                otpSection.querySelector("h5").style.display = "none";
                document.querySelector(".otp-send-row").style.display = "none";
                document.querySelector(".resend-btn").style.display = "none"
                otpSection.querySelector(".otp-input-wrapper").style.display = "none";
                countdownDisplay.style.display = "none";
                otpVerifiedText.style.display = "block";
                resetForm.style.display = "block";
                document.getElementById("hiddenEmail").value = emailInput.value.trim();
            }
            else {
                showToast(data.message || "Invalid OTP, try again.", "error");
                otpInputs.forEach(inp => inp.value = "");
                otpInputs[0].focus();
            }
        } catch (err) {
            showToast("Something went wrong. Please try again." + err, "error");
        }
    };

    // Submit new password (send verification link)
    // Submit new password
    resetForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const submitBtn = resetForm.querySelector("button[type='submit']");
        showLoader(submitBtn);
        const email = emailInput.value.trim();
        const password = document.getElementById("newPassword").value.trim();
        const confirmPassword = document.getElementById("confirmPassword").value.trim();

        if (!password || !confirmPassword) {
            showToast("Please fill both password fields.", "info");
            hideLoader(submitBtn);
            return;
        }

        if (password !== confirmPassword) {
            showToast("Passwords do not match!", "info");
            hideLoader(submitBtn);
            return;
        }

        try {
            const response = await fetch(`${baseUrl}/api/auth/send-reset-link`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, confirmPassword })
            });

            const data = await response.json();

            if (data.success) {
                showToast("Verification link sent to your email. Please check your email to complete the process.", "success");

                resetForm.style.display = "none";
                otpSection.style.display = "none";
                emailInput.value = "";
                setTimeout(() => {
                    window.location.href = "/checkmail";
                }, 1000);
            } else {
                showToast(data.message || "Failed to send verification link.", "error");
            }
        } catch (err) {
            showToast("Something went wrong. Please try again." + err, "error");
        }
        hideLoader(submitBtn);
    });
});
