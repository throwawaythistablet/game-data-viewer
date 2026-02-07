(function() {
    
let activeCsvFile = null;
let activeColumnDetails = {};
let activeTagFullPatterns = {};
let activeColumnCategories = {};
let gamesFolderHandle = null;
let dataFolderHandle = null;
let prefilterFileName = null;
let lastSearchedPrefilters = {};


GDV.state.getActiveCsvFile = function() {
    return activeCsvFile;
}

GDV.state.setActiveCsvFile = function(file) {
    activeCsvFile = file;
}

GDV.state.getActiveColumnDetails = function() {
    return activeColumnDetails;
}

GDV.state.hasValidColumnDetails = function() {
    return activeColumnDetails && Object.keys(activeColumnDetails).length > 0
}

GDV.state.getTagFullPatterns = function () {
    return activeTagFullPatterns;
}

GDV.state.getColumnCategories = function () {
    return activeColumnCategories;
}

GDV.state.getThumbnails = function () {
    return activeThumbnails;
}

GDV.state.updateColumnDetails = function(columnDetails, fileName) {
    activeColumnDetails = columnDetails;
    prefilterFileName = fileName;
}

GDV.state.updateTagFullPatterns = function(tagFullPatterns) {
    activeTagFullPatterns = tagFullPatterns;
}

GDV.state.updateColumnCategories = function(columnCategories) {
    activeColumnCategories = columnCategories;
}

GDV.state.updateThumbnails = function(thumbnails) {
    activeThumbnails = thumbnails;
}

GDV.state.getGamesFolderHandle = function() {
    return gamesFolderHandle;
}

GDV.state.setGamesFolderHandle = function(gamesFolderHandle_) {
    gamesFolderHandle = gamesFolderHandle_;
}

GDV.state.getDataFolderHandle = function() {
    return dataFolderHandle;
}

GDV.state.setDataFolderHandle = function(dataFolderHandle_) {
    dataFolderHandle = dataFolderHandle_;
}

GDV.state.getLastSearchedPrefilters = function() {
    return lastSearchedPrefilters;
}

GDV.state.setLastSearchedPrefilters = function(prefilters) {
    lastSearchedPrefilters = prefilters;
}

})();