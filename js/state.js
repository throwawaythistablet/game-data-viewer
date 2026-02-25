(() => {
	let activeCsvFile = null;
	let activeColumnDetails = {};
	let activeColumnCategories = {};
	let activeTagFullPatterns = {};
	let gamesFolderHandle = null;
	let dataFolderHandle = null;
	let activeGameKeys = null;
	let prefiltersToUse = {};
	let similarityGame = null;

	GDV.state.getActiveCsvFile = () => activeCsvFile;

	GDV.state.setActiveCsvFile = (file) => {
		activeCsvFile = file;
	};

	GDV.state.getActiveColumnDetails = () => activeColumnDetails;

	GDV.state.hasValidColumnDetails = () => activeColumnDetails && Object.keys(activeColumnDetails).length > 0;

	GDV.state.getGameKeys = () => activeGameKeys;

	GDV.state.getColumnCategories = () => activeColumnCategories;

	GDV.state.getTagFullPatterns = () => activeTagFullPatterns;

	GDV.state.getThumbnails = () => activeThumbnails;

	GDV.state.setColumnDetails = (columnDetails) => {
		activeColumnDetails = columnDetails;
	};

	GDV.state.setGameKeys = (gameKeys) => {
		activeGameKeys = gameKeys;
	};

	GDV.state.setColumnCategories = (columnCategories) => {
		activeColumnCategories = columnCategories;
	};

	GDV.state.setTagFullPatterns = (tagFullPatterns) => {
		activeTagFullPatterns = tagFullPatterns;
	};

	GDV.state.setThumbnails = (thumbnails) => {
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
