$(document).ready(function () {
    const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    // DONOR EMAIL DUPLICATE CHECK
    $('#email_id').on('blur', function () {
        const email = $(this).val().trim();
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (pattern.test(email)) {
            checkDuplicateValue('email', email, $(this));
        }
    });
    $('#pan_tax_id').on('input blur', function () {
        const val = $(this).val().trim().toUpperCase();
        $(this).val(val);
        if (panPattern.test(val)) {
            $(this).removeClass('is-invalid').addClass('is-valid');
            $('#panTaxIdFeedback').text('');
        } else {
            $(this).removeClass('is-valid').addClass('is-invalid');
            $('#panTaxIdFeedback').text('Invalid PAN / Tax ID format').css('color', 'red');
        }
    });
    $('#pan_tax_id').on('blur', function () {
        const val = $(this).val().trim().toUpperCase();
        if (val) checkDuplicateValue('id_proof', val, $(this));
    });

    // DONOR MOBILE DUPLICATE CHECK
    $('#user_mobile').on('blur', function () {
        const mobile = $(this).val().trim();
        if (/^\d{10}$/.test(mobile)) {
            checkDuplicateValue('phone_number', mobile, $(this));
        }
    });


    /**
     * Email validation on input
     */
    $('#email_id').on('input', function () {
        const email = $(this).val();
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (emailPattern.test(email)) {
            $('#email_id').removeClass('is-invalid').addClass('is-valid');
        } else {
            $('#email_id').removeClass('is-valid').addClass('is-invalid');
        }
    });

    /**
     * user mobile number validation on the input 
     */

    $('#user_mobile').on('input', function () {
        let mobile = $(this).val();
        mobile = mobile.replace(/\D/g, ''); // Remove non-digit characters
        $(this).val(mobile);
        const mobilePattern = /^\d{10}$/; // Example pattern for 10-digit numbers

        if (mobilePattern.test(mobile)) {
            $('#user_mobile').removeClass('is-invalid').addClass('is-valid');
        } else {
            $('#user_mobile').removeClass('is-valid').addClass('is-invalid');
        }
    });

    /**
     * File upload and preview functionality
     */
    const fileInput = $('#fileInput');
    const preview = $('#preview');
    const uploadIcon = $('.upload-icon');

    // Handle file selection
    fileInput.on('change', function (e) {
        const file = this.files[0];
        if (file) {
            // Check file type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedTypes.includes(file.type)) {
                showToast('Only JPEG, PNG, and JPG image formats are allowed.', 'info');
                fileInput.val(''); // Clear input
                preview.empty(); // Clear preview
                uploadIcon.show();
                return;
            }

            // Read and preview file
            const reader = new FileReader();
            reader.onload = function (e) {
                preview.html(`<img src="${e.target.result}" alt="Profile Image" style="max-width: 100%; max-height: 150px; object-fit: contain;">`);
                // uploadIcon.hide();
            };
            reader.readAsDataURL(file);
        } else {
            preview.empty();
            uploadIcon.show();
        }
    });

    // Handle click on upload box
    $('#uploadprofileBox').on('click', function () {
        fileInput.trigger('click');
    });

    // Form submission handler
    $("#donorForm").on('submit', function (event) {
        event.preventDefault();

        // Validate required fields
        let isValid = true;
        const requiredFields = $(this).find('[required]');

        requiredFields.each(function () {
            if (!$(this).val()) {
                isValid = false;
                $(this).addClass('is-invalid');
            }
        });

        // Check email validation
        const emailInput = $('#email_id');
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(emailInput.val())) {
            isValid = false;
            emailInput.addClass('is-invalid');
        }

        // Check mobile validation
        const mobileInput = $('#user_mobile');
        const mobilePattern = /^\d{10}$/;
        if (!mobilePattern.test(mobileInput.val())) {
            isValid = false;
            mobileInput.addClass('is-invalid');
            return
        }

        if (!isValid) {
            if (typeof showToast === 'function') {
                showToast('Please fill all required fields correctly.', 'error');
            } else {
                showToast('Toast function not available', 'error');
            }
            return;
        }
        // Collect form data
        const formData = new FormData(this);
        // Add profile type
        formData.set('profile_type', 'donor');
        const formDataObj = {};
        for (let [key, value] of formData.entries()) {
            formDataObj[key] = value instanceof File ? `[File: ${value.name}]` : value;
        }

        // Disable submit and show spinner
        const $submitBtn = $('#submitBtn');
        const $submitSpinner = $('#submitSpinner');
        const $btnText = $submitBtn.find('.btn-text');
        $submitBtn.prop('disabled', true);
        $submitSpinner.removeClass('d-none');
        $btnText.text('Loading...');

        // Submit the form
        $.ajax({
            url: `${baseUrl}/api/add-vendor-donor`,
            type: 'POST',
            data: formData,
            processData: false, // Don't process the files
            contentType: false, // Let the browser set Content-Type with boundary
            success: function (response) {
                // Detect edit mode by presence of hidden donor_id
                const isEdit = $('#donor_id').length && String($('#donor_id').val() || '').trim() !== '';
                // Show success modal
                const successModal = $('#data-success-register');

                // Update success message based on mode
                const $msgHeader = successModal.find('.success_mdltxt h4');
                if (isEdit) {
                    $msgHeader.html('Record updated successfully');
                } else {
                    $msgHeader.html('Your registration has been<br>done successfully');
                }
                successModal.modal('show');
                // Cleanup previous handlers to avoid stacking
                successModal.off('hidden.bs.modal');
                // Handle modal closing
                successModal.on('hidden.bs.modal', function () {
                    if (!isEdit) {
                        // Only reset on create
                        const formEl = $('#donorForm')[0];
                        if (formEl) formEl.reset();
                        // Remove all validation classes
                        $('.is-valid, .is-invalid').removeClass('is-valid is-invalid');
                        // Clear image preview
                        $('#preview').empty();
                        $('.upload-icon').show();
                    }
                });
            },
            error: function (xhr, status, error) {
                showToast('Error:' + error, 'error');
                const errorMessage = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'An error occurred during registration.';
                if (typeof showToast === 'function') {
                    showToast(errorMessage, 'error');
                    // console.error(errorMessage);
                } else {
                    showToast(errorMessage, 'error');
                }
            }
        }).always(function () {
            // Re-enable submit and hide spinner
            let id = $('#donor_id').length && String($('#donor_id').val() || '').trim() !== '';
            $submitBtn.prop('disabled', false);
            $submitSpinner.addClass('d-none');
            $btnText.text(id ? 'Update' : 'Register');
        });
    });
}
);