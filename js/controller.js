(function() {

GDV.controller.initialize = async function() {
    const isStandalone = location.protocol === 'file:';
    if (isStandalone) {
        await initializeStandaloneMode();
    } else {
        await initializeHostedMode();
    }
}

GDV.controller.setActiveCsvFile = setActiveCsvFile;
function setActiveCsvFile(file) {
    GDV.state.setActiveCsvFile(file);
    GDV.dom.setActiveCsvFile(file);
}

GDV.controller.updateColumnDetails = updateColumnDetails;
function updateColumnDetails(columnDetails, fileName, description) {
    GDV.state.updateColumnDetails(columnDetails, fileName);
    GDV.dom.updateColumnDetails(description);
}

GDV.controller.updateTagFullPatterns = updateTagFullPatterns;
function updateTagFullPatterns(tagFullPatterns, fileName) {
    GDV.state.updateTagFullPatterns(tagFullPatterns);
    GDV.dom.updateTagFullPatterns(fileName);
}

GDV.controller.updateColumnCategories = updateColumnCategories;
function updateColumnCategories(tagFullPatterns, fileName) {
    GDV.state.updateColumnCategories(tagFullPatterns);
    GDV.dom.updateColumnCategories(fileName);
}

GDV.controller.updateThumbnails = updateThumbnails;
function updateThumbnails(thumbnails, fileName) {
    GDV.state.updateThumbnails(thumbnails);
    GDV.dom.updateThumbnails(fileName);
}

GDV.controller.updateGameFolder = updateGameFolder;
async function updateGameFolder(gamesFolderHandle) {
    GDV.state.setGamesFolderHandle(gamesFolderHandle)
    const extraFolder = await gamesFolderHandle.getDirectoryHandle('ZZZ_TOOL_FILES');
    const localWebFolder = await extraFolder.getDirectoryHandle('game-data-viewer');
    dataFolderHandle = await localWebFolder.getDirectoryHandle('data');

    if (!dataFolderHandle) {
        GDV.utils.reportHardError('Invalid Folder Structure', "The 'data' folder was not found inside the selected folder.", null, { gamesFolderHandle } );
        return false;
    }
    GDV.state.setDataFolderHandle(gamesFolderHandle)
    GDV.dom.updateGameFolder(gamesFolderHandle.name);
}

GDV.controller.loadAndSearchCsv = async function(file) {
    if (!file) {
        GDV.utils.reportHardWarning('No File Provided', 'No file was provided to load.');
        return;
    }

    if (!file.name || !file.name.toLowerCase().endsWith('.csv')) {
        GDV.utils.reportHardWarning('Invalid File Type', 'Invalid file. Please provide a CSV file.');
        return;
    }

    setActiveCsvFile(file);
    await GDV.csvHandler.showPrefiltersForCsvSearch(file);
}

GDV.controller.loadColumnDetailsFile = async function(file) {
    if (!file) {
        GDV.utils.reportHardWarning('No File Provided', 'No file was provided to load.');
        return;
    }
    if (!file.name || !file.name.toLowerCase().endsWith('.json')) {
        GDV.utils.reportHardWarning('Invalid File Type', 'Invalid file. Please provide a JSON file.');
        return;
    }
    try {
        const text = await file.text();
        updateColumnDetails(JSON.parse(text), file.name, "Loaded from " + file.name);
    } catch (err) {
        GDV.utils.reportHardError('Column Details Load Failed', 'Error loading column details JSON', err,  { file } );
        updateColumnDetails({}, null, null);
    }
}

GDV.controller.selectGamesFolderAndLoadData = async function() {
    const folderSelected = await selectGamesFolder();
    if (!folderSelected) return; // user canceled, fail gracefully

    await loadFilesFromDataFolder();
}

async function initializeCommonSteps() {
    // loadAndUpdateTheme();
    GDV.dom.insertHelpNotice()
}

async function initializeStandaloneMode() {
    initializeCommonSteps();
    GDV.dom.setControPanelGridAsVisible();
}

async function initializeHostedMode() {
    initializeCommonSteps();
    await GDV.loading.updateLoadingDirectUpdate("Initializing…", 0);
    await GDV.loading.startLoading("var(--green)");
    await loadDefaultColumnDetailsJson("Loading column details…", 5, 10);
    await loadDefaultTagFullPatternsJson("Loading tag definitions…", 10, 15);
    await loadDefaultColumnCategoriesJson("Loading column categories…", 15, 20);
    await loadDefaultCsv("Loading database records…", 20, 70);
    await loadKeysFromCsv("Loading keys from records…", 70, 80);
    await loadDefaultThumbnailsJson("Linking thumbnails…", 80, 99);
    await GDV.loading.updateLoadingDirectUpdate("Initialization complete.", 100);
    await GDV.loading.finishLoading();
    await applyUrlPrefiltersOrPrompt();
}

async function loadFilesFromDataFolder() {
    if (!dataFolderHandle) {
        GDV.utils.reportSilentWarning('No Games Folder', 'No games folder selected. Cannot load files.');
        return;
    }

    try {
        await GDV.loading.startLoading("var(--green)");
        await GDV.loading.updateLoadingDirectUpdate("Initializing…", 0);
        await GDV.loading.updateLoadingDirectUpdate("Loading column details…", 5);
        await loadColumnDetailsFromLocalDataFolder();
        await GDV.loading.updateLoadingDirectUpdate("Loading tag definitions…", 10);
        await loadTagFullPatternsFromLocalDataFolder();
        await GDV.loading.updateLoadingDirectUpdate("Loading column categories…", 15);
        await loadColumnCategoriesFromLocalDataFolder();
        await GDV.loading.updateLoadingDirectUpdate("Loading database records…", 20);
        await loadCsvFromLocalDataFolder();
        await loadKeysFromCsv("Loading keys from records…", 70, 80);
        await GDV.loading.updateLoadingDirectUpdate("Linking thumbnails…", 80);
        await loadThumbnailsFromLocalDataFolder();
        await GDV.loading.updateLoadingDirectUpdate("Initialization complete.", 100);
        await GDV.loading.finishLoading();
        await applyUrlPrefiltersOrPrompt();
    } catch (err) {
        GDV.utils.reportHardError('Data Folder Load Failed', 'An unexpected error occurred while loading files from the data folder.', err, { dataFolderHandle });
        await GDV.loading.finishLoading();
    }
}

async function applyUrlPrefiltersOrPrompt() {
    prefiltersFromUrl = GDV.prefilter.getPrefiltersInUrl();
    if (prefiltersFromUrl && Object.keys(prefiltersFromUrl).length) {
        GDV.state.setPrefiltersToUse(prefiltersFromUrl);
        GDV.utils.showInfoBanner("URL Prefilters Detected", "Prefilters were found in the URL. Applying them now and performing the database search automatically.");
        await GDV.csvHandler.executeCsvSearch(GDV.state.getActiveCsvFile());
    } else {
        await GDV.csvHandler.showPrefiltersForCsvSearch(GDV.state.getActiveCsvFile());
    }
}

async function loadKeysFromCsv(label, startPercent, endPercent) {
    const file = GDV.state.getActiveCsvFile();
    GDV.state.setGameKeys(await GDV.csvHandler.extractKeysFromCsv(file, label, startPercent, endPercent));
}

async function loadDefaultCsv(label, startPercent, endPercent) {
    if (GDV.state.getActiveCsvFile()) {
        return; // already loaded
    }

    try {
        const response = await fetchWithProgress('data/game_data.csv', 67553270, label, startPercent, endPercent);
        if (!response.ok) {
            GDV.utils.reportHardError('CSV Load Failed', 'Failed to fetch the default CSV file from "data/game_data.csv".', new Error(`HTTP status: ${response.status}`) );
            return;
        }

        const blob = await response.blob();
        const file = new File([blob], 'game_data.csv', { type: 'text/csv' });
        setActiveCsvFile(file);
    } catch (err) {
        GDV.utils.reportHardError('CSV Load Failed', 'An unexpected error occurred while loading the default CSV.', err);
    }
}

async function loadDefaultColumnDetailsJson(label, startPercent, endPercent) {
    if (GDV.state.hasValidColumnDetails()) {
        return; // already loaded
    }

    try {
        const response = await fetchWithProgress('data/game_column_details.json', 173582, label, startPercent, endPercent);
        if (!response.ok) {
            GDV.utils.reportHardError('Column Details Load Failed', 'Failed to fetch the default column details JSON file.', new Error(`HTTP status: ${response.status}`), { url: 'data/game_column_details.json' });
            return;
        }

        const columnDetails = await response.json();
        updateColumnDetails(columnDetails, 'game_column_details.json', 'data/game_column_details.json');
    } catch (err) {
        GDV.utils.reportHardError('Column Details Load Failed', 'An unexpected error occurred while loading the default column details JSON.', err);
    }
}

async function loadDefaultTagFullPatternsJson(label, startPercent, endPercent) {
    try {
        const response = await fetchWithProgress('data/tag_full_patterns.json', 414698, label, startPercent, endPercent);
        if (!response.ok) {
            GDV.utils.reportHardError('Tag Patterns Load Failed', 'Failed to fetch the default tag full patterns JSON file.', new Error(`HTTP status: ${response.status}`), { url: 'data/tag_full_patterns.json' });
            return;
        }

        const tagFullPatterns = await response.json();
        updateTagFullPatterns(tagFullPatterns, 'data/tag_full_patterns.json');

    } catch (err) {
        GDV.utils.reportHardError('Tag Patterns Load Failed', 'An unexpected error occurred while loading the default tag full patterns JSON.', err);
    }
}

async function loadDefaultColumnCategoriesJson(label, startPercent, endPercent) {
    try {
        const response = await fetchWithProgress('data/game_column_categories.json', 11241, label, startPercent, endPercent);
        if (!response.ok) {
            GDV.utils.reportHardError('Column Categories Load Failed', 'Failed to fetch the default column categories JSON file.', new Error(`HTTP status: ${response.status}`), { url: 'data/game_column_categories.json' });
            return;
        }

        const columnCategories = await response.json();
        updateColumnCategories(columnCategories, 'data/game_column_categories.json');

    } catch (err) {
        GDV.utils.reportHardError('Column Categories Load Failed', 'An unexpected error occurred while loading the default column categories JSON.', err);
    }
}

async function loadDefaultThumbnailsJson(label, startPercent, endPercent) {
    try {
        const response = await fetchWithProgress('data/game_thumbnails.json', 17634141, label, startPercent, endPercent);
        if (!response.ok) {
            GDV.utils.reportHardError('Thumbnails Load Failed', 'Failed to fetch the default thumbnails JSON file.', new Error(`HTTP status: ${response.status}`), { url: 'data/game_thumbnails.json' });
            return;
        }

        const thumbnails = await response.json();
        updateThumbnails(thumbnails, 'data/game_thumbnails.json');

    } catch (err) {
        GDV.utils.reportHardError('Thumbnails Load Failed', 'An unexpected error occurred while loading the default thumbnails JSON.', err);
    }
}

async function loadCsvFromLocalDataFolder() {
    if (!dataFolderHandle) return;
    const fileHandle = await dataFolderHandle.getFileHandle('game_data.csv').catch(() => null);
    if (!fileHandle) {
        GDV.utils.reportHardWarning('Missing CSV File', 'The file "game_data.csv" was not found in the selected games folder.');
        return;
    }

    const file = await fileHandle.getFile();
    setActiveCsvFile(file);
}

async function loadColumnDetailsFromLocalDataFolder() {
    if (!dataFolderHandle || GDV.state.hasValidColumnDetails()) return;
    const fileHandle = await dataFolderHandle.getFileHandle('game_column_details.json').catch(() => null);
    if (!fileHandle) {
        GDV.utils.reportHardWarning('Missing Column Details', 'The file "game_column_details.json" was not found in the selected games folder.');
        return;
    }

    try {
        const file = await fileHandle.getFile();
        const columnDetails = JSON.parse(await file.text());
        updateColumnDetails(columnDetails, file.name, 'data/game_column_details.json');
    } catch (err) {
        GDV.utils.reportHardError('Failed to Load Column Details',  `An error occurred while reading or parsing "${fileHandle.name}".`, err);
    }
}

async function loadTagFullPatternsFromLocalDataFolder() {
    if (!dataFolderHandle) return;
    const fileHandle = await dataFolderHandle.getFileHandle('tag_full_patterns.json').catch(() => null);
    if (!fileHandle) {
        GDV.utils.reportHardWarning('Missing Tag Patterns', 'The file "tag_full_patterns.json" was not found in the selected games folder.');
        return;
    }

    try {
        const file = await fileHandle.getFile();
        const tagFullPatterns = JSON.parse(await file.text());
        updateTagFullPatterns(tagFullPatterns, 'data/tag_full_patterns.json');
    } catch (err) {
        GDV.utils.reportHardError('Failed to Load Tag Patterns', `An error occurred while reading or parsing "${fileHandle.name}".`, err);
    }
}

async function loadColumnCategoriesFromLocalDataFolder() {
    if (!dataFolderHandle) return;
    const fileHandle = await dataFolderHandle.getFileHandle('game_column_categories.json').catch(() => null);
    if (!fileHandle) {
        GDV.utils.reportHardWarning('Missing Column Categories', 'The file "game_column_categories.json" was not found in the selected games folder.');
        return;
    }

    try {
        const file = await fileHandle.getFile();
        const columnCategories = JSON.parse(await file.text());
        updateColumnCategories(columnCategories, 'data/game_column_categories.json');
    } catch (err) {
        GDV.utils.reportHardError('Failed to Load Column Categories', `An error occurred while reading or parsing "${fileHandle.name}".`, err);
    }
}

async function loadThumbnailsFromLocalDataFolder() {
    if (!dataFolderHandle) return;
    const fileHandle = await dataFolderHandle.getFileHandle('game_thumbnails.json').catch(() => null);
    if (!fileHandle) {
        GDV.utils.reportHardWarning('Missing Thumbnails', 'The file "game_thumbnails.json" was not found in the selected games folder.');
        return;
    }

    try {
        const file = await fileHandle.getFile();
        const thumbnails = JSON.parse(await file.text());
        updateThumbnails(thumbnails, 'data/game_thumbnails.json');
    } catch (err) {
        GDV.utils.reportHardError('Failed to Load Thumbnails', `An error occurred while reading or parsing "${fileHandle.name}".`, err);
    }
}

async function fetchWithProgress(url, estimatedFileSize, label, startPercent, endPercent) {
    await GDV.loading.updateLoadingDirectUpdate(label, startPercent);

    const response = await fetch(url);
    if (!response.ok) return response;
    const reader = response.body?.getReader();
    if (!reader) return response;

    let loaded = 0;
    const stream = new ReadableStream({
        async start(controller) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                loaded += value.byteLength;
                const total = loaded < estimatedFileSize ? estimatedFileSize : loaded;
                await GDV.loading.updateLoadingStepProgress(label, startPercent, endPercent, loaded, total);
                controller.enqueue(value);
            }

            // Final log (one-line, for updating estimates)
            if (estimatedFileSize !== undefined && loaded !== estimatedFileSize) {
                console.warn(`[fetchWithProgress] File size mismatch for ${url} | actualLoaded=${loaded} | currentEstimate=${estimatedFileSize} | UPDATE_ESTIMATE_TO=${loaded}`);
            }

            await GDV.loading.updateLoadingDirectUpdate(label, endPercent);
            controller.close();
        }
    });

    return new Response(stream, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText
    });
}



function loadAndUpdateTheme() {
    // Load saved theme
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-theme');
    }
    updateThemeButton()
}

function updateThemeButton() {
    const isLight = document.body.classList.contains('light-theme');
    GDV.dom.updateThemeButton(isLight)
}

async function selectGamesFolder() {
    try {
        gamesFolderHandle = await window.showDirectoryPicker();
        await updateGameFolder(gamesFolderHandle);
        return true;
    } catch (err) {
        if (err?.name === 'AbortError') {
            GDV.utils.reportSilentWarning('Folder Selection Cancelled', 'The user closed the folder picker without selecting a folder.', err);
            return false;
        }

        GDV.utils.reportHardError('Folder Selection Failed', 'An unexpected error occurred while selecting the games folder.', err, { gamesFolderHandle });
        return false;
    }
}

})();