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

	GDV.prefilter.setPrefilterAstCurrentNode = (prefilterAstCurrentNode_) => {
		prefilterAstCurrentNode = prefilterAstCurrentNode_;
	};

	GDV.prefilter.resetPrefilterConditionsAndAst = () => {
		prefilterConditions = {};
		prefilterAst = null;
		prefilterAstCurrentNode = null;
	};

	GDV.prefilter.addToConditionAndAst = addToConditionAndAst;
	function addToConditionAndAst(col, condition) {
		prefilterConditions[col] = condition;
		addToPrefilterAst(col);
	}

	GDV.prefilter.removeFromConditionAndAst = removeFromConditionAndAst;
	function removeFromConditionAndAst(col) {
		delete prefilterConditions[col];
		removeNodeWithColumnInAst(col);
	}

	GDV.prefilter.removeFromConditionAndUi = removeFromConditionAndUi;
	function removeFromConditionAndUi(col) {
		delete prefilterConditions[col];
		GDV.prefilter.clearActiveItemParameters(col);
	}

	GDV.prefilter.removeNodeWithColumnInAst = removeNodeWithColumnInAst;
	function removeNodeWithColumnInAst(col) {
		if (!prefilterAst) return;
		const path = [];
		prefilterAst = removeNodeWithColumnInsideAst(prefilterAst, col, path);
		prefilterAstCurrentNode = path.length ? path[path.length - 1] : prefilterAst;
	}

	GDV.prefilter.removeNodeWithReferenceInAstConditionsAndUi = removeNodeWithReferenceInAstConditionsAndUi;
	function removeNodeWithReferenceInAstConditionsAndUi(targetNode) {
		if (!prefilterAst) return;
		const path = [];
		prefilterAst = removeNodeWithReferenceInsideAst(prefilterAst, targetNode, path);
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

	function addToPrefilterAst(col) {
		if (!prefilterAst) {
			prefilterAst = { ast_type: "VALUE", column: col };
			prefilterAstCurrentNode = prefilterAst;
			return;
		}
		if (astHasColumn(prefilterAst, col)) return;
		const newNode = { ast_type: "VALUE", column: col };
		switch (prefilterAstCurrentNode.ast_type) {
			case "VALUE":
			case "NOT": {
				const targetNode = prefilterAstCurrentNode;
				const wrapperNode = { ast_type: "AND", children: [targetNode, newNode] };
				replaceAstNode(prefilterAst, targetNode, wrapperNode);
				if (prefilterAst === targetNode) prefilterAst = wrapperNode;
				prefilterAstCurrentNode = wrapperNode;
				return;
			}
			case "AND":
			case "OR": {
				if (!prefilterAstCurrentNode.children) prefilterAstCurrentNode.children = [];
				prefilterAstCurrentNode.children.push(newNode);
				return;
			}
			default:
				GDV.utils.reportSoftError("Problem updating your filters", "The filter system received an unexpected internal structure while trying to update your active filters. Your changes may not have been fully applied visually.", null, { nodeType: prefilterAstCurrentNode.ast_type, node: prefilterAstCurrentNode, column: col });
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

	function removeNodeWithColumnInsideAst(node, col, path) {
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
					node.child = removeNodeWithColumnInsideAst(node.child, col, path);
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
					.map(child => removeNodeWithColumnInsideAst(child, col, path))
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

	function removeNodeWithReferenceInsideAst(node, targetNode, path) {
		if (!node) return null;
		path.push(node);
		switch (node.ast_type) {
			case "VALUE":
				if (node === targetNode) {
					removeAllConditionsInSubtree(node);
					path.pop();
					return null;
				}
				path.pop();
				return node;
			case "NOT":
				if (node === targetNode) {
					removeAllConditionsInSubtree(node);
					path.pop();
					return null;
				}
				if (node.child) node.child = removeNodeWithReferenceInsideAst(node.child, targetNode, path);
				if (!node.child) {
					path.pop();
					return null;
				}
				path.pop();
				return node;
			case "AND":
			case "OR":
				if (node === targetNode) {
					removeAllConditionsInSubtree(node);
					path.pop();
					return null;
				}
				if (!node.children) {
					path.pop();
					return node;
				}
				node.children = node.children.map(child => removeNodeWithReferenceInsideAst(child, targetNode, path)).filter(Boolean);
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

	function removeAllConditionsInSubtree(node) {
		if (!node) return;
		switch (node.ast_type) {
			case "VALUE":
				GDV.prefilter.removeFromConditionAndUi(node.column);
				return;
			case "NOT":
				removeAllConditionsInSubtree(node.child);
				return;
			case "AND":
			case "OR":
				if (!node.children) return;
				node.children.forEach(removeAllConditionsInSubtree);
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
		if (node.ast_type === "VALUE" || node.ast_type === "NOT") {
			return { ast_type: "AND", children: [node] };
		}
		if (node.ast_type === "OR") {
			node.ast_type = "AND";
			return node;
		}
		return node;
	}

	function convertNodeToOr(node) {
		if (!node) return node;
		if (node.ast_type === "OR") return node;
		if (node.ast_type === "VALUE" || node.ast_type === "NOT") {
			return { ast_type: "AND", children: [node] };
		}
		if (node.ast_type === "AND") {
			node.ast_type = "OR";
			return node;
		}
		return node;
	}

	function replaceAstNode(node, targetNode, replacementNode) {
		if (!node || !targetNode) return false;
		if (node === targetNode) return false;
		if (node.ast_type === "NOT") {
			if (node.child === targetNode) {
				node.child = replacementNode;
				return true;
			}
			return replaceAstNode(node.child, targetNode, replacementNode);
		}
		if (node.ast_type === "AND" || node.ast_type === "OR") {
			if (!node.children) return false;
			for (let i = 0; i < node.children.length; i++) {
				if (node.children[i] === targetNode) {
					node.children[i] = replacementNode;
					return true;
				}
				if (replaceAstNode(node.children[i], targetNode, replacementNode)) return true;
			}
		}
		return false;
	}

	function applyOperationToNode(node, operationFunction) {
		if (!prefilterAst || !node || typeof operationFunction !== "function") return;
		const targetNode = node;
		const transformedNode = operationFunction(targetNode);
		if (!transformedNode) return;
		if (prefilterAst === targetNode) {
			prefilterAst = transformedNode;
			prefilterAstCurrentNode = transformedNode;
			return;
		}
		replaceAstNode(prefilterAst, targetNode, transformedNode);
		if (prefilterAstCurrentNode === targetNode) {
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

})();
