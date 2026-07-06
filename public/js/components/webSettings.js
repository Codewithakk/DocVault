function previewImage(event, previewId) {
    const reader = new FileReader();
    reader.onload = () => {
        document.getElementById(previewId).src = reader.result;
    };
    reader.readAsDataURL(event.target.files[0]);
}

const form = document.getElementById("webSettingsForm");
const saveBtn = document.getElementById("saveBtn");
const btnText = document.getElementById("btnText");
const btnLoader = document.getElementById("btnLoader");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    btnText.textContent = "Saving...";
    btnLoader.classList.remove("d-none");
    saveBtn.disabled = true;

    const formData = new FormData(form);

    try {
        const res = await fetch("/api/settings/web-settings", {
            method: "POST",
            body: formData
        });

        const result = await res.json();

        if (result.success) {
            showToast(result.message, "success");
            setTimeout(() => location.reload(), 800);
        } else {
            showToast(result.message, "error");
        }

    } catch (err) {
        console.error(err);
        showToast("Something went wrong!", "error");
    }

    btnText.textContent = "Save Settings";
    btnLoader.classList.add("d-none");
    saveBtn.disabled = false;
});
