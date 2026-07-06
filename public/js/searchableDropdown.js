// Global Searchable Dropdown Utility
window.SearchableDropdown = (function () {
    const instances = new Map();

    function init(selector, options = {}) {
        const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!el) {
            return null;
        }

        if (instances.has(el)) return instances.get(el);

        const defaultOptions = {
            searchEnabled: true,
            itemSelectText: '',
            placeholder: true,
            placeholderValue: 'Select an option',
            ...options
        };

        const choiceInstance = new Choices(el, defaultOptions);
        instances.set(el, choiceInstance);
        return choiceInstance;
    }

    function updateOptions(selector, optionsArray = [], replaceAll = true) {
        const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!el || !instances.has(el)) return;

        const choiceInstance = instances.get(el);
        choiceInstance.setChoices(optionsArray, 'value', 'label', replaceAll);
    }

    function destroy(selector) {
        const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!el || !instances.has(el)) return;

        const choiceInstance = instances.get(el);
        choiceInstance.destroy();
        instances.delete(el);
    }

    return { init, updateOptions, destroy };
})();
