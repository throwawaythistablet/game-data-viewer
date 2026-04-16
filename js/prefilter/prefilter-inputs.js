(() => {
	let searchText = null;
	let prefilterConditions = {};
	let prefilterAst = null;
	let prefilterAstCurrentNode = null;
	let sortMode = "nearest";

	GDV.prefilter.getSearchText = () => searchText;

	GDV.prefilter.setSearchText = (searchText_) => {
		searchText = searchText_;
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

	GDV.prefilter.resetPrefilterConditionsAndAst = () => {
		prefilterConditions = {};
		prefilterAst = null;
		prefilterAstCurrentNode = null;
	};

	GDV.prefilter.setPrefilterAstCurrentNode = (prefilterAstCurrentNode_) => {
		prefilterAstCurrentNode = prefilterAstCurrentNode_;
	};

	GDV.prefilter.addToConditionAndAst = addToConditionAndAst;
	function addToConditionAndAst(col, condition) {
		prefilterConditions[col] = condition;
		addColumnToAst(col);
	}

	GDV.prefilter.removeFromConditionAndAst = removeFromConditionAndAst;
	function removeFromConditionAndAst(col) {
		delete prefilterConditions[col];
		removeColumnFromAst(col);
	}

	GDV.prefilter.removeFromConditionAndUi = removeFromConditionAndUi;
	function removeFromConditionAndUi(col) {
		delete prefilterConditions[col];
		GDV.prefilter.clearActiveItemParameters(col);
	}

	GDV.prefilter.removeColumnFromAst = removeColumnFromAst;
	function removeColumnFromAst(col) {
		if (!prefilterAst) return;
		const path = [];
		prefilterAst = removeNodeWithColumn(prefilterAst, col, path);
		prefilterAstCurrentNode = path.length ? path[path.length - 1] : prefilterAst;
	}

	GDV.prefilter.removeFromAstConditionsAndUi = removeFromAstConditionsAndUi;
	function removeFromAstConditionsAndUi(targetNode) {
		if (!prefilterAst) return;
		const path = [];
		prefilterAst = removeNodeFromAstConditionsAndUi(prefilterAst, targetNode, path);
		prefilterAstCurrentNode = path.length ? path[path.length - 1] : prefilterAst;
	}

	GDV.prefilter.updateActiveItemParametersInConditionAndAst = updateActiveItemParametersInConditionAndAst;
	function updateActiveItemParametersInConditionAndAst(form, col) {
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
			removeFromConditionAndAst(col);
		}
	}

	GDV.prefilter.applyPrefilterConditionsToForm = applyPrefilterConditionsToForm;
	function applyPrefilterConditionsToForm(form) {
		if (!form) return;
		for (const col in prefilterConditions) {
			const prefilterCondition = prefilterConditions[col];
			applyPrefilterConditionToField(form, col, prefilterCondition);
		}
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
		prefilterAstCurrentNode = prefilterAstCurrentNode.children[0]
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

	GDV.prefilter.copyPrefiltersToClipboard = copyPrefiltersToClipboard;
	function copyPrefiltersToClipboard() {
		normalizePrefilterAst();
		navigator.clipboard.writeText(serializePrefilters());
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

	function updateNumericPrefilter(form, col, def) {
		const [minEl] = getFormElementsByName(form, `${col}__min`);
		const [maxEl] = getFormElementsByName(form, `${col}__max`);
		if (!minEl && !maxEl) {
			removeFromConditionAndAst(col);
			return;
		}
		let min = minEl?.value === "" ? null : Number(minEl.value);
		let max = maxEl?.value === "" ? null : Number(maxEl.value);
		if (def.type === "int") {
			if (min != null) min = Math.round(min);
			if (max != null) max = Math.round(max);
		}
		if (min == null && max == null) {
			removeFromConditionAndAst(col);
		} else {
			addToConditionAndAst(col, { type: def.type, min, max });
		}
	}

	function updateCheckboxPrefilter(form, col, def) {
		const checkboxes = getFormElementsByName(form, col).filter((e) => e.type === "checkbox");
		const checked = checkboxes.filter((c) => c.checked).map((c) => c.value);

		if (checked.length === 0 || checked.length === checkboxes.length) {
			removeFromConditionAndAst(col);
		} else {
			const converted = checked.map((v) => convertCheckboxValue(v, def.type));
			addToConditionAndAst(col, { type: def.type, choices: converted });
		}
	}

	function updateTextPrefilter(form, col) {
		const textInputs = getFormElementsByName(form, col).filter((e) => e.tagName.toLowerCase() === "input" || e.tagName.toLowerCase() === "textarea");
		if (!textInputs.length) return;

		const val = textInputs[0].value?.trim();
		if (!val) {
			removeFromConditionAndAst(col);
		}
		else {
			addToConditionAndAst(col, { text: [val] });
		}
	}

	function getFormElementsByName(form, name) {
		const elements = form.elements?.[name];
		if (!elements) return [];
		if (elements instanceof RadioNodeList) {
			return Array.from(elements);
		}
		return [elements];
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

	function applyPrefilterConditionToField(form, col, condition) {
		if (condition == null) return;
		if (condition.min != null || condition.max != null) {
			applyNumericToForm(form, col, condition);
			return;
		}
		if (condition.choices) {
			applyCheckboxToForm(form, col, condition);
			return;
		}
		if (condition.text) {
			applyTextToForm(form, col, condition);
			return;
		}
	}

	function applyNumericToForm(form, col, condition) {
		const [minEl] = getFormElementsByName(form, `${col}__min`);
		const [maxEl] = getFormElementsByName(form, `${col}__max`);
		if (minEl) minEl.value = condition.min ?? "";
		if (maxEl) maxEl.value = condition.max ?? "";
	}

	function applyCheckboxToForm(form, col, condition) {
		const checkboxes = getFormElementsByName(form, col).filter(e => e.type === "checkbox");
		if (!checkboxes.length) return;
		const selected = new Set(condition.choices || []);
		for (const cb of checkboxes) {
			cb.checked = selected.has(convertCheckboxValue(cb.value, condition.type));
		}
	}

	function applyTextToForm(form, col, condition) {
		const inputs = getFormElementsByName(form, col)
			.filter(e =>
				e.tagName.toLowerCase() === "input" ||
				e.tagName.toLowerCase() === "textarea"
			);
		if (!inputs.length) return;
		inputs[0].value = condition.text?.[0] ?? "";
	}

	function createDefaultPrefilterAst() {
		const cols = Object.keys(prefilterConditions || {});
		if (cols.length === 0) return null;
		if (cols.length === 1) {
			return {
				ast_type: "VALUE",
				column: cols[0]
			};
		}
		return {
			ast_type: "AND",
			children: cols.map(col => ({
				ast_type: "VALUE",
				column: col
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

	function astHasColumn(node, col) {
		if (!node) return false;
		if (node.ast_type === "VALUE") return node.column === col;
		if (node.ast_type === "NOT") return astHasColumn(node.child, col);
		if (node.ast_type === "AND" || node.ast_type === "OR") return node.children.some(child => astHasColumn(child, col));
		return false;
	}

	function removeNodeWithColumn(node, col, path) {
		if (!node) return null;
		path.push(node);
		switch (node.ast_type) {
			case "VALUE":
				if (node.column === col) {
					path.pop();
					return null;
				}
				path.pop();
				return node;
			case "NOT":
				if (node.child) {
					node.child = removeNodeWithColumn(node.child, col, path);
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
					.map(child => removeNodeWithColumn(child, col, path))
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
				GDV.utils.reportSoftError("Problem removing a filter", "The system encountered an unexpected filter structure while trying to remove a selected filter. Some filters may still appear until refreshed.", null, { nodeType: node.ast_type, node, column: col });
				path.pop();
				return node;
		}
	}

	function removeNodeFromAstConditionsAndUi(node, targetNode, path) {
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
				if (node.child) node.child = removeNodeFromAstConditionsAndUi(node.child, targetNode, path);
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
				node.children = node.children.map(child => removeNodeFromAstConditionsAndUi(child, targetNode, path)).filter(Boolean);
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
				GDV.prefilter.removeFromConditionAndUi(node.column);
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
			return { ast_type: "AND", children: [node] };
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

	function validatePrefilterConditions(conditions, colDefs) {
		if (!conditions || typeof conditions !== "object") {
			return ["Invalid conditions object"];
		}
		const warnings = [];
		for (const col in conditions) {
			if (!colDefs[col]) {
				warnings.push(`Condition name is not recognized: "${col}"`);
			}
		}
		return warnings;
	}

	function validatePrefilterAst(ast, colDefs) {
		const warnings = [];
		function walk(node) {
			if (!node) return;
			if (node.ast_type === "VALUE") {
				if (!colDefs[node.column]) {
					warnings.push(`Name in expression is not recognized: ${node.column}`);
				}
				return;
			}
			if (node.ast_type === "NOT") {
				walk(node.child);
				return;
			}
			if (node.ast_type === "AND" || node.ast_type === "OR") {
				node.children?.forEach(walk);
			}
		}
		walk(ast);
		return warnings;
	}

	function serializePrefilters() {
		const astText = convertAstNodeToString(prefilterAst);
		const conditionsText = JSON.stringify(prefilterConditions, null, 2);
		return `---EXPRESSION---\n${astText}\n\n---CONDITIONS---\n${conditionsText}`;
	}

	async function deserializePrefilters(text) {
		if (!text || typeof text !== "string") return;
		const astMarker = "---EXPRESSION---";
		const conditionsMarker = "---CONDITIONS---";
		const astIndex = text.indexOf(astMarker);
		const conditionsIndex = text.indexOf(conditionsMarker);
		if (astIndex === -1 || conditionsIndex === -1) {
			GDV.utils.reportSoftWarning("Invalid clipboard format", "Clipboard is missing EXPRESSION or CONDITIONS sections.");
			return;
		}
		const astText = text.slice(astIndex + astMarker.length, conditionsIndex).trim();
		const conditionsText = text.slice(conditionsIndex + conditionsMarker.length).trim();
		let parsedConditions;
		try {
			parsedConditions = JSON.parse(conditionsText);
		} catch (err) {
			GDV.utils.reportSoftWarning("Invalid CONDITIONS JSON", "Could not parse filter conditions from clipboard.", err);
			return;
		}
		const parsedAst = convertStringToAst(astText);
		if (!parsedAst) {
			GDV.utils.reportSoftWarning("Invalid EXPRESSION format", "Could not parse expression from clipboard.");
			return;
		}
		const colDefs = GDV.state.getActiveColumnDetails() || {};
		const conditionWarnings = validatePrefilterConditions(parsedConditions, colDefs);
		const astWarnings = validatePrefilterAst(parsedAst, colDefs);
		if (conditionWarnings.length || astWarnings.length) {
			for (const w of conditionWarnings) {
				GDV.utils.reportSoftWarning("Invalid prefilter condition found", w);
			}
			for (const w of astWarnings) {
				GDV.utils.reportSoftWarning("Invalid prefilter expression found", w);
			}
			return;
		}
		prefilterAst = normalizeNode(parsedAst);
		prefilterAstCurrentNode = prefilterAst;
		prefilterConditions = parsedConditions;
	}

})();
