(function() {

const csvTableElement = $('#csvTable');
let keyColumnIndex = null;
let urlColumnIndex = null;
let bayesianColumnIndex = null;
let previewTimer = null;
let currentPreviewIndex = 0;
let overlayMoveScheduled = false;
let lastMouseEvent = null;


GDV.datatable.loadTable = async function(parsedData) {
    await GDV.loading.showLoading();
    
    determineColumnDetailsFromDataIfNeeded(parsedData)
    const columns = createTableColumns(parsedData);
    await renderCsvTable(parsedData, columns);

    await GDV.loading.updateLoadingDirectUpdate("Game Data Table Loaded.", 100);
    await GDV.loading.hideLoading();
}

GDV.datatable.resetAllFilters = async function() {
    await GDV.loading.startLoading();
    await GDV.loading.updateLoadingDirectUpdate("Resetting filters...", 0);

    if (!$.fn.DataTable.isDataTable(csvTableElement)) {
        await GDV.loading.finishLoading();
        return;
    }
    const dt = csvTableElement.DataTable();

    // Count total steps for progress
    const checkboxFilters = $('tr.filters .filter-box');
    const textFilters = $('tr.filters .filter-text');
    const rangeFilters = $('tr.filters .filter-range');
    const totalSteps = checkboxFilters.length + textFilters.length + rangeFilters.length + 3; // +3 for column search, remove range functions, column order/sorting

    let step = 0;

    // Reset column searches
    dt.columns().every(function () {
        this.search('');
        step++;
    });
    await GDV.loading.updateLoadingStepProgress("Resetting column searches...", 0, 20, step, totalSteps);

    // Reset checkboxes
    for (let i = 0; i < checkboxFilters.length; i++) {
        const $box = $(checkboxFilters[i]);
        $box.find('input[type="checkbox"]').prop('checked', true);
        $box.find('input[type="checkbox"]').not('.toggle-all').trigger('change');

        step++;
        await GDV.loading.updateLoadingStepProgress("Resetting checkbox filters...", 20, 40, step, totalSteps);
        if (GDV.loading.isLoadingCancelled()) break;
    }

    // Reset text filters
    for (let i = 0; i < textFilters.length; i++) {
        const $input = $(textFilters[i]);
        $input.val('');
        $input.trigger('keyup');

        step++;
        await GDV.loading.updateLoadingStepProgress("Resetting text filters...", 40, 60, step, totalSteps);
        if (GDV.loading.isLoadingCancelled()) break;
    }

    // Reset numeric range filters
    for (let i = 0; i < rangeFilters.length; i++) {
        const $range = $(rangeFilters[i]);
        $range.find('.range-min, .range-max').val('');
        $range.find('input').trigger('input');

        step++;
        await GDV.loading.updateLoadingStepProgress("Resetting numeric range filters...", 60, 80, step, totalSteps);
        if (GDV.loading.isLoadingCancelled()) break;
    }

    await GDV.loading.updateLoadingDirectUpdate("Clearing custom range filters...", 85);
    // Remove custom range filter functions
    $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(fn => !fn.name?.startsWith('rangeFilter_'));

    // Reset column order if ColReorder is available
    if (dt.colReorder && typeof dt.colReorder.reset === 'function') {
        dt.colReorder.reset();
    }

    // Reset sorting and redraw table
    await GDV.loading.updateLoadingDirectUpdate("Sorting the table...", 90);
    sortTable();
    await GDV.loading.updateLoadingDirectUpdate("Resetting Filters Complete.", 100);

    await GDV.loading.finishLoading();
}

function createTableColumns(parsedData) {
    if (!parsedData || !parsedData.length) return [];

    const keys = Object.keys(parsedData[0]);
    const searchedPrefilters = GDV.state.getLastSearchedPrefilters() || {};
    const columnDetails = GDV.state.getActiveColumnDetails();

    const columns = buildCsvColumns(keys, columnDetails, searchedPrefilters);

    const thumbnailColumn = buildThumbnailColumn();
    if (thumbnailColumn) {
        columns.unshift(thumbnailColumn);
    }

    const viewImagesColumn = buildViewImagesColumn(keys);
    if (viewImagesColumn) {
        columns.unshift(viewImagesColumn);
    }
    saveColumnIndices(columns);

    return columns;
}

async function renderCsvTable(data, columns) {
    csvTableElement.hide();
    destroyExistingTable();
    $.fn.dataTable.ext.search = []; // Clear all old range filters / custom search functions
    
    createTableHeader(columns);
    const tbody = createTableBody();
    await appendRowsToTableInChunks(data, columns, tbody);
    await initializeDataTableWithOptions(columns);
    
    csvTableElement.show();
}

function determineColumnDetailsFromDataIfNeeded (parsedData) {
    if (GDV.state.hasValidColumnDetails()) return;
    if (!parsedData || parsedData.length === 0) return;

    const columnDetails = {};

    const numericRegex = /^[+-]?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/;
    const looksNumericString = v => {
        if (v === null || v === undefined) return false;
        const s = String(v).trim();
        return s !== '' && numericRegex.test(s);
    };

    const keys = Object.keys(parsedData[0] || {});
    keys.forEach(col => {
        const rawValues = parsedData.map(r => r[col]);
        const values = rawValues
            .filter(v => v !== undefined && v !== null)
            .map(v => String(v).trim())
            .filter(v => v !== '');

        if (values.length === 0) {
            columnDetails[col] = { type: 'str', choices: [] };
            return;
        }

        /* ---------- NUMERIC ---------- */
        if (values.every(looksNumericString)) {
            const nums = values.map(Number);
            const uniqueNums = Array.from(new Set(nums));
            const allInts = nums.every(Number.isInteger);

            // TAG (binary)
            if (uniqueNums.every(v => v === 0 || v === 1)) {
                columnDetails[col] = {
                    type: 'tag',
                    choices: [0, 1],
                    min: 0,
                    max: 1
                };
                return;
            }

            // RANGE
            columnDetails[col] = {
                type: allInts ? 'int' : 'float',
                choices: [],
                min: Math.min(...nums),
                max: Math.max(...nums)
            };
            return;
        }

        /* ---------- BOOLEAN DETECTION ---------- */
        const lowerVals = values.map(v => v.toLowerCase());
        if (lowerVals.every(v => v === 'true' || v === 'false')) {
            columnDetails[col] = {
                type: 'bool',
                choices: [false, true]
            };
            return;
        }

        /* ---------- STRING ---------- */
        const uniqueStrings = Array.from(new Set(values));

        columnDetails[col] = {
            type: 'str',
            choices: uniqueStrings.length <= 20 ? uniqueStrings : []
        };
    });

    // Hardcoded bounds
    if (columnDetails["bayesian_rating"]) {
        columnDetails["bayesian_rating"].min = 0;
        columnDetails["bayesian_rating"].max = 5;
    }
    if (columnDetails["site_rating"]) {
        columnDetails["site_rating"].min = 0;
        columnDetails["site_rating"].max = 5;
    }

    updateColumnDetails(columnDetails, "", "Determined from loaded data.");
}

function saveColumnIndices(columns) {
    keyColumnIndex = columns.findIndex(col => col.data === 'key');
    urlColumnIndex = columns.findIndex(col => col.data === 'url');
    bayesianColumnIndex = columns.findIndex(col => col.data === 'bayesian_rating');
}

function buildCsvColumns(keys, columnDetails, searchedPrefilters) {
    const prefilterKeys = Object.keys(searchedPrefilters);

    // Normal columns: only include if shouldIncludeColumn returns true
    const nonPrefilterColumns = keys.filter(k => !prefilterKeys.includes(k) && shouldIncludeColumn(k, columnDetails, searchedPrefilters));

    // Prefilter columns: only include if they exist in the data
    const prefilterColumns = prefilterKeys.filter(k => keys.includes(k));

    // Combine: first normal column, then prefilter columns, then remaining normal columns
    const resultKeys = [
        ...nonPrefilterColumns.slice(0, 1),      // first normal column
        ...prefilterColumns,                     // prefilter columns in the middle
        ...nonPrefilterColumns.slice(1)          // remaining normal columns
    ];

    // Build column definitions with highlight only for prefilters
    return resultKeys.map(key => ({
        title: key,
        data: key,
        render: (data) => renderCellValue(data, key),
        highlight: prefilterColumns.includes(key) // only prefilters highlighted
    }));
}

function buildViewImagesColumn(keys) {
    if (!keys.includes('location')) return null;

    return {
        title: 'View Images',
        data: '__view_images__',
        orderable: false,
        searchable: false,
        render: () => `<button class="btn view-images">View</button>`
    };
}

function buildThumbnailColumn() {
    if (!activeThumbnails) return null;

    return {
        title: 'Image',
        data: '__thumbnail__',
        orderable: false,
        searchable: false,
        render: (data, type, row) => {
            const key = row['key'];
            if (!key) return '';

            const entry = activeThumbnails[key];
            if (!entry || !entry.thumbnail_image) return '';

            const urlCellValue = row['url'];
            const url = getUrlFromCellValue(urlCellValue);
            if (!url) return '';

            return `
                <a href="${url}" target="_blank" rel="noopener noreferrer">
                    <img
                        class="table-thumbnail"
                        src="${entry.thumbnail_image}"
                        alt="thumbnail"
                        loading="lazy"
                    >
                </a>
            `;
        }
    };
}

function shouldIncludeColumn(key, columnDetails, searchedPrefilters) {
    const colDef = columnDetails[key];
    return (
        !colDef ||
        colDef.type !== 'tag' ||
        key in searchedPrefilters
    );
}

function destroyExistingTable() {
    try {
        if ($.fn.DataTable.isDataTable(csvTableElement)) {
            csvTableElement.DataTable().destroy();
        }
    } catch (err) {
        GDV.utils.reportSilentWarning('Destroy DataTable Failed', 'Failed to destroy existing DataTable.', err, { csvTableElement });
    } finally {
        csvTableElement.empty(); // safely clear old header/body
    }
}

function createTableHeader(columns) {
    const thead = $('<thead>');
    const headerRow = $('<tr>');
    const filterRow = $('<tr class="filters">');

    columns.forEach(col => {
        // Header cell
        const th = $('<th>').text(col.title);
        if (col.highlight) th.addClass('highlight-column');
        headerRow.append(th);

        // Filter cell
        const filterTh = $('<th>');
        if (col.highlight) filterTh.addClass('highlight-column');
        filterRow.append(filterTh);
    });

    thead.append(headerRow).append(filterRow);
    csvTableElement.append(thead);
}

function createTableBody() {
    const tbody = $('<tbody>');
    csvTableElement.append(tbody);
    return tbody;
}

async function appendRowsToTableInChunks(data, columns, tbody) {
    const CHUNK_SIZE = 500;

    for (let start = 0; start < data.length; start += CHUNK_SIZE) {
        if (GDV.loading.isLoadingCancelled()) throw new Error('Loading cancelled by user.');
        
        const chunk = data.slice(start, start + CHUNK_SIZE);
        const fragment = document.createDocumentFragment();

        chunk.forEach(rowData => {
            const tr = document.createElement('tr');

            // Render cells based on column definitions
            columns.forEach(col => {
                const td = document.createElement('td');

            if (col.data === '__view_images__') {
                td.innerHTML = `<button class="btn view-images">View</button>`;
            }
            else if (col.data === '__thumbnail__') {
                td.innerHTML = col.render(null, 'display', rowData);
            }
            else {
                td.innerHTML = renderCellValue(rowData[col.data], col.data);
            }

                if (col.highlight) td.classList.add('highlight-column');
                tr.appendChild(td);
            });

            fragment.appendChild(tr);
        });

        tbody[0].appendChild(fragment);

        await GDV.loading.updateLoadingStepProgress("Adding Rows To The Table...", 30, 70, Math.min(start + CHUNK_SIZE, data.length), data.length);
        await GDV.utils.yieldToBrowser();
    }
}

function initializeDataTableWithOptions(columns) {
    if (isInvalidColumnIndex(bayesianColumnIndex)) {
        GDV.utils.reportSilentWarning('Invalid Column Index', 'Cannot sort by Bayesian rating: the column index is missing or invalid.');
    }
    
    return new Promise(resolve => {
        const dt = csvTableElement.DataTable({
            paging: true,
            pageLength: 100,
            order: [[bayesianColumnIndex, 'desc']],
            lengthMenu: [
                [50, 100, 200, 500, 1000],
                [50, 100, 200, 500, 1000]
            ],
            fixedHeader: true,
            colReorder: true,
            autoWidth: false,
            orderCellsTop: true,

            dom: '<"top"lfip>rt<"bottom"lfip><"clear">',

            initComplete: async function () {
                const api = this.api();

                await addColumnFilters(api);
                await addSortingControls(api, dt);

                resolve();
            }
        });
    });
}

async function addColumnFilters(api) {
    const colCount = api.columns().count();

    for (let colIdx = 0; colIdx < colCount; colIdx++) {
        if (GDV.loading.isLoadingCancelled()) throw new Error('Loading cancelled by user.');

        const column = api.column(colIdx);
        const th = $('.filters th').eq(colIdx);
        const colName = column.header().textContent.trim();
        const colDef = GDV.state.getActiveColumnDetails()[colName];

        if (!colDef) continue;

        // Create filter container
        const container = $('<div class="filter-container"></div>').appendTo(th);

        if (colDef.choices && colDef.choices.length > 0) {
            addCheckboxFilter(container, column, colDef);
        } else if (colDef.type === 'int' || colDef.type === 'float') {
            addRangeFilter(container, column, colDef);
        } else {
            addTextFilter(container, column);
        }

        await GDV.loading.updateLoadingStepProgress("Adding Column Filters...", 70, 99, colIdx + 1, colCount);
        await GDV.utils.yieldToBrowser();
    }

    // Setup hover expand/collapse
    setupFiltersExpandCollapse();
}

function setupFiltersExpandCollapse() {
    const table = document.querySelector('#csvTable');
    if (!table) return;

    const headerRow = table.querySelector('thead tr:first-child'); // column headers
    const filtersRow = table.querySelector('tr.filters');           // filters row

    if (!headerRow || !filtersRow) return;

    let isHoverHeader = false;
    let isHoverFilters = false;
    let isFocusInside = false;

    function updateFiltersState() {
        const shouldExpand = isHoverHeader || isHoverFilters || isFocusInside;
        filtersRow.classList.toggle('is-expanded', shouldExpand);
        filtersRow.classList.toggle('is-collapsed', !shouldExpand);
    }

    // Hover on headers
    headerRow.addEventListener('mouseenter', () => {
        isHoverHeader = true;
        updateFiltersState();
    });
    headerRow.addEventListener('mouseleave', () => {
        isHoverHeader = false;
        updateFiltersState();
    });

    // Hover on filters row itself (hover buffer)
    filtersRow.addEventListener('mouseenter', () => {
        isHoverFilters = true;
        updateFiltersState();
    });
    filtersRow.addEventListener('mouseleave', () => {
        isHoverFilters = false;
        updateFiltersState();
    });

    // Keep open while interacting
    filtersRow.addEventListener('focusin', () => {
        isFocusInside = true;
        updateFiltersState();
    });
    filtersRow.addEventListener('focusout', (e) => {
        const newTarget = e.relatedTarget;
        if (!filtersRow.contains(newTarget)) {
            isFocusInside = false;
            updateFiltersState();
        }
    });

    // Start collapsed
    updateFiltersState();
}

function ensureFiltersWrapper() {
    const filtersRow = document.querySelector('tr.filters');
    if (!filtersRow) return null;

    if (filtersRow.parentElement.classList.contains('filters-wrapper')) {
        return filtersRow.parentElement;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'filters-wrapper';

    filtersRow.parentElement.insertBefore(wrapper, filtersRow);
    wrapper.appendChild(filtersRow);

    return wrapper;
}

function addCheckboxFilter(th, column, colDef) {
    const box = $('<div class="filter-box"></div>').appendTo(th);
    const toggleAll = $('<label class="toggle-all-label"><input type="checkbox" class="toggle-all" checked> Toggle All</label>');
    box.append(toggleAll);

    colDef.choices.forEach(v => {
        box.append(`
            <label>
                <input type="checkbox" value="${v}" checked>
                ${v}
            </label>
        `);
    });

    // Toggle all
    box.on('change', '.toggle-all', function () {
        const checked = $(this).is(':checked');
        box.find('input[type="checkbox"]').not(this).prop('checked', checked).trigger('change');
    });

    // Individual checkbox filtering
    box.on('change', 'input:not(.toggle-all)', function () {
        const checkedVals = box.find('input[type="checkbox"]:not(.toggle-all):checked')
            .map((_, el) => $(el).val())
            .get();

        toggleAll.find('input').prop('checked', checkedVals.length === colDef.choices.length);

        let searchRegex;
        if (checkedVals.length === 0) {
            // No checkboxes checked → match nothing
            searchRegex = 'a^'; // regex that never matches
        } else if (checkedVals.length === colDef.choices.length) {
            // All checked → remove filter
            searchRegex = '';
        } else {
            // Some checked → match only selected values
            searchRegex = '^(' + checkedVals.map(v => $.fn.dataTable.util.escapeRegex(v)).join('|') + ')$';
        }

        column.search(searchRegex, true, false).draw();
    });
}

function addTextFilter(th, column) {
    $('<input type="text" class="filter-text" placeholder="Filter..." />')
        .appendTo(th)
        .on('keyup change clear', function () {
            column.search(this.value).draw();
        });
}

function addRangeFilter(th, column, colDef) {
    // container
    const box = $('<div class="filter-range"></div>').appendTo(th);

    // labeled inputs
    const minWrapper = $('<div class="range-input-wrapper"></div>').appendTo(box);
    $('<label class="range-label">Min</label>').appendTo(minWrapper);
    const minInput = $('<input type="number" class="range-min" placeholder="Min" />')
        .val(colDef.min ?? '')
        .appendTo(minWrapper);

    const maxWrapper = $('<div class="range-input-wrapper"></div>').appendTo(box);
    $('<label class="range-label">Max</label>').appendTo(maxWrapper);
    const maxInput = $('<input type="number" class="range-max" placeholder="Max" />')
        .val(colDef.max ?? '')
        .appendTo(maxWrapper);

    const colIdx = column.index();
    const dataKey = column.dataSrc();
    const table = column.table();
    let lastFilterName = null;

    function stripHtml(text) {
        if (typeof text !== 'string') return text;
        const tmp = document.createElement('div');
        tmp.innerHTML = text;
        return (tmp.textContent || tmp.innerText || '').trim();
    }

    function applyRangeFilter() {
        const minVal = minInput.val() === '' ? NaN : parseFloat(minInput.val());
        const maxVal = maxInput.val() === '' ? NaN : parseFloat(maxInput.val());

        if (lastFilterName) {
            $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(fn => fn.name !== lastFilterName);
            lastFilterName = null;
        }

        const rangeFilter = function(settings, data) {
            let rawVal;
            if (data == null) rawVal = undefined;
            else if (typeof data === 'object' && !Array.isArray(data)) rawVal = data[dataKey];
            else if (Array.isArray(data)) rawVal = data[colIdx];
            else rawVal = data;

            const num = parseFloat(String(stripHtml(rawVal)).replace(/,/g, '').trim());
            if (isNaN(num)) return true;
            if (!isNaN(minVal) && num < minVal) return false;
            if (!isNaN(maxVal) && num > maxVal) return false;
            return true;
        };

        rangeFilter.name = `rangeFilter_${colIdx}_${Date.now()}`;
        lastFilterName = rangeFilter.name;
        $.fn.dataTable.ext.search.push(rangeFilter);

        table.draw();
    }

    box.on('input change', 'input', applyRangeFilter);
    applyRangeFilter();
}

async function addSortingControls(api, dt) {
    csvTableElement.find('thead tr:first-child th').each(async function (index) {
        const th = $(this);

        // Only add buttons once
        if (!th.find('.sort-asc').length) {
            const title = th.text().trim();
            th.html(`
                ${title}
                <button class="sort-asc btn" data-col="${index}">↑</button>
                <button class="sort-desc btn" data-col="${index}">↓</button>
            `);
        }
    });
    
    GDV.dom.bindTableSortingButtons(dt);
}

function renderCellValue(val, colName = null) {
    if (val === undefined || val === null) return '';

    // Non-string values can be returned directly
    const text = String(val).trim();

    const toFileUrl = path => {
        if (path.startsWith('http')) return path;
        let urlPath = path.replace(/\\/g, '/');
        if (!urlPath.startsWith('/')) urlPath = '/' + urlPath;
        return 'file:///' + urlPath;
    };

    // Excel-style HYPERLINK formula
    const hyperlinkMatch = text.match(/^=HYPERLINK\("([^"]+)",\s*"([^"]+)"\)$/i);
    if (hyperlinkMatch) {
        const [, rawPath, label] = hyperlinkMatch;
        return `<a href="${toFileUrl(rawPath)}" target="_blank">${label}</a>`;
    }

    // Web URLs
    if (/^https?:\/\//i.test(text)) return `<a href="${text}" target="_blank">${text}</a>`;

    // Local Windows path
    if (/^[a-zA-Z]:\\/.test(text)) return `<a href="${toFileUrl(text)}" target="_blank">${text}</a>`;

    // Highlight numeric columns automatically
    if (colName && GDV.state.getActiveColumnDetails()[colName] && ['int', 'float'].includes(GDV.state.getActiveColumnDetails()[colName].type)) {
        const { min, max } = GDV.state.getActiveColumnDetails()[colName];
        return highlightValue(text, min, max);
    }

    return text;
}

function sortTable() {
    sortByBayesianRating()
}

function sortByBayesianRating() {
    if (isInvalidColumnIndex(bayesianColumnIndex)) {
        GDV.utils.reportSilentWarning('Invalid Column Index', 'Cannot sort by Bayesian rating: the column index is missing or invalid.');
        return;
    }

    dt = csvTableElement.DataTable();
    dt.order([[bayesianColumnIndex, 'desc']]).draw();
}

function highlightValue(val, min, max) {
    const num = parseFloat(val);
    if (isNaN(num)) return val;

    // Compute intensity 0 → 1
    const intensity = Math.max(0, Math.min(1, (num - min) / (max - min)));

    const isLightMode = document.body.classList.contains('light-theme');

    // --- Four fixed extremes ---
    let low, high;
    if (isLightMode) {
        // Light mode: black text, red → green
        low  = { h: 0,   s: 70, l: 80 };  // light red
        high = { h: 120, s: 70, l: 80 };  // light green (readable on black)
    } else {
        // Dark mode: white text, red → green
        low  = { h: 0,   s: 70, l: 20 };  // dark red
        high = { h: 120, s: 70, l: 20 };  // dark green (readable on white)
    }

    // Interpolate HSL between low and high
    const hue = Math.round(low.h + (high.h - low.h) * intensity);
    const saturation = Math.round(low.s + (high.s - low.s) * intensity);
    const lightness = Math.round(low.l + (high.l - low.l) * intensity);
    const bgColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const textColor = isLightMode ? '#000000' : '#ffffff';
    const weightClass = intensity > 0.7 ? 'high' : intensity > 0.4 ? 'medium' : 'low';
    return `<span class="highlight-cell ${weightClass}" style="background-color:${bgColor}; color:${textColor}">${val}</span>`;
}

function showPreviewOverlay(previewImages, e) {
    const overlay = document.getElementById('previewOverlay');
    const previewImg = document.getElementById('previewImage');
    if (!overlay || !previewImg) return;

    overlay.style.display = 'block';
    movePreviewOverlay(e);

    currentPreviewIndex = 0;
    previewImg.src = previewImages[currentPreviewIndex];

    stopPreviewSlideshow();
    startPreviewSlideshow(previewImages, previewImg);
}

function movePreviewOverlay(e) {
    const overlay = document.getElementById('previewOverlay');
    const previewImg = document.getElementById('previewImage');
    if (!overlay || !previewImg) return;

    const offset = 20; // small gap from cursor
    let x = e.pageX + offset;
    let y = e.pageY + offset;

    // Keep overlay within viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = previewImg.getBoundingClientRect();

    if (x + rect.width > vw) x = e.pageX - rect.width - offset;
    if (y + rect.height > vh) y = e.pageY - rect.height - offset;

    overlay.style.left = x + 'px';
    overlay.style.top = y + 'px';
}

function startPreviewSlideshow(previewImages, previewImg) {
    if (previewImages.length <= 1) return;

    previewTimer = setInterval(() => {
        currentPreviewIndex = (currentPreviewIndex + 1) % previewImages.length;
        previewImg.src = previewImages[currentPreviewIndex];
    }, 500); // advance every 0.5 sec
}

function stopPreviewSlideshow() {
    if (previewTimer) {
        clearInterval(previewTimer);
        previewTimer = null;
    }
}

function getPreviewImagesForKey(key) {
    const entry = activeThumbnails[key];
    return entry ? entry.preview_images : null;
}

function getKeyFromRowElement(el) {
    if (isInvalidColumnIndex(keyColumnIndex)) {
        GDV.utils.reportSilentWarning('Invalid Column Index', 'The key column index is missing or invalid.');
        return null;
    }

    const table = csvTableElement.DataTable();
    const $tr = $(el).closest('tr');
    const rowData = table.row($tr).data();
    if (!rowData) return null;

    const key = rowData[keyColumnIndex];
    if (!key || !activeThumbnails[key]) return null;

    return key;
}

function getUrlFromRowElement(el) {
    if (isInvalidColumnIndex(urlColumnIndex)) {
        GDV.utils.reportSilentWarning('Invalid Column Index', 'The url column index is missing or invalid.');
        return null;
    }

    const table = csvTableElement.DataTable();
    const $tr = $(el).closest('tr');
    const rowData = table.row($tr).data();
    if (!rowData) return null;

    return getUrlFromCellValue(rowData[urlColumnIndex]);
}

function getUrlFromCellValue(cellValue) {
    if (!cellValue) return null;

    if (typeof cellValue === 'string' && cellValue.includes('<a')) {
        const tmp = document.createElement('div');
        tmp.innerHTML = cellValue;
        const a = tmp.querySelector('a');
        return a?.href ?? a?.textContent?.trim() ?? null;
    }

    return typeof cellValue === 'string' ? cellValue : null;
}

function isInvalidColumnIndex(columnIndex) {
    return columnIndex === null || columnIndex === -1;
}

function normalizeColumnHeader(columnHeader) {
    return columnHeader.split('\n')[0].trim().toLowerCase();
}

// CSV table
csvTableElement.on('mouseenter', '.table-thumbnail', function(e) {
    handleThumbnailMouseEnter(this, e);
});

csvTableElement.on('mouseleave', '.table-thumbnail', function() {
    handleThumbnailMouseLeave();
});

csvTableElement.on('mousemove', '.table-thumbnail', function(e) {
    handleThumbnailMouseMove(e);
});

function handleThumbnailMouseEnter(el, e) {
    const key = getKeyFromRowElement(el);
    if (!key) return;

    const previewImages = getPreviewImagesForKey(key);
    if (!previewImages || previewImages.length === 0) return;

    showPreviewOverlay(previewImages, e);
}

function handleThumbnailMouseLeave() {
    const overlay = document.getElementById('previewOverlay');
    const previewImg = document.getElementById('previewImage');

    if (overlay) overlay.style.display = 'none';
    if (previewImg) previewImg.src = '';

    stopPreviewSlideshow();
    currentPreviewIndex = 0;
}

function handleThumbnailMouseMove(e) {
    lastMouseEvent = e;
    if (overlayMoveScheduled) return;

    overlayMoveScheduled = true;
    requestAnimationFrame(() => {
        movePreviewOverlay(lastMouseEvent);
        overlayMoveScheduled = false;
    });
}

})();
