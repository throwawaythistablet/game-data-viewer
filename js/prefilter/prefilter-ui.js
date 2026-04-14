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
				updatePrefilterConditionsRelatedItems(form);
				waitForPrefilterFormSubmission(form, resolve);
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
		maxVisibleSections = visibleSectionsBatchSize;
		updatePrefilterSections(form);
	}

	function showPrefilterOverlay() {
		hidePrefilterWarning();
		if (prefilterOverlay?.overlay) {
			prefilterOverlay.overlay.style.display = "";
		}
	}

	function closePrefilterOverlay() {
		hidePrefilterWarning();
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
		form.appendChild(createPrefilterGrid(GDV.state.getPrefilterConditions()));
		form.appendChild(createPrefilterLimitIndicator(form));
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

		select.addEventListener("change", () => {
			updatePrefilterSections(form);
			const categoryElement = form.querySelector("#prefilter-selected-category");
			if (categoryElement) {
				categoryElement.dataset.value = select.value;
				categoryElement.textContent = select.selectedOptions[0].textContent;
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

		const prefilterLabel = document.createElement("span");
		prefilterLabel.className = "prefilter-summary-label";
		prefilterLabel.textContent = "Active Prefilters:";
		leftGroup.appendChild(prefilterLabel);

		const activeItems = document.createElement("div");
		activeItems.id = "prefilter-active-items";
		activeItems.className = "prefilter-active-items";
		leftGroup.appendChild(activeItems);

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

		const categoryElement = document.createElement("span");
		categoryElement.id = "prefilter-selected-category";
		categoryElement.className = "prefilter-summary-category-value";
		categoryElement.dataset.value = "__all__";
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
			sortPrefilterSections(form);
		});
		return btn;
	}

	// Grid
	function createPrefilterGrid(prefill) {
		const grid = document.createElement("div");
		grid.className = "prefilter-grid";
		const colDefs = GDV.state.getActiveColumnDetails() || {};
		for (const [col, colDef] of Object.entries(colDefs)) {
			grid.appendChild(createFilterSectionForColumnDetails(col, colDef, prefill[col]));
		}
		return grid;
	}

	function createFilterSectionForColumnDetails(col, colDef, prefill) {
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

	function createPrefilterAstGroup(form, node) {
		const prefilterAstCurrentNode = GDV.prefilter.getPrefilterAstCurrentNode();
		const astGroup = document.createElement("span");
		astGroup.className = "prefilter-ast-group";
		if (node === prefilterAstCurrentNode) astGroup.classList.add("is-focused");
		bindPrefilterAstNodeFocus(form, astGroup, node)
		return astGroup;
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

	function createToolbarContent(node) {
		const container = document.createElement("div");
		container.className = "prefilter-ast-toolbar-inner";
		container.appendChild(createToolbarRemoveButton(node));
		container.appendChild(createToolbarNotButton(node));
		container.appendChild(createToolbarAndButton(node));
		container.appendChild(createToolbarOrButton(node));
		container.appendChild(createToolbarMoveInButton(node));
		container.appendChild(createToolbarMoveOutButton(node));
		return container;
	}

	function createToolbarRemoveButton(node) {
		const removeButton = document.createElement("button");
		removeButton.type = "button";
		removeButton.className = "btn btn-toolbar";
		removeButton.textContent = "Remove Item";
		removeButton.addEventListener("click", (e) => {
			e.stopPropagation();
			GDV.prefilter.removeNodeWithReferenceInAstConditionsAndUi(node);
			const form = document.querySelector(".prefilter-form");
			updatePrefilterActiveItemsAndWarning(form);
		});
		return removeButton;
	}

	function createToolbarNotButton(node) {
		const notButton = document.createElement("button");
		notButton.type = "button";
		notButton.className = "btn btn-toolbar";
		notButton.textContent = "Not";
		notButton.addEventListener("click", (e) => {
			e.stopPropagation();
			GDV.prefilter.applyNotToNode(node);
			const form = document.querySelector(".prefilter-form");
			updatePrefilterActiveItemsAndWarning(form);
		});
		return notButton;
	}

	function createToolbarAndButton(node) {
		const andButton = document.createElement("button");
		andButton.type = "button";
		andButton.className = "btn btn-toolbar";
		andButton.textContent = "And";
		andButton.addEventListener("click", (e) => {
			e.stopPropagation();
			GDV.prefilter.applyAndToNode(node);
			const form = document.querySelector(".prefilter-form");
			updatePrefilterActiveItemsAndWarning(form);
		});
		return andButton;
	}

	function createToolbarOrButton(node) {
		const orButton = document.createElement("button");
		orButton.type = "button";
		orButton.className = "btn btn-toolbar";
		orButton.textContent = "Or";
		orButton.addEventListener("click", (e) => {
			e.stopPropagation();
			GDV.prefilter.applyOrToNode(node);
			const form = document.querySelector(".prefilter-form");
			updatePrefilterActiveItemsAndWarning(form);
		});
		return orButton;
	}

	function createToolbarMoveInButton(node) {
		const orButton = document.createElement("button");
		orButton.type = "button";
		orButton.className = "btn btn-toolbar";
		orButton.textContent = "Move In";
		orButton.addEventListener("click", (e) => {
			e.stopPropagation();
			GDV.prefilter.moveNodeIntoGroup(node);
			const form = document.querySelector(".prefilter-form");
			updatePrefilterActiveItemsAndWarning(form);
		});
		return orButton;
	}

	function createToolbarMoveOutButton(node) {
		const orButton = document.createElement("button");
		orButton.type = "button";
		orButton.className = "btn btn-toolbar";
		orButton.textContent = "Move Out";
		orButton.addEventListener("click", (e) => {
			e.stopPropagation();
			GDV.prefilter.moveNodeOutOfGroup(node);
			const form = document.querySelector(".prefilter-form");
			updatePrefilterActiveItemsAndWarning(form);
		});
		return orButton;
	}

	function createPrefilterActiveItem(form, node) {
		const prefilterConditions = GDV.prefilter.getPrefilterConditions();
		const prefilterAstCurrentNode = GDV.prefilter.getPrefilterAstCurrentNode();
		const col = node.column;
		const val = prefilterConditions[col];
		if (!val) return null;

		const activeItem = document.createElement("span");
		activeItem.className = "prefilter-active-item";
		activeItem.dataset.col = col;
		if (node === prefilterAstCurrentNode) {
			activeItem.classList.add("is-focused");
		}
		const text = GDV.prefilter.getPrefilterDisplayText(col, val) || "";
		activeItem.textContent = `${text} `;
		activeItem.title = GDV.datatable.getColumnDescription(col) || "";
		activeItem.dataset.type = GDV.prefilter.getPrefilterDisplayType(val) || "";
		activeItem.appendChild(createPrefilterActiveItemRemoveButton(form, col, activeItem.dataset.type));
		bindPrefilterAstNodeFocus(form, activeItem, node)

		return activeItem;
	}

	function createAstOperator(form, node, type) {
		const operator = document.createElement("span");
		operator.className = "prefilter-ast-operator";
		operator.textContent = type;
		bindPrefilterAstNodeFocus(form, operator, node)
		return operator;
	}

	function createAstParenthesis(text) {
		const el = document.createElement("span");
		el.className = "prefilter-ast-paren";
		el.textContent = text;
		return el;
	}

	function collectPrefilterFromForm() {
		const prefilterConditions = GDV.prefilter.getPrefilterConditions();
		const prefilterAst = GDV.prefilter.getPrefilterAst();
		if (typeof structuredClone === "function") {
			return {
				prefilterConditions: structuredClone(prefilterConditions),
				prefilterAst: structuredClone(prefilterAst)
			};
		}
		return {
			prefilterConditions: JSON.parse(JSON.stringify(prefilterConditions)),
			prefilterAst: JSON.parse(JSON.stringify(prefilterAst))
		};
	}

	function createPrefilterActiveItemRemoveButton(form, col, type) {
		const removeButton = document.createElement("button");
		removeButton.type = "button";
		removeButton.className = "prefilter-remove-btn";
		removeButton.textContent = "×";
		removeButton.setAttribute("aria-label", `Remove prefilter for ${col}`);
		removeButton.addEventListener("click", (e) => {
			e.stopPropagation();
			removeColumnWithTypeAndUpdateAll(form, col, type)
		});
		return removeButton;
	};

	function removeColumnWithTypeAndUpdateAll(form, col, type) {
		clearActiveItemParametersWithType(form, col, type);
		updateAllBasedFromActiveItemParametersChanges(form, col);
	}

	function updateAllBasedFromActiveItemParametersChanges(form, col) {
		GDV.prefilter.updateActiveItemParametersInConditionAndAst(form, col);
		updatePrefilterActiveItemsAndWarning(form);
	}

	function updatePrefilterActiveItemsAndWarning(form) {
		updatePrefilterActiveItems(form);
		updatePrefilterWarning();
	}

	function updatePrefilterActiveItems(form) {
		const activeItems = form.querySelector("#prefilter-active-items");
		if (!activeItems) return;

		const prefilterAst = GDV.prefilter.getPrefilterAst();
		if (!prefilterAst) {
			activeItems.replaceChildren();
			return;
		}
		const astNodeElement = renderPrefilterAstNode(form, prefilterAst);
		activeItems.replaceChildren(astNodeElement || document.createTextNode(""));
		renderPrefilterAstToolbar(form);
	}

	function renderPrefilterAstNode(form, node) {
		const prefilterAst = GDV.prefilter.getPrefilterAst();
		if (!node) return null;
		switch (node.ast_type) {
			case "VALUE":
				return createPrefilterActiveItem(form, node);
			case "NOT": {
				const container = createPrefilterAstGroup(form, node);
				container.appendChild(createAstParenthesis("("));
				container.appendChild(createAstOperator(form, node, "NOT"));
				const childEl = renderPrefilterAstNode(form, node.child);
				if (childEl) container.appendChild(childEl);
				container.appendChild(createAstParenthesis(")"));
				return container;
			}
			case "AND":
			case "OR": {
				const container = createPrefilterAstGroup(form, node);
				if (prefilterAst !== node) container.appendChild(createAstParenthesis("("));
				node.children.forEach((child, i) => {
					if (i > 0) container.appendChild(createAstOperator(form, node, node.ast_type));
					const childEl = renderPrefilterAstNode(form, child);
					if (childEl) container.appendChild(childEl);
				});
				if (prefilterAst !== node) container.appendChild(createAstParenthesis(")"));
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

		toolbar.replaceChildren(createToolbarContent(prefilterAstCurrentNode));
		positionPrefilterAstToolbar(toolbar, focused);
	}

	function positionPrefilterAstToolbar(toolbar, targetEl) {
		const container = toolbar.parentElement;
		if (!container) return;

		const containerRect = container.getBoundingClientRect();
		const targetRect = targetEl.getBoundingClientRect();
		const toolbarRect = toolbar.getBoundingClientRect();
		const left = targetRect.left - containerRect.left + 10;
		const top = targetRect.top - containerRect.top - toolbarRect.height - 10;

		toolbar.style.left = `${left}px`;
		toolbar.style.top = `${top}px`;
	}

	GDV.prefilter.clearActiveItemParameters = clearActiveItemParameters;
	function clearActiveItemParameters(col) {
		const form = document.querySelector(".prefilter-form");
		const activeItem = form.querySelector(`.prefilter-active-item[data-col="${col}"]`);
		clearActiveItemParametersWithType(form, col, activeItem.dataset.type);
	}

	function clearActiveItemParametersWithType(form, col, type) {
		const colEsc = window.CSS && CSS.escape ? CSS.escape(col) : col;
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

	function updatePrefilterWarning() {
		if (!isPrefilterOpen()) return;
		const prefilterConditions = GDV.prefilter.getPrefilterConditions();
		const hasFilters = Object.keys(prefilterConditions).length > 0;
		if (hasFilters) {
			GDV.prefilter.hidePrefilterWarning();
		} else {
			GDV.prefilter.showPrefilterWarning();
		}
	}

	function isPrefilterOpen() {
		return !!document.getElementById("prefilterOverlay");
	}

	function updatePrefilterConditionsRelatedItems(form) {
		GDV.prefilter.setPrefilterConditionsAndAst(GDV.state.getPrefilterConditions(), GDV.state.getPrefilterAst());
		updatePrefilterActiveItemsAndWarning(form);
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

	function bindPrefilterGridInputs(form) {
		form.addEventListener("input", (e) => {
			const input = e.target;
			if (!input || input.classList?.contains("prefilter-search-input") || !input.name) return;

			// Only text/textarea/range inputs
			if (input.type === "text" || input.tagName.toLowerCase() === "textarea" || input.classList.contains("range-input-min") || input.classList.contains("range-input-max")) {
				const col = input.name.replace(/__(min|max)$/, "");
				updateAllBasedFromActiveItemParametersChanges(form, col);
			}
		});

		form.addEventListener("change", (e) => {
			const input = e.target;
			if (!input || input.classList?.contains("prefilter-search-input") || !input.name) return;

			// Only checkboxes, selects, or final number input state
			const col = input.name.replace(/__(min|max)$/, "");
			updateAllBasedFromActiveItemParametersChanges(form, col);
		});
	};

	function bindPrefilterAstNodeFocus(form, element, node) {
		element.addEventListener("click", (e) => {
			e.stopPropagation();
			GDV.prefilter.setPrefilterAstCurrentNode(node);
			updatePrefilterActiveItems(form);
		});
	}

	function waitForPrefilterFormSubmission(form, resolve) {
		form.onsubmit = async (e) => {
			e.preventDefault();
			const prefilterFromForm = collectPrefilterFromForm();
			const prefilterConditions = prefilterFromForm.prefilterConditions;
			const prefilterAst = prefilterFromForm.prefilterAst;
			if (Object.keys(prefilterConditions).length === 0) {
				const proceed = await confirmPrefiltersWarning();
				if (!proceed) return;
			}

			GDV.state.setPrefilterConditions(prefilterConditions);
			GDV.state.setPrefilterAst(prefilterAst);
			GDV.dom.renderMainPagePrefiltersPanel();
			closePrefilterOverlay();
			resolve(prefilterConditions);
		};
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

		// Reset and update
		GDV.prefilter.resetPrefilterConditionsAndAst();
		updatePrefilterActiveItemsAndWarning(form);
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
