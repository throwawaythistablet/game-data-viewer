

async function executeCsvSearchWithRetries() {
    while (true) {
        try {
            const success = await executeCsvSearch(getActiveCsvFile());
            if (success) return true; // search finished successfully

        } catch (err) {
            console.error('CSV search failed:', err);
            alert(`Error: ${err.message || 'Unknown error'}\nFailed to search CSV: ${getActiveCsvFile()?.name || 'unknown file'}`);
            break; // stop the loop on exception
        }

        // Optional small delay (if loop continues in future)
        await new Promise(r => setTimeout(r, 100));
    }
}

async function executeCsvSearch(file) {
    if (!file) return false;

    try {
        const collectedPrefilters =
            hasValidColumnDetails()
                ? await showPrefilterOverlayAndCollectFilters(getActiveColumnDetails())
                : {};

        await updateLoadingProgress("Starting Data Search...", 0, 0, 0, 1);
        resetLoadingCancellation();
        showLoading();

        await loadCsvAndBuildTable({ file, totalSize: file.size, preFilters: collectedPrefilters });

        return true;
    } catch (err) {
        console.error('executeCsvSearch failed:', err);
        alert(`Error: ${err.message || 'Unknown error'}\nFailed to search CSV`);
        return false;
    } finally {
        hideLoading();
        resetLoadingCancellation();
        await updateLoadingProgress("", 0, 0, 0, 1);
    }
}

async function loadCsvAndBuildTable({ file, totalSize, preFilters }) {
    const parsedData = await parseAndFilterCsv(file, totalSize, preFilters);

    if (!Array.isArray(parsedData) || parsedData.length === 0) {
        throw new Error('No rows loaded');
    }

    determineColumnDetailsFromDataIfNeeded(parsedData)
    const columns = createTableColumns(parsedData);
    await renderCsvTable(parsedData, columns);
}

async function parseAndFilterCsv(file, totalSize, preFilters) {
    const parsedData = [];
    let rowsProcessed = 0;
    let bytesProcessed = 0;
    const THROTTLE = 100;
    const MAX_ROWS = 30000; // maximum rows to prevent memory overload

    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            worker: true,
            step: function (row) {
                if (isLoadingCancelled()) {
                    this.abort(); // stops PapaParse
                    reject(new Error('Loading cancelled by user.'));
                    return;
                }
                
                // Add row if passes preFilters
                if (!preFilters || Object.keys(preFilters).length === 0 || isRowAllowedByPrefilter(row.data, preFilters)) {
                    parsedData.push(row.data);
                }

                rowsProcessed++;
                bytesProcessed += new TextEncoder().encode(Object.values(row.data).join(',') + '\n').length;

                // Throttle progress updates
                if (rowsProcessed % THROTTLE === 0) {
                    updateLoadingProgress("Loading Data From File...", 0, 30, bytesProcessed, totalSize);
                }

                // Stop if max rows exceeded
                if (parsedData.length >= MAX_ROWS) {
                    this.abort();
                    // Reject the promise instead of throwing
                    reject(new Error(
                        `Too many items loaded (${MAX_ROWS}). Please use filters to reduce the number of items before loading.`
                    ));
                }
            },
            complete: function () {
                updateLoadingProgress("Loading Data From File Finished...", 0, 30, totalSize, totalSize);
                resolve(parsedData);
            },
            error: function (err) {
                reject(err); // Ensure rejection on any parsing error
            }
        });
    });
}

function isRowAllowedByPrefilter(row, preFilter) {
    if (!preFilter || Object.keys(preFilter).length === 0) return true;

    const normalize = v => (v == null ? '' : typeof v === 'string' ? v.trim() : v);

    return Object.entries(preFilter).every(([col, criterion]) => {
        const colDef = getActiveColumnDetails()[col];
        if (!colDef) return true;

        const rawVal = row[col];
        const val = normalize(rawVal);

        // Numeric
        if (colDef.type === 'int' || colDef.type === 'float') {
            const num = Number(val);
            if (Number.isNaN(num)) return true;
            if (criterion.min != null && num < criterion.min) return false;
            if (criterion.max != null && num > criterion.max) return false;
            if (Array.isArray(criterion.choices) && criterion.choices.length > 0) {
                if (!criterion.choices.includes(num)) return false;
            }
            return true;
        }

        // Tag (0/1)
        if (colDef.type === 'tag') {
            if (!Array.isArray(criterion.choices)) return true;
            return criterion.choices.includes(Number(val));
        }

        // Boolean
        if (colDef.type === 'bool') {
            if (!Array.isArray(criterion.choices)) return true;

            const rowBool = normalizeBool(val);
            if (rowBool === null) return true;

            return criterion.choices
                .map(normalizeBool)
                .includes(rowBool);
        }

        // Any type with choices
        if (Array.isArray(colDef.choices) && colDef.choices.length > 0) {
            if (!Array.isArray(criterion.choices)) return true;
            if (criterion.choices.length === 0) return false;
            let typedVal = val;
            if (colDef.type === 'int') typedVal = parseInt(val, 10);
            if (colDef.type === 'float') typedVal = parseFloat(val);
            if (colDef.type === 'bool') typedVal = normalizeBool(val);
            if (!criterion.choices.includes(typedVal)) return false;
            return true;
        }

        // Text search
        if (criterion.text && Array.isArray(criterion.text)) {
            const lowerVal = String(val).toLowerCase();
            return criterion.text.some(t => lowerVal.includes(String(t).toLowerCase()));
        }

        return true;
    });
}

// Normalize boolean values from strings/CSV/etc
function normalizeBool(val) {
    if (val === true || val === 'true' || val === 'True' || val === 1 || val === '1') return true;
    if (val === false || val === 'false' || val === 'False' || val === 0 || val === '0') return false;
    return null; // unknown / invalid
}
