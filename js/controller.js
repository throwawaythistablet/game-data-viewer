(function() {

GDV.controller.initialize = async function() {
    const isStandalone = location.protocol === 'file:';
    if (isStandalone) {
        await initializeStandaloneMode();
    } else {
        await initializeHostedMode();
    }
}

GDV.controller.setActiveCsvFile = function(file) {
    GDV.state.setActiveCsvFile(file);
    GDV.dom.setActiveCsvFile(file);
}

GDV.controller.updateColumnDetails = function(columnDetails, fileName, description) {
    GDV.state.updateColumnDetails(columnDetails, fileName);
    GDV.dom.updateColumnDetails(description);
}

GDV.controller.updateTagFullPatterns = function(tagFullPatterns, fileName) {
    GDV.state.updateTagFullPatterns(tagFullPatterns);
    GDV.dom.updateTagFullPatterns(fileName);
}

GDV.controller.updateThumbnails = function(thumbnails, fileName) {
    GDV.state.updateThumbnails(thumbnails);
    GDV.dom.updateThumbnails(fileName);
}

GDV.controller.updateGameFolder = async function(gamesFolderHandle) {
    GDV.state.setGamesFolderHandle(gamesFolderHandle)
    const extraFolder = await gamesFolderHandle.getDirectoryHandle('ZZZ_EXTRA_FILES');
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

    GDV.controller.setActiveCsvFile(file);
    await GDV.csvHandler.executeCsvSearch(file);
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
        GDV.controller.updateColumnDetails(JSON.parse(text), file.name, "Loaded from " + file.name);
    } catch (err) {
        GDV.utils.reportHardError('Column Details Load Failed', 'Error loading column details JSON', err,  { file } );
        GDV.controller.updateColumnDetails({}, null, null);
    }
}

GDV.controller.selectGamesFolderAndLoadData = async function() {
    const folderSelected = await selectGamesFolder();
    if (!folderSelected) return; // user canceled, fail gracefully

    await loadFilesFromDataFolder();
}

async function initializeStandaloneMode() {
    loadAndUpdateTheme();
    GDV.dom.setControPanelGridAsVisible();
}

async function initializeHostedMode() {
    await GDV.loading.updateLoadingDirectUpdate("Preparing table structure…", 10);
    await GDV.loading.showLoading();
    await loadDefaultColumnDetailsJson();
    await GDV.loading.updateLoadingDirectUpdate("Loading tag definitions…", 30);
    await loadDefaultTagFullPatternsJson();
    await GDV.loading.updateLoadingDirectUpdate("Loading database records…", 40);
    await loadDefaultCsv();
    await GDV.loading.updateLoadingDirectUpdate("Linking thumbnails…", 90);
    await loadDefaultThumbnailsJson();
    await GDV.loading.updateLoadingDirectUpdate("Initialization complete.", 100);
    await GDV.loading.hideLoading();
    await GDV.csvHandler.executeCsvSearch(GDV.state.getActiveCsvFile());
}

async function loadDefaultCsv() {
    if (GDV.state.getActiveCsvFile()) {
        return; // already loaded
    }

    try {
        const response = await fetch('data/game_data.csv');
        if (!response.ok) {
            GDV.utils.reportHardError('CSV Load Failed', 'Failed to fetch the default CSV file from "data/game_data.csv".', new Error(`HTTP status: ${response.status}`) );
            return;
        }

        const blob = await response.blob();
        const file = new File([blob], 'game_data.csv', { type: 'text/csv' });
        GDV.controller.setActiveCsvFile(file);
    } catch (err) {
        GDV.utils.reportHardError('CSV Load Failed', 'An unexpected error occurred while loading the default CSV.', err);
    }
}

async function loadDefaultColumnDetailsJson() {
    if (GDV.state.hasValidColumnDetails()) {
        return; // already loaded
    }

    try {
        const response = await fetch('data/game_column_details.json');
        if (!response.ok) {
            GDV.utils.reportHardError('Column Details Load Failed', 'Failed to fetch the default column details JSON file.', new Error(`HTTP status: ${response.status}`), { url: 'data/game_column_details.json' });
            return;
        }

        const columnDetails = await response.json();
        GDV.controller.updateColumnDetails(columnDetails, 'game_column_details.json', 'data/game_column_details.json');
    } catch (err) {
        GDV.utils.reportHardError('Column Details Load Failed', 'An unexpected error occurred while loading the default column details JSON.', err);
    }
}


async function loadDefaultTagFullPatternsJson() {
    try {
        const response = await fetch('data/tag_full_patterns.json');

        if (!response.ok) {
            GDV.utils.reportHardError('Tag Patterns Load Failed', 'Failed to fetch the default tag full patterns JSON file.', new Error(`HTTP status: ${response.status}`), { url: 'data/tag_full_patterns.json' });
            return;
        }

        const tagFullPatterns = await response.json();
        GDV.controller.updateTagFullPatterns(tagFullPatterns, 'data/tag_full_patterns.json');

    } catch (err) {
        GDV.utils.reportHardError('Tag Patterns Load Failed', 'An unexpected error occurred while loading the default tag full patterns JSON.', err);
    }
}

async function loadDefaultThumbnailsJson() {
    try {
        const response = await fetch('data/game_thumbnails.json');

        if (!response.ok) {
            GDV.utils.reportHardError('Thumbnails Load Failed', 'Failed to fetch the default thumbnails JSON file.', new Error(`HTTP status: ${response.status}`), { url: 'data/game_thumbnails.json' });
            return;
        }

        const thumbnails = await response.json();
        GDV.controller.updateThumbnails(thumbnails, 'data/game_thumbnails.json');

    } catch (err) {
        GDV.utils.reportHardError('Thumbnails Load Failed', 'An unexpected error occurred while loading the default thumbnails JSON.', err);
    }
}


async function loadFilesFromDataFolder() {
    if (!dataFolderHandle) {
        GDV.utils.reportSilentWarning('No Games Folder', 'No games folder selected. Cannot load files.');
        return;
    }

    try {
        await GDV.loading.updateLoadingDirectUpdate("Preparing table structure…", 10);
        await GDV.loading.showLoading();

        await loadColumnDetailsFromLocalDataFolder();
        await GDV.loading.updateLoadingDirectUpdate("Loading tag definitions…", 30);

        await loadTagFullPatternsFromLocalDataFolder();
        await GDV.loading.updateLoadingDirectUpdate("Loading database records…", 40);

        await loadCsvFromLocalDataFolder();
        await GDV.loading.updateLoadingDirectUpdate("Linking thumbnails…", 90);

        await loadThumbnailsFromLocalDataFolder();
        await GDV.loading.updateLoadingDirectUpdate("Initialization complete.", 100);

        await GDV.loading.hideLoading();
        await GDV.csvHandler.executeCsvSearch(GDV.state.getActiveCsvFile());

    } catch (err) {
        GDV.utils.reportHardError('Data Folder Load Failed', 'An unexpected error occurred while loading files from the data folder.', err, { dataFolderHandle });
        await GDV.loading.hideLoading();
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
    GDV.controller.setActiveCsvFile(file);
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
        GDV.controller.updateColumnDetails(columnDetails, file.name, 'data/game_column_details.json');
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
        GDV.controller.updateTagFullPatterns(tagFullPatterns, 'data/tag_full_patterns.json');
    } catch (err) {
        GDV.utils.reportHardError('Failed to Load Tag Patterns', `An error occurred while reading or parsing "${fileHandle.name}".`, err);
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
        GDV.controller.updateThumbnails(thumbnails, 'data/game_thumbnails.json');
    } catch (err) {
        GDV.utils.reportHardError('Failed to Load Thumbnails', `An error occurred while reading or parsing "${fileHandle.name}".`, err);
    }
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
        await GDV.controller.updateGameFolder(gamesFolderHandle);
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