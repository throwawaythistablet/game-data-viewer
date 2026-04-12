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
			removeFromConditionAndAst(col);
		}
	}

	GDV.prefilter.updatePrefilterActiveItems = updatePrefilterActiveItems;
	function updatePrefilterActiveItems(form) {
		const summary = form.querySelector("#prefilter-active-items");
		if (!summary) return;
		if (!prefilterAst) {
			summary.replaceChildren();
			return;
		}
		const astNodeElement = renderPrefilterAstNode(prefilterAst);
		summary.replaceChildren(astNodeElement || document.createTextNode(""));
	}

	function renderPrefilterAstNode(node) {
		if (!node) return null;
		switch (node.ast_type) {
			case "VALUE":
				return createPrefilterActiveItem(node.column);
			case "NOT": {
				const container = document.createElement("span");
				container.className = "prefilter-ast-group";
				container.appendChild(createOperator("NOT"));
				const child = renderPrefilterAstNode(node.child);
				if (child) container.appendChild(child);
				return container;
			}
			case "AND":
			case "OR": {
				const container = document.createElement("span");
				container.className = "prefilter-ast-group";
				node.children.forEach((child, i) => {
					if (i > 0) container.appendChild(createOperator(node.ast_type));
					const childEl = renderPrefilterAstNode(child);
					if (childEl) container.appendChild(childEl);
				});
				return container;
			}
			default:
				GDV.utils.reportSoftError("Something went wrong while displaying your filters", "The filter display system encountered an unexpected data format and could not render part of your selected filters. This does not affect your data, only how it is shown.", null, { nodeType: node.ast_type, node });
				return null;
		}
	}

	function createOperator(type) {
		const el = document.createElement("span");
		el.className = "prefilter-ast-operator";
		el.textContent = type;
		return el;
	}

	function createPrefilterActiveItem(col) {
		const val = prefilterConditions[col];
		if (!val) return null;

		const activeItem = document.createElement("span");
		activeItem.className = "prefilter-active-item";
		activeItem.dataset.col = col;
		const text = GDV.prefilter.getPrefilterDisplayText(col, val) || "";
		activeItem.textContent = `${text} `;
		activeItem.title = GDV.datatable.getColumnDescription(col) || "";
		activeItem.dataset.type = GDV.prefilter.getPrefilterDisplayType(val) || "";
		activeItem.appendChild(GDV.prefilter.renderRemoveButton(col));

		return activeItem;
	}

	GDV.prefilter.updatePrefilterWarning = updatePrefilterWarning;
	function updatePrefilterWarning() {
		if (!isPrefilterOpen()) return;

		const hasFilters = Object.keys(prefilterConditions).length > 0;
		if (hasFilters) {
			GDV.prefilter.hidePrefilterWarning();
		} else {
			GDV.prefilter.showPrefilterWarning();
		}
	}

	function updateAllBasedFromFormColumnChanges(form, col) {
		updateLivePrefilterForColumn(form, col);
		updatePrefilterWarning();
		updatePrefilterActiveItems(form, col);
	}

	function isPrefilterOpen() {
		return !!document.getElementById("prefilterOverlay");
	}

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

	function addToConditionAndAst(col, condition) {
		prefilterConditions[col] = condition;
		addToPrefilterAst(col);
	}

	function removeFromConditionAndAst(col) {
		delete prefilterConditions[col];
		removeFromPrefilterAst(col);
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
			case "VALUE": {
				const oldNode = { ast_type: "VALUE", column: prefilterAstCurrentNode.column };
				prefilterAstCurrentNode.ast_type = "AND";
				prefilterAstCurrentNode.children = [oldNode, newNode];
				delete prefilterAstCurrentNode.column;
				return;
			}
			case "NOT": {
				const oldNode = { ast_type: "NOT", child: prefilterAstCurrentNode.child };
				prefilterAstCurrentNode.ast_type = "AND";
				prefilterAstCurrentNode.children = [oldNode, newNode];
				delete prefilterAstCurrentNode.child;
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
		if (node.ast_type === "AND") return node.children.some(child => astHasColumn(child, col));
		return false;
	}

	function removeFromPrefilterAst(col) {
		if (!prefilterAst) return;

		const path = [];
		prefilterAst = removeFromNode(prefilterAst, col, path);

		prefilterAstCurrentNode = path.length
			? path[path.length - 1]
			: prefilterAst;
	}

	function removeFromNode(node, col, path) {
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
					node.child = removeFromNode(node.child, col, path);
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
					.map(child => removeFromNode(child, col, path))
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
})();
