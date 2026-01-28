(function() {

GDV.utils.logInformation = function(level, label, description, context) {
    if (console[level]) {
        console.groupCollapsed(`INFO [${label}]`);
        if (description) console[level](description);
        if (context) console[level](context);
        console.groupEnd();
    }
}

GDV.utils.logError = function(level, label, description, error, context) {
    if (console[level]) {
        console.groupCollapsed(`${level.toUpperCase()} [${label}]`);
        if (description) console[level](description);
        if (error) console[level](error);
        if (context) console[level](context);
        console.groupEnd();
    }
}

GDV.utils.showAlertMessage = function(label, description, error = null) {
    alert(
        `${label}\n\n${description}` +
        (error?.message ? `\n\n${error.message}` : '')
    );
}

GDV.utils.showConfirmationDialog = function(label, description) {
    return confirm(`${label}\n\n${description}`);
}

GDV.utils.reportHardError = function(label, description, error, context = null) {
    GDV.utils.logError('error', label, description, error, context);
    GDV.utils.showAlertMessage(label, description, error);
}

GDV.utils.reportSilentError = function(label, description, error, context = null) {
    GDV.utils.logError('error', label, description, error, context);
}

GDV.utils.reportHardWarning = function(label, description, error = null, context = null) {
    GDV.utils.logError('warn', label, description, error, context);
    GDV.utils.showAlertMessage(label, description, error);
}

GDV.utils.reportSilentWarning = function(label, description, error = null, context = null) {
    GDV.utils.logError('warn', label, description, error, context);
}

GDV.utils.reportInformation = function(label, description, context = null) {
    GDV.utils.logInformation('info', label, description, context);
}

GDV.utils.requestUserConfirmation = function(label, description, context = null) {
    GDV.utils.logInformation('info', label, description, context);
    return GDV.utils.showConfirmationDialog(label, description);
}

GDV.utils.yieldToBrowser = async function() {
    await new Promise(r => setTimeout(r, 0));
    // if (!document.hidden) await new Promise(r => setTimeout(r, 0));
}

})();
