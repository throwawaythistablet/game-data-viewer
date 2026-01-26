let loadingCancelled = false;

function showLoading() { loadingOverlayElement.style.display = 'flex'; }

function hideLoading() { loadingOverlayElement.style.display = 'none'; }

function resetLoadingCancellation() {loadingCancelled = false;}

function cancelLoading() {loadingCancelled = true;}

function isLoadingCancelled() {return loadingCancelled;}

async function updateLoadingDirectUpdate(label, percent) {

    loadingOverlayLabel.textContent = label
    loadingOverlayProgressBar.style.width = percent + '%';
    loadingOverlayProgressText.textContent = percent.toFixed(2) + '%';

    //console.log(`Progress: ${percent.toFixed(2)}%`); // debug

    await yieldToBrowser();
}

async function updateLoadingStepProgress(label, startPercent, endPercent, currentStep, totalSteps) {
    if (totalSteps <= 0) totalSteps = 1;

    const fractionOfPhase = currentStep / totalSteps;
    const totalPercent = startPercent + fractionOfPhase * (endPercent - startPercent);

    loadingOverlayLabel.textContent = label
    loadingOverlayProgressBar.style.width = totalPercent + '%';
    loadingOverlayProgressText.textContent = totalPercent.toFixed(2) + '%';

    //console.log(`Progress: ${totalPercent.toFixed(2)}% | Step: ${currentStep}/${totalSteps} | Phase: ${startPercent} → ${endPercent}%`); // debug

    await yieldToBrowser();
}