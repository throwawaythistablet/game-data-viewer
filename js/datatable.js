
let keyColumnIndex = null;
let bayesianColumnIndex = null;

function createTableColumns(parsedData) {
    if (!parsedData || !parsedData.length) return [];

    const keys = Object.keys(parsedData[0]);
    const searchedPrefilters = lastSearchedPrefilters || {};
    const columnDetails = getActiveColumnDetails();

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

function saveColumnIndices(columns) {
    keyColumnIndex = columns.findIndex(col => col.data === 'key');
    bayesianColumnIndex = columns.findIndex(col => col.data === 'bayesian_rating');
}

function buildCsvColumns(keys, columnDetails, searchedPrefilters) {
    return keys
        .filter(key => shouldIncludeColumn(key, columnDetails, searchedPrefilters))
        .map(key => ({
            title: key,
            data: key,
            render: (data) => renderCellValue(data, key)
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

            return `
                <img
                    class="table-thumbnail"
                    src="${entry.thumbnail_image}"
                    alt="thumbnail"
                    loading="lazy"
                >
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

async function renderCsvTable(data, columns) {
    showLoading();
    
    csvTableElement.hide();
    destroyExistingTable();
    
    createTableHeader(columns);
    const tbody = createTableBody();
    await appendRowsToTableInChunks(data, columns, tbody);
    await initializeDataTableWithOptions(columns);
    
    csvTableElement.show();
    await updateLoadingDirectUpdate("Csv Table Render Complete.", 100);
    hideLoading();
}

function determineColumnDetailsFromDataIfNeeded(parsedData) {
    if (hasValidColumnDetails()) return;
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

function destroyExistingTable() {
    try {
        if ($.fn.DataTable.isDataTable(csvTableElement)) {
            csvTableElement.DataTable().destroy();
        }
    } catch (err) {
        reportSilentWarning('Destroy DataTable Failed', 'Failed to destroy existing DataTable.', err, { csvTableElement });
    } finally {
        csvTableElement.empty(); // safely clear old header/body
    }
}

function createTableHeader(columns) {
    const thead = $('<thead>');
    const headerRow = $('<tr>');
    const filterRow = $('<tr class="filters">');

    columns.forEach(col => {
        headerRow.append(`<th>${col.title}</th>`);
        filterRow.append('<th></th>');
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
        if (isLoadingCancelled()) throw new Error('Loading cancelled by user.');
        
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

                tr.appendChild(td);
            });

            fragment.appendChild(tr);
        });

        tbody[0].appendChild(fragment);

        await updateLoadingStepProgress("Adding Rows To The Table...", 30, 70, Math.min(start + CHUNK_SIZE, data.length), data.length);
        await yieldToBrowser();
    }
}

function initializeDataTableWithOptions(columns) {
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
        if (isLoadingCancelled()) throw new Error('Loading cancelled by user.');

        const column = api.column(colIdx);
        const th = $('.filters th').eq(colIdx);
        const colName = column.header().textContent.trim();
        const colDef = getActiveColumnDetails()[colName];

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

        await updateLoadingStepProgress("Adding Column Filters...", 70, 99, colIdx + 1, colCount);
        await yieldToBrowser();
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
    const totalSortingSteps = csvTableElement.find('thead tr:first-child th').length;

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

    // Attach click handlers (if not already attached)
    if (!csvTableElement.data('sortingButtonsBound')) {
        csvTableElement.on('click', '.sort-asc', function () {
            dt.order([$(this).data('col'), 'asc']).draw();
        });

        csvTableElement.on('click', '.sort-desc', function () {
            dt.order([$(this).data('col'), 'desc']).draw();
        });

        csvTableElement.data('sortingButtonsBound', true);
    }
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
    if (colName && getActiveColumnDetails()[colName] && ['int', 'float'].includes(getActiveColumnDetails()[colName].type)) {
        const { min, max } = getActiveColumnDetails()[colName];
        return highlightValue(text, min, max);
    }

    return text;
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

let previewTimer = null;   // global or module-level
let currentPreviewIndex = 0;

csvTableElement.on('mouseenter', '.table-thumbnail', function(e) {
    const thumbnail = $(this);
    const rowData = csvTableElement.DataTable().row(thumbnail.closest('tr')).data();
    const key = rowData[keyColumnIndex];
    if (!key || !activeThumbnails[key]) return;

    const previewImages = activeThumbnails[key].preview_images;
    if (!previewImages || previewImages.length === 0) return;

    const overlay = document.getElementById('previewOverlay');
    const previewImg = document.getElementById('previewImage');
    if (!overlay || !previewImg) return;

    overlay.style.display = 'block';
    moveOverlay(e);

    currentPreviewIndex = 0;
    previewImg.src = previewImages[currentPreviewIndex];

    // Stop any existing slideshow first
    if (previewTimer) {
        clearInterval(previewTimer);
        previewTimer = null;
    }

    // Start slideshow
    if (previewImages.length > 1) {
        previewTimer = setInterval(() => {
            currentPreviewIndex = (currentPreviewIndex + 1) % previewImages.length;
            previewImg.src = previewImages[currentPreviewIndex];
        }, 500); // change every 0.5 second (adjust as needed)
    }
});

// Hide on mouse leave
csvTableElement.on('mouseleave', '.table-thumbnail', function() {
    const overlay = document.getElementById('previewOverlay');
    const previewImg = document.getElementById('previewImage');

    if (overlay) overlay.style.display = 'none';
    if (previewImg) previewImg.src = '';

    if (previewTimer) {
        clearInterval(previewTimer);
        previewTimer = null;
    }

    currentPreviewIndex = 0;
});

// Move overlay with mouse
csvTableElement.on('mousemove', '.table-thumbnail', function(e) {
    moveOverlay(e);
});

// Function to position overlay
function moveOverlay(e) {
    const overlay = document.getElementById('previewOverlay');
    const previewImg = document.getElementById('previewImage');
    const offset = 20; // small gap from cursor

    let x = e.pageX + offset;
    let y = e.pageY + offset;

    // Keep within viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = previewImg.getBoundingClientRect();

    if (x + rect.width > vw) x = e.pageX - rect.width - offset;
    if (y + rect.height > vh) y = e.pageY - rect.height - offset;

    overlay.style.left = x + 'px';
    overlay.style.top = y + 'px';
}
