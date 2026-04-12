(() => {
	let searchText = null;
	let prefilterLiveState = {};
	let sortMode = "nearest";

	GDV.prefilter.getSearchText = () => searchText;

	GDV.prefilter.setSearchText = (searchText_) => {
		searchText = searchText_;
	};

	GDV.prefilter.getPrefilterLiveState = () => prefilterLiveState;

	GDV.prefilter.setPrefilterLiveState = (data) => {
		prefilterLiveState = data;
	};

	GDV.prefilter.resetPrefilterLiveState = () => {
		prefilterLiveState = {};
	};

	GDV.prefilter.toggleSortMode = () => {
		switch (sortMode) {
			case "usage":
				sortMode = "alpha";
				break;
			case "alpha":
				sortMode = "nearest";
				break;
			default:
				sortMode = "usage";
		}
	};

	GDV.prefilter.resetSortMode = () => {
		sortMode = "nearest";
	};

	GDV.prefilter.getSortButtonDisplayText = () => {
		switch (sortMode) {
			case "usage":
				return "Sort: Most Used";
			case "alpha":
				return "Sort: A–Z";
			case "nearest":
				return "Sort: Nearest Match";
			default:
				return "Sort";
		}
	};

	GDV.prefilter.getSortMode = () => sortMode;

	// Initialize liveState by scanning the form once (cheap)
	GDV.prefilter.initializeLiveStateFromForm = (form) => {
		prefilterLiveState = {};
		const colDefs = GDV.state.getActiveColumnDetails() || {};
		for (const col of Object.keys(colDefs)) {
			// Reuse the update logic; this does targeted queries per column
			updateLivePrefilterForColumn(form, col);
		}
	};

	// Delegated input/change binding (single handler per form)
	GDV.prefilter.bindPrefilterGridInputs = (form) => {
		form.addEventListener("input", (e) => {
			const input = e.target;
			if (!input || input.classList?.contains("prefilter-search-input") || !input.name) return;

			// Only text/textarea/range inputs
			if (input.type === "text" || input.tagName.toLowerCase() === "textarea" || input.classList.contains("range-input-min") || input.classList.contains("range-input-max")) {
				const col = input.name.replace(/__(min|max)$/, "");
				updateAllBasedFromFormColumnChanges(form, col);
			}
		});

		form.addEventListener("change", (e) => {
			const input = e.target;
			if (!input || input.classList?.contains("prefilter-search-input") || !input.name) return;

			// Only checkboxes, selects, or final number input state
			const col = input.name.replace(/__(min|max)$/, "");
			updateAllBasedFromFormColumnChanges(form, col);
		});
	};

	GDV.prefilter.updateLivePrefilterForColumn = updateLivePrefilterForColumn;
	function updateLivePrefilterForColumn(form, col) {
		const colDefs = GDV.state.getActiveColumnDetails() || {};
		const def = colDefs[col];
		if (!def) return;

		if (isNumericColumn(def)) {
			updateNumericPrefilter(form, col, def);
		} else if (isCheckboxColumn(form, col)) {
			updateCheckboxPrefilter(form, col, def);
		} else if (isTextColumn(form, col)) {
			updateTextPrefilter(form, col);
		} else {
			// fallback: remove from live state
			delete prefilterLiveState[col];
		}
	}

	GDV.prefilter.updatePrefilterActiveItems = updatePrefilterActiveItems;
	function updatePrefilterActiveItems(form, col) {
		const summary = form.querySelector("#prefilter-active-items");
		if (!summary) return;

		const val = prefilterLiveState[col];
		const activeItem = updateOrCreateActiveItem(summary, col, val);
		if (!activeItem) return;

		sortPrefilterActiveItems(summary);
	}

	GDV.prefilter.updatePrefilterWarningFromLiveState = updatePrefilterWarningFromLiveState;
	function updatePrefilterWarningFromLiveState() {
		if (!isPrefilterOpen()) return;

		const hasFilters = Object.keys(prefilterLiveState).length > 0;
		if (hasFilters) {
			GDV.prefilter.hidePrefilterWarning();
		} else {
			GDV.prefilter.showPrefilterWarning();
		}
	}

	GDV.prefilter.sortPrefilterActiveItems = sortPrefilterActiveItems;
	function sortPrefilterActiveItems(summary) {
		if (!summary) {
			return;
		}
		if (sortMode === "alpha") {
			sortPrefilterActiveItemsAlphabetically(summary);
		} else if (sortMode === "nearest") {
			sortPrefilterActiveItemsByUsage(summary);
			// sortPrefilterActiveItemsByNearestMatch(summary);
		} else {
			sortPrefilterActiveItemsByUsage(summary);
		}
	}

	function updateAllBasedFromFormColumnChanges(form, col) {
		updateLivePrefilterForColumn(form, col);
		updatePrefilterWarningFromLiveState();
		updatePrefilterActiveItems(form, col);
	}

	function isPrefilterOpen() {
		return !!document.getElementById("prefilterOverlay");
	}

	function updateNumericPrefilter(form, col, def) {
		const [minEl] = getFormElementsByName(form, `${col}__min`);
		const [maxEl] = getFormElementsByName(form, `${col}__max`);
		if (!minEl && !maxEl) {
			delete prefilterLiveState[col];
			return;
		}

		let min = minEl?.value === "" ? null : Number(minEl.value);
		let max = maxEl?.value === "" ? null : Number(maxEl.value);

		if (def.type === "int") {
			if (min != null) min = Math.round(min);
			if (max != null) max = Math.round(max);
		}

		if (min == null && max == null) delete prefilterLiveState[col];
		else prefilterLiveState[col] = { type: def.type, min, max };
	}

	function updateCheckboxPrefilter(form, col, def) {
		const checkboxes = getFormElementsByName(form, col).filter((e) => e.type === "checkbox");
		const checked = checkboxes.filter((c) => c.checked).map((c) => c.value);

		if (checked.length === 0 || checked.length === checkboxes.length) {
			delete prefilterLiveState[col];
		} else {
			const converted = checked.map((v) => convertCheckboxValue(v, def.type));
			prefilterLiveState[col] = { type: def.type, choices: converted };
		}
	}

	function updateTextPrefilter(form, col) {
		const textInputs = getFormElementsByName(form, col).filter((e) => e.tagName.toLowerCase() === "input" || e.tagName.toLowerCase() === "textarea");
		if (!textInputs.length) return;

		const val = textInputs[0].value?.trim();
		if (!val) delete prefilterLiveState[col];
		else prefilterLiveState[col] = { text: [val] };
	}

	function updateOrCreateActiveItem(summary, col, val) {
		const existingActiveItem = summary.querySelector(`[data-col="${col}"]`);
		if (!val) {
			if (existingActiveItem) existingActiveItem.remove();
			return null;
		}

		let activeItem = existingActiveItem;
		if (!activeItem) {
			activeItem = document.createElement("span");
			activeItem.className = "prefilter-active-item";
			activeItem.dataset.col = col;
			summary.appendChild(activeItem);
		}

		updateActiveItemContent(activeItem, col, val);
		return activeItem;
	}

	function updateActiveItemContent(activeItem, col, val) {
		const text = GDV.prefilter.getPrefilterDisplayText(col, val) || "";
		activeItem.textContent = `${text} `;
		activeItem.title = GDV.datatable.getColumnDescription(col) || "";
		activeItem.dataset.type = GDV.prefilter.getPrefilterDisplayType(val) || "";
		activeItem.appendChild(GDV.prefilter.renderRemoveButton(col));
	}

	function sortPrefilterActiveItemsAlphabetically(summary) {
		const itemsArray = Array.from(summary.querySelectorAll(".prefilter-active-item"));

		itemsArray.sort((a, b) => a.textContent.trim().localeCompare(b.textContent.trim()));

		itemsArray.forEach((c) => {
			summary.appendChild(c);
		});
	}

	/* function sortPrefilterActiveItemsByNearestMatch(summary) {
		const searchText = GDV.prefilter.getSearchText();
		if (!searchText) {
			// fallback to usage order if no search text
			sortPrefilterActiveItemsByUsage(summary);
			return;
		}

		const colDefs = GDV.state.getActiveColumnDetails() || {};
		const columnOrder = Object.keys(colDefs);

		const itemsArray = Array.from(summary.querySelectorAll(".prefilter-active-item"));

		// Compute distance cache
		const distanceCache = new Map();
		for (const activeItem of itemsArray) {
			const colName = activeItem.dataset.col;
			distanceCache.set(colName, GDV.utils.computeNearestMatchDistance(colName, searchText));
		}

		// Sort by distance, then by usage order
		itemsArray.sort((a, b) => {
			const distA = distanceCache.get(a.dataset.col);
			const distB = distanceCache.get(b.dataset.col);
			if (distA !== distB) return distA - distB;
			const usageA = columnOrder.indexOf(a.dataset.col);
			const usageB = columnOrder.indexOf(b.dataset.col);
			return usageA - usageB;
		});

		// Re-append in sorted order
		itemsArray.forEach((c) => {
			summary.appendChild(c)
		});
	} */

	function sortPrefilterActiveItemsByUsage(summary) {
		const colDefs = GDV.state.getActiveColumnDetails() || {};
		const columnOrder = Object.keys(colDefs);

		const itemsArray = Array.from(summary.querySelectorAll(".prefilter-active-item"));
		itemsArray.sort((a, b) => {
			const idxA = columnOrder.indexOf(a.dataset.col);
			const idxB = columnOrder.indexOf(b.dataset.col);
			return idxA - idxB;
		});

		itemsArray.forEach((c) => {
			summary.appendChild(c);
		});
	}

	function getFormElementsByName(form, name) {
		const el = form.elements[name];
		if (!el) return [];
		if (el instanceof RadioNodeList || Array.isArray(el)) return Array.from(el);
		return [el];
	}

	function convertCheckboxValue(val, type) {
		if (type === "bool") return val === "true";
		if (type === "int") return parseInt(val, 10);
		if (type === "float") return parseFloat(val);
		if (type === "tag") return parseInt(val, 10);
		if (type === "str") return String(val);
		// fallback: auto-detect numeric
		const num = Number(val);
		return Number.isFinite(num) ? (val.includes(".") ? parseFloat(val) : parseInt(val, 10)) : String(val);
	}

	// Determine column type
	function isNumericColumn(def) {
		return def.type === "int" || def.type === "float";
	}

	function isCheckboxColumn(form, col) {
		return getFormElementsByName(form, col).some((e) => e.type === "checkbox");
	}

	function isTextColumn(form, col) {
		return getFormElementsByName(form, col).some((e) => e.tagName.toLowerCase() === "input" || e.tagName.toLowerCase() === "textarea");
	}
})();
