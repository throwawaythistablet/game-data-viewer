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
	GDV.utils.yieldToBrowserTimeout = async (ms = 50) => {
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
			const keyScore = levenshteinDistance(inputLower, keyLower);
			const titleScore = levenshteinDistance(inputLower, titleLower);
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
			const distance = levenshteinDistance(input, candidate);
			if (distance < bestDistance) {
				bestDistance = distance;
				bestMatch = candidate;
			}
		}
		return bestMatch;
	}

	GDV.utils.levenshteinDistance = levenshteinDistance;
	function levenshteinDistance(a, b) {
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
				const dist = GDV.utils.levenshteinDistance(colToken, searchToken);
				if (dist < minDistance) minDistance = dist;
			}
		}

		return minDistance;
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

	function createErrorMessage(error) {
		if (!error?.message) return "";
		const msg = error.message.toString().trim();
		return msg ? `\n${msg}` : "";
	}

})();
