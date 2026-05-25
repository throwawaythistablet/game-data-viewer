(() => {
	const CSV_ROW_THROTTLE = 500;

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
		await GDV.loading.startLoading("var(--accent)");
		await GDV.loading.updateLoadingDirectUpdate("Starting Data Search...", 0);
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
		let similarityGameRowData = null;

		if (similarityGame) {
			similarityGameRowData = await getSimilarGameRow(file, similarityGame);
		}
		const generatedData = await generateDataFromCsv(file, prefilterAst, prefilterConditions, columnDetails, similarityGame, similarityGameRowData);
		const context = { file, prefilters: prefilterConditions };
		if (!Array.isArray(generatedData) || generatedData.length === 0) {
			GDV.utils.reportHardWarning("No results were found.", "The search did not produce any rows after applying the prefilters.", context);
			return;
		}
		await GDV.datatable.loadTable(generatedData);
	}

	async function getSimilarGameRow(file, similarityGame) {
		let similarityGameRowData = null;
		const totalSize = file.size;
		let rowsProcessed = 0;
		let bytesProcessed = 0;

		return new Promise((resolve, reject) => {
			Papa.parse(file, {
				header: true,
				skipEmptyLines: true,
				worker: true,
				newline: "", // Important to handle line endings
				step: (row, parser) => {
					if (GDV.loading.isLoadingCancelled()) {
						parser.abort(); // stops PapaParse
						reject(new Error("Loading cancelled by user."));
						return;
					}

					// Add row if passes prefilters
					if (isSimilarityGame(similarityGame, row.data)) {
						similarityGameRowData = structuredClone(row.data);
						parser.abort(); // stop parsing if found
						return;
					}

					rowsProcessed++;
					bytesProcessed += estimateRowSize(row.data);

					// Throttle progress updates
					if (rowsProcessed % CSV_ROW_THROTTLE === 0) {
						GDV.loading.updateLoadingStepProgress("Loading similar game details...", 0, 20, bytesProcessed, totalSize);
					}
				},
				complete: () => {
					GDV.loading.updateLoadingDirectUpdate("Similar game details scan completed.", 20);
					resolve(similarityGameRowData);
				},
				error: (err) => {
					reject(err); // Ensure rejection on any parsing error
				},
			});
		});
	}

	async function generateDataFromCsv(file, prefilterAst, prefilterConditions, columnDetails, similarityGame, similarityGameRowData) {
		const generatedData = [];
		const totalSize = file.size;
		let rowsProcessed = 0;
		let bytesProcessed = 0;
		const hasNoPrefilters = !prefilterConditions || Object.keys(prefilterConditions).length === 0 || !prefilterAst;
		const hasSimilarityScore = !!prefilterConditions?.similarity_score;

		return new Promise((resolve, reject) => {
			Papa.parse(file, {
				header: true,
				skipEmptyLines: true,
				worker: true,
				newline: "", // Important to handle line endings
				step: (row, parser) => {
					if (GDV.loading.isLoadingCancelled()) {
						parser.abort(); // stops PapaParse
						reject(new Error("Loading cancelled by user."));
						return;
					}

					if (similarityGameRowData) {
						if (hasSimilarityScore) {
							const completedRowData = { ...row.data, similarity_score: computeRowSimilarityPercent(similarityGameRowData, row.data) };
							if (hasNoPrefilters || isRowIncluded(completedRowData, prefilterAst, prefilterConditions, columnDetails, similarityGame)) {
								generatedData.push(completedRowData);
							}
						} else {
							if (hasNoPrefilters || isRowIncluded(row.data, prefilterAst, prefilterConditions, columnDetails, similarityGame)) {
								const completedRowData = { ...row.data, similarity_score: computeRowSimilarityPercent(similarityGameRowData, row.data) };
								generatedData.push(completedRowData);
							}
						}
					} else {
						if (hasNoPrefilters || isRowIncluded(row.data, prefilterAst, prefilterConditions, columnDetails, similarityGame)) {
							generatedData.push(row.data);
						}
					}

					rowsProcessed++;
					bytesProcessed += estimateRowSize(row.data);

					// Throttle progress updates
					if (rowsProcessed % CSV_ROW_THROTTLE === 0) {
						GDV.loading.updateLoadingStepProgress("Generating Data...", 20, 80, bytesProcessed, totalSize);
					}
				},
				complete: () => {
					GDV.loading.updateLoadingDirectUpdate("Generating Data Finished...", 80);
					resolve(generatedData);
				},
				error: (err) => {
					reject(err); // Ensure rejection on any parsing error
				},
			});
		});
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

	// function isRowIncludedBasedFromPrefilters_old(rowData, prefilterAst, prefilterConditions, columnDetails) {
	// 	if (!prefilterConditions || Object.keys(prefilterConditions).length === 0) return true;
	// 	return Object.entries(prefilterConditions).every(([col, criterion]) =>
	// 		isRowIncludedForPrefilterCondition(rowData, col, criterion, columnDetails[col])
	// 	);
	// }

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

	function isRowIncludedForPrefilterCondition(rowData, col, criterion, colDef) {
		if (!colDef) return true;

		const normalize = (v) => (v == null ? "" : typeof v === "string" ? v.trim() : v);
		const rawVal = rowData[col];
		const val = normalize(rawVal);

		if (colDef.type === "tag") {
			if (!Array.isArray(criterion.choices)) return true;
			return criterion.choices.includes(Number(val));
		}

		if (colDef.type === "bool") {
			if (!Array.isArray(criterion.choices)) return true;
			const rowBool = normalizeBool(val);
			if (rowBool === null) return true;
			return criterion.choices.map(normalizeBool).includes(rowBool);
		}

		if (colDef.type === "int" || colDef.type === "float") {
			const num = Number(val);
			if (Number.isNaN(num)) return true;
			if (criterion.min != null && num < criterion.min) return false;
			if (criterion.max != null && num > criterion.max) return false;
			if (Array.isArray(criterion.choices) && criterion.choices.length > 0 && !criterion.choices.includes(num)) return false;
			return true;
		}

		if (Array.isArray(colDef.choices) && colDef.choices.length > 0) {
			if (!Array.isArray(criterion.choices)) return true;
			if (criterion.choices.length === 0) return false;
			let typedVal = val;
			if (colDef.type === "int") typedVal = parseInt(val, 10);
			if (colDef.type === "float") typedVal = parseFloat(val);
			if (colDef.type === "bool") typedVal = normalizeBool(val);
			if (!criterion.choices.includes(typedVal)) return false;
			return true;
		}

		if (criterion.text && Array.isArray(criterion.text)) {
			const lowerVal = String(val).toLowerCase();
			return criterion.text.some((t) => lowerVal.includes(String(t).toLowerCase()));
		}

		return true;
	}

	function computeRowSimilarityPercent(similarGameRowData, rowData) {
		const IGNORE_COLS = new Set([
			"key",
			GDV.datatable.getSimilarityScoreName(),
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
