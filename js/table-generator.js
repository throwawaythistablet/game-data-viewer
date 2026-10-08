(() => {
	const SIMILARITY_SCORE_NAME = "similarity_score";
	const SPECIAL_COLUMNS_SET = new Set(["key", SIMILARITY_SCORE_NAME]);
	const IGNORED_COLUMNS = new Set([
		"key",
		getSimilarityScoreName(),
		"platforms",
		"language",
		"title",
		"site_std_version",
		"site_version",
		"url",
		"site_last_update_date",
		"site_release_date",
		"site_last_visit",
		"vndb_url",
		"vndb_last_visit"
	]);

	GDV.tableGenerator.getSimilarityScoreName = getSimilarityScoreName;
	function getSimilarityScoreName() {
		return SIMILARITY_SCORE_NAME;
	}

	GDV.tableGenerator.getSpecialColumnSet = getSpecialColumnSet;
	function getSpecialColumnSet() {
		return SPECIAL_COLUMNS_SET;
	}

	function createDataTableColumnsSet(columnsToDisplay, prefilterConditions) {
		return new Set([
			...GDV.tableGenerator.getSpecialColumnSet(),
			...(columnsToDisplay || []),
			...Object.keys(prefilterConditions || {}),
			...GDV.state.getNonTagColumnNamesSet(),
		]);
	}

	GDV.tableGenerator.showPrefiltersAndGenerateTable = async (file, shouldRestore) => {
		if (!file) return false;
		try {
			const collectedPrefilters = GDV.state.hasValidColumnDetails() ? await GDV.prefilter.showPrefilterOverlayAndCollectFilters(shouldRestore) : {};
			if (collectedPrefilters === null) {
				return false;
			}
		} catch (err) {
			GDV.utils.reportHardError("Prefilters selection failure", "An error occurred while selecting prefilters.", err, { file });
			return false;
		}
		return await runTableGeneration(file);
	};

	GDV.tableGenerator.runTableGeneration = runTableGeneration;
	async function runTableGeneration(file) {
		if (!file) return false;
		try {
			await startTableGenerationUi();
			await generateTable(file);
			return true;
		} catch (err) {
			GDV.utils.reportHardError("CSV Search Failed", "An error occurred while executing the CSV search.", err, { file });
			return false;
		} finally {
			await finishTableGenerationUi();
		}
	}

	async function startTableGenerationUi() {
		await GDV.loading.startLoading("Starting Data Search...", "var(--accent)");
		GDV.dom.hideMainPrefiltersPanelSection();
	}

	async function finishTableGenerationUi() {
		GDV.dom.refreshMainPagePrefiltersPanel();
		GDV.dom.showMainPrefiltersPanelSection();
		await GDV.loading.finishLoading("Table Generation Complete.");
	}

	async function generateTable(file) {
		const columnDetails = GDV.state.getColumnDetails();
		const prefilterAst = GDV.state.getPrefilterAst();
		const prefilterConditions = GDV.state.getPrefilterConditions();
		const columnsToDisplay = GDV.state.getColumnsToDisplay();
		const similarityReferenceGame = GDV.state.getSimilarityReferenceGame();
		const dataTableColumnsSet = createDataTableColumnsSet(columnsToDisplay, prefilterConditions);
		let rowsData = null;

		GDV.datatable.destroyExistingTable(); // Destroy table early to free up memory
		if (similarityReferenceGame) {
			const similarityGameRowDataRaw = await getSimilarityReferenceGameRowDataRaw(file, similarityReferenceGame, 0, 10);
			const filterDetails = { columnDetails, dataTableColumnsSet, prefilterAst, prefilterConditions, similarityReferenceGame, similarityGameRowDataRaw };
			rowsData = await getRowsDataFromCsv(file, filterDetails, 10, 90);
		} else {
			const filterDetails = { columnDetails, dataTableColumnsSet, prefilterAst, prefilterConditions, similarityReferenceGame, similarityGameRowDataRaw: null };
			rowsData = await getRowsDataFromCsv(file, filterDetails, 0, 90);
		}

		const context = { file, prefilters: prefilterConditions };
		if (!Array.isArray(rowsData) || rowsData.length === 0) {
			GDV.utils.reportHardWarning("No results were found.", "The search did not produce any rows after applying the prefilters.", context);
			return;
		}
		await GDV.datatable.loadTable(rowsData);
	}

	function getSimilarityReferenceGameRowDataRaw(file, similarityReferenceGame, startPercent, endPercent) {
		let rowsCount = 0;
		const rowsTotal = GDV.state.getGameKeys().length;
		let similarityGameRowDataRaw = null;
		return new Promise((resolve, reject) => {
			Papa.parse(file, {
				header: true,
				skipEmptyLines: true,
				newline: "", // Important to handle line endings
				chunkSize: 1024 * 1024,
				chunk: (results, parser) => {
					if (GDV.loading.isLoadingStopped()) {
						parser.abort();
						reject(new Error("Loading cancelled by user."));
						return;
					}
					for (const rowDataRaw of results.data) {
						if (isSimilarityReferenceGame(similarityReferenceGame, rowDataRaw)) {
							similarityGameRowDataRaw = rowDataRaw;
							parser.abort();
							return;
						}
						rowsCount++;
					}
					GDV.loading.updateLoadingStepProgress("Searching For Similarity Game Data...", startPercent, endPercent, rowsCount, rowsTotal);
				},
				complete: async () => {
					if (GDV.loading.isLoadingStopped()) return;
					if (!similarityGameRowDataRaw) {
						GDV.utils.reportHardWarning("Similarity Game Not Found.", "The specified similarity game could not be found in the CSV data.", null, { similarityReferenceGame });
					}
					GDV.loading.updateLoadingDirectUpdate("Similarity Game Search Complete.", endPercent);
					await GDV.utils.yieldToBrowserTimeout();
					resolve(similarityGameRowDataRaw);
				},
				error: (err) => {
					reject(err); // Ensure rejection on any parsing error
				},
			});
		});
	}

	function getRowsDataFromCsv(file, filterDetails, startPercent, endPercent) {
		const rowsData = [];
		const { columnDetails, dataTableColumnsSet, prefilterAst, prefilterConditions, similarityReferenceGame, similarityGameRowDataRaw } = filterDetails;
		const hasNoPrefilters = !prefilterConditions || Object.keys(prefilterConditions).length === 0 || !prefilterAst;
		const columnsToCompare = getColumnsToCompare(similarityGameRowDataRaw);
		let rowsCount = 0;
		const rowsTotal = GDV.state.getGameKeys().length;
		return new Promise((resolve, reject) => {
			Papa.parse(file, {
				header: true,
				skipEmptyLines: true,
				newline: "", // Important to handle line endings
				chunkSize: 1024 * 1024,
				chunk: (results, parser) => {
					if (GDV.loading.isLoadingStopped()) {
						parser.abort();
						reject(new Error("Loading cancelled by user."));
						return;
					}
					for (const rowDataRaw of results.data) {
						const rowData = filterColumnsInRowData(rowDataRaw, dataTableColumnsSet);
						if (similarityGameRowDataRaw) {
							rowData[SIMILARITY_SCORE_NAME] = computeRowSimilarityPercent(similarityGameRowDataRaw, rowDataRaw, columnsToCompare);
						}
						if (hasNoPrefilters || isRowIncluded(rowData, prefilterAst, prefilterConditions, columnDetails, similarityReferenceGame)) {
							rowsData.push(rowData);
						}
						rowsCount++;
					}
					GDV.loading.updateLoadingStepProgress("Generating Row Data...", startPercent, endPercent, rowsCount, rowsTotal);
				},
				complete: async () => {
					if (GDV.loading.isLoadingStopped()) return;
					GDV.loading.updateLoadingDirectUpdate("Row Data Generated.", endPercent);
					await GDV.utils.yieldToBrowserTimeout();
					resolve(rowsData);
				},
				error: (err) => {
					reject(err); // Ensure rejection on any parsing error
				},
			});
		});
	}

	function filterColumnsInRowData(rowData, dataTableColumnsSet) {
		const filteredRowData = {};
		for (const [columnName, value] of Object.entries(rowData)) {
			if (dataTableColumnsSet.has(columnName)) {
				filteredRowData[columnName] = value;
			}
		}
		return filteredRowData;
	}

	function isRowIncluded(rowData, prefilterAst, prefilterConditions, columnDetails, similarityReferenceGame) {
		if (similarityReferenceGame && isSimilarityReferenceGame(similarityReferenceGame, rowData)) return true;
		return isRowIncludedBasedFromPrefilters(rowData, prefilterAst, prefilterConditions, columnDetails);
	}

	function isSimilarityReferenceGame(similarityReferenceGame, rowData) {
		return rowData?.key === similarityReferenceGame;
	}

	function isRowIncludedBasedFromPrefilters(rowData, prefilterAst, prefilterConditions, columnDetails) {
		return evaluatePrefilterAst(rowData, prefilterAst, prefilterConditions, columnDetails);
	}

	function evaluatePrefilterAst(rowData, node, prefilterConditions, columnDetails) {
		if (!node) return true;
		switch (node.ast_type) {
			case "VALUE": {
				const column = node.column;
				const criterion = prefilterConditions?.[column];
				if (!criterion) return true;
				return isRowIncludedForPrefilterCondition(rowData, column, criterion, columnDetails[column]);
			}
			case "NOT": {
				if (!node.child) return true;
				return !evaluatePrefilterAst(rowData, node.child, prefilterConditions, columnDetails);
			}
			case "AND": {
				if (!node.children || node.children.length === 0) return true;
				for (let i = 0; i < node.children.length; i++) {
					if (!evaluatePrefilterAst(rowData, node.children[i], prefilterConditions, columnDetails)) return false;
				}
				return true;
			}
			case "OR": {
				if (!node.children || node.children.length === 0) return true;
				for (let i = 0; i < node.children.length; i++) {
					if (evaluatePrefilterAst(rowData, node.children[i], prefilterConditions, columnDetails)) return true;
				}
				return false;
			}
			default:
				GDV.utils.reportSoftError("Problem evaluating filters", "Unexpected filter structure encountered while evaluating row visibility. Results may be incorrect.", null, { nodeType: node.ast_type, node });
				return true;
		}
	}

	function isRowIncludedForPrefilterCondition(rowData, column, criterion, columnDetail) {
		if (!columnDetail) return true;

		const normalize = (v) => (v == null ? "" : typeof v === "string" ? v.trim() : v);
		if (!(column in rowData)) {
			return true;
		}
		const rawValue = rowData[column];
		const value = normalize(rawValue);

		if (columnDetail.type === "tag") {
			if (!Array.isArray(criterion.choices)) return true;
			return criterion.choices.includes(Number(value));
		}

		if (columnDetail.type === "bool") {
			if (!Array.isArray(criterion.choices)) return true;
			const rowBool = normalizeBool(value);
			if (rowBool === null) return true;
			return criterion.choices.map(normalizeBool).includes(rowBool);
		}

		if (columnDetail.type === "int" || columnDetail.type === "float") {
			const num = Number(value);
			if (Number.isNaN(num)) return true;
			if (criterion.min != null && num < criterion.min) return false;
			if (criterion.max != null && num > criterion.max) return false;
			if (Array.isArray(criterion.choices) && criterion.choices.length > 0 && !criterion.choices.includes(num)) return false;
			return true;
		}

		if (Array.isArray(columnDetail.choices) && columnDetail.choices.length > 0) {
			if (!Array.isArray(criterion.choices)) return true;
			if (criterion.choices.length === 0) return false;
			let typedVal = value;
			if (columnDetail.type === "int") typedVal = parseInt(value, 10);
			if (columnDetail.type === "float") typedVal = parseFloat(value);
			if (columnDetail.type === "bool") typedVal = normalizeBool(value);
			if (!criterion.choices.includes(typedVal)) return false;
			return true;
		}

		if (criterion.text && Array.isArray(criterion.text)) {
			const lowerVal = String(value).toLowerCase();
			return criterion.text.some((t) => lowerVal.includes(String(t).toLowerCase()));
		}

		return true;
	}

	function getColumnsToCompare(similarityGameRowDataRaw) {
		if (!similarityGameRowDataRaw) {
			return [];
		}
		const comparisonScopeMatchDetails = GDV.utils.createCategoryMatchDetails(GDV.state.getSimilarityComparisonScope());
		return Object.keys(similarityGameRowDataRaw).filter((columnName) => !IGNORED_COLUMNS.has(columnName) && GDV.utils.isACategoryMatch(columnName, comparisonScopeMatchDetails));
	}

	function computeRowSimilarityPercent(similarityGameRowDataRaw, rowDataRaw, columnsToCompare) {
		const columnToCategories = GDV.state.getColumnToCategories() || {};
		let score = 0;
		let total = 0;
		for (const columnName of columnsToCompare) {
			const filterName = GDV.utils.normalizeFilterName(columnName);
			const categoryWeight = columnToCategories[filterName]?.combined_weight || 1;
			const a = similarityGameRowDataRaw[columnName];
			const b = rowDataRaw[columnName];
			const na = Number(a);
			const nb = Number(b);
			let similarity = 0;
			if (Number.isFinite(na) && Number.isFinite(nb)) {
				similarity = GDV.utils.getNormalizedDifference(na, nb);
			} else {
				const sa = String(a).trim().toLowerCase();
				const sb = String(b).trim().toLowerCase();
				similarity = sa === sb ? 1 : 0;
			}
			score += similarity * categoryWeight;
			total += categoryWeight;
		}
		return total === 0 ? "0.00" : ((score / total) * 100).toFixed(2);
	}

	// Normalize boolean values from strings/CSV/etc
	function normalizeBool(value) {
		if (value === true || value === "true" || value === "True" || value === 1 || value === "1") return true;
		if (value === false || value === "false" || value === "False" || value === 0 || value === "0") return false;
		return null; // unknown / invalid
	}
})();
