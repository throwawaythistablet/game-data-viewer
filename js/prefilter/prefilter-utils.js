(() => {
	const BEST_NAME_SIMILARITY_LIMIT = 0.8;

	GDV.prefilter.createPrefilterAstFromConditions = (prefilterConditions) => {
		if (!prefilterConditions || typeof prefilterConditions !== "object") {
			return null;
		}
		const columns = Object.keys(prefilterConditions);
		if (columns.length === 0) {
			return null;
		}
		if (columns.length === 1) {
			return {
				ast_type: "VALUE",
				column: columns[0]
			};
		}
		return {
			ast_type: "AND",
			children: columns.map((column) => ({
				ast_type: "VALUE",
				column: column
			}))
		};
	};

	GDV.prefilter.normalizePrefilterColumnNames = (conditions_, ast_, columnsToDisplay_) => {
		const columnDetails = GDV.state.getColumnDetails() || {};
		const astColumnNamesSet = GDV.prefilter.collectColumnsSetFromAst(ast_);
		const conditionColumnNamesSet = new Set(Object.keys(conditions_ || {}));
		const columnsToDisplayNamesSet = new Set(columnsToDisplay_ || []);
		const allColumnNames = [...new Set([...astColumnNamesSet, ...conditionColumnNamesSet, ...columnsToDisplayNamesSet])];
		const mapping = mapColumnNamesToColumnDetailsNames(allColumnNames, columnDetails);
		normalizePrefilterColumnNamesInConditions(conditions_, mapping);
		normalizePrefilterColumnNamesInAst(ast_, mapping);
		normalizePrefilterColumnNamesInColumnsToDisplay(columnsToDisplay_, mapping);
	};

	GDV.prefilter.arePrefiltersCorrect = (conditions, ast) => {
		const columnDetails = GDV.state.getColumnDetails() || {};
		const conditionWarnings = validatePrefilterConditions(conditions, columnDetails);
		const astWarnings = validatePrefilterAst(ast, columnDetails);
		const consistencyWarnings = validatePrefilterConsistency(conditions, ast);
		if (conditionWarnings.length || astWarnings.length || consistencyWarnings.length) {
			for (const w of conditionWarnings) {
				GDV.utils.reportSoftWarning("Invalid prefilter condition found", w);
			}
			for (const w of astWarnings) {
				GDV.utils.reportSoftWarning("Invalid prefilter expression found", w);
			}
			for (const w of consistencyWarnings) {
				GDV.utils.reportSoftWarning("Prefilter mismatch detected", w);
			}
			return false;
		}
		return true;
	};

	GDV.prefilter.removeRedundantColumnsToDisplay = (columnsToDisplay, prefilterConditions) => {
		if (!columnsToDisplay || (Array.isArray(columnsToDisplay) && columnsToDisplay.length === 0)) {
			return null;
		}
		const prefilterColumns = Object.keys(prefilterConditions || {});
		let columnsToDisplayIndex = columnsToDisplay.length - 1;
		let prefilterColumnsIndex = prefilterColumns.length - 1;

		while (
			columnsToDisplayIndex >= 0 &&
			prefilterColumnsIndex >= 0 &&
			columnsToDisplay[columnsToDisplayIndex] === prefilterColumns[prefilterColumnsIndex]
		) {
			columnsToDisplayIndex--;
			prefilterColumnsIndex--;
		}

		const remainingColumns = columnsToDisplay.slice(0, columnsToDisplayIndex + 1);
		return remainingColumns.length > 0 ? remainingColumns : null;
	};

	GDV.prefilter.completeColumnsToDisplay = (columnsToDisplay, prefilterConditions) => {
		const completedColumnsToDisplay = Array.isArray(columnsToDisplay) ? [...columnsToDisplay] : [];
		const columnsToDisplaySet = new Set(completedColumnsToDisplay);
		for (const column of Object.keys(prefilterConditions || {})) {
			if (!columnsToDisplaySet.has(column)) {
				completedColumnsToDisplay.push(column);
				columnsToDisplaySet.add(column);
			}
		}
		return completedColumnsToDisplay;
	};

	GDV.prefilter.cleanSimilarityCriteria = (similarityCriteria) => {
		if (!similarityCriteria) return null;
		if (!similarityCriteria.referenceGame) {
			delete similarityCriteria.referenceGame;
		}
		if (!similarityCriteria.comparisonScope || similarityCriteria.comparisonScope === "All Categories") {
			delete similarityCriteria.comparisonScope;
		}
		if (Object.keys(similarityCriteria).length === 0) {
			return null;
		}
		return similarityCriteria;
	};

	GDV.prefilter.getPrefilterDisplayText = (column, value) => {
		if (!value) return "";
		if (value.type === "tag" || Array.isArray(value.choices)) {
			return `${column}: ${value.choices?.join(", ") || value.text?.join(", ")}`;
		} else if (value.type === "int" || value.type === "float") {
			const minMax = [];
			if (value.min != null) minMax.push(`min=${value.min}`);
			if (value.max != null) minMax.push(`max=${value.max}`);
			return `${column}: ${minMax.join(", ")}`;
		} else if (value.text) {
			return `${column}: ${value.text.join(", ")}`;
		}
		return "";
	};

	GDV.prefilter.getPrefilterDisplayType = (value) => {
		if (!value) return "";
		if (value.type === "tag" || Array.isArray(value.choices)) return "checkbox";
		if (value.type === "int" || value.type === "float") return "range";
		if (value.text) return "text";
		return "";
	};

	function mapColumnNamesToColumnDetailsNames(columnNames, columnDetails) {
		const columnDetailsKeys = Object.keys(columnDetails || {});
		const columnDetailsKeySet = new Set(columnDetailsKeys);
		const mapping = new Map();
		for (const columnName of columnNames) {
			if (columnDetailsKeySet.has(columnName)) {
				mapping.set(columnName, columnName);
				continue;
			}
			let searchName = columnName.replace(/^author: /, "assigned: ");
			if (!/^[\w\s]*\w+:/.test(searchName)) {
				searchName = `text search: ${searchName}`;
			}
			const bestName = GDV.utils.findBestStringMatch(searchName, columnDetailsKeys);
			if (bestName === null) continue;
			mapping.set(columnName, bestName);

			const similarity = GDV.utils.getStringSimilarity(searchName, bestName);
			if (similarity < BEST_NAME_SIMILARITY_LIMIT) {
				GDV.utils.reportSoftWarning("Prefilter column may be incorrect", `"${searchName}" was matched to "${bestName}" with only ${(similarity * 100).toFixed(1)}% similarity. The imported filter may not match the intended column.`);
			}
		}
		return mapping;
	}

	function normalizePrefilterColumnNamesInConditions(conditions, mapping) {
		// Nothing to update when the conditions object is missing.
		if (!conditions) {
			return;
		}
		// Update condition keys while preserving their values.
		const updatedConditions = {};
		for (const [oldColumn, value] of Object.entries(conditions)) {
			const newColumn = mapping.get(oldColumn) || oldColumn;
			updatedConditions[newColumn] = value;
		}
		// Replace the contents of the original conditions object.
		for (const key of Object.keys(conditions)) {
			delete conditions[key];
		}
		Object.assign(conditions, updatedConditions);
	}

	function normalizePrefilterColumnNamesInAst(ast, mapping) {
		function traverse(node) {
			if (!node) return;
			switch (node.ast_type) {
				case "VALUE":
					if (node.column != null) {
						node.column = mapping.get(node.column) || node.column;
					}
					return;
				case "NOT":
					traverse(node.child);
					return;
				case "AND":
				case "OR":
					if (!node.children) return;

					for (const child of node.children) {
						traverse(child);
					}
					return;

				default:
					return;
			}
		}
		traverse(ast);
	}

	function normalizePrefilterColumnNamesInColumnsToDisplay(columnsToDisplay, mapping) {
		if (!columnsToDisplay) {
			return;
		}
		for (let i = 0; i < columnsToDisplay.length; i++) {
			columnsToDisplay[i] = mapping.get(columnsToDisplay[i]) || columnsToDisplay[i];
		}
	}

	function validatePrefilterConditions(conditions, columnDetails) {
		if (conditions === null) {
			return [];
		}
		if (!conditions || typeof conditions !== "object") {
			return ["Invalid conditions object"];
		}
		const warnings = [];
		for (const column in conditions) {
			if (!columnDetails[column]) {
				warnings.push(`Condition name is not recognized: "${column}"`);
			}
		}
		return warnings;
	}

	function validatePrefilterAst(ast, columnDetails) {
		const warnings = [];
		function walk(node) {
			if (!node) return;
			if (node.ast_type === "VALUE") {
				if (!columnDetails[node.column]) {
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

	function validatePrefilterConsistency(conditions, ast) {
		const warnings = [];
		const astColumnsSet = GDV.prefilter.collectColumnsSetFromAst(ast);
		const conditionColumnsSet = new Set(Object.keys(conditions || {}));

		for (const column of astColumnsSet) {
			if (!conditionColumnsSet.has(column)) {
				warnings.push(`Expression references "${column}" but no condition exists for it`);
			}
		}
		for (const column of conditionColumnsSet) {
			if (!astColumnsSet.has(column)) {
				warnings.push(`Condition "${column}" exists but is not used in the expression`);
			}
		}
		return warnings;
	}


})();
