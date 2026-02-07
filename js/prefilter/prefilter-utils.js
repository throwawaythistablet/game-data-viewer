(function() {

GDV.prefilter.getPrefilterDisplayText = function(col, val) {
    if (!val) return '';
    if (val.type === 'tag' || Array.isArray(val.choices)) {
        return `${col}: ${val.choices?.join(', ') || val.text?.join(', ')}`;
    } else if (val.type === 'int' || val.type === 'float') {
        const minMax = [];
        if (val.min != null) minMax.push(`min=${val.min}`);
        if (val.max != null) minMax.push(`max=${val.max}`);
        return `${col}: ${minMax.join(', ')}`;
    } else if (val.text) {
        return `${col}: ${val.text.join(', ')}`;
    }
    return '';
}

GDV.prefilter.getPrefilterDisplayType = function(val) {
    if (!val) return '';
    if (val.type === 'tag' || Array.isArray(val.choices)) return 'checkbox';
    if (val.type === 'int' || val.type === 'float') return 'range';
    if (val.text) return 'text';
    return '';
}

})();
