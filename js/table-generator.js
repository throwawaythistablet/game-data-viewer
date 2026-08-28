(() => {
	const ROW_THROTTLE = 500;
	const SIMILARITY_SCORE_NAME = "similarity_score";
	let similarityGameRowData = null;

	GDV.tableGenerator.getSimilarityScoreName = getSimilarityScoreName;
	function getSimilarityScoreName() {
		return SIMILARITY_SCORE_NAME;
	}

	GDV.tableGenerator.shouldIncludeColumn = shouldIncludeColumn;
	function shouldIncludeColumn(columnName, columnDetails, prefilterConditions) {
		if (columnName === SIMILARITY_SCORE_NAME || columnName in (prefilterConditions || {})) {
			return true;
		}
		const columnDetail = columnDetails?.[columnName];
		return !columnDetail || columnDetail.type !== "tag";
	}

	GDV.tableGenerator.showPrefiltersAndGenerateTable = async (file) => {
		if (!file) return false;
		try {
			const collectedPrefilters = GDV.state.hasValidColumnDetails() ? await GDV.prefilter.showPrefilterOverlayAndCollectFilters() : {};
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
		await GDV.loading.finishLoading();
	}

	async function generateTable(file) {
		const prefilterAst = GDV.state.getPrefilterAst();
		const prefilterConditions = GDV.state.getPrefilterConditions();
		const columnDetails = GDV.state.getActiveColumnDetails();
		const similarityGame = GDV.state.getSimilarityGame();
		const hasSimilarityScoreCondition = !!prefilterConditions?.[SIMILARITY_SCORE_NAME];
		const filterDetails = { columnDetails, prefilterAst, prefilterConditions, similarityGame };
		let rowsData = null;
		if (similarityGame) {
			similarityGameRowData = null;
			if (hasSimilarityScoreCondition) {
				const rowsDataWithoutScore = await getRowsDataFromCsv(file, filterDetails);
				putSimilarityScores(rowsDataWithoutScore, similarityGameRowData);
				rowsData = filterRowsData(rowsDataWithoutScore, filterDetails);
			} else {
				rowsData = await getRowsDataFromCsv(file, filterDetails);
				putSimilarityScores(rowsData, similarityGameRowData);
			}
		} else {
			rowsData = await getRowsDataFromCsv(file, filterDetails);
		}

		const context = { file, prefilters: prefilterConditions };
		if (!Array.isArray(rowsData) || rowsData.length === 0) {
			GDV.utils.reportHardWarning("No results were found.", "The search did not produce any rows after applying the prefilters.", context);
			return;
		}
		await GDV.datatable.loadTable(rowsData);
	}

	function getRowsDataFromCsv(file, filterDetails) {
		const rowsData = [];
		const totalSize = file.size;
		let rowsProcessed = 0;
		let bytesProcessed = 0;
		const { columnDetails, prefilterAst, prefilterConditions, similarityGame } = filterDetails;
		const hasNoPrefilters = !prefilterConditions || Object.keys(prefilterConditions).length === 0 || !prefilterAst;

		return new Promise((resolve, reject) => {
			Papa.parse(file, {
				header: true,
				skipEmptyLines: true,
				worker: true,
				newline: "", // Important to handle line endings
				step: (row, parser) => {
					if (GDV.loading.isLoadingCancelled()) {
						parser.abort();
						reject(new Error("Loading cancelled by user."));
						return;
					}
					const rowData = filterColumnsInRowData(row.data, columnDetails, prefilterConditions);

					if (hasNoPrefilters || isRowIncluded(rowData, prefilterAst, prefilterConditions, columnDetails, similarityGame)) {
						rowsData.push(rowData);
					}

					if (isSimilarityGame(similarityGame, rowData)) {
						similarityGameRowData = structuredClone(rowData);
					}

					rowsProcessed++;
					bytesProcessed += estimateRowSize(row.data);

					// Throttle progress updates
					if (rowsProcessed % ROW_THROTTLE === 0) {
						GDV.loading.updateLoadingStepProgress("Generating Row Data...", 0, 50, bytesProcessed, totalSize);
					}
				},
				complete: () => {
					GDV.loading.updateLoadingDirectUpdate("Row Data Generated.", 50);
					resolve(rowsData);
				},
				error: (err) => {
					reject(err); // Ensure rejection on any parsing error
				},
			});
		});
	}

	function filterColumnsInRowData(rowData, columnDetails, prefilterConditions) {
		const filteredRowData = {};
		for (const [columnName, value] of Object.entries(rowData)) {
			if (shouldIncludeColumn(columnName, columnDetails, prefilterConditions)) {
				filteredRowData[columnName] = value;
			}
		}
		return filteredRowData;
	}

	function putSimilarityScores(rowsData, similarityGameRowData) {
		if (!Array.isArray(rowsData) || !similarityGameRowData) {
			return;
		}
		const SIMILARITY_SCORE_NAME = getSimilarityScoreName();
		for (let i = 0; i < rowsData.length; i++) {
			const rowData = rowsData[i];
			rowData[SIMILARITY_SCORE_NAME] = computeRowSimilarityPercent(similarityGameRowData, rowData);
			if (i % ROW_THROTTLE === 0) {
				GDV.loading.updateLoadingStepProgress("Generating Similarity Scores...", 50, 70, i, rowsData.length);
			}
		}
		GDV.loading.updateLoadingDirectUpdate("Similarity Scores Generated.", 70);
	}

	function filterRowsData(rowsData, filterDetails) {
		if (!Array.isArray(rowsData)) {
			return [];
		}
		const { columnDetails, prefilterAst, prefilterConditions, similarityGame } = filterDetails;
		const hasNoPrefilters = !prefilterConditions || Object.keys(prefilterConditions).length === 0 || !prefilterAst;
		if (hasNoPrefilters) {
			return rowsData;
		}
		const filteredRowsData = [];
		for (let i = 0; i < rowsData.length; i++) {
			const rowData = rowsData[i];
			if (isRowIncluded(rowData, prefilterAst, prefilterConditions, columnDetails, similarityGame)) {
				filteredRowsData.push(rowData);
			}
			if (i % ROW_THROTTLE === 0) {
				GDV.loading.updateLoadingStepProgress("Filtering Results by Similarity...", 70, 80, i, rowsData.length);
			}
		}
		GDV.loading.updateLoadingDirectUpdate("Similarity Filtering Finished.", 80);
		return filteredRowsData;
	}

	function isRowIncluded(rowData, prefilterAst, prefilterConditions, columnDetails, similarityGame) {
		if (similarityGame && isSimilarityGame(similarityGame, rowData)) return true;
		return isRowIncludedBasedFromPrefilters(rowData, prefilterAst, prefilterConditions, columnDetails);
	}

	function isSimilarityGame(similarityGame, rowData) {
		return rowData?.key === similarityGame;
	}

	function isRowIncludedBasedFromPrefilters(rowData, prefilterAst, prefilterConditions, columnDetails) {
		return evaluatePrefilterAst(rowData, prefilterAst, prefilterConditions, columnDetails);
	}

	function evaluatePrefilterAst(rowData, node, prefilterConditions, columnDetails) {
		if (!node) return true;
		switch (node.ast_type) {
			case "VALUE": {
				const col = node.column;
				const criterion = prefilterConditions?.[col];
				if (!criterion) return true;
				return isRowIncludedForPrefilterCondition(rowData, col, criterion, columnDetails[col]);
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

	function isRowIncludedForPrefilterCondition(rowData, col, criterion, columnDetail) {
		if (!columnDetail) return true;

		const normalize = (v) => (v == null ? "" : typeof v === "string" ? v.trim() : v);
		if (!(col in rowData)) {
			return true;
		}
		const rawValue = rowData[col];
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

	function computeRowSimilarityPercent(similarGameRowData, rowData) {
		const IGNORE_COLS = new Set([
			"key",
			getSimilarityScoreName(),
			"site_std_version",
			"site_version",
			"site_last_update_date",
			"site_release_date",
			"url",
			"platforms",
			"title"
		]);

		const compareKeys = Object.keys(similarGameRowData).filter((k) => !IGNORE_COLS.has(k));
		let score = 0;
		let total = 0;
		for (const col of compareKeys) {
			const a = similarGameRowData[col];
			const b = rowData[col];
			let similarity = 0;
			const na = Number(a);
			const nb = Number(b);
			// numeric compare
			if (Number.isFinite(na) && Number.isFinite(nb)) {
				similarity = GDV.utils.getNormalizedDifference(na, nb);
			}
			else {
				const sa = String(a).trim().toLowerCase();
				const sb = String(b).trim().toLowerCase();

				similarity = sa === sb ? 1 : 0;
			}
			score += similarity;
			total++;
		}

		return total === 0
			? "0.00"
			: ((score / total) * 100).toFixed(2);
	}

	function estimateRowSize(rowData) {
		let size = 1; // newline
		const values = Object.values(rowData);
		for (let i = 0; i < values.length; i++) {
			const value = values[i];
			// add value length if present
			if (value != null) {
				size += String(value).length;
			}
			// add comma between fields (except first)
			if (i > 0) size += 1;
		}
		return size;
	}

	// Normalize boolean values from strings/CSV/etc
	function normalizeBool(val) {
		if (val === true || val === "true" || val === "True" || val === 1 || val === "1") return true;
		if (val === false || val === "false" || val === "False" || val === 0 || val === "0") return false;
		return null; // unknown / invalid
	}
})();
