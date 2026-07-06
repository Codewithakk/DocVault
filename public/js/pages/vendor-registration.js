
$(document).ready(function () {
    // Cache jQuery elements
    const $form = $('#vendorForm');
    const $btn = $('#vendorSubmitBtn');
    const $spinner = $('#vendorSubmitSpinner');
    const $btnText = $btn.find('.btn-text');
    const initialBtnLabel = $btnText.text();
    const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
    const $name = $('#vendor_name');
    const $email = $('#vendor_email');
    const $mobile = $('#vendor_mobile');
    const $company = $('#company_name');
    const $gst = $('#gst_number');
    const $contact = $('#contact_person');
    const $services = $('#services_offered');
    const $address = $('#vendor_address');
    const $file = $('#fileInput');
    const $preview = $('#preview');


    // Notifiers
    function notifySuccess(message) {
        if (typeof showToast === 'function') { try { showToast(message, 'success'); return; } catch (e) { } }
    }
    function notifyError(message) {
        if (typeof showToast === 'function') { try { showToast(message, 'error'); return; } catch (e) { } }
        showToast('ERROR:' + message, 'error');
    }
    // VENDOR EMAIL DUPLICATE CHECK
    $('#vendor_email').on('blur', function () {
        const email = $(this).val().trim();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            checkDuplicateValue('email', email, $(this));
        }
    });

    // VENDOR MOBILE DUPLICATE CHECK
    $('#vendor_mobile').on('blur', function () {
        const mobile = $(this).val().trim();
        if (/^\d{10}$/.test(mobile)) {
            checkDuplicateValue('phone_number', mobile, $(this));
        }
    });

    $('#gst_number').on('blur', function () {
        const gst = $(this).val().trim().toUpperCase();
        if (gst.length > 5) {
            checkDuplicateValue('gst_number', gst, $(this));
        }
    });
    // GST validation on input/change/blur
    $gst.on('input change blur', function () {
        const val = ($gst.val() || '').trim().toUpperCase();
        const ok = gstPattern.test(val);
        $gst.toggleClass('is-valid', ok).toggleClass('is-invalid', !ok);
    });

    function validateAll() {
        const v1 = reqNonEmpty($name);
        const v2 = emailPattern.test(($email.val() || '').trim());
        $email.toggleClass('is-valid', v2).toggleClass('is-invalid', !v2);

        const v3 = /^\d{10}$/.test(($mobile.val() || '').trim());
        $mobile.toggleClass('is-valid', v3).toggleClass('is-invalid', !v3);

        const v4 = reqNonEmpty($company);

        const v5 = gstPattern.test(($gst.val() || '').trim()); // <-- GST format validation
        $gst.toggleClass('is-valid', v5).toggleClass('is-invalid', !v5);

        const v6 = reqNonEmpty($contact);
        const v7 = reqNonEmpty($services);

        return v1 && v2 && v3 && v4 && v5 && v6 && v7;
    }
    // Email validation (same pattern used in donor form)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    $email.on('input change blur', function () {
        const val = ($email.val() || '').trim();
        const ok = emailPattern.test(val);
        $email.toggleClass('is-valid', ok).toggleClass('is-invalid', !ok);
    });

    // Mobile: only digits, exactly 10, validate on input/change/blur
    $mobile.on('input change blur', function () {
        let v = String($mobile.val() || '').replace(/\D/g, '');
        if (v.length > 10) v = v.slice(0, 10);
        $mobile.val(v);
        const ok = /^\d{10}$/.test(v);
        $mobile.toggleClass('is-valid', ok).toggleClass('is-invalid', !ok);
    });

    // Image type guard (optional)
    $file.on('change', function () {
        const f = this.files && this.files[0];
        if (!f) return;
        const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (!allowed.includes(f.type)) {
            notifyError('Only JPEG, PNG, JPG, or WEBP images are allowed.');
            $file.val('');
        }
    });

    function reqNonEmpty($el) {
        const ok = Boolean(($el.val() || '').trim().length > 0);
        $el.toggleClass('is-valid', ok).toggleClass('is-invalid', !ok);
        return ok;
    }

    function validateAll() {
        const v1 = reqNonEmpty($name);
        const v2 = emailPattern.test(($email.val() || '').trim());
        $email.toggleClass('is-valid', v2).toggleClass('is-invalid', !v2);

        const v3 = /^\d{10}$/.test(($mobile.val() || '').trim());
        $mobile.toggleClass('is-valid', v3).toggleClass('is-invalid', !v3);

        const v4 = reqNonEmpty($company);
        const v5 = reqNonEmpty($gst);
        const v6 = reqNonEmpty($contact);
        const v7 = reqNonEmpty($services);

        return v1 && v2 && v3 && v4 && v5 && v6 && v7;
    }

    function buildPayload() {
        const fd = new FormData($form[0]);
        fd.set('profile_type', 'vendor');
        // Normalize some fields
        if (fd.get('gst_number')) fd.set('gst_number', String(fd.get('gst_number')).toUpperCase());

        const snapshot = {};
        fd.forEach((v, k) => { snapshot[k] = v instanceof File ? `[File: ${v.name}]` : v; });
        return { formData: fd, snapshot };
    }

    function setSubmitting(on) {
        $btn.prop('disabled', !!on);
        $spinner.toggleClass('d-none', !on);
        $btnText.text(on ? 'Submitting...' : initialBtnLabel);
    }

    function resetVendorForm() {
        try {
            // Reset the native form
            if ($form && $form[0]) $form[0].reset();
            // Clear validation classes
            $form.find('.is-valid, .is-invalid').removeClass('is-valid is-invalid');
            // Clear file input explicitly
            $file.val('');
            // Clear preview image
            if ($preview && $preview.length) {
                $preview.empty();
            }
        } catch (e) {
            console.warn('Form reset failed', e);
        }
    }

    $form.on('submit', function (e) {
        e.preventDefault();
        if (!validateAll()) {
            notifyError('Please fill all required fields correctly.');
            // Scroll to first invalid for better UX
            const $firstInvalid = $form.find('.is-invalid').first();
            if ($firstInvalid.length) {
                $('html, body').animate({ scrollTop: $firstInvalid.offset().top - 120 }, 300);
                $firstInvalid.focus();
            }
            return;
        }
        const { formData, snapshot } = buildPayload();
        setSubmitting(true);

        $.ajax({
            url: `${baseUrl}/api/add-vendor`,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (res) {
                // notifySuccess(res?.message || 'Vendor registered successfully');
                $('#data-success-register').modal('show');
                // Reset form only for create flow (no hidden id field)
                const isEdit = $form.find('input[name="id"]').length > 0;
                if (!isEdit) {
                    resetVendorForm();
                }
            },
            error: function (xhr) {
                const resp = xhr.responseJSON || {};
                const msg = resp.message || (Array.isArray(resp.errors) && resp.errors[0]?.msg) || 'Unable to register vendor.';
                notifyError(msg);
            },
            complete: function () {
                setSubmitting(false);
            }
        });
    });
});