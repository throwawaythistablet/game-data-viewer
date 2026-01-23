

async function showPrefilterOverlayAndCollectFilters(columnDetails) {
    try {
        const overlay = createPrefilterOverlayContainer('Refine Your Search Using Prefilters');
        overlay.appendChild(createPrefilterNotice());

        const form = document.createElement('form');

        // Add warning, actions, active filters, search box, and grid
        form.appendChild(createPrefilterWarning());
        form.appendChild(createPrefilterActions(form));
        form.appendChild(createPrefilterSearchBox());
        form.appendChild(createActivePrefiltersSummary());
        form.appendChild(createPrefilterGridFromColumnDetails(columnDetails, lastSearchedPrefilters));

        overlay.appendChild(form);
        document.body.appendChild(overlay);

        // Bind live updates AFTER form is attached
        bindPrefilterWarning(form);
        bindActivePrefiltersSummary(form);

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

// Create the informational notice
function createPrefilterNotice() {
    const notice = document.createElement('div');
    notice.className = 'prefilter-notice is-collapsed';
    notice.innerHTML = getPrefilterNoticeContent()
    bindPrefilterNoticeToggle(notice);
    return notice;
}

function getPrefilterNoticeContent() {
    return `
        <div class="prefilter-notice-body">
            <strong>Guide to Prefilters, Search, and Table Navigation</strong>
            <ol style="margin-top: 8px;">
                <li>
                    <strong>Open Prefilter Overlay</strong> – Click the <em>Search</em> button to see all available prefilters.
                    (This is shown by default, so clicking the button isn’t always necessary.)
                </li>
                <li>
                    <strong>Search Prefilters</strong> – Choose prefilters to narrow your search before the table loads, saving time and memory.
                    Use the glowing search box to quickly locate specific prefilter sections.
                </li>
                <li>
                    <strong>Use Prefilters</strong> – Apply checkboxes, ranges, or text inputs to narrow the dataset.
                    Combine tags for precise results (e.g., <em>female protagonist</em> + <em>2D CG</em>).
                </li>
                <li>
                    <strong>Load Table</strong> – Click <em>Apply Prefilters &amp; Search</em> to load only the filtered rows.
                    A warning appears if no prefilters are selected.
                </li>
                <li>
                    <strong>Sort, Refine, &amp; Reset the Table</strong> – Once the table is loaded:
                    <ul>
                        <li><strong>Sort the Table</strong> – Click column headers to sort by Bayesian score, game time, or other attributes.</li>
                        <li><strong>Refine Column Filters</strong> – Hover over column headers to access column-specific filters.
                            Start broad, then refine step by step for smooth browsing.</li>
                        <li><strong>Reset Column Filters</strong> – Use the <em>Reset Column Filters</em> button to restore the table to its default state.</li>
                    </ul>
                </li>
                <li>
                    <strong>Provide Feedback</strong> – Click the <em>Feedback</em> button to suggest new tags, report issues, or give general feedback.
                </li>
                <li>
                    <strong>New Search</strong> – Use the <em>Search</em> button to adjust prefilters or start a new search.
                </li>
            </ol>

            <hr style="margin: 12px 0;">

            ⚠ <strong>Important: Use Prefilters to Reduce Load</strong><br>
            The dataset is large, and all processing happens client-side in your browser.
            Without prefilters, loading can be slow and memory-intensive.
            You’ll see a “Loading Data…” overlay while it loads.
            Using prefilters ensures a faster, smoother experience when exploring the table.
        </div>
    `;
}

function bindPrefilterNoticeToggle(notice) {
    let isHover = false;

    function updateNoticeState() {
        notice.classList.toggle('is-expanded', isHover);
        notice.classList.toggle('is-collapsed', !isHover);
    }

    notice.addEventListener('mouseenter', () => {
        isHover = true;
        updateNoticeState();
    });

    notice.addEventListener('mouseleave', () => {
        isHover = false;
        updateNoticeState();
    });

    // Initial state
    updateNoticeState();
}

// Create the warning element and prepend it to the form
function createPrefilterWarning() {
    const warningEl = document.createElement('div');
    warningEl.id = 'prefilter-warning';
    warningEl.className = 'prefilter-warning'; // move styling to CSS
    warningEl.textContent = '⚠ No prefilters applied! Searching the full dataset may be heavy.';
    return warningEl;
}

// Show/hide the warning depending on whether any prefilters are applied
function updatePrefilterWarning(form) {
    const preFilter = collectPrefilterFromForm(form);
    const warningEl = form.querySelector('#prefilter-warning');
    if (!warningEl) return;

    // Only consider actual prefilters, ignore empty form
    const hasFilters = Object.keys(preFilter).length > 0;
    warningEl.style.display = hasFilters ? 'none' : 'block';
}

// Bind inputs for live warning updates
function bindPrefilterWarning(form) {
    // Only watch inputs that are part of actual prefilters, not the search box
    const inputs = form.querySelectorAll('input:not(.prefilter-search-input)');
    inputs.forEach(input => {
        input.addEventListener('input', () => updatePrefilterWarning(form));
        input.addEventListener('change', () => updatePrefilterWarning(form));
    });

    // Initial check
    updatePrefilterWarning(form);
}

function createPrefilterActions(form) {
    const actions = document.createElement('div');
    actions.className = 'prefilter-actions sticky-top';

    // Apply button – top row
    const applyBtn = createPrefilterSubmitButton('Apply Prefilters & Search');
    applyBtn.classList.add('btn-apply'); // prominent apply button
    actions.appendChild(applyBtn);

    // Reset button – second row, subtle style
    const resetBtn = createPrefiltersResetButton(form);
    resetBtn.classList.add('btn-reset-subtle'); // subtle, smaller
    resetBtn.style.display = 'inline-block'; // always visible now
    actions.appendChild(resetBtn);

    return actions;
}

function createActivePrefiltersSummary() {
    const container = document.createElement('div');
    container.className = 'prefilter-active-summary';
    container.id = 'prefilter-active-summary';
    container.textContent = 'Active Prefilters: None';
    return container;
}

function createPrefilterSearchBox() {
    const container = document.createElement('div');
    container.className = 'prefilter-search-box';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search prefilters to change…';
    input.className = 'prefilter-search-input';

    // Add event listener for live prefiltering
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

function createPrefiltersResetButton(form) {
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button'; // prevent form submission
    resetBtn.textContent = 'Reset Prefilters';
    resetBtn.className = 'btn btn-reset';

    // On click, reset all prefilters in the form
    resetBtn.addEventListener('click', () => resetPrefilters(form));

    return resetBtn;
}

function createPrefilterGridFromColumnDetails(columnDetails, prefill = {}) {
    const grid = document.createElement('div');
    grid.className = 'prefilter-form';
    for (const [col, colDef] of Object.entries(columnDetails)) {
        grid.appendChild(createFilterSectionForColumnDetails(col, colDef, prefill[col]));
    }
    return grid;
}

// Section for a column, decides which small helper to call
function createFilterSectionForColumnDetails(col, colDef, prefill = null) {
    const section = document.createElement('section');
    section.className = 'prefilter-section';

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

    return section;
}

// Tag checkboxes
function createTagFilter(name, prefill = null) {
    const container = document.createElement('div');
    container.className = 'prefilter-tag-group';

    const patterns = getTagFullPatterns();
    if (patterns[name]) container.title = `Regex pattern:\n${patterns[name]}`;

    const checkedValues = prefill?.choices || [];

    const lbl0 = document.createElement('label');
    lbl0.className = 'prefilter-checkbox';
    const inp0 = document.createElement('input');
    inp0.type = 'checkbox';
    inp0.name = name;
    inp0.value = '0';
    inp0.checked = checkedValues.includes(0);
    lbl0.appendChild(inp0);
    lbl0.appendChild(document.createTextNode(' No (0)'));

    const lbl1 = document.createElement('label');
    lbl1.className = 'prefilter-checkbox';
    const inp1 = document.createElement('input');
    inp1.type = 'checkbox';
    inp1.name = name;
    inp1.value = '1';
    inp1.checked = checkedValues.includes(1);
    lbl1.appendChild(inp1);
    lbl1.appendChild(document.createTextNode(' Yes (1)'));

    container.appendChild(lbl0);
    container.appendChild(lbl1);

    return container;
}

// Choice checkbox group with toggle-all
function createChoiceFilter(name, choices, prefill = null) {
    const box = document.createElement('div');
    box.className = 'prefilter-box';

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-all-label';
    toggleLabel.innerHTML = `<input type="checkbox" class="toggle-all" data-col="${name}" checked> Toggle All`;
    box.appendChild(toggleLabel);

    const checkedValues = prefill?.choices || choices;

    choices.forEach(choice => {
        const lbl = document.createElement('label');
        lbl.className = 'prefilter-checkbox';
        const inp = document.createElement('input');
        inp.type = 'checkbox';
        inp.name = name;
        inp.value = String(choice);
        inp.checked = checkedValues.includes(choice);
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

// Range prefilter (min / max inputs) — sleek version
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

// Text input prefilter (fallback)
function createTextFilterInput(name, prefill = null) {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = name;
    input.placeholder = `Prefilter ${name}…`;
    if (prefill?.text?.[0]) input.value = prefill.text[0];
    return input;
}

// Wait for prefilter form submission
function waitForPrefilterFormSubmission(form, resolve, overlay) {
    form.addEventListener('submit', e => {
        e.preventDefault();
        const preFilter = collectPrefilterFromForm(form);

        if (Object.keys(preFilter).length === 0) {
            const proceed = confirm(
                "⚠ You haven't applied any prefilters.\n" +
                "Loading the full dataset may be very memory-intensive and slow.\n\n" +
                "Do you want to continue anyway?"
            );
            if (!proceed) return;
        }

        // Save for next time
        lastSearchedPrefilters = preFilter;

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

function resetPrefilters(form) {
    if (!form) return;

    // Clear tag checkboxes
    form.querySelectorAll('.prefilter-tag-group input[type="checkbox"]').forEach(inp => inp.checked = false);

    // Clear choice checkboxes
    form.querySelectorAll('.prefilter-box input[type="checkbox"]').forEach(inp => inp.checked = true);

    // Clear range inputs
    form.querySelectorAll('.prefilter-range input[type="number"]').forEach(inp => inp.value = '');

    // Clear text inputs (excluding search box)
    form.querySelectorAll('input[type="text"]:not(.prefilter-search-input), textarea').forEach(inp => inp.value = '');

    // Update summary and warning
    updateActivePrefiltersSummary(form);
    updatePrefilterWarning(form);
}

function filterPrefilterSections(searchText) {
    searchText = searchText.trim();
    const sections = document.querySelectorAll('#prefilterOverlay .prefilter-section');
    const patterns = getTagFullPatterns();

    sections.forEach(section => {
        const colName = section.querySelector('h3')?.textContent || '';
        section.style.display = sectionMatchesSearch(colName, searchText, patterns) ? '' : 'none';
    });
}

function bindActivePrefiltersSummary(form) {
    const inputs = form.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('input', () => updateActivePrefiltersSummary(form));
        input.addEventListener('change', () => updateActivePrefiltersSummary(form));
    });

    // initial update
    updateActivePrefiltersSummary(form);
}

function updateActivePrefiltersSummary(form) {
    const preFilter = collectPrefilterFromForm(form);
    const summaryEl = form.querySelector('#prefilter-active-summary');
    if (!summaryEl) return;

    const items = [];

    for (const [col, val] of Object.entries(preFilter)) {
        let text = '';
        if (val.type === 'tag' || Array.isArray(val.choices)) {
            text = `${col}: ${val.choices?.join(', ') || val.text?.join(', ')}`;
        } else if (val.type === 'int' || val.type === 'float') {
            const minMax = [];
            if (val.min != null) minMax.push(`min=${val.min}`);
            if (val.max != null) minMax.push(`max=${val.max}`);
            text = `${col}: ${minMax.join(', ')}`;
        } else if (val.text) {
            text = `${col}: ${val.text.join(', ')}`;
        }
        if (text) items.push(`<span class="prefilter-active-item">${text}</span>`);
    }

    summaryEl.innerHTML = items.length > 0 ? items.join(' ') : 'Active Prefilters: None';
}

function sectionMatchesSearch(colName, searchText, patterns) {
    if (!searchText) return true; // empty search shows everything

    const lowerSearch = searchText.toLowerCase();

    // 1️⃣ Fastest check: does the column title include the search text?
    if (colName.toLowerCase().includes(lowerSearch)) return true;

    const regexStr = patterns[colName];
    if (!regexStr) return false; // no regex to check

    // 2️⃣ Check if the regex string itself contains the search text
    if (regexStr.toLowerCase().includes(lowerSearch)) return true;

    // 3️⃣ Only now apply the actual regex to the search text
    try {
        const regex = new RegExp(regexStr, 'i'); // case-insensitive
        if (regex.test(searchText)) return true;
    } catch (e) {
        console.warn('Invalid regex for column', colName, regexStr);
    }

    // 4️⃣ No match
    return false;
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
    const inputs = Array.from(form.querySelectorAll('input[type="text"]:not(.prefilter-search-input), textarea'));
    for (const input of inputs) {
        const val = input.value.trim();
        if (!val) continue;
        preFilter[input.name] = { text: [val] };
    }
}