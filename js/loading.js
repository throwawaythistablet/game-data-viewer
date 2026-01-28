(function() {

const loadingOverlayElement = document.getElementById('loadingOverlayElement');
const loadingOverlayLabel = document.getElementById('loadingOverlayLabel');
const loadingOverlayProgressBar = document.getElementById('loadingOverlayProgressBar');
const loadingOverlayProgressText = document.getElementById('loadingOverlayProgressText');
const loadingOverlayStopButton = document.getElementById('loadingOverlayStopButton');

let loadingCancelled = false;

GDV.loading.showLoading = async function (){ 
    loadingOverlayElement.style.display = 'flex'; 
    await GDV.utils.yieldToBrowser();
}

GDV.loading.hideLoading = async function() { 
    loadingOverlayElement.style.display = 'none'; 
    await GDV.utils.yieldToBrowser();
}

GDV.loading.startLoading = async function() {
    await GDV.loading.updateLoadingDirectUpdate("Loading...", 0);
    GDV.loading.resetLoadingCancellation();
    await GDV.loading.showLoading();
}

GDV.loading.finishLoading = async function() {
    await GDV.loading.hideLoading();
    GDV.loading.resetLoadingCancellation();
    await GDV.loading.updateLoadingDirectUpdate("", 0);
}

GDV.loading.resetLoadingCancellation = function() {loadingCancelled = false;}

GDV.loading.cancelLoading = function() {loadingCancelled = true;}

GDV.loading.isLoadingCancelled = function() {return loadingCancelled;}

GDV.loading.updateLoadingDirectUpdate = async function(label, percent) {
    loadingOverlayLabel.textContent = label;
    loadingOverlayProgressBar.style.width = percent + '%';
    loadingOverlayProgressText.textContent = percent.toFixed(2) + '%';

    // GDV.utils.reportInformation(`Loading Direct Progress: ${percent.toFixed(2)}%`);

    await GDV.utils.yieldToBrowser();
}

GDV.loading.updateLoadingStepProgress = async function(label, startPercent, endPercent, currentStep, totalSteps) {
    if (totalSteps <= 0) totalSteps = 1;

    const fractionOfPhase = currentStep / totalSteps;
    const totalPercent = startPercent + fractionOfPhase * (endPercent - startPercent);

    loadingOverlayLabel.textContent = label;
    loadingOverlayProgressBar.style.width = totalPercent + '%';
    loadingOverlayProgressText.textContent = totalPercent.toFixed(2) + '%';

    // GDV.utils.reportInformation(`Loading Step Progress: ${totalPercent.toFixed(2)}%`, `Step: ${currentStep}/${totalSteps} | Phase: ${startPercent} → ${endPercent}%`, {'startPercent': startPercent, 'endPercent': endPercent, 'currentStep': currentStep, 'totalSteps': totalSteps});

    await GDV.utils.yieldToBrowser();
}

// Stop loading button
loadingOverlayStopButton.addEventListener('click', async () => {
    GDV.loading.cancelLoading();
    await GDV.loading.hideLoading();
});

})();