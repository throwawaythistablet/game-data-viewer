(() => {
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
		GDV.dom.renderMainPagePrefiltersPanel();
		GDV.dom.showMainPrefiltersPanelSection();
		await GDV.loading.finishLoading();
	}

	async function generateTable(file) {
		const prefilterConditions = GDV.state.getPrefilterConditions();
		const generatedData = await generateDataFromCsv(file, prefilterConditions);
		const context = { file, prefilters: prefilterConditions };
		if (!Array.isArray(generatedData) || generatedData.length === 0) {
			GDV.utils.reportHardWarning("No results were found.", "The search did not produce any rows after applying the prefilters.", context);
			return;
		}
		await GDV.datatable.loadTable(generatedData);
	}

	async function generateDataFromCsv(file, prefilterConditions) {
		const generatedData = [];
		const totalSize = file.size;
		let rowsProcessed = 0;
		let bytesProcessed = 0;
		const THROTTLE = 500;

		return new Promise((resolve, reject) => {
			Papa.parse(file, {
				header: true,
				skipEmptyLines: true,
				worker: true,
				step: function (row) {
					if (GDV.loading.isLoadingCancelled()) {
						this.abort(); // stops PapaParse
						reject(new Error("Loading cancelled by user."));
						return;
					}

					// Add row if passes prefilters
					if (!prefilterConditions || Object.keys(prefilterConditions).length === 0 || isRowIncluded(row.data, prefilterConditions)) {
						generatedData.push(row.data);
					}

					rowsProcessed++;
					bytesProcessed += new TextEncoder().encode(`${Object.values(row.data).join(",")}\n`).length;

					// Throttle progress updates
					if (rowsProcessed % THROTTLE === 0) {
						GDV.loading.updateLoadingStepProgress("Generating Data...", 0, 50, bytesProcessed, totalSize);
					}
				},
				complete: () => {
					GDV.loading.updateLoadingDirectUpdate("Generating Data Finished...", 50);
					resolve(generatedData);
				},
				error: (err) => {
					reject(err); // Ensure rejection on any parsing error
				},
			});
		});
	}

	function isRowIncluded(rowData, prefilterConditions) {
		return isRowIncludedBySimilarityGame(rowData) || isRowIncludedBasedFromPrefilters(rowData, prefilterConditions);
	}

	function isRowIncludedBySimilarityGame(rowData) {
		return rowData?.key === GDV.state.getSimilarityGame();
	}

	function isRowIncludedBasedFromPrefilters(rowData, prefilterConditions) {
		if (!prefilterConditions || Object.keys(prefilterConditions).length === 0) return true;
		const columnDetails = GDV.state.getActiveColumnDetails();

		return Object.entries(prefilterConditions).every(([col, criterion]) =>
			isRowIncludedForPrefilterCondition(rowData, col, criterion, columnDetails[col])
		);
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

	// Normalize boolean values from strings/CSV/etc
	function normalizeBool(val) {
		if (val === true || val === "true" || val === "True" || val === 1 || val === "1") return true;
		if (val === false || val === "false" || val === "False" || val === 0 || val === "0") return false;
		return null; // unknown / invalid
	}
})();
