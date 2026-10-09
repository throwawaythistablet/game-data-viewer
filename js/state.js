(() => {
	let csvFile = null;
	let columnDetails = {};
	let nonTagColumnNamesSet = new Set();
	let gameKeys = null;
	let columnCategoryDetails = {};
	let columnToCategories = {};
	let tagFullMatchPatterns = {};
	let tagQuickSearchPatterns = {};
	let thumbnails = null;
	let gamesFolderHandle = null;
	let dataFolderHandle = null;
	let prefilterConditions = {};
	let prefilterAst = null;
	let columnsToDisplay = null;
	let similarityReferenceGame = null;
	let similarityComparisonScope = null;
	let lastSearchParameters = null;

	GDV.state.getCsvFile = () => csvFile;

	GDV.state.setCsvFile = (csvFile_) => {
		csvFile = csvFile_;
	};

	GDV.state.getColumnDetails = () => columnDetails;

	GDV.state.setColumnDetails = (columnDetails_) => {
		columnDetails = columnDetails_;
		nonTagColumnNamesSet = new Set(Object.entries(columnDetails || {}).filter(([, detail]) => detail.type !== "tag").map(([column]) => column));
	};

	GDV.state.hasValidColumnDetails = () => columnDetails && Object.keys(columnDetails).length > 0;

	GDV.state.getNonTagColumnNamesSet = () => nonTagColumnNamesSet;

	GDV.state.getGameKeys = () => gameKeys;

	GDV.state.setGameKeys = (gameKeys_) => {
		gameKeys = gameKeys_;
	};

	GDV.state.getColumnCategoryDetails = () => columnCategoryDetails;

	GDV.state.setColumnCategoryDetails = (columnCategoryDetails_) => {
		columnCategoryDetails = columnCategoryDetails_;
	};

	GDV.state.getColumnToCategories = () => columnToCategories;

	GDV.state.setColumnToCategories = (columnToCategories_) => {
		columnToCategories = columnToCategories_;
	};

	GDV.state.getTagFullMatchPatterns = () => tagFullMatchPatterns;

	GDV.state.setTagFullMatchPatterns = (tagFullMatchPatterns_) => {
		tagFullMatchPatterns = tagFullMatchPatterns_;
	};

	GDV.state.getTagQuickSearchPatterns = () => tagQuickSearchPatterns;

	GDV.state.setTagQuickSearchPatterns = (tagQuickSearchPatterns_) => {
		tagQuickSearchPatterns = tagQuickSearchPatterns_;
	};

	GDV.state.getThumbnails = () => thumbnails;

	GDV.state.setThumbnails = (thumbnails_) => {
		thumbnails = thumbnails_;
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

	GDV.state.setSimilarityCriteria = (similarityReferenceGame_, similarityComparisonScope_) => {
		similarityReferenceGame = similarityReferenceGame_;
		similarityComparisonScope = similarityComparisonScope_;
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

	GDV.state.getLastSearchParameters = () => lastSearchParameters;

	GDV.state.saveLastSearchParameters = () => {
		lastSearchParameters = {
			prefilterConditions: structuredClone(prefilterConditions),
			prefilterAst: structuredClone(prefilterAst),
			columnsToDisplay: structuredClone(columnsToDisplay),
			similarityReferenceGame: structuredClone(similarityReferenceGame),
			similarityComparisonScope: structuredClone(similarityComparisonScope)
		};
	};

})();
