(() => {
	GDV.helpNotice.createHelpNotice = () => {
		const notice = document.createElement("div");
		notice.className = "help-notice is-collapsed";

		// Wrap body + toggle text
		notice.innerHTML = `
        ${getHelpNoticeContent()}
        <div class="help-notice-toggle-text">Show Help ▼</div>
    `;

		bindHelpNoticeToggle(notice);
		return notice;
	};

	function getHelpNoticeContent() {
		return `
            <div class="help-notice-body">
            <strong>📚 Help: Guide to Prefilters, Search, and Table Navigation</strong>
            <ol style="margin-top: 8px;">
                <li>
                🔍 <strong>Open Prefilter Overlay</strong> – Click the <em>Search</em> button to see all available prefilters.
                (This is shown by default, so clicking the button isn’t always necessary.)
                </li>
                <li>
                🧩 <strong>Search Prefilters</strong> – Choose prefilters to narrow your search before the table loads, saving time and memory.
                Use the glowing search box to quickly locate specific prefilter sections.
                </li>
                <li>
                ✅ <strong>Use Prefilters</strong> – Apply checkboxes, ranges, or text inputs to reduce the dataset before loading.
                Combine tags for more precise results (for example: <em>site: female protagonist</em> + <em>text search: 2D CG</em>).
                </li>
                <li>
                ⏳ <strong>Load Table</strong> – Click <em>Apply Prefilters &amp; Search</em> to load only the filtered rows.
                A warning appears if no prefilters are selected.
                </li>
                <li>
                🔧 <strong>Sort, Refine, &amp; Reset the Table</strong> – Once the table is loaded:
                <ul>
                    <li>↕️ <strong>Sort the Table</strong> – Click column headers to sort by Bayesian score, play time, or other attributes.</li>
                    <li>🔎 <strong>Refine Column Filters</strong> – Hover over column headers to access column-specific filters. Start broad, then refine step by step for smoother browsing.</li>
                    <li>🔄 <strong>Reset Column Filters</strong> – Use the <em>Reset Column Filters</em> button to restore the table to its default state.</li>
                </ul>
                </li>
                <li>
                💬 <strong>Provide Feedback</strong> – Click the <em>Feedback</em> button to suggest new tags, report issues, or give general feedback.
                </li>
                <li>
                🔍 <strong>New Search</strong> – Use the <em>Search</em> button to adjust prefilters or start a new search.
                </li>
            </ol>

            <hr style="margin: 12px 0;">

            ⚠️ <strong>Important: Use Prefilters to Reduce Load</strong><br>
            <ul style="margin-top: 8px;">
                <li>The dataset is large and all processing happens client-side in your browser. Without prefilters, loading can be slow and memory-intensive.</li>
                <li>⏳ You’ll see a “Loading Data…” overlay while it loads.</li>
                <li>✅ Using prefilters ensures a faster, smoother experience when exploring the table.</li>
            </ul>

            <hr style="margin: 12px 0;">

            🏷️ <strong>About Tags & How They Work</strong><br>
            <div style="padding-left: 20px; margin-top: 8px;">
                Tags are <strong>automatically generated</strong> from text and metadata — they are not manually assigned.<br>
                Tags are assigned using pattern matching (regex) applied to:
                <ul>
                <li>📖 Game descriptions</li>
                <li>💬 User reviews</li>
                <li>📝 Forum recommendation threads</li>
                <li>✍️ The author's genre/description where available</li>
                </ul>

                <strong>Tag types (visible as prefixes)</strong>
                <ul>
                <li><code>site:</code> — Tag assigned by the official site.</li>
                <li><code>author:</code> — Detected in the author's genre/description.</li>
                <li><code>text search:</code> — Detected by regex/text scanning of descriptions and reviews.</li>
                <li><code>forum recommendation:</code> — Detected from forum recommendation threads.</li>
                </ul>

                <p>
                <strong>How to use tag types:</strong>
                You can combine broader tags (<code>text search:</code> / <code>forum recommendation:</code>) that may include some false positives with stricter tags (<code>site:</code> / <code>author:</code>) to refine results more reliably.
                For example, using <code>text search: exhibitionism</code> plus <code>site: female protagonist</code> often narrows results to relevant entries while reducing accidental matches.
                </p>

                <p>
                Because tags are text-based, they are not perfect:
                </p>
                <ul>
                <li>⚠ Some tags may trigger from metaphorical or out-of-context mentions in reviews.</li>
                <li>❌ You may see occasional false positives (irrelevant matches) or false negatives (missed cases).</li>
                <li>🛠️ Tag accuracy depends on the pattern definitions — these are actively refined.</li>
                </ul>

                <p>You can view full tag patterns by clicking the <em>Tag Patterns</em> button.</p>
            </div>

            <hr style="margin: 12px 0;">

            💡 <strong>Feedback & Troubleshooting</strong><br>
            <div style="padding-left: 20px; margin-top: 8px;">
                If a tag consistently misfires or seems too broad, please report it via the <em>Feedback</em> button. Including the <strong>Copy Shareable URL</strong> (above the table) helps a lot, it shows your exact filters and makes reproducing the issue quick.
            </div>
            </div>
    `;
	}

	function bindHelpNoticeToggle(notice) {
		notice.style.cursor = "pointer"; // user sees it’s clickable

		const toggleText = notice.querySelector(".help-notice-toggle-text");

		function toggleNotice() {
			const expanded = notice.classList.toggle("is-expanded");
			notice.classList.toggle("is-collapsed", !expanded);

			// Update toggle text
			toggleText.textContent = expanded ? "Hide Help ▲" : "Show Help ▼";
		}

		notice.addEventListener("click", toggleNotice);

		// Initial state
		notice.classList.add("is-collapsed");
	}
})();
