(() => {
	const loadingOverlayElement = document.getElementById("loadingOverlayElement");
	const loadingOverlayLabel = document.getElementById("loadingOverlayLabel");
	const loadingOverlaySpinner = document.getElementById("loadingOverlaySpinner");
	const loadingOverlayProgressBar = document.getElementById("loadingOverlayProgressBar");
	const loadingOverlayProgressText = document.getElementById("loadingOverlayProgressText");
	const loadingOverlayStopButton = document.getElementById("loadingOverlayStopButton");

	let loadingCancelled = false;

	GDV.loading.startLoading = startLoading;
	async function startLoading(color) {
		await updateLoadingDirectUpdate("Loading...", 0);
		resetLoadingCancellation();
		await showLoading(color);
	}

	GDV.loading.finishLoading = finishLoading;
	async function finishLoading() {
		await hideLoading();
		resetLoadingCancellation();
		await updateLoadingDirectUpdate("", 0);
	}

	GDV.loading.resetLoadingCancellation = resetLoadingCancellation;
	function resetLoadingCancellation() {
		loadingCancelled = false;
	}

	GDV.loading.cancelLoading = cancelLoading;
	function cancelLoading() {
		loadingCancelled = true;
	}

	GDV.loading.isLoadingCancelled = isLoadingCancelled;
	function isLoadingCancelled() {
		return loadingCancelled;
	}

	GDV.loading.updateLoadingDirectUpdate = updateLoadingDirectUpdate;
	async function updateLoadingDirectUpdate(label, percent) {
		loadingOverlayLabel.textContent = label;
		loadingOverlayProgressBar.style.width = percent + "%";
		loadingOverlayProgressText.textContent = percent.toFixed(2) + "%";

		// GDV.utils.reportInformation(`Loading Direct Progress: ${percent.toFixed(2)}%`);

		await GDV.utils.yieldToBrowser();
	}

	GDV.loading.updateLoadingStepProgress = updateLoadingStepProgress;
	async function updateLoadingStepProgress(label, startPercent, endPercent, currentStep, totalSteps) {
		if (totalSteps <= 0) totalSteps = 1;

		const fractionOfPhase = currentStep / totalSteps;
		const totalPercent = startPercent + fractionOfPhase * (endPercent - startPercent);

		loadingOverlayLabel.textContent = label;
		loadingOverlayProgressBar.style.width = totalPercent + "%";
		loadingOverlayProgressText.textContent = totalPercent.toFixed(2) + "%";

		// GDV.utils.reportInformation(`Loading Step Progress: ${totalPercent.toFixed(2)}%`, `Step: ${currentStep}/${totalSteps} | Phase: ${startPercent} → ${endPercent}%`, {'startPercent': startPercent, 'endPercent': endPercent, 'currentStep': currentStep, 'totalSteps': totalSteps});

		await GDV.utils.yieldToBrowser();
	}

	async function showLoading(color) {
		if (color) {
			changeColor(color);
		}
		loadingOverlayElement.style.display = "flex";
		await GDV.utils.yieldToBrowser();
	}

	async function hideLoading() {
		loadingOverlayElement.style.display = "none";
		await GDV.utils.yieldToBrowser();
	}

	function changeColor(color) {
		loadingOverlayElement.style.color = color;
		loadingOverlaySpinner.style.borderTop = `6px solid ${color}`;
		loadingOverlayLabel.style.color = color;
		loadingOverlayProgressBar.style.background = color;
	}

	// Stop loading button
	loadingOverlayStopButton.addEventListener("click", async () => {
		cancelLoading();
		await hideLoading();
	});
})();
