(function() {

const csvTableElement = $('#csvTable');
let previewTimer = null;
let currentPreviewIndex = 0;
let overlayMoveScheduled = false;
let lastMouseEvent = null;
let similarGameRow = null;


GDV.datatable.loadTable = async function(parsedData) {
    await GDV.loading.showLoading();
    
    populateSimilarityColumn(parsedData)
    const columns = createTableColumns(parsedData);
    await renderCsvTable(parsedData, columns);

    await GDV.loading.updateLoadingDirectUpdate("Game Data Table Loaded.", 100);
    await GDV.loading.hideLoading();
};

GDV.datatable.resetAllFilters = async function () {
    await GDV.loading.startLoading();
    await GDV.loading.updateLoadingDirectUpdate("Resetting filters...", 0);

    if (!$.fn.DataTable.isDataTable(csvTableElement)) {
        await GDV.loading.finishLoading();
        return;
    }
    const dt = csvTableElement.DataTable();

    // Native DOM queries
    const checkboxFilters = document.querySelectorAll('tr.filters .filter-checkbox');
    const textFilters = document.querySelectorAll('tr.filters .filter-text-input');
    const rangeFilters = document.querySelectorAll('tr.filters .filter-range');

    // Reset column searches
    await GDV.loading.updateLoadingDirectUpdate("Resetting column searches...", 0);
    const colCount = dt.columns().count();

    for (let i = 0; i < colCount; i++) {
        dt.column(i).search('');
        
        await GDV.loading.updateLoadingStepProgress("Resetting column searches...", 0, 20, i + 1, colCount);
        if (GDV.loading.isLoadingCancelled()) break;
    }

    // Reset checkboxes
    for (let i = 0; i < checkboxFilters.length; i++) {
        const box = checkboxFilters[i];
        const checkboxes = box.querySelectorAll('input[type="checkbox"]');

        checkboxes.forEach(cb => {
            cb.checked = true;
        });

        checkboxes.forEach(cb => {
            if (!cb.classList.contains('toggle-all')) {
                cb.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        await GDV.loading.updateLoadingStepProgress("Resetting checkbox filters...", 20, 40, i + 1, checkboxFilters.length);
        if (GDV.loading.isLoadingCancelled()) break;
    }

    // Reset text filters
    for (let i = 0; i < textFilters.length; i++) {
        const input = textFilters[i];
        input.value = '';
        input.dispatchEvent(new Event('keyup', { bubbles: true }));
        
        await GDV.loading.updateLoadingStepProgress("Resetting text filters...", 40, 60, i + 1, textFilters.length);
        if (GDV.loading.isLoadingCancelled()) break;
    }

    // Reset numeric range filters
    for (let i = 0; i < rangeFilters.length; i++) {
        const range = rangeFilters[i];

        const minInput = range.querySelector('.range-min');
        const maxInput = range.querySelector('.range-max');

        if (minInput) {
            minInput.value = range.dataset.originalMin || '';
        }
        if (maxInput) {
            maxInput.value = range.dataset.originalMax || '';
        }

        const inputs = range.querySelectorAll('input');
        inputs.forEach(input => {
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        
        await GDV.loading.updateLoadingStepProgress("Resetting numeric range filters...", 60, 80, i + 1, rangeFilters.length);
        if (GDV.loading.isLoadingCancelled()) break;
    }

    // Reset column order if ColReorder is available
    if (dt.colReorder && typeof dt.colReorder.reset === 'function') {
        dt.colReorder.reset();
    }

    // Reset sorting and redraw table
    await GDV.loading.updateLoadingDirectUpdate("Sorting the table...", 80);
    sortTable();
    await GDV.loading.updateLoadingDirectUpdate("Resetting Filters Complete.", 100);

    await GDV.loading.finishLoading();
};

GDV.datatable.getColumnDescription = getColumnDescription;
function getColumnDescription(colName) {
    const description = GDV.state.getActiveColumnDetails()?.[colName]?.description || '';
    const regex = GDV.state.getTagFullPatterns()?.[colName];
    const regexDesc = regex ? `Regex pattern:\n${regex}` : ''

    return [description, regexDesc]
        .filter(Boolean)
        .join('\n');
};

GDV.datatable.getColumnTagCount = function(colName) {
    return GDV.state.getActiveColumnDetails()?.[colName]?.tag_count ?? null; 
};

function createTableColumns(parsedData) {
    if (!parsedData || !parsedData.length) return [];

    const columnNames = Object.keys(parsedData[0]);
    const searchedPrefilters = GDV.state.getLastSearchedPrefilters() || {};
    const columnDetails = GDV.state.getActiveColumnDetails();

    const columns = buildColumns(columnNames, columnDetails, searchedPrefilters);

    const thumbnailColumn = buildThumbnailColumn();
    if (thumbnailColumn) {
        columns.unshift(thumbnailColumn);
    }

    const viewImagesColumn = buildViewImagesColumn(columnNames);
    if (viewImagesColumn) {
        columns.unshift(viewImagesColumn);
    }

    return columns;
}

function populateSimilarityColumn(data) {
    const referenceKey = GDV.state.getSimilarityGame();
    if (referenceKey) {
        similarGameRow = structuredClone(data.find(r => String(r.key) === referenceKey));
    }
    if (!similarGameRow) return;

    if (data.length > 0 && !('similarity_score' in data[0])) {
        data[0].similarity_score = 0; // placeholder
    }

    data.forEach((row, index) => {
        const similarity = computeRowSimilarityPercent(similarGameRow, row);
        row.similarity_score = similarity;
    });
}

function computeRowSimilarityPercent(similarGameRow, row) {
    const IGNORE_COLS = new Set([
        'key',
        'url',
        'similarity_score',
        '__thumbnail__',
        '__view_images__'
    ]);

    const compareKeys = Object.keys(similarGameRow).filter(k => !IGNORE_COLS.has(k));

    let matches = 0;
    let total = 0;

    compareKeys.forEach(col => {
        const a = similarGameRow[col];
        const b = row[col];

        if (a == null || b == null) return;

        let isMatch = false;

        // Numeric compare (exact)
        const na = parseFloat(a);
        const nb = parseFloat(b);
        if (!isNaN(na) && !isNaN(nb)) {
            isMatch = na === nb;
        } else {
            // String compare (case-insensitive, trimmed)
            const sa = String(a).trim().toLowerCase();
            const sb = String(b).trim().toLowerCase();
            isMatch = sa === sb;
        }

        total++;
        if (isMatch) matches++;
    });

    return total === 0 ? '0.00' : ((matches / total) * 100).toFixed(2);
}

async function renderCsvTable(data, columns) {
    csvTableElement.hide();
    destroyExistingTable();
    
    createTableHeader(columns);
    const tbody = createTableBody();
    await appendRowsToTableInChunks(data, columns, tbody);
    await initializeDataTableWithOptions(columns);
    csvTableElement.show();
}

function buildColumns(columnNamesInTable, columnDetails, searchedPrefilters) {
    const specialKeys = ['key', 'similarity_score'];
    const prefilterKeys = Object.keys(searchedPrefilters).filter(k => k !== 'key');

    const normalColumns = columnNamesInTable.filter(k => shouldIncludeColumn(k, columnDetails, searchedPrefilters));
    const prefilterColumns = columnNamesInTable.filter(col => prefilterKeys.includes(col));
    const specialColumns  = columnNamesInTable.filter(col => specialKeys.includes(col));

    const resultKeys = [
        ...specialColumns,
        ...prefilterColumns,
        ...normalColumns.filter(col => !specialColumns.includes(col) && !prefilterColumns.includes(col))
    ];

    return resultKeys.map(columnName => ({
        title: columnName,
        data: columnName,
        createdCell: (td, cellData) => {
            td.textContent = '';
            td.appendChild(renderCellValueNode(cellData, columnName));
        },
        white_highlight: prefilterColumns.includes(columnName),
        yellow_highlight: specialColumns.includes(columnName),
    }));
}

function buildThumbnailColumn() {
    if (!GDV.state.getThumbnails()) return null;

    return {
        title: 'thumbnails',
        data: '__thumbnail__',
        orderable: false,
        searchable: false,
        render: (data, type, row) => {
            const key = row['key'];
            if (!key) return '';
            const image_url = getThumbnailImageForKey(key)
            const game_url = stripHtmlToString(row['url']);
            return renderThumbnail(image_url, game_url);
        }
    };
}

function buildViewImagesColumn(columnNames) {
    if (!columnNames.includes('location')) return null;
    
    return {
        title: 'View Images',
        data: '__view_images__',
        orderable: false,
        searchable: false,
        createdCell: (td) => {
            td.textContent = '';
            td.appendChild(renderViewButton());
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
        clearTableRangeFilters();
        csvTableElement.empty();
    }
}

function createTableHeader(columns) {
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const filterRow = document.createElement('tr');
    filterRow.classList.add('filters');

    columns.forEach(col => {
        // Header cell
        const th = document.createElement('th');
        th.textContent = col.title;
        if (col.white_highlight) {
            th.classList.add('white-highlight');
        } else if (col.yellow_highlight) {
            th.classList.add('yellow-highlight');
        }
        headerRow.appendChild(th);

        // Filter cell
        const filterTh = document.createElement('th');
        if (col.white_highlight) {
            filterTh.classList.add('white-highlight');
        } else if (col.yellow_highlight) {
            filterTh.classList.add('yellow-highlight');
        }
        filterRow.appendChild(filterTh);
    });

    thead.appendChild(headerRow);
    thead.appendChild(filterRow);
    csvTableElement.append(thead);
}

function createTableBody() {
    const tbody = document.createElement('tbody');
    csvTableElement.append(tbody);
    return tbody;
}

async function appendRowsToTableInChunks(data, columns, tbody) {
    const CHUNK_SIZE = 500;
    const totalRows = data.length;

    for (let start = 0; start < totalRows; start += CHUNK_SIZE) {
        if (GDV.loading.isLoadingCancelled()) throw new Error('Loading cancelled by user.');
        const chunk = data.slice(start, start + CHUNK_SIZE);
        const fragment = document.createDocumentFragment();
        chunk.forEach(rowData => {
            const tr = document.createElement('tr');
            columns.forEach(col => {
                const td = document.createElement('td');
                
                if (col.data === '__view_images__') {
                    td.appendChild(renderViewButton());
                } else if (col.data === '__thumbnail__') {
                    const key = rowData['key'];
                    const image_url = getThumbnailImageForKey(key);
                    const game_url = stripHtmlToString(rowData['url']);
                    td.appendChild(renderThumbnail(key, image_url, game_url));
                } else if (col.data === 'site_std_version') {
                    const rd = rowData[col.data];
                    const trimmed = typeof rd === 'string' && rd.length > 19 ? rd.slice(0, 19) + '…' : rd;
                    td.appendChild(renderCellValueNode(trimmed, col.data));
                } else {
                    td.appendChild(renderCellValueNode(rowData[col.data], col.data));
                }

                if (col.white_highlight) td.classList.add('white-highlight');
                else if (col.yellow_highlight) td.classList.add('yellow-highlight');
                tr.appendChild(td);
            });
            fragment.appendChild(tr);
        });
        tbody.appendChild(fragment);

        // Actual rows processed so far
        const rowsProcessed = Math.min(start + chunk.length, totalRows);
        await GDV.loading.updateLoadingStepProgress("Adding Rows To The Table...", 30, 70, rowsProcessed, totalRows);
        await GDV.utils.yieldToBrowser();
    }
}

function initializeDataTableWithOptions(columns) {
    sortColumnName = getDefaultSortColumnName()
    let sortColumnIndex = findIndexOfColumnByNameInColumns(columns, sortColumnName);
    if (isInvalidColumnIndex(sortColumnIndex)) {
        GDV.utils.reportSilentWarning('Invalid Column Index', `Cannot sort by "${sortColumnName}": the column index is missing or invalid.`);
        sortColumnIndex = 0
    }
    
    return new Promise(resolve => {
        const dt = csvTableElement.DataTable({
            paging: true,
            pageLength: 100,
            order: [[sortColumnIndex, 'desc']],
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
                addHeaderTooltips(api);
                await addColumnFilters(api);
                resolve();
            }
        });
    });
}

function addHeaderTooltips(api) {
    api.columns().every(function () {
        const col = this;
        const header = col.header();
        const colName = header.textContent.trim();
        header.title = getColumnDescription(colName);
    });
}

async function addColumnFilters(api) {
    const colCount = api.columns().count();
    const colDefs = GDV.state.getActiveColumnDetails() || {};
    const ths = document.querySelectorAll('.filters th');

    for (let colIdx = 0; colIdx < colCount; colIdx++) {
        if (GDV.loading.isLoadingCancelled()) throw new Error('Loading cancelled by user.');
        const column = api.column(colIdx);
        const th = ths[colIdx];
        if (!th) continue;
        if (th.querySelector('.filter-container')) continue;

        const container = document.createElement('div');
        container.className = 'filter-container';
        th.appendChild(container);

        const colName = column.header().textContent.trim();
        const colDef = colDefs[colName];

        if (colName === "thumbnails") {
            addGameSimilaritySearch(container, column);
            continue;
        }
        if (!colDef) continue;
        addColumnFilterItems(container, column, colName, colDef, colIdx);

        await GDV.loading.updateLoadingStepProgress("Adding Column Filters...", 70, 99, colIdx + 1, colCount);
        await GDV.utils.yieldToBrowser();
    }

    bindTableSortingButtons();
    setupFiltersExpandCollapse();
}

function addGameSimilaritySearch(container, column) {
    const similarityWrapper = document.createElement('div');
    similarityWrapper.className = 'filters-similarity';

    // Input + label (nest input inside label)
    const titleLabel = document.createElement('label');
    titleLabel.className = 'title-label';
    titleLabel.textContent = 'Find Similar Games Here (By Similarity Score) ';

    const similarityInput = document.createElement('input');
    similarityInput.type = 'text';
    similarityInput.className = 'filter-text-input';
    similarityInput.placeholder = 'Find a game...';
    similarityInput.name = 'similaritySearch';

    // Nest input inside label to associate correctly
    titleLabel.appendChild(similarityInput);
    similarityWrapper.appendChild(titleLabel);

    // Nearest match display
    const nearestMatchWrapper = document.createElement('div');
    nearestMatchWrapper.className = 'filters-line-wrapper';
    const nearestMatchLabel = document.createElement('span');
    nearestMatchLabel.className = 'nearest-match-label';
    nearestMatchLabel.textContent = 'Nearest game match: ';
    const nearestMatchValue = document.createElement('span');
    nearestMatchValue.className = 'nearest-match-value';
    nearestMatchValue.textContent = '—';
    nearestMatchValue.dataset.gameKey = '';
    nearestMatchWrapper.appendChild(nearestMatchLabel);
    nearestMatchWrapper.appendChild(nearestMatchValue);
    similarityWrapper.appendChild(nearestMatchWrapper);

    // Buttons
    const btnWrapper = document.createElement('div');
    btnWrapper.className = 'filters-line-wrapper';
    const similarityButton = document.createElement('button');
    similarityButton.type = 'button';
    similarityButton.className = 'similarity-btn';
    similarityButton.textContent = 'Update Similarity Scores';
    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'similarity-btn';
    resetButton.textContent = 'Reset';
    btnWrapper.appendChild(similarityButton);
    btnWrapper.appendChild(resetButton);
    similarityWrapper.appendChild(btnWrapper);
    container.appendChild(similarityWrapper);

    // Cache key column once
    const keyColumn = getKeyColumnFromTable(column);

    // Input handler
    similarityInput.addEventListener('input', function () {
        const query = this.value.trim();
        if (!query || !keyColumn) {
            nearestMatchValue.textContent = '—';
            nearestMatchValue.dataset.gameKey = '';
            return;
        }
        const nearest = findNearestGameKey(query, keyColumn);
        if (nearest) {
            nearestMatchValue.textContent = nearest;
            nearestMatchValue.dataset.gameKey = nearest;
        } else {
            nearestMatchValue.textContent = '(none)';
            nearestMatchValue.dataset.gameKey = '';
        }
    });

    // Button click
    similarityButton.addEventListener('click', async function () {
        const gameKey = nearestMatchValue.dataset.gameKey;
        if (!gameKey) {
            GDV.utils.reportHardWarning('No Game Title Provided', 'Please enter a game title first.');
            return;
        }
        setSimilarityGame(gameKey);
        await GDV.csvHandler.executeCsvSearch(GDV.state.getActiveCsvFile());
    });

    resetButton.addEventListener('click', async function () {
        resetSimilarityGame();
        await GDV.csvHandler.executeCsvSearch(GDV.state.getActiveCsvFile());
    });
}


function getKeyColumnFromTable(anyColumnApi) {
    const tableApi = anyColumnApi.table();
    const headers = tableApi.columns().header().toArray();
    const keyIndex = headers.findIndex(h => h.textContent.trim() === 'key');

    if (isInvalidColumnIndex(keyIndex)) return null;
    return tableApi.column(keyIndex);
}

function findNearestGameKey(input, keyColumn) {
    const q = input.toLowerCase();
    let best = null;
    let bestScore = Infinity;

    // Pull all keys from the column (raw data)
    const keys = keyColumn
        .data()
        .toArray()
        .map(k => String(k));

    for (const key of keys) {
        const k = key.toLowerCase();

        // Fast path: substring match
        if (k.includes(q)) return key;

        const score = GDV.utils.levenshteinDistance(q, k);
        if (score < bestScore) {
            bestScore = score;
            best = key;
        }
    }

    return best;
}

async function addColumnFilterItems(container, column, colName, colDef, colIdx) {
    addSortingControls(container, colIdx);
    if (colDef.choices && colDef.choices.length > 0) {
        addCheckboxFilter(container, column, colName, colDef);
    } else if (colDef.type === 'int' || colDef.type === 'float') {
        addRangeFilter(container, column, colName, colDef);
    } else {
        addTextFilter(container, column, colName);
    }
}

async function addSortingControls(container, colIdx) {
    // Create a wrapper div for buttons
    const lineWrapper = document.createElement('div');
    lineWrapper.className = 'filters-line-wrapper';

    // Create ascending button
    const asc = document.createElement('button');
    asc.className = 'sort-asc btn';
    asc.dataset.colIdx = colIdx;
    asc.textContent = 'Sort ↑';

    // Create descending button
    const desc = document.createElement('button');
    desc.className = 'sort-desc btn';
    desc.dataset.colIdx = colIdx;
    desc.textContent = 'Sort ↓';

    // Append buttons to the wrapper
    lineWrapper.append(asc);
    lineWrapper.append(desc);

    // Append the wrapper to the container
    container.append(lineWrapper);
}

function addCheckboxFilter(th, column, colName, colDef) {
    const box = document.createElement('div');
    box.className = 'filter-checkbox';
    th.appendChild(box);

    // Sanitize column name for IDs
    const sanitizedColName = String(colName || 'checkbox-filter')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');

    // Toggle All
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-all-label';

    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.className = 'toggle-all';
    toggleInput.checked = true;
    toggleInput.id = `toggle-all-${sanitizedColName}`;
    toggleInput.name = `toggleAll-${sanitizedColName}`;

    toggleLabel.setAttribute('for', toggleInput.id);
    toggleLabel.appendChild(toggleInput);
    toggleLabel.append(' Toggle All');
    box.appendChild(toggleLabel);

    // Individual checkboxes
    colDef.choices.forEach((v, idx) => {
        const label = document.createElement('label');

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = v;
        input.checked = true;

        // Assign unique id and name for accessibility
        const sanitizedValue = String(v)
            .replace(/\s+/g, '-')
            .replace(/[^\w-]/g, '');
        input.id = `chk-${sanitizedColName}-${sanitizedValue}-${idx}`;
        input.name = `chk-${sanitizedColName}`;

        label.setAttribute('for', input.id);
        label.appendChild(input);
        label.append(' ' + v);

        box.appendChild(label);
    });

    // Event delegation (single listener)
    box.addEventListener('change', function (e) {
        const target = e.target;

        // Toggle all handler
        if (target.classList.contains('toggle-all')) {
            const checked = target.checked;
            const allCheckboxes = box.querySelectorAll('input[type="checkbox"]:not(.toggle-all)');
            allCheckboxes.forEach(cb => {
                cb.checked = checked;
                cb.dispatchEvent(new Event('change', { bubbles: true }));
            });
            return;
        }

        // Individual checkbox handler
        if (target.matches('input[type="checkbox"]:not(.toggle-all)')) {
            const checkedInputs = box.querySelectorAll('input[type="checkbox"]:not(.toggle-all):checked');
            const checkedVals = Array.from(checkedInputs).map(el => el.value);

            toggleInput.checked = checkedVals.length === colDef.choices.length;

            let searchRegex;

            if (checkedVals.length === 0) {
                searchRegex = ''; // match everything
            } else if (checkedVals.length === colDef.choices.length) {
                searchRegex = '';
            } else {
                const escaped = checkedVals.map(v => $.fn.dataTable.util.escapeRegex(v));
                searchRegex = '^(' + escaped.join('|') + ')$';
            }

            column.search(searchRegex, true, false).draw();
        }
    });
}

function addRangeFilter(th, column, colName, colDef) {
    // Container
    const box = document.createElement('div');
    box.className = 'filter-range';
    th.appendChild(box);

    // Helper to sanitize column name for IDs
    const sanitizedName = String(colName || 'range-filter')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');

    // Min input wrapper and label
    const minWrapper = document.createElement('div');
    minWrapper.className = 'range-input-wrapper';
    box.appendChild(minWrapper);

    const minId = `range-min-${sanitizedName}`;
    const minLabel = document.createElement('label');
    minLabel.className = 'range-label';
    minLabel.setAttribute('for', minId);
    minLabel.textContent = 'Min';
    minWrapper.appendChild(minLabel);

    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = 'range-min';
    minInput.placeholder = 'Min';
    minInput.id = minId;
    minInput.name = minId;
    minInput.value = colDef.min ?? '';
    minWrapper.appendChild(minInput);

    // Max input wrapper and label
    const maxWrapper = document.createElement('div');
    maxWrapper.className = 'range-input-wrapper';
    box.appendChild(maxWrapper);

    const maxId = `range-max-${sanitizedName}`;
    const maxLabel = document.createElement('label');
    maxLabel.className = 'range-label';
    maxLabel.setAttribute('for', maxId);
    maxLabel.textContent = 'Max';
    maxWrapper.appendChild(maxLabel);

    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = 'range-max';
    maxInput.placeholder = 'Max';
    maxInput.id = maxId;
    maxInput.name = maxId;
    maxInput.value = colDef.max ?? '';
    maxWrapper.appendChild(maxInput);

    // Store original values in dataset
    box.dataset.originalMin = colDef.min ?? '';
    box.dataset.originalMax = colDef.max ?? '';

    const colIdx = column.index();
    const dataKey = column.dataSrc();
    const table = column.table();

    let minVal;
    let maxVal;

    // Single DataTables filter function
    const rangeFilter = function (settings, data) {
        let rawVal;

        if (data == null) rawVal = undefined;
        else if (typeof data === 'object' && !Array.isArray(data)) rawVal = data[dataKey];
        else if (Array.isArray(data)) rawVal = data[colIdx];
        else rawVal = data;

        const num = stripHtmlAndConvertToNumber(rawVal);
        if (isNaN(num)) return true;

        if (minVal !== undefined && num < minVal) return false;
        if (maxVal !== undefined && num > maxVal) return false;

        return true;
    };

    const tableId = csvTableElement.id || 'csvTable';
    rangeFilter._rangeFilterKey = `rangeFilter_${tableId}_${colIdx}`;

    $.fn.dataTable.ext.search.push(rangeFilter);

    function applyRangeFilter() {
        const minValRaw = parseFloat(minInput.value);
        const maxValRaw = parseFloat(maxInput.value);

        minVal = !isNaN(minValRaw) ? minValRaw : undefined;
        maxVal = !isNaN(maxValRaw) ? maxValRaw : undefined;

        table.draw();
    }

    // Event listeners for min/max inputs
    [minInput, maxInput].forEach(input => {
        input.addEventListener('input', applyRangeFilter);
        input.addEventListener('change', applyRangeFilter);
    });

    // Apply filter initially
    applyRangeFilter();
}

function addTextFilter(th, column, colName) {
    // Wrapper div
    const wrapper = document.createElement('div');
    wrapper.className = 'filter-text-wrapper';
    th.appendChild(wrapper);

    // Create label for accessibility
    const label = document.createElement('label');
    label.className = 'filter-text-label';

    // Ensure colName is a string
    const sanitizedName = String(colName || 'text-filter')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');
    const inputId = `filter-${sanitizedName}`;

    label.setAttribute('for', inputId);
    label.textContent = 'Filter: '; // visible label for screen readers
    wrapper.appendChild(label);

    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'filter-text-input';
    input.placeholder = 'Filter...';
    input.id = inputId;
    input.name = inputId;
    wrapper.appendChild(input);

    // Event handler
    const handler = function () {
        column.search(this.value).draw();
    };

    input.addEventListener('keyup', handler);
    input.addEventListener('change', handler);
    input.addEventListener('input', handler);
}

function bindTableSortingButtons() {
    if (!csvTableElement.data('sortingButtonsBound')) {
        // Ascending sort buttons
        csvTableElement.on('click', '.sort-asc', function () {
            const dt = csvTableElement.DataTable();
            const colIdx = Number($(this).data('colIdx'));
            dt.order([colIdx, 'asc']).draw();
        });

        // Descending sort buttons
        csvTableElement.on('click', '.sort-desc', function () {
            const dt = csvTableElement.DataTable();
            const colIdx = Number($(this).data('colIdx'));
            dt.order([colIdx, 'desc']).draw();
        });

        // Mark as bound
        csvTableElement.data('sortingButtonsBound', true);
    }
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

function renderViewButton() {
    const btn = document.createElement('button');
    btn.className = 'btn view-images';
    btn.textContent = 'View';
    return btn;
}

function renderThumbnail(key, image_url, game_url) {
    if (!image_url || !game_url) return document.createDocumentFragment();

    const wrapper = document.createElement('div');
    wrapper.className = 'table-thumbnail-wrapper';

    // Main link + image
    const aGame = document.createElement('a');
    aGame.href = game_url;
    aGame.target = '_blank';
    aGame.rel = 'noopener noreferrer';

    const img = document.createElement('img');
    img.className = 'table-thumbnail';
    img.src = image_url;
    img.alt = 'thumbnail';
    img.loading = 'lazy';

    aGame.appendChild(img);
    wrapper.appendChild(aGame);

    // Overlay div
    const overlay = document.createElement('div');
    overlay.className = 'table-thumbnail-overlay';

    const playLink = document.createElement('a');
    playLink.className = 'table-thumbnail-action';
    playLink.href = game_url;
    playLink.target = '_blank';
    playLink.rel = 'noopener noreferrer';
    playLink.title = 'Play the game';               // tooltip
    playLink.textContent = 'Play ▶';
    playLink.setAttribute('aria-label', 'Play the game'); // screen reader label
    playLink.setAttribute('role', 'button');       // optional for better semantics

    const writeReview = document.createElement('a');
    writeReview.className = 'table-thumbnail-action';
    writeReview.href = getSubUrl(game_url, 'br-rate');
    writeReview.target = '_blank';
    writeReview.rel = 'noopener noreferrer';
    writeReview.title = 'Write a review for the game';
    writeReview.textContent = 'Write A Review 📝';
    writeReview.setAttribute('aria-label', 'Write a review for the game');
    writeReview.setAttribute('role', 'button');

    const readReviews = document.createElement('a');
    readReviews.className = 'table-thumbnail-action';
    readReviews.href = getSubUrl(game_url, 'br-reviews');
    readReviews.target = '_blank';
    readReviews.rel = 'noopener noreferrer';
    readReviews.title = 'Read reviews for the game';
    readReviews.textContent = 'Read Reviews 📖';
    readReviews.setAttribute('aria-label', 'Read reviews for the game');
    readReviews.setAttribute('role', 'button');

    const findSimilarGames = document.createElement('a');
    findSimilarGames.className = 'table-thumbnail-action';
    findSimilarGames.href = '#';
    findSimilarGames.title = 'Find similar games and add a similarity column with matching score details for this game';
    findSimilarGames.textContent = 'Find Similar Games 🔍';
    findSimilarGames.setAttribute('aria-label', 'Find similar games and add a similarity column for this game');
    findSimilarGames.setAttribute('role', 'button');
    findSimilarGames.addEventListener('click', async (e) => {
        e.preventDefault();
        setSimilarityGame(key);
        await GDV.csvHandler.executeCsvSearch(GDV.state.getActiveCsvFile());
    });

    overlay.appendChild(playLink);
    overlay.appendChild(writeReview);
    overlay.appendChild(readReviews);
    overlay.appendChild(findSimilarGames);
    wrapper.appendChild(overlay);

    return wrapper;
}

function renderCellValueNode(val, colName = null) {
    if (val === undefined || val === null) return document.createTextNode('');

    const text = String(val).trim();

    // Excel-style HYPERLINK formula
    const hyperlinkMatch = text.match(/^=HYPERLINK\("([^"]+)",\s*"([^"]+)"\)$/i);
    if (hyperlinkMatch) {
        const [, rawPath, label] = hyperlinkMatch;
        return createHyperlinkNode(toFileUrl(rawPath), label);
    }

    // Web URLs
    if (/^https?:\/\//i.test(text)) {
        return createHyperlinkNode(text, text);
    }

    // Local Windows path
    if (/^[a-zA-Z]:\\/.test(text)) {
        return createHyperlinkNode(toFileUrl(text), text);
    }

    // Highlight numeric columns
    const highlightedNode = createHighlightedNode(text, colName)
    if (highlightedNode) {
        return highlightedNode;
    }

    return document.createTextNode(text);
}

function sortTable() {
    sortTableByColumn(getDefaultSortColumnName(), 'desc');
}

function sortTableByColumn(columnName, order) {
    const columnIndex = findIndexOfColumnByNameInTable(columnName);
    if (isInvalidColumnIndex(columnIndex)) {
        GDV.utils.reportSilentWarning('Invalid Column Index', `Cannot sort by "${columnName}": the column index is missing or invalid.`);
        return;
    }

    const dt = csvTableElement.DataTable();
    dt.order([[columnIndex, order]]).draw();
}

function getDefaultSortColumnName() {
    return GDV.state.getSimilarityGame()
        ? 'similarity_score'
        : 'bayesian_rating';
}

// Small helper for hyperlink nodes
function createHyperlinkNode(url, label) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = label;
    return a;
}

function createHighlightedNode(text, colName) {
    if (!colName) return null;

    const colDef = GDV.state.getActiveColumnDetails()?.[colName];
    if (!colDef) return null;
    const colNameLower = colName.toLowerCase();

    if (colDef.type === 'int' || colDef.type === 'float') {
        return GDV.dom.createHighlightFromValue(text, colName);
    } else if (colNameLower.includes('sentiment_label')) {
        return GDV.dom.createHighlightFromSentiment(text);
    } else if (colNameLower === 'status') {
        return GDV.dom.createHighlightFromStatus(text);
    }
    return null;
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
    // Clear any existing interval first to prevent duplicates
    stopPreviewSlideshow();

    if (previewImages.length <= 1) return;

    previewTimer = setInterval(() => {
        currentPreviewIndex = (currentPreviewIndex + 1) % previewImages.length;
        previewImg.src = previewImages[currentPreviewIndex];
    }, 500); // advance every 0.5 sec
}

function stopPreviewSlideshow() {
    if (previewTimer !== null) {
        clearInterval(previewTimer);
        previewTimer = null;
    }
    currentPreviewIndex = 0; // reset index
}

function clearTableRangeFilters() {
    // Get table ID using native DOM
    const tableId = csvTableElement.id || 'csvTable';

    // Filter out any existing range filters
    $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(fn =>
        typeof fn._rangeFilterKey !== 'string' || !fn._rangeFilterKey.startsWith(`rangeFilter_${tableId}_`)
    );

    // Redraw table if it exists
    if ($.fn.DataTable.isDataTable(csvTableElement)) {
        csvTableElement.DataTable().draw(false);
    }
}

function getThumbnailImageForKey(key) {
    const entry = GDV.state.getThumbnails()[key];
    return entry ? entry.thumbnail_image : null;
}

function getPreviewImagesForKey(key) {
    const entry = GDV.state.getThumbnails()[key];
    return entry ? entry.preview_images : null;
}

function getSubUrl(gameUrl, path) {
    if (!gameUrl || typeof gameUrl !== 'string') return path; // fallback if empty

    try {
        // Attempt proper URL resolution
        return new URL(path, gameUrl).toString();
    } catch {
        // Fallback: naive string concatenation with single slash
        let base = gameUrl.trim();
        if (!base.endsWith('/')) base += '/';
        if (path.startsWith('/')) path = path.slice(1);
        return base + path;
    }
}

function findIndexOfColumnByNameInTable(colName) {
    const dt = csvTableElement.DataTable();
    const colIdx = dt.columns().indexes().toArray().find(i => {
        const headerText = dt.column(i).header().textContent.trim().toLowerCase();
        return headerText === colName;
    });
    return colIdx;
}

function findIndexOfColumnByNameInColumns(columns, colName) {
    if (!Array.isArray(columns) || !colName) return null;
    colName = colName.toLowerCase();

    const idx = columns.findIndex(col => 
        col?.title?.toLowerCase() === colName
    );

    return idx !== -1 ? idx : null;
}

function getValueOfColumnFromRowElement(el, colName) {
    const dt = csvTableElement.DataTable();
    const tr = el.closest('tr'); // native DOM closest
    if (!tr) return null;

    const rowData = dt.row(tr).data();
    if (!rowData) return null;

    const colIdx = findIndexOfColumnByNameInTable(colName);
    if (colIdx == null) return null;

    const value = rowData[colIdx];
    if (!value) return null;
    return value;
}

function toFileUrl(path) {
    if (path.startsWith('http')) return path;
    let urlPath = path.replace(/\\/g, '/');
    if (!urlPath.startsWith('/')) urlPath = '/' + urlPath;
    return 'file:///' + urlPath;
}

function isInvalidColumnIndex(columnIndex) {
    return columnIndex === null || columnIndex === -1;
}

function stripHtmlAndConvertToNumber(text) {
    if (typeof text === 'number') return text; // already a number
    if (typeof text !== 'string') return NaN;  // not parseable
    const cleaned = text
        .replace(/<[^>]*>/g, '')   // remove HTML tags
        .replace(/,/g, '')         // remove commas
        .replace(/\s+/g, '')       // remove spaces inside numbers
        .trim();
    return parseFloat(cleaned);
}

function stripHtmlToString(text) {
    if (typeof text !== 'string') return text;
    // Remove all HTML tags and trim
    return text.replace(/<[^>]*>/g, '').trim();
}

function setSimilarityGame(gameName) {
    GDV.state.setSimilarityGame(gameName);
    GDV.dom.renderMainPagePrefiltersPanel();
}

function resetSimilarityGame() {
    similarGameRow = null;
    GDV.state.resetSimilarityGame();
    GDV.dom.renderMainPagePrefiltersPanel();
}

// Delegated event listeners for thumbnails
csvTableElement
    .off('mouseenter', '.table-thumbnail')
    .on('mouseenter', '.table-thumbnail', function(e) {
        handleThumbnailMouseEnter(this, e);
    });

csvTableElement
    .off('mouseleave', '.table-thumbnail')
    .on('mouseleave', '.table-thumbnail', function() {
        handleThumbnailMouseLeave();
    });

csvTableElement
    .off('mousemove', '.table-thumbnail')
    .on('mousemove', '.table-thumbnail', function(e) {
        handleThumbnailMouseMove(e);
    });

function handleThumbnailMouseEnter(el, e) {
    const key = getValueOfColumnFromRowElement(el, 'key');
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
