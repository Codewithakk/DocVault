// -----------------------------
// Project Date Restrictions & Duration
// -----------------------------
const setupProjectDateRestrictions = () => {
    const startDatePicker = $('input[name="projectStartDate"]').datetimepicker({
        format: 'DD-MM-YYYY',
        useCurrent: false
    });

    const endDatePicker = $('input[name="projectEndDate"]').datetimepicker({
        format: 'DD-MM-YYYY',
        useCurrent: false
    });

    const durationInput = $('input[name="projectDuration"]');

    const updateDuration = () => {
        const start = startDatePicker.data("DateTimePicker").date();
        const end = endDatePicker.data("DateTimePicker").date();

        if (start && end) {
            const days = end.diff(start, 'days') + 1;
            durationInput.val(days);
        } else {
            durationInput.val('');
        }
    };

    // Start Date change
    startDatePicker.on('dp.change', function (e) {
        const startDate = e.date;
        const endPicker = endDatePicker.data("DateTimePicker");

        if (startDate) {
            endPicker.minDate(startDate);

            const currentEnd = endPicker.date();
            if (currentEnd && currentEnd.isBefore(startDate)) {
                endPicker.clear();
                showToast('End Date cleared because it was before the selected Start Date', 'info');
            }
        } else {
            endPicker.minDate(false);
        }

        updateDuration();
    });

    // End Date change
    endDatePicker.on('dp.change', function (e) {
        const endDate = e.date;
        const startPicker = startDatePicker.data("DateTimePicker");

        if (endDate) {
            const currentStart = startPicker.date();
            if (currentStart && currentStart.isAfter(endDate)) {
                startPicker.date(endDate);
                showToast('Start Date adjusted to not be after End Date', 'warning');
            }
        }

        updateDuration();
    });

    // Initialize duration if pre-filled
    updateDuration();
};


document.addEventListener("DOMContentLoaded", () => {
    setupProjectDateRestrictions();
    const addForm = document.getElementById("addProjectForm");
    const editForm = document.getElementById("editProjectForm");
    const toggleBtn = document.getElementById("toggleModeBtn");
    const viewDiv = document.getElementById("viewMode");
    const editDiv = document.getElementById("editMode");
    const cancelBtn = document.getElementById("cancelEditBtn");

    // Helper: convert multi-select FormData to arrays
    const appendMultiSelects = (formData, fields) => {
        fields.forEach(f => {
            const values = formData.getAll(f + "[]");
            formData.delete(f + "[]");
            values.forEach(v => formData.append(f, v));
        });
    };

    // Loader toggle function
    const toggleLoader = (btn, loading = true) => {
        if (!btn) return;
        const text = btn.querySelector(".btn-text");
        const spinner = btn.querySelector(".spinner-border");

        if (loading) {
            btn.disabled = true;
            if (text) text.classList.add("d-none");
            if (spinner) spinner.classList.remove("d-none");
        } else {
            btn.disabled = false;
            if (text) text.classList.remove("d-none");
            if (spinner) spinner.classList.add("d-none");
        }
    };

    // Toggle Edit/View
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            if (viewDiv.style.display === "none") {
                viewDiv.style.display = "block";
                editDiv.style.display = "none";
                toggleBtn.innerHTML = '<i class="ti ti-pencil me-1"></i> Edit';
            } else {
                viewDiv.style.display = "none";
                editDiv.style.display = "block";
                toggleBtn.innerHTML = '<i class="ti ti-eye me-1"></i> View';
            }
        });
    }

    if (cancelBtn) cancelBtn.addEventListener("click", () => toggleBtn.click());

    // Submit handler for Add Project
    if (addForm) {
        addForm.addEventListener("submit", async e => {
            e.preventDefault();
            const submitBtn = addForm.querySelector(".submitBtn");
            toggleLoader(submitBtn, true);

            const formData = new FormData(addForm);
            appendMultiSelects(formData, ["donor", "vendor", "projectCollaborationTeam", "projectManager"]);

            try {
                const res = await fetch(`${baseUrl}/api/projects`, {
                    method: "POST",
                    body: formData
                });

                let data = {};
                try {
                    data = await res.json();
                } catch (parseErr) {
                    data = { message: "Invalid server response" };
                }

                if (res.ok) {

                    const successModalEl = document.getElementById("data-success-register");
                    const successModal = new bootstrap.Modal(successModalEl);
                    successModal.show();

                    addForm.reset();
                    toggleLoader(submitBtn, false);

                    successModalEl.addEventListener("hidden.bs.modal", () => {
                        window.location.href = "/projects";
                    });

                } else {
                    showToast(data.message || "Failed to create project", "error");
                    toggleLoader(submitBtn, false);
                }

            } catch (err) {
                showToast("Something went wrong while creating the project. " + err.message, "error");
                toggleLoader(submitBtn, false);
            }
        });
    }

    // Submit handler for Edit Project
    if (editForm) {
        editForm.addEventListener("submit", async e => {
            e.preventDefault();
            const submitBtn = editForm.querySelector(".submitBtn");
            toggleLoader(submitBtn, true);

            const projectId = document.getElementById("projectDetails").dataset.projectId;
            const formData = new FormData(editForm);
            appendMultiSelects(formData, ["donor", "vendor", "projectCollaborationTeam"]);

            try {
                const res = await fetch(`${baseUrl}/api/projects/${projectId}`, {
                    method: "PATCH",
                    body: formData
                });
                const result = await res.json();
                if (res.ok) {
                    showToast("Project updated successfully!", "success");
                    window.location.href = `/projects/${projectId}/details`;
                } else {
                    showToast(result.message || "Failed to update project", "error");
                    toggleLoader(submitBtn, false);
                }
            } catch (err) {
                showToast("Something went wrong while updating the project.", "error");
                toggleLoader(submitBtn, false);
            }
        });
    }
});
