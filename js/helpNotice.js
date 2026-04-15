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
            <strong>📚 Help: Guide to Finding Games, Using Prefilters, and Table Navigation</strong>
            <ol style="margin-top: 8px;">
                <li>
                🔍 <strong>Open Prefilters Panel</strong> – Click the <em>Find Games</em> button to see all available prefilters. (It may already be open by default.)
                </li>
                <li>
                🧩 <strong>Select Prefilters</strong> – Choose prefilters to narrow your search before the table loads, saving time and memory.
                Use the glowing search box to quickly locate specific prefilter sections.
                </li>
                <li>
                ✅ <strong>Use Prefilters</strong> – Apply checkboxes, ranges, or text inputs to reduce the dataset before loading.
                Combine tags for more precise results (for example: <em>site: female protagonist</em> + <em>text search: 2D CG</em>).
                </li>
                <li> 
                ⚙️ <strong>Expression Builder</strong> – Prefilters form a connected logical expression instead of isolated items.
                    <br>
                    When you add an item, it becomes part of a single expression that determines what data is shown. Each item contributes to the expression and can be adjusted in how it relates to other items.
                    <br>
                    Each item has controls that define how it behaves within the expression:
                    <ul>
                    <li><strong>Remove</strong> – Removes the selected item from the expression</li>
                    <li><strong>NOT</strong> – Inverts the selected item (excludes matches instead of including them)</li>
                    <li><strong>AND</strong> – Requires the selected item to be grouped together with others</li>
                    <li><strong>OR</strong> – Allows alternative matching within the same expression branch</li>
                    <li><strong>Group In</strong> – Moves the selected item into a subexpression</li>
                    <li><strong>Group Out</strong> – Moves the selected item out of its current subexpression</li>
                    </ul>
                    The system automatically maintains the structure of the full expression as items are modified, so you only need to focus on how each item relates within the expression.
                    <br>
                    <strong>📋 Expression Tools (Copy / Paste / Fix)</strong>
                    <ul>
                        <li><strong>Copy Prefilters</strong> – Copies your full filter setup (conditions + expression structure) to clipboard</li>
                        <li><strong>Paste Prefilters</strong> – Restores a saved setup from clipboard (invalid or outdated setups will be rejected)</li>
                        <li><strong>Fix Expression</strong> – Cleans up messy or broken logic without changing what your filters mean</li>
                    </ul>
                    These tools let you save, reuse, and repair complex filter setups without rebuilding them manually.
                </li>
                <li> 
                ⏳ <strong>Generate Table</strong> – Click <em>Generate Table</em> to create a new table using your selected prefilters.
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
                🔍 <strong>Find Games Again</strong> – Click <em>Find Games</em> to adjust prefilters or load a new set of results.
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
                <li>✍️  Author-provided genre/description</li>
                <li>💬 User reviews</li>
                <li>📝 Forum recommendation threads</li>
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
                <li>⚠ Some tags may be triggered by out-of-context or metaphorical mentions in reviews.</li>
                <li>❌ You may see occasional false positives (irrelevant matches) or false negatives (missed cases).</li>
                <li>🛠️ Tag accuracy depends on the underlying text-matching patterns (regex), which are continuously refined for better results.</li>
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
