(() => {
	GDV.urlParameters.getDataFromUrlParameters = getDataFromUrlParameters;
	function getDataFromUrlParameters() {
		const params = parseQueryString();
		return {
			prefilterConditions: extractPrefilterConditions(params),
			prefilterAst: extractPrefilterAst(params),
			similarityCriteria: extractSimilarityCriteria(params),
		};
	}

	GDV.urlParameters.encodeDataAsUrlParameters = encodeDataAsUrlParameters;
	function encodeDataAsUrlParameters(prefilterConditions, prefilterAst, similarityCriteria) {
		const parts = [];
		const pfPart = encodePrefilterConditions(prefilterConditions);
		if (pfPart) {
			parts.push(pfPart);
		}
		const astPart = encodePrefilterAst(prefilterAst);
		if (astPart) {
			parts.push(astPart);
		}
		const sgPart = encodeSimilarityCriteria(similarityCriteria);
		if (sgPart) {
			parts.push(sgPart);
		}
		return parts.join("&");
	}

	GDV.urlParameters.extractPrefilterConditions = extractPrefilterConditions;
	function extractPrefilterConditions(params) {
		if (params.pf) {
			let pfObj = decodeBase64UrlJson(params.pf);
			if (!pfObj) {
				GDV.utils.reportSoftWarning("Invalid URL Prefilter Conditions Parameter", "The URL contained an invalid 'pf' parameter and it will be ignored.");
				return null;
			}
			const humanPrefilterConditions = parseHumanReadable(params);
			pfObj = mergePrefilterConditions(pfObj, humanPrefilterConditions);
			if (pfObj && !validatePrefilterConditions(pfObj)) {
				GDV.utils.reportSoftWarning("Prefilter Validation Failed", "The prefilters extracted from the URL did not pass validation and will be ignored.");
				return null;
			}
			return pfObj;
		}
		return null;
	}

	function extractPrefilterAst(params) {
		if (params.ast) {
			const astObj = decodeBase64UrlJson(params.ast);
			if (astObj === null) {
				GDV.utils.reportSoftWarning("Invalid URL Prefilter Expression Parameter", "The URL contained an invalid 'ast' parameter and it will be ignored.");
				return null;
			}
			return astObj;
		}
		return null;
	}

	function extractSimilarityCriteria(params) {
		if (params.sg) {
			const sgObj = decodeBase64UrlJson(params.sg);
			if (sgObj === null) {
				GDV.utils.reportSoftWarning("Invalid URL Similarity Game Parameter", "The URL contained an invalid 'sg' parameter and it will be ignored.");
				return null;
			}
			if (typeof sgObj === "string") {
				return { referenceGame: normalizeSimilarityReferenceGame(sgObj) };
			}
			if (typeof sgObj === "object") {
				return sgObj;
			}
			GDV.utils.reportSoftWarning("Similarity Game Parameter Ignored", "The type of similarity game was not recognized and was ignored.");
			return null;
		}
		return null;
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

	function encodeSimilarityCriteria(similarityCriteria) {
		if (!similarityCriteria || typeof similarityCriteria !== "object" || Object.keys(similarityCriteria).length === 0) {
			return null;
		}
		const encoded = encodeJsonToBase64Url(similarityCriteria);
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
			const columnName = key.substring(3); // remove pf_
			const value = params[key];

			const columnDetail = GDV.state.getActiveColumnDetails()[columnName];
			if (!columnDetail) {
				GDV.utils.reportSoftWarning("Unknown Column in URL Prefilters", `The column '${columnName}' in the URL prefilters is unknown and will be ignored.`);
				return;
			}

			switch (columnDetail.type) {
				case "float":
				case "int": {
					// Range parsing: "min-max" or "-max" or "min-"
					const [minStr, maxStr] = value.split("-");
					const min = minStr !== "" ? parseFloat(minStr) : null;
					const max = maxStr !== "" ? parseFloat(maxStr) : null;

					// Ensure min <= max if both exist
					if (min !== null && max !== null && min > max) {
						GDV.utils.reportSoftWarning("Prefilter Range Correction", `For column '${columnName}', min value was greater than max. Values have been swapped.`);
						prefilterConditions[columnName] = { type: columnDetail.type, min: max, max: min };
					} else {
						prefilterConditions[columnName] = { type: columnDetail.type, min, max };
					}
					break;
				}

				case "str": {
					// Comma-separated choices
					const choices = value.split(",").map((s) => s.trim()).filter(Boolean);

					// Optional: validate against allowed choices
					const validChoices = columnDetail.choices.length ? choices.filter((c) => columnDetail.choices.includes(c)) : choices;
					prefilterConditions[columnName] = { type: "str", choices: validChoices };
					break;
				}

				case "tag": {
					// Numeric tag values
					const tags = value.split(",").map(Number).filter((n) => !Number.isNaN(n));

					// Optional: validate against min/max
					const validTags = tags.filter((n) => n >= columnDetail.min && n <= columnDetail.max);
					prefilterConditions[columnName] = { type: "tag", choices: validTags };
					break;
				}

				case "bool": {
					// Accept "true"/"1" as true, "false"/"0" as false
					const boolVals = value
						.split(",")
						.map((v) => {
							v = v.toLowerCase();
							return v === "true" || v === "1" ? true : v === "false" || v === "0" ? false : null;
						})
						.filter((v) => v !== null);

					prefilterConditions[columnName] = { type: "bool", choices: boolVals };
					break;
				}

				default: {
					// Treat as free text (multiple tokens allowed)
					const tokens = value
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean);
					if (tokens.length) prefilterConditions[columnName] = { text: tokens };
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

	function validatePrefilterConditions(prefilterConditions) {
		const warnings = [];
		if (!prefilterConditions || typeof prefilterConditions !== "object" || Array.isArray(prefilterConditions)) {
			GDV.utils.reportSoftWarning("Prefilter validation issue", "Invalid conditions object");
			return false;
		}
		for (const [column, value] of Object.entries(prefilterConditions)) {
			if (!value || typeof value !== "object" || Array.isArray(value)) {
				warnings.push(`"${column}" is not a valid condition object`);
				continue;
			}
			// Numeric
			if (value.min != null || value.max != null || value.type === "int" || value.type === "float") {
				if (value.min != null && !Number.isFinite(value.min)) {
					warnings.push(`"${column}" has invalid min`);
				}
				if (value.max != null && !Number.isFinite(value.max)) {
					warnings.push(`"${column}" has invalid max`);
				}
				if (value.min != null && value.max != null && value.min > value.max) {
					warnings.push(`"${column}" min > max`);
				}

				continue;
			}
			// Choices
			if (Array.isArray(value.choices)) {
				if (!value.choices.every(c => typeof c === "string" || typeof c === "number" || typeof c === "boolean")) {
					warnings.push(`"${column}" has invalid choices`);
				}
				continue;
			}
			// Text
			if (value.text != null) {
				if (!Array.isArray(value.text) || !value.text.every(t => typeof t === "string")) {
					warnings.push(`"${column}" has invalid text tokens`);
				}
				continue;
			}
			// Unknown shape
			warnings.push(`"${column}" has unknown condition structure`);
		}
		// SINGLE BANNER OUTPUT (your rule)
		if (warnings.length > 0) {
			GDV.utils.reportSoftWarning("Prefilter validation issues", warnings.join("\n"));
			return false;
		}
		return true;
	}

	function normalizeSimilarityReferenceGame(similarityReferenceGame) {
		if (similarityReferenceGame == null) {
			return null;
		}
		if (typeof similarityReferenceGame !== "string") {
			GDV.utils.reportSoftWarning("Similarity Game Parameter Ignored", "The similarity game given is not a string and was ignored.");
			return null;
		}
		const normalized = similarityReferenceGame.trim();
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
