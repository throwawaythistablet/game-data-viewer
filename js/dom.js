(function() {

const csvTableElement = $('#csvTable');
const themeToggleButton = document.getElementById('themeToggleButton');
const discussionButton = document.getElementById('discussionButton');
const feedbackButton = document.getElementById('feedbackButton');
const tagPatternsButton = document.getElementById('tagPatternsButton');
const resetFiltersButton = document.getElementById('resetFiltersButton');
const searchButton = document.getElementById('searchButton');
const mainPrefiltersPanelSection = document.getElementById('mainPrefiltersPanelSection');
const controlsPanelGrid = document.querySelector('.controls-main-grid');
const fileButton = document.getElementById('fileButton');
const fileInput = document.getElementById('csvFile');
const columnDetailsFileButton = document.getElementById('columnDetailsFileButton');
const columnDetailsFileInput = document.getElementById('columnDetailsFileInput');
const selectGamesFolderButton = document.getElementById('selectGamesFolderButton')
const pinButton = document.getElementById('controlsPinButton');
const csvFileDisplay = document.getElementById('csvFileDisplay');
const columnDetailsDisplay = document.getElementById('columnDetailsDisplay');
const tagPatternsDisplay = document.getElementById('tagPatternsDisplay');
const thumbnailsDisplay = document.getElementById('thumbnailsDisplay');
const gamesFolderDisplay = document.getElementById('gamesFolderDisplay');
const csvDropZone = document.getElementById('csvDropZone');
const closeImageModal = document.getElementById('closeImageModal');
const localImagesOverlay = document.getElementById('localImagesOverlay');

let controlsPanelGridPinned = false;


GDV.dom.setControPanelGridAsVisible = function() {
    controlsPanelGrid.style.display = 'grid';
}

GDV.dom.setControPanelGridAsInvisible = function() {
    controlsPanelGrid.style.display = 'none';
}

GDV.dom.getCsvTableElement = function() {
    return csvTableElement;
}
GDV.dom.bindTableSortingButtons = function(dt) {
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

GDV.dom.updateThemeButton = function(isLight) {
    themeToggleButton.textContent = isLight ? '🌞 Light' : '🌙 Dark';
}

GDV.dom.setActiveCsvFile = function(file) {
    csvFileDisplay.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    csvFileDisplay.title = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
}

GDV.dom.updateColumnDetails = function(description) {
    columnDetailsDisplay.textContent = description || '(None)';
}

GDV.dom.updateTagFullPatterns = function(fileName) {
    tagPatternsDisplay.textContent = fileName || '(None)';
}

GDV.dom.updateThumbnails = function(fileName) {
    thumbnailsDisplay.textContent = fileName || '(None)';
}

GDV.dom.updateGameFolder = function(gamesFolderName) {
    gamesFolderDisplay.textContent = gamesFolderName || '(None)';
}

GDV.dom.hideMainPrefiltersPanelSection = function() {
    mainPrefiltersPanelSection.style.display = 'none';
}

GDV.dom.showMainPrefiltersPanelSection = function() {
    mainPrefiltersPanelSection.style.display = '';
}

function setControPanelGridState(expanded) {
    if (expanded) {
        controlsPanelGrid.classList.add('is-expanded');
        controlsPanelGrid.classList.remove('is-collapsed');
    } else if (!controlsPanelGridPinned && GDV.state.getActiveCsvFile()) {
        controlsPanelGrid.classList.remove('is-expanded');
        controlsPanelGrid.classList.add('is-collapsed');
    }
}

// Search button
searchButton.addEventListener('click', async () => {
    if (!GDV.state.getActiveCsvFile()) {
        GDV.utils.reportHardWarning('CSV Not Loaded', 'No CSV file has been loaded yet.' );
        return;
    }

    if (!GDV.state.hasValidColumnDetails()) {
        GDV.utils.reportHardWarning('Column Details Missing', 'No column details JSON has been loaded yet.' );
        return;
    }

    await GDV.csvHandler.executeCsvSearch(GDV.state.getActiveCsvFile());
});

// Reset filters button
resetFiltersButton.addEventListener('click', () => {
    GDV.datatable.resetAllFilters();
});

// Discussion button
discussionButton.addEventListener('click', () => {
    window.open('https://f95zone.to/threads/cant-find-the-game-youre-looking-for-try-this.284593/', '_blank', 'noopener,noreferrer');
});

// Feedback button
feedbackButton.addEventListener('click', () => {
    window.open('https://docs.google.com/forms/d/e/1FAIpQLSevpNoZzTm6fDrWfT_3Sb4RsA8btJTFxhJByBBf9e_cw0UOEQ/viewform?usp=dialog', '_blank', 'noopener,noreferrer');
});

// Tag Patterns button
tagPatternsButton.addEventListener('click', () => {
    window.open('tags/tag_patterns.json', '_blank', 'noopener,noreferrer');
});

// Theme toggle button
themeToggleButton.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeButton();
});

controlsPanelGrid.parentElement.addEventListener('mouseenter', () => setControPanelGridState(true));
controlsPanelGrid.parentElement.addEventListener('mouseleave', () => setControPanelGridState(false));

// Select File
fileButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => { 
    if (e.target.files.length) {
        await GDV.controller.loadAndSearchCsv(e.target.files[0]); 
    }
});

// Column Details File
columnDetailsFileButton.addEventListener('click', () => columnDetailsFileInput.click());
columnDetailsFileInput.addEventListener('change', async (e) => {
    if (e.target.files.length) {
        await GDV.controller.loadColumnDetailsFile(e.target.files[0])
    }
});

// Select Games Folder
selectGamesFolderButton.addEventListener('click', async () => {
    await GDV.controller.selectGamesFolderAndLoadData();
});

// Pin button
pinButton.addEventListener('click', () => {
    controlsPanelGridPinned = !controlsPanelGridPinned;
    pinButton.classList.toggle('is-active', controlsPanelGridPinned);
    setControPanelGridState(true); // always expand when pin toggled
});

// Drag & drop
csvDropZone.addEventListener('dragover', e => {
    e.preventDefault();
    csvDropZone.classList.add('dragover');
});


csvDropZone.addEventListener('dragleave', () => {
    csvDropZone.classList.remove('dragover');
});

csvDropZone.addEventListener('drop', e => {
    e.preventDefault();
    csvDropZone.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
        GDV.controller.loadAndSearchCsv(file);
    } else {
        GDV.utils.reportHardWarning('Invalid File Drop', 'Please drop a valid CSV file.');
    }
});

// View images
csvTableElement.on('click', '.view-images', function () {
    GDV.localImageViewer.openImagesForRow(this);
});

// Close handlers
closeImageModal.onclick = GDV.localImageViewer.closeImageModalHandler;

localImagesOverlay.onclick = () => localImagesOverlay.style.display = 'none';

})();