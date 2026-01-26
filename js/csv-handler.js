
async function startCsvSearchUi() {
    startLoading();
    await updateLoadingDirectUpdate("Starting Data Search...", 0);
    hideMainPrefiltersPanelSection();
}

async function finishCsvSearchUi() {
    showMainPrefiltersPanelSection();
    finishLoading();
}

async function executeCsvSearch(file) {
    if (!file) return false;

    try {
        const collectedPrefilters =
            hasValidColumnDetails()
                ? await showPrefilterOverlayAndCollectFilters(getActiveColumnDetails())
                : {};

        // User clicked Cancel in overlay
        if (collectedPrefilters === null) {
            return false;
        }

        await startCsvSearchUi();
        await loadCsvAndBuildTable({ file, totalSize: file.size, preFilters: collectedPrefilters });
        
        return true;
    } catch (err) {
        reportHardError('CSV Search Failed', 'An error occurred while executing the CSV search.', err, { file } );
        return false;
    } finally {
        await finishCsvSearchUi();
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
                    updateLoadingStepProgress("Loading Data From File...", 0, 30, bytesProcessed, totalSize);
                }
            },
            complete: function () {
                updateLoadingDirectUpdate("Loading Data From File Finished...", 30);
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
