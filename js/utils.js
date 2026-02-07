(function() {

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
    GDV.dom.showErrorBanner(label, description + (error?.message ? `\n${error.message}` : ''));
};

GDV.utils.showWarningBanner = showWarningBanner;
function showWarningBanner(label, description, error = null) {
    GDV.dom.showWarningBanner(label, description + (error?.message ? `\n${error.message}` : ''));
};

GDV.utils.showInfoBanner = showInfoBanner;
function showInfoBanner(label, description) {
    GDV.dom.showInfoBanner(label, description);
};

GDV.utils.showAlertMessage = showAlertMessage;
function showAlertMessage(label, description, error = null) {
    alert(
        `${label}\n\n${description}` +
        (error?.message ? `\n\n${error.message}` : '')
    );
}

GDV.utils.showConfirmationDialog = showConfirmationDialog;
function showConfirmationDialog(label, description) {
    return confirm(`${label}\n\n${description}`);
}

GDV.utils.reportHardError = function(label, description, error, context = null) {
    logWarnOrError('error', label, description, error, context);
    showAlertMessage(label, description, error);
}

GDV.utils.reportSilentError = function(label, description, error, context = null) {
    logWarnOrError('error', label, description, error, context);
    showErrorBanner(label, description, error)
}

GDV.utils.reportHardWarning = function(label, description, error = null, context = null) {
    logWarnOrError('warn', label, description, error, context);
    showAlertMessage(label, description, error);
}

GDV.utils.reportSilentWarning = function(label, description, error = null, context = null) {
    logWarnOrError('warn', label, description, error, context);
    showWarningBanner(label, description, error)
}

GDV.utils.reportInformation = function(label, description, context = null) {
    logInformation('info', label, description, context);
    showInfoBanner(label, description)
}

GDV.utils.requestUserConfirmation = function(label, description, context = null) {
    logInformation('info', label, description, context);
    return showConfirmationDialog(label, description);
}

GDV.utils.yieldToBrowser = async function() {
    await new Promise(r => setTimeout(r, 50));
    // if (!document.hidden) await new Promise(r => setTimeout(r, 0));
}

})();
