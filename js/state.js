(() => {
	let activeCsvFile = null;
	let activeColumnDetails = {};
	let activeColumnCategories = {};
	let activeTagQuickSearchPatterns = {};
	let gamesFolderHandle = null;
	let dataFolderHandle = null;
	let activeGameKeys = null;
	let prefilterConditions = {};
	let prefilterAst = null;
	let similarityGame = null;

	GDV.state.getActiveCsvFile = () => activeCsvFile;

	GDV.state.setActiveCsvFile = (file) => {
		activeCsvFile = file;
	};

	GDV.state.getActiveColumnDetails = () => activeColumnDetails;

	GDV.state.hasValidColumnDetails = () => activeColumnDetails && Object.keys(activeColumnDetails).length > 0;

	GDV.state.getGameKeys = () => activeGameKeys;

	GDV.state.getColumnCategories = () => activeColumnCategories;

	GDV.state.getTagQuickSearchPatterns = () => activeTagQuickSearchPatterns;

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

	GDV.state.setTagQuickSearchPatterns = (tagQuickSearchPatterns) => {
		activeTagQuickSearchPatterns = tagQuickSearchPatterns;
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

	GDV.state.getPrefilterConditions = () => prefilterConditions;

	GDV.state.setPrefilterConditions = (prefilterConditions_) => {
		prefilterConditions = prefilterConditions_;
	};

	GDV.state.getPrefilterAst = () => prefilterAst;

	GDV.state.setPrefilterAst = (prefilterAst_) => {
		prefilterAst = prefilterAst_;
	};

	GDV.state.getSimilarityGame = () => similarityGame;

	GDV.state.setSimilarityGame = (gameName) => {
		similarityGame = gameName || null;
	};

	GDV.state.resetSimilarityGame = () => {
		similarityGame = null;
	};
})();
