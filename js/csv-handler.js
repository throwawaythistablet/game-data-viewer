(() => {
	GDV.csvHandler.showPrefiltersForCsvSearch = async (file) => {
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

		return await executeCsvSearch(file);
	};

	GDV.csvHandler.executeCsvSearch = executeCsvSearch;
	async function executeCsvSearch(file) {
		if (!file) return false;
		try {
			await startCsvSearchUi();
			await loadCsvAndBuildTable(file);
			return true;
		} catch (err) {
			GDV.utils.reportHardError("CSV Search Failed", "An error occurred while executing the CSV search.", err, { file });
			return false;
		} finally {
			await finishCsvSearchUi();
		}
	}

	GDV.csvHandler.extractKeysFromCsv = extractKeysFromCsv;
	async function extractKeysFromCsv(file, label, startPercent, endPercent) {
		if (!file) return [];
		const totalSize = file.size;
		let rowsProcessed = 0;
		let bytesProcessed = 0;
		const THROTTLE = 100;

		const collectedKeys = [];
		return new Promise((resolve, reject) => {
			Papa.parse(file, {
				header: true,
				skipEmptyLines: true,
				worker: true,
				step: (row) => {
					const keyValue = row.data?.key;
					if (typeof keyValue === "string" && keyValue.trim() !== "") {
						collectedKeys.push(keyValue.trim());
					}
					rowsProcessed++;
					bytesProcessed += new TextEncoder().encode(`${Object.values(row.data).join(",")}\n`).length;

					// Throttle progress updates
					if (rowsProcessed % THROTTLE === 0) {
						GDV.loading.updateLoadingStepProgress(label, startPercent, endPercent, bytesProcessed, totalSize);
					}
				},
				complete: () => {
					GDV.loading.updateLoadingDirectUpdate(label, endPercent);
					resolve(collectedKeys);
				},
				error: (err) => {
					reject(err);
				},
			});
		});
	}

	async function startCsvSearchUi() {
		await GDV.loading.startLoading("var(--accent)");
		await GDV.loading.updateLoadingDirectUpdate("Starting Data Search...", 0);
		GDV.dom.hideMainPrefiltersPanelSection();
	}

	async function finishCsvSearchUi() {
		GDV.dom.renderMainPagePrefiltersPanel();
		GDV.dom.showMainPrefiltersPanelSection();
		await GDV.loading.finishLoading();
	}

	async function loadCsvAndBuildTable(file) {
		prefilters = GDV.state.getPrefiltersToUse();
		const parsedData = await parseAndFilterCsv(file, prefilters);
		const context = { file, prefilters };
		if (!Array.isArray(parsedData) || parsedData.length === 0) {
			GDV.utils.reportHardWarning("No results were found.", "The search did not produce any rows after applying the prefilters.", context);
			return;
		}
		await GDV.datatable.loadTable(parsedData);
	}

	async function parseAndFilterCsv(file, prefilters) {
		const parsedData = [];
		const totalSize = file.size;
		let rowsProcessed = 0;
		let bytesProcessed = 0;
		const THROTTLE = 100;

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
					if (!prefilters || Object.keys(prefilters).length === 0 || isRowIncluded(row.data, prefilters)) {
						parsedData.push(row.data);
					}

					rowsProcessed++;
					bytesProcessed += new TextEncoder().encode(`${Object.values(row.data).join(",")}\n`).length;

					// Throttle progress updates
					if (rowsProcessed % THROTTLE === 0) {
						GDV.loading.updateLoadingStepProgress("Loading Data From File...", 0, 30, bytesProcessed, totalSize);
					}
				},
				complete: () => {
					GDV.loading.updateLoadingDirectUpdate("Loading Data From File Finished...", 30);
					resolve(parsedData);
				},
				error: (err) => {
					reject(err); // Ensure rejection on any parsing error
				},
			});
		});
	}

	function isRowIncluded(row, prefilter) {
		return isRowIncludedBySimilarityGame(row) || isRowIncludedBasedFromPrefilters(row, prefilter);
	}

	function isRowIncludedBySimilarityGame(rowData) {
		const keyValue = rowData?.key;
		return keyValue === GDV.state.getSimilarityGame();
	}

	function isRowIncludedBasedFromPrefilters(rowData, prefilter) {
		if (!prefilter || Object.keys(prefilter).length === 0) return true;
		const normalize = (v) => (v == null ? "" : typeof v === "string" ? v.trim() : v);

		return Object.entries(prefilter).every(([col, criterion]) => {
			const colDef = GDV.state.getActiveColumnDetails()[col];
			if (!colDef) return true;

			const rawVal = rowData[col];
			const val = normalize(rawVal);

			// Numeric
			if (colDef.type === "int" || colDef.type === "float") {
				const num = Number(val);
				if (Number.isNaN(num)) return true;
				if (criterion.min != null && num < criterion.min) return false;
				if (criterion.max != null && num > criterion.max) return false;
				if (Array.isArray(criterion.choices) && criterion.choices.length > 0) {
					if (!criterion.choices.includes(num)) return false;
				}
				return true;
			}

			// Tag: 0 or 1
			if (colDef.type === "tag") {
				if (!Array.isArray(criterion.choices)) return true;
				return criterion.choices.includes(Number(val));
			}

			// Boolean
			if (colDef.type === "bool") {
				if (!Array.isArray(criterion.choices)) return true;

				const rowBool = normalizeBool(val);
				if (rowBool === null) return true;

				return criterion.choices.map(normalizeBool).includes(rowBool);
			}

			// Any type with choices
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

			// Text search
			if (criterion.text && Array.isArray(criterion.text)) {
				const lowerVal = String(val).toLowerCase();
				return criterion.text.some((t) => lowerVal.includes(String(t).toLowerCase()));
			}

			return true;
		});
	}

	// Normalize boolean values from strings/CSV/etc
	function normalizeBool(val) {
		if (val === true || val === "true" || val === "True" || val === 1 || val === "1") return true;
		if (val === false || val === "false" || val === "False" || val === 0 || val === "0") return false;
		return null; // unknown / invalid
	}
})();
