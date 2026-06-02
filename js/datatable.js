(() => {
	const csvTableElement = $("#csvTable");
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
		await GDV.loading.startLoading("var(--yellow)");
		await GDV.loading.updateLoadingDirectUpdate("Resetting filters...", 0);

		if (!$.fn.DataTable.isDataTable(csvTableElement)) {
			await GDV.loading.finishLoading();
			return;
		}
		const dt = csvTableElement.DataTable();

		// Native DOM queries
		const checkboxFilters = document.querySelectorAll("tr.filters .filter-checkbox");
		const textFilters = document.querySelectorAll("tr.filters .text-input-input");
		const rangeFilters = document.querySelectorAll("tr.filters .filter-range");

		// Reset column searches
		await GDV.loading.updateLoadingDirectUpdate("Resetting column searches...", 0);
		const colCount = dt.columns().count();

		for (let i = 0; i < colCount; i++) {
			dt.column(i).search("");

			await GDV.loading.updateLoadingStepProgress("Resetting column searches...", 0, 20, i + 1, colCount);
			if (GDV.loading.isLoadingCancelled()) break;
		}

		// Reset checkboxes
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

			await GDV.loading.updateLoadingStepProgress("Resetting checkbox filters...", 20, 40, i + 1, checkboxFilters.length);
			if (GDV.loading.isLoadingCancelled()) break;
		}

		// Reset text filters
		for (let i = 0; i < textFilters.length; i++) {
			const input = textFilters[i];
			input.value = "";
			input.dispatchEvent(new Event("keyup", { bubbles: true }));

			await GDV.loading.updateLoadingStepProgress("Resetting text filters...", 40, 60, i + 1, textFilters.length);
			if (GDV.loading.isLoadingCancelled()) break;
		}

		// Reset numeric range filters
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
				input.dispatchEvent(new Event("input", { bubbles: true }));
			});

			await GDV.loading.updateLoadingStepProgress("Resetting numeric range filters...", 60, 80, i + 1, rangeFilters.length);
			if (GDV.loading.isLoadingCancelled()) break;
		}

		// Reset column order if ColReorder is available
		if (dt.colReorder && typeof dt.colReorder.reset === "function") {
			dt.colReorder.reset();
		}

		// Reset sorting and redraw table
		await GDV.loading.updateLoadingDirectUpdate("Sorting the table...", 80);
		sortTable();
		await GDV.loading.updateLoadingDirectUpdate("Resetting Filters Complete.", 100);

		await GDV.loading.finishLoading();
	};

	GDV.datatable.getColumnDescription = getColumnDescription;
	function getColumnDescription(colName) {
		const description = GDV.state.getActiveColumnDetails()?.[colName]?.description || "";

		// If it's a site tag or unprefixed, skip regex completely
		if (colName.startsWith("site: ") || !colName.includes(": ")) {
			return description;
		}

		const filterName = GDV.utils.normalizeFilterName(colName);
		const pattern = GDV.state.getTagQuickSearchPatterns()?.[filterName]?.pattern;
		const patternDesc = pattern ? `Regex pattern:\n${pattern}` : "";

		return [description, patternDesc].filter(Boolean).join("\n");
	}

	GDV.datatable.getColumnTagCount = (colName) => GDV.state.getActiveColumnDetails()?.[colName]?.tag_count ?? null;

	function createTableColumns(parsedData) {
		if (!parsedData || !parsedData.length) return [];
		const columnNames = Object.keys(parsedData[0]);
		const columnDetails = GDV.state.getActiveColumnDetails();
		const columns = buildDataColumns(columnNames, columnDetails);

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
		const tbody = createTableBody();
		await appendRowsToTableInChunks(data, columns, tbody);
		await initializeDataTableWithOptions(columns);
		csvTableElement.show();
	}

	function buildDataColumns(columnNamesInTable, columnDetails) {
		const prefilterConditions = GDV.state.getPrefilterConditions();
		const prefilterAst = GDV.state.getPrefilterAst();
		const specialKeys = ["key", GDV.tableGenerator.getSimilarityScoreName()];
		const prefilterKeys = GDV.prefilter.collectColumnsFromAst(prefilterAst).filter((col) => !specialKeys.includes(col));

		const normalColumns = columnNamesInTable.filter((k) => shouldIncludeColumn(k, columnDetails, prefilterConditions));
		const prefilterColumns = prefilterKeys.filter(col => columnNamesInTable.includes(col));
		const specialColumns = columnNamesInTable.filter((col) => specialKeys.includes(col));
		const resultKeys = [...specialColumns, ...prefilterColumns, ...normalColumns.filter((col) => !specialColumns.includes(col) && !prefilterColumns.includes(col))];
		return resultKeys.map((columnName) => ({
			title: columnName,
			data: columnName,
			createdCell: (td, cellData) => {
				td.textContent = "";
				td.appendChild(renderCellValueNode(cellData, columnName));
			},
			white_highlight: prefilterColumns.includes(columnName),
			yellow_highlight: specialColumns.includes(columnName),
		}));
	}

	function buildThumbnailColumn() {
		if (!GDV.state.getThumbnails()) return null;

		return {
			title: "thumbnails",
			data: "__thumbnail__",
			orderable: false,
			searchable: false,
			render: (_data, _type, row) => {
				const key = row.key;
				if (!key) return "";
				const image_url = getThumbnailImageForKey(key);
				const game_url = stripHtmlToString(row.url);
				const vndb_url = stripHtmlToString(row.vndb_url);
				const vndb_character_count = row.vndb_character_count
				return renderThumbnail(image_url, game_url, vndb_url, vndb_character_count);
			},
		};
	}

	function buildViewImagesColumn(columnNames) {
		if (!columnNames.includes("location")) return null;

		return {
			title: "View Images",
			data: "__view_images__",
			orderable: false,
			searchable: false,
			createdCell: (td) => {
				td.textContent = "";
				td.appendChild(renderViewButton());
			},
		};
	}

	function shouldIncludeColumn(key, columnDetails, prefilterConditions) {
		const colDef = columnDetails[key];
		return !colDef || colDef.type !== "tag" || key in prefilterConditions;
	}

	function destroyExistingTable() {
		try {
			if ($.fn.DataTable.isDataTable(csvTableElement)) {
				csvTableElement.DataTable().destroy();
			}
		} catch (err) {
			GDV.utils.reportSoftWarning("Destroy DataTable Failed", "Failed to destroy existing DataTable.", err, { csvTableElement });
		} finally {
			clearTableRangeFilters();
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

	function createTableBody() {
		const tbody = document.createElement("tbody");
		csvTableElement.append(tbody);
		return tbody;
	}

	async function appendRowsToTableInChunks(data, columns, tbody) {
		const CHUNK_SIZE = 500;
		const totalRows = data.length;

		for (let start = 0; start < totalRows; start += CHUNK_SIZE) {
			if (GDV.loading.isLoadingCancelled()) throw new Error("Loading cancelled by user.");
			const chunk = data.slice(start, start + CHUNK_SIZE);
			const fragment = document.createDocumentFragment();
			chunk.forEach((rowData) => {
				const tr = document.createElement("tr");
				columns.forEach((col) => {
					const td = document.createElement("td");

					if (col.data === "__view_images__") {
						td.appendChild(renderViewButton());
					} else if (col.data === "__thumbnail__") {
						const key = rowData.key;
						const image_url = getThumbnailImageForKey(key);
						const game_url = stripHtmlToString(rowData.url);
						const vndb_url = stripHtmlToString(rowData.vndb_url);
						const vndb_character_count = rowData.vndb_character_count
						td.appendChild(renderThumbnail(key, image_url, game_url, vndb_url, vndb_character_count));
					} else if (col.data === "site_std_version") {
						const rd = rowData[col.data];
						const trimmed = typeof rd === "string" && rd.length > 19 ? `${rd.slice(0, 19)}…` : rd;
						td.appendChild(renderCellValueNode(trimmed, col.data));
					} else {
						td.appendChild(renderCellValueNode(rowData[col.data], col.data));
					}

					if (col.white_highlight) td.classList.add("white-highlight");
					else if (col.yellow_highlight) td.classList.add("yellow-highlight");
					tr.appendChild(td);
				});
				fragment.appendChild(tr);
			});
			tbody.appendChild(fragment);

			// Actual rows processed so far
			const rowsProcessed = Math.min(start + chunk.length, totalRows);
			await GDV.loading.updateLoadingStepProgress("Adding Rows to Table...", 80, 90, rowsProcessed, totalRows);
		}
		await GDV.loading.updateLoadingDirectUpdate("Rows Added to Table.", 90);
	}

	function initializeDataTableWithOptions(columns) {
		sortColumnName = getDefaultSortColumnName();
		let sortColumnIndex = findIndexOfColumnByNameInColumns(columns, sortColumnName);
		if (isInvalidColumnIndex(sortColumnIndex)) {
			GDV.utils.reportSoftWarning("Invalid Column Index", `Cannot sort by "${sortColumnName}": the column index is missing or invalid.`);
			sortColumnIndex = 0;
		}

		return new Promise((resolve) => {
			const dt = csvTableElement.DataTable({
				paging: true,
				pageLength: 100,
				order: [[sortColumnIndex, "desc"]],
				lengthMenu: [
					[50, 100, 200, 500, 1000],
					[50, 100, 200, 500, 1000],
				],
				fixedHeader: true,
				colReorder: true,
				autoWidth: false,
				orderCellsTop: true,

				dom: '<"top"lfip>rt<"bottom"lfip><"clear">',

				initComplete: async function () {
					const api = this.api();
					addHeaderTooltips(api);
					await addColumnFilters(api);
					resolve();
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
			const colName = header.textContent.trim();
			header.title = getColumnDescription(colName);
			return true; // satisfies Biome linter
		});
	}

	async function addColumnFilters(api) {
		const colCount = api.columns().count();
		const colDefs = GDV.state.getActiveColumnDetails() || {};
		const ths = document.querySelectorAll(".filters th");

		for (let colIdx = 0; colIdx < colCount; colIdx++) {
			if (GDV.loading.isLoadingCancelled()) throw new Error("Loading cancelled by user.");
			const column = api.column(colIdx);
			const th = ths[colIdx];
			if (!th) continue;
			if (th.querySelector(".filter-container")) continue;

			const container = document.createElement("div");
			container.className = "filter-container";
			th.appendChild(container);

			const colName = column.header().textContent.trim();
			const colDef = colDefs[colName];

			if (colName === "thumbnails") {
				addGameSimilaritySearch(container);
				continue;
			}
			if (!colDef) continue;
			addColumnFilterItems(container, column, colName, colDef, colIdx);

			await GDV.loading.updateLoadingStepProgress("Adding Column Filters...", 90, 99, colIdx + 1, colCount);
		}
		await GDV.loading.updateLoadingDirectUpdate("Finalizing Results...", 99);

		bindTableSortingButtons();
		setupFiltersExpandCollapse();
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

	async function addColumnFilterItems(container, column, colName, colDef, colIdx) {
		addSortingControls(container, colIdx);
		if (colDef.choices && colDef.choices.length > 0) {
			addCheckboxFilter(container, column, colName, colDef);
		} else if (colDef.type === "int" || colDef.type === "float") {
			addRangeFilter(container, column, colName, colDef);
		} else {
			addTextFilter(container, column, colName);
		}
	}

	async function addSortingControls(container, colIdx) {
		// Create a wrapper div for buttons
		const lineWrapper = document.createElement("div");
		lineWrapper.className = "filters-line-wrapper";

		// Create ascending button
		const asc = document.createElement("button");
		asc.className = "sort-asc btn";
		asc.dataset.colIdx = colIdx;
		asc.textContent = "Sort ↑";

		// Create descending button
		const desc = document.createElement("button");
		desc.className = "sort-desc btn";
		desc.dataset.colIdx = colIdx;
		desc.textContent = "Sort ↓";

		// Append buttons to the wrapper
		lineWrapper.append(asc);
		lineWrapper.append(desc);

		// Append the wrapper to the container
		container.append(lineWrapper);
	}

	function addCheckboxFilter(th, column, colName, colDef) {
		const box = document.createElement("div");
		box.className = "filter-checkbox";
		th.appendChild(box);

		// Sanitize column name for IDs
		const sanitizedColName = String(colName || "checkbox-filter")
			.replace(/\s+/g, "-")
			.replace(/[^\w-]/g, "");

		// Toggle All
		const toggleLabel = document.createElement("label");
		toggleLabel.className = "toggle-all-label";

		const toggleInput = document.createElement("input");
		toggleInput.type = "checkbox";
		toggleInput.className = "toggle-all";
		toggleInput.checked = true;
		toggleInput.id = `toggle-all-filter-${sanitizedColName}`;
		toggleInput.name = `toggleAll-filter-${sanitizedColName}`;

		toggleLabel.setAttribute("for", toggleInput.id);
		toggleLabel.appendChild(toggleInput);
		toggleLabel.append(" Toggle All");
		box.appendChild(toggleLabel);

		// Individual checkboxes
		colDef.choices.forEach((v, idx) => {
			const label = document.createElement("label");

			const input = document.createElement("input");
			input.type = "checkbox";
			input.value = v;
			input.checked = true;

			// Assign unique id and name for accessibility
			const sanitizedValue = String(v)
				.replace(/\s+/g, "-")
				.replace(/[^\w-]/g, "");
			input.id = `chk-filter-${sanitizedColName}-${sanitizedValue}-${idx}`;
			input.name = `chk-filter-${sanitizedColName}`;

			label.setAttribute("for", input.id);
			label.appendChild(input);
			label.append(` ${v}`);

			box.appendChild(label);
		});

		// Event delegation (single listener)
		box.addEventListener("change", (e) => {
			const target = e.target;

			// Toggle all handler
			if (target.classList.contains("toggle-all")) {
				const checked = target.checked;
				const allCheckboxes = box.querySelectorAll('input[type="checkbox"]:not(.toggle-all)');
				allCheckboxes.forEach((cb) => {
					cb.checked = checked;
					cb.dispatchEvent(new Event("change", { bubbles: true }));
				});
				return;
			}

			// Individual checkbox handler
			if (target.matches('input[type="checkbox"]:not(.toggle-all)')) {
				const checkedInputs = box.querySelectorAll('input[type="checkbox"]:not(.toggle-all):checked');
				const checkedVals = Array.from(checkedInputs).map((el) => el.value);

				toggleInput.checked = checkedVals.length === colDef.choices.length;

				let searchRegex;

				if (checkedVals.length === 0) {
					searchRegex = ""; // match everything
				} else if (checkedVals.length === colDef.choices.length) {
					searchRegex = "";
				} else {
					const escaped = checkedVals.map((v) => $.fn.dataTable.util.escapeRegex(v));
					searchRegex = `^(${escaped.join("|")})$`;
				}

				column.search(searchRegex, true, false).draw();
			}
		});
	}

	function addRangeFilter(th, column, colName, colDef) {
		// Container
		const box = document.createElement("div");
		box.className = "filter-range";
		th.appendChild(box);

		// Helper to sanitize column name for IDs
		const sanitizedName = String(colName || "range-filter")
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
		minInput.value = colDef.min ?? "";
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
		maxInput.value = colDef.max ?? "";
		maxWrapper.appendChild(maxInput);

		// Store original values in dataset
		box.dataset.originalMin = colDef.min ?? "";
		box.dataset.originalMax = colDef.max ?? "";

		const colIdx = column.index();
		const dataKey = column.dataSrc();
		const table = column.table();

		let minVal;
		let maxVal;

		// Single DataTables filter function
		const rangeFilter = (_settings, data) => {
			let rawVal;

			if (data == null) rawVal = undefined;
			else if (typeof data === "object" && !Array.isArray(data)) rawVal = data[dataKey];
			else if (Array.isArray(data)) rawVal = data[colIdx];
			else rawVal = data;

			const num = stripHtmlAndConvertToNumber(rawVal);
			if (Number.isNaN(num)) return true;

			if (minVal !== undefined && num < minVal) return false;
			if (maxVal !== undefined && num > maxVal) return false;

			return true;
		};

		const tableId = csvTableElement.id || "csvTable";
		rangeFilter._rangeFilterKey = `rangeFilter_${tableId}_${colIdx}`;

		$.fn.dataTable.ext.search.push(rangeFilter);

		function applyRangeFilter() {
			const minValRaw = parseFloat(minInput.value);
			const maxValRaw = parseFloat(maxInput.value);

			minVal = !Number.isNaN(minValRaw) ? minValRaw : undefined;
			maxVal = !Number.isNaN(maxValRaw) ? maxValRaw : undefined;

			table.draw();
		}

		// Event listeners for min/max inputs
		[minInput, maxInput].forEach((input) => {
			input.addEventListener("input", applyRangeFilter);
			input.addEventListener("change", applyRangeFilter);
		});

		// Apply filter initially
		applyRangeFilter();
	}

	function addTextFilter(th, column, colName) {
		// Wrapper div
		const wrapper = document.createElement("div");
		wrapper.className = "text-input-wrapper";
		th.appendChild(wrapper);

		// Create label for accessibility
		const label = document.createElement("label");
		label.className = "text-input-label";

		// Ensure colName is a string
		const sanitizedName = String(colName || "text-filter")
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

		// Event handler
		const handler = function () {
			column.search(this.value).draw();
		};

		input.addEventListener("keyup", handler);
		input.addEventListener("change", handler);
		input.addEventListener("input", handler);
	}

	function bindTableSortingButtons() {
		if (!csvTableElement.data("sortingButtonsBound")) {
			// Ascending sort buttons
			csvTableElement.on("click", ".sort-asc", function () {
				const dt = csvTableElement.DataTable();
				const colIdx = Number($(this).data("colIdx"));
				dt.order([colIdx, "asc"]).draw();
			});

			// Descending sort buttons
			csvTableElement.on("click", ".sort-desc", function () {
				const dt = csvTableElement.DataTable();
				const colIdx = Number($(this).data("colIdx"));
				dt.order([colIdx, "desc"]).draw();
			});

			// Mark as bound
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
		wrapper.appendChild(playRegion);

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

	function renderCellValueNode(val, colName = null) {
		if (val === undefined || val === null) return document.createTextNode("");

		const text = String(val).trim();

		// Excel-style HYPERLINK formula
		const hyperlinkMatch = text.match(/^=HYPERLINK\("([^"]+)",\s*"([^"]+)"\)$/i);
		if (hyperlinkMatch) {
			const [, rawPath, label] = hyperlinkMatch;
			return createHyperlinkNode(toFileUrl(rawPath), label);
		}

		// Web URLs
		if (/^https?:\/\//i.test(text)) {
			return createHyperlinkNode(text, text);
		}

		// Local Windows path
		if (/^[a-zA-Z]:\\/.test(text)) {
			return createHyperlinkNode(toFileUrl(text), text);
		}

		// Highlight numeric columns
		const highlightedNode = createHighlightedNode(text, colName);
		if (highlightedNode) {
			return highlightedNode;
		}

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

	// Small helper for hyperlink nodes
	function createHyperlinkNode(url, label) {
		const a = document.createElement("a");
		a.href = url;
		a.target = "_blank";
		a.rel = "noopener noreferrer";
		a.textContent = label;
		return a;
	}

	function createHighlightedNode(text, colName) {
		if (!colName) return null;

		const colDef = GDV.state.getActiveColumnDetails()?.[colName];
		if (!colDef) return null;
		const colNameLower = colName.toLowerCase();

		if (colDef.type === "int" || colDef.type === "float") {
			return GDV.dom.createHighlightFromValue(text, colName);
		} else if (colNameLower.includes("sentiment_label")) {
			return GDV.dom.createHighlightFromSentiment(text);
		} else if (colNameLower === "status") {
			return GDV.dom.createHighlightFromStatus(text);
		} else if (colNameLower === "play_time_label") {
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

	function clearTableRangeFilters() {
		// Get table ID using native DOM
		const tableId = csvTableElement.id || "csvTable";

		// Filter out any existing range filters
		$.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter((fn) => typeof fn._rangeFilterKey !== "string" || !fn._rangeFilterKey.startsWith(`rangeFilter_${tableId}_`));

		// Redraw table if it exists
		if ($.fn.DataTable.isDataTable(csvTableElement)) {
			csvTableElement.DataTable().draw(false);
		}
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

	function findIndexOfColumnByNameInTable(colName) {
		const dt = csvTableElement.DataTable();
		if (!colName) return null;
		const target = colName.toLowerCase();
		const colIdx = dt
			.columns()
			.indexes()
			.toArray()
			.find((i) => {
				const header = dt.column(i).header();
				const key = header?.dataset?.columnKey;
				return key && key.toLowerCase() === target;
			});
		return colIdx ?? null;
	}

	function findIndexOfColumnByNameInColumns(columns, colName) {
		if (!Array.isArray(columns) || !colName) return null;
		colName = colName.toLowerCase();

		const idx = columns.findIndex((col) => col?.title?.toLowerCase() === colName);

		return idx !== -1 ? idx : null;
	}

	function getValueOfColumnFromRowElement(el, colName) {
		const dt = csvTableElement.DataTable();
		const tr = el.closest("tr");
		if (!tr || !colName) return null;

		const rowData = dt.row(tr).data();
		if (!rowData) return null;

		// In this implementation, DataTables row data is always array-based (DOM-sourced, not object mode).
		// Case 1: object row (key-based)
		// if (typeof rowData === "object" && !Array.isArray(rowData)) {
		// 	return rowData[colName] ?? null;
		// }

		// Case 2: array row (index-based)
		const colIdx = findIndexOfColumnByNameInTable(colName);
		if (colIdx == null) return null;

		return rowData[colIdx] ?? null;
	}

	function toFileUrl(path) {
		if (path.startsWith("http")) return path;
		let urlPath = path.replace(/\\/g, "/");
		if (!urlPath.startsWith("/")) urlPath = `/${urlPath}`;
		return `file:///${urlPath}`;
	}

	function isInvalidColumnIndex(columnIndex) {
		return columnIndex === null || columnIndex === -1;
	}

	function stripHtmlAndConvertToNumber(text) {
		if (typeof text === "number") return text; // already a number
		if (typeof text !== "string") return NaN; // not parseable
		const cleaned = text
			.replace(/<[^>]*>/g, "") // remove HTML tags
			.replace(/,/g, "") // remove commas
			.replace(/\s+/g, "") // remove spaces inside numbers
			.trim();
		return parseFloat(cleaned);
	}

	function stripHtmlToString(text) {
		if (typeof text !== "string") return text;
		// Remove all HTML tags and trim
		return text.replace(/<[^>]*>/g, "").trim();
	}

	function setSimilarityGame(gameName) {
		GDV.state.setSimilarityGame(gameName);
		GDV.dom.refreshMainPanelSimilarityGameSection();
	}

	function resetSimilarityGame() {
		similarGameRow = null;
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
		const overlay = document.getElementById("previewOverlay");
		const previewImg = document.getElementById("previewImage");

		if (overlay) overlay.style.display = "none";
		if (previewImg) previewImg.src = "";

		stopPreviewSlideshow();
		currentPreviewIndex = 0;
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
