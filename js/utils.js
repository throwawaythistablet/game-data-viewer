(() => {
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

	GDV.utils.reportSilentError = (label, description, error, context = null) => {
		logWarnOrError("error", label, description, error, context);
		showErrorBanner(label, description, error);
	};

	GDV.utils.reportHardWarning = (label, description, error = null, context = null) => {
		logWarnOrError("warn", label, description, error, context);
		showAlertMessage(label, description, error);
	};

	GDV.utils.reportSilentWarning = (label, description, error = null, context = null) => {
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

	GDV.utils.yieldToBrowser = async () => {
		await new Promise((r) => setTimeout(r, 50));
		// if (!document.hidden) await new Promise(r => setTimeout(r, 0));
	};

	GDV.utils.debounce = (fn, delay = 150) => {
		let timer = null;
		return function (...args) {
			clearTimeout(timer);
			timer = setTimeout(() => fn.apply(this, args), delay);
		};
	};

	GDV.utils.findNearestGameKey = (input) => {
		const q = input.toLowerCase();
		let best = null;
		let bestScore = Infinity;

		for (const key of GDV.state.getGameKeys()) {
			const k = key.toLowerCase();

			// Fast path: substring match
			if (k.includes(q)) return key;

			const score = levenshteinDistance(q, k);
			if (score < bestScore) {
				bestScore = score;
				best = key;
			}
		}
		return best;
	};

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
	}

	GDV.utils.getSimilarityRatio = (a, b) => {
		if (a === 0 && b === 0) return 1;
		const aa = Math.abs(a);
		const bb = Math.abs(b);
		return Math.min(aa, bb) / Math.max(aa, bb);
	}

	function createErrorMessage(error) {
		if (!error?.message) return "";
		const msg = error.message.toString().trim();
		return msg ? `\n${msg}` : "";
	}

})();
