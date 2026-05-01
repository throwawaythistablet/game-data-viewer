(() => {
	GDV.urlParameters.getDataFromUrlParameters = getDataFromUrlParameters;
	function getDataFromUrlParameters() {
		const params = parseQueryString();
		return {
			prefilterConditions: extractPrefilterConditions(params),
			prefilterAst: extractPrefilterAst(params),
			similarityGame: extractSimilarityGame(params),
		};
	}

	GDV.urlParameters.encodeDataAsUrlParameters = encodeDataAsUrlParameters;
	function encodeDataAsUrlParameters(prefilterConditions, prefilterAst, similarityGame) {
		const parts = [];
		const pfPart = encodePrefilterConditions(prefilterConditions);
		if (pfPart) {
			parts.push(pfPart);
		}
		const astPart = encodePrefilterAst(prefilterAst);
		if (astPart) {
			parts.push(astPart);
		}
		const sgPart = encodeSimilarityGame(similarityGame);
		if (sgPart) {
			parts.push(sgPart);
		}

		return parts.join("&");
	}

	GDV.urlParameters.extractPrefilterConditions = extractPrefilterConditions;
	function extractPrefilterConditions(params) {
		let pfObj = null;
		if (params.pf) {
			pfObj = decodeBase64UrlJson(params.pf);
			if (!pfObj) {
				GDV.utils.reportSoftWarning("Invalid URL Prefilter Conditions Parameter", "The URL contained an invalid 'pf' parameter and it will be ignored.");
			}
		}
		const humanPrefilterConditions = parseHumanReadable(params);
		pfObj = mergePrefilterConditions(pfObj, humanPrefilterConditions);
		const adjustedPrefilterConditions = adjustPrefilterNamesIfNeeded(pfObj);
		if (adjustedPrefilterConditions && !validatePrefilterConditions(adjustedPrefilterConditions)) {
			GDV.utils.reportSoftWarning("Prefilter Validation Failed", "The prefilters extracted from the URL did not pass validation and will be ignored.");
			return null;
		}
		return adjustedPrefilterConditions || null;
	}

	function extractPrefilterAst(params) {
		let astObj = null;
		if (params.ast) {
			astObj = decodeBase64UrlJson(params.ast);
			if (astObj === null) {
				GDV.utils.reportSoftWarning("Invalid URL Prefilter Expression Parameter", "The URL contained an invalid 'ast' parameter and it will be ignored.");
			}
		}
		return astObj;
	}

	function extractSimilarityGame(params) {
		let sgObj = null;
		if (params.sg) {
			sgObj = decodeBase64UrlJson(params.sg);
			if (sgObj === null) {
				GDV.utils.reportSoftWarning("Invalid URL Similarity Game Parameter", "The URL contained an invalid 'sg' parameter and it will be ignored.");
			}
		}
		return normalizeSimilarityGame(sgObj);
	}

	function encodePrefilterConditions(prefilterConditions) {
		if (!prefilterConditions || typeof prefilterConditions !== "object" || Object.keys(prefilterConditions).length === 0) {
			return null;
		}
		const encoded = encodeJsonToBase64Url(prefilterConditions);
		if (!encoded) return null;
		return `pf=${encoded}`;
	}

	function encodePrefilterAst(prefilterAst) {
		if (!prefilterAst || typeof prefilterAst !== "object" || Object.keys(prefilterAst).length === 0) {
			return null;
		}
		const encoded = encodeJsonToBase64Url(prefilterAst);
		if (!encoded) return null;
		return `ast=${encoded}`;
	}

	function encodeSimilarityGame(similarityGame) {
		const normalized = normalizeSimilarityGame(similarityGame);
		if (!normalized) return null;
		const encoded = encodeJsonToBase64Url(normalized);
		if (!encoded) return null;
		return `sg=${encoded}`;
	}

	function parseQueryString() {
		const params = {};
		const windowSearch = window.location.search.substring(1);
		if (!windowSearch) return params;
		windowSearch.split("&").forEach((pair) => {
			const [rawKey, ...rest] = pair.split("=");
			const key = decodeURIComponent(rawKey);
			const value = decodeURIComponent(rest.join("="));
			if (key) {
				params[key] = value || "";
			}
		});
		return params;
	}

	function decodeBase64UrlJson(str) {
		try {
			str = str.replace(/-/g, "+").replace(/_/g, "/");
			while (str.length % 4) str += "=";
			const binary = atob(str);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) {
				bytes[i] = binary.charCodeAt(i);
			}
			const decodedStr = new TextDecoder().decode(bytes);
			const obj = JSON.parse(decodedStr);
			return obj;
		} catch (e) {
			GDV.utils.reportSoftWarning("URL Parameter Decoding Failed", "An error occurred while decoding base64url JSON prefilters from the URL.", e);
			return null;
		}
	}

	function encodeJsonToBase64Url(value) {
		try {
			const jsonStr = JSON.stringify(value);
			const utf8Bytes = new TextEncoder().encode(jsonStr);
			const b64 = btoa(String.fromCharCode(...utf8Bytes));
			return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
		} catch (e) {
			GDV.utils.reportSoftWarning("URL Parameter Encoding Failed", "An error occurred while encoding data for URL parameters.", e);
			return null;
		}
	}

	function parseHumanReadable(params) {
		const prefilterConditions = {};

		Object.keys(params).forEach((key) => {
			if (!key.startsWith("pf_")) return;
			const colName = key.substring(3); // remove pf_
			const val = params[key];

			const colDef = GDV.state.getActiveColumnDetails()[colName];
			if (!colDef) {
				GDV.utils.reportSoftWarning("Unknown Column in URL Prefilters", `The column '${colName}' in the URL prefilters is unknown and will be ignored.`);
				return;
			}

			switch (colDef.type) {
				case "float":
				case "int": {
					// Range parsing: "min-max" or "-max" or "min-"
					const [minStr, maxStr] = val.split("-");
					const min = minStr !== "" ? parseFloat(minStr) : null;
					const max = maxStr !== "" ? parseFloat(maxStr) : null;

					// Ensure min <= max if both exist
					if (min !== null && max !== null && min > max) {
						GDV.utils.reportSoftWarning("Prefilter Range Correction", `For column '${colName}', min value was greater than max. Values have been swapped.`);
						prefilterConditions[colName] = { type: colDef.type, min: max, max: min };
					} else {
						prefilterConditions[colName] = { type: colDef.type, min, max };
					}
					break;
				}

				case "str": {
					// Comma-separated choices
					const choices = val.split(",").map((s) => s.trim()).filter(Boolean);

					// Optional: validate against allowed choices
					const validChoices = colDef.choices.length ? choices.filter((c) => colDef.choices.includes(c)) : choices;
					prefilterConditions[colName] = { type: "str", choices: validChoices };
					break;
				}

				case "tag": {
					// Numeric tag values
					const tags = val.split(",").map(Number).filter((n) => !Number.isNaN(n));

					// Optional: validate against min/max
					const validTags = tags.filter((n) => n >= colDef.min && n <= colDef.max);
					prefilterConditions[colName] = { type: "tag", choices: validTags };
					break;
				}

				case "bool": {
					// Accept "true"/"1" as true, "false"/"0" as false
					const boolVals = val
						.split(",")
						.map((v) => {
							v = v.toLowerCase();
							return v === "true" || v === "1" ? true : v === "false" || v === "0" ? false : null;
						})
						.filter((v) => v !== null);

					prefilterConditions[colName] = { type: "bool", choices: boolVals };
					break;
				}

				default: {
					// Treat as free text (multiple tokens allowed)
					const tokens = val
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean);
					if (tokens.length) prefilterConditions[colName] = { text: tokens };
					break;
				}
			}
		});

		return prefilterConditions;
	}

	function mergePrefilterConditions(base, override) {
		if (!base) return override || {};
		if (!override) return base;
		return { ...base, ...override };
	}

	function adjustPrefilterNamesIfNeeded(inputPrefilters) {
		const activeCols = GDV.state.getActiveColumnDetails() || {};
		const validPrefilters = {};

		for (const [col, criterion] of Object.entries(inputPrefilters)) {
			if (activeCols[col]) {
				// Column exists, include as-is
				validPrefilters[col] = criterion;
			} else {
				// Try "text search: " prefix
				const textSearchCol = `text search: ${col}`;
				if (activeCols[textSearchCol]) {
					validPrefilters[textSearchCol] = criterion;
				} else {
					GDV.utils.reportSoftWarning("Prefilter column not found", `Prefilter column not found: "${col}" or "${textSearchCol}", skipping.`);
				}
			}
		}
		return validPrefilters;
	}

	function validatePrefilterConditions(prefilterConditions) {
		const warnings = [];
		if (!prefilterConditions || typeof prefilterConditions !== "object" || Array.isArray(prefilterConditions)) {
			GDV.utils.reportSoftWarning("Prefilter validation issue", "Invalid conditions object");
			return false;
		}
		for (const [col, val] of Object.entries(prefilterConditions)) {
			if (!val || typeof val !== "object" || Array.isArray(val)) {
				warnings.push(`"${col}" is not a valid condition object`);
				continue;
			}
			// Numeric
			if (val.min != null || val.max != null || val.type === "int" || val.type === "float") {
				if (val.min != null && !Number.isFinite(val.min)) {
					warnings.push(`"${col}" has invalid min`);
				}
				if (val.max != null && !Number.isFinite(val.max)) {
					warnings.push(`"${col}" has invalid max`);
				}
				if (val.min != null && val.max != null && val.min > val.max) {
					warnings.push(`"${col}" min > max`);
				}

				continue;
			}
			// Choices
			if (Array.isArray(val.choices)) {
				if (!val.choices.every(c => typeof c === "string" || typeof c === "number" || typeof c === "boolean")) {
					warnings.push(`"${col}" has invalid choices`);
				}
				continue;
			}
			// Text
			if (val.text != null) {
				if (!Array.isArray(val.text) || !val.text.every(t => typeof t === "string")) {
					warnings.push(`"${col}" has invalid text tokens`);
				}
				continue;
			}
			// Unknown shape
			warnings.push(`"${col}" has unknown condition structure`);
		}
		// SINGLE BANNER OUTPUT (your rule)
		if (warnings.length > 0) {
			GDV.utils.reportSoftWarning("Prefilter validation issues", warnings.join("\n"));
			return false;
		}
		return true;
	}

	function normalizeSimilarityGame(similarityGame) {
		if (similarityGame == null) {
			return null;
		}
		if (typeof similarityGame !== "string") {
			GDV.utils.reportSoftWarning("Similarity Game Parameter Ignored", "The similarity game given is not a string and was ignored.");
			return null;
		}
		const normalized = similarityGame.trim();
		if (normalized.length === 0) {
			return null;
		}

		const MAX_LENGTH = 200;
		if (normalized.length > MAX_LENGTH) {
			GDV.utils.reportSoftWarning("Similarity Game Parameter Ignored", "The similarity game string was too long and was ignored.");
			return null;
		}
		return normalized;
	}
})();
