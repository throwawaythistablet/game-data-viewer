(() => {
	const loadingOverlayElement = document.getElementById("loadingOverlayElement");
	const loadingOverlayLabel = document.getElementById("loadingOverlayLabel");
	const loadingOverlayProgressBar = document.getElementById("loadingOverlayProgressBar");
	const loadingOverlayProgressText = document.getElementById("loadingOverlayProgressText");
	const loadingOverlayStopButton = document.getElementById("loadingOverlayStopButton");
	const finishDisplayDelay = 1000;

	let loadingStopped = false;
	let loadingRenderFrame = null;
	let pendingLoadingLabel = "";
	let pendingLoadingPercent = 0;
	let renderedLoadingLabel = null;
	let renderedLoadingPercent = null;
	let renderedLoadingProgressText = null;

	GDV.loading.isLoadingStopped = isLoadingStopped;
	function isLoadingStopped() {
		return loadingStopped;
	}

	GDV.loading.startLoading = startLoading;
	async function startLoading(label, color) {
		cancelScheduledLoadingRender();
		resetLoadingStoppedFlag();

		resetLoadingDisplay();
		setLoadingColor(color);
		updateLoadingLabel(label);
		showLoading();
		await GDV.utils.yieldToBrowserTimeout();
	}

	GDV.loading.finishLoading = finishLoading;
	async function finishLoading(label) {
		updateLoadingDirectUpdate(label, 100);
		await GDV.utils.yieldToBrowserTimeout(finishDisplayDelay);

		cancelScheduledLoadingRender();
		resetLoadingStoppedFlag();
		hideLoading();
		resetLoadingDisplay();
		await GDV.utils.yieldToBrowserTimeout();
	}

	GDV.loading.abortLoading = abortLoading;
	async function abortLoading() {
		cancelScheduledLoadingRender();
		resetLoadingStoppedFlag();

		hideLoading();
		resetLoadingDisplay();
		await GDV.utils.yieldToBrowserTimeout();
	}

	GDV.loading.updateLoadingDirectUpdate = updateLoadingDirectUpdate;
	function updateLoadingDirectUpdate(label, percent) {
		scheduleLoadingRender(label, percent);
	}

	GDV.loading.updateLoadingStepProgress = updateLoadingStepProgress;
	function updateLoadingStepProgress(label, startPercent, endPercent, currentStep, totalSteps) {
		if (totalSteps <= 0) totalSteps = 1;

		const fractionOfPhase = currentStep / totalSteps;
		const totalPercent = startPercent + fractionOfPhase * (endPercent - startPercent);

		scheduleLoadingRender(label, totalPercent);
	}

	function scheduleLoadingRender(label, percent) {
		pendingLoadingLabel = label;
		pendingLoadingPercent = percent;

		if (loadingRenderFrame !== null) return;

		loadingRenderFrame = requestAnimationFrame(renderLoading);
	}

	function resetLoadingStoppedFlag() {
		loadingStopped = false;
	}

	function stopLoading() {
		loadingStopped = true;
	}

	function renderLoading() {
		loadingRenderFrame = null;
		updateLoadingLabel(pendingLoadingLabel);
		updateLoadingProgress(pendingLoadingPercent);
	}

	function updateLoadingLabel(label) {
		if (renderedLoadingLabel === label) return;

		loadingOverlayLabel.textContent = label;
		renderedLoadingLabel = label;
	}

	function updateLoadingProgress(percent) {
		if (renderedLoadingPercent === percent) return;

		updateLoadingProgressBar(percent);
		updateLoadingProgressText(percent);
		renderedLoadingPercent = percent;
	}

	function updateLoadingProgressBar(percent) {
		loadingOverlayProgressBar.style.width = `${percent}%`;
	}

	function updateLoadingProgressText(percent) {
		const progressText = `${percent.toFixed(2)}%`;

		if (renderedLoadingProgressText === progressText) return;

		loadingOverlayProgressText.textContent = progressText;
		renderedLoadingProgressText = progressText;
	}

	function resetLoadingDisplay() {
		renderedLoadingLabel = null;
		renderedLoadingPercent = null;
		renderedLoadingProgressText = null;
		updateLoadingLabel("");
		updateLoadingProgress(0);
	}

	function showLoading() {
		loadingOverlayElement.style.display = "flex";
	}

	function hideLoading() {
		loadingOverlayElement.style.display = "none";
	}

	function setLoadingColor(color) {
		loadingOverlayElement.style.setProperty("--loading-color", color);
	}

	function cancelScheduledLoadingRender() {
		if (loadingRenderFrame === null) return;

		cancelAnimationFrame(loadingRenderFrame);
		loadingRenderFrame = null;
	}

	loadingOverlayStopButton.addEventListener("click", async () => {
		stopLoading();
		hideLoading();
		await GDV.utils.yieldToBrowserTimeout();
	});
})();