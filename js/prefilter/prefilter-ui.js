(() => {
	const noPrefiltersLabel = "No Prefilters Applied";
	const noPrefiltersMessage = "Loading the entire dataset may consume significant memory and slow the table.";
	const visibleSectionsBatchSize = 99;
	const includeFullMatchLengthThreshold = 4;
	let isPrefilterSubmissionPending = false;
	let prefilterOverlay = null;
	let prefilterSectionArray = null;
	let maxVisibleSections = visibleSectionsBatchSize;
	let prefilterColumnToSearchInfoMap = new Map();
	let prefilterColumnToOrderMap = new Map();
	let similarityGameInputCommitTimer = null;
	let draggedColumnsToDisplayColumn = null;

	GDV.prefilter.initializePrefilterOverlayIfNeeded = initializePrefilterOverlayIfNeeded;
	function initializePrefilterOverlayIfNeeded() {
		if (!prefilterOverlay) {
			prefilterOverlay = createPrefilterOverlay();
		}
	}

	GDV.prefilter.showPrefilterOverlayAndCollectFilters = async (shouldRestore) => {
		try {
			initializePrefilterOverlayIfNeeded();
			const { overlay, form } = prefilterOverlay;

			if (shouldRestore) {
				resetForNewPrefilterOverlay(form);
			}
			showPrefilterOverlay();

			// Return a fresh Promise for this overlay opening; await keeps Promise rejections within this try/catch.
			return await new Promise((resolve) => {
				const cleanupFocus = showModalAccessibility(overlay, resolve);
				if (shouldRestore) {
					replacePrefiltersSummaryWithNewOne(form, resolve, cleanupFocus);
					restoreAndUpdateFromState(form);
				}
				waitForPrefilterFormSubmission(form, resolve, cleanupFocus);
			});
		} catch (err) {
			GDV.utils.reportSoftWarning("Prefilter UI Failure", "Prefilter overlay failed to initialize, continuing without prefiltering.", err);
			return {};
		}
	};

	GDV.prefilter.hidePrefilterWarning = hidePrefilterWarning;
	function hidePrefilterWarning() {
		GDV.utils.hideBannerWithLabel(noPrefiltersLabel);
	}

	GDV.prefilter.showPrefilterWarning = showPrefilterWarning;
	function showPrefilterWarning() {
		GDV.utils.hideBannerWithLabel(noPrefiltersLabel);
		GDV.utils.showPermanentWarningBanner(noPrefiltersLabel, noPrefiltersMessage);
	}

	function resetForNewPrefilterOverlay(form) {
		resetPrefilterSections(form);
	}

	function showPrefilterOverlay() {
		hidePrefilterWarning();
		if (prefilterOverlay?.overlay) {
			prefilterOverlay.overlay.style.display = "";
		}
	}

	function closePrefilterOverlay() {
		if (prefilterOverlay?.overlay) {
			prefilterOverlay.overlay.style.display = "none";
		}
	}

	function createPrefilterOverlay() {
		const overlay = createPrefilterOverlayContainer("Refine Your Search Using Prefilters");
		document.body.appendChild(overlay);
		overlay.style.display = "none";
		bindPrefilterOverlayDragAndDrop(overlay);
		overlay.appendChild(GDV.helpNotice.createHelpNotice());

		const form = document.createElement("form");
		form.className = "prefilter-form";
		overlay.appendChild(form);
		form.appendChild(createPrefilterSearchAndSummaryGroup(form));
		form.appendChild(createPrefilterGrid(GDV.state.getPrefilterConditions()));
		form.appendChild(createPrefilterGridLimitIndicator(form));
		form.appendChild(createPrefilterGridNoResultsDisplay());
		updatePrefilterSections(form);
		bindPrefilterGridInputs(form);
		return { overlay, form };
	}

	// Overlay container
	function createPrefilterOverlayContainer(title) {
		const overlay = document.createElement("div");
		overlay.id = "prefilterOverlay";
		overlay.className = "prefilter-overlay";
		overlay.setAttribute("role", "dialog");
		overlay.setAttribute("aria-modal", "true");

		const heading = document.createElement("h2");
		heading.id = "prefilterOverlayHeading";
		heading.textContent = title;
		overlay.appendChild(heading);
		overlay.setAttribute("aria-labelledby", "prefilterOverlayHeading");

		return overlay;
	}

	// Category dropdown, search box, summary, and loading indicator
	function createPrefilterSearchAndSummaryGroup(form) {
		const container = document.createElement("div");
		container.className = "prefilter-search-summary-group";
		container.appendChild(createPrefilterSearchAndCategoryGroup(form));
		container.appendChild(createPrefiltersSummary(form, null, null));
		container.appendChild(createPrefilterGridLoadingIndicator());
		return container;
	}

	// Category drop down and search box
	function createPrefilterSearchAndCategoryGroup(form) {
		const container = document.createElement("div");
		container.className = "prefilter-search-category-group";
		container.appendChild(createPrefilterCategoryLabelAndDropdown(form));
		container.appendChild(createPrefilterSearchBox(form));
		return container;
	}

	// Category drop down
	function createPrefilterCategoryLabelAndDropdown(form) {
		const container = document.createElement("div");
		container.className = "category-dropdown-container";
		const selectId = "category-dropdown-select";
		container.appendChild(createPrefilterCategoryLabel(selectId));
		container.appendChild(createPrefilterCategoryDropdown(form, selectId));
		return container;
	}

	function createPrefilterCategoryLabel(selectId) {
		const label = document.createElement("label");
		label.setAttribute("for", selectId);
		label.className = "prefilter-search-label";
		label.textContent = "Categories:";
		return label;
	}

	function createPrefilterCategoryDropdown(form, selectId) {
		const select = document.createElement("select");
		select.className = "category-dropdown-select";
		select.id = selectId;

		const columnCategoryDetails = GDV.state.getColumnCategoryDetails() || {};
		Object.keys(columnCategoryDetails).forEach((category) => {
			const opt = document.createElement("option");
			opt.value = category;
			opt.textContent = category;
			select.appendChild(opt);
		});

		select.addEventListener("change", () => {
			updatePrefilterCategorySummary(form, select);
			updatePrefilterSections(form);
		});
		return select;
	}

	function updatePrefilterCategorySummary(form, select) {
		const categoryElement = form.querySelector("#prefilter-selected-category");
		if (!categoryElement) return;
		categoryElement.dataset.value = select.value;
		categoryElement.textContent = select.selectedOptions[0]?.textContent || select.value;
	}

	// Search box
	function createPrefilterSearchBox(form) {
		// Container wrapper
		const container = document.createElement("div");
		container.className = "prefilter-search-box";

		// Label for accessibility
		const label = document.createElement("label");
		label.className = "prefilter-search-label";
		const inputId = "prefilter-search-input";
		label.setAttribute("for", inputId);
		label.textContent = "Search Prefilters: ";
		container.appendChild(label);

		// Input field
		const input = document.createElement("input");
		input.type = "text";
		input.placeholder = "Search prefilters to change...";
		input.className = "prefilter-search-input";
		input.id = inputId;
		input.name = inputId;

		/// Input and change event handler
		const handler = () => {
			handlePrefilterGridSearchInput(form);
		};

		input.addEventListener("input", handler);
		input.addEventListener("change", handler);

		container.appendChild(input);
		return container;
	}

	function replacePrefiltersSummaryWithNewOne(form, resolve, cleanupFocus) {
		const oldSummary = form.querySelector(".prefilter-summary-container");
		const newSummary = createPrefiltersSummary(form, resolve, cleanupFocus);
		if (oldSummary) {
			oldSummary.replaceWith(newSummary);
		}
	}

	function createPrefiltersSummary(form, resolve, cleanupFocus) {
		const container = document.createElement("div");
		container.className = "prefilter-summary-container";
		container.appendChild(createPrefiltersSummaryLeft());
		container.appendChild(createPrefiltersSummaryRight(form, resolve, cleanupFocus));
		return container;
	}

	function createPrefiltersSummaryLeft() {
		const leftGroup = document.createElement("div");
		leftGroup.className = "prefilter-summary-left";
		leftGroup.appendChild(createPrefilterExpressionSummary());
		leftGroup.appendChild(createColumnsToDisplaySummary());
		return leftGroup;
	}

	function createPrefilterExpressionSummary() {
		const prefilterExpressionSummary = document.createElement("div");
		prefilterExpressionSummary.className = "prefilter-expression-summary";

		const prefilterLabel = document.createElement("span");
		prefilterLabel.className = "prefilter-expression-label";
		prefilterLabel.textContent = "Prefilter Expression:";
		prefilterExpressionSummary.appendChild(prefilterLabel);

		const activeItems = document.createElement("div");
		activeItems.id = "prefilter-active-items";
		activeItems.className = "prefilter-active-items";
		prefilterExpressionSummary.appendChild(activeItems);
		return prefilterExpressionSummary;
	}

	function createColumnsToDisplaySummary() {
		const columnsToDisplaySummary = document.createElement("div");
		columnsToDisplaySummary.className = "columns-to-display-summary";

		const columnsToDisplayLabel = document.createElement("span");
		columnsToDisplayLabel.className = "prefilter-columns-to-display-label";
		columnsToDisplayLabel.textContent = "Columns to Display (drag to reorder):";
		columnsToDisplaySummary.appendChild(columnsToDisplayLabel);

		const columnsToDisplayItems = document.createElement("div");
		columnsToDisplayItems.id = "prefilter-columns-to-display-items";
		columnsToDisplayItems.className = "prefilter-columns-to-display-items";
		bindColumnsToDisplayDragAndDrop(columnsToDisplayItems);
		columnsToDisplaySummary.appendChild(columnsToDisplayItems);

		return columnsToDisplaySummary;
	}

	function createPrefiltersSummaryRight(form, resolve, cleanupFocus) {
		const rightGroup = document.createElement("div");
		rightGroup.className = "prefilter-summary-right";
		rightGroup.appendChild(createPrefiltersSummaryActionButtonsRow(resolve, cleanupFocus));
		rightGroup.appendChild(createPrefiltersSummaryPrefilterButtonsRow(form));
		rightGroup.appendChild(createPrefilterSimilarityGameRow());
		rightGroup.appendChild(createPrefilterSimilarityScopeRow());
		rightGroup.appendChild(createPrefiltersSummaryCategoryRow(form));
		return rightGroup;
	}

	function createPrefiltersSummaryActionButtonsRow(resolve, cleanupFocus) {
		const buttonWrapper = document.createElement("div");
		buttonWrapper.className = "prefilter-summary-row";
		buttonWrapper.appendChild(createPrefiltersCloseButton(resolve, cleanupFocus));
		buttonWrapper.appendChild(createPrefilterSubmitButton("Generate Table"));
		return buttonWrapper;
	}

	function createPrefiltersSummaryPrefilterButtonsRow(form) {
		const buttonWrapper = document.createElement("div");
		buttonWrapper.className = "prefilter-summary-row";
		buttonWrapper.appendChild(createFixExpressionButton(form));
		buttonWrapper.appendChild(createCopyClipboardButton(form));
		buttonWrapper.appendChild(createPasteClipboardButton(form));
		buttonWrapper.appendChild(createPrefiltersResetButton(form));
		return buttonWrapper;
	}

	function createPrefilterSimilarityGameRow() {
		const similarityWrapper = document.createElement("div");
		similarityWrapper.className = "prefilter-summary-row";
		similarityWrapper.appendChild(createPrefilterSimilarityLabel("Find games similar to:"));
		similarityWrapper.appendChild(createPrefilterSimilarityGameInput());
		return similarityWrapper;
	}

	function createPrefilterSimilarityScopeRow() {
		const similarityWrapper = document.createElement("div");
		similarityWrapper.className = "prefilter-summary-row";
		similarityWrapper.appendChild(createPrefilterSimilarityLabel("Look for similarities in:"));
		similarityWrapper.appendChild(createPrefilterSimilarityScopeDropDown());
		return similarityWrapper;
	}

	function createPrefilterSimilarityLabel(labelText) {
		const label = document.createElement("span");
		label.className = "prefilter-similarity-label";
		label.textContent = labelText;
		return label;
	}

	function createPrefilterSimilarityGameInput() {
		clearSimilarityGameInputCommitTimer();

		const similarityGameInputWrapper = document.createElement("div");
		similarityGameInputWrapper.className = "prefilter-summary-input-wrapper";

		const similarityInput = document.createElement("input");
		similarityInput.className = "similarity-criteria-game-input similarity-criteria-input-item-width";
		similarityInput.type = "text";
		similarityInput.name = "prefilterSimilaritySearch";
		similarityInput.placeholder = "Find a game...";
		similarityInput.spellcheck = false;
		similarityGameInputWrapper.appendChild(similarityInput);

		const ghostText = document.createElement("div");
		ghostText.className = "similarity-criteria-game-input-ghost similarity-criteria-game-input-ghost-prefilter-extra";
		similarityGameInputWrapper.appendChild(ghostText);

		const existingGame = GDV.state.getSimilarityReferenceGame();
		if (existingGame) {
			similarityInput.value = existingGame;
			ghostText.textContent = "";
		}

		similarityInput.addEventListener("input", function () {
			clearSimilarityGameInputCommitTimer();
			const query = this.value.trim();
			if (!query) {
				resetSimilarityBecauseOfEmptyInput(ghostText);
				return;
			}
			const nearest = GDV.utils.findNearestGameKey(query);
			ghostText.textContent = nearest.toLowerCase() !== query.toLowerCase() ? nearest : "";
			similarityGameInputCommitTimer = setTimeout(() => { commitSimilarityGameInput(similarityInput, ghostText); }, 2000);
		});

		return similarityGameInputWrapper;
	}

	function commitSimilarityGameInput(similarityInput, ghostText) {
		similarityGameInputCommitTimer = null;
		const query = similarityInput.value.trim();
		if (!query) {
			resetSimilarityBecauseOfEmptyInput(ghostText);
			return;
		}
		const nearest = GDV.utils.findNearestGameKey(query);
		similarityInput.value = nearest;
		ghostText.textContent = "";
		GDV.state.setSimilarityReferenceGame(nearest);
		GDV.dom.syncSimilarityGameInputs(nearest);
	}

	function resetSimilarityBecauseOfEmptyInput(ghostText) {
		ghostText.textContent = "";
		GDV.state.resetSimilarityReferenceGame();
		GDV.dom.resetSimilarityGameInputs();
	}

	function createPrefilterSimilarityScopeDropDown() {
		const select = document.createElement("select");
		select.className = "similarity-scope-dropdown-select similarity-criteria-input-item-width";

		const columnCategoryDetails = GDV.state.getColumnCategoryDetails() || {};
		Object.keys(columnCategoryDetails).forEach((category) => {
			const opt = document.createElement("option");
			opt.value = category;
			opt.textContent = category;
			select.appendChild(opt);
		});

		const existingScope = GDV.state.getSimilarityComparisonScope();
		if (existingScope) {
			select.value = existingScope;
		}

		select.addEventListener("change", () => {
			GDV.state.setSimilarityComparisonScope(select.value);
			GDV.dom.syncSimilarityScopeDropdowns(select.value);
		});
		return select;
	}

	function createPrefiltersSummaryCategoryRow(form) {
		const categoryWrapper = document.createElement("div");
		categoryWrapper.className = "prefilter-summary-category";
		const categoryLabel = document.createElement("span");
		categoryLabel.className = "prefilter-summary-label";
		categoryLabel.textContent = "Currently Viewing:";
		categoryWrapper.appendChild(categoryLabel);

		const categoryElement = document.createElement("span");
		categoryElement.id = "prefilter-selected-category";
		categoryElement.className = "prefilter-summary-category-value";
		categoryElement.dataset.value = "All Categories";
		categoryElement.textContent = "All Categories";
		categoryWrapper.appendChild(categoryElement);
		categoryWrapper.appendChild(createPrefilterSortButton(form));
		return categoryWrapper;
	}

	function createPrefilterSubmitButton(label = "Submit") {
		const btn = document.createElement("button");
		btn.type = "submit";
		btn.textContent = label;
		btn.className = "btn btn-main";
		return btn;
	}

	function createPrefiltersResetButton(form) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.textContent = "Reset Prefilters";
		btn.className = "btn btn-reset";
		btn.addEventListener("click", () => resetPrefilters(form));
		return btn;
	}

	function createFixExpressionButton(form) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.textContent = "Fix Expression";
		btn.className = "btn btn-reset";
		btn.addEventListener("click", () => {
			GDV.prefilter.normalizePrefilterAst();
			updateSummariesAndWarning(form);
		});
		return btn;
	}

	function createCopyClipboardButton(form) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.textContent = "Copy Prefilters";
		btn.className = "btn btn-reset";
		btn.addEventListener("click", () => {
			GDV.prefilter.copyPrefiltersToClipboard();
			updateSummariesAndWarning(form);
			GDV.utils.showInfoBanner("Prefilters Copied", "The prefilter expression and conditions have been copied to your clipboard.");
		});
		return btn;
	}

	function createPasteClipboardButton(form) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.textContent = "Paste Prefilters";
		btn.className = "btn btn-reset";
		btn.addEventListener("click", async () => {
			hidePrefilterWarning();
			GDV.prefilter.resetPrefilterAndColumnsToDisplay();

			await GDV.prefilter.pastePrefiltersFromClipboard();
			GDV.prefilter.applyPrefilterConditionsAndColumnsToDisplayToForm(form);
			updateSummariesAndWarning(form);
		});
		return btn;
	}

	function createPrefiltersCloseButton(resolve, cleanupFocus) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.textContent = "Close";
		btn.className = "btn btn-danger btn-close";
		btn.addEventListener("click", () => {
			if (isPrefilterSubmissionPending) return;
			if (cleanupFocus) cleanupFocus();
			finalizeAndClose();
			resolve(null);
		});
		return btn;
	}

	function createPrefilterSortButton(form) {
		GDV.prefilter.resetSortMode();
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "btn";
		btn.textContent = GDV.prefilter.getSortButtonDisplayText();
		btn.addEventListener("click", () => {
			GDV.prefilter.toggleSortMode();
			btn.textContent = GDV.prefilter.getSortButtonDisplayText();
			updatePrefilterSections(form, true);
		});
		return btn;
	}

	function createPrefilterGridLoadingIndicator() {
		const loader = document.createElement("div");
		loader.className = "prefilter-grid-loading-indicator";
		loader.setAttribute("role", "status");
		loader.setAttribute("aria-live", "polite");
		loader.style.display = "none";

		const spinner = document.createElement("div");
		spinner.className = "prefilter-grid-loading-spinner";
		const text = document.createElement("span");
		text.className = "prefilter-grid-loading-text";
		text.textContent = "Searching prefilters...";

		loader.appendChild(spinner);
		loader.appendChild(text);
		return loader;
	}

	function createPrefilterGrid(prefill) {
		const grid = document.createElement("div");
		grid.className = "prefilter-grid";
		const columnDetails = GDV.state.getColumnDetails() || {};
		const tagFullMatchPatterns = GDV.state.getTagFullMatchPatterns() || {};
		const tagQuickSearchPatterns = GDV.state.getTagQuickSearchPatterns() || {};
		const columnOrder = Object.keys(columnDetails);
		const savedColumnsToDisplaySet = new Set(GDV.state.getColumnsToDisplay() || []);
		prefilterColumnToOrderMap = new Map(columnOrder.map((column, i) => [column, i]));
		prefilterColumnToSearchInfoMap = new Map();
		for (const [columnName, columnDetail] of Object.entries(columnDetails)) {
			const section = createFilterSectionForColumnDetails(columnName, columnDetail, prefill[columnName], savedColumnsToDisplaySet);
			grid.appendChild(section);

			const filterName = GDV.utils.normalizeFilterName(columnName);
			const fullMatchRegex = tagFullMatchPatterns.get(filterName) ?? null;
			const quickSearchRegex = tagQuickSearchPatterns.get(filterName) ?? null;
			prefilterColumnToSearchInfoMap.set(columnName, {
				loweredDescription: columnDetail?.type === "tag" ? "" : columnDetail?.description?.toLowerCase() || "",
				fullMatchRegex,
				quickSearchRegex
			});
		}
		prefilterSectionArray = Array.from(grid.querySelectorAll(".prefilter-section"));
		return grid;
	}

	function createFilterSectionForColumnDetails(column, columnDetail, prefill, savedColumnsToDisplaySet) {
		const section = document.createElement("section");
		section.className = "prefilter-section";
		section.dataset.col = String(column);
		// Avoid storing description strings on every prefilter section to reduce memory usage.
		// section.title = GDV.datatable.getColumnDescription(column);

		const header = document.createElement("header");
		header.className = "prefilter-section-header";
		const title = document.createElement("h3");
		title.textContent = column;
		header.appendChild(title);
		header.appendChild(createColumnDisplayToggle(column, prefill != null, savedColumnsToDisplaySet));
		section.appendChild(header);

		if (columnDetail.type === "tag") {
			section.appendChild(createTagFilter(column, prefill));
		} else if (Array.isArray(columnDetail.choices) && columnDetail.choices.length > 0) {
			section.appendChild(createChoiceFilter(column, columnDetail.choices, prefill));
		} else if (columnDetail.type === "int" || columnDetail.type === "float") {
			section.appendChild(createRangeFilter(column, columnDetail.min, columnDetail.max, prefill));
		} else {
			section.appendChild(createTextFilterInput(column, prefill));
		}

		const tagCount = GDV.datatable.getColumnTagCount(column);
		if (tagCount != null) {
			const footer = document.createElement("div");
			footer.className = "prefilter-footer";
			footer.textContent = `${tagCount} matches`;
			section.appendChild(footer);
		}
		return section;
	}

	function createColumnDisplayToggle(column, isPrefilterActive, savedColumnsToDisplaySet) {
		const toggle = document.createElement("button");
		toggle.type = "button";
		toggle.className = "prefilter-column-to-display-toggle";
		toggle.textContent = "👁︎";
		toggle.name = column;
		toggle.isOn = savedColumnsToDisplaySet.has(column) && !isPrefilterActive;
		GDV.prefilter.updateColumnDisplayToggleState(toggle);

		toggle.addEventListener("click", () => {
			toggle.isOn = !toggle.isOn;
			GDV.prefilter.updateColumnDisplayToggleState(toggle);
			if (toggle.isOn) {
				GDV.prefilter.addColumnsToDisplay(column);
			} else if (!GDV.prefilter.getPrefilterConditions()[column]) {
				GDV.prefilter.removeColumnsToDisplay(column);
			}
			const form = toggle.closest(".prefilter-form");
			if (form) updateColumnsToDisplaySummary(form);
		});
		return toggle;
	}

	function createPrefilterGridLimitIndicator(form) {
		const indicator = document.createElement("div");
		indicator.className = "prefilter-grid-limit-indicator";
		indicator.dataset.hiddenPastLimit = 0;

		const textSpan = document.createElement("span");
		textSpan.className = "hidden-past-limit";
		textSpan.textContent = "0";
		indicator.appendChild(document.createTextNode("...and "));
		indicator.appendChild(textSpan);
		indicator.appendChild(document.createTextNode(" more hidden "));

		const showMoreBtn = document.createElement("button");
		showMoreBtn.className = "btn btn-show-more";
		showMoreBtn.type = "button";
		showMoreBtn.textContent = "Show More";

		showMoreBtn.addEventListener("click", () => {
			maxVisibleSections += visibleSectionsBatchSize;
			filterPrefilterSections(form);
		});

		indicator.appendChild(showMoreBtn);
		return indicator;
	}

	function createPrefilterGridNoResultsDisplay() {
		const element = document.createElement("div");
		element.className = "prefilter-grid-no-results";
		element.textContent = "No matching prefilters found.";
		element.style.display = "none";
		return element;
	}

	// Tag checkboxes
	function createTagFilter(name, prefill = null) {
		const container = document.createElement("div");
		container.className = "prefilter-tag-group";
		const checkedValues = Array.isArray(prefill?.choices) ? prefill.choices : [];

		// Helper to create individual checkboxes
		function createCheckbox(value, labelText) {
			const label = document.createElement("label");
			label.className = "prefilter-checkbox";

			const input = document.createElement("input");
			input.type = "checkbox";
			input.name = name;
			input.value = String(value);
			input.dataset.prefilterColumn = name;

			// Generate a unique id for accessibility
			const sanitizedName = name.replace(/\s+/g, "-").replace(/[^\w-]/g, "");
			input.id = `prefilter-${sanitizedName}-${value}`;

			// Check if this value should be pre-checked
			input.checked = checkedValues.includes(value) || checkedValues.includes(String(value));

			label.setAttribute("for", input.id);
			label.appendChild(input);
			label.appendChild(document.createTextNode(` ${labelText}`));

			return label;
		}

		// Create No (0) and Yes (1) checkboxes
		const checkboxNo = createCheckbox(0, "No (0)");
		const checkboxYes = createCheckbox(1, "Yes (1)");
		container.appendChild(checkboxNo);
		container.appendChild(checkboxYes);

		return container;
	}

	// Choice checkbox group with toggle-all
	function createChoiceFilter(name, choices, prefill = null) {
		const container = document.createElement("div");
		container.className = "prefilter-box";
		const checkedValues = Array.isArray(prefill?.choices) ? prefill.choices : [];

		// Helper to sanitize names/ids
		const sanitizedName = String(name)
			.replace(/\s+/g, "-")
			.replace(/[^\w-]/g, "");

		// Create toggle-all checkbox
		const toggleLabel = document.createElement("label");
		toggleLabel.className = "toggle-all-label";

		const toggleInput = document.createElement("input");
		toggleInput.type = "checkbox";
		toggleInput.className = "toggle-all";
		toggleInput.id = `toggle-all-prefilter-${sanitizedName}`;
		toggleInput.name = `toggleAll-prefilter-${sanitizedName}`;

		toggleInput.checked = choices.every((choice) => checkedValues.includes(choice) || checkedValues.includes(String(choice)));

		toggleLabel.setAttribute("for", toggleInput.id);
		toggleLabel.appendChild(toggleInput);
		toggleLabel.appendChild(document.createTextNode(" Toggle All"));
		container.appendChild(toggleLabel);

		// Create individual choice checkboxes
		choices.forEach((choice, idx) => {
			const label = document.createElement("label");
			label.className = "prefilter-checkbox";

			const input = document.createElement("input");
			input.type = "checkbox";
			input.name = name;
			input.value = String(choice);
			input.dataset.prefilterColumn = name;
			input.checked = checkedValues.includes(choice) || checkedValues.includes(String(choice));

			// Unique ID for accessibility
			const choiceId = `chk-prefilter-${sanitizedName}-${idx}`;
			input.id = choiceId;
			label.setAttribute("for", choiceId);

			label.appendChild(input);
			label.appendChild(document.createTextNode(` ${String(choice)}`));

			container.appendChild(label);
		});

		const childCheckboxes = container.querySelectorAll(`input[name="${name}"]`);

		// Keep toggle-all state updated when children change
		childCheckboxes.forEach((cb) => {
			cb.addEventListener("change", () => {
				toggleInput.checked = Array.from(childCheckboxes).every((i) => i.checked);
			});
		});

		// Toggle-all handler sets all children
		toggleInput.addEventListener("change", () => {
			childCheckboxes.forEach((cb) => {
				cb.checked = toggleInput.checked;
			});
			if (childCheckboxes.length > 0) {
				const evt = new Event("change", { bubbles: true });
				childCheckboxes[0].dispatchEvent(evt);
			}
		});

		return container;
	}

	// Range prefilter (min / max inputs)
	function createRangeFilter(name, min = null, max = null, prefill = null) {
		const wrapper = document.createElement("div");
		wrapper.className = "prefilter-range";

		const minVal = prefill?.min != null ? prefill.min : "";
		const maxVal = prefill?.max != null ? prefill.max : "";

		const minWrap = document.createElement("div");
		minWrap.className = "range-input-wrapper";
		minWrap.appendChild(createNumberInput(`${name}__min`, minVal, "Min", "range-input-min", String(min ?? ""), name));

		const maxWrap = document.createElement("div");
		maxWrap.className = "range-input-wrapper";
		maxWrap.appendChild(createNumberInput(`${name}__max`, maxVal, "Max", "range-input-max", String(max ?? ""), name));

		wrapper.appendChild(minWrap);
		wrapper.appendChild(maxWrap);
		return wrapper;
	}

	// Create a labeled number input
	function createNumberInput(name, value = null, labelText = "", inputClass = "", placeholder = "", prefilterColumn = null) {
		const container = document.createElement("div");
		container.className = "number-input-wrapper";

		// Sanitize name for id
		const sanitizedName = String(name)
			.replace(/\s+/g, "-")
			.replace(/[^\w-]/g, "");
		const inputId = `number-${sanitizedName}`;

		// Label
		const label = document.createElement("label");
		label.className = "range-input-label";
		label.setAttribute("for", inputId);
		label.textContent = labelText;
		container.appendChild(label);

		// Input
		const input = document.createElement("input");
		input.type = "number";
		input.id = inputId;
		input.name = name;
		if (prefilterColumn) input.dataset.prefilterColumn = prefilterColumn;
		input.step = "any";
		input.min = "";
		input.max = "";
		if (inputClass) input.className = inputClass;

		if (value !== null && value !== undefined && value !== "") {
			input.value = value;
		} else if (placeholder) {
			input.placeholder = placeholder;
		}

		// Prevent default invalid behavior
		input.addEventListener("invalid", (e) => e.preventDefault());

		container.appendChild(input);
		return container;
	}

	// Text input prefilter (fallback)
	function createTextFilterInput(name, prefill = null) {
		const container = document.createElement("div");
		container.className = "text-input-wrapper";

		// Sanitize name for ID
		const sanitizedName = String(name)
			.replace(/\s+/g, "-")
			.replace(/[^\w-]/g, "");
		const inputId = `text-filter-${sanitizedName}`;

		// Label for accessibility
		const label = document.createElement("label");
		label.setAttribute("for", inputId);
		label.className = "text-input-label";
		label.textContent = `Filter:`;
		container.appendChild(label);

		// Input element
		const input = document.createElement("input");
		input.type = "text";
		input.id = inputId;
		input.name = name;
		input.dataset.prefilterColumn = name;
		input.className = "text-input-input";
		input.placeholder = `Prefilter ${name}...`;

		if (prefill?.text?.[0] !== undefined) {
			input.value = prefill.text[0];
		}

		container.appendChild(input);
		return container;
	}

	function createPrefilterAstToolbarIfNeeded(form) {
		const activeItems = form.querySelector("#prefilter-active-items");
		if (!activeItems) return null;
		let toolbar = activeItems.querySelector(".prefilter-ast-toolbar");
		if (toolbar) return toolbar;

		toolbar = document.createElement("div");
		toolbar.className = "prefilter-ast-toolbar";
		activeItems.appendChild(toolbar);
		return toolbar;
	}

	function createPrefilterAstGroup(form, node) {
		const prefilterAstCurrentNode = GDV.prefilter.getPrefilterAstCurrentNode();
		const astGroup = document.createElement("span");
		astGroup.className = "prefilter-ast-group";
		if (node === prefilterAstCurrentNode) astGroup.classList.add("is-focused");
		bindPrefilterAstNodeFocus(form, astGroup, node);
		return astGroup;
	}

	function createPrefilterActiveItem(form, node) {
		const prefilterConditions = GDV.prefilter.getPrefilterConditions();
		const prefilterAstCurrentNode = GDV.prefilter.getPrefilterAstCurrentNode();
		const column = node.column;
		const value = prefilterConditions[column];
		if (!value) return null;

		const activeItem = document.createElement("span");
		activeItem.className = "prefilter-active-item";
		activeItem.dataset.col = column;
		if (node === prefilterAstCurrentNode) {
			activeItem.classList.add("is-focused");
		}
		const text = GDV.prefilter.getPrefilterDisplayText(column, value) || "";
		activeItem.textContent = `${text} `;
		activeItem.title = GDV.datatable.getColumnDescription(column) || "";
		activeItem.dataset.type = GDV.prefilter.getPrefilterDisplayType(value) || "";
		activeItem.appendChild(createPrefilterActiveItemRemoveButton(form, column, activeItem.dataset.type));
		bindPrefilterAstNodeFocus(form, activeItem, node);

		return activeItem;
	}

	function createAstOperator(form, node, type) {
		const operator = document.createElement("span");
		operator.className = "prefilter-ast-operator";
		operator.textContent = type;
		bindPrefilterAstNodeFocus(form, operator, node);
		return operator;
	}

	function createAstParenthesis(text) {
		const el = document.createElement("span");
		el.className = "prefilter-ast-parenthesis";
		el.textContent = text;
		return el;
	}

	function createPrefilterActiveItemRemoveButton(form, column, type) {
		const removeButton = document.createElement("button");
		removeButton.type = "button";
		removeButton.className = "prefilter-remove-btn";
		removeButton.textContent = "×";
		removeButton.setAttribute("aria-label", `Remove prefilter for ${column}`);
		removeButton.addEventListener("click", (e) => {
			e.stopPropagation();
			removeColumnWithTypeAndUpdateAll(form, column, type)
		});
		return removeButton;
	}

	function createToolbarContent(form, node) {
		const container = document.createElement("div");
		container.className = "prefilter-ast-toolbar-inner";
		container.appendChild(createToolbarRemoveButton(form, node));
		container.appendChild(createToolbarNotButton(form, node));
		container.appendChild(createToolbarAndButton(form, node));
		container.appendChild(createToolbarOrButton(form, node));
		container.appendChild(createToolbarMoveInButton(form, node));
		container.appendChild(createToolbarMoveOutButton(form, node));
		return container;
	}

	function createToolbarRemoveButton(form, node) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "btn btn-toolbar";
		button.textContent = "Remove";
		button.addEventListener("click", (e) => {
			e.stopPropagation();
			GDV.prefilter.removeFromPrefilterAndColumnsToDisplay(form, node);
			updateSummariesAndWarning(form);
		});
		return button;
	}

	function createToolbarNotButton(form, node) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "btn btn-toolbar";
		button.textContent = "Not";
		button.addEventListener("click", (e) => {
			e.stopPropagation();
			GDV.prefilter.applyNotToNode(node);
			updateSummariesAndWarning(form);
		});
		return button;
	}

	function createToolbarAndButton(form, node) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "btn btn-toolbar";
		button.textContent = "And";
		button.addEventListener("click", (e) => {
			e.stopPropagation();
			GDV.prefilter.applyAndToNode(node);
			updateSummariesAndWarning(form);
		});
		return button;
	}

	function createToolbarOrButton(form, node) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "btn btn-toolbar";
		button.textContent = "Or";
		button.addEventListener("click", (e) => {
			e.stopPropagation();
			GDV.prefilter.applyOrToNode(node);
			updateSummariesAndWarning(form);
		});
		return button;
	}

	function createToolbarMoveInButton(form, node) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "btn btn-toolbar";
		button.textContent = "Group In";
		button.addEventListener("click", (e) => {
			e.stopPropagation();
			GDV.prefilter.moveNodeIntoGroup(node);
			updateSummariesAndWarning(form);
		});
		return button;
	}

	function createToolbarMoveOutButton(form, node) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "btn btn-toolbar";
		button.textContent = "Group Out";
		button.addEventListener("click", (e) => {
			e.stopPropagation();
			GDV.prefilter.moveNodeOutOfGroup(node);
			updateSummariesAndWarning(form);
		});
		return button;
	}

	function removeColumnWithTypeAndUpdateAll(form, column, type) {
		clearActiveItemParametersWithType(form, column, type);
		updateAllBasedFromActiveItemParametersChanges(form, column);
	}

	function updateAllBasedFromActiveItemParametersChanges(form, column) {
		GDV.prefilter.updatePrefilterAndColumnsToDisplayForColumn(form, column);
		updateSummariesAndWarning(form);
	}

	function updateSummariesAndWarning(form) {
		updatePrefilterActiveItemsSummary(form);
		updateColumnsToDisplaySummary(form);
		updatePrefilterWarning();
	}

	function updatePrefilterActiveItemsSummary(form) {
		const activeItems = form.querySelector("#prefilter-active-items");
		if (!activeItems) return;

		const prefilterAst = GDV.prefilter.getPrefilterAst();
		if (!prefilterAst) {
			activeItems.replaceChildren();
			return;
		}
		const prefilterAstDisplay = createPrefilterAstDisplay(form, prefilterAst, prefilterAst);
		if (prefilterAstDisplay) {
			activeItems.replaceChildren(prefilterAstDisplay);
		} else {
			activeItems.replaceChildren();
		}
		renderPrefilterAstToolbar(form);
	}

	function createPrefilterAstDisplay(form, node, root) {
		if (!node) return null;
		switch (node.ast_type) {
			case "VALUE":
				return createPrefilterActiveItem(form, node);
			case "NOT": {
				const container = createPrefilterAstGroup(form, node);
				container.appendChild(createAstOperator(form, node, "NOT"));
				if (node.child.ast_type === "VALUE" || node.child.ast_type === "NOT") container.appendChild(createAstParenthesis("("));
				const childEl = createPrefilterAstDisplay(form, node.child, root);
				if (childEl) container.appendChild(childEl);
				if (node.child.ast_type === "VALUE" || node.child.ast_type === "NOT") container.appendChild(createAstParenthesis(")"));
				return container;
			}
			case "AND":
			case "OR": {
				const container = createPrefilterAstGroup(form, node);
				if (node !== root) container.appendChild(createAstParenthesis("("));
				node.children.forEach((child, i) => {
					if (i > 0) container.appendChild(createAstOperator(form, node, node.ast_type));
					const childEl = createPrefilterAstDisplay(form, child, root);
					if (childEl) container.appendChild(childEl);
				});
				if (node !== root) container.appendChild(createAstParenthesis(")"));
				return container;
			}
			default:
				GDV.utils.reportSoftError("Something went wrong while displaying your filters", "The filter display system encountered an unexpected data format and could not render part of your selected filters. This does not affect your data, only how it is shown.", null, { nodeType: node.ast_type, node });
				return null;
		}
	}

	function renderPrefilterAstToolbar(form) {
		const prefilterAstCurrentNode = GDV.prefilter.getPrefilterAstCurrentNode();
		if (!prefilterAstCurrentNode) return;
		const focused = form.querySelector(".is-focused");
		if (!focused) return;
		const toolbar = createPrefilterAstToolbarIfNeeded(form);
		if (!toolbar) return;

		toolbar.replaceChildren(createToolbarContent(form, prefilterAstCurrentNode));
		positionPrefilterAstToolbar(toolbar, focused);
	}

	function positionPrefilterAstToolbar(toolbar, targetElement) {
		const container = toolbar.parentElement;
		if (!container) return;

		const containerRect = container.getBoundingClientRect();
		const targetRect = targetElement.getBoundingClientRect();
		const toolbarRect = toolbar.getBoundingClientRect();
		const left = targetRect.left - containerRect.left;
		const top = targetRect.top - containerRect.top - toolbarRect.height - 10;

		toolbar.style.left = `${left}px`;
		toolbar.style.top = `${top}px`;
	}

	GDV.prefilter.clearActiveItemParameters = clearActiveItemParameters;
	function clearActiveItemParameters(column) {
		const form = document.querySelector(".prefilter-form");
		if (!form) return;
		const activeItem = form.querySelector(`.prefilter-active-item[data-col="${column}"]`);
		if (!activeItem) return;
		clearActiveItemParametersWithType(form, column, activeItem.dataset.type);
	}

	function clearActiveItemParametersWithType(form, column, type) {
		const colEsc = window.CSS && CSS.escape ? CSS.escape(column) : column;
		if (type === "checkbox") {
			form.querySelectorAll(`input[name="${colEsc}"]`).forEach((i) => {
				i.checked = false;
			});
		} else if (type === "range") {
			const min = form.querySelector(`[name="${colEsc}__min"]`);
			const max = form.querySelector(`[name="${colEsc}__max"]`);
			if (min) min.value = "";
			if (max) max.value = "";
		} else if (type === "text") {
			const input = form.querySelector(`input[name="${colEsc}"], textarea[name="${colEsc}"]`);
			if (input) input.value = "";
		}
	}

	function updateColumnsToDisplaySummary(form) {
		const columnsToDisplayItems = form.querySelector("#prefilter-columns-to-display-items");
		if (!columnsToDisplayItems) return;
		columnsToDisplayItems.replaceChildren();

		const columnsToDisplay = GDV.prefilter.getColumnsToDisplay();
		columnsToDisplay.forEach((column, index) => {
			const item = document.createElement("span");
			item.className = "prefilter-columns-to-display-item";
			item.dataset.column = column;
			item.draggable = true;

			const dragHandle = document.createElement("span");
			dragHandle.className = "prefilter-columns-to-display-drag-handle";
			dragHandle.textContent = `${index + 1} ⋮⋮`;
			item.appendChild(dragHandle);

			item.appendChild(document.createTextNode(column));
			columnsToDisplayItems.appendChild(item);
		});
	}

	function updatePrefilterWarning() {
		if (!doesPrefilterOverlayExist()) return;
		const prefilterConditions = GDV.prefilter.getPrefilterConditions();
		const hasFilters = Object.keys(prefilterConditions).length > 0;
		if (hasFilters) {
			hidePrefilterWarning();
		} else {
			showPrefilterWarning();
		}
	}

	function doesPrefilterOverlayExist() {
		return !!document.getElementById("prefilterOverlay");
	}

	function restoreAndUpdateFromState(form) {
		restorePrefiltersAndColumnsToDisplayFromState(form);
		updateSummariesAndWarning(form);
	}

	function restorePrefiltersAndColumnsToDisplayFromState(form) {
		const previousPrefilterConditions = GDV.prefilter.getPrefilterConditions() || {};
		const previousColumnsToDisplay = GDV.prefilter.getColumnsToDisplay() || [];
		const statePrefilterConditions = GDV.state.getPrefilterConditions() || {};
		const statePrefilterAst = GDV.state.getPrefilterAst();
		const stateColumnsToDisplay = GDV.state.getColumnsToDisplay() || [];
		GDV.prefilter.setPrefilterConditionsAndAst(statePrefilterConditions, statePrefilterAst);
		GDV.prefilter.setColumnsToDisplay(stateColumnsToDisplay);
		for (const column of Object.keys(statePrefilterConditions)) {
			GDV.prefilter.addColumnsToDisplay(column);
		}
		const allColumns = [...new Set([...Object.keys(previousPrefilterConditions), ...previousColumnsToDisplay, ...Object.keys(statePrefilterConditions), ...stateColumnsToDisplay])];
		GDV.prefilter.applyPrefilterAndColumnsToDisplayToFormForColumns(form, allColumns);
	}

	function handlePrefilterGridSearchInput(form) {
		startPrefilterGridLoading(form);
		requestAnimationFrame(() => {
			schedulePrefilterGridUpdate(form);
		});
	}

	const schedulePrefilterGridUpdate = GDV.utils.debounce((form) => {
		try {
			updatePrefilterSections(form);
		} catch (err) {
			GDV.utils.reportSoftWarning("Prefilter Search Failure", "The prefilter sections could not be updated.", err);
		} finally {
			requestAnimationFrame(() => {
				stopPrefilterGridLoading(form);
			});
		}
	}, 100);

	function startPrefilterGridLoading(form) {
		const loader = form.querySelector(".prefilter-grid-loading-indicator");
		if (loader) loader.style.display = "";

		const grid = form.querySelector(".prefilter-grid");
		if (grid) grid.style.display = "none";
		hidePrefilterGridIndicators(form);
	}

	function stopPrefilterGridLoading(form) {
		const loader = form.querySelector(".prefilter-grid-loading-indicator");
		if (loader) loader.style.display = "none";

		const grid = form.querySelector(".prefilter-grid");
		if (grid) grid.style.display = "";
	}

	function resetPrefilterSections(form) {
		maxVisibleSections = visibleSectionsBatchSize;
		updatePrefilterSections(form);
	}

	function updatePrefilterSections(form, isSortModeChange = false) {
		const searchText = getSearchTextInForm(form);
		const matchingSections = getMatchingPrefilterSections(form);
		const sortMode = GDV.prefilter.getSortMode();
		if (sortMode === "nearest") {
			if (searchText.trim()) {
				sortPrefilterSectionsByNearestMatch(searchText, matchingSections);
				reorderMatchingPrefilterSections(form, matchingSections);
			} else {
				sortPrefilterSectionsByUsage(prefilterSectionArray);
				renderPrefilterSectionOrder(form);
			}
		} else if (isSortModeChange) {
			if (sortMode === "alpha") {
				sortPrefilterSectionsAlphabetically(prefilterSectionArray);
			} else {
				sortPrefilterSectionsByUsage(prefilterSectionArray);
			}
			renderPrefilterSectionOrder(form);
		}
		applyPrefilterSectionVisibility(form, matchingSections);
		GDV.prefilter.setSearchText(searchText);
	}

	function filterPrefilterSections(form) {
		const matchingSections = getMatchingPrefilterSections(form);
		applyPrefilterSectionVisibility(form, matchingSections);
		return matchingSections;
	}

	function getMatchingPrefilterSections(form) {
		const searchText = getSearchTextInForm(form).trim().toLowerCase();
		const category = getCategoryInForm(form);
		const categoryMatchDetails = GDV.utils.createCategoryMatchDetails(category);
		const searchTokens = searchText ? searchText.split(/\W+/).filter(Boolean) : [];
		const matchingSections = [];
		for (const section of prefilterSectionArray) {
			const columnName = section.dataset.col;
			if (GDV.utils.isACategoryMatch(columnName, categoryMatchDetails) && areSearchTokensMatching(columnName, searchTokens)) {
				matchingSections.push(section);
			}
		}
		return matchingSections;
	}

	function applyPrefilterSectionVisibility(form, matchingSections) {
		const matchingSet = new Set(matchingSections);
		let visibleCount = 0;
		let hiddenPastLimit = 0;
		prefilterSectionArray.forEach((section) => {
			if (!matchingSet.has(section)) {
				section.style.display = "none";
				return;
			}
			visibleCount++;
			if (visibleCount > maxVisibleSections) {
				section.style.display = "none";
				hiddenPastLimit++;
			} else {
				section.style.display = "";
			}
		});
		updatePrefilterGridLimitIndicator(form, hiddenPastLimit);
		updatePrefilterGridNoResults(form, visibleCount);
	}

	function updatePrefilterGridLimitIndicator(form, hiddenPastLimit) {
		const indicator = form.querySelector(".prefilter-grid-limit-indicator");
		if (!indicator) return;

		const count = Math.max(0, hiddenPastLimit); // ensure valid non-negative int
		indicator.dataset.hiddenPastLimit = count;

		const textSpan = indicator.querySelector(".hidden-past-limit");
		if (textSpan) textSpan.textContent = String(count);

		// Hide indicator if nothing is hidden
		indicator.style.display = count > 0 ? "" : "none";
	}

	function updatePrefilterGridNoResults(form, visibleCount) {
		const noResults = form.querySelector(".prefilter-grid-no-results");
		if (!noResults) return;
		const hasResults = visibleCount > 0;
		noResults.style.display = hasResults ? "none" : "";
	}

	function hidePrefilterGridIndicators(form) {
		const indicator = form.querySelector(".prefilter-grid-limit-indicator");
		if (indicator) indicator.style.display = "none";

		const noResults = form.querySelector(".prefilter-grid-no-results");
		if (noResults) noResults.style.display = "none";
	}

	function sortPrefilterSectionsAlphabetically(sectionArray) {
		sectionArray.sort((a, b) => a.dataset.col.localeCompare(b.dataset.col));
	}

	function sortPrefilterSectionsByNearestMatch(searchText, sectionArray) {
		if (!searchText.trim()) {
			sortPrefilterSectionsByUsage(sectionArray);
			return;
		}

		const sortingInfo = new Map();
		for (const section of sectionArray) {
			const columnName = section.dataset.col;
			const searchInfo = prefilterColumnToSearchInfoMap.get(columnName);
			sortingInfo.set(columnName, {
				isFullMatch: searchText.length >= includeFullMatchLengthThreshold && searchInfo?.fullMatchRegex !== null && Boolean(searchInfo?.fullMatchRegex?.test(searchText)),
				score: GDV.utils.computeNearestMatchScore(columnName, searchText),
				order: prefilterColumnToOrderMap.get(columnName)
			});
		}

		sectionArray.sort((a, b) => {
			const A = sortingInfo.get(a.dataset.col);
			const B = sortingInfo.get(b.dataset.col);
			if (A.isFullMatch !== B.isFullMatch) {
				return B.isFullMatch - A.isFullMatch;
			}
			if (A.score !== B.score) {
				return B.score - A.score;
			}
			return A.order - B.order;
		});
	}

	function sortPrefilterSectionsByUsage(sectionArray) {
		sectionArray.sort((a, b) => {
			return prefilterColumnToOrderMap.get(a.dataset.col) - prefilterColumnToOrderMap.get(b.dataset.col);
		});
	}

	function renderPrefilterSectionOrder(form) {
		const grid = form.querySelector(".prefilter-grid");
		if (!grid) return;
		const fragment = document.createDocumentFragment();
		prefilterSectionArray.forEach((section) => {
			fragment.appendChild(section);
		});
		grid.appendChild(fragment);
	}

	function reorderMatchingPrefilterSections(form, matchingSections) {
		const matchingSet = new Set(matchingSections);
		const reorderedSections = prefilterSectionArray.slice();
		let matchingIndex = 0;
		let orderChanged = false;
		for (let i = 0; i < reorderedSections.length; i++) {
			if (!matchingSet.has(reorderedSections[i])) continue;
			const replacement = matchingSections[matchingIndex++];
			if (reorderedSections[i] !== replacement) {
				reorderedSections[i] = replacement;
				orderChanged = true;
			}
		}
		if (!orderChanged) return;
		prefilterSectionArray = reorderedSections;
		renderPrefilterSectionOrder(form);
	}

	function areSearchTokensMatching(columnName, searchTokens) {
		if (searchTokens.length === 0) {
			return true;
		}
		const searchInfo = prefilterColumnToSearchInfoMap.get(columnName);
		if (!searchInfo) return false;
		return searchTokens.every((token) => {
			if (columnName.toLowerCase().includes(token)) return true;
			if (searchInfo.loweredDescription.includes(token)) return true;
			if (searchInfo.quickSearchRegex?.test(token)) return true;
			return false;
		});
	}

	function bindPrefilterGridInputs(form) {
		form.addEventListener("input", (e) => {
			const input = e.target;
			if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
			const column = input.dataset.prefilterColumn;
			if (!column) return;
			if (input.type === "text" || input instanceof HTMLTextAreaElement || input.classList.contains("range-input-min") || input.classList.contains("range-input-max")) {
				updateAllBasedFromActiveItemParametersChanges(form, column);
			}
		});

		form.addEventListener("change", (e) => {
			const input = e.target;
			if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
			const column = input.dataset.prefilterColumn;
			if (!column) return;
			updateAllBasedFromActiveItemParametersChanges(form, column);
		});
	}

	function bindPrefilterAstNodeFocus(form, element, node) {
		element.addEventListener("click", (e) => {
			e.stopPropagation();
			GDV.prefilter.setPrefilterAstCurrentNode(node);
			updatePrefilterActiveItemsSummary(form);
		});
	}

	function waitForPrefilterFormSubmission(form, resolve, cleanupFocus) {
		form.onsubmit = async (e) => {
			e.preventDefault();
			if (isPrefilterSubmissionPending) return;
			isPrefilterSubmissionPending = true;

			let proceed = true;
			if (Object.keys(GDV.prefilter.getPrefilterConditions()).length === 0) {
				try {
					proceed = await confirmPrefiltersWarning();
				} catch (err) {
					isPrefilterSubmissionPending = false;
					GDV.utils.reportSoftWarning("Prefilter Confirmation Failed", "The confirmation dialog could not be completed.", err);
					return;
				}
			}
			if (!proceed) {
				isPrefilterSubmissionPending = false;
				return;
			}

			const prefilterConditions = GDV.prefilter.getPrefilterConditions();
			if (cleanupFocus) cleanupFocus();
			flushAndCommitSimilarityGameInput(form);
			finalizeAndClose();
			isPrefilterSubmissionPending = false;
			resolve(prefilterConditions);
		};
	}

	function bindPrefilterOverlayDragAndDrop(overlay) {
		overlay.addEventListener("dragover", (event) => {
			if (!draggedColumnsToDisplayColumn) return;
			event.preventDefault();
			event.dataTransfer.dropEffect = "move";
		});
	}

	function bindColumnsToDisplayDragAndDrop(container) {
		container.addEventListener("dragstart", (event) => {
			const item = event.target.closest(".prefilter-columns-to-display-item");
			if (!item) return;
			draggedColumnsToDisplayColumn = item.dataset.column;
			item.classList.add("is-dragging");
			event.dataTransfer.effectAllowed = "move";
			event.dataTransfer.setData("text/plain", draggedColumnsToDisplayColumn);
		});

		container.addEventListener("dragover", (event) => {
			if (!draggedColumnsToDisplayColumn) return;
			event.preventDefault();
			event.dataTransfer.dropEffect = "move";
			clearColumnsToDisplayDropIndicators(container);
			const columnsToDisplayItems = Array.from(container.querySelectorAll(".prefilter-columns-to-display-item"))
				.filter((item) => item.dataset.column !== draggedColumnsToDisplayColumn);
			if (!columnsToDisplayItems.length) return;

			const newIndex = getColumnsToDisplayDropIndex(container, event.screenX, draggedColumnsToDisplayColumn);
			const targetItem = columnsToDisplayItems[newIndex] || columnsToDisplayItems[columnsToDisplayItems.length - 1];
			if (newIndex >= columnsToDisplayItems.length) {
				targetItem.classList.add("is-drop-after");
			} else {
				targetItem.classList.add("is-drop-before");
			}
		});

		container.addEventListener("dragend", (event) => {
			const item = event.target.closest(".prefilter-columns-to-display-item");
			if (item) {
				item.classList.remove("is-dragging");
			}
			clearColumnsToDisplayDropIndicators(container);
			if (!draggedColumnsToDisplayColumn) return;
			const draggedColumn = draggedColumnsToDisplayColumn;
			draggedColumnsToDisplayColumn = null;

			const columnsToDisplay = GDV.prefilter.getColumnsToDisplay();
			const oldIndex = columnsToDisplay.indexOf(draggedColumn);
			const newIndex = getColumnsToDisplayDropIndex(container, event.screenX, draggedColumn);
			if (oldIndex === -1 || newIndex === oldIndex) return;
			GDV.prefilter.moveColumnsToDisplay(draggedColumn, newIndex);
			updateColumnsToDisplaySummary(container.closest(".prefilter-form"));
		});
	}

	function getColumnsToDisplayDropIndex(container, screenX, draggedColumn) {
		let newIndex = 0;
		for (const item of container.querySelectorAll(".prefilter-columns-to-display-item")) {
			if (item.dataset.column === draggedColumn) continue;
			const rect = item.getBoundingClientRect();
			const itemLeft = window.screenX + rect.left;
			const itemMiddle = itemLeft + rect.width / 2;
			if (screenX < itemMiddle) return newIndex;
			newIndex++;
		}
		return newIndex;
	}

	function clearColumnsToDisplayDropIndicators(container) {
		container.querySelectorAll(".prefilter-columns-to-display-item").forEach((item) => {
			item.classList.remove("is-drop-before", "is-drop-after");
		});
	}

	function flushAndCommitSimilarityGameInput(form) {
		const similarityInput = form.querySelector('input[name="prefilterSimilaritySearch"]');
		if (!similarityInput) return;
		const ghostText = similarityInput.parentElement.querySelector(".similarity-criteria-game-input-ghost");
		commitSimilarityGameInput(similarityInput, ghostText);
	}

	function finalizeAndClose() {
		clearSimilarityGameInputCommitTimer();
		updateStateOfPrefiltersBeforeClosing();
		hidePrefilterWarning();
		closePrefilterOverlay();
	}

	function clearSimilarityGameInputCommitTimer() {
		clearTimeout(similarityGameInputCommitTimer);
		similarityGameInputCommitTimer = null;
	}

	function updateStateOfPrefiltersBeforeClosing() {
		const prefilterConditions = GDV.prefilter.getPrefilterConditions();
		const prefilterAst = GDV.prefilter.getPrefilterAst();
		const columnsToDisplay = GDV.prefilter.getColumnsToDisplay();
		GDV.state.setPrefilterConditions(prefilterConditions);
		GDV.state.setPrefilterAst(prefilterAst);
		GDV.state.setColumnsToDisplay(columnsToDisplay);
	}

	async function confirmPrefiltersWarning() {
		return await GDV.utils.requestUserConfirmation("No Prefilters Applied", "⚠ You haven't applied any prefilters.\n" + "Loading the full dataset may be very memory-intensive and slow.\n\n" + "Do you want to continue anyway?");
	}

	// Accessibility: trap focus inside overlay and restore on close
	function showModalAccessibility(overlay, resolve) {
		const previousActive = document.activeElement;

		// Focus first focusable element
		const first = overlay.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
		if (first) first.focus();

		function onKeydown(e) {
			if (e.key === "Escape") {
				if (isPrefilterSubmissionPending) return;
				cleanupFocus();
				finalizeAndClose();
				resolve(null);
				return;
			}
			if (e.key === "Tab") {
				const focusables = Array.from(overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.disabled && el.offsetParent !== null);
				if (!focusables.length) return;
				const idx = focusables.indexOf(document.activeElement);
				if (e.shiftKey && idx === 0) {
					e.preventDefault();
					focusables[focusables.length - 1].focus();
				} else if (!e.shiftKey && idx === focusables.length - 1) {
					e.preventDefault();
					focusables[0].focus();
				}
			}
		}
		const cleanupFocus = () => {
			overlay.removeEventListener("keydown", onKeydown);
			if (previousActive?.focus) previousActive.focus();
		};
		overlay.addEventListener("keydown", onKeydown);
		return cleanupFocus;
	}

	function resetPrefilters(form) {
		if (!form) return;

		// Clear All Prefilter Form Controls
		GDV.prefilter.resetPrefilterFormInputs(form);

		// Reset Similarity Game Inputs
		clearSimilarityGameInputCommitTimer();
		GDV.dom.resetSimilarityGameInputs();

		// Reset Drop Downs
		resetPrefilterCategory(form);
		resetPrefilterSimilarityScope(form);

		// Reset Similarity Criteria
		GDV.state.resetSimilarityCriteria();

		// Reset and update
		GDV.prefilter.resetPrefilterAndColumnsToDisplay();
		updateSummariesAndWarning(form);
	}

	function resetPrefilterCategory(form) {
		const categorySelect = form.querySelector(".category-dropdown-select");
		if (!categorySelect) return;
		categorySelect.value = "All Categories";
		updatePrefilterCategorySummary(form, categorySelect);
		updatePrefilterSections(form);
	}

	function resetPrefilterSimilarityScope(form) {
		const scopeSelect = form.querySelector(".similarity-scope-dropdown-select");
		if (scopeSelect) {
			scopeSelect.value = "All Categories";
			GDV.dom.syncSimilarityScopeDropdowns(scopeSelect.value);
		}
	}

	function getCategoryInForm(form) {
		const categorySelect = form.querySelector(".category-dropdown-select");
		return categorySelect?.value || "All Categories";
	}

	function getSearchTextInForm(form) {
		const searchInput = form.querySelector(".prefilter-search-input");
		return searchInput?.value || "";
	}
})();
