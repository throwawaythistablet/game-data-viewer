
async function showPrefilterOverlayAndCollectFilters(columnDetails) {
    try {
        const overlay = createPrefilterOverlayContainer('Refine Your Search');
        overlay.appendChild(createPrefilterNotice());

        const form = document.createElement('form');

        form.appendChild(createPrefilterActions());
        form.appendChild(createPrefilterSearchBox());
        form.appendChild(createPrefilterGridFromColumnDetails(columnDetails));

        overlay.appendChild(form);
        document.body.appendChild(overlay);

        return new Promise(resolve =>
            waitForPrefilterFormSubmission(form, resolve, overlay)
        );
    } catch (err) {
        console.warn('Prefilter UI failed, continuing without prefiltering:', err);
        return {};
    }
}

function createPrefilterOverlayContainer(title) {
    const overlay = document.createElement('div');
    overlay.id = 'prefilterOverlay';
    overlay.className = 'prefilter-overlay';
    overlay.innerHTML = `<h2>${title}</h2>`;
    return overlay;
}

function createPrefilterNotice() {
    const notice = document.createElement('div');
    notice.className = 'prefilter-notice';
    notice.innerHTML = `
        ⚠ <strong>Important: Use Prefilters to Reduce Load</strong><br>
        The tool loads the entire dataset captured from the site, which can be very large. 
        Unless you use prefilters to narrow it down, your browser may take a long time to load the data, 
        and it can become very memory-intensive.<br><br>
        All processing happens client-side — this is just a static webpage running in your browser. 
        You’ll see a “Loading Data…” overlay while it loads.<br><br>
        <strong>To improve performance:</strong>
        <ul>
            <li>Use the prefilters to limit the number of rows loaded.</li>
            <li>Start with broad filters and refine them gradually if needed.</li>
            <li>If loading becomes too slow, stop the processing, refresh the page and adjust your prefilters.</li>
        </ul>
        Proper use of prefilters ensures a faster, smoother experience when exploring the table.
    `;
    return notice;
}

function createPrefilterActions() {
    const actions = document.createElement('div');
    actions.className = 'prefilter-actions sticky-top';
    actions.appendChild(createPrefilterSubmitButton('Apply Filters & Search'));
    return actions;
}

function createPrefilterSearchBox() {
    const container = document.createElement('div');
    container.className = 'prefilter-search-box';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search filters…';
    input.className = 'prefilter-search-input';

    // Add event listener for live filtering
    input.addEventListener('input', () => {
        filterPrefilterSections(input.value);
    });

    container.appendChild(input);
    return container;
}

function createPrefilterSubmitButton(label = 'Submit') {
    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.textContent = label;
    btn.className = 'btn';
    return btn;
}

function createPrefilterGridFromColumnDetails(columnDetails) {
    const grid = document.createElement('div');
    grid.className = 'prefilter-form';
    for (const [col, colDef] of Object.entries(columnDetails)) {
        grid.appendChild(createFilterSectionForColumnDetails(col, colDef));
    }
    return grid;
}

// Section for a column, decides which small helper to call
function createFilterSectionForColumnDetails(col, colDef) {
    const section = document.createElement('section');
    section.className = 'filter-section';

    const title = document.createElement('h3');
    title.textContent = col;
    section.appendChild(title);

    if (colDef.type === 'tag') {
        section.appendChild(createTagFilter(col));
    } else if (Array.isArray(colDef.choices) && colDef.choices.length > 0) {
        section.appendChild(createChoiceFilter(col, colDef.choices));
    } else if (colDef.type === 'int' || colDef.type === 'float') {
        section.appendChild(createRangeFilter(col, colDef.min, colDef.max));
    } else {
        section.appendChild(createTextFilterInput(col));
    }

    return section;
}

// Choice checkbox group with toggle-all
function createChoiceFilter(name, choices) {
    const box = document.createElement('div');
    box.className = 'filter-box';

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-all-label';
    toggleLabel.innerHTML = `<input type="checkbox" class="toggle-all" data-col="${name}" checked> Toggle All`;
    box.appendChild(toggleLabel);

    choices.forEach(choice => {
        const lbl = document.createElement('label');
        lbl.className = 'filter-checkbox';
        const inp = document.createElement('input');
        inp.type = 'checkbox';
        inp.name = name;
        inp.value = String(choice);
        inp.checked = true;
        lbl.appendChild(inp);
        lbl.appendChild(document.createTextNode(' ' + String(choice)));
        box.appendChild(lbl);
    });

    toggleLabel.querySelector('input').addEventListener('change', function () {
        const checked = this.checked;
        box.querySelectorAll(`input[name="${name}"]`).forEach(i => i.checked = checked);
    });

    return box;
}

// Tag checkboxes
function createTagFilter(name) {
    const container = document.createElement('div');
    container.className = 'filter-tag-group';

    // 0 checkbox
    const lbl0 = document.createElement('label');
    lbl0.className = 'filter-checkbox';
    const inp0 = document.createElement('input');
    inp0.type = 'checkbox';
    inp0.name = name;
    inp0.value = '0';
    inp0.checked = false;
    lbl0.appendChild(inp0);
    lbl0.appendChild(document.createTextNode(' No (0)'));

    // 1 checkbox
    const lbl1 = document.createElement('label');
    lbl1.className = 'filter-checkbox';
    const inp1 = document.createElement('input');
    inp1.type = 'checkbox';
    inp1.name = name;
    inp1.value = '1';
    inp1.checked = false;
    lbl1.appendChild(inp1);
    lbl1.appendChild(document.createTextNode(' Yes (1)'));

    container.appendChild(lbl0);
    container.appendChild(lbl1);

    return container;
}

// Range filter (min / max inputs) — sleek version
function createRangeFilter(name, min = null, max = null) {
    const wrapper = document.createElement('div');
    wrapper.className = 'filter-range';

    const minWrap = document.createElement('div');
    minWrap.className = 'range-input-wrapper';
    // Use placeholder (if available) instead of pre-filling the value.
    minWrap.appendChild(createNumberInput(`${name}__min`, null, 'Min', 'range-min', (min != null ? String(min) : '')));

    const maxWrap = document.createElement('div');
    maxWrap.className = 'range-input-wrapper';
    maxWrap.appendChild(createNumberInput(`${name}__max`, null, 'Max', 'range-max', (max != null ? String(max) : '')));

    wrapper.appendChild(minWrap);
    wrapper.appendChild(maxWrap);
    return wrapper;
}

// Create labeled number input with optional class for styling
function createNumberInput(name, value = null, labelText = '', inputClass = '', placeholder = '') {
    const container = document.createElement('div');

    const label = document.createElement('label');
    label.className = 'range-label';
    label.textContent = labelText;
    container.appendChild(label);

    const input = document.createElement('input');
    input.type = 'number';
    input.name = name;

    if (value !== null && value !== undefined && value !== '') {
        input.value = value;
    } else if (placeholder) {
        input.placeholder = placeholder;
    }

    if (inputClass) input.className = inputClass;

    input.step = 'any';
    input.min = '';
    input.max = '';

    input.addEventListener('invalid', e => e.preventDefault());

    container.appendChild(input);
    return container;
}

// Text input filter (fallback)
function createTextFilterInput(name) {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = name;
    input.placeholder = `Filter ${name}…`;
    return input;
}

function filterPrefilterSections(searchText) {
    searchText = searchText.toLowerCase().trim();
    const sections = document.querySelectorAll('#prefilterOverlay .filter-section');

    sections.forEach(section => {
        const title = section.querySelector('h3')?.textContent.toLowerCase() || '';
        if (!searchText || title.includes(searchText)) {
            section.style.display = '';
        } else {
            section.style.display = 'none';
        }
    });
}

// Wait for prefilter form submission
function waitForPrefilterFormSubmission(form, resolve, overlay) {
    form.addEventListener('submit', e => {
        e.preventDefault();
        const preFilter = collectPrefilterFromForm(form);
        overlay.remove();
        resolve(preFilter);
    });
}

// Main entry: returns the structured preFilter
function collectPrefilterFromForm(form) {
    const preFilter = {};
    processRangePrefilters(form, preFilter);
    processTagPrefilters(form, preFilter);
    processChoicePrefilters(form, preFilter);
    processTextPrefilters(form, preFilter);
    return preFilter;
}

// Process range columns
function processRangePrefilters(form, preFilter, colDefMap = getActiveColumnDetails()) {
    Object.entries(colDefMap).forEach(([col, def]) => {
        if (def.type !== 'int' && def.type !== 'float') return;

        const minEl = form.querySelector(`[name="${col}__min"]`);
        const maxEl = form.querySelector(`[name="${col}__max"]`);

        if (!minEl && !maxEl) return;

        let min = minEl?.value === '' ? null : Number(minEl.value);
        let max = maxEl?.value === '' ? null : Number(maxEl.value);

        if (def.type === 'int') {
            if (min != null) min = Math.round(min);
            if (max != null) max = Math.round(max);
        }

        if (min != null || max != null) {
            preFilter[col] = { type: def.type, min, max };
        }
    });
}

// Build tag entries in preFilter
function processTagPrefilters(form, preFilter, colDefMap = getActiveColumnDetails()) {
    Object.entries(colDefMap).forEach(([col, def]) => {
        if (def.type !== 'tag') return;

        const checkboxes = Array.from(form.querySelectorAll(`input[type="checkbox"][name="${col}"]`));
        if (checkboxes.length === 0) return;

        const checked = checkboxes.filter(c => c.checked).map(c => Number(c.value));
        if (checked.length === 0 || checked.length === def.choices.length) return;

        preFilter[col] = { type: 'tag', choices: checked };
    });
}

// Process choice checkboxes
function processChoicePrefilters(form, preFilter, colDefMap = getActiveColumnDetails()) {
    Object.entries(colDefMap).forEach(([col, def]) => {
        if (!Array.isArray(def.choices) || def.choices.length === 0) return;
        if (def.type === 'tag') return;

        const checkboxes = Array.from(form.querySelectorAll(`input[type="checkbox"][name="${col}"]`));
        if (checkboxes.length === 0) return;

        const checked = checkboxes
            .filter(c => c.checked)
            .map(c => {
                if (def.type === 'bool') return c.value === 'true';
                if (def.type === 'int') return parseInt(c.value, 10);
                if (def.type === 'float') return parseFloat(c.value);
                return String(c.value);
            });

        if (checked.length === 0 || checked.length === def.choices.length) return;
        preFilter[col] = { type: def.type, choices: checked };
    });
}

// Process text inputs
function processTextPrefilters(form, preFilter) {
    const inputs = Array.from(form.querySelectorAll('input[type="text"], textarea'));
    for (const input of inputs) {
        const val = input.value.trim();
        if (!val) continue;
        preFilter[input.name] = { text: [val] };
    }
}