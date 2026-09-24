(() => {
	const BRACKET_RE = /\s*\[[^\]]*\]/g;

	GDV.utils.logInformation = logInformation;
	function logInformation(level, label, description, context) {
		if (console[level]) {
			console.groupCollapsed(`INFO [${label}]`);
			if (description) console[level](description);
			if (context) console[level](context);
			console.groupEnd();
		}
	}

	GDV.utils.logWarnOrError = logWarnOrError;
	function logWarnOrError(level, label, description, error, context) {
		if (console[level]) {
			console.groupCollapsed(`${level.toUpperCase()} [${label}]`);
			if (description) console[level](description);
			if (error) console[level](error);
			if (context) console[level](context);
			console.groupEnd();
		}
	}

	GDV.utils.showErrorBanner = showErrorBanner;
	function showErrorBanner(label, description, error) {
		GDV.dom.showErrorBanner(label, description + createErrorMessage(error));
	}

	GDV.utils.showWarningBanner = showWarningBanner;
	function showWarningBanner(label, description, error = null) {
		GDV.dom.showWarningBanner(label, description + createErrorMessage(error));
	}

	GDV.utils.showInfoBanner = showInfoBanner;
	function showInfoBanner(label, description) {
		GDV.dom.showInfoBanner(label, description);
	}

	GDV.utils.showPermanentWarningBanner = showPermanentWarningBanner;
	function showPermanentWarningBanner(label, description, error = null) {
		GDV.dom.showPermanentWarningBanner(label, description + createErrorMessage(error));
	}

	GDV.utils.hideBannerWithLabel = hideBannerWithLabel;
	function hideBannerWithLabel(label) {
		GDV.dom.hideBannerWithLabel(label);
	}

	GDV.utils.showAlertMessage = showAlertMessage;
	function showAlertMessage(label, description, error = null) {
		alert(`${label}\n\n${description}${error?.message ? `\n\n${error.message}` : ""}`);
	}

	GDV.utils.showConfirmationDialog = showConfirmationDialog;
	function showConfirmationDialog(label, description) {
		return confirm(`${label}\n\n${description}`);
	}

	GDV.utils.reportHardError = (label, description, error, context = null) => {
		logWarnOrError("error", label, description, error, context);
		showAlertMessage(label, description, error);
	};

	GDV.utils.reportSoftError = (label, description, error, context = null) => {
		logWarnOrError("error", label, description, error, context);
		showErrorBanner(label, description, error);
	};

	GDV.utils.reportHardWarning = (label, description, error = null, context = null) => {
		logWarnOrError("warn", label, description, error, context);
		showAlertMessage(label, description, error);
	};

	GDV.utils.reportSoftWarning = (label, description, error = null, context = null) => {
		logWarnOrError("warn", label, description, error, context);
		showWarningBanner(label, description, error);
	};

	GDV.utils.reportInformation = (label, description, context = null) => {
		logInformation("info", label, description, context);
		showInfoBanner(label, description);
	};

	GDV.utils.requestUserConfirmation = (label, description, context = null) => {
		logInformation("info", label, description, context);
		return showConfirmationDialog(label, description);
	};

	// Yield with a short fixed delay (setTimeout)
	GDV.utils.yieldToBrowserTimeout = async (ms = 100) => {
		await new Promise((resolve) => setTimeout(resolve, ms));
	};

	// Yield until the next browser repaint (requestAnimationFrame)
	GDV.utils.yieldToBrowserFrame = async () => {
		await new Promise(requestAnimationFrame);
	};

	GDV.utils.debounce = (fn, delay = 100) => {
		let timer = null;
		const debounced = (...args) => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				timer = null;
				fn(...args);
			}, delay);
		};
		debounced.cancel = () => {
			if (timer !== null) {
				clearTimeout(timer);
				timer = null;
			}
		};
		return debounced;
	};

	GDV.utils.findNearestGameKey = (input) => {
		const inputLower = input.toLowerCase().trim();
		if (!inputLower) return null;
		let best = null;
		let bestScore = Infinity;

		for (const key of GDV.state.getGameKeys()) {
			const keyLower = key.toLowerCase();

			// Fast path: substring match
			if (keyLower.includes(inputLower)) return key;

			const titleLower = keyLower.replace(BRACKET_RE, "").trim();
			const keyScore = getLevenshteinDistance(inputLower, keyLower);
			const titleScore = getLevenshteinDistance(inputLower, titleLower);
			const finalScore = Math.min(keyScore, titleScore);
			if (finalScore < bestScore) {
				bestScore = finalScore;
				best = key;
			}
		}
		return best;
	};

	GDV.utils.findBestStringMatch = findBestStringMatch;
	function findBestStringMatch(input, candidates) {
		if (!candidates.length) return null;
		let bestMatch = null;
		let bestDistance = Infinity;
		for (const candidate of candidates) {
			if (input === candidate) {
				return candidate;
			}
			const distance = getLevenshteinDistance(input, candidate);
			if (distance < bestDistance) {
				bestDistance = distance;
				bestMatch = candidate;
			}
		}
		return bestMatch;
	}

	GDV.utils.getLevenshteinDistance = getLevenshteinDistance;
	function getLevenshteinDistance(a, b) {
		const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
		for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
		for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

		for (let i = 1; i <= a.length; i++) {
			for (let j = 1; j <= b.length; j++) {
				const cost = a[i - 1] === b[j - 1] ? 0 : 1;
				matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
			}
		}
		return matrix[a.length][b.length];
	}

	GDV.utils.getJaroWinklerSimilarity = getJaroWinklerSimilarity;
	function getJaroWinklerSimilarity(a, b) {
		if (a === b) return 1;
		if (!a || !b) return 0;

		const maxDistance = Math.floor(Math.max(a.length, b.length) / 2) - 1;
		const aMatches = new Array(a.length).fill(false);
		const bMatches = new Array(b.length).fill(false);
		let matches = 0;
		for (let i = 0; i < a.length; i++) {
			const start = Math.max(0, i - maxDistance);
			const end = Math.min(i + maxDistance + 1, b.length);
			for (let j = start; j < end; j++) {
				if (bMatches[j] || a[i] !== b[j]) continue;
				aMatches[i] = true;
				bMatches[j] = true;
				matches++;
				break;
			}
		}

		if (matches === 0) return 0;
		let transpositions = 0;
		let bIndex = 0;
		for (let i = 0; i < a.length; i++) {
			if (!aMatches[i]) continue;
			while (!bMatches[bIndex]) bIndex++;
			if (a[i] !== b[bIndex]) transpositions++;
			bIndex++;
		}
		transpositions /= 2;
		const jaro = (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;
		let prefixLength = 0;
		for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
			if (a[i] !== b[i]) break;
			prefixLength++;
		}
		return jaro + prefixLength * 0.1 * (1 - jaro);
	}

	GDV.utils.getStringSimilarity = getStringSimilarity;
	function getStringSimilarity(a, b) {
		if (a === b) return 1;
		if (!a || !b) return 0;
		// Exact substring match gets a strong score.
		if (a.includes(b) || b.includes(a)) {
			return Math.min(a.length, b.length) / Math.max(a.length, b.length);
		}
		// Character-level similarity.
		const maxLength = Math.max(a.length, b.length);
		let matches = 0;
		for (let i = 0; i < Math.min(a.length, b.length); i++) {
			if (a[i] === b[i]) {
				matches++;
			}
		}
		return matches / maxLength;
	}

	GDV.utils.computeNearestMatchDistance = (columnName, searchText) => {
		if (!searchText) return Infinity;
		const colTokens = columnName.toLowerCase().split(/\s+/);
		const searchTokens = searchText.toLowerCase().split(/\s+/);
		let minDistance = Infinity;
		for (const colToken of colTokens) {
			for (const searchToken of searchTokens) {
				const dist = getLevenshteinDistance(colToken, searchToken);
				if (dist < minDistance) minDistance = dist;
			}
		}
		return minDistance;
	};

	GDV.utils.computeNearestMatchScore = (columnName, searchText) => {
		// Computes a one-to-one token similarity score using Monge–Elkan-style matching with Jaro-Winkler similarity.
		if (!searchText) return 0;
		const colTokens = columnName.toLowerCase().split(/\s+/);
		const searchTokens = searchText.toLowerCase().split(/\s+/);
		const usedColumnTokens = new Set();
		let totalScore = 0;
		for (const searchToken of searchTokens) {
			let bestScore = 0;
			let bestColumnIndex = -1;
			for (let i = 0; i < colTokens.length; i++) {
				if (usedColumnTokens.has(i)) continue;
				const score = getJaroWinklerSimilarity(searchToken, colTokens[i]);
				if (score > bestScore) {
					bestScore = score;
					bestColumnIndex = i;
				}
			}
			if (bestColumnIndex !== -1) {
				usedColumnTokens.add(bestColumnIndex);
				totalScore += bestScore;
			}
		}
		return totalScore / searchTokens.length;
	};

	GDV.utils.getNormalizedDifference = (a, b) => {
		if (a === b) return 1;
		const max = Math.max(Math.abs(a), Math.abs(b));
		if (max === 0) return 1;
		return Math.max(0, 1 - (Math.abs(a - b) / max));
	};

	GDV.utils.getSimilarityRatio = (a, b) => {
		if (a === 0 && b === 0) return 1;
		const aa = Math.abs(a);
		const bb = Math.abs(b);
		return Math.min(aa, bb) / Math.max(aa, bb);
	};

	GDV.utils.stripHtmlAndConvertToNumber = (text) => {
		if (typeof text === "number") return text; // already a number
		if (typeof text !== "string") return NaN; // not parseable
		return parseFloat(stripHtmlAndNormalize(text));
	}

	GDV.utils.stripHtmlAndNormalize = stripHtmlAndNormalize;
	function stripHtmlAndNormalize(text) {
		return text
			.replace(/<[^>]*>/g, "") // remove HTML tags
			.replace(/,/g, "") // remove commas
			.replace(/\s+/g, "") // remove spaces inside numbers
			.trim();
	}

	GDV.utils.stripHtmlToString = stripHtmlToString;
	function stripHtmlToString(text) {
		if (typeof text !== "string") return text;
		// Remove all HTML tags and trim
		return text.replace(/<[^>]*>/g, "").trim();
	}

	GDV.utils.normalizeFilterName = (columnName) => {
		return columnName.includes(": ") ? columnName.split(": ")[1] : columnName;
	};

	GDV.utils.downloadBlob = (blob, filename) => {
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();

		a.remove();
		URL.revokeObjectURL(url);
	};

	GDV.utils.createRegexTrie = () => {
		const root = { children: new Map(), terminal: false };

		function add(value) {
			let node = root;
			for (const char of value) {
				if (!node.children.has(char)) {
					node.children.set(char, { children: new Map(), terminal: false });
				}
				node = node.children.get(char);
			}
			node.terminal = true;
		}

		function serialize(node, cache) {
			if (cache.has(node)) return cache.get(node);
			const entries = [...node.children.entries()].sort(([a], [b]) => a.localeCompare(b));
			const parts = [];
			for (let i = 0; i < entries.length; i++) {
				const [char, child] = entries[i];
				const childPattern = serialize(child, cache);

				if (/^\d$/.test(char)) {
					let end = i;

					while (end + 1 < entries.length) {
						const [nextChar, nextChild] = entries[end + 1];

						if (!/^\d$/.test(nextChar)) break;
						if (Number(nextChar) !== Number(entries[end][0]) + 1) break;
						if (serialize(nextChild, cache) !== childPattern) break;

						end++;
					}

					if (end > i) {
						const digitPattern = end - i === 9 ? "\\d" : `[${char}-${entries[end][0]}]`;
						parts.push(`${digitPattern}${childPattern}`);
						i = end;
						continue;
					}
				}
				parts.push(`${$.fn.dataTable.util.escapeRegex(char)}${childPattern}`);
			}

			let pattern = parts.length === 0 ? "" : parts.length === 1 ? parts[0] : `(?:${parts.join("|")})`;
			if (node.terminal && pattern) pattern = `(?:${pattern})?`;
			cache.set(node, pattern);
			return pattern;
		}

		return {
			add, toRegex() {
				const pattern = serialize(root, new Map());
				return pattern ? `^${pattern}$` : `(?!x)x`;
			}
		};
	};

	GDV.utils.convertJsonObjectToMap = (object) => {
		return new Map(Object.entries(object));
	}

	GDV.utils.convertJsonObjectToRegexMap = (object, maxLength = Infinity) => {
		return new Map(
			Object.entries(object).map(([key, regexStr]) => [
				key,
				regexStr && regexStr.length <= maxLength
					? GDV.utils.convertToRegex(regexStr)
					: null
			])
		);
	};

	GDV.utils.convertToRegex = (regexStr) => {
		let regex = null;
		try {
			regex = new RegExp(regexStr, "i");
		} catch (err) {
			GDV.utils.reportSoftWarning("Invalid Regex", `Invalid regex pattern.`, err, { regexStr: regexStr });
		}
		return regex;
	};

	function createErrorMessage(error) {
		if (!error?.message) return "";
		const msg = error.message.toString().trim();
		return msg ? `\n${msg}` : "";
	}

})();
