(() => {
	// FILE_PATH_TO_SIZE_MAP START
	const filePathToSizeMap = new Map([
		["data/.gitattributes", 0],
		["data/game_column_category_details.json", 1617],
		["data/game_column_details.json", 1877113],
		["data/game_column_to_categories.json", 466981],
		["data/game_data_part_1.csv", 45479314],
		["data/game_data_part_2.csv", 45290308],
		["data/game_data_part_3.csv", 45297831],
		["data/game_data_part_4.csv", 45290690],
		["data/game_data_part_5.csv", 45292298],
		["data/game_data_part_6.csv", 45293768],
		["data/game_data_part_7.csv", 45291391],
		["data/game_data_part_8.csv", 45296826],
		["data/game_data_part_9.csv", 45316292],
		["data/game_keys.json", 1377188],
		["data/game_thumbnails.json", 20589453],
		["data/tag_full_match_patterns.json", 5545545],
		["data/tag_quick_search_patterns.json", 4572046],
	]);
	// FILE_PATH_TO_SIZE_MAP END

	GDV.controller.initialize = async () => {
		const isStandalone = location.protocol === "file:";
		if (isStandalone) {
			await initializeStandaloneMode();
		} else {
			await initializeHostedMode();
		}
	};

	GDV.controller.setCsvFile = setCsvFile;
	function setCsvFile(file) {
		GDV.state.setCsvFile(file);
		GDV.dom.setCsvFile(file);
	}

	GDV.controller.setColumnDetails = setColumnDetails;
	function setColumnDetails(columnDetails, fileName) {
		GDV.state.setColumnDetails(columnDetails);
		GDV.dom.setColumnDetails(fileName);
	}

	GDV.controller.setGameKeys = setGameKeys;
	function setGameKeys(gameKeys, fileName) {
		GDV.state.setGameKeys(gameKeys);
		GDV.dom.setGameKeys(fileName);
	}

	GDV.controller.setColumnCategoryDetails = setColumnCategoryDetails;
	function setColumnCategoryDetails(columnCategoryDetails, fileName) {
		GDV.state.setColumnCategoryDetails(columnCategoryDetails);
		GDV.dom.setColumnCategoryDetails(fileName);
	}

	GDV.controller.setColumnToCategories = setColumnToCategories;
	function setColumnToCategories(columnToCategories, fileName) {
		GDV.state.setColumnToCategories(columnToCategories);
		GDV.dom.setColumnToCategories(fileName);
	}

	GDV.controller.setTagFullMatchPatterns = setTagFullMatchPatterns;
	function setTagFullMatchPatterns(tagFullMatchPatterns, fileName) {
		const maxFullMatchRegexLength = 20000;
		GDV.state.setTagFullMatchPatterns(GDV.utils.convertJsonObjectToRegexMap(tagFullMatchPatterns, maxFullMatchRegexLength));
		GDV.dom.setTagFullMatchPatterns(fileName);
	}

	GDV.controller.setTagQuickSearchPatterns = setTagQuickSearchPatterns;
	function setTagQuickSearchPatterns(tagQuickSearchPatterns, fileName) {
		GDV.state.setTagQuickSearchPatterns(GDV.utils.convertJsonObjectToRegexMap(tagQuickSearchPatterns));
		GDV.dom.setTagQuickSearchPatterns(fileName);
	}

	GDV.controller.setThumbnails = setThumbnails;
	function setThumbnails(thumbnails, fileName) {
		GDV.state.setThumbnails(thumbnails);
		GDV.dom.setThumbnails(fileName);
	}

	GDV.controller.updateGameFolder = updateGameFolder;
	async function updateGameFolder(gamesFolderHandle) {
		GDV.state.setGamesFolderHandle(gamesFolderHandle);
		const extraFolder = await gamesFolderHandle.getDirectoryHandle("ZZZ_TOOL_FILES");
		const localWebFolder = await extraFolder.getDirectoryHandle("game-data-viewer");
		dataFolderHandle = await localWebFolder.getDirectoryHandle("data");

		if (!dataFolderHandle) {
			GDV.utils.reportHardError("Invalid Folder Structure", "The 'data' folder was not found inside the selected folder.", null, { gamesFolderHandle });
			return false;
		}
		GDV.state.setDataFolderHandle(gamesFolderHandle);
		GDV.dom.updateGameFolder(gamesFolderHandle.name);
	}

	GDV.controller.loadCsvFile = async (file) => {
		if (!file) {
			GDV.utils.reportHardWarning("No File Provided", "No file was provided to load.");
			return;
		}

		if (!file.name || !file.name.toLowerCase().endsWith(".csv")) {
			GDV.utils.reportHardWarning("Invalid File Type", "Invalid file. Please provide a CSV file.");
			return;
		}
		setCsvFile(file);
		await GDV.tableGenerator.showPrefiltersAndGenerateTable(file, false);
	};

	GDV.controller.loadColumnDetailsFile = async (file) => {
		if (!file) {
			GDV.utils.reportHardWarning("No File Provided", "No file was provided to load.");
			return;
		}
		if (!file.name || !file.name.toLowerCase().endsWith(".json")) {
			GDV.utils.reportHardWarning("Invalid File Type", "Invalid file. Please provide a JSON file.");
			return;
		}
		try {
			const text = await file.text();
			setColumnDetails(JSON.parse(text), `${file.name}`);
		} catch (err) {
			GDV.utils.reportHardError("Column Details Load Failed", "Error loading column details JSON", err, { file });
			setColumnDetails({}, null);
		}
	};

	GDV.controller.loadGameKeysFile = async (file) => {
		if (!file) {
			GDV.utils.reportHardWarning("No File Provided", "No file was provided to load.");
			return;
		}
		if (!file.name || !file.name.toLowerCase().endsWith(".json")) {
			GDV.utils.reportHardWarning("Invalid File Type", "Invalid file. Please provide a JSON file.");
			return;
		}
		try {
			const text = await file.text();
			setGameKeys(JSON.parse(text), `${file.name}`);
		} catch (err) {
			GDV.utils.reportHardError("Game Keys Load Failed", "Error loading column details JSON", err, { file });
			setGameKeys({}, null);
		}
	};

	GDV.controller.downloadDataCsvFile = () => {
		try {
			const file = GDV.state.getCsvFile();
			const url = URL.createObjectURL(file);
			const a = document.createElement("a");
			a.href = url;
			a.download = file instanceof File && file.name ? file.name : "data.csv";
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
			GDV.utils.reportInformation("CSV Download Started", `Downloading ${a.download}.`);
		} catch (err) {
			GDV.utils.reportSoftError("CSV Download Failed", "The CSV file could not be downloaded.", err, { file: GDV.state.getCsvFile() });
		}
	};

	GDV.controller.selectGamesFolderAndLoadData = async () => {
		const folderSelected = await selectGamesFolder();
		if (!folderSelected) return; // user canceled, fail gracefully

		await loadFilesFromDataFolder();
	};

	GDV.controller.loadAndUpdateTheme = loadAndUpdateTheme;
	function loadAndUpdateTheme() {
		// Load saved theme
		if (localStorage.getItem("theme") === "light") {
			document.body.classList.add("light-theme");
		}
		GDV.dom.updateThemeButton();
	}

	function getFileSize(filename) {
		return filePathToSizeMap.get(filename) ?? null;
	}

	async function initializeCommonSteps() {
		// loadAndUpdateTheme();
		GDV.dom.insertHelpNotice();
	}

	async function initializeStandaloneMode() {
		initializeCommonSteps();
		GDV.dom.setControPanelGridAsVisible();
	}

	async function loadFilesFromDataFolder() {
		if (!dataFolderHandle) {
			GDV.utils.reportSoftWarning("No Games Folder", "No games folder selected. Cannot load files.");
			return;
		}

		try {
			await GDV.loading.startLoading("Initializing...", "var(--green)");
			GDV.loading.updateLoadingDirectUpdate("Loading database records...", 0);
			await loadCsvFromLocalDataFolder();
			GDV.loading.updateLoadingDirectUpdate("Loading column details...", 80);
			await loadColumnDetailsFromLocalDataFolder();
			GDV.loading.updateLoadingDirectUpdate("Loading game keys...", 82);
			await loadGameKeysFromLocalDataFolder();
			GDV.loading.updateLoadingDirectUpdate("Loading column category details...", 84);
			await loadColumnCategoryDetailsFromLocalDataFolder();
			GDV.loading.updateLoadingDirectUpdate("Loading column to categories...", 85);
			await loadColumnToCategoriesFromLocalDataFolder();
			GDV.loading.updateLoadingDirectUpdate("Loading tag full match patterns...", 86);
			await loadTagFullMatchPatternsFromLocalDataFolder();
			GDV.loading.updateLoadingDirectUpdate("Loading tag quick search patterns...", 88);
			await loadTagQuickSearchPatternsFromLocalDataFolder();
			GDV.loading.updateLoadingDirectUpdate("Linking thumbnails...", 90);
			await loadThumbnailsFromLocalDataFolder();
			GDV.prefilter.initializePrefilterOverlayIfNeeded();
			await GDV.loading.finishLoading("Initialization complete.");
			await applyUrlPrefiltersOrPrompt();
		} catch (err) {
			GDV.utils.reportHardError("Data Folder Load Failed", "An unexpected error occurred while loading files from the data folder.", err, { dataFolderHandle });
			await GDV.loading.abortLoading();
		}
	}

	async function initializeHostedMode() {
		initializeCommonSteps();
		await GDV.loading.startLoading("Initializing...", "var(--green)");
		await loadDefaultCsv("Loading database records...", 0, 80);
		await loadDefaultColumnDetailsJson("Loading column details...", 80, 82);
		await loadDefaultGameKeysJson("Loading game keys...", 82, 84);
		await loadDefaultColumnCategoryDetailsJson("Loading column category details...", 84, 85);
		await loadDefaultColumnToCategoriesJson("Loading column to categories...", 85, 86);
		await loadDefaultTagFullMatchPatternsJson("Loading tag full match patterns...", 86, 88);
		await loadDefaultTagQuickSearchPatternsJson("Loading tag quick search patterns...", 88, 90);
		await loadDefaultThumbnailsJson("Linking thumbnails...", 90, 100);
		GDV.prefilter.initializePrefilterOverlayIfNeeded();
		await GDV.loading.finishLoading("Initialization complete.");
		await applyUrlPrefiltersOrPrompt();
	}

	async function loadDefaultCsv(label, startPercent, endPercent) {
		if (GDV.state.getCsvFile()) return;
		const files = [...filePathToSizeMap.entries()]
			.filter(([path]) => path.includes("game_data_part"))
			.map(([url, size]) => ({ url, size }))
			.sort((a, b) => a.url.localeCompare(b.url));

		const chunks = [];
		for (let i = 0; i < files.length; i++) {
			const { url, size } = files[i];

			try {
				const fileSP = startPercent + (i / files.length) * (endPercent - startPercent);
				const fileEP = startPercent + ((i + 1) / files.length) * (endPercent - startPercent);
				const response = await fetchWithProgress(url, size, label, fileSP, fileEP);
				if (!response.ok) {
					GDV.utils.reportHardError("CSV Load Failed", "An unexpected error occurred while loading a CSV chunk.");
					return;
				}
				const blob = await response.blob();
				chunks.push(blob);
			} catch (err) {
				GDV.utils.reportHardError("CSV Load Failed", "An unexpected error occurred while loading a CSV chunk.", err);
				return;
			}
		}
		const blob = new Blob(chunks, { type: "text/csv" });
		const file = new File([blob], "game_data.csv", { type: "text/csv" });
		setCsvFile(file);
		// GDV.utils.downloadBlob(blob, "game_data.csv"); // debug if needed
		// GDV.utils.downloadBlob(GDV.state.getCsvFile(), "game_data.csv"); // console debug
	}

	async function loadDefaultColumnDetailsJson(label, startPercent, endPercent) {
		if (GDV.state.hasValidColumnDetails()) {
			return; // already loaded
		}

		try {
			const response = await fetchWithProgress("data/game_column_details.json", getFileSize("data/game_column_details.json"), label, startPercent, endPercent);
			if (!response.ok) {
				GDV.utils.reportHardError("Column Details Load Failed", "Failed to fetch the default column details JSON file.", new Error(`HTTP status: ${response.status}`), {
					url: "data/game_column_details.json",
				});
				return;
			}
			const columnDetails = await response.json();
			setColumnDetails(columnDetails, "data/game_column_details.json");
		} catch (err) {
			GDV.utils.reportHardError("Column Details Load Failed", "An unexpected error occurred while loading the default column details JSON.", err);
		}
	}

	async function loadDefaultGameKeysJson(label, startPercent, endPercent) {
		try {
			const response = await fetchWithProgress("data/game_keys.json", getFileSize("data/game_keys.json"), label, startPercent, endPercent);
			if (!response.ok) {
				GDV.utils.reportHardError("Game Keys Load Failed", "Failed to fetch the default game keys JSON file.", new Error(`HTTP status: ${response.status}`), {
					url: "data/game_keys.json",
				});
				return;
			}
			const gameKeys = await response.json();
			setGameKeys(gameKeys, "data/game_keys.json");
		} catch (err) {
			GDV.utils.reportHardError("Game Keys Load Failed", "An unexpected error occurred while loading the default game keys JSON.", err);
		}
	}

	async function loadDefaultColumnCategoryDetailsJson(label, startPercent, endPercent) {
		try {
			const response = await fetchWithProgress("data/game_column_category_details.json", getFileSize("data/game_column_category_details.json"), label, startPercent, endPercent);
			if (!response.ok) {
				GDV.utils.reportHardError("Column Category Details Load Failed", "Failed to fetch the default column category details JSON file.", new Error(`HTTP status: ${response.status}`), {
					url: "data/game_column_category_details.json",
				});
				return;
			}
			const columnCategoryDetails = await response.json();
			setColumnCategoryDetails(columnCategoryDetails, "data/game_column_category_details.json");
		} catch (err) {
			GDV.utils.reportHardError("Column Category Details Load Failed", "An unexpected error occurred while loading the default column category details JSON.", err);
		}
	}

	async function loadDefaultColumnToCategoriesJson(label, startPercent, endPercent) {
		try {
			const response = await fetchWithProgress("data/game_column_to_categories.json", getFileSize("data/game_column_to_categories.json"), label, startPercent, endPercent);
			if (!response.ok) {
				GDV.utils.reportHardError("Column To Categories Load Failed", "Failed to fetch the default column to categories JSON file.", new Error(`HTTP status: ${response.status}`), {
					url: "data/game_column_to_categories.json",
				});
				return;
			}
			const columnToCategories = await response.json();
			setColumnToCategories(columnToCategories, "data/game_column_to_categories.json");
		} catch (err) {
			GDV.utils.reportHardError("Column To Categories Load Failed", "An unexpected error occurred while loading the default column to categories JSON.", err);
		}
	}

	async function loadDefaultTagFullMatchPatternsJson(label, startPercent, endPercent) {
		try {
			const response = await fetchWithProgress("data/tag_full_match_patterns.json", getFileSize("data/tag_full_match_patterns.json"), label, startPercent, endPercent);
			if (!response.ok) {
				GDV.utils.reportHardError("Tag Patterns Load Failed", "Failed to fetch the tag full match patterns JSON file.", new Error(`HTTP status: ${response.status}`), {
					url: "data/tag_full_match_patterns.json",
				});
				return;
			}
			const tagFullMatchPatterns = await response.json();
			setTagFullMatchPatterns(tagFullMatchPatterns, "data/tag_full_match_patterns.json");
		} catch (err) {
			GDV.utils.reportHardError("Tag Patterns Load Failed", "An unexpected error occurred while loading the tag full match patterns JSON.", err);
		}
	}

	async function loadDefaultTagQuickSearchPatternsJson(label, startPercent, endPercent) {
		try {
			const response = await fetchWithProgress("data/tag_quick_search_patterns.json", getFileSize("data/tag_quick_search_patterns.json"), label, startPercent, endPercent);
			if (!response.ok) {
				GDV.utils.reportHardError("Tag Patterns Load Failed", "Failed to fetch the tag quick search patterns JSON file.", new Error(`HTTP status: ${response.status}`), {
					url: "data/tag_quick_search_patterns.json",
				});
				return;
			}
			const tagQuickSearchPatterns = await response.json();
			setTagQuickSearchPatterns(tagQuickSearchPatterns, "data/tag_quick_search_patterns.json");
		} catch (err) {
			GDV.utils.reportHardError("Tag Patterns Load Failed", "An unexpected error occurred while loading the tag quick search patterns JSON.", err);
		}
	}

	async function loadDefaultThumbnailsJson(label, startPercent, endPercent) {
		try {
			const response = await fetchWithProgress("data/game_thumbnails.json", getFileSize("data/game_thumbnails.json"), label, startPercent, endPercent);
			if (!response.ok) {
				GDV.utils.reportHardError("Thumbnails Load Failed", "Failed to fetch the default thumbnails JSON file.", new Error(`HTTP status: ${response.status}`), { url: "data/game_thumbnails.json" });
				return;
			}
			const thumbnails = await response.json();
			setThumbnails(thumbnails, "data/game_thumbnails.json");
		} catch (err) {
			GDV.utils.reportHardError("Thumbnails Load Failed", "An unexpected error occurred while loading the default thumbnails JSON.", err);
		}
	}

	async function applyUrlPrefiltersOrPrompt() {
		let { prefilterConditions = null, prefilterAst = null, columnsToDisplay = null, similarityCriteria = null } = GDV.urlParameters.getDataFromUrlParameters();
		const hasConditions = prefilterConditions && Object.keys(prefilterConditions).length > 0;
		let hasAst = prefilterAst && (typeof prefilterAst === "object") && Object.keys(prefilterAst).length > 0;
		const hasColumnsToDisplay = Array.isArray(columnsToDisplay) && columnsToDisplay.length > 0;
		const hasSimilarityCriteria = similarityCriteria && (typeof similarityCriteria === "object") && Object.keys(similarityCriteria).length > 0;
		const bannerMessage = getUrlParameterMessage(hasConditions, hasAst, hasColumnsToDisplay, hasSimilarityCriteria);

		if (hasConditions && !hasAst) {
			prefilterAst = GDV.prefilter.createPrefilterAstFromConditions(prefilterConditions);
			hasAst = true;
		}
		GDV.prefilter.normalizePrefilterColumnNames(prefilterConditions, prefilterAst, []);
		if (!GDV.prefilter.arePrefiltersCorrect(prefilterConditions, prefilterAst)) {
			({ prefilterConditions, prefilterAst } = GDV.prefilter.repairPrefilterConditionsAndAst(prefilterConditions, prefilterAst));
		}

		let applied = false;
		if (hasConditions || hasAst) {
			applied = true;
			GDV.state.setPrefilterConditions(prefilterConditions);
			GDV.state.setPrefilterAst(prefilterAst);
		}
		if (hasColumnsToDisplay) {
			applied = true;
			GDV.state.setColumnsToDisplay(GDV.prefilter.completeColumnsToDisplay(columnsToDisplay, prefilterConditions));
		}
		if (hasSimilarityCriteria) {
			applied = true;
			const referenceGame = similarityCriteria?.referenceGame;
			if (referenceGame) {
				const nearestGame = GDV.utils.findNearestGameKey(referenceGame);
				GDV.state.setSimilarityReferenceGame(nearestGame);
			}
			const comparisonScope = similarityCriteria?.comparisonScope;
			if (comparisonScope) {
				GDV.state.setSimilarityComparisonScope(comparisonScope);
			}
		}
		const csvFile = GDV.state.getCsvFile();
		if (applied) {
			GDV.utils.showInfoBanner("URL Parameters Detected", bannerMessage);
			await GDV.tableGenerator.runTableGeneration(csvFile);
		} else {
			await GDV.tableGenerator.showPrefiltersAndGenerateTable(csvFile, true);
		}
	}

	function getUrlParameterMessage(hasConditions, hasAst, hasColumnsToDisplay, hasSimilarityCriteria) {
		const appliedListParts = [];
		if (hasConditions) {
			appliedListParts.push("Prefilter Conditions");
		}
		if (hasAst) {
			appliedListParts.push("Prefilter Expression");
		}
		if (hasColumnsToDisplay) {
			appliedListParts.push("Columns To Display");
		}
		if (hasSimilarityCriteria) {
			appliedListParts.push("Similarity Game");
		}
		const appliedList = appliedListParts.join(" & ");
		return `${appliedList} found in the URL. Applying now and performing an automatic search.`
	}

	async function loadCsvFromLocalDataFolder() {
		if (!dataFolderHandle) return;
		const chunks = [];
		let partIndex = 1;
		while (true) {
			const filename = `game_data_part_${partIndex}.csv`;
			const fileHandle = await dataFolderHandle.getFileHandle(filename).catch(() => null);
			if (!fileHandle) break;
			const file = await fileHandle.getFile();
			chunks.push(file); // Keep as Blob/File instead of converting to string
			partIndex++;
		}
		if (partIndex === 1) {
			GDV.utils.reportHardWarning("Missing CSV File", 'No "game_data_part_X.csv" files were found in the selected games folder.');
			return;
		}
		const blob = new Blob(chunks, { type: "text/csv" });
		const file = new File([blob], "game_data.csv", { type: "text/csv" });
		setCsvFile(file);
		// GDV.utils.downloadBlob(blob, "game_data.csv"); // for debugging if needed
	}

	async function loadColumnDetailsFromLocalDataFolder() {
		if (!dataFolderHandle || GDV.state.hasValidColumnDetails()) return;
		const fileHandle = await dataFolderHandle.getFileHandle("game_column_details.json").catch(() => null);
		if (!fileHandle) {
			GDV.utils.reportHardWarning("Missing Column Details", 'The file "game_column_details.json" was not found in the selected games folder.');
			return;
		}
		try {
			const file = await fileHandle.getFile();
			const columnDetails = JSON.parse(await file.text());
			setColumnDetails(columnDetails, "data/game_column_details.json");
		} catch (err) {
			GDV.utils.reportHardError("Failed to Load Column Details", `An error occurred while reading or parsing "${fileHandle.name}".`, err);
		}
	}

	async function loadGameKeysFromLocalDataFolder() {
		if (!dataFolderHandle) return;
		const fileHandle = await dataFolderHandle.getFileHandle("game_keys.json").catch(() => null);
		if (!fileHandle) {
			GDV.utils.reportHardWarning("Missing Game Keys", 'The file "game_keys.json" was not found in the selected games folder.');
			return;
		}
		try {
			const file = await fileHandle.getFile();
			const gameKeys = JSON.parse(await file.text());
			setGameKeys(gameKeys, "data/game_keys.json");
		} catch (err) {
			GDV.utils.reportHardError("Failed to Load Game Keys", `An error occurred while reading or parsing "${fileHandle.name}".`, err);
		}
	}

	async function loadColumnCategoryDetailsFromLocalDataFolder() {
		if (!dataFolderHandle) return;
		const fileHandle = await dataFolderHandle.getFileHandle("game_column_category_details.json").catch(() => null);
		if (!fileHandle) {
			GDV.utils.reportHardWarning("Missing Column Category Details", 'The file "game_column_category_details.json" was not found in the selected games folder.');
			return;
		}
		try {
			const file = await fileHandle.getFile();
			const columnCategoryDetails = JSON.parse(await file.text());
			setColumnCategoryDetails(columnCategoryDetails, "data/game_column_category_details.json");
		} catch (err) {
			GDV.utils.reportHardError("Failed to Load Column Category Details", `An error occurred while reading or parsing "${fileHandle.name}".`, err);
		}
	}

	async function loadColumnToCategoriesFromLocalDataFolder() {
		if (!dataFolderHandle) return;
		const fileHandle = await dataFolderHandle.getFileHandle("game_column_to_categories.json").catch(() => null);
		if (!fileHandle) {
			GDV.utils.reportHardWarning("Missing Column To Categories", 'The file "game_column_to_categories.json" was not found in the selected games folder.');
			return;
		}
		try {
			const file = await fileHandle.getFile();
			const columnToCategories = JSON.parse(await file.text());
			setColumnToCategories(columnToCategories, "data/game_column_to_categories.json");
		} catch (err) {
			GDV.utils.reportHardError("Failed to Load Column To Categories", `An error occurred while reading or parsing "${fileHandle.name}".`, err);
		}
	}

	async function loadTagFullMatchPatternsFromLocalDataFolder() {
		if (!dataFolderHandle) return;
		const fileHandle = await dataFolderHandle.getFileHandle("tag_full_match_patterns.json").catch(() => null);
		if (!fileHandle) {
			GDV.utils.reportHardWarning("Missing Tag Patterns", 'The file "tag_full_match_patterns.json" was not found in the selected games folder.');
			return;
		}
		try {
			const file = await fileHandle.getFile();
			const tagFullMatchPatterns = JSON.parse(await file.text());
			setTagFullMatchPatterns(tagFullMatchPatterns, "data/tag_full_match_patterns.json");
		} catch (err) {
			GDV.utils.reportHardError("Failed to Load Tag Patterns", `An error occurred while reading or parsing "${fileHandle.name}".`, err);
		}
	}

	async function loadTagQuickSearchPatternsFromLocalDataFolder() {
		if (!dataFolderHandle) return;
		const fileHandle = await dataFolderHandle.getFileHandle("tag_quick_search_patterns.json").catch(() => null);
		if (!fileHandle) {
			GDV.utils.reportHardWarning("Missing Tag Patterns", 'The file "tag_quick_search_patterns.json" was not found in the selected games folder.');
			return;
		}
		try {
			const file = await fileHandle.getFile();
			const tagQuickSearchPatterns = JSON.parse(await file.text());
			setTagQuickSearchPatterns(tagQuickSearchPatterns, "data/tag_quick_search_patterns.json");
		} catch (err) {
			GDV.utils.reportHardError("Failed to Load Tag Patterns", `An error occurred while reading or parsing "${fileHandle.name}".`, err);
		}
	}

	async function loadThumbnailsFromLocalDataFolder() {
		if (!dataFolderHandle) return;
		const fileHandle = await dataFolderHandle.getFileHandle("game_thumbnails.json").catch(() => null);
		if (!fileHandle) {
			GDV.utils.reportHardWarning("Missing Thumbnails", 'The file "game_thumbnails.json" was not found in the selected games folder.');
			return;
		}
		try {
			const file = await fileHandle.getFile();
			const thumbnails = JSON.parse(await file.text());
			setThumbnails(thumbnails, "data/game_thumbnails.json");
		} catch (err) {
			GDV.utils.reportHardError("Failed to Load Thumbnails", `An error occurred while reading or parsing "${fileHandle.name}".`, err);
		}
	}

	async function fetchWithProgress(url, estimatedFileSize, label, startPercent, endPercent) {
		GDV.loading.updateLoadingDirectUpdate(label, startPercent);

		const response = await fetch(url);
		if (!response.ok) return response;
		const reader = response.body?.getReader();
		if (!reader) return response;

		let loaded = 0;
		let lastUpdate = 0; // timestamp of last progress update
		const MIN_THROTTLE_MS = 200; // adjust as needed

		const stream = new ReadableStream({
			async start(controller) {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					loaded += value.byteLength;
					const total = loaded < estimatedFileSize ? estimatedFileSize : loaded;

					const now = performance.now();
					if (now - lastUpdate > MIN_THROTTLE_MS) {
						GDV.loading.updateLoadingStepProgress(label, startPercent, endPercent, loaded, total);
						lastUpdate = now;
					}

					controller.enqueue(value);
				}

				// Final one-line log, for updating estimates
				if (estimatedFileSize !== undefined && loaded !== estimatedFileSize) {
					console.warn(`[fetchWithProgress] File size mismatch for ${url} | actualLoaded=${loaded} | currentEstimate=${estimatedFileSize} | UPDATE_ESTIMATE_TO=${loaded}`);
				}

				GDV.loading.updateLoadingDirectUpdate(label, endPercent);
				controller.close();
			},
		});

		return new Response(stream, {
			headers: response.headers,
			status: response.status,
			statusText: response.statusText,
		});
	}

	async function selectGamesFolder() {
		try {
			gamesFolderHandle = await window.showDirectoryPicker();
			await updateGameFolder(gamesFolderHandle);
			return true;
		} catch (err) {
			if (err?.name === "AbortError") {
				GDV.utils.reportSoftWarning("Folder Selection Cancelled", "The user closed the folder picker without selecting a folder.", err);
				return false;
			}

			GDV.utils.reportHardError("Folder Selection Failed", "An unexpected error occurred while selecting the games folder.", err, { gamesFolderHandle });
			return false;
		}
	}
})();
