(() => {
	GDV.prefilter.getPrefilterDisplayText = (column, value) => {
		if (!value) return "";
		if (value.type === "tag" || Array.isArray(value.choices)) {
			return `${column}: ${value.choices?.join(", ") || value.text?.join(", ")}`;
		} else if (value.type === "int" || value.type === "float") {
			const minMax = [];
			if (value.min != null) minMax.push(`min=${value.min}`);
			if (value.max != null) minMax.push(`max=${value.max}`);
			return `${column}: ${minMax.join(", ")}`;
		} else if (value.text) {
			return `${column}: ${value.text.join(", ")}`;
		}
		return "";
	};

	GDV.prefilter.getPrefilterDisplayType = (value) => {
		if (!value) return "";
		if (value.type === "tag" || Array.isArray(value.choices)) return "checkbox";
		if (value.type === "int" || value.type === "float") return "range";
		if (value.text) return "text";
		return "";
	};
})();
