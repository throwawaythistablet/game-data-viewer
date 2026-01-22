let loadingCancelled = false;

function showLoading() { loadingOverlayElement.style.display = 'flex'; }

function hideLoading() { loadingOverlayElement.style.display = 'none'; }

function resetLoadingCancellation() {loadingCancelled = false;}

function cancelLoading() {loadingCancelled = true;}

function isLoadingCancelled() {return loadingCancelled;}

async function updateLoadingProgress(header, startPercent, endPercent, currentStep, totalSteps) {
    if (totalSteps <= 0) totalSteps = 1;

    const fractionOfPhase = currentStep / totalSteps;
    const totalPercent = startPercent + fractionOfPhase * (endPercent - startPercent);

    loadingHeader.textContent = header
    loadingProgressBar.style.width = totalPercent + '%';
    loadingProgressText.textContent = totalPercent.toFixed(2) + '%';

    //console.log(`Progress: ${totalPercent.toFixed(2)}% | Step: ${currentStep}/${totalSteps} | Phase: ${startPercent} → ${endPercent}%`); // debug

    await yieldToBrowser();
}