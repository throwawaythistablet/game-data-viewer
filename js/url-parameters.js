
(function() {

GDV.urlParameters.getDataFromUrlParameters = getDataFromUrlParameters;
function getDataFromUrlParameters() {
    const params = parseQueryString();
    return {
        prefilters: extractPrefilters(params),
        similarityGame: extractSimilarityGame(params)
    };
}

GDV.urlParameters.encodeDataAsUrlParameters = encodeDataAsUrlParameters;
function encodeDataAsUrlParameters(prefilters, similarityGame) {
    const parts = [];
    const pfPart = encodePrefilters(prefilters);
    if (pfPart) {
        parts.push(pfPart);
    }
    const sgPart = encodeSimilarityGame(similarityGame);
    if (sgPart) {
        parts.push(sgPart);
    }
    return parts.join("&");
}

function extractPrefilters(params) {
    let pfObj = null;
    if (params.pf) {
        pfObj = decodeBase64UrlJson(params.pf);
        if (!pfObj) {
            GDV.utils.reportSilentWarning("Invalid URL Prefilter Parameter", "The URL contained an invalid 'pf' parameter and it will be ignored.");
        }
    }
    const humanPrefilters = parseHumanReadable(params);
    pfObj = mergePrefilters(pfObj, humanPrefilters);
    if (pfObj && !validatePrefilters(pfObj)){
        GDV.utils.reportSilentWarning("Prefilter Validation Failed", "The prefilters extracted from the URL did not pass validation and will be ignored.");
        return null;
    }
    return pfObj || null;
}

function extractSimilarityGame(params) {
    let sgObj = null;
    if (params.sg) {
        sgObj = decodeBase64UrlJson(params.sg);
        if (sgObj === null) {
            GDV.utils.reportSilentWarning("Invalid URL Similarity Game Parameter", "The URL contained an invalid 'sg' parameter and it will be ignored.");
        }
    }
    return normalizeSimilarityGame(sgObj);
}

function encodePrefilters(prefilters) {
    if (!prefilters || typeof prefilters !== "object" || Object.keys(prefilters).length === 0) {
        return null;
    }
    const encoded = encodeJsonToBase64Url(prefilters);
    if (!encoded) return null;
    return "pf=" + encoded;
}

function encodeSimilarityGame(similarityGame) {
    const normalized = normalizeSimilarityGame(similarityGame);
    if (!normalized) return null;
    const encoded = encodeJsonToBase64Url(normalized);
    if (!encoded) return null;
    return "sg=" + encoded;
}

function parseQueryString() {
    const params = {};
    const search = window.location.search.substring(1);
    if (!search) return params;
    search.split("&").forEach(pair => {
        const [rawKey, ...rest] = pair.split("=");
        const key = decodeURIComponent(rawKey);
        const value = decodeURIComponent(rest.join("="));
        if (key) {
            params[key] = value || "";
        }
    });
    return params;
}

function decodeBase64UrlJson(str) {
    try {
        str = str.replace(/-/g, "+").replace(/_/g, "/");
        while (str.length % 4) str += "=";
        const binary = atob(str);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const decodedStr = new TextDecoder().decode(bytes);
        const obj = JSON.parse(decodedStr);
        return obj;
    } catch (e) {
        GDV.utils.reportSilentWarning("URL Parameter Decoding Failed", "An error occurred while decoding base64url JSON prefilters from the URL.", e);
        return null;
    }
}

function encodeJsonToBase64Url(value) {
    try {
        const jsonStr = JSON.stringify(value);
        const utf8Bytes = new TextEncoder().encode(jsonStr);
        let b64 = btoa(String.fromCharCode(...utf8Bytes));
        return b64
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    } catch (e) {
        GDV.utils.reportSilentWarning("URL Parameter Encoding Failed", "An error occurred while encoding data for URL parameters.", e);
        return null;
    }
}

function parseHumanReadable(params) {
    const prefilters = {};

    Object.keys(params).forEach(key => {
        if (!key.startsWith("pf_")) return;
        const colName = key.substring(3); // remove pf_
        const val = params[key];

        const colDef = GDV.state.getActiveColumnDetails()[colName];
        if (!colDef) {
            GDV.utils.reportSilentWarning("Unknown Column in URL Prefilters", `The column '${colName}' in the URL prefilters is unknown and will be ignored.`);
            return;
        }

        switch (colDef.type) {
            case "float":
            case "int": {
                // Range parsing: "min-max" or "-max" or "min-"
                const [minStr, maxStr] = val.split("-");
                const min = minStr !== "" ? parseFloat(minStr) : null;
                const max = maxStr !== "" ? parseFloat(maxStr) : null;

                // Ensure min <= max if both exist
                if (min !== null && max !== null && min > max) {
                    GDV.utils.reportSilentWarning( "Prefilter Range Correction", `For column '${colName}', min value was greater than max. Values have been swapped.`);
                    prefilters[colName] = { type: colDef.type, min: max, max: min };
                } else {
                    prefilters[colName] = { type: colDef.type, min, max };
                }
                break;
            }

            case "str": {
                // Comma-separated choices
                const choices = val.split(",").map(s => s.trim()).filter(Boolean);

                // Optional: validate against allowed choices
                const validChoices = colDef.choices.length
                    ? choices.filter(c => colDef.choices.includes(c))
                    : choices;

                prefilters[colName] = { type: "str", choices: validChoices };
                break;
            }

            case "tag": {
                // Numeric tag values
                const tags = val.split(",").map(Number).filter(n => !isNaN(n));

                // Optional: validate against min/max
                const validTags = tags.filter(n => n >= colDef.min && n <= colDef.max);

                prefilters[colName] = { type: "tag", choices: validTags };
                break;
            }

            case "bool": {
                // Accept "true"/"1" as true, "false"/"0" as false
                const boolVals = val.split(",").map(v => {
                    v = v.toLowerCase();
                    return v === "true" || v === "1" ? true : v === "false" || v === "0" ? false : null;
                }).filter(v => v !== null);

                prefilters[colName] = { type: "bool", choices: boolVals };
                break;
            }

            default: {
                // Treat as free text (multiple tokens allowed)
                const tokens = val.split(",").map(s => s.trim()).filter(Boolean);
                if (tokens.length) prefilters[colName] = { text: tokens };
                break;
            }
        }
    });

    return prefilters;
}

function mergePrefilters(base, override) {
    if (!base) return override || {};
    if (!override) return base;
    return { ...base, ...override };
}

function validatePrefilters(prefilters) {
    if (!prefilters || typeof prefilters !== "object") return false;

    for (const col in prefilters) {
        const val = prefilters[col];
        const colDef = GDV.state.getActiveColumnDetails()[col];

        if (!colDef) {
            GDV.utils.reportSilentWarning("Unknown Column During Validation", `Cannot validate unknown column '${col}'.`);
            continue; // skip unknown columns
        }

        switch (colDef.type) {
            case "float":
            case "int": {
                if ((val.min !== null && typeof val.min !== "number") ||
                    (val.max !== null && typeof val.max !== "number")) {
                    GDV.utils.reportSilentWarning("Invalid Range Values", `The prefilter for column '${col}' has invalid range values.`);
                    return false;
                }
                // Optional: check against column min/max
                if (colDef.min !== undefined && val.min !== null && val.min < colDef.min) {
                    GDV.utils.reportSilentWarning("Prefilter Minimum Below Allowed", `The minimum value for column '${col}' is below the allowed range.`);
                    return false;
                }
                if (colDef.max !== undefined && val.max !== null && val.max > colDef.max) {
                    GDV.utils.reportSilentWarning("Prefilter Maximum Above Allowed", `The maximum value for column '${col}' is above the allowed range.`);
                    return false;
                }
                break;
            }

            case "str": {
                if (!Array.isArray(val.choices)) {
                    GDV.utils.reportSilentWarning( "Invalid Choices Array", `The prefilter for column '${col}' contains an invalid choices array.`);
                    return false;
                }
                // Optional: ensure all choices exist in columnDef.choices
                if (colDef.choices.length && !val.choices.every(c => colDef.choices.includes(c))) {
                    GDV.utils.reportSilentWarning("Invalid String Choices", `Some string choices for column '${col}' are invalid and will be ignored.`);
                    return false;
                }
                break;
            }

            case "tag": {
                if (!Array.isArray(val.choices)) {
                    GDV.utils.reportSilentWarning("Invalid Tag Choices Array", `The prefilter for column '${col}' contains an invalid tag choices array.`);
                    return false;
                }
                // Optional: check tags against min/max
                if (colDef.min !== undefined && colDef.max !== undefined) {
                    if (!val.choices.every(n => typeof n === "number" && n >= colDef.min && n <= colDef.max)) {
                        GDV.utils.reportSilentWarning("Tag Choices Out of Bounds", `Some tag choices for column '${col}' are outside the allowed range and will be ignored.`);
                        return false;
                    }
                }
                break;
            }

            case "bool": {
                if (!Array.isArray(val.choices)) {
                    GDV.utils.reportSilentWarning("Invalid Boolean Choices Array", `The prefilter for column '${col}' contains an invalid boolean choices array.`);
                    return false;
                }
                if (!val.choices.every(b => b === true || b === false)) {
                    GDV.utils.reportSilentWarning("Invalid Boolean Value", `One or more boolean values for column '${col}' are invalid.`);
                    return false;
                }
                break;
            }

            default: {
                // text tokens
                if (!Array.isArray(val.text)) {
                    GDV.utils.reportSilentWarning("Invalid Text Tokens", `The prefilter for column '${col}' contains invalid text tokens.`);
                    return false;
                }
                break;
            }
        }
    }

    return true;
}

function normalizeSimilarityGame(similarityGame) {
    if (similarityGame == null) {
        return null;
    }
    if (typeof similarityGame !== "string") {
        GDV.utils.reportSilentWarning("Similarity Game Parameter Ignored", "The similarity game given is not a string and was ignored.");
        return null;
    }
    const normalized = similarityGame.trim();
    if (normalized.length === 0) {
        return null;
    }

    const MAX_LENGTH = 200;
    if (normalized.length > MAX_LENGTH) {
        GDV.utils.reportSilentWarning("Similarity Game Parameter Ignored", "The similarity game string was too long and was ignored.");
        return null;
    }
    return normalized;
}


})();
