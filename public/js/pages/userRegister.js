$(document).ready(function () {
    window.parseNewLocationTag = function (value) {
        const prefix = 'NEW_LOC:';
        if (value && typeof value === 'string' && value.startsWith(prefix)) {
            return value.replace(prefix, '').trim();
        }
        return value;
    };
    function createSelect2Tag(params) {
        let term = $.trim(params.term);
        if (term === '') return null;

        return {
            id: 'NEW_LOC:' + term,
            text: term + ' (Add New)',
            newTag: true
        };
    }
    // ------------------------------
    // DUPLICATE CHECK FUNCTION
    // ------------------------------
    function checkDuplicate(field, value, inputElement) {
        if (!value) return;

        $.ajax({
            url: `${baseUrl}/api/check`,
            method: 'GET',
            data: { [field]: value },
            success: function (res) {

                // Remove any old message
                inputElement.next(".duplicate-msg").remove();

                if (res.exists) {
                    inputElement
                        .addClass("is-invalid")
                        .removeClass("is-valid");

                    inputElement.after(
                        `<small class="duplicate-msg text-danger">${field.replace('_', ' ')} already exists</small>`
                    );
                } else {
                    inputElement
                        .addClass("is-valid")
                        .removeClass("is-invalid");
                }
            },
            error: function () {
                console.log("Error checking duplicates");
            }
        });
    }

    // ------------------------------
    // REAL-TIME VALIDATION
    // ------------------------------

    // EMAIL VALIDATION & DUPLICATE CHECK
    $('#email').on('blur input', function () {
        const email = $(this).val().trim();
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        $(this).next(".duplicate-msg").remove();

        if (!emailPattern.test(email)) {
            $(this).addClass('is-invalid').removeClass('is-valid');
            return;
        }

        $(this).addClass('is-valid').removeClass('is-invalid');
        checkDuplicate('email', email, $(this));
    });

    // PHONE NUMBER VALIDATION & DUPLICATE CHECK
    $('#phone_number').on('blur input', function () {
        let phone = $(this).val().replace(/\D/g, '').slice(0, 10);
        $(this).val(phone);

        $(this).next(".duplicate-msg").remove();

        if (!/^\d{10}$/.test(phone)) {
            $(this).addClass('is-invalid').removeClass('is-valid');
            return;
        }

        $(this).addClass('is-valid').removeClass('is-invalid');
        checkDuplicate('phone_number', phone, $(this));
    });

    // EMPLOYEE ID VALIDATION & DUPLICATE CHECK
    $('#employee_id').on('blur input', function () {
        const emp = $(this).val().trim().toUpperCase();
        $(this).val(emp);

        $(this).next(".duplicate-msg").remove();

        if (!emp) {
            $(this).addClass('is-invalid').removeClass('is-valid');
            return;
        }

        $(this).addClass('is-valid').removeClass('is-invalid');
        checkDuplicate('employee_id', emp, $(this));
    });
    // Country Select2
    $('#country').select2({
        placeholder: "-- Select Country --",
        allowClear: true,
        ajax: {
            url: `${baseUrl}/api/country`,
            dataType: "json",
            delay: 250,
            data: function (params) {
                return {
                    search: params.term || "",
                    page: params.page || 1,
                    limit: 10
                };
            },
            processResults: function (data, params) {
                params.page = params.page || 1;
    
                return {
                    results: data.data.map(item => ({
                        id: item._id,
                        text: item.name
                    })),
                    pagination: {
                        more: params.page < data.pages
                    }
                };
            }
        }
    });
    

    $('#state').select2({
        placeholder: "-- Select State --",
        allowClear: true,
        ajax: {
            url: `${baseUrl}/api/state`,
            dataType: "json",
            delay: 250,
            data: function (params) {
                return {
                    search: params.term || "",
                    page: params.page || 1,
                    limit: 10,
                    countryId: $('#country').val()
                };
            },
            processResults: function (data, params) {
                params.page = params.page || 1;
    
                return {
                    results: data.data.map(item => ({
                        id: item._id,
                        text: item.name
                    })),
                    pagination: {
                        more: params.page < data.pages
                    }
                };
            }
        }
    });
    

    // City Select2 - Depends on State
    $('#city').select2({
        placeholder: "-- Select City --",
        allowClear: true,
        ajax: {
            url: `${baseUrl}/api/city`,
            dataType: "json",
            delay: 250,
            data: function (params) {
                return {
                    search: params.term || "",
                    page: params.page || 1,
                    limit: 10,
                    stateId: $('#state').val()
                };
            },
            processResults: function (data, params) {
                params.page = params.page || 1;
    
                return {
                    results: data.data.map(item => ({
                        id: item._id,
                        text: item.name
                    })),
                    pagination: {
                        more: params.page < data.pages
                    }
                };
            }
        }
    });
    

    $('#country').on('change', function () {
        $('#state').val(null).trigger('change');
        $('#city').val(null).trigger('change');
    });
    
    $('#state').on('change', function () {
        $('#city').val(null).trigger('change');
    });
    
    // ------------------------------
    // FORM SUBMIT
    // ------------------------------
    $('#registerForm').on('submit', async function (e) {
        e.preventDefault();
    
        const countryData = $('#country').select2('data')[0];
        const stateData = $('#state').select2('data')[0];
        const cityData = $('#city').select2('data')[0];
    
        if (!countryData || !stateData || !cityData) {
            showToast('Please select Country, State and City', 'error');
            return;
        }
    
        const formData = new FormData(this);

        formData.append('location[country]', countryData.id);
        formData.append('location[country_name]', countryData.text);
    
        formData.append('location[state]', stateData.id);
        formData.append('location[state_name]', stateData.text);
    
        formData.append('location[city]', cityData.id);
        formData.append('location[city_name]', cityData.text);
    
        try {
            const response = await fetch(`${baseUrl}/api/user/register`, {
                method: 'POST',
                body: formData
            });
    
            const result = await response.json();
    
            if (response.ok && result.success) {
                const successModal = new bootstrap.Modal(
                    document.getElementById('data-success-register')
                );
                successModal.show();
    
                this.reset();
                $('#country, #state, #city').val(null).trigger('change');
            } else {
                showToast(result.message || 'Registration failed!', 'error');
            }
        } catch (err) {
            showToast('Network error. Please try again.', 'error');
        }
    });
    
    // ------------------------------
    // PROFILE PREVIEW
    // ------------------------------
    $('#uploadprofileBox').click(function () {
        $('#fileInput').click();
    });

    $('#fileInput').on('change', function (e) {
        const preview = $('#preview');
        preview.empty();

        const file = e.target.files[0];

        if (file) {
            const img = document.createElement("img");
            img.src = URL.createObjectURL(file);
            img.style.maxWidth = "100px";
            img.classList.add("img-thumbnail");
            preview.append(img);
        }
    });
});
