
// add-edit-menu.js
$(function () {
    // sanity check
    if (typeof $.fn.select2 !== 'function') {
        showToast('Select2 not loaded. Make sure jQuery and Select2 are included before this script.', 'error');
        return;
    }

    // init type select (and any other selects you want initialized on load)
    $('#type').select2({ width: '100%' });

    const $type = $('#type');
    const $masterField = $('#masterField');
    const $master = $('#master_id');
    const $form = $('#menuForm');

    let masterInitialized = false;

    function toggleMasterField() {
        if ($type.val() === 'SubMenu') {
            $masterField.show();
            $master.prop('disabled', false);

            // initialize select2 for master the first time it's shown.
            if (!masterInitialized) {
                $master.select2({ width: '100%' });
                masterInitialized = true;
            } else {
                // If you see width issues after showing, re-compute by calling destroy+init
                // (usually unnecessary if you initialized after showing the first time)
                $master.select2('destroy').select2({ width: '100%' });
            }
        } else {
            $masterField.hide();
            $master.val('').trigger('change'); // clear selection
            $master.prop('disabled', true);
        }
    }

    // wire events
    $type.on('change', toggleMasterField);
    toggleMasterField(); // run on load to set initial state

    // form submit (keeps your fetch logic)
    $form.on('submit', async function (e) {
        e.preventDefault();
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());
        data.is_show = data.is_show === 'true';
        data.isActive = data.isActive === 'true';
        data.priority = Number(data.priority);

        const url = $form.data('url');
        const method = $form.data('method');

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (result.success) {
                showToast(method === 'PUT' ? 'Menu updated successfully' : 'Menu added successfully', 'success');
                setTimeout(() => { window.location.href = '/permissions/menu/list'; }, 1000);
            } else {
                showToast(result.message || 'Something went wrong', 'error');
            }
        } catch (err) {
            showToast(err.message || 'An error occurred', 'error');
        }
    });
});
