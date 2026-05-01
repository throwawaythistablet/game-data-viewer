(() => {
	const csvTableElement = $("#csvTable");
	const themeToggleButton = document.getElementById("themeToggleButton");
	const discussionButton = document.getElementById("discussionButton");
	const feedbackButton = document.getElementById("feedbackButton");
	const tagPatternsButton = document.getElementById("tagPatternsButton");
	const resetFiltersButton = document.getElementById("resetFiltersButton");
	const findGamesButton = document.getElementById("findGamesButton");
	const mainPrefiltersPanelSection = document.getElementById("mainPrefiltersPanelSection");
	const controlsPanelGrid = document.querySelector(".controls-main-grid");
	const csvFileButton = document.getElementById("csvFileButton");
	const csvFileInput = document.getElementById("csvFileInput");
	const columnDetailsFileButton = document.getElementById("columnDetailsFileButton");
	const columnDetailsFileInput = document.getElementById("columnDetailsFileInput");
	const gameKeysFileButton = document.getElementById("gameKeysFileButton");
	const gameKeysFileInput = document.getElementById("gameKeysFileInput");
	const selectGamesFolderButton = document.getElementById("selectGamesFolderButton");
	const pinButton = document.getElementById("controlsPinButton");
	const csvFileDisplay = document.getElementById("csvFileDisplay");
	const columnDetailsDisplay = document.getElementById("columnDetailsDisplay");
	const gameKeysDisplay = document.getElementById("gameKeysDisplay");
	const tagPatternsDisplay = document.getElementById("tagPatternsDisplay");
	const columnCategories = document.getElementById("columnCategories");
	const thumbnailsDisplay = document.getElementById("thumbnailsDisplay");
	const gamesFolderDisplay = document.getElementById("gamesFolderDisplay");
	const csvDropZone = document.getElementById("csvDropZone");

	let controlsPanelGridPinned = false;

	GDV.dom.insertHelpNotice = () => {
		const btnGroup = document.getElementById("controlsButtonGroup");
		if (btnGroup) {
			btnGroup.insertAdjacentElement("afterend", GDV.helpNotice.createHelpNotice());
		}
	};

	GDV.dom.setControPanelGridAsVisible = () => {
		controlsPanelGrid.style.display = "grid";
	};

	GDV.dom.setControPanelGridAsInvisible = () => {
		controlsPanelGrid.style.display = "none";
	};

	GDV.dom.getCsvTableElement = () => csvTableElement;

	GDV.dom.setActiveCsvFile = (file) => {
		csvFileDisplay.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
		csvFileDisplay.title = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
	};

	GDV.dom.setColumnDetails = (description) => {
		columnDetailsDisplay.textContent = description || "(None)";
	};

	GDV.dom.setGameKeys = (description) => {
		gameKeysDisplay.textContent = description || "(None)";
	};

	GDV.dom.setColumnCategories = (fileName) => {
		columnCategories.textContent = fileName || "(None)";
	};

	GDV.dom.setTagQuickSearchPatterns = (fileName) => {
		tagPatternsDisplay.textContent = fileName || "(None)";
	};

	GDV.dom.setThumbnails = (fileName) => {
		thumbnailsDisplay.textContent = fileName || "(None)";
	};

	GDV.dom.updateGameFolder = (gamesFolderName) => {
		gamesFolderDisplay.textContent = gamesFolderName || "(None)";
	};

	GDV.dom.hideMainPrefiltersPanelSection = () => {
		mainPrefiltersPanelSection.style.display = "none";
	};

	GDV.dom.showMainPrefiltersPanelSection = () => {
		mainPrefiltersPanelSection.style.display = "";
	};

	GDV.dom.showInfoBanner = (label, message, timeout) => showBanner("info", label, message, timeout);

	GDV.dom.showWarningBanner = (label, message, timeout) => showBanner("warning", label, message, timeout);

	GDV.dom.showErrorBanner = (label, message, timeout) => showBanner("error", label, message, timeout);

	GDV.dom.showPermanentWarningBanner = (label, message) => showBanner("warning", label, message, -1);

	function showBanner(type, label, message, timeout = 10000) {
		const banner = document.createElement("div");
		banner.className = `log-banner ${type}`;
		banner.dataset.label = label;

		// Close button
		const closeBtn = document.createElement("button");
		closeBtn.className = "banner-close";
		closeBtn.textContent = "×";
		closeBtn.addEventListener("click", () => hideBannerWithElement(banner));
		banner.appendChild(closeBtn);

		// Label
		const labelDiv = document.createElement("div");
		labelDiv.className = "banner-label";
		labelDiv.textContent = label;
		banner.appendChild(labelDiv);

		// Message
		const messageDiv = document.createElement("div");
		messageDiv.className = "banner-message";
		messageDiv.textContent = message;
		banner.appendChild(messageDiv);

		document.body.appendChild(banner);

		// Show animation
		requestAnimationFrame(() => banner.classList.add("show"));

		// Auto-hide
		if (timeout > 0) {
			setTimeout(() => hideBannerWithElement(banner), timeout);
		}
	}

	GDV.dom.hideBannerWithLabel = hideBannerWithLabel;
	function hideBannerWithLabel(label) {
		const banners = document.querySelectorAll(`.log-banner[data-label="${label}"]`);
		banners.forEach((banner) => {
			hideBannerWithElement(banner);
		});
	}

	function hideBannerWithElement(el) {
		if (!el) return;
		el.classList.remove("show");
		setTimeout(() => el.remove(), 300);
	}

	GDV.dom.refreshMainPagePrefiltersPanel = () => {
		const marker = document.getElementById("mainPrefiltersPanelSection");
		if (!marker) return;
		const container = document.createElement("div");
		container.id = "mainPrefiltersPanel";
		container.className = "prefilter-main-panel";
		container.appendChild(createShareUrlButton());
		container.appendChild(createMainPanelSimilarityGameSection());
		container.appendChild(createLastSearchedPrefiltersSection());
		marker.replaceChildren(container);
	};

	GDV.dom.createHighlightFromValue = (val, colName) => {
		const num = parseFloat(val);
		if (Number.isNaN(num)) return document.createTextNode(val);

		const { min, max } = GDV.state.getActiveColumnDetails()[colName] || {};
		const intensity = max === min ? 0 : Math.max(0, Math.min(1, (num - min) / (max - min)));

		const { low, high } = getRangeColors();
		const hue = Math.round(low.h + (high.h - low.h) * intensity);
		const saturation = Math.round(low.s + (high.s - low.s) * intensity);
		const lightness = Math.round(low.l + (high.l - low.l) * intensity);

		const bgColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
		const textColor = isLightTheme() ? "#000000" : "#ffffff";
		const weightClass = intensity > 0.7 ? "high" : intensity > 0.4 ? "medium" : "low";

		const span = document.createElement("span");
		span.className = `highlight-cell ${weightClass}`;
		span.style.backgroundColor = bgColor;
		span.style.color = textColor;
		span.textContent = val;

		return span;
	};

	GDV.dom.createHighlightFromSentiment = (text) => {
		if (!text) return document.createTextNode("");

		const span = document.createElement("span");
		const weightClass = text === "1. Very Positive" ? "high" : text === "9. Very Negative" ? "low" : "medium";
		span.className = `highlight-cell ${weightClass}`;
		const colorMap = getSentimentColors();
		const color = colorMap[text];
		if (color) {
			span.style.color = color;
		}
		span.textContent = text;

		return span;
	};

	GDV.dom.createHighlightFromStatus = (text) => {
		if (!text) return document.createTextNode("");

		const span = document.createElement("span");
		const weightClass = text === "Completed" ? "high" : text === "Abandoned" ? "low" : "medium";
		span.className = `highlight-cell ${weightClass}`;
		const colorMap = getStatusColors();
		const color = colorMap[text];
		if (color) {
			span.style.color = color;
		}
		span.textContent = text;

		return span;
	};

	GDV.dom.createHighlightFromPlayTimeLabel = (text) => {
		if (!text) return document.createTextNode("");

		const span = document.createElement("span");
		const weightClass = text === "1. Very Long Game" || text === "2. Long Game" ? "high" : text === "3. Medium Game" ? "medium" : "low";
		span.className = `highlight-cell ${weightClass}`;
		const colorMap = getPlayTimeColors();
		const color = colorMap[text];
		if (color) {
			span.style.color = color;
		}
		span.textContent = text;

		return span;
	};

	GDV.dom.isLightTheme = isLightTheme;
	function isLightTheme() {
		return document.body.classList.contains("light-theme");
	}

	GDV.dom.getCurrentTheme = getCurrentTheme;
	function getCurrentTheme() {
		return isLightTheme() ? "light" : "dark";
	}

	GDV.dom.updateThemeButton = updateThemeButton;
	function updateThemeButton() {
		themeToggleButton.textContent = isLightTheme() ? "🌞 Light" : "🌙 Dark";
	}

	// Unified theme-based color map
	const COLOR_MAP = {
		light: {
			range: {
				low: { h: 0, s: 70, l: 80 },   // light red
				high: { h: 120, s: 70, l: 80 } // light green
			},
			sentiment: {
				"1. Very Positive": "#006400",
				"2. Positive": "#2E8B57",
				"3. Mildly Positive": "#7FBF7F",
				"4. Neutral": "#808080",
				"5. Mixed": "#B8860B",
				"6. No Data": "#A0A0A0",
				"7. Mildly Negative": "#F2A0A0",
				"8. Negative": "#D9534F",
				"9. Very Negative": "#8B0000",
			},
			status: {
				"Completed": "#006400",
				"Onhold": "#808080",
				"Ongoing": "#B8860B",
				"Abandoned": "#8B0000",
			},
			play_time: {
				"1. Very Long Game": "#006400",
				"2. Long Game": "#2E8B57",
				"3. Medium Game": "#B8860B",
				"4. Short Game": "#8B0000",
				"5. Unknown Length": "#808080",
			}
		},
		dark: {
			range: {
				low: { h: 0, s: 70, l: 20 },   // dark red
				high: { h: 120, s: 70, l: 20 } // dark green
			},
			sentiment: {
				"1. Very Positive": "#66FF66",
				"2. Positive": "#4CFF4C",
				"3. Mildly Positive": "#B3FFB3",
				"4. Neutral": "#AAAAAA",
				"5. Mixed": "#FFD166",
				"6. No Data": "#888888",
				"7. Mildly Negative": "#FFB3B3",
				"8. Negative": "#FF6B6B",
				"9. Very Negative": "#FF3333",
			},
			status: {
				"Completed": "#66FF66",
				"Onhold": "#aaaaaa",
				"Ongoing": "#FFD166",
				"Abandoned": "#FF3333",
			},
			play_time: {
				"1. Very Long Game": "#66FF66",
				"2. Long Game": "#4CFF4C",
				"3. Medium Game": "#FFD166",
				"4. Short Game": "#FF3333",
				"5. Unknown Length": "#888888",
			}
		}
	};

	function getRangeColors() {
		const theme = getCurrentTheme();
		return COLOR_MAP[theme].range;
	}

	function getSentimentColors() {
		const theme = getCurrentTheme();
		return COLOR_MAP[theme].sentiment;
	}

	function getStatusColors() {
		const theme = getCurrentTheme();
		return COLOR_MAP[theme].status;
	}

	function getPlayTimeColors() {
		const theme = getCurrentTheme();
		return COLOR_MAP[theme].play_time;
	}

	function setControPanelGridState(expanded) {
		if (expanded) {
			controlsPanelGrid.classList.add("is-expanded");
			controlsPanelGrid.classList.remove("is-collapsed");
		} else if (!controlsPanelGridPinned && GDV.state.getActiveCsvFile()) {
			controlsPanelGrid.classList.remove("is-expanded");
			controlsPanelGrid.classList.add("is-collapsed");
		}
	}

	function createShareUrlButton() {
		const shareBtn = document.createElement("button");
		shareBtn.className = "btn";
		shareBtn.textContent = "Copy Shareable URL";

		shareBtn.addEventListener("click", async () => {
			try {
				const encoded = GDV.urlParameters.encodeDataAsUrlParameters(GDV.state.getPrefilterConditions(), GDV.state.getPrefilterAst(), GDV.state.getSimilarityGame());
				if (!encoded) {
					GDV.utils.reportSoftWarning("URL Encoding Failed", "Unable to encode prefilters for sharing.");
					return;
				}

				const baseUrl = "https://throwawaythistablet.github.io/game-data-viewer/";
				const shareUrl = `${baseUrl}?${encoded}`;
				await navigator.clipboard.writeText(shareUrl);
				GDV.utils.showInfoBanner("Shareable URL Copied", "The encoded prefilter URL has been copied to your clipboard.");
			} catch (err) {
				GDV.utils.reportSoftWarning("Clipboard Copy Failed", "Failed to copy the shareable URL to the clipboard.", err);
			}
		});
		return shareBtn;
	}

	GDV.dom.refreshMainPanelSimilarityGameAndLastSearchPrefilters = refreshMainPanelSimilarityGameAndLastSearchPrefilters;
	function refreshMainPanelSimilarityGameAndLastSearchPrefilters() {
		refreshMainPanelSimilarityGameSection();
		refreshLastSearchedPrefiltersSection();
	}

	GDV.dom.refreshMainPanelSimilarityGameSection = refreshMainPanelSimilarityGameSection;
	function refreshMainPanelSimilarityGameSection() {
		const container = document.querySelector(".prefilter-main-panel-similarity-game");
		if (!container) return;
		container.replaceChildren();
		addSimilarityGameSectionElements(container);
	}

	function createMainPanelSimilarityGameSection() {
		const container = document.createElement("div");
		container.className = "prefilter-main-panel-similarity-game";
		addSimilarityGameSectionElements(container);
		return container;
	}

	function addSimilarityGameSectionElements(container) {
		const similarityGame = GDV.state.getSimilarityGame();
		if (!similarityGame) return;

		const similarGamelabel = document.createElement("span");
		similarGamelabel.className = "prefilter-main-panel-label";
		similarGamelabel.textContent = "Similarity Score compared with:";
		container.appendChild(similarGamelabel);

		const similarGameValue = document.createElement("span");
		similarGameValue.className = "prefilter-active-item";
		similarGameValue.title = similarityGame;
		similarGameValue.textContent = similarityGame;
		container.appendChild(similarGameValue);
	}

	GDV.dom.refreshLastSearchedPrefiltersSection = refreshLastSearchedPrefiltersSection;
	function refreshLastSearchedPrefiltersSection() {
		const container = document.querySelector(".prefilter-main-panel-last-searched");
		if (!container) return;
		container.replaceChildren();
		addSimilarityGameSectionElements(container);
	}

	function createLastSearchedPrefiltersSection() {
		const container = document.createElement("div");
		container.className = "prefilter-main-panel-last-searched";
		addLastSearchedPrefiltersSection(container);
		return container;
	}

	function addLastSearchedPrefiltersSection(container) {
		const prefilterlabel = document.createElement("span");
		prefilterlabel.className = "prefilter-main-panel-label";
		prefilterlabel.textContent = "Last Searched Prefilters:";
		container.appendChild(prefilterlabel);

		const prefilterAst = GDV.state.getPrefilterAst();
		const prefilterAstDisplay = createStaticPrefilterAstDisplay(prefilterAst, prefilterAst);
		if (prefilterAstDisplay) {
			container.appendChild(prefilterAstDisplay);
		}
	}

	function createStaticPrefilterAstDisplay(node, root) {
		if (!node) return null;
		switch (node.ast_type) {
			case "VALUE":
				return createPrefilterActiveItem(node);
			case "NOT": {
				const container = createPrefilterAstGroup();
				container.appendChild(createAstOperator("NOT"));
				if (node.child.ast_type === "VALUE" || node.child.ast_type === "NOT") container.appendChild(createAstParenthesis("("));
				const childEl = createStaticPrefilterAstDisplay(node.child, root);
				if (childEl) container.appendChild(childEl);
				if (node.child.ast_type === "VALUE" || node.child.ast_type === "NOT") container.appendChild(createAstParenthesis(")"));
				return container;
			}
			case "AND":
			case "OR": {
				const container = createPrefilterAstGroup();
				if (node !== root) container.appendChild(createAstParenthesis("("));
				node.children.forEach((child, i) => {
					if (i > 0) container.appendChild(createAstOperator(node.ast_type));
					const childEl = createStaticPrefilterAstDisplay(child, root);
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

	function createPrefilterAstGroup() {
		const astGroup = document.createElement("span");
		astGroup.className = "prefilter-ast-group";
		return astGroup;
	}

	function createPrefilterActiveItem(node) {
		const prefilterConditions = GDV.state.getPrefilterConditions();
		const col = node.column;
		const val = prefilterConditions[col];
		if (!val) return null;

		const activeItem = document.createElement("span");
		activeItem.className = "prefilter-active-item";
		activeItem.dataset.col = col;
		const text = GDV.prefilter.getPrefilterDisplayText(col, val) || "";
		activeItem.textContent = `${text} `;
		activeItem.title = GDV.datatable.getColumnDescription(col) || "";
		activeItem.dataset.type = GDV.prefilter.getPrefilterDisplayType(val) || "";

		return activeItem;
	}

	function createAstOperator(type) {
		const operator = document.createElement("span");
		operator.className = "prefilter-ast-operator";
		operator.textContent = type;
		return operator;
	}

	function createAstParenthesis(text) {
		const el = document.createElement("span");
		el.className = "prefilter-ast-parenthesis";
		el.textContent = text;
		return el;
	}

	// Search button
	findGamesButton.addEventListener("click", async () => {
		if (!GDV.state.getActiveCsvFile()) {
			GDV.utils.reportHardWarning("CSV Not Loaded", "No CSV file has been loaded yet.");
			return;
		}

		if (!GDV.state.hasValidColumnDetails()) {
			GDV.utils.reportHardWarning("Column Details Missing", "No column details JSON has been loaded yet.");
			return;
		}

		await GDV.tableGenerator.showPrefiltersAndGenerateTable(GDV.state.getActiveCsvFile());
	});

	// Reset filters button
	resetFiltersButton.addEventListener("click", async () => {
		await GDV.datatable.resetAllFilters();
	});

	// Discussion button
	discussionButton.addEventListener("click", () => {
		window.open("https://f95zone.to/threads/cant-find-the-game-youre-looking-for-try-this.284593/", "_blank", "noopener,noreferrer");
	});

	// Feedback button
	feedbackButton.addEventListener("click", () => {
		window.open("https://docs.google.com/forms/d/e/1FAIpQLSevpNoZzTm6fDrWfT_3Sb4RsA8btJTFxhJByBBf9e_cw0UOEQ/viewform?usp=dialog", "_blank", "noopener,noreferrer");
	});

	// Tag Patterns button
	tagPatternsButton.addEventListener("click", () => {
		window.open("tags/tag_patterns.txt", "_blank", "noopener,noreferrer");
	});

	// Theme toggle button
	themeToggleButton.addEventListener("click", () => {
		document.body.classList.toggle("light-theme");
		localStorage.setItem("theme", isLightTheme() ? "light" : "dark");
		updateThemeButton(isLight);
	});

	controlsPanelGrid.parentElement.addEventListener("mouseenter", () => setControPanelGridState(true));
	controlsPanelGrid.parentElement.addEventListener("mouseleave", () => setControPanelGridState(false));

	// Select CSV File
	csvFileButton.addEventListener("click", () => csvFileInput.click());
	csvFileButton.setAttribute("aria-label", "Select CSV File");
	csvFileInput.style.display = "none"; // Make sure input is hidden
	csvFileInput.addEventListener("change", async (e) => {
		if (e.target.files.length) {
			await GDV.controller.loadCsvFile(e.target.files[0]);
		}
	});

	// Column Details JSON File
	columnDetailsFileButton.addEventListener("click", () => columnDetailsFileInput.click());
	columnDetailsFileButton.setAttribute("aria-label", "Load Column Details JSON");
	columnDetailsFileInput.style.display = "none"; // Make sure input is hidden
	columnDetailsFileInput.addEventListener("change", async (e) => {
		if (e.target.files.length) {
			await GDV.controller.loadColumnDetailsFile(e.target.files[0]);
		}
	});

	// Column Details JSON File
	gameKeysFileButton.addEventListener("click", () => gameKeysFileInput.click());
	gameKeysFileButton.setAttribute("aria-label", "Load Game Keys JSON");
	gameKeysFileInput.style.display = "none"; // Make sure input is hidden
	gameKeysFileInput.addEventListener("change", async (e) => {
		if (e.target.files.length) {
			await GDV.controller.loadGameKeysFile(e.target.files[0]);
		}
	});

	// Select Games Folder
	selectGamesFolderButton.addEventListener("click", async () => {
		await GDV.controller.selectGamesFolderAndLoadData();
	});

	// Pin button
	pinButton.addEventListener("click", () => {
		controlsPanelGridPinned = !controlsPanelGridPinned;
		pinButton.classList.toggle("is-active", controlsPanelGridPinned);
		setControPanelGridState(true); // always expand when pin toggled
	});

	// Drag & drop
	csvDropZone.addEventListener("dragover", (e) => {
		e.preventDefault();
		csvDropZone.classList.add("dragover");
	});

	csvDropZone.addEventListener("dragleave", () => {
		csvDropZone.classList.remove("dragover");
	});

	csvDropZone.addEventListener("drop", (e) => {
		e.preventDefault();
		csvDropZone.classList.remove("dragover");

		const file = e.dataTransfer.files[0];
		if (file?.name.endsWith(".csv")) {
			GDV.controller.loadCsvFile(file);
		} else {
			GDV.utils.reportHardWarning("Invalid File Drop", "Please drop a valid CSV file.");
		}
	});
})();
