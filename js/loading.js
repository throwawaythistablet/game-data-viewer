let loadingCancelled = false;

async function startLoading() {
    await updateLoadingDirectUpdate("Loading...", 0);
    resetLoadingCancellation();
    showLoading();
}

async function finishLoading() {
    hideLoading();
    resetLoadingCancellation();
    await updateLoadingDirectUpdate("", 0);
}

function showLoading() { loadingOverlayElement.style.display = 'flex'; }

function hideLoading() { loadingOverlayElement.style.display = 'none'; }

function resetLoadingCancellation() {loadingCancelled = false;}

function cancelLoading() {loadingCancelled = true;}

function isLoadingCancelled() {return loadingCancelled;}

async function updateLoadingDirectUpdate(label, percent) {
    loadingOverlayLabel.textContent = label;
    loadingOverlayProgressBar.style.width = percent + '%';
    loadingOverlayProgressText.textContent = percent.toFixed(2) + '%';

    // reportInformation(`Loading Direct Progress: ${percent.toFixed(2)}%`);

    await yieldToBrowser();
}

async function updateLoadingStepProgress(label, startPercent, endPercent, currentStep, totalSteps) {
    if (totalSteps <= 0) totalSteps = 1;

    const fractionOfPhase = currentStep / totalSteps;
    const totalPercent = startPercent + fractionOfPhase * (endPercent - startPercent);

    loadingOverlayLabel.textContent = label;
    loadingOverlayProgressBar.style.width = totalPercent + '%';
    loadingOverlayProgressText.textContent = totalPercent.toFixed(2) + '%';

    // reportInformation(`Loading Step Progress: ${totalPercent.toFixed(2)}%`, `Step: ${currentStep}/${totalSteps} | Phase: ${startPercent} → ${endPercent}%`, {'startPercent': startPercent, 'endPercent': endPercent, 'currentStep': currentStep, 'totalSteps': totalSteps});

    await yieldToBrowser();
}