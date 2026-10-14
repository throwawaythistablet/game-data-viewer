(() => {
	let searchText = null;
	let prefilterConditions = {};
	let prefilterAst = null;
	let prefilterAstCurrentNode = null;
	let columnsToDisplay = [];
	let columnsToDisplaySet = new Set();
	let tableSortColumn = null;
	let tableSortDirection = null;
	let similarityReferenceGame = null;
	let similarityComparisonScope = null;
	let sortMode = "nearest";
	const astMarker = "---EXPRESSION---";
	const conditionsMarker = "---CONDITIONS---";
	const columnsToDisplayMarker = "---COLUMNS TO DISPLAY---";
	const tableSortColumnMarker = "---TABLE SORT COLUMN---";
	const tableSortDirectionMarker = "---TABLE SORT DIRECTION---";
	const similarityReferenceGameMarker = "---SIMILARITY REFERENCE GAME---";
	const similarityComparisonScopeMarker = "---SIMILARITY COMPARISON SCOPE---";

	GDV.prefilter.getSearchText = () => searchText;

	GDV.prefilter.setSearchText = (searchText_) => {
		searchText = searchText_;
	};

	GDV.prefilter.resetPrefilterAndColumnsToDisplay = () => {
		resetPrefilterConditionsAndAst();
		resetColumnsToDisplay();
	};

	GDV.prefilter.getPrefilterConditions = () => prefilterConditions;

	GDV.prefilter.getPrefilterAst = () => prefilterAst;

	GDV.prefilter.getPrefilterAstCurrentNode = () => prefilterAstCurrentNode;

	GDV.prefilter.setPrefilterConditionsAndAst = (prefilterConditions_, prefilterAst_) => {
		prefilterConditions = prefilterConditions_;
		if (!prefilterAst_) {
			prefilterAst = createDefaultPrefilterAst();
		} else {
			prefilterAst = prefilterAst_;
		}
		prefilterAstCurrentNode = prefilterAst;
	};

	GDV.prefilter.resetPrefilterConditionsAndAst = resetPrefilterConditionsAndAst;
	function resetPrefilterConditionsAndAst() {
		prefilterConditions = {};
		prefilterAst = null;
		prefilterAstCurrentNode = null;
	};

	GDV.prefilter.setPrefilterAstCurrentNode = (prefilterAstCurrentNode_) => {
		prefilterAstCurrentNode = prefilterAstCurrentNode_;
	};

	GDV.prefilter.addInConditionAndAst = addInConditionAndAst;
	function addInConditionAndAst(column, condition) {
		prefilterConditions[column] = condition;
		addColumnToAst(column);
		addInColumnsToDisplayIfNeeded(column);
	}

	GDV.prefilter.removeInConditionAndAst = removeInConditionAndAst;
	function removeInConditionAndAst(column) {
		delete prefilterConditions[column];
		removeColumnFromAst(column);
	}

	GDV.prefilter.removeInConditionAndUi = removeInConditionAndUi;
	function removeInConditionAndUi(column) {
		delete prefilterConditions[column];
		GDV.prefilter.renderClearedPrefilterParameters(column);
	}

	GDV.prefilter.removeColumnFromAst = removeColumnFromAst;
	function removeColumnFromAst(column) {
		if (!prefilterAst) return;
		const path = [];
		prefilterAst = removeNodeWithColumn(prefilterAst, column, path);
		prefilterAstCurrentNode = path.length ? path[path.length - 1] : prefilterAst;
	}

	GDV.prefilter.removeInPrefilterAndColumnsToDisplay = removeInPrefilterAndColumnsToDisplay;
	function removeInPrefilterAndColumnsToDisplay(form, node) {
		const removedColumns = GDV.prefilter.collectColumnsFromAst(node);
		removeInConditionsAndAstAndUi(node);
		mutateColumnsToDisplayForColumns(form, removedColumns);
	}

	function removeInConditionsAndAstAndUi(targetNode) {
		if (!prefilterAst) return;
		const path = [];
		prefilterAst = removeNodeFromConditionsAndAstAndUi(prefilterAst, targetNode, path);
		prefilterAstCurrentNode = path.length ? path[path.length - 1] : prefilterAst;
	}

	GDV.prefilter.mutateConditionsAndAstAndColumnsToDisplayForColumn = mutateConditionsAndAstAndColumnsToDisplayForColumn;
	function mutateConditionsAndAstAndColumnsToDisplayForColumn(form, column) {
		mutateConditionAndAstForColumn(form, column);
		mutateColumnsToDisplayForColumn(form, column);
	}

	function mutateConditionAndAstForColumn(form, column) {
		const columnDetails = GDV.state.getColumnDetails() || {};
		const def = columnDetails[column];
		if (!def) return;
		if (isNumericColumn(def)) {
			mutateConditionAndAstForNumericPrefilter(form, column, def);
		} else if (isCheckboxColumn(form, column)) {
			mutateConditionAndAstForCheckboxPrefilter(form, column, def);
		} else if (isTextColumn(form, column)) {
			mutateConditionAndAstForTextPrefilter(form, column);
		} else {
			removeInConditionAndAst(column);
		}
	}

	GDV.prefilter.forceToBeInFrontInColumnsToDisplay = forceToBeInFrontInColumnsToDisplay;
	function forceToBeInFrontInColumnsToDisplay(column) {
		const columnIndex = columnsToDisplay.indexOf(column);
		if (columnIndex > 0) {
			columnsToDisplay.unshift(columnsToDisplay.splice(columnIndex, 1)[0]);
		}
	}

	GDV.prefilter.shouldBeIncludedInColumnsToDisplay = shouldBeIncludedInColumnsToDisplay;
	function shouldBeIncludedInColumnsToDisplay(form, column) {
		if (isImplicitlyIncludedInColumnsToDisplay(column)) return true;
		const toggle = getFormElementsByName(form, column).find((input) =>
			input.classList.contains("prefilter-column-to-display-toggle")
		);
		return Boolean(toggle?.isOn);
	}

	GDV.prefilter.isImplicitlyIncludedInColumnsToDisplay = isImplicitlyIncludedInColumnsToDisplay;
	function isImplicitlyIncludedInColumnsToDisplay(column) {
		return Boolean(
			prefilterConditions[column] ||
			column === tableSortColumn ||
			(similarityReferenceGame && column === GDV.utils.getSimilarityScoreName())
		);
	}

	GDV.prefilter.applyPrefilterAndColumnsToDisplayToFormForColumns = applyPrefilterAndColumnsToDisplayToFormForColumns;
	function applyPrefilterAndColumnsToDisplayToFormForColumns(form, columns) {
		if (!form) return;
		columns.forEach((column) => {
			applyPrefilterConditionToField(form, column);
			applyColumnsToDisplayToField(form, column);
		});
	}

	GDV.prefilter.applyPrefilterConditionsAndColumnsToDisplayToForm = applyPrefilterConditionsAndColumnsToDisplayToForm;
	function applyPrefilterConditionsAndColumnsToDisplayToForm(form) {
		if (!form) return;
		applyPrefilterConditionsToForm(form);
		applyColumnsToDisplayToForm(form);
	}

	function applyPrefilterConditionsToForm(form) {
		for (const column in prefilterConditions) {
			applyPrefilterConditionToField(form, column);
		}
	}

	function applyColumnsToDisplayToForm(form) {
		for (const column of columnsToDisplay) {
			applyColumnsToDisplayToField(form, column);
		}
	}

	function applyColumnsToDisplayToField(form, column) {
		const elements = getFormElementsByName(form, column);
		const toggle = elements.find((element) => element.classList.contains("prefilter-column-to-display-toggle"));
		if (!toggle) return;

		toggle.isOn = columnsToDisplaySet.has(column) && !isImplicitlyIncludedInColumnsToDisplay(column);
		applyColumnDisplayToggleState(toggle);
	}

	GDV.prefilter.applyColumnDisplayToggleState = applyColumnDisplayToggleState;
	function applyColumnDisplayToggleState(toggle) {
		toggle.classList.toggle("is-on", toggle.isOn);
		toggle.setAttribute("aria-pressed", String(toggle.isOn));
		toggle.setAttribute("aria-label", toggle.isOn ? `Remove from Columns to Display` : `Add to Columns to Display`);
	}

	GDV.prefilter.applyNotToNode = applyNotToNode;
	function applyNotToNode(node) {
		applyOperationToNode(node, convertNodeToNot);
	}

	GDV.prefilter.applyAndToNode = applyAndToNode;
	function applyAndToNode(node) {
		applyOperationToNode(node, convertNodeToAnd);
	}

	GDV.prefilter.applyOrToNode = applyOrToNode;
	function applyOrToNode(node) {
		applyOperationToNode(node, convertNodeToOr);
	}

	GDV.prefilter.moveNodeIntoGroup = moveNodeIntoGroup;
	function moveNodeIntoGroup(node) {
		applyOperationToNode(node, wrapNodeWithAnd);
		if (prefilterAstCurrentNode?.children?.length) {
			prefilterAstCurrentNode = prefilterAstCurrentNode.children[0];
		}
	}

	GDV.prefilter.moveNodeOutOfGroup = moveNodeOutOfGroup;
	function moveNodeOutOfGroup(node) {
		moveNodeOutOfGroupInAst(node);
	}

	GDV.prefilter.normalizePrefilterAst = normalizePrefilterAst;
	function normalizePrefilterAst() {
		prefilterAst = normalizeNode(prefilterAst);
		prefilterAstCurrentNode = prefilterAst;
	}

	GDV.prefilter.collectColumnsFromAst = collectColumnsFromAst;
	function collectColumnsFromAst(node) {
		return [...collectColumnsSetFromAst(node)]
	}

	GDV.prefilter.collectColumnsSetFromAst = collectColumnsSetFromAst;
	function collectColumnsSetFromAst(node) {
		const columns = new Set();
		function traverse(node) {
			if (!node) return;
			switch (node.ast_type) {
				case "VALUE":
					if (node.column != null) {
						columns.add(node.column);
					}
					return;
				case "NOT":
					traverse(node.child);
					return;
				case "AND":
				case "OR":
					if (!node.children) return;
					for (let i = 0; i < node.children.length; i++) {
						traverse(node.children[i]);
					}
					return;
				default:
					return;
			}
		}
		traverse(node);
		return columns;
	}

	GDV.prefilter.getColumnsToDisplay = () => columnsToDisplay;

	GDV.prefilter.getColumnsToDisplaySet = () => columnsToDisplaySet;

	GDV.prefilter.setColumnsToDisplay = (columnsToDisplay_) => {
		columnsToDisplay = columnsToDisplay_;
		columnsToDisplaySet = new Set(columnsToDisplay_);
	};

	GDV.prefilter.addInColumnsToDisplay = addInColumnsToDisplayIfNeeded;
	function addInColumnsToDisplayIfNeeded(column) {
		if (columnsToDisplaySet.has(column)) return;
		columnsToDisplay.push(column);
		columnsToDisplaySet.add(column);
	}

	GDV.prefilter.removeInColumnsToDisplay = removeInColumnsToDisplay;
	function removeInColumnsToDisplay(column) {
		if (!columnsToDisplaySet.has(column)) return;
		const index = columnsToDisplay.indexOf(column);
		if (index === -1) return;
		columnsToDisplay.splice(index, 1);
		columnsToDisplaySet.delete(column);
	}

	GDV.prefilter.resetColumnsToDisplay = resetColumnsToDisplay;
	function resetColumnsToDisplay() {
		columnsToDisplay = [];
		columnsToDisplaySet = new Set();
	}

	GDV.prefilter.moveInColumnsToDisplay = moveInColumnsToDisplay;
	function moveInColumnsToDisplay(column, newIndex) {
		if (!columnsToDisplaySet.has(column)) return;
		if (!Number.isInteger(newIndex) || newIndex < 0 || newIndex >= columnsToDisplay.length) return;
		const currentIndex = columnsToDisplay.indexOf(column);
		if (currentIndex === -1 || currentIndex === newIndex) return;
		columnsToDisplay.splice(currentIndex, 1);
		columnsToDisplay.splice(newIndex, 0, column);
	}

	GDV.prefilter.repairPrefilterConditionsAndAst = repairPrefilterConditionsAndAst;
	function repairPrefilterConditionsAndAst(prefilterConditions, prefilterAst) {
		const columnDetails = GDV.state.getColumnDetails() || {};

		// --- 1. CLEAN CONDITIONS (schema-level validation only)
		const cleanConditions = {};
		for (const column in (prefilterConditions || {})) {
			if (columnDetails[column]) {
				cleanConditions[column] = prefilterConditions[column];
			}
		}

		// --- 2. CLEAN AST (must exist in cleaned conditions)
		function cleanAst(node) {
			if (!node) return null;

			switch (node.ast_type) {
				case "VALUE":
					return cleanConditions[node.column] ? node : null;
				case "NOT": {
					const child = cleanAst(node.child);
					if (!child) return null;
					return { ast_type: "NOT", child };
				}
				case "AND":
				case "OR": {
					if (!node.children) return null;
					const children = [];
					for (let i = 0; i < node.children.length; i++) {
						const cleaned = cleanAst(node.children[i]);
						if (cleaned) children.push(cleaned);
					}
					if (children.length === 0) return null;
					if (children.length === 1) return children[0];

					return { ast_type: node.ast_type, children };
				}

				default:
					return null;
			}
		}
		let cleanAstRoot = cleanAst(prefilterAst);

		// --- 3. COLLECT AST COLUMNS (reuse existing utility)
		const astColumnsSet = collectColumnsSetFromAst(cleanAstRoot);

		// --- 4. FIND MISSING CONDITIONS (present in conditions but not AST)
		const missingNodes = [];
		for (const column in cleanConditions) {
			if (!astColumnsSet.has(column)) {
				missingNodes.push({
					ast_type: "VALUE",
					column: column
				});
			}
		}

		// --- 5. INJECT MISSING NODES INTO AST
		if (missingNodes.length > 0) {
			if (!cleanAstRoot) {
				cleanAstRoot =
					missingNodes.length === 1
						? missingNodes[0]
						: { ast_type: "AND", children: missingNodes };

			} else if (cleanAstRoot.ast_type === "AND") {
				cleanAstRoot.children.push(...missingNodes);

			} else {
				cleanAstRoot = {
					ast_type: "AND",
					children: [cleanAstRoot, ...missingNodes]
				};
			}
		}

		// --- 6. NORMALIZE FINAL AST
		cleanAstRoot = normalizeNode(cleanAstRoot);

		// --- 7. RETURN REPAIRED STATE
		return {
			prefilterConditions: cleanConditions,
			prefilterAst: cleanAstRoot
		};
	}

	GDV.prefilter.copyPrefiltersToClipboard = copyPrefiltersToClipboard;
	function copyPrefiltersToClipboard() {
		normalizePrefilterAst();
		GDV.prefilter.flushAndCommitPrefilterSimilarityInForm();
		navigator.clipboard.writeText(serializePrefilters()).catch((err) => {
			GDV.utils.reportSoftError("Clipboard write failed", "Could not write content to clipboard.", err);
		});
	}

	GDV.prefilter.pastePrefiltersFromClipboard = pastePrefiltersFromClipboard;
	async function pastePrefiltersFromClipboard() {
		try {
			const text = await navigator.clipboard.readText();
			deserializePrefilters(text);
		} catch (err) {
			GDV.utils.reportSoftError("Clipboard read failed", "Could not access clipboard content.", err);
		}
	}

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

	GDV.prefilter.resetPrefilterFormInputs = resetPrefilterFormInputs;
	function resetPrefilterFormInputs(form) {
		if (!form) return;

		// Clear tag checkboxes
		form.querySelectorAll('.prefilter-tag-group input[type="checkbox"]').forEach((input) => {
			input.checked = false;
		});

		// Clear choice checkboxes
		form.querySelectorAll('.prefilter-box input[type="checkbox"]').forEach((input) => {
			input.checked = false;
		});

		// Clear range inputs
		form.querySelectorAll('.prefilter-range input[type="number"]').forEach((input) => {
			input.value = "";
		});

		// Clear text inputs (excluding search box)
		form.querySelectorAll('input[type="text"]:not(.prefilter-search-input), textarea').forEach((input) => {
			input.value = "";
		});

		// Clear column display toggles
		form.querySelectorAll(".prefilter-column-to-display-toggle").forEach((toggle) => {
			toggle.isOn = false;
			applyColumnDisplayToggleState(toggle);
		});
	}

	function mutateConditionAndAstForNumericPrefilter(form, column, def) {
		const [minEl] = getFormElementsByName(form, `${column}__min`);
		const [maxEl] = getFormElementsByName(form, `${column}__max`);
		if (!minEl && !maxEl) {
			removeInConditionAndAst(column);
			return;
		}
		let min = minEl?.value === "" ? null : Number(minEl.value);
		let max = maxEl?.value === "" ? null : Number(maxEl.value);
		if (Number.isNaN(min)) min = null;
		if (Number.isNaN(max)) max = null;
		if (def.type === "int") {
			if (min != null) min = Math.round(min);
			if (max != null) max = Math.round(max);
		}
		if (min == null && max == null) {
			removeInConditionAndAst(column);
		} else {
			addInConditionAndAst(column, { type: def.type, min, max });
		}
	}

	function mutateConditionAndAstForCheckboxPrefilter(form, column, def) {
		const checkboxes = getFormElementsByName(form, column).filter((e) => e.type === "checkbox");
		const checked = checkboxes.filter((c) => c.checked).map((c) => c.value);

		if (checked.length === 0 || checked.length === checkboxes.length) {
			removeInConditionAndAst(column);
		} else {
			const converted = checked.map((v) => convertCheckboxValue(v, def.type));
			addInConditionAndAst(column, { type: def.type, choices: converted });
		}
	}

	function mutateConditionAndAstForTextPrefilter(form, column) {
		const textInputs = getFormElementsByName(form, column).filter((e) => e.tagName.toLowerCase() === "input" || e.tagName.toLowerCase() === "textarea");
		if (!textInputs.length) return;

		const value = textInputs[0].value?.trim();
		if (!value) {
			removeInConditionAndAst(column);
		}
		else {
			addInConditionAndAst(column, { text: [value] });
		}
	}

	function mutateColumnsToDisplayForColumns(form, columns) {
		columns.forEach((column) => {
			mutateColumnsToDisplayForColumn(form, column);
		});
	}

	GDV.prefilter.mutateColumnsToDisplayForColumn = mutateColumnsToDisplayForColumn;
	function mutateColumnsToDisplayForColumn(form, column) {
		if (shouldBeIncludedInColumnsToDisplay(form, column)) {
			addInColumnsToDisplayIfNeeded(column);
		} else {
			removeInColumnsToDisplay(column);
		}
	}

	function getFormElementsByName(form, name) {
		const elements = form.elements?.[name];
		if (!elements) return [];
		// If it's a single element → it will have tagName
		if (elements.tagName) {
			return [elements];
		}
		// Otherwise assume it's a collection (RadioNodeList / HTMLCollection / etc.)
		if (typeof elements.length === "number") {
			return Array.from(elements);
		}
		return [];
	}

	function convertCheckboxValue(value, type) {
		if (type === "bool") return value === "true";
		if (type === "int") return parseInt(value, 10);
		if (type === "float") return parseFloat(value);
		if (type === "tag") return parseInt(value, 10);
		if (type === "str") return String(value);
		// fallback: auto-detect numeric
		const num = Number(value);
		return Number.isFinite(num) ? (value.includes(".") ? parseFloat(value) : parseInt(value, 10)) : String(value);
	}

	// Determine column type
	function isNumericColumn(def) {
		return def.type === "int" || def.type === "float";
	}

	function isCheckboxColumn(form, column) {
		return getFormElementsByName(form, column).some((e) => e.type === "checkbox");
	}

	function isTextColumn(form, column) {
		return getFormElementsByName(form, column).some((e) => e.tagName.toLowerCase() === "input" || e.tagName.toLowerCase() === "textarea");
	}

	function applyPrefilterConditionToField(form, column) {
		const prefilterCondition = prefilterConditions[column];
		if (!prefilterCondition) {
			applyNumericToForm(form, column, { min: null, max: null });
			applyCheckboxToForm(form, column, { choices: [] });
			applyTextToForm(form, column, { text: [] });
			return;
		}
		if (prefilterCondition.type === "int" || prefilterCondition.type === "float") {
			applyNumericToForm(form, column, prefilterCondition);
			return;
		}
		if (prefilterCondition.choices) {
			applyCheckboxToForm(form, column, prefilterCondition);
			return;
		}
		if (prefilterCondition.text) {
			applyTextToForm(form, column, prefilterCondition);
			return;
		}
	}

	function applyNumericToForm(form, column, condition) {
		const [minEl] = getFormElementsByName(form, `${column}__min`);
		const [maxEl] = getFormElementsByName(form, `${column}__max`);
		if (minEl) minEl.value = condition.min ?? "";
		if (maxEl) maxEl.value = condition.max ?? "";
	}

	function applyCheckboxToForm(form, column, condition) {
		const checkboxes = getFormElementsByName(form, column).filter(e => e.type === "checkbox");
		if (!checkboxes.length) return;
		const selected = new Set(condition.choices || []);
		for (const cb of checkboxes) {
			cb.checked = selected.has(convertCheckboxValue(cb.value, condition.type));
		}
	}

	function applyTextToForm(form, column, condition) {
		const inputs = getFormElementsByName(form, column)
			.filter(e =>
				e.tagName.toLowerCase() === "input" ||
				e.tagName.toLowerCase() === "textarea"
			);
		if (!inputs.length) return;
		inputs[0].value = condition.text?.[0] ?? "";
	}

	function createDefaultPrefilterAst() {
		const columns = Object.keys(prefilterConditions || {});
		if (columns.length === 0) return null;
		if (columns.length === 1) {
			return {
				ast_type: "VALUE",
				column: columns[0]
			};
		}
		return {
			ast_type: "AND",
			children: columns.map(column => ({
				ast_type: "VALUE",
				column: column
			}))
		};
	}

	function addColumnToAst(column) {
		const newNode = { ast_type: "VALUE", column };
		if (!prefilterAst) {
			prefilterAst = newNode;
			prefilterAstCurrentNode = prefilterAst;
			return;
		}
		if (astHasColumn(prefilterAst, column)) return;
		switch (prefilterAstCurrentNode.ast_type) {
			case "VALUE": {
				const parentNode = getParentNode(prefilterAst, prefilterAstCurrentNode);
				if (parentNode && (parentNode.ast_type === "AND" || parentNode.ast_type === "OR")) {
					parentNode.children.push(newNode);
					prefilterAstCurrentNode = newNode;
					return;
				}
				const targetNode = prefilterAstCurrentNode;
				const wrapperNode = { ast_type: "AND", children: [targetNode, newNode] };
				if (replaceNodeInAst(targetNode, wrapperNode)) {
					prefilterAstCurrentNode = newNode;
				}
				return;
			}
			case "NOT": {
				const targetNode = prefilterAstCurrentNode;
				const wrapperNode = { ast_type: "AND", children: [targetNode, newNode] };
				if (replaceNodeInAst(targetNode, wrapperNode)) {
					prefilterAstCurrentNode = newNode;
				}
				return;
			}
			case "AND":
			case "OR": {
				if (!prefilterAstCurrentNode.children) prefilterAstCurrentNode.children = [];
				prefilterAstCurrentNode.children.push(newNode);
				return;
			}
			default:
				GDV.utils.reportSoftError("Problem updating your filters", "The filter system received an unexpected internal structure while trying to update your active filters. Your changes may not have been fully applied visually.", null, { nodeType: prefilterAstCurrentNode.ast_type, node: prefilterAstCurrentNode, column: column });
				return;
		}
	}

	function astHasColumn(node, column) {
		if (!node) return false;
		if (node.ast_type === "VALUE") return node.column === column;
		if (node.ast_type === "NOT") return astHasColumn(node.child, column);
		if (node.ast_type === "AND" || node.ast_type === "OR") return node.children.some(child => astHasColumn(child, column));
		return false;
	}

	function removeNodeWithColumn(node, column, path) {
		if (!node) return null;
		path.push(node);
		switch (node.ast_type) {
			case "VALUE":
				if (node.column === column) {
					path.pop();
					return null;
				}
				path.pop();
				return node;
			case "NOT":
				if (node.child) {
					node.child = removeNodeWithColumn(node.child, column, path);
				}
				if (!node.child) {
					path.pop();
					return null;
				}
				path.pop();
				return node;
			case "AND":
			case "OR":
				if (!node.children) {
					path.pop();
					return node;
				}
				node.children = node.children
					.map(child => removeNodeWithColumn(child, column, path))
					.filter(Boolean);
				if (node.children.length === 0) {
					path.pop();
					return null;
				}
				if (node.children.length === 1) {
					const onlyChild = node.children[0];
					path.pop();
					return onlyChild;
				}
				path.pop();
				return node;
			default:
				GDV.utils.reportSoftError("Problem removing a filter", "The system encountered an unexpected filter structure while trying to remove a selected filter. Some filters may still appear until refreshed.", null, { nodeType: node.ast_type, node, column: column });
				path.pop();
				return node;
		}
	}

	function removeNodeFromConditionsAndAstAndUi(node, targetNode, path) {
		if (!node) return null;
		path.push(node);
		switch (node.ast_type) {
			case "VALUE":
				if (node === targetNode) {
					removeAllConditionsAndUiInSubtree(node);
					path.pop();
					return null;
				}
				path.pop();
				return node;
			case "NOT":
				if (node === targetNode) {
					removeAllConditionsAndUiInSubtree(node);
					path.pop();
					return null;
				}
				if (node.child) node.child = removeNodeFromConditionsAndAstAndUi(node.child, targetNode, path);
				if (!node.child) {
					path.pop();
					return null;
				}
				path.pop();
				return node;
			case "AND":
			case "OR":
				if (node === targetNode) {
					removeAllConditionsAndUiInSubtree(node);
					path.pop();
					return null;
				}
				if (!node.children) {
					path.pop();
					return node;
				}
				node.children = node.children.map(child => removeNodeFromConditionsAndAstAndUi(child, targetNode, path)).filter(Boolean);
				if (node.children.length === 0) {
					path.pop();
					return null;
				}
				if (node.children.length === 1) {
					const onlyChild = node.children[0];
					path.pop();
					return onlyChild;
				}
				path.pop();
				return node;
			default:
				GDV.utils.reportSoftError("Problem removing a filter", "The system encountered an unexpected filter structure while trying to remove a selected filter. Some filters may still appear until refreshed.", null, { nodeType: node.ast_type, node, targetNode });
				path.pop();
				return node;
		}
	}

	function removeAllConditionsAndUiInSubtree(node) {
		if (!node) return;
		switch (node.ast_type) {
			case "VALUE":
				GDV.prefilter.removeInConditionAndUi(node.column);
				return;
			case "NOT":
				removeAllConditionsAndUiInSubtree(node.child);
				return;
			case "AND":
			case "OR":
				if (!node.children) return;
				node.children.forEach(removeAllConditionsAndUiInSubtree);
				return;
		}
	}

	function wrapNodeWithAnd(node) {
		return { ast_type: "AND", children: [node] };
	}

	function convertNodeToNot(node) {
		if (node.ast_type === "NOT") {
			return node.child || null;
		}
		return { ast_type: "NOT", child: node };
	}

	function convertNodeToAnd(node) {
		if (!node) return node;
		if (node.ast_type === "AND") return node;
		if (node.ast_type === "OR") {
			node.ast_type = "AND";
			return node;
		}
		if (node.ast_type === "VALUE" || node.ast_type === "NOT") {
			return { ast_type: "AND", children: [node] };
		}
		return node;
	}

	function convertNodeToOr(node) {
		if (!node) return node;
		if (node.ast_type === "OR") return node;
		if (node.ast_type === "AND") {
			node.ast_type = "OR";
			return node;
		}
		if (node.ast_type === "VALUE" || node.ast_type === "NOT") {
			return { ast_type: "OR", children: [node] };
		}
		return node;
	}

	function getParentNode(node, targetNode) {
		if (!node || !targetNode) return null;
		if (node === targetNode) return null;
		if (node.ast_type === "NOT") {
			if (node.child === targetNode) {
				return node;
			}
			return getParentNode(node.child, targetNode);
		}
		if (node.ast_type === "AND" || node.ast_type === "OR") {
			if (!node.children) return null;
			for (let i = 0; i < node.children.length; i++) {
				if (node.children[i] === targetNode) {
					return node;
				}
				const parentNode = getParentNode(node.children[i], targetNode)
				if (parentNode) return parentNode;
			}
		}
		return null;
	}

	function replaceNodeInAst(targetNode, replacementNode) {
		const isReplaced = replaceNode(prefilterAst, targetNode, replacementNode);
		if (prefilterAst === targetNode) {
			prefilterAst = replacementNode;
			return true;
		}
		return isReplaced;
	}

	function replaceNode(node, targetNode, replacementNode) {
		if (!node || !targetNode) return false;
		if (node === targetNode) return false;
		if (node.ast_type === "NOT") {
			if (node.child === targetNode) {
				node.child = replacementNode;
				return true;
			}
			return replaceNode(node.child, targetNode, replacementNode);
		}
		if (node.ast_type === "AND" || node.ast_type === "OR") {
			if (!node.children) return false;
			for (let i = 0; i < node.children.length; i++) {
				if (node.children[i] === targetNode) {
					node.children[i] = replacementNode;
					return true;
				}
				if (replaceNode(node.children[i], targetNode, replacementNode)) return true;
			}
		}
		return false;
	}

	function applyOperationToNode(node, operationFunction) {
		if (!prefilterAst || !node || typeof operationFunction !== "function") return;
		const targetNode = node;
		const transformedNode = operationFunction(targetNode);
		if (!transformedNode) return;
		if (replaceNodeInAst(targetNode, transformedNode)) {
			prefilterAstCurrentNode = transformedNode;
		}
	}

	function moveNodeOutOfGroupInAst(node) {
		if (!prefilterAst || !node) return;
		const rebuilt = moveOutOfGroup(prefilterAst, node);
		if (!rebuilt) return;
		prefilterAst = rebuilt;
		return rebuilt;
	}

	function moveOutOfGroup(traversalNode, targetNode) {
		if (!traversalNode) return null;
		if (traversalNode === targetNode) return targetNode;
		switch (traversalNode.ast_type) {
			case "VALUE":
				return traversalNode;
			case "NOT": {
				const child = traversalNode.child;
				if (!child) return null;
				traversalNode.child = moveOutOfGroup(child, targetNode);
				return traversalNode;
			}
			case "AND":
			case "OR": {
				if (!traversalNode.children) return traversalNode;
				const children = traversalNode.children;
				for (let i = 0; i < children.length; i++) {
					const child = children[i];
					if (!child) continue;
					if (child.ast_type === "AND" || child.ast_type === "OR") {
						const grandChildren = child.children;
						if (grandChildren.length === 1) {
							const grandChild = grandChildren[0];
							if (grandChild === targetNode) {
								traversalNode.children.push(targetNode);
								traversalNode.children.splice(i, 1);
								return traversalNode;
							}
						}
						for (let j = 0; j < grandChildren.length; j++) {
							const grandChild = grandChildren[j];
							if (grandChild === targetNode) {
								traversalNode.children.push(targetNode);
								traversalNode.children[i].children.splice(j, 1);
								return traversalNode;
							}
						}
					}
				}
				if (children.length === 1) {
					const child = children[0];
					if (!child) return null;
					if (child === targetNode) return targetNode;
					const newChild = moveOutOfGroup(child, targetNode);
					traversalNode.children[0] = newChild;
					if (newChild === targetNode) return targetNode;
					return traversalNode;
				}
				for (let i = 0; i < children.length; i++) {
					const child = children[i];
					if (!child) continue;
					if (child === targetNode) {
						if (children.length === 2) return traversalNode;
						const newChildren = [traversalNode, targetNode];
						children.splice(i, 1);
						return { ast_type: "AND", children: newChildren };
					}
					const newChild = moveOutOfGroup(child, targetNode);
					if (newChild === targetNode) {
						if (children.length === 2) return traversalNode;
						const newChildren = [traversalNode, targetNode];
						children.splice(i, 1);
						return { ast_type: "AND", children: newChildren };
					}
					children[i] = newChild;
				}
				return traversalNode;
			}
		}
		return traversalNode;
	}

	function normalizeNode(node) {
		if (!node) return null;
		switch (node.ast_type) {
			case "VALUE":
				return node;
			case "NOT": {
				if (!node.child) return null;
				const child = normalizeNode(node.child);
				if (!child) return null;
				if (child.ast_type === "NOT") return normalizeNode(child.child);
				return { ast_type: "NOT", child };
			}
			case "AND":
			case "OR": {
				if (!node.children) return null;
				const type = node.ast_type;
				const children = node.children;
				const newChildren = [];
				for (let i = 0; i < children.length; i++) {
					const child = children[i];
					if (!child) continue;
					const normalized = normalizeNode(child);
					if (!normalized) continue;
					if (normalized.ast_type === type) {
						const inner = normalized.children;
						if (inner) {
							for (let j = 0; j < inner.length; j++) {
								const innerChild = inner[j];
								if (innerChild) newChildren.push(innerChild);
							}
						}
						continue;
					}
					newChildren.push(normalized);
				}
				const deduped = [];
				for (let i = 0; i < newChildren.length; i++) {
					let exists = false;
					for (let j = 0; j < deduped.length; j++) {
						if (deduped[j] === newChildren[i]) {
							exists = true;
							break;
						}
					}
					if (!exists) deduped.push(newChildren[i]);
				}
				if (deduped.length === 0) return null;
				if (deduped.length === 1) return deduped[0];
				return { ast_type: type, children: deduped };
			}
		}
		return node;
	}

	function convertAstNodeToString(node) {
		if (!node) return "";
		switch (node.ast_type) {
			case "VALUE":
				return node.column || "";
			case "NOT": {
				const child = convertAstNodeToString(node.child);
				return child ? `NOT(${child})` : "";
			}
			case "AND":
			case "OR": {
				if (!node.children || !node.children.length) return "";
				const parts = [];
				for (let i = 0; i < node.children.length; i++) {
					const childText = convertAstNodeToString(node.children[i]);
					if (childText) parts.push(childText);
				}
				if (!parts.length) return "";
				return `${node.ast_type}(${parts.join(", ")})`;
			}
			default:
				return "";
		}
	}

	function convertStringToAst(text) {
		if (!text || typeof text !== "string") return null;
		text = text.trim();
		if (!text) return null;
		let i = 0;
		function skipWhitespace() {
			while (i < text.length && /\s/.test(text[i])) i++;
		}
		function readWord() {
			skipWhitespace();
			const start = i;
			while (i < text.length) {
				const c = text[i];
				if (c === "(" || c === ")" || c === "," || /\s/.test(c)) break;
				i++;
			}
			return text.slice(start, i).trim();
		}
		function parseValue() {
			skipWhitespace();
			const start = i;
			let depth = 0;
			while (i < text.length) {
				const c = text[i];
				if (c === "(") {
					depth++;
					i++;
					continue;
				}
				if (c === ")") {
					if (depth === 0) break;
					depth--;
					i++;
					continue;
				}
				if (c === "," && depth === 0) break;
				i++;
			}
			const raw = text.slice(start, i).trim();
			if (!raw) return null;
			return { ast_type: "VALUE", column: raw };
		}
		function parseExpression() {
			skipWhitespace();
			const start = i;
			const name = readWord();
			if (name === "AND" || name === "OR" || name === "NOT") {
				skipWhitespace();
				if (text[i] === "(") {
					i++;
					if (name === "NOT") {
						const child = parseExpression();
						skipWhitespace();
						if (text[i] === ")") i++;
						return child ? { ast_type: "NOT", child } : null;
					}
					const children = [];
					while (i < text.length) {
						skipWhitespace();
						if (text[i] === ")") {
							i++;
							break;
						}
						const child = parseExpression();
						if (child) children.push(child);
						skipWhitespace();
						if (text[i] === ",") {
							i++;
							continue;
						}
						if (text[i] === ")") {
							i++;
							break;
						}
					}
					return { ast_type: name, children };
				}
			}
			i = start;
			return parseValue();
		}
		const ast = parseExpression();
		if (!ast) return null;
		return ast;
	}

	function serializePrefilters() {
		const astText = convertAstNodeToString(prefilterAst);
		const conditionsText = JSON.stringify(prefilterConditions, null, 2);
		const columnsToDisplayText = JSON.stringify(columnsToDisplay, null, 2);
		const tableSortColumnText = JSON.stringify(tableSortColumn, null, 2);
		const tableSortDirectionText = JSON.stringify(tableSortDirection, null, 2);
		const similarityReferenceGameText = JSON.stringify(similarityReferenceGame, null, 2);
		const similarityComparisonScopeText = JSON.stringify(similarityComparisonScope, null, 2);

		return `${astMarker}\n${astText}\n\n` +
			`${conditionsMarker}\n${conditionsText}\n\n` +
			`${columnsToDisplayMarker}\n${columnsToDisplayText}\n\n` +
			`${tableSortColumnMarker}\n${tableSortColumnText}\n\n` +
			`${tableSortDirectionMarker}\n${tableSortDirectionText}\n\n` +
			`${similarityReferenceGameMarker}\n${similarityReferenceGameText}\n\n` +
			`${similarityComparisonScopeMarker}\n${similarityComparisonScopeText}`;
	}

	function deserializePrefilters(text) {
		if (!text || typeof text !== "string") return;

		const astIndex = text.indexOf(astMarker);
		const conditionsIndex = text.indexOf(conditionsMarker);
		const columnsToDisplayIndex = text.indexOf(columnsToDisplayMarker);
		const tableSortColumnIndex = text.indexOf(tableSortColumnMarker);
		const tableSortDirectionIndex = text.indexOf(tableSortDirectionMarker);
		const similarityReferenceGameIndex = text.indexOf(similarityReferenceGameMarker);
		const similarityComparisonScopeIndex = text.indexOf(similarityComparisonScopeMarker);

		if (astIndex === -1 || conditionsIndex === -1 || columnsToDisplayIndex === -1 || similarityReferenceGameIndex === -1 || similarityComparisonScopeIndex === -1) {
			GDV.utils.reportSoftWarning("Invalid clipboard format", "Clipboard is missing EXPRESSION, CONDITIONS, COLUMNS TO DISPLAY, SIMILARITY REFERENCE GAME, or SIMILARITY COMPARISON SCOPE sections.");
			return;
		}

		const astText = text.slice(astIndex + astMarker.length, conditionsIndex).trim();
		const conditionsText = text.slice(conditionsIndex + conditionsMarker.length, columnsToDisplayIndex).trim();
		const columnsToDisplayText = text.slice(columnsToDisplayIndex + columnsToDisplayMarker.length, tableSortColumnIndex).trim();
		const tableSortColumnText = text.slice(tableSortColumnIndex + tableSortColumnMarker.length, tableSortDirectionIndex).trim();
		const tableSortDirectionText = text.slice(tableSortDirectionIndex + tableSortDirectionMarker.length, similarityReferenceGameIndex).trim();
		const similarityReferenceGameText = text.slice(similarityReferenceGameIndex + similarityReferenceGameMarker.length, similarityComparisonScopeIndex).trim();
		const similarityComparisonScopeText = text.slice(similarityComparisonScopeIndex + similarityComparisonScopeMarker.length).trim();

		let parsedConditions;
		try {
			parsedConditions = JSON.parse(conditionsText);
		} catch (err) {
			GDV.utils.reportSoftWarning("Invalid Prefilter Conditions JSON", "Failed to parse the Prefilter Conditions JSON from clipboard.", err);
			return;
		}

		const parsedAst = convertStringToAst(astText);
		if (astText && !parsedAst) {
			GDV.utils.reportSoftWarning("Invalid Expression Format", "Failed to parse the expression from clipboard.");
			return;
		}
		if (!GDV.prefilter.arePrefiltersCorrect(parsedConditions, parsedAst)) {
			return;
		}

		let parsedColumnsToDisplay;
		try {
			parsedColumnsToDisplay = JSON.parse(columnsToDisplayText);
		} catch (err) {
			GDV.utils.reportSoftWarning("Invalid Columns To Display JSON", "Failed to parse the Columns To Display JSON from clipboard.", err);
			return;
		}

		let parsedTableSortColumn;
		try {
			parsedTableSortColumn = JSON.parse(tableSortColumnText);
		} catch (err) {
			GDV.utils.reportSoftWarning("Invalid Table Sort Column JSON", "Failed to parse the Table Sort Column JSON from clipboard.", err);
			return;
		}

		let parsedTableSortDirection;
		try {
			parsedTableSortDirection = JSON.parse(tableSortDirectionText);
		} catch (err) {
			GDV.utils.reportSoftWarning("Invalid Table Sort Direction JSON", "Failed to parse the Table Sort Direction JSON from clipboard.", err);
			return;
		}

		let parsedSimilarityReferenceGame;
		try {
			parsedSimilarityReferenceGame = JSON.parse(similarityReferenceGameText);
		} catch (err) {
			GDV.utils.reportSoftWarning("Invalid Similarity Reference Game JSON", "Failed to parse the Similarity Reference Game JSON from clipboard.", err);
			return;
		}

		let parsedSimilarityComparisonScope;
		try {
			parsedSimilarityComparisonScope = JSON.parse(similarityComparisonScopeText);
		} catch (err) {
			GDV.utils.reportSoftWarning("Invalid Similarity Comparison Scope JSON", "Failed to parse the Similarity Comparison Scope JSON from clipboard.", err);
			return;
		}

		prefilterAst = normalizeNode(parsedAst);
		prefilterAstCurrentNode = prefilterAst;
		prefilterConditions = parsedConditions;
		columnsToDisplay = parsedColumnsToDisplay;
		columnsToDisplaySet = new Set(columnsToDisplay);
		tableSortColumn = parsedTableSortColumn;
		tableSortDirection = parsedTableSortDirection;
		similarityReferenceGame = parsedSimilarityReferenceGame;
		similarityComparisonScope = parsedSimilarityComparisonScope;
	}

	GDV.prefilter.getTableSortParameters = () => {
		if (!tableSortColumn && !tableSortDirection) {
			return null;
		}
		return { tableSortColumn, tableSortDirection };
	};

	GDV.prefilter.setTableSortParameters = (tableSortColumn_, tableSortDirection_) => {
		tableSortColumn = tableSortColumn_;
		tableSortDirection = tableSortDirection_;
	};

	GDV.prefilter.resetTableSortParameters = () => {
		tableSortColumn = null;
		tableSortDirection = null;
	};

	GDV.prefilter.getTableSortColumn = () => tableSortColumn;

	GDV.prefilter.setTableSortColumn = (tableSortColumn_) => {
		tableSortColumn = tableSortColumn_ || null;
	};

	GDV.prefilter.resetTableSortColumn = () => {
		tableSortColumn = null;
	};

	GDV.prefilter.getTableSortDirection = () => tableSortDirection;

	GDV.prefilter.setTableSortDirection = (tableSortDirection_) => {
		tableSortDirection = tableSortDirection_ || null;
	};

	GDV.prefilter.resetTableSortDirection = () => {
		tableSortDirection = null;
	};

	GDV.prefilter.getSimilarityCriteria = () => {
		if (!similarityReferenceGame && !similarityComparisonScope) {
			return null;
		}
		return { referenceGame: similarityReferenceGame, comparisonScope: similarityComparisonScope };
	};

	GDV.prefilter.setSimilarityCriteria = (similarityReferenceGame_, similarityComparisonScope_) => {
		similarityReferenceGame = similarityReferenceGame_;
		similarityComparisonScope = similarityComparisonScope_;
	};

	GDV.prefilter.resetSimilarityCriteria = () => {
		similarityReferenceGame = null;
		similarityComparisonScope = null;
	};

	GDV.prefilter.getSimilarityReferenceGame = () => similarityReferenceGame;

	GDV.prefilter.setSimilarityReferenceGame = (similarityReferenceGame_) => {
		similarityReferenceGame = similarityReferenceGame_ || null;
	};

	GDV.prefilter.resetSimilarityReferenceGame = () => {
		similarityReferenceGame = null;
	};

	GDV.prefilter.getSimilarityComparisonScope = () => similarityComparisonScope;

	GDV.prefilter.setSimilarityComparisonScope = (similarityComparisonScope_) => {
		similarityComparisonScope = similarityComparisonScope_ || null;
	};

	GDV.prefilter.resetSimilarityComparisonScope = () => {
		similarityComparisonScope = null;
	};

	GDV.prefilter.getSearchParameters = () => {
		return { prefilterConditions, prefilterAst, columnsToDisplay, tableSortColumn, tableSortDirection, similarityReferenceGame, similarityComparisonScope };
	};

})();
