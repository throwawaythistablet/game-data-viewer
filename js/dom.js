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
const columnCategories = document.getElementById('columnCategories');
const thumbnailsDisplay = document.getElementById('thumbnailsDisplay');
const gamesFolderDisplay = document.getElementById('gamesFolderDisplay');
const csvDropZone = document.getElementById('csvDropZone');

let controlsPanelGridPinned = false;

GDV.dom.insertHelpNotice = function() {
    const btnGroup = document.getElementById('controlsButtonGroup');
    if (btnGroup) {
        btnGroup.insertAdjacentElement('afterend', GDV.helpNotice.createHelpNotice());
    }
};

GDV.dom.setControPanelGridAsVisible = function() {
    controlsPanelGrid.style.display = 'grid';
}

GDV.dom.setControPanelGridAsInvisible = function() {
    controlsPanelGrid.style.display = 'none';
}

GDV.dom.getCsvTableElement = function() {
    return csvTableElement;
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

GDV.dom.updateColumnCategories = function(fileName) {
    columnCategories.textContent = fileName || '(None)';
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

GDV.dom.showInfoBanner = (label, message, timeout) => GDV.dom.showBanner('info', label, message, timeout);

GDV.dom.showWarningBanner = (label, message, timeout) => GDV.dom.showBanner('warning', label, message, timeout);

GDV.dom.showErrorBanner = (label, message, timeout) => GDV.dom.showBanner('error', label, message, timeout);

GDV.dom.showBanner = function(type, label, message, timeout = 10000) {
    const banner = document.createElement('div');
    banner.className = `log-banner ${type}`;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'banner-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => hideBanner(banner));
    banner.appendChild(closeBtn);

    // Label
    const labelDiv = document.createElement('div');
    labelDiv.className = 'banner-label';
    labelDiv.textContent = label;
    banner.appendChild(labelDiv);

    // Message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'banner-message';
    messageDiv.textContent = message;
    banner.appendChild(messageDiv);

    document.body.appendChild(banner);

    // Show animation
    requestAnimationFrame(() => banner.classList.add('show'));

    // Auto-hide
    if (timeout > 0) {
        setTimeout(() => hideBanner(banner), timeout);
    }

    function hideBanner(el) {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300); // match CSS transition
    }
};

GDV.dom.renderMainPagePrefiltersPanel = function() {
    const marker = document.getElementById('mainPrefiltersPanelSection');
    if (!marker) return;

    while (marker.firstChild) marker.removeChild(marker.firstChild);

    const lastSearchedPrefilters = GDV.state.getPrefiltersToUse();
    const similarityGame = GDV.state.getSimilarityGame();
    if (!lastSearchedPrefilters || Object.keys(lastSearchedPrefilters).length === 0) return;

    const container = document.createElement('div');
    container.id = 'mainPrefiltersPanel';
    container.className = 'prefilter-main-panel';
    marker.appendChild(container);
    container.appendChild(createShareUrlButton());

    if (similarityGame){
        const similarGamelabel = document.createElement('span');
        similarGamelabel.className = 'prefilter-main-panel-label';
        similarGamelabel.textContent = 'Similarity Score compared with:';
        container.appendChild(similarGamelabel);

        const similarGameValue = document.createElement('span');
        similarGameValue.className = 'prefilter-active-item';
        similarGameValue.title = similarityGame;
        similarGameValue.textContent = similarityGame;
        container.appendChild(similarGameValue);
    }

    const prefilterlabel = document.createElement('span');
    prefilterlabel.className = 'prefilter-main-panel-label';
    prefilterlabel.textContent = 'Last Searched Prefilters:';
    container.appendChild(prefilterlabel);

    for (const [col, val] of Object.entries(lastSearchedPrefilters)) {
        const text = GDV.prefilter.getPrefilterDisplayText(col, val);
        if (!text) continue;

        const span = document.createElement('span');
        span.className = 'prefilter-active-item';
        span.title = GDV.datatable.getColumnDescription(col);
        span.textContent = text;
        container.appendChild(span);
    }
}

GDV.dom.createHighlightFromValue = function(val, colName) {
    const num = parseFloat(val);
    if (isNaN(num)) return document.createTextNode(val);

    const { min, max } = GDV.state.getActiveColumnDetails()[colName] || {};
    const intensity = (max === min) ? 0 : Math.max(0, Math.min(1, (num - min) / (max - min)));
    const isLightMode = document.body.classList.contains('light-theme');

    let low, high;
    if (isLightMode) {
        low  = { h: 0,   s: 70, l: 80 };  // light red
        high = { h: 120, s: 70, l: 80 };  // light green (readable on black)
    } else {
        low  = { h: 0,   s: 70, l: 20 };  // dark red
        high = { h: 120, s: 70, l: 20 };  // dark green (readable on white)
    }

    const hue = Math.round(low.h + (high.h - low.h) * intensity);
    const saturation = Math.round(low.s + (high.s - low.s) * intensity);
    const lightness = Math.round(low.l + (high.l - low.l) * intensity);
    const bgColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const textColor = isLightMode ? '#000000' : '#ffffff';
    const weightClass = intensity > 0.7 ? 'high' : intensity > 0.4 ? 'medium' : 'low';

    const span = document.createElement('span');
    span.className = `highlight-cell ${weightClass}`;
    span.style.backgroundColor = bgColor;
    span.style.color = textColor;
    span.textContent = val;

    return span;
}

GDV.dom.createHighlightFromSentiment = function(text) {
    if (!text) return document.createTextNode('');

    const span = document.createElement('span');
    const weightClass = (text === '1. Very Positive') ? 'high' : (text === '9. Very Negative') ? 'low' : 'medium';
    span.className = `highlight-cell ${weightClass}`;

    const isLightMode = document.body.classList.contains('light-theme');

    const lightMap = {
        '1. Very Positive': '#006400',
        '2. Positive':      '#2E8B57',
        '3. Mildly Positive':'#7FBF7F',
        '4. Neutral':       '#808080',
        '5. Mixed':         '#B8860B',
        '6. No Data':       '#a0a0a0',
        '7. Mildly Negative':'#F2A0A0',
        '8. Negative':      '#D9534F',
        '9. Very Negative': '#8B0000'
    };

    const darkMap = {
        '1. Very Positive': '#66FF66',
        '2. Positive':      '#4CFF4C',
        '3. Mildly Positive':'#B3FFB3',
        '4. Neutral':       '#aaaaaa',
        '5. Mixed':         '#FFD166',
        '6. No Data':       '#888888',
        '7. Mildly Negative':'#FFB3B3',
        '8. Negative':      '#FF6B6B',
        '9. Very Negative': '#FF3333'
    };

    const map = isLightMode ? lightMap : darkMap;
    const color = map[text];

    if (color) {
        span.style.color = color;
    }
    span.textContent = text;

    return span;
}

GDV.dom.createHighlightFromStatus = function(text) {
    if (!text) return document.createTextNode('');

    const span = document.createElement('span');
    const weightClass = (text === 'Completed') ? 'high' : (text === 'Abandoned') ? 'low' : 'medium';
    span.className = `highlight-cell ${weightClass}`;

    const isLightMode = document.body.classList.contains('light-theme');

    const lightMap = {
        'Completed': '#006400',
        'Onhold':    '#808080',
        'Ongoing':   '#B8860B',
        'Abandoned': '#8B0000'
    };

    const darkMap = {
        'Completed': '#66FF66',
        'Onhold':    '#aaaaaa',
        'Ongoing':   '#FFD166',
        'Abandoned': '#FF3333'
    };

    const map = isLightMode ? lightMap : darkMap;
    const color = map[text];

    if (color) {
        span.style.color = color;
    }
    span.textContent = text;

    return span;
}

GDV.dom.updateThemeButton = updateThemeButton;
function updateThemeButton(isLight) {
    themeToggleButton.textContent = isLight ? '🌞 Light' : '🌙 Dark';
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

function createShareUrlButton() {
    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn';
    shareBtn.textContent = 'Copy Shareable URL';

    shareBtn.addEventListener('click', async () => {
        try {
            const encoded = GDV.urlParameters.encodeDataAsUrlParameters(GDV.state.getPrefiltersToUse(), GDV.state.getSimilarityGame());
            if (!encoded) {
                GDV.utils.reportSilentWarning("URL Encoding Failed", "Unable to encode prefilters for sharing." );
                return;
            }

            const baseUrl = "https://throwawaythistablet.github.io/game-data-viewer/"
            const shareUrl = `${baseUrl}?${encoded}`;
            await navigator.clipboard.writeText(shareUrl);
            GDV.utils.showInfoBanner("Shareable URL Copied", "The encoded prefilter URL has been copied to your clipboard.");

        } catch (err) {
            GDV.utils.reportSilentWarning("Clipboard Copy Failed", "Failed to copy the shareable URL to the clipboard.", err);
        }
    });
    return shareBtn;
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

    await GDV.csvHandler.showPrefiltersForCsvSearch(GDV.state.getActiveCsvFile());
});

// Reset filters button
resetFiltersButton.addEventListener('click', async () => {
    await GDV.datatable.resetAllFilters();
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
    updateThemeButton(isLight);
});

controlsPanelGrid.parentElement.addEventListener('mouseenter', () => setControPanelGridState(true));
controlsPanelGrid.parentElement.addEventListener('mouseleave', () => setControPanelGridState(false));

// Select CSV File
fileButton.addEventListener('click', () => fileInput.click());
fileButton.setAttribute('aria-label', 'Select CSV File');
fileInput.style.display = 'none'; // Make sure input is hidden
fileInput.addEventListener('change', async (e) => { 
    if (e.target.files.length) {
        await GDV.controller.loadAndSearchCsv(e.target.files[0]); 
    }
});

// Column Details JSON File
columnDetailsFileButton.addEventListener('click', () => columnDetailsFileInput.click());
columnDetailsFileButton.setAttribute('aria-label', 'Load Column Details JSON'); 
columnDetailsFileInput.style.display = 'none'; // Make sure input is hidden
columnDetailsFileInput.addEventListener('change', async (e) => {
    if (e.target.files.length) {
        await GDV.controller.loadColumnDetailsFile(e.target.files[0]);
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

})();