(() => {
	const noPrefiltersLabel = "No Prefilters Applied";
	const noPrefiltersMessage = "Loading the entire dataset may consume significant memory and slow the table.";
	const visibleSectionsBatchSize = 99;
	let prefilterOverlay = null;
	let maxVisibleSections = visibleSectionsBatchSize;

	GDV.prefilter.initializePrefilterOverlayIfNeeded = initializePrefilterOverlayIfNeeded;
	function initializePrefilterOverlayIfNeeded() {
		if (!prefilterOverlay) {
			prefilterOverlay = createPrefilterOverlay();
		}
	}

	GDV.prefilter.showPrefilterOverlayAndCollectFilters = async () => {
		try {
			initializePrefilterOverlayIfNeeded();
			const { overlay, form } = prefilterOverlay

			resetForNewPrefilterOverlay(form);
			showPrefilterOverlay();

			// Return a fresh Promise for this open
			return new Promise((resolve) => {
				const cleanupFocus = showModalAccessibility(overlay, resolve);
				replacePrefiltersSummaryWithNewOne(form, resolve, cleanupFocus);
				updatePrefilterLiveStateRelatedItems(form);
				waitForPrefilterFormSubmission(form, resolve);
			});
		} catch (err) {
			GDV.utils.reportSilentWarning("Prefilter UI Failure", "Prefilter overlay failed to initialize, continuing without prefiltering.", err);
			return {};
		}
	};

	GDV.prefilter.hideNoPrefilterWarning = hideNoPrefilterWarning;
	function hideNoPrefilterWarning() {
		GDV.utils.hideBannerWithLabel(noPrefiltersLabel);
	}

	GDV.prefilter.showNoPrefilterWarning = showNoPrefilterWarning;
	function showNoPrefilterWarning() {
		GDV.utils.hideBannerWithLabel(noPrefiltersLabel);
		GDV.utils.showPermanentWarningBanner(noPrefiltersLabel, noPrefiltersMessage);
	}

	GDV.prefilter.renderRemoveButton = renderRemoveButton;
	function renderRemoveButton(col) {
		const removeBtn = document.createElement("button");
		removeBtn.type = "button";
		removeBtn.className = "prefilter-remove-btn";
		removeBtn.textContent = "×";
		removeBtn.setAttribute("aria-label", `Remove prefilter for ${col}`);
		return removeBtn;
	};

	function resetForNewPrefilterOverlay(form) {
		maxVisibleSections = visibleSectionsBatchSize;
		updatePrefilterSections(form);
	}

	function showPrefilterOverlay() {
		hideNoPrefilterWarning();
		if (prefilterOverlay?.overlay) {
			prefilterOverlay.overlay.style.display = "";
		}
	}

	function closePrefilterOverlay() {
		hideNoPrefilterWarning();
		if (prefilterOverlay?.overlay) {
			prefilterOverlay.overlay.style.display = "none";
		}
	}

	function createPrefilterOverlay() {
		const overlay = createPrefilterOverlayContainer("Refine Your Search Using Prefilters");
		document.body.appendChild(overlay);
		overlay.style.display = "none";
		overlay.appendChild(GDV.helpNotice.createHelpNotice());

		const form = document.createElement("form");
		form.className = "prefilter-form";
		overlay.appendChild(form);
		form.appendChild(createPrefilterSearchAndCategoryGroup(form));
		form.appendChild(createPrefiltersSummary(form, null, null));
		form.appendChild(createPrefilterGrid(GDV.state.getPrefiltersToUse()));
		form.appendChild(createPrefilterLimitIndicator(form));
		updatePrefilterSections(form);

		GDV.prefilter.bindPrefilterGridInputs(form);
		bindActivePrefiltersSummaryRemoval(form);
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

	// Category drop down and search box
	function createPrefilterSearchAndCategoryGroup(form) {
		const container = document.createElement("div");
		container.className = "prefilter-search-category-group";
		container.appendChild(createPrefilterCategoryDropdown(form));
		container.appendChild(createPrefilterSearchBox(form));
		return container;
	}

	// Category drop down
	function createPrefilterCategoryDropdown(form) {
		const container = document.createElement("div");
		container.className = "prefilter-search-box";

		const selectId = "prefilter-category-select";
		const label = document.createElement("label");
		label.setAttribute("for", selectId);
		label.className = "prefilter-search-label";
		label.textContent = "Categories:";
		container.appendChild(label);

		const select = document.createElement("select");
		select.className = "prefilter-category-select";
		select.id = selectId;
		container.appendChild(select);

		const allOption = document.createElement("option");
		allOption.value = "__all__";
		allOption.textContent = "All Categories";
		select.appendChild(allOption);

		const categories = GDV.state.getColumnCategories() || {};
		Object.keys(categories).forEach((cat) => {
			const opt = document.createElement("option");
			opt.value = cat;
			opt.textContent = cat;
			select.appendChild(opt);
		});

		// Update prefilter sections and summary chip on change
		select.addEventListener("change", () => {
			updatePrefilterSections(form);

			// Update summary chip
			const summaryChip = document.getElementById("prefilter-selected-category");
			if (summaryChip) {
				summaryChip.dataset.value = select.value;
				summaryChip.textContent = select.selectedOptions[0].textContent;
			}
		});

		return container;
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
		input.placeholder = "Search prefilters to change…";
		input.className = "prefilter-search-input";
		input.id = inputId;
		input.name = inputId;

		// Input event handler
		const handler = () => {
			updatePrefilterSectionsDebounced(form);
		};

		input.addEventListener("input", handler);
		input.addEventListener("change", handler);

		container.appendChild(input);
		return container;
	}

	// Active summary
	function replacePrefiltersSummaryWithNewOne(form, resolve, cleanupFocus) {
		const oldSummary = form.querySelector(".prefilter-summary-container");
		const newSummary = createPrefiltersSummary(form, resolve, cleanupFocus);
		if (oldSummary) {
			oldSummary.replaceWith(newSummary);
			bindActivePrefiltersSummaryRemoval(form);
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

		const prefilterLabel = document.createElement("span");
		prefilterLabel.className = "prefilter-summary-label";
		prefilterLabel.textContent = "Active Prefilters:";
		leftGroup.appendChild(prefilterLabel);

		const chips = document.createElement("div");
		chips.id = "prefilter-active-items";
		chips.className = "prefilter-active-items";
		leftGroup.appendChild(chips);

		return leftGroup;
	}

	function createPrefiltersSummaryRight(form, resolve, cleanupFocus) {
		const rightGroup = document.createElement("div");
		rightGroup.className = "prefilter-summary-right";
		rightGroup.appendChild(createPrefiltersSummaryActionButtonsRow(form, resolve, cleanupFocus));
		rightGroup.appendChild(createPrefilterSimilarityRow());
		rightGroup.appendChild(createPrefiltersSummaryCategoryRow(form));
		return rightGroup;
	}

	function createPrefiltersSummaryActionButtonsRow(form, resolve, cleanupFocus) {
		const buttonWrapper = document.createElement("div");
		buttonWrapper.className = "prefilter-summary-buttons";
		buttonWrapper.appendChild(createPrefiltersResetButton(form));
		buttonWrapper.appendChild(createPrefiltersCloseButton(resolve, cleanupFocus));
		buttonWrapper.appendChild(createPrefilterSubmitButton("Generate Table"));
		return buttonWrapper;
	}

	function createPrefilterSimilarityRow() {
		const similarityWrapper = document.createElement("div");
		similarityWrapper.className = "prefilter-summary-similarity";

		const label = document.createElement("span");
		label.className = "prefilter-summary-label";
		label.textContent = "Find Similar Games To:";
		similarityWrapper.appendChild(label);

		const inputWrapper = document.createElement("div");
		inputWrapper.className = "prefilter-summary-input-wrapper";

		const similarityInput = document.createElement("input");
		similarityInput.type = "text";
		similarityInput.name = "similaritySearch";
		similarityInput.placeholder = "Find a game...";
		similarityInput.className = "prefilter-summary-input";
		similarityInput.spellcheck = false;
		inputWrapper.appendChild(similarityInput);

		const ghostText = document.createElement("div");
		ghostText.className = "prefilter-summary-input-ghost";
		inputWrapper.appendChild(ghostText);

		similarityWrapper.appendChild(inputWrapper);

		const existingGame = GDV.state.getSimilarityGame();
		if (existingGame) {
			similarityInput.value = existingGame;
			ghostText.textContent = "";
		}

		let debounceTimer = null;
		similarityInput.addEventListener("input", function () {
			const query = this.value.trim();
			clearTimeout(debounceTimer);
			if (!query) {
				ghostText.textContent = "";
				GDV.state.resetSimilarityGame();
				return;
			}
			const nearest = GDV.utils.findNearestGameKey(query);
			if (nearest && nearest.toLowerCase() !== query.toLowerCase()) ghostText.textContent = nearest;
			else ghostText.textContent = "";
			debounceTimer = setTimeout(async () => {
				const latestQuery = similarityInput.value.trim();
				const latestNearest = GDV.utils.findNearestGameKey(latestQuery);
				if (!latestNearest) return;
				similarityInput.value = latestNearest;
				ghostText.textContent = "";
				GDV.state.setSimilarityGame(latestNearest);
			}, 2000);
		});

		return similarityWrapper;
	}

	function createPrefiltersSummaryCategoryRow(form) {
		const categoryWrapper = document.createElement("div");
		categoryWrapper.className = "prefilter-summary-category";
		const categoryLabel = document.createElement("span");
		categoryLabel.className = "prefilter-summary-label";
		categoryLabel.textContent = "Category:";
		categoryWrapper.appendChild(categoryLabel);

		const categoryChip = document.createElement("span");
		categoryChip.id = "prefilter-selected-category";
		categoryChip.className = "prefilter-summary-category-value";
		categoryChip.dataset.value = "__all__";
		categoryChip.textContent = "All Categories";
		categoryWrapper.appendChild(categoryChip);
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

	function createPrefiltersCloseButton(resolve, cleanupFocus) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.textContent = "Close";
		btn.className = "btn btn-danger btn-close";
		btn.addEventListener("click", () => {
			if (cleanupFocus) cleanupFocus();
			closePrefilterOverlay();
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

			const summary = form.querySelector("#prefilter-active-items");
			GDV.prefilter.sortPrefilterChips(summary);
			sortPrefilterSections(form);
		});

		return btn;
	}

	// Grid
	function createPrefilterGrid(prefill = {}) {
		const grid = document.createElement("div");
		grid.className = "prefilter-grid";
		const colDefs = GDV.state.getActiveColumnDetails() || {};
		for (const [col, colDef] of Object.entries(colDefs)) {
			grid.appendChild(createFilterSectionForColumnDetails(col, colDef, prefill[col]));
		}
		return grid;
	}

	function createFilterSectionForColumnDetails(col, colDef, prefill = null) {
		const section = document.createElement("section");
		section.className = "prefilter-section";
		section.dataset.col = String(col);
		section.title = GDV.datatable.getColumnDescription(col);

		const title = document.createElement("h3");
		title.textContent = col;
		section.appendChild(title);

		if (colDef.type === "tag") {
			section.appendChild(createTagFilter(col, prefill));
		} else if (Array.isArray(colDef.choices) && colDef.choices.length > 0) {
			section.appendChild(createChoiceFilter(col, colDef.choices, prefill));
		} else if (colDef.type === "int" || colDef.type === "float") {
			section.appendChild(createRangeFilter(col, colDef.min, colDef.max, prefill));
		} else {
			section.appendChild(createTextFilterInput(col, prefill));
		}

		const tagCount = GDV.datatable.getColumnTagCount(col);
		if (tagCount != null) {
			const footer = document.createElement("div");
			footer.className = "prefilter-footer";
			footer.textContent = `${tagCount} matches`;
			section.appendChild(footer);
		}

		return section;
	}

	function createPrefilterLimitIndicator(form) {
		const indicator = document.createElement("div");
		indicator.className = "prefilter-limit-indicator";
		indicator.dataset.hiddenPastLimit = 0;

		const textSpan = document.createElement("span");
		textSpan.className = "hidden-past-limit";
		textSpan.textContent = "0";
		indicator.appendChild(document.createTextNode("…and "));
		indicator.appendChild(textSpan);
		indicator.appendChild(document.createTextNode(" more hidden "));

		const showMoreBtn = document.createElement("button");
		showMoreBtn.className = "btn btn-show-more";
		showMoreBtn.type = "button";
		showMoreBtn.textContent = "Show More";

		showMoreBtn.addEventListener("click", () => {
			maxVisibleSections += visibleSectionsBatchSize;
			updatePrefilterSections(form);
		});

		indicator.appendChild(showMoreBtn);
		form.appendChild(indicator);
		return indicator;
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

		const checkedValues = Array.isArray(prefill?.choices) ? prefill.choices : choices.slice();

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
		minWrap.appendChild(createNumberInput(`${name}__min`, minVal, "Min", "range-input-min", String(min ?? "")));

		const maxWrap = document.createElement("div");
		maxWrap.className = "range-input-wrapper";
		maxWrap.appendChild(createNumberInput(`${name}__max`, maxVal, "Max", "range-input-max", String(max ?? "")));

		wrapper.appendChild(minWrap);
		wrapper.appendChild(maxWrap);
		return wrapper;
	}

	// Create labeled number input with optional class for styling
	function createNumberInput(name, value = null, labelText = "", inputClass = "", placeholder = "") {
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
		input.className = "text-input-input";
		input.placeholder = `Prefilter ${name}…`;

		if (prefill?.text?.[0] !== undefined) {
			input.value = prefill.text[0];
		}

		container.appendChild(input);
		return container;
	}

	// collectPrefilterFromForm now returns a shallow clone of the liveState (very cheap)
	function collectPrefilterFromForm() {
		// structuredClone may not be available in all environments; fallback to JSON
		if (typeof structuredClone === "function") return structuredClone(GDV.prefilter.getPrefilterLiveState());
		return JSON.parse(JSON.stringify(GDV.prefilter.getPrefilterLiveState()));
	}

	function waitForPrefilterFormSubmission(form, resolve) {
		form.onsubmit = async (e) => {
			e.preventDefault();
			const prefilter = collectPrefilterFromForm();

			if (Object.keys(prefilter).length === 0) {
				const proceed = await confirmNoPrefiltersWarning();
				if (!proceed) return;
			}

			GDV.state.setPrefiltersToUse(prefilter);
			GDV.dom.renderMainPagePrefiltersPanel();
			closePrefilterOverlay();
			resolve(prefilter);
		};
	}

	async function confirmNoPrefiltersWarning() {
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
				if (previousActive?.focus) previousActive.focus();
				closePrefilterOverlay(overlay);
				resolve(null);
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

		overlay.addEventListener("keydown", onKeydown);
		return () => {
			overlay.removeEventListener("keydown", onKeydown);
			if (previousActive?.focus) previousActive.focus();
		};
	}

	function updatePrefilterLiveStateRelatedItems(form) {
		GDV.prefilter.setPrefilterLiveState(GDV.state.getPrefiltersToUse());
		GDV.prefilter.updatePrefilterWarningFromLiveState();
		renderActivePrefiltersSummaryFromLiveState(form);
	}

	function renderActivePrefiltersSummaryFromLiveState(form) {
		const summary = form.querySelector("#prefilter-active-items");
		if (!summary) return;

		// clear existing chips
		summary.textContent = "";

		for (const [col, val] of Object.entries(GDV.prefilter.getPrefilterLiveState())) {
			const span = document.createElement("span");
			span.className = "prefilter-active-item";
			span.dataset.col = col;
			span.dataset.type = GDV.prefilter.getPrefilterDisplayType(val) || "";
			span.title = GDV.datatable.getColumnDescription(col) || "";
			span.appendChild(document.createTextNode(`${GDV.prefilter.getPrefilterDisplayText(col, val)} `));
			span.appendChild(renderRemoveButton(col));
			summary.appendChild(span);
		}
	}

	GDV.prefilter.updatePrefilterSectionsDebounced = updatePrefilterSectionsDebounced;
	function updatePrefilterSectionsDebounced(form) {
		updatePrefilterSectionsDebouncedInternal(form);
	}
	const updatePrefilterSectionsDebouncedInternal = GDV.utils.debounce((form) => {
		updatePrefilterSections(form);
	});

	function updatePrefilterSections(form) {
		sortPrefilterSections(form);
		filterPrefilterSections(form);
		GDV.prefilter.setSearchText(getSearchTextInForm(form));
	}

	function sortPrefilterSections(form) {
		const grid = form.querySelector(".prefilter-grid");
		const sections = form.querySelectorAll(".prefilter-section");
		const sectionArray = Array.from(sections);
		const sortMode = GDV.prefilter.getSortMode();
		switch (sortMode) {
			case "alpha":
				sortPrefilterSectionsAlphabetically(sectionArray);
				break;
			case "nearest":
				sortPrefilterSectionsByNearestMatch(form, sectionArray);
				break;
			default:
				sortPrefilterSectionsByUsage(sectionArray);
		}

		const fragment = document.createDocumentFragment();
		sectionArray.forEach((section) => {
			fragment.appendChild(section);
		});
		grid.appendChild(fragment);
	}

	function filterPrefilterSections(form) {
		const searchText = getSearchTextInForm(form);
		const category = getCategoryInForm(form);
		const colCategories = GDV.state.getColumnCategories() || {};
		const sections = form.querySelectorAll(".prefilter-section");

		// Tokenize search input: lowercase, split by spaces, remove empty tokens
		const tokens = searchText.trim().toLowerCase().split(/\s+/).filter((t) => t.length > 0);

		let visibleCount = 0;
		let hiddenPastLimit = 0;

		sections.forEach((section) => {
			const colName = section.dataset.col;
			const matchesSearch = tokens.length === 0 || sectionMatchesTokens(colName, tokens);
			const matchesCategory = category === "__all__" || (colCategories[category] || []).includes(colName);

			if (matchesSearch && matchesCategory) {
				visibleCount++;
				if (visibleCount > maxVisibleSections) {
					section.style.display = "none";
					hiddenPastLimit++;
				} else {
					section.style.display = "";
				}
			} else {
				section.style.display = "none";
			}
		});

		updatePrefilterLimitIndicator(form, hiddenPastLimit);
	}

	function updatePrefilterLimitIndicator(form, hiddenPastLimit) {
		const indicator = form.querySelector(".prefilter-limit-indicator");
		if (!indicator) return;

		const count = Math.max(0, hiddenPastLimit | 0); // ensure valid non-negative int
		indicator.dataset.hiddenPastLimit = count;

		const textSpan = indicator.querySelector(".hidden-past-limit");
		if (textSpan) textSpan.textContent = String(count);

		// Hide indicator if nothing is hidden
		indicator.style.display = count > 0 ? "" : "none";
	}

	function sortPrefilterSectionsAlphabetically(sectionArray) {
		sectionArray.sort((a, b) => a.dataset.col.localeCompare(b.dataset.col));
	}

	function sortPrefilterSectionsByNearestMatch(form, sectionArray) {
		const searchText = getSearchTextInForm(form);
		if (!searchText) {
			sortPrefilterSectionsByUsage(sectionArray);
			return;
		}

		const colDefs = GDV.state.getActiveColumnDetails() || {};
		const colOrder = Object.keys(colDefs);

		const distanceCache = new Map();
		for (const section of sectionArray) {
			const colName = section.dataset.col;
			const dist = GDV.utils.computeNearestMatchDistance(colName, searchText);
			distanceCache.set(colName, dist);
		}

		sectionArray.sort((a, b) => {
			const distA = distanceCache.get(a.dataset.col);
			const distB = distanceCache.get(b.dataset.col);
			if (distA !== distB) return distA - distB;
			const usageA = colOrder.indexOf(a.dataset.col);
			const usageB = colOrder.indexOf(b.dataset.col);
			return usageA - usageB;
		});
	}

	function sortPrefilterSectionsByUsage(sectionArray) {
		const colDefs = GDV.state.getActiveColumnDetails() || {};
		const colOrder = Object.keys(colDefs);
		sectionArray.sort((a, b) => colOrder.indexOf(a.dataset.col) - colOrder.indexOf(b.dataset.col));
	}

	function sectionMatchesTokens(colName, tokens) {
		const filterName = GDV.utils.normalizeFilterName(colName);
		const columnDetails = GDV.state.getActiveColumnDetails()?.[filterName];
		const description = columnDetails?.description?.toLowerCase() || "";
		const tagPatterns = GDV.state.getTagFullPatterns()?.[filterName];
		const regexStr = tagPatterns?.pattern?.toLowerCase() || "";
		const regex = tagPatterns?.regex || null;

		return tokens.every((token) => {
			const lowerToken = token.toLowerCase();
			if (filterName.toLowerCase().includes(lowerToken)) return true;
			if (description.includes(lowerToken)) return true;
			if (regexStr.includes(lowerToken)) return true;
			if (regex?.test(token)) return true;
			return false;
		});
	}

	function bindActivePrefiltersSummaryRemoval(form) {
		const summaryEl = form.querySelector("#prefilter-active-items");
		if (!summaryEl) return;

		// Delegated click handler for remove buttons
		summaryEl.addEventListener("click", (e) => {
			const btn = e.target.closest(".prefilter-remove-btn");
			if (!btn) return;

			const span = btn.closest(".prefilter-active-item");
			if (!span) return;

			const col = span.dataset.col;
			const type = span.dataset.type;

			// Clear inputs for that column
			const esc = window.CSS && CSS.escape ? CSS.escape(col) : col;
			if (type === "checkbox") {
				form.querySelectorAll(`input[name="${esc}"]`).forEach((i) => {
					i.checked = false;
				});
			} else if (type === "range") {
				const min = form.querySelector(`[name="${esc}__min"]`);
				const max = form.querySelector(`[name="${esc}__max"]`);
				if (min) min.value = "";
				if (max) max.value = "";
			} else if (type === "text") {
				const input = form.querySelector(`input[name="${esc}"], textarea[name="${esc}"]`);
				if (input) input.value = "";
			}

			// Update live state & UI for this column
			GDV.prefilter.updateLivePrefilterForColumn(form, col);
			GDV.prefilter.updateSinglePrefilterSummary(form, col);
			GDV.prefilter.updatePrefilterWarningFromLiveState();
		});
	}

	function resetPrefilters(form) {
		if (!form) return;

		// Clear tag checkboxes
		form.querySelectorAll('.prefilter-tag-group input[type="checkbox"]').forEach((inp) => {
			inp.checked = false;
		});

		// Clear choice checkboxes
		form.querySelectorAll('.prefilter-box input[type="checkbox"]').forEach((inp) => {
			inp.checked = true;
		});
		form.querySelectorAll(".prefilter-box .toggle-all").forEach((toggle) => {
			toggle.dispatchEvent(new Event("change"));
		});

		// Clear range inputs
		form.querySelectorAll('.prefilter-range input[type="number"]').forEach((inp) => {
			inp.value = "";
		});

		// Clear text inputs (excluding search box)
		form.querySelectorAll('input[type="text"]:not(.prefilter-search-input), textarea').forEach((inp) => {
			inp.value = "";
		});

		// Reset Prefilter Category
		resetPrefilterCategory(form);

		// Reset Similarity Game
		GDV.state.resetSimilarityGame();

		// Reset liveState and UI
		GDV.prefilter.resetPrefilterLiveState();
		renderActivePrefiltersSummaryFromLiveState(form);
		GDV.prefilter.updatePrefilterWarningFromLiveState();
	}

	function resetPrefilterCategory(form) {
		const categorySelect = form.querySelector(".prefilter-category-select");
		if (categorySelect) {
			categorySelect.value = "__all__";
			updatePrefilterSections(form);
		}
	}
	function getCategoryInForm(form) {
		const categorySelect = form.querySelector(".prefilter-category-select");
		return categorySelect?.value || "__all__";
	}

	function getSearchTextInForm(form) {
		const searchInput = form.querySelector(".prefilter-search-input");
		return searchInput?.value || "";
	}
})();
