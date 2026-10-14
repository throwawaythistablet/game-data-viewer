(() => {
	let csvFile = null;
	let columnDetails = {};
	let nonTagColumnsSet = null;
	let includedColumnSet = null;
	let visibleColumnSet = null;
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
	let tableSortColumn = null;
	let tableSortDirection = null;
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
		setOtherValuesFromColumnDetails(columnDetails)
	}

	GDV.state.setOtherValuesFromColumnDetails = setOtherValuesFromColumnDetails;
	function setOtherValuesFromColumnDetails(columnDetails) {
		nonTagColumnsSet = new Set();
		includedColumnSet = new Set();
		visibleColumnSet = new Set();
		for (const [column, detail] of Object.entries(columnDetails || {})) {
			if (detail?.type !== "tag") {
				nonTagColumnsSet.add(column);
			}
			const table_content = detail?.table_content;
			if (table_content === "shown") {
				includedColumnSet.add(column);
				visibleColumnSet.add(column);
			} else if (table_content === "included") {
				includedColumnSet.add(column);
			}
		}
	}

	GDV.state.hasValidColumnDetails = () => columnDetails && Object.keys(columnDetails).length > 0;

	GDV.state.getNonTagColumnsSet = () => nonTagColumnsSet;

	GDV.state.getIncludedColumnSet = () => includedColumnSet;

	GDV.state.getVisibleColumnSet = () => visibleColumnSet;

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

	GDV.state.getTableSortParameters = () => {
		if (!tableSortColumn && !tableSortDirection) {
			return null;
		}
		return { tableSortColumn, tableSortDirection };
	};

	GDV.state.setTableSortParameters = (tableSortColumn_, tableSortDirection_) => {
		tableSortColumn = tableSortColumn_;
		tableSortDirection = tableSortDirection_;
	};

	GDV.state.resetTableSortParameters = () => {
		tableSortColumn = null;
		tableSortDirection = null;
	};

	GDV.state.getTableSortColumn = () => tableSortColumn;

	GDV.state.setTableSortColumn = (tableSortColumn_) => {
		tableSortColumn = tableSortColumn_ || null;
	};

	GDV.state.resetTableSortColumn = () => {
		tableSortColumn = null;
	};

	GDV.state.getTableSortDirection = () => tableSortDirection;

	GDV.state.setTableSortDirection = (tableSortDirection_) => {
		tableSortDirection = tableSortDirection_ || null;
	};

	GDV.state.resetTableSortDirection = () => {
		tableSortDirection = null;
	};

	GDV.state.getSimilarityCriteria = () => {
		if (!similarityReferenceGame && !similarityComparisonScope) {
			return null;
		}
		return { referenceGame: similarityReferenceGame, comparisonScope: similarityComparisonScope };
	};

	GDV.state.setSimilarityCriteria = (similarityReferenceGame_, similarityComparisonScope_) => {
		similarityReferenceGame = similarityReferenceGame_;
		similarityComparisonScope = similarityComparisonScope_;
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

	GDV.state.getLastSearchParameters = () => lastSearchParameters;

	GDV.state.saveLastSearchParameters = () => {
		lastSearchParameters = {
			prefilterConditions: structuredClone(prefilterConditions),
			prefilterAst: structuredClone(prefilterAst),
			columnsToDisplay: structuredClone(columnsToDisplay),
			tableSortColumn,
			tableSortDirection,
			similarityReferenceGame,
			similarityComparisonScope,
		};
	};

})();
