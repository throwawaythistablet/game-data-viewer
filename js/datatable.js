(() => {
	const csvTableElement = $("#csvTable");
	let isResettingFilters = false;
	let columnIndexByNameMap = null;
	let previewTimer = null;
	let currentPreviewIndex = 0;
	let overlayMoveScheduled = false;
	let lastMouseEvent = null;

	bindPreviewOverlayGlobalCleanup();

	GDV.datatable.loadTable = async (parsedData) => {
		const columns = createTableColumns(parsedData);
		await renderCsvTable(parsedData, columns);
	};

	GDV.datatable.resetAllFilters = async () => {
		await GDV.loading.startLoading("Resetting filters...", "var(--yellow)");
		if (!$.fn.DataTable.isDataTable(csvTableElement)) {
			await GDV.loading.abortLoading();
			return;
		}

		const dt = csvTableElement.DataTable();
		isResettingFilters = true;

		try {
			const checkboxFilters = document.querySelectorAll("tr.filters .filter-checkbox");
			const textFilters = document.querySelectorAll("tr.filters .text-input-input");
			const rangeFilters = document.querySelectorAll("tr.filters .filter-range");

			// Reset column searches without drawing after each change.
			GDV.loading.updateLoadingDirectUpdate("Resetting column searches...", 0);
			const colCount = dt.columns().count();

			for (let i = 0; i < colCount; i++) {
				dt.column(i).search("");

				GDV.loading.updateLoadingStepProgress("Resetting column searches...", 0, 20, i + 1, colCount);
				if (GDV.loading.isLoadingStopped()) {
					GDV.utils.reportSoftWarning("Filter Reset Cancelled", "Resetting column searches was cancelled before all column searches were reset.");
					return;
				}
			}

			// Reset checkbox UI. The change handlers update their search state,
			// but isResettingFilters prevents them from redrawing the table.
			for (let i = 0; i < checkboxFilters.length; i++) {
				const box = checkboxFilters[i];
				const checkboxes = box.querySelectorAll('input[type="checkbox"]');

				checkboxes.forEach((cb) => {
					cb.checked = true;
				});

				checkboxes.forEach((cb) => {
					if (!cb.classList.contains("toggle-all")) {
						cb.dispatchEvent(new Event("change", { bubbles: true }));
					}
				});

				GDV.loading.updateLoadingStepProgress("Resetting checkbox filters...", 20, 40, i + 1, checkboxFilters.length);
				if (GDV.loading.isLoadingStopped()) {
					GDV.utils.reportSoftWarning("Filter Reset Cancelled", "Resetting checkbox filters was cancelled before all checkbox filters were reset.");
					return;
				}
			}

			// Reset text filters without drawing after each field.
			for (let i = 0; i < textFilters.length; i++) {
				const input = textFilters[i];
				input.value = "";
				input.dispatchEvent(new Event("input", { bubbles: true }));

				GDV.loading.updateLoadingStepProgress("Resetting text filters...", 40, 60, i + 1, textFilters.length);
				if (GDV.loading.isLoadingStopped()) {
					GDV.utils.reportSoftWarning("Filter Reset Cancelled", "Resetting text filters was cancelled before all text filters were reset.");
					return;
				}
			}

			// Reset numeric range filters. The input event updates the stored
			// min/max values, while the reset flag suppresses the table draw.
			for (let i = 0; i < rangeFilters.length; i++) {
				const range = rangeFilters[i];

				const minInput = range.querySelector(".range-input-min");
				const maxInput = range.querySelector(".range-input-max");

				if (minInput) {
					minInput.value = range.dataset.originalMin || "";
				}
				if (maxInput) {
					maxInput.value = range.dataset.originalMax || "";
				}

				const inputs = range.querySelectorAll("input");
				inputs.forEach((input) => {
					input.dispatchEvent(new Event("change", { bubbles: true }));
				});

				GDV.loading.updateLoadingStepProgress("Resetting numeric range filters...", 60, 80, i + 1, rangeFilters.length);
				if (GDV.loading.isLoadingStopped()) {
					GDV.utils.reportSoftWarning("Filter Reset Cancelled", "Resetting numeric range filters was cancelled before all range filters were reset.");
					return;
				}
			}

			// Reset column order if ColReorder is available.
			if (dt.colReorder && typeof dt.colReorder.reset === "function") {
				GDV.loading.updateLoadingDirectUpdate("Resetting the column order...", 80);
				dt.colReorder.reset();
			}

			// Perform the only table draw for the entire reset operation.
			GDV.loading.updateLoadingDirectUpdate("Sorting the table...", 90);
			sortTable();
		} finally {
			isResettingFilters = false;
			await GDV.loading.finishLoading("Resetting Filters Complete.");
		}
	};

	GDV.datatable.getColumnDescription = getColumnDescription;
	function getColumnDescription(columnName) {
		const description = GDV.state.getActiveColumnDetails()?.[columnName]?.description || "";

		// If it's a site tag or unprefixed, skip regex completely
		if (columnName.startsWith("site: ") || !columnName.includes(": ")) {
			return description;
		}

		const filterName = GDV.utils.normalizeFilterName(columnName);
		const pattern = GDV.state.getTagQuickSearchPatterns()?.[filterName]?.pattern;
		const patternDesc = pattern ? `Regex pattern:\n${pattern}` : "";

		return [description, patternDesc].filter(Boolean).join("\n");
	}

	GDV.datatable.getColumnTagCount = (columnName) => GDV.state.getActiveColumnDetails()?.[columnName]?.tag_count ?? null;

	function createTableColumns(parsedData) {
		if (!parsedData || !parsedData.length) return [];
		const columnNames = Object.keys(parsedData[0]);
		const columns = buildDataColumns(columnNames);

		const thumbnailColumn = buildThumbnailColumn();
		if (thumbnailColumn) {
			columns.unshift(thumbnailColumn);
		}

		const viewImagesColumn = buildViewImagesColumn(columnNames);
		if (viewImagesColumn) {
			columns.unshift(viewImagesColumn);
		}
		return columns;
	}

	async function renderCsvTable(data, columns) {
		csvTableElement.hide();
		destroyExistingTable();

		createTableHeader(columns);

		const areFiltersAdded = await initializeDataTableWithOptions(data, columns);
		if (!areFiltersAdded) return;

		csvTableElement.show();
	}

	function buildDataColumns(columnNamesInTable) {
		const prefilterConditions = GDV.state.getPrefilterConditions();
		const specialKeys = ["key", GDV.tableGenerator.getSimilarityScoreName()];
		const prefilterKeys = Object.keys(prefilterConditions || {}).filter(col => !specialKeys.includes(col));
		const specialColumns = columnNamesInTable.filter((col) => specialKeys.includes(col));
		const prefilterColumns = prefilterKeys.filter(col => columnNamesInTable.includes(col));
		const resultKeys = [...specialColumns, ...prefilterColumns, ...columnNamesInTable.filter((col) => !specialColumns.includes(col) && !prefilterColumns.includes(col))];

		return resultKeys.map((columnName) => ({
			title: columnName,
			data: columnName,
			render: (data, type) => type === "display" ? renderCellValueNode(data, columnName) : data,
			createdCell: (td) => {
				if (prefilterColumns.includes(columnName)) {
					td.classList.add("white-highlight");
				} else if (specialColumns.includes(columnName)) {
					td.classList.add("yellow-highlight");
				}
			},
			white_highlight: prefilterColumns.includes(columnName),
			yellow_highlight: specialColumns.includes(columnName),
		}));
	}

	function buildThumbnailColumn() {
		if (!GDV.state.getThumbnails()) return null;

		return {
			title: "thumbnails",
			data: null,
			orderable: false,
			searchable: false,
			render: (_, type, row) => {
				if (type === "display") {
					const key = row.key;
					const image_url = getThumbnailImageForKey(key);
					const game_url = GDV.utils.stripHtmlToString(row.url);
					const vndb_url = GDV.utils.stripHtmlToString(row.vndb_url);
					return renderThumbnail(key, image_url, game_url, vndb_url, row.vndb_character_count);
				}
				if (type === "export") {
					return row.key ?? "";
				}
				return "";
			}
		};
	}

	function buildViewImagesColumn(columnNames) {
		if (!columnNames.includes("location")) return null;
		return {
			title: "View Images",
			data: null,
			orderable: false,
			searchable: false,
			render: (_, type) => {
				if (type === "display") return renderViewButton();
				if (type === "export") return "View";
				return "";
			}
		};
	}

	function destroyExistingTable() {
		try {
			if ($.fn.DataTable.isDataTable(csvTableElement)) {
				csvTableElement.DataTable().destroy();
			}
		} catch (err) {
			GDV.utils.reportSoftWarning("Destroy DataTable Failed", "Failed to destroy existing DataTable.", err, { csvTableElement });
		} finally {
			csvTableElement.empty();
		}
	}

	function createTableHeader(columns) {
		const thead = document.createElement("thead");
		const headerRow = document.createElement("tr");
		const filterRow = document.createElement("tr");
		filterRow.classList.add("filters");

		columns.forEach((col) => {
			// Header cell
			const th = document.createElement("th");
			th.textContent = col.title;
			th.dataset.columnKey = col.data;
			if (col.white_highlight) {
				th.classList.add("white-highlight");
			} else if (col.yellow_highlight) {
				th.classList.add("yellow-highlight");
			}
			headerRow.appendChild(th);

			// Filter cell
			const filterTh = document.createElement("th");
			filterTh.dataset.columnKey = col.data;
			if (col.white_highlight) {
				filterTh.classList.add("white-highlight");
			} else if (col.yellow_highlight) {
				filterTh.classList.add("yellow-highlight");
			}
			filterRow.appendChild(filterTh);
		});

		thead.appendChild(headerRow);
		thead.appendChild(filterRow);
		csvTableElement.append(thead);
	}

	function initializeDataTableWithOptions(data, columns) {
		const sortColumnName = getDefaultSortColumnName();
		let sortColumnIndex = findIndexOfColumnByNameInColumns(columns, sortColumnName);
		if (isInvalidColumnIndex(sortColumnIndex)) {
			GDV.utils.reportSoftWarning("Invalid Column Index", `Cannot sort by "${sortColumnName}": the column index is missing or invalid.`);
			sortColumnIndex = 0;
		}

		const numericColumnIndexes = columns.reduce((indexes, col, i) => {
			const type = GDV.state.getActiveColumnDetails()?.[col.data]?.type;
			if (type === "int" || type === "float") indexes.push(i);
			return indexes;
		}, []);

		DataTable.Buttons.defaults.dom.button.className = "btn";
		return new Promise((resolve, reject) => {
			const dt = csvTableElement.DataTable({
				data: data,
				columns: columns,
				columnDefs: [{ type: "html-num", targets: numericColumnIndexes }],
				paging: true,
				pageLength: 100,
				order: [[sortColumnIndex, "desc"]],
				lengthMenu: [
					[50, 100, 200, 500, 1000],
					[50, 100, 200, 500, 1000],
				],
				fixedHeader: true,
				colReorder: {
					headerRows: [0]
				},
				autoWidth: false,
				orderCellsTop: true,
				layout: {
					topStart: 'info',
					topEnd: 'paging',
					top: ['pageLength', 'buttons', 'search'],
					bottomStart: 'info',
					bottomEnd: 'paging'
				},
				buttons: [
					{
						extend: "csv",
						text: "Download Table as CSV",
						exportOptions: {
							columns: ":visible",
							orthogonal: "export",
							modifier: {
								search: "applied",
								order: "applied",
								page: "all"
							},
							format: {
								body: (data, _row, _column, _node) => {
									return data;
								}
							}
						}
					}
				],

				initComplete: async function () {
					try {
						const api = this.api();
						addHeaderTooltips(api);
						const areFiltersAdded = await addColumnFilters(api);
						resolve(areFiltersAdded);
					} catch (err) {
						reject(err);
					}
				},
			});
			// ⚡ Scroll to top on page change
			dt.on("page.dt", () => {
				const tableTop = csvTableElement.offset().top;
				window.scrollTo({ top: tableTop, behavior: "smooth" });
			});
		});
	}

	function addHeaderTooltips(api) {
		api.columns().every(function () {
			const header = this.header();
			const columnName = header.textContent.trim();
			header.title = getColumnDescription(columnName);
			return true; // satisfies Biome linter
		});
	}

	async function addColumnFilters(api) {
		const colCount = api.columns().count();
		const columnDetails = GDV.state.getActiveColumnDetails() || {};
		const ths = csvTableElement[0].querySelectorAll(".filters th");

		for (let columnIndex = 0; columnIndex < colCount; columnIndex++) {
			if (GDV.loading.isLoadingStopped()) {
				GDV.utils.reportSoftWarning("Column Filter Setup Cancelled", "Adding column filters was cancelled before all filters were created.");
				return false;
			}
			const column = api.column(columnIndex);
			const th = ths[columnIndex];
			if (!th) continue;
			if (th.querySelector(".filter-container")) continue;

			const container = document.createElement("div");
			container.className = "filter-container";
			th.appendChild(container);

			const columnName = column.header().textContent.trim();
			const columnDetail = columnDetails[columnName];

			if (columnName === "thumbnails") {
				addGameSimilaritySearch(container);
				continue;
			}
			if (!columnDetail) continue;
			addColumnFilterItems(container, columnName, columnDetail);
			GDV.loading.updateLoadingStepProgress("Adding Column Filters...", 90, 99, columnIndex + 1, colCount);
			await GDV.utils.yieldToBrowserTimeout();
		}
		GDV.loading.updateLoadingDirectUpdate("Finalizing Results...", 99);
		await GDV.utils.yieldToBrowserTimeout();

		bindTableSortingButtons();
		setupFiltersExpandCollapse();
		return true;
	}

	function addGameSimilaritySearch(container) {
		const similarityWrapper = document.createElement("div");
		similarityWrapper.className = "filters-similarity";

		// Input + label (nest input inside label)
		const similarityLabelInput = document.createElement("label");
		similarityLabelInput.className = "label-input";
		similarityLabelInput.textContent = "Find Similar Games To:";
		const br = document.createElement("br");
		similarityLabelInput.appendChild(br);
		const similarityInput = document.createElement("input");
		similarityInput.type = "text";
		similarityInput.className = "text-input-input";
		similarityInput.placeholder = "Find a game...";
		similarityInput.name = "similaritySearch";
		similarityLabelInput.appendChild(similarityInput);
		similarityWrapper.appendChild(similarityLabelInput);

		// Nearest match display
		const nearestMatchWrapper = document.createElement("div");
		nearestMatchWrapper.className = "filters-line-wrapper";
		const nearestMatchLabel = document.createElement("span");
		nearestMatchLabel.className = "nearest-match-label";
		nearestMatchLabel.textContent = "Nearest game match: ";
		const nearestMatchValue = document.createElement("span");
		nearestMatchValue.className = "nearest-match-value";
		nearestMatchValue.textContent = "—";
		nearestMatchValue.dataset.gameKey = "";
		nearestMatchWrapper.appendChild(nearestMatchLabel);
		nearestMatchWrapper.appendChild(nearestMatchValue);
		similarityWrapper.appendChild(nearestMatchWrapper);

		// Buttons
		const btnWrapper = document.createElement("div");
		btnWrapper.className = "filters-line-wrapper";
		const similarityButton = document.createElement("button");
		similarityButton.type = "button";
		similarityButton.className = "btn btn-secondary";
		similarityButton.textContent = "Update Similarity Scores";
		const resetButton = document.createElement("button");
		resetButton.type = "button";
		resetButton.className = "btn btn-secondary";
		resetButton.textContent = "Reset";
		btnWrapper.appendChild(similarityButton);
		btnWrapper.appendChild(resetButton);
		similarityWrapper.appendChild(btnWrapper);
		container.appendChild(similarityWrapper);

		// Input handler
		similarityInput.addEventListener("input", function () {
			const query = this.value.trim();
			if (!query) {
				nearestMatchValue.textContent = "—";
				nearestMatchValue.dataset.gameKey = "";
				return;
			}
			const nearest = GDV.utils.findNearestGameKey(query);
			if (nearest) {
				nearestMatchValue.textContent = nearest;
				nearestMatchValue.dataset.gameKey = nearest;
			} else {
				nearestMatchValue.textContent = "(none)";
				nearestMatchValue.dataset.gameKey = "";
			}
		});

		// Button click
		similarityButton.addEventListener("click", async () => {
			const gameKey = nearestMatchValue.dataset.gameKey;
			if (!gameKey) {
				GDV.utils.reportHardWarning("No Game Title Provided", "Please enter a game title first.");
				return;
			}
			setSimilarityGame(gameKey);
			await GDV.tableGenerator.runTableGeneration(GDV.state.getActiveCsvFile());
		});

		resetButton.addEventListener("click", async () => {
			resetSimilarityGame();
			await GDV.tableGenerator.runTableGeneration(GDV.state.getActiveCsvFile());
		});
	}

	function addColumnFilterItems(container, columnName, columnDetail) {
		addSortingControls(container, columnName);
		if (columnDetail.choices && columnDetail.choices.length > 0) {
			addCheckboxFilter(container, columnName, columnDetail);
		} else if (columnDetail.type === "int" || columnDetail.type === "float") {
			addRangeFilter(container, columnName, columnDetail);
		} else {
			addTextFilter(container, columnName);
		}
	}

	function addSortingControls(container, columnName) {
		// Create a wrapper div for buttons
		const lineWrapper = document.createElement("div");
		lineWrapper.className = "filters-line-wrapper";

		// Create ascending button
		const asc = document.createElement("button");
		asc.className = "sort-asc btn";
		asc.dataset.columnName = columnName;
		asc.textContent = "Sort ↑";

		// Create descending button
		const desc = document.createElement("button");
		desc.className = "sort-desc btn";
		desc.dataset.columnName = columnName;
		desc.textContent = "Sort ↓";

		// Append buttons to the wrapper
		lineWrapper.append(asc);
		lineWrapper.append(desc);

		// Append the wrapper to the container
		container.append(lineWrapper);
	}

	function addCheckboxFilter(th, columnName, columnDetail) {
		const box = document.createElement("div");
		box.className = "filter-checkbox";
		th.appendChild(box);

		// Sanitize column name for IDs
		const sanitizedColumnName = String(columnName || "checkbox-filter")
			.replace(/\s+/g, "-")
			.replace(/[^\w-]/g, "");

		// Toggle All
		const toggleLabel = document.createElement("label");
		toggleLabel.className = "toggle-all-label";

		const toggleInput = document.createElement("input");
		toggleInput.type = "checkbox";
		toggleInput.className = "toggle-all";
		toggleInput.checked = true;
		toggleInput.id = `toggle-all-filter-${sanitizedColumnName}`;
		toggleInput.name = `toggleAll-filter-${sanitizedColumnName}`;

		toggleLabel.setAttribute("for", toggleInput.id);
		toggleLabel.appendChild(toggleInput);
		toggleLabel.append(" Toggle All");
		box.appendChild(toggleLabel);

		// Individual checkboxes
		columnDetail.choices.forEach((v, idx) => {
			const label = document.createElement("label");

			const input = document.createElement("input");
			input.type = "checkbox";
			input.value = v;
			input.checked = true;

			// Assign unique id and name for accessibility
			const sanitizedValue = String(v)
				.replace(/\s+/g, "-")
				.replace(/[^\w-]/g, "");
			input.id = `chk-filter-${sanitizedColumnName}-${sanitizedValue}-${idx}`;
			input.name = `chk-filter-${sanitizedColumnName}`;

			label.setAttribute("for", input.id);
			label.appendChild(input);
			label.append(` ${v}`);

			box.appendChild(label);
		});

		// Event delegation (single listener)
		box.addEventListener("change", (e) => {
			const target = e.target;

			if (target.classList.contains("toggle-all")) {
				const checked = target.checked;
				const allCheckboxes = box.querySelectorAll('input[type="checkbox"]:not(.toggle-all)');
				allCheckboxes.forEach((cb) => {
					cb.checked = checked;
				});

				applyCheckboxFilter(columnName, columnDetail, box, toggleInput);
				return;
			}

			if (target.matches('input[type="checkbox"]:not(.toggle-all)')) {
				applyCheckboxFilter(columnName, columnDetail, box, toggleInput);
			}
		});
	}

	function applyCheckboxFilter(columnName, columnDetail, box, toggleInput) {
		const checkedInputs = box.querySelectorAll('input[type="checkbox"]:not(.toggle-all):checked');
		const checkedVals = Array.from(checkedInputs).map((el) => el.value);
		toggleInput.checked = checkedVals.length === columnDetail.choices.length;

		let searchRegex;
		if (checkedVals.length === 0 || checkedVals.length === columnDetail.choices.length) {
			searchRegex = "";
		} else {
			const escaped = checkedVals.map((v) => $.fn.dataTable.util.escapeRegex(v));
			searchRegex = `^(${escaped.join("|")})$`;
		}

		const columnIndex = findIndexOfColumnByNameInTable(columnName);
		if (isInvalidColumnIndex(columnIndex)) {
			GDV.utils.reportSoftWarning("Invalid Column Index", `Cannot apply the filter for "${columnName}": the column index is missing or invalid.`);
			return;
		}

		const column = csvTableElement.DataTable().column(columnIndex);
		column.search(searchRegex, true, false);

		if (!isResettingFilters) {
			column.draw();
		}
	}

	function addRangeFilter(th, columnName, columnDetail) {
		// Container
		const box = document.createElement("div");
		box.className = "filter-range";
		th.appendChild(box);

		// Helper to sanitize column name for IDs
		const sanitizedName = String(columnName || "range-filter")
			.replace(/\s+/g, "-")
			.replace(/[^\w-]/g, "");

		// Min input wrapper and label
		const minWrapper = document.createElement("div");
		minWrapper.className = "range-input-wrapper";
		box.appendChild(minWrapper);

		const minId = `range-input-min-${sanitizedName}`;
		const minLabel = document.createElement("label");
		minLabel.className = "range-input-label";
		minLabel.setAttribute("for", minId);
		minLabel.textContent = "Min";
		minWrapper.appendChild(minLabel);

		const minInput = document.createElement("input");
		minInput.type = "number";
		minInput.className = "range-input-min";
		minInput.placeholder = "Min";
		minInput.id = minId;
		minInput.name = minId;
		minInput.value = columnDetail.min ?? "";
		minWrapper.appendChild(minInput);

		// Max input wrapper and label
		const maxWrapper = document.createElement("div");
		maxWrapper.className = "range-input-wrapper";
		box.appendChild(maxWrapper);

		const maxId = `range-input-max-${sanitizedName}`;
		const maxLabel = document.createElement("label");
		maxLabel.className = "range-input-label";
		maxLabel.setAttribute("for", maxId);
		maxLabel.textContent = "Max";
		maxWrapper.appendChild(maxLabel);

		const maxInput = document.createElement("input");
		maxInput.type = "number";
		maxInput.className = "range-input-max";
		maxInput.placeholder = "Max";
		maxInput.id = maxId;
		maxInput.name = maxId;
		maxInput.value = columnDetail.max ?? "";
		maxWrapper.appendChild(maxInput);

		// Store original values for reset
		box.dataset.originalMin = columnDetail.min ?? "";
		box.dataset.originalMax = columnDetail.max ?? "";

		// Event listeners for min/max inputs
		const applyRangeFilterDebounced = GDV.utils.debounce(() => applyRangeFilter(columnName, minInput, maxInput));
		[minInput, maxInput].forEach((input) => {
			input.addEventListener("input", applyRangeFilterDebounced);
		});
	}

	function applyRangeFilter(columnName, minInput, maxInput) {
		table = csvTableElement.DataTable();
		const columnIndex = findIndexOfColumnByNameInTable(columnName);
		if (isInvalidColumnIndex(columnIndex)) {
			GDV.utils.reportSoftWarning("Invalid Column Index", `Cannot apply the range filter for "${columnName}": the column index is missing or invalid.`);
			return;
		}

		const minValueRaw = parseFloat(minInput.value);
		const maxValueRaw = parseFloat(maxInput.value);
		const minValue = !Number.isNaN(minValueRaw) ? minValueRaw : undefined;
		const maxValue = !Number.isNaN(maxValueRaw) ? maxValueRaw : undefined;

		const column = table.column(columnIndex);
		if (minValue === undefined && maxValue === undefined) {
			column.search("");
		} else {
			column.search((value) => {
				const num = Number(value);
				if (Number.isNaN(num)) return false;
				if (minValue !== undefined && num < minValue) return false;
				if (maxValue !== undefined && num > maxValue) return false;
				return true;
			});
		}

		if (!isResettingFilters) {
			table.draw();
		}
	}

	function addTextFilter(th, columnName) {
		// Wrapper div
		const wrapper = document.createElement("div");
		wrapper.className = "text-input-wrapper";
		th.appendChild(wrapper);

		// Create label for accessibility
		const label = document.createElement("label");
		label.className = "text-input-label";

		// Ensure columnName is a string
		const sanitizedName = String(columnName || "text-filter")
			.replace(/\s+/g, "-")
			.replace(/[^\w-]/g, "");
		const inputId = `filter-${sanitizedName}`;

		label.setAttribute("for", inputId);
		label.textContent = "Filter: "; // visible label for screen readers
		wrapper.appendChild(label);

		// Create input
		const input = document.createElement("input");
		input.type = "text";
		input.className = "text-input-input";
		input.placeholder = "Filter...";
		input.id = inputId;
		input.name = inputId;
		wrapper.appendChild(input);

		const applyTextFilterDebounced = GDV.utils.debounce(() => applyTextFilter(columnName, input));
		input.addEventListener("input", applyTextFilterDebounced);
	}

	function applyTextFilter(columnName, input) {
		const columnIndex = findIndexOfColumnByNameInTable(columnName);
		if (isInvalidColumnIndex(columnIndex)) {
			GDV.utils.reportSoftWarning("Invalid Column Index", `Cannot apply the filter for "${columnName}": the column index is missing or invalid.`);
			return;
		}

		const column = csvTableElement.DataTable().column(columnIndex);
		column.search(input.value);

		if (!isResettingFilters) {
			column.draw();
		}
	}

	function bindTableSortingButtons() {
		if (!csvTableElement.data("sortingButtonsBound")) {
			csvTableElement.on("click", ".sort-asc", function () {
				const columnName = $(this).data("columnName");
				const columnIndex = findIndexOfColumnByNameInTable(columnName);
				if (isInvalidColumnIndex(columnIndex)) {
					GDV.utils.reportSoftWarning("Invalid Column Index", `Cannot sort by "${columnName}": the column index is missing or invalid.`);
					return;
				}

				const dt = csvTableElement.DataTable();
				dt.order([columnIndex, "asc"]).draw();
			});

			csvTableElement.on("click", ".sort-desc", function () {
				const columnName = $(this).data("columnName");
				const columnIndex = findIndexOfColumnByNameInTable(columnName);
				if (isInvalidColumnIndex(columnIndex)) {
					GDV.utils.reportSoftWarning("Invalid Column Index", `Cannot sort by "${columnName}": the column index is missing or invalid.`);
					return;
				}

				const dt = csvTableElement.DataTable();
				dt.order([columnIndex, "desc"]).draw();
			});

			csvTableElement.data("sortingButtonsBound", true);
		}
	}

	function setupFiltersExpandCollapse() {
		const table = document.querySelector("#csvTable");
		if (!table) return;

		const headerRow = table.querySelector("thead tr:first-child");
		const filtersRow = table.querySelector("tr.filters");

		if (!headerRow || !filtersRow) return;
		let isHoverHeader = false;
		let isHoverFilters = false;
		let isFocusInside = false;
		let collapseTimer = null;
		const COLLAPSE_DELAY = 2000;

		function computeShouldExpand() {
			return isHoverHeader || isHoverFilters || isFocusInside;
		}

		function applyExpandedState() {
			filtersRow.classList.add("is-expanded");
			filtersRow.classList.remove("is-collapsed");
		}

		function applyCollapsedState() {
			filtersRow.classList.remove("is-expanded");
			filtersRow.classList.add("is-collapsed");
		}

		function cancelCollapseTimer() {
			if (!collapseTimer) return;
			clearTimeout(collapseTimer);
			collapseTimer = null;
		}

		function scheduleCollapse() {
			if (collapseTimer) return;
			collapseTimer = setTimeout(() => {
				collapseTimer = null;
				if (!computeShouldExpand()) {
					applyCollapsedState();
				}
			}, COLLAPSE_DELAY);
		}

		function updateFiltersState() {
			if (computeShouldExpand()) {
				cancelCollapseTimer();
				applyExpandedState();
			} else {
				scheduleCollapse();
			}
		}

		// Hover on headers
		headerRow.addEventListener("mouseenter", () => {
			isHoverHeader = true;
			updateFiltersState();
		});

		headerRow.addEventListener("mouseleave", () => {
			isHoverHeader = false;
			updateFiltersState();
		});

		// Hover on filters row
		filtersRow.addEventListener("mouseenter", () => {
			isHoverFilters = true;
			updateFiltersState();
		});

		filtersRow.addEventListener("mouseleave", () => {
			isHoverFilters = false;
			updateFiltersState();
		});

		// Keep open while interacting
		filtersRow.addEventListener("focusin", () => {
			isFocusInside = true;
			updateFiltersState();
		});

		filtersRow.addEventListener("focusout", () => {
			// let focus settle before checking final state
			setTimeout(() => {
				isFocusInside = filtersRow.contains(document.activeElement);
				updateFiltersState();
			}, 0);
		});

		// initial state
		updateFiltersState();
	}

	function renderViewButton() {
		const btn = document.createElement("button");
		btn.className = "btn view-images";
		btn.textContent = "View";
		return btn;
	}

	function renderThumbnail(key, image_url, game_url, vndb_url, vndb_character_count) {
		if (!image_url || !game_url) return document.createDocumentFragment();

		const wrapper = document.createElement("div");
		wrapper.className = "table-thumbnail-wrapper";

		// Main link + image
		const aGame = document.createElement("a");
		aGame.href = game_url;
		aGame.title = "Click to Play Game";
		aGame.target = "_blank";
		aGame.rel = "noopener noreferrer";

		const img = document.createElement("img");
		img.className = "table-thumbnail";
		img.src = image_url;
		img.alt = "thumbnail";
		img.loading = "lazy";

		const playRegion = document.createElement("div");
		playRegion.className = "table-thumbnail-play-overlay";
		playRegion.textContent = "▶ Play";

		aGame.appendChild(img);
		wrapper.appendChild(aGame);
		wrapper.appendChild(playRegion);
		wrapper.appendChild(createThumbnailOverlay(key, game_url, vndb_url, vndb_character_count));

		return wrapper;
	}

	function createThumbnailOverlay(key, game_url, vndb_url, vndb_character_count) {
		const overlay = document.createElement("div");
		overlay.className = "table-thumbnail-action-overlay";

		if (vndb_url) {
			const vndbLink = document.createElement("a");
			vndbLink.className = "table-thumbnail-action";
			vndbLink.target = "_blank";
			vndbLink.rel = "noopener noreferrer";
			if (vndb_character_count > 0) {
				vndbLink.href = getSubUrlUsingString(vndb_url, "chars#chars");
				vndbLink.title = "Read character profiles on VNDB";
				vndbLink.textContent = "Character Profiles 👥";
				vndbLink.setAttribute("aria-label", "Read character profiles on VNDB");
			} else {
				vndbLink.href = vndb_url;
				vndbLink.title = "Open this game on VNDB";
				vndbLink.textContent = "VNDB 🌐";
				vndbLink.setAttribute("aria-label", "Open this game on VNDB");
			}
			vndbLink.setAttribute("role", "button"); // optional for better semantics
			overlay.appendChild(vndbLink);
		}

		const reviewsContainer = document.createElement("div");
		reviewsContainer.className = "table-thumbnail-dropdown";
		const reviewsButton = document.createElement("button");
		reviewsButton.className = "table-thumbnail-action";
		reviewsButton.type = "button";
		reviewsButton.title = "Read reviews for the game";
		reviewsButton.textContent = "Reviews ▲";
		reviewsButton.setAttribute("aria-label", "Read reviews for the game");
		const reviewsMenu = document.createElement("div");
		reviewsMenu.className = "table-thumbnail-dropdown-menu";
		if (vndb_url) {
			const vndbReviewLink = document.createElement("a");
			vndbReviewLink.className = "table-thumbnail-dropdown-item";
			vndbReviewLink.href = getSubUrlUsingString(vndb_url, "reviews#review");
			vndbReviewLink.target = "_blank";
			vndbReviewLink.rel = "noopener noreferrer";
			vndbReviewLink.textContent = "VNDB 📖 Reviews";
			reviewsMenu.appendChild(vndbReviewLink);
		}
		const f95ReviewLink = document.createElement("a");
		f95ReviewLink.className = "table-thumbnail-dropdown-item";
		f95ReviewLink.href = getSubUrl(game_url, "br-reviews");
		f95ReviewLink.target = "_blank";
		f95ReviewLink.rel = "noopener noreferrer";
		f95ReviewLink.textContent = "F95 📖 Reviews";
		reviewsMenu.appendChild(f95ReviewLink);
		reviewsContainer.appendChild(reviewsButton);
		reviewsContainer.appendChild(reviewsMenu);
		overlay.appendChild(reviewsContainer);

		const writeReview = document.createElement("a");
		writeReview.className = "table-thumbnail-action";
		writeReview.href = getSubUrl(game_url, "br-rate");
		writeReview.target = "_blank";
		writeReview.rel = "noopener noreferrer";
		writeReview.title = "Write a review for the game";
		writeReview.textContent = "Write A Review 📝";
		writeReview.setAttribute("aria-label", "Write a review for the game");
		writeReview.setAttribute("role", "button");
		overlay.appendChild(writeReview);

		const findSimilarGames = document.createElement("a");
		findSimilarGames.className = "table-thumbnail-action";
		findSimilarGames.href = "#";
		findSimilarGames.title = "Find similar games and add a similarity column with matching score details for this game";
		findSimilarGames.textContent = "Find Similar Games 🔍";
		findSimilarGames.setAttribute("aria-label", "Find similar games and add a similarity column for this game");
		findSimilarGames.setAttribute("role", "button");
		findSimilarGames.addEventListener("click", async (e) => {
			e.preventDefault();
			setSimilarityGame(key);
			await GDV.tableGenerator.runTableGeneration(GDV.state.getActiveCsvFile());
		});
		overlay.appendChild(findSimilarGames);

		return overlay
	}

	function renderCellValueNode(value, columnName = null) {
		if (value === undefined || value === null) return document.createTextNode("");

		const text = String(value).trim();

		const excelHyperlinkNode = createExcelHyperlinkNode(text);
		if (excelHyperlinkNode) return excelHyperlinkNode;

		if (isWebUrl(text)) {
			return createHyperlinkNode(text, text);
		}

		if (isWindowsPath(text)) {
			return createHyperlinkNode(toFileUrl(text), text);
		}

		const highlightedNode = createHighlightedNode(text, columnName);
		if (highlightedNode) return highlightedNode;

		return document.createTextNode(text);
	}

	function sortTable() {
		sortTableByColumn(getDefaultSortColumnName(), "desc");
	}

	function sortTableByColumn(columnName, order) {
		const columnIndex = findIndexOfColumnByNameInTable(columnName);
		if (isInvalidColumnIndex(columnIndex)) {
			GDV.utils.reportSoftWarning("Invalid Column Index", `Cannot sort by "${columnName}": the column index is missing or invalid.`);
			return;
		}
		const dt = csvTableElement.DataTable();
		dt.order([[columnIndex, order]]).draw();
	}

	function getDefaultSortColumnName() {
		return GDV.state.getSimilarityGame() ? GDV.tableGenerator.getSimilarityScoreName() : "bayesian_rating";
	}

	function createExcelHyperlinkNode(text) {
		const match = text.match(/^=HYPERLINK\("([^"]+)",\s*"([^"]+)"\)$/i);
		if (!match) return null;

		const [, path, label] = match;
		const url = isWebUrl(path) ? path : toFileUrl(path);
		return createHyperlinkNode(url, label);
	}

	function createHyperlinkNode(url, label) {
		const a = document.createElement("a");
		a.href = url;
		a.target = "_blank";
		a.rel = "noopener noreferrer";
		a.textContent = label;
		return a;
	}

	function createHighlightedNode(text, columnName) {
		if (!columnName) return null;

		const columnDetail = GDV.state.getActiveColumnDetails()?.[columnName];
		if (!columnDetail) return null;
		const columnNameLower = columnName.toLowerCase();

		if (columnDetail.type === "int" || columnDetail.type === "float") {
			return GDV.dom.createHighlightFromValue(text, columnName);
		} else if (columnNameLower.includes("sentiment_label")) {
			return GDV.dom.createHighlightFromSentiment(text);
		} else if (columnNameLower === "status") {
			return GDV.dom.createHighlightFromStatus(text);
		} else if (columnNameLower === "play_time_label") {
			return GDV.dom.createHighlightFromPlayTimeLabel(text);
		}
		return null;
	}

	function showPreviewOverlay(previewImages, e) {
		const overlay = document.getElementById("previewOverlay");
		const previewImg = document.getElementById("previewImage");
		if (!overlay || !previewImg) return;

		overlay.style.display = "block";
		movePreviewOverlay(e);

		currentPreviewIndex = 0;
		previewImg.src = previewImages[currentPreviewIndex];

		stopPreviewSlideshow();
		startPreviewSlideshow(previewImages, previewImg);
	}

	function hidePreviewOverlay() {
		const overlay = document.getElementById("previewOverlay");
		const previewImg = document.getElementById("previewImage");

		if (overlay) overlay.style.display = "none";
		if (previewImg) previewImg.src = "";

		stopPreviewSlideshow();
		currentPreviewIndex = 0;
	}

	function movePreviewOverlay(e) {
		const overlay = document.getElementById("previewOverlay");
		const previewImg = document.getElementById("previewImage");
		if (!overlay || !previewImg) return;

		// #previewOverlay is position:absolute, so left/top use document coordinates.
		// Use pageX/pageY here; switching to clientX/clientY will misplace the overlay when scrolled.
		const offset = 20; // small gap from cursor
		let x = e.pageX + offset;
		let y = e.pageY + offset;

		// Keep overlay within viewport
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const rect = previewImg.getBoundingClientRect();

		if (x + rect.width > vw) x = e.pageX - rect.width - offset;
		if (y + rect.height > vh) y = e.pageY - rect.height - offset;

		overlay.style.left = `${x}px`;
		overlay.style.top = `${y}px`;
	}

	function startPreviewSlideshow(previewImages, previewImg) {
		// Clear any existing interval first to prevent duplicates
		stopPreviewSlideshow();

		if (previewImages.length <= 1) return;

		previewTimer = setInterval(() => {
			currentPreviewIndex = (currentPreviewIndex + 1) % previewImages.length;
			previewImg.src = previewImages[currentPreviewIndex];
		}, 500); // advance every 0.5 sec
	}

	function stopPreviewSlideshow() {
		if (previewTimer !== null) {
			clearInterval(previewTimer);
			previewTimer = null;
		}
		currentPreviewIndex = 0; // reset index
	}

	function bindPreviewOverlayGlobalCleanup() {
		window.addEventListener("blur", hidePreviewOverlay);
		document.addEventListener("visibilitychange", () => {
			if (document.hidden) {
				hidePreviewOverlay();
			}
		});
	}

	function getThumbnailImageForKey(key) {
		const entry = GDV.state.getThumbnails()[key];
		return entry ? entry.thumbnail_image : null;
	}

	function getPreviewImagesForKey(key) {
		const entry = GDV.state.getThumbnails()[key];
		return entry ? entry.preview_images : null;
	}

	function getSubUrl(gameUrl, path) {
		if (!gameUrl || typeof gameUrl !== "string") return path; // fallback if empty

		try {
			// Attempt proper URL resolution
			return new URL(path, gameUrl).toString();
		} catch {
			// Fallback: naive string concatenation with single slash
			let base = gameUrl.trim();
			if (!base.endsWith("/")) base += "/";
			if (path.startsWith("/")) path = path.slice(1);
			return base + path;
		}
	}

	function getSubUrlUsingString(gameUrl, path) {
		let base = gameUrl.trim();
		if (!base.endsWith("/")) base += "/";
		if (path.startsWith("/")) path = path.slice(1);
		return base + path;
	}

	function findIndexOfColumnByNameInTable(columnName) {
		if (!columnName) return null;
		const columnNameLower = columnName.toLowerCase();

		if (!columnIndexByNameMap) rebuildColumnIndexByNameMap();
		const columnIndex = columnIndexByNameMap.get(columnNameLower);
		if (columnIndex === undefined) return null;

		const dt = csvTableElement.DataTable();
		const currentColumnNameLower = dt.column(columnIndex).header()?.dataset?.columnKey?.toLowerCase();

		if (currentColumnNameLower !== columnNameLower) {
			rebuildColumnIndexByNameMap();
			return columnIndexByNameMap.get(columnNameLower) ?? null;
		}
		return columnIndex;
	}

	function rebuildColumnIndexByNameMap() {
		const dt = csvTableElement.DataTable();
		columnIndexByNameMap = new Map();

		dt.columns().indexes().each((i) => {
			const columnName = dt.column(i).header()?.dataset?.columnKey;
			if (columnName) columnIndexByNameMap.set(columnName.toLowerCase(), i);
		});
	}

	function findIndexOfColumnByNameInColumns(columns, columnName) {
		if (!Array.isArray(columns) || !columnName) return null;
		columnName = columnName.toLowerCase();
		const idx = columns.findIndex((col) => col?.title?.toLowerCase() === columnName);
		return idx !== -1 ? idx : null;
	}

	function getValueOfColumnFromRowElement(el, columnName) {
		const dt = csvTableElement.DataTable();
		const tr = el.closest("tr");
		if (!tr || !columnName) return null;

		const rowData = dt.row(tr).data();
		if (!rowData) return null;

		return rowData[columnName] ?? null;
	}

	function isWebUrl(text) {
		return /^https?:\/\//i.test(text);
	}

	function isWindowsPath(text) {
		return /^[a-zA-Z]:\\/.test(text);
	}

	function toFileUrl(path) {
		return `file:///${path.replace(/\\/g, "/")}`;
	}

	function isInvalidColumnIndex(columnIndex) {
		return columnIndex === null || columnIndex === -1;
	}

	function setSimilarityGame(gameName) {
		GDV.state.setSimilarityGame(gameName);
		GDV.dom.refreshMainPanelSimilarityGameSection();
	}

	function resetSimilarityGame() {
		GDV.state.resetSimilarityGame();
		GDV.dom.refreshMainPanelSimilarityGameSection();
	}

	// Delegated event listeners for thumbnails
	csvTableElement.off("mouseenter", ".table-thumbnail").on("mouseenter", ".table-thumbnail", function (e) {
		handleThumbnailMouseEnter(this, e);
	});

	csvTableElement.off("mouseleave", ".table-thumbnail").on("mouseleave", ".table-thumbnail", () => {
		handleThumbnailMouseLeave();
	});

	csvTableElement.off("mousemove", ".table-thumbnail").on("mousemove", ".table-thumbnail", (e) => {
		handleThumbnailMouseMove(e);
	});

	function handleThumbnailMouseEnter(el, e) {
		const key = getValueOfColumnFromRowElement(el, "key");
		if (!key) return;

		const previewImages = getPreviewImagesForKey(key);
		if (!previewImages || previewImages.length === 0) return;

		showPreviewOverlay(previewImages, e);
	}

	function handleThumbnailMouseLeave() {
		hidePreviewOverlay();
	}

	function handleThumbnailMouseMove(e) {
		lastMouseEvent = e;
		if (overlayMoveScheduled) return;

		overlayMoveScheduled = true;
		requestAnimationFrame(() => {
			movePreviewOverlay(lastMouseEvent);
			overlayMoveScheduled = false;
		});
	}
})();
