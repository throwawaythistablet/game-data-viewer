(function() {

const csvTableElement = $('#csvTable');
let previewTimer = null;
let currentPreviewIndex = 0;
let overlayMoveScheduled = false;
let lastMouseEvent = null;


GDV.datatable.loadTable = async function(parsedData) {
    await GDV.loading.showLoading();
    
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
        const $box = $(checkboxFilters[i]);
        $box.find('input[type="checkbox"]').prop('checked', true);
        $box.find('input[type="checkbox"]').not('.toggle-all').trigger('change');
        await GDV.loading.updateLoadingStepProgress("Resetting checkbox filters...", 20, 40, i + 1, checkboxFilters.length);
        if (GDV.loading.isLoadingCancelled()) break;
    }

    // Reset text filters
    for (let i = 0; i < textFilters.length; i++) {
        const $input = $(textFilters[i]);
        $input.val('');
        $input.trigger('keyup');
        await GDV.loading.updateLoadingStepProgress("Resetting text filters...", 40, 60, i + 1, textFilters.length);
        if (GDV.loading.isLoadingCancelled()) break;
    }

    // Reset numeric range filters
    for (let i = 0; i < rangeFilters.length; i++) {
        const $range = $(rangeFilters[i]);
        $range.find('.range-min').val($range.data('original-min'));
        $range.find('.range-max').val($range.data('original-max'));
        $range.find('input').trigger('input');
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
}

GDV.datatable.getColumnDescription = getColumnDescription;
function getColumnDescription(colName) {
    const description = GDV.state.getActiveColumnDetails()?.[colName]?.description || '';
    const regex = GDV.state.getTagFullPatterns()?.[colName];
    const regexDesc = regex ? `Regex pattern:\n${regex}` : ''

    return [description, regexDesc]
        .filter(Boolean)
        .join('\n');
}

GDV.datatable.getColumnTagCount = function(colName) {
    return GDV.state.getActiveColumnDetails()?.[colName]?.tag_count ?? null; 
}

function createTableColumns(parsedData) {
    if (!parsedData || !parsedData.length) return [];

    const keys = Object.keys(parsedData[0]);
    const searchedPrefilters = GDV.state.getLastSearchedPrefilters() || {};
    const columnDetails = GDV.state.getActiveColumnDetails();

    const columns = buildColumns(keys, columnDetails, searchedPrefilters);

    const thumbnailColumn = buildThumbnailColumn();
    if (thumbnailColumn) {
        columns.unshift(thumbnailColumn);
    }

    const viewImagesColumn = buildViewImagesColumn(keys);
    if (viewImagesColumn) {
        columns.unshift(viewImagesColumn);
    }

    return columns;
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

function buildColumns(keys, columnDetails, searchedPrefilters) {
    const prefilterKeys = Object.keys(searchedPrefilters).filter(k => k !== 'key');

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
        createdCell: (td, cellData) => {
            td.textContent = '';
            td.appendChild(renderCellValueNode(cellData, key));
        },
        highlight: prefilterColumns.includes(key)
    }));
}

function buildViewImagesColumn(keys) {
    if (!keys.includes('location')) return null;
    
    return {
        title: '',
        data: '__view_images__',
        orderable: false,
        searchable: false,
        createdCell: (td) => {
            td.textContent = '';
            td.appendChild(renderViewButton());
        }
    };
}

function buildThumbnailColumn() {
    if (!GDV.state.getThumbnails()) return null;

    return {
        title: '',
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
                    const image_url = getThumbnailImageForKey(rowData['key']);
                    const game_url = stripHtmlToString(rowData['url']);
                    td.appendChild(renderThumbnail(image_url, game_url));
                } else if (col.data === 'site_std_version') {
                    const rd = rowData[col.data];
                    const trimmed = typeof rd === 'string' && rd.length > 19 ? rd.slice(0, 19) + '…' : rd;
                    td.appendChild(renderCellValueNode(trimmed, col.data));
                } else {
                    td.appendChild(renderCellValueNode(rowData[col.data], col.data));
                }

                if (col.highlight) td.classList.add('highlight-column');
                tr.appendChild(td);
            });
            fragment.appendChild(tr);
        });
        tbody[0].appendChild(fragment);

        // Actual rows processed so far
        const rowsProcessed = Math.min(start + chunk.length, totalRows);
        await GDV.loading.updateLoadingStepProgress("Adding Rows To The Table...", 30, 70, rowsProcessed, totalRows);
        await GDV.utils.yieldToBrowser();
    }
}

function initializeDataTableWithOptions(columns) {
    const bayesianColumnIndex = findIndexOfColumnByNameInColumns(columns, 'bayesian_rating');
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

    for (let colIdx = 0; colIdx < colCount; colIdx++) {
        if (GDV.loading.isLoadingCancelled()) throw new Error('Loading cancelled by user.');

        const column = api.column(colIdx);
        const th = $('.filters th').eq(colIdx);
        if (th.find('.filter-container').length) continue;
        const colName = column.header().textContent.trim();
        const colDef = GDV.state.getActiveColumnDetails()[colName];

        if (!colDef) continue;

        // Create filter container
        const container = $('<div class="filter-container"></div>').appendTo(th);
        addSortingControls(container, colIdx);
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

    bindTableSortingButtons();
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

async function addSortingControls(container, colIdx) {
    // Create a wrapper div for buttons
    const btnWrapper = document.createElement('div');
    btnWrapper.className = 'sort-buttons-wrapper'; // just a class, no styling yet

    // Create ascending button
    const asc = document.createElement('button');
    asc.className = 'sort-asc btn';
    asc.dataset.col = colIdx;
    asc.textContent = 'Sort ↑';

    // Create descending button
    const desc = document.createElement('button');
    desc.className = 'sort-desc btn';
    desc.dataset.col = colIdx;
    desc.textContent = 'Sort ↓';

    // Append buttons to the wrapper
    btnWrapper.append(asc);
    btnWrapper.append(desc);

    // Append the wrapper to the container
    container.append(btnWrapper);
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

    box.data('original-min', colDef.min ?? '');
    box.data('original-max', colDef.max ?? '');

    const colIdx = column.index();
    const dataKey = column.dataSrc();
    const table = column.table();

    // These will be updated on input change
    let minVal;
    let maxVal;

    // ✅ ONE filter function, pushed ONCE
    const rangeFilter = function (settings, data) {
        let rawVal;
        if (data == null) rawVal = undefined;
        else if (typeof data === 'object' && !Array.isArray(data)) rawVal = data[dataKey];
        else if (Array.isArray(data)) rawVal = data[colIdx];
        else rawVal = data;

        const num = stripHtmlAndConvertToNumber(rawVal);
        if (isNaN(num)) return true; // keep non-numeric rows

        if (minVal !== undefined && num < minVal) return false;
        if (maxVal !== undefined && num > maxVal) return false;

        return true;
    };

    // Push filter once
    const tableId = csvTableElement.attr('id') || 'csvTable';
    rangeFilter._rangeFilterKey = `rangeFilter_${tableId}_${colIdx}`;
    $.fn.dataTable.ext.search.push(rangeFilter);

    function applyRangeFilter() {
        const minValRaw = parseFloat(minInput.val());
        const maxValRaw = parseFloat(maxInput.val());

        minVal = !isNaN(minValRaw) ? minValRaw : undefined;
        maxVal = !isNaN(maxValRaw) ? maxValRaw : undefined;
        table.draw();
    }

    box.on('input change', 'input', applyRangeFilter);
    applyRangeFilter();
}

function renderViewButton() {
    const btn = document.createElement('button');
    btn.className = 'btn view-images';
    btn.textContent = 'View';
    return btn;
}

function renderThumbnail(image_url, game_url) {
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

    const write_review = document.createElement('a');
    write_review.className = 'table-thumbnail-action';
    write_review.href = getSubUrl(game_url, 'br-rate');
    write_review.target = '_blank';
    write_review.rel = 'noopener noreferrer';
    write_review.title = 'Write a review for the game';
    write_review.textContent = 'Write A Review 📝';
    write_review.setAttribute('aria-label', 'Write a review for the game');
    write_review.setAttribute('role', 'button');

    const read_reviews = document.createElement('a');
    read_reviews.className = 'table-thumbnail-action';
    read_reviews.href = getSubUrl(game_url, 'br-reviews');
    read_reviews.target = '_blank';
    read_reviews.rel = 'noopener noreferrer';
    read_reviews.title = 'Read reviews for the game';
    read_reviews.textContent = 'Read Reviews 📖';
    read_reviews.setAttribute('aria-label', 'Read reviews for the game');
    read_reviews.setAttribute('role', 'button');

    overlay.appendChild(playLink);
    overlay.appendChild(write_review);
    overlay.appendChild(read_reviews);
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
    sortByBayesianRating()
}

function sortByBayesianRating() {
    const bayesianColumnIndex = findIndexOfColumnByNameInTable('bayesian_rating');
    if (isInvalidColumnIndex(bayesianColumnIndex)) {
        GDV.utils.reportSilentWarning('Invalid Column Index', 'Cannot sort by Bayesian rating: the column index is missing or invalid.');
        return;
    }

    const dt = csvTableElement.DataTable();
    dt.order([[bayesianColumnIndex, 'desc']]).draw();
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

    if (colDef.type === 'int' || colDef.type === 'float') {
        return GDV.dom.createHighlightFromValue(text, colName);
    }

    if (colName.toLowerCase().includes('sentiment_label')) {
        return GDV.dom.createHighlightFromSentiment(text);
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
    const tableId = csvTableElement.attr('id') || 'csvTable';
    $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(fn =>
        typeof fn._rangeFilterKey !== 'string' || !fn._rangeFilterKey.startsWith(`rangeFilter_${tableId}_`)
    );
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
        const headerText = $(dt.column(i).header()).text().trim().toLowerCase();
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
    const rowData = dt.row($(el).closest('tr')).data();
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

function bindTableSortingButtons() {
    if (!csvTableElement.data('sortingButtonsBound')) {
        csvTableElement.on('click', '.sort-asc', function () {
            const dt = csvTableElement.DataTable();
            const colIdx = Number($(this).data('col'));
            dt.order([colIdx, 'asc']).draw();
        });

        csvTableElement.on('click', '.sort-desc', function () {
            const dt = csvTableElement.DataTable();
            const colIdx = Number($(this).data('col'));
            dt.order([colIdx, 'desc']).draw();
        });
        csvTableElement.data('sortingButtonsBound', true);
    }
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
