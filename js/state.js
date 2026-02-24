(() => {
	let activeCsvFile = null;
	let activeColumnDetails = {};
	let activeTagFullPatterns = {};
	let activeColumnCategories = {};
	let gamesFolderHandle = null;
	let dataFolderHandle = null;
	let gameKeys = null;
	let prefiltersToUse = {};
	let similarityGame = null;

	GDV.state.getActiveCsvFile = () => activeCsvFile;

	GDV.state.setActiveCsvFile = (file) => {
		activeCsvFile = file;
	};

	GDV.state.getActiveColumnDetails = () => activeColumnDetails;

	GDV.state.hasValidColumnDetails = () => activeColumnDetails && Object.keys(activeColumnDetails).length > 0;

	GDV.state.getTagFullPatterns = () => activeTagFullPatterns;

	GDV.state.getColumnCategories = () => activeColumnCategories;

	GDV.state.getThumbnails = () => activeThumbnails;

	GDV.state.updateColumnDetails = (columnDetails) => {
		activeColumnDetails = columnDetails;
	};

	GDV.state.updateTagFullPatterns = (tagFullPatterns) => {
		activeTagFullPatterns = tagFullPatterns;
	};

	GDV.state.updateColumnCategories = (columnCategories) => {
		activeColumnCategories = columnCategories;
	};

	GDV.state.updateThumbnails = (thumbnails) => {
		activeThumbnails = thumbnails;
	};

	GDV.state.getGamesFolderHandle = () => gamesFolderHandle;

	GDV.state.setGamesFolderHandle = (gamesFolderHandle_) => {
		gamesFolderHandle = gamesFolderHandle_;
	};

	GDV.state.getDataFolderHandle = () => dataFolderHandle;

	GDV.state.setDataFolderHandle = (dataFolderHandle_) => {
		dataFolderHandle = dataFolderHandle_;
	};

	GDV.state.getGameKeys = () => gameKeys;

	GDV.state.setGameKeys = (gameKeys_) => {
		gameKeys = gameKeys_;
	};

	GDV.state.getPrefiltersToUse = () => prefiltersToUse;

	GDV.state.setPrefiltersToUse = (prefilters) => {
		prefiltersToUse = prefilters;
	};

	GDV.state.getSimilarityGame = () => similarityGame;

	GDV.state.setSimilarityGame = (gameName) => {
		similarityGame = gameName || null;
	};

	GDV.state.resetSimilarityGame = () => {
		similarityGame = null;
	};
})();
