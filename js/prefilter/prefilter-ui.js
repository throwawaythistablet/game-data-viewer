(function() {

GDV.prefilter.showPrefilterOverlayAndCollectFilters = async function() {
    try {
        const overlay = createPrefilterOverlayContainer('Refine Your Search Using Prefilters');
        overlay.appendChild(GDV.helpNotice.createHelpNotice());

        const form = document.createElement('form');
        form.className = 'prefilter-form-root';

        overlay.appendChild(form);
        document.body.appendChild(overlay);
        const cleanupFocus = showModalAccessibility(form, overlay);

        return new Promise(resolve => {
            form.appendChild(createPrefilterWarning());
            form.appendChild(createPrefilterActions(form, resolve, overlay, cleanupFocus));
            form.appendChild(createPrefilterSearchAndCategoryGroup());
            form.appendChild(createActivePrefiltersSummary());
            form.appendChild(createPrefilterGrid(GDV.state.getLastSearchedPrefilters()));

            GDV.prefilter.initializeLiveStateFromForm(form);
            GDV.prefilter.updatePrefilterWarningFromLiveState(form);
            renderFullActivePrefiltersSummary(form);

            GDV.prefilter.bindPrefilterInputs(form);
            bindActivePrefiltersSummaryRemoval(form);

            waitForPrefilterFormSubmission(form, resolve, overlay, cleanupFocus);
        });

    } catch (err) {
        GDV.utils.reportSilentWarning('Prefilter UI Failure', 'Prefilter overlay failed to initialize, continuing without prefiltering.', err);
        return {};
    }
};

GDV.prefilter.renderRemoveButton = function(col) {
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'prefilter-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', `Remove prefilter for ${col}`);
    return removeBtn;
}

// Overlay container
function createPrefilterOverlayContainer(title) {
    const overlay = document.createElement('div');
    overlay.id = 'prefilterOverlay';
    overlay.className = 'prefilter-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');

    const heading = document.createElement('h2');
    heading.id = 'prefilterOverlayHeading';
    heading.textContent = title;
    overlay.appendChild(heading);
    overlay.setAttribute('aria-labelledby','prefilterOverlayHeading');

    return overlay;
}

// Warning
function createPrefilterWarning() {
    const warningEl = document.createElement('div');
    warningEl.id = 'prefilter-warning';
    warningEl.className = 'prefilter-warning';
    warningEl.textContent = '⚠ No prefilters applied! Searching the full dataset may be heavy.';
    return warningEl;
}

// Actions
function createPrefilterActions(form, resolve, overlay, cleanupFocus) {
    const actions = document.createElement('div');
    actions.className = 'prefilter-actions sticky-top';

    const applyBtn = createPrefilterSubmitButton('Apply Prefilters & Search');
    applyBtn.classList.add('btn-apply');
    actions.appendChild(applyBtn);

    const row = document.createElement('div');
    row.className = 'btn-row';

    const resetBtn = createPrefiltersResetButton(form);
    resetBtn.classList.add('btn-regular');
    row.appendChild(resetBtn);

    const cancelBtn = createPrefiltersCancelButton(resolve, overlay, cleanupFocus);
    cancelBtn.classList.add('btn-regular');
    row.appendChild(cancelBtn);

    actions.appendChild(row);
    return actions;
}

function createPrefilterSubmitButton(label='Submit') {
    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.textContent = label;
    btn.className = 'btn';
    return btn;
}

function createPrefiltersResetButton(form) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Reset Prefilters';
    btn.className = 'btn btn-reset';
    btn.addEventListener('click', () => resetPrefilters(form));
    return btn;
}

function createPrefiltersCancelButton(resolve, overlay, cleanupFocus) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Cancel';
    btn.className = 'btn btn-cancel';
    btn.addEventListener('click', () => {
        if (overlay) overlay.remove();
        if (cleanupFocus) cleanupFocus();
        resolve(null);
    });
    return btn;
}

// Category drop down and search box
function createPrefilterSearchAndCategoryGroup() {
    const container = document.createElement('div');
    container.className = 'prefilter-search-category-group';
    container.appendChild(createPrefilterCategoryDropdown());
    container.appendChild(createPrefilterSearchBox());
    return container;
}

// Category drop down
function createPrefilterCategoryDropdown() {
    const container = document.createElement('div');
    container.className = 'prefilter-search-box';

    // Sanitize and create unique ID for accessibility
    const selectId = 'prefilter-category-select';

    // Label for accessibility
    const label = document.createElement('label');
    label.setAttribute('for', selectId);
    label.className = 'prefilter-search-label';
    label.textContent = 'Categories:';
    container.appendChild(label);

    // Select element
    const select = document.createElement('select');
    select.className = 'prefilter-category-select';
    select.id = selectId;
    container.appendChild(select);

    // First option: All
    const allOption = document.createElement('option');
    allOption.value = '__all__';
    allOption.textContent = 'All Categories';
    select.appendChild(allOption);

    // Populate categories dynamically
    const categories = GDV.state.getColumnCategories() || {};
    Object.keys(categories).forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });

    // Update prefilter sections on change
    select.addEventListener('change', () => {
        const searchInput = document.querySelector('.prefilter-search-input');
        const searchText = searchInput?.value || '';
        filterPrefilterSections(searchText, select.value);
    });

    return container;
}

// Search box
function createPrefilterSearchBox() {
    // Container wrapper
    const container = document.createElement('div');
    container.className = 'prefilter-search-box';

    // Label for accessibility
    const label = document.createElement('label');
    label.className = 'prefilter-search-label';
    const inputId = 'prefilter-search-input';
    label.setAttribute('for', inputId);
    label.textContent = 'Search Prefilters: ';
    container.appendChild(label);

    // Input field
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search prefilters to change…';
    input.className = 'prefilter-search-input';
    input.id = inputId;
    input.name = inputId;

    // Input event handler
    const handler = () => {
        const select = document.querySelector('.prefilter-category-select');
        const category = select?.value || '__all__';
        filterPrefilterSections(input.value, category);
    };

    input.addEventListener('input', handler);
    input.addEventListener('change', handler);

    container.appendChild(input);
    return container;
}

// Active summary
function createActivePrefiltersSummary() {
    const container = document.createElement('div');
    container.className = 'prefilter-active-summary-container';

    // Label stays constant
    const label = document.createElement('span');
    label.className = 'prefilter-active-summary-label';
    label.textContent = 'Active Prefilters:';
    container.appendChild(label);

    // Chips container, always empty initially
    const chips = document.createElement('div');
    chips.id = 'prefilter-active-summary';
    chips.className = 'prefilter-active-summary';
    container.appendChild(chips);

    return container;
}

// Grid
function createPrefilterGrid(prefill = {}) {
    const grid = document.createElement('div');
    grid.className = 'prefilter-form';
    const colDefs = GDV.state.getActiveColumnDetails() || {};
    for (const [col, colDef] of Object.entries(colDefs)) {
        grid.appendChild(createFilterSectionForColumnDetails(col, colDef, prefill[col]));
    }
    return grid;
}

function createFilterSectionForColumnDetails(col, colDef, prefill = null) {
    const section = document.createElement('section');
    section.className = 'prefilter-section';
    section.dataset.col = String(col);
    section.title = GDV.datatable.getColumnDescription(col);

    const title = document.createElement('h3');
    title.textContent = col;
    section.appendChild(title);

    if (colDef.type === 'tag') {
        section.appendChild(createTagFilter(col, prefill));
    } else if (Array.isArray(colDef.choices) && colDef.choices.length > 0) {
        section.appendChild(createChoiceFilter(col, colDef.choices, prefill));
    } else if (colDef.type === 'int' || colDef.type === 'float') {
        section.appendChild(createRangeFilter(col, colDef.min, colDef.max, prefill));
    } else {
        section.appendChild(createTextFilterInput(col, prefill));
    }

    const tagCount = GDV.datatable.getColumnTagCount(col);
    if (tagCount != null) {
        const footer = document.createElement('div');
        footer.className = 'prefilter-footer';
        footer.textContent = `${tagCount} matches`;
        section.appendChild(footer);
    }

    return section;
}

// Tag checkboxes
function createTagFilter(name, prefill = null) {
    const container = document.createElement('div');
    container.className = 'prefilter-tag-group';
    const checkedValues = Array.isArray(prefill?.choices) ? prefill.choices : [];

    // Helper to create individual checkboxes
    function createCheckbox(value, labelText) {
        const label = document.createElement('label');
        label.className = 'prefilter-checkbox';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = name;
        input.value = String(value);

        // Generate a unique id for accessibility
        const sanitizedName = name.replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        input.id = `prefilter-${sanitizedName}-${value}`;

        // Check if this value should be pre-checked
        input.checked = checkedValues.includes(value) || checkedValues.includes(String(value));

        label.setAttribute('for', input.id);
        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${labelText}`));

        return label;
    }

    // Create No (0) and Yes (1) checkboxes
    const checkboxNo = createCheckbox(0, 'No (0)');
    const checkboxYes = createCheckbox(1, 'Yes (1)');
    container.appendChild(checkboxNo);
    container.appendChild(checkboxYes);

    return container;
}

// Choice checkbox group with toggle-all
function createChoiceFilter(name, choices, prefill = null) {
    const container = document.createElement('div');
    container.className = 'prefilter-box';

    const checkedValues = Array.isArray(prefill?.choices) ? prefill.choices : choices.slice();

    // Helper to sanitize names/ids
    const sanitizedName = String(name).replace(/\s+/g, '-').replace(/[^\w-]/g, '');

    // Create toggle-all checkbox
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-all-label';

    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.className = 'toggle-all';
    toggleInput.id = `toggle-all-${sanitizedName}`;
    toggleInput.name = `toggleAll-${sanitizedName}`;

    toggleInput.checked = choices.every(choice =>
        checkedValues.includes(choice) || checkedValues.includes(String(choice))
    );

    toggleLabel.setAttribute('for', toggleInput.id);
    toggleLabel.appendChild(toggleInput);
    toggleLabel.appendChild(document.createTextNode(' Toggle All'));
    container.appendChild(toggleLabel);

    // Create individual choice checkboxes
    choices.forEach((choice, idx) => {
        const label = document.createElement('label');
        label.className = 'prefilter-checkbox';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = name;
        input.value = String(choice);
        input.checked = checkedValues.includes(choice) || checkedValues.includes(String(choice));

        // Unique ID for accessibility
        const choiceId = `chk-${sanitizedName}-${idx}`;
        input.id = choiceId;
        label.setAttribute('for', choiceId);

        label.appendChild(input);
        label.appendChild(document.createTextNode(' ' + String(choice)));

        container.appendChild(label);
    });

    const childCheckboxes = container.querySelectorAll(`input[name="${name}"]`);

    // Keep toggle-all state updated when children change
    childCheckboxes.forEach(cb => cb.addEventListener('change', () => {
        toggleInput.checked = Array.from(childCheckboxes).every(i => i.checked);
    }));

    // Toggle-all handler sets all children
    toggleInput.addEventListener('change', () => {
        childCheckboxes.forEach(cb => cb.checked = toggleInput.checked);
        if (childCheckboxes.length > 0) {
            const evt = new Event('change', { bubbles: true });
            childCheckboxes[0].dispatchEvent(evt);
        }
    });

    return container;
}

// Range prefilter (min / max inputs)
function createRangeFilter(name, min = null, max = null, prefill = null) {
    const wrapper = document.createElement('div');
    wrapper.className = 'prefilter-range';

    const minVal = prefill?.min != null ? prefill.min : '';
    const maxVal = prefill?.max != null ? prefill.max : '';

    const minWrap = document.createElement('div');
    minWrap.className = 'range-input-wrapper';
    minWrap.appendChild(createNumberInput(`${name}__min`, minVal, 'Min', 'range-min', String(min ?? '')));

    const maxWrap = document.createElement('div');
    maxWrap.className = 'range-input-wrapper';
    maxWrap.appendChild(createNumberInput(`${name}__max`, maxVal, 'Max', 'range-max', String(max ?? '')));

    wrapper.appendChild(minWrap);
    wrapper.appendChild(maxWrap);
    return wrapper;
}

// Create labeled number input with optional class for styling
function createNumberInput(name, value = null, labelText = '', inputClass = '', placeholder = '') {
    const container = document.createElement('div');
    container.className = 'number-input-wrapper';

    // Sanitize name for id
    const sanitizedName = String(name).replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const inputId = `number-${sanitizedName}`;

    // Label
    const label = document.createElement('label');
    label.className = 'range-label';
    label.setAttribute('for', inputId);
    label.textContent = labelText;
    container.appendChild(label);

    // Input
    const input = document.createElement('input');
    input.type = 'number';
    input.id = inputId;
    input.name = name;
    input.step = 'any';
    input.min = '';
    input.max = '';
    if (inputClass) input.className = inputClass;

    if (value !== null && value !== undefined && value !== '') {
        input.value = value;
    } else if (placeholder) {
        input.placeholder = placeholder;
    }

    // Prevent default invalid behavior
    input.addEventListener('invalid', e => e.preventDefault());

    container.appendChild(input);
    return container;
}

// Text input prefilter (fallback)
function createTextFilterInput(name, prefill = null) {
    const container = document.createElement('div');
    container.className = 'filter-text-wrapper';

    // Sanitize name for ID
    const sanitizedName = String(name).replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const inputId = `text-filter-${sanitizedName}`;

    // Label for accessibility
    const label = document.createElement('label');
    label.setAttribute('for', inputId);
    label.className = 'filter-text-label';
    label.textContent = `Filter:`;
    container.appendChild(label);

    // Input element
    const input = document.createElement('input');
    input.type = 'text';
    input.id = inputId;
    input.name = name;
    input.className = 'filter-text-input';
    input.placeholder = `Prefilter ${name}…`;

    if (prefill?.text?.[0] !== undefined) {
        input.value = prefill.text[0];
    }

    container.appendChild(input);
    return container;
}

// collectPrefilterFromForm now returns a shallow clone of the liveState (very cheap)
function collectPrefilterFromForm(form) {
    // structuredClone may not be available in all environments; fallback to JSON
    if (typeof structuredClone === 'function') return structuredClone(GDV.state.getPrefilterLiveState());
    return JSON.parse(JSON.stringify(GDV.state.getPrefilterLiveState()));
}

function waitForPrefilterFormSubmission(form, resolve, overlay) {
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const prefilter = collectPrefilterFromForm(form);

        if (Object.keys(prefilter).length === 0) {
            const proceed = await confirmNoPrefiltersWarning();
            if (!proceed) return;
        }

        GDV.state.setLastSearchedPrefilters(prefilter);
        GDV.dom.renderMainPagePrefiltersPanel();
        overlay.remove();
        resolve(prefilter);
    });
}

async function confirmNoPrefiltersWarning() {
    return await GDV.utils.requestUserConfirmation(
        "No Prefilters Applied",
        "⚠ You haven't applied any prefilters.\n" +
        "Loading the full dataset may be very memory-intensive and slow.\n\n" +
        "Do you want to continue anyway?"
    );
}

// Accessibility: trap focus inside overlay and restore on close
function showModalAccessibility(form, overlay) {
    const previousActive = document.activeElement;

    // Focus first focusable element
    const first = overlay.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (first) first.focus();

    function onKeydown(e) {
        if (e.key === 'Escape') {
            overlay.remove();
            if (previousActive?.focus) previousActive.focus();
        }
        if (e.key === 'Tab') {
            const focusables = Array.from(
                overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
            ).filter(el => !el.disabled && el.offsetParent !== null);
            if (!focusables.length) return;

            const idx = focusables.indexOf(document.activeElement);
            if (e.shiftKey && idx === 0) {
                e.preventDefault();
                focusables[focusables.length - 1].focus();
            } else if (!e.shiftKey && idx === focusables.length - 1) {
                e.preventDefault();
                focusables[0].focus();
            }
        }
    }

    overlay.addEventListener('keydown', onKeydown);

    return () => {
        overlay.removeEventListener('keydown', onKeydown);
        if (previousActive?.focus) previousActive.focus();
    };
}

function renderFullActivePrefiltersSummary(form) {
    const summary = form.querySelector('#prefilter-active-summary');
    if (!summary) return;

    // clear existing chips
    summary.textContent = '';

    for (const [col, val] of Object.entries(GDV.state.getPrefilterLiveState())) {
        const span = document.createElement('span');
        span.className = 'prefilter-active-item';
        span.dataset.col = col;
        span.dataset.type = GDV.prefilter.getPrefilterDisplayType(val) || '';
        span.title = GDV.datatable.getColumnDescription(col) || '';
        span.appendChild(document.createTextNode(GDV.prefilter.getPrefilterDisplayText(col, val) + ' '));
        span.appendChild(GDV.prefilter.renderRemoveButton(col));
        summary.appendChild(span);
    }
}

function filterPrefilterSections(searchText = '', category = '__all__') {
    searchText = searchText.trim().toLowerCase();

    const colCategories = GDV.state.getColumnCategories() || {};
    const sections = document.querySelectorAll('#prefilterOverlay .prefilter-section');

    sections.forEach(section => {
        const colName = section.dataset.col;
        const matchesSearch = !searchText || sectionMatchesSearch(colName, searchText);

        // Category check
        let matchesCategory = true;
        if (category !== '__all__') {
            const colsInCat = colCategories[category] || [];
            matchesCategory = colsInCat.includes(colName);
        }

        section.style.display = (matchesSearch && matchesCategory) ? '' : 'none';
    });
}

function sectionMatchesSearch(colName, searchText) {
    if (!searchText) return true;

    const lowerSearch = searchText.toLowerCase();

    if (colName.toLowerCase().includes(lowerSearch)) return true;

    const description = GDV.state.getActiveColumnDetails()?.[colName]?.description;
    if (description && description.toLowerCase().includes(lowerSearch)) return true;

    const regexStr = GDV.state.getTagFullPatterns()?.[colName];
    if (regexStr) {
        if (regexStr.toLowerCase().includes(lowerSearch)) return true;
        try {
            if (new RegExp(regexStr, 'i').test(searchText)) return true;
        } catch (err) {
            GDV.utils.reportSilentWarning('Invalid Regex', `Column: "${colName}" contains an invalid regex pattern.`, err, { regexStr });
        }
    }
    return false;
}

function bindActivePrefiltersSummaryRemoval(form) {
    const summaryEl = form.querySelector('#prefilter-active-summary');
    if (!summaryEl) return;

    // Delegated click handler for remove buttons
    summaryEl.addEventListener('click', e => {
        const btn = e.target.closest('.prefilter-remove-btn');
        if (!btn) return;

        const span = btn.closest('.prefilter-active-item');
        if (!span) return;

        const col = span.dataset.col;
        const type = span.dataset.type;

        // Clear inputs for that column
        const esc = window.CSS && CSS.escape ? CSS.escape(col) : col;
        if (type === 'checkbox') {
            form.querySelectorAll(`input[name="${esc}"]`).forEach(i => i.checked = false);
        } else if (type === 'range') {
            const min = form.querySelector(`[name="${esc}__min"]`);
            const max = form.querySelector(`[name="${esc}__max"]`);
            if (min) min.value = '';
            if (max) max.value = '';
        } else if (type === 'text') {
            const input = form.querySelector(`input[name="${esc}"], textarea[name="${esc}"]`);
            if (input) input.value = '';
        }

        // Update live state & UI for this column
        GDV.prefilter.updateLivePrefilterForColumn(form, col);
        GDV.prefilter.updateSinglePrefilterSummary(form, col);
        GDV.prefilter.updatePrefilterWarningFromLiveState(form);
    });
}

function resetPrefilters(form) {
    if (!form) return;

    // Clear tag checkboxes
    form.querySelectorAll('.prefilter-tag-group input[type="checkbox"]').forEach(inp => inp.checked = false);

    // Clear choice checkboxes
    form.querySelectorAll('.prefilter-box input[type="checkbox"]').forEach(inp => inp.checked = true);
    form.querySelectorAll('.prefilter-box .toggle-all').forEach(toggle => {
        toggle.dispatchEvent(new Event('change'));
    });

    // Clear range inputs
    form.querySelectorAll('.prefilter-range input[type="number"]').forEach(inp => inp.value = '');

    // Clear text inputs (excluding search box)
    form.querySelectorAll('input[type="text"]:not(.prefilter-search-input), textarea').forEach(inp => inp.value = '');

    // Reset Prefilter Category
    resetPrefilterCategory(form);

    // Reset liveState and UI
    GDV.state.resetPrefilterLiveState();
    renderFullActivePrefiltersSummary(form);
    GDV.prefilter.updatePrefilterWarningFromLiveState(form);
}

function resetPrefilterCategory(form) {
    const categorySelect = form.querySelector('.prefilter-category-select');
    if (categorySelect) {
        categorySelect.value = '__all__';

        const searchInput = form.querySelector('.prefilter-search-input');
        const searchText = searchInput?.value || '';

        // Re-filter sections so everything shows again
        filterPrefilterSections(searchText, '__all__');
    }
}

})();