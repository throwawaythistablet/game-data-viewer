
function logInformation(level, label, description, context) {
    if (console[level]) {
        console.groupCollapsed(`INFO [${label}]`);
        if (description) console[level](description);
        if (context) console[level](context);
        console.groupEnd();
    }
}

function logError(level, label, description, error, context) {
    if (console[level]) {
        console.groupCollapsed(`${level.toUpperCase()} [${label}]`);
        if (description) console[level](description);
        if (error) console[level](error);
        if (context) console[level](context);
        console.groupEnd();
    }
}

function showAlertMessage(label, description, error = null) {
    alert(
        `${label}\n\n${description}` +
        (error?.message ? `\n\n${error.message}` : '')
    );
}

function showConfirmationDialog(label, description) {
    return confirm(`${label}\n\n${description}`);
}

function reportHardError(label, description, error, context = null) {
    logError('error', label, description, error, context);
    showAlertMessage(label, description, error);
}

function reportSilentError(label, description, error, context = null) {
    logError('error', label, description, error, context);
}

function reportHardWarning(label, description, error = null, context = null) {
    logError('warn', label, description, error, context);
    showAlertMessage(label, description, error);
}

function reportSilentWarning(label, description, error = null, context = null) {
    logError('warn', label, description, error, context);
}

function reportInformation(label, description, context = null) {
    logInformation('info', label, description, context);
}

function requestUserConfirmation(label, description, context = null) {
    logInformation('info', label, description, context);
    return showConfirmationDialog(label, description);
}

async function yieldToBrowser() {
    await new Promise(r => setTimeout(r, 0)); // OLD
    // if (!document.hidden) await new Promise(r => setTimeout(r, 0));
}

