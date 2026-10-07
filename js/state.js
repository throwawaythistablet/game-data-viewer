(() => {
	let activeCsvFile = null;
	let activeColumnDetails = {};
	let activeColumnCategoryDetails = {};
	let activeColumnToCategories = {};
	let activeTagFullMatchPatterns = {};
	let activeTagQuickSearchPatterns = {};
	let gamesFolderHandle = null;
	let dataFolderHandle = null;
	let activeGameKeys = null;
	let prefilterConditions = {};
	let prefilterAst = null;
	let columnsToDisplay = null;
	let similarityReferenceGame = null;
	let similarityComparisonScope = null;

	GDV.state.getActiveCsvFile = () => activeCsvFile;

	GDV.state.setActiveCsvFile = (file) => {
		activeCsvFile = file;
	};

	GDV.state.getActiveColumnDetails = () => activeColumnDetails;

	GDV.state.hasValidColumnDetails = () => activeColumnDetails && Object.keys(activeColumnDetails).length > 0;

	GDV.state.getGameKeys = () => activeGameKeys;

	GDV.state.getColumnCategoryDetails = () => activeColumnCategoryDetails;

	GDV.state.getColumnToCategories = () => activeColumnToCategories;

	GDV.state.getTagFullMatchPatterns = () => activeTagFullMatchPatterns;

	GDV.state.getTagQuickSearchPatterns = () => activeTagQuickSearchPatterns;

	GDV.state.getThumbnails = () => activeThumbnails;

	GDV.state.setColumnDetails = (columnDetails) => {
		activeColumnDetails = columnDetails;
	};

	GDV.state.setGameKeys = (gameKeys) => {
		activeGameKeys = gameKeys;
	};

	GDV.state.setColumnCategoryDetails = (columnCategoryDetails) => {
		activeColumnCategoryDetails = columnCategoryDetails;
	};

	GDV.state.setColumnToCategories = (columnToCategories) => {
		activeColumnToCategories = columnToCategories;
	};

	GDV.state.setTagFullMatchPatterns = (tagFullMatchPatterns) => {
		activeTagFullMatchPatterns = tagFullMatchPatterns;
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

	GDV.state.getColumnsToDisplay = () => columnsToDisplay;

	GDV.state.setColumnsToDisplay = (columnsToDisplay_) => {
		columnsToDisplay = columnsToDisplay_;
	};

	GDV.state.getSimilarityCriteria = () => {
		if (!similarityReferenceGame && !similarityComparisonScope) {
			return null;
		}
		return { referenceGame: similarityReferenceGame, comparisonScope: similarityComparisonScope };
	};

	GDV.state.resetSimilarityCriteria = () => {
		similarityReferenceGame = null;
		similarityComparisonScope = null;
	};

	GDV.state.getSimilarityReferenceGame = () => similarityReferenceGame;

	GDV.state.setSimilarityReferenceGame = (similarityReferenceGame_) => {
		similarityReferenceGame = similarityReferenceGame_ || null;
	};

	GDV.state.resetSimilarityReferenceGame = () => {
		similarityReferenceGame = null;
	};

	GDV.state.getSimilarityComparisonScope = () => similarityComparisonScope;

	GDV.state.setSimilarityComparisonScope = (similarityComparisonScope_) => {
		similarityComparisonScope = similarityComparisonScope_ || null;
	};

	GDV.state.resetSimilarityComparisonScope = () => {
		similarityComparisonScope = null;
	};

})();
