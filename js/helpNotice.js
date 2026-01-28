(function() {

GDV.helpNotice.createHelpNotice = function() {
    const notice = document.createElement('div');
    notice.className = 'help-notice is-collapsed';
    
    // Wrap body + toggle text
    notice.innerHTML = `
        <div class="help-notice-body">
            ${getHelpNoticeContent()}
        </div>
        <div class="help-notice-toggle-text">Show More ▼</div>
    `;
    
    bindHelpNoticeToggle(notice);
    return notice;
}

function getHelpNoticeContent() {
    return `
        <div class="help-notice-body">
            <strong>📚 Guide to Prefilters, Search, and Table Navigation</strong>
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
                    ✅ <strong>Use Prefilters</strong> – Apply checkboxes, ranges, or text inputs to narrow the dataset.
                    Combine tags for precise results (e.g., <em>female protagonist</em> + <em>2D CG</em>).
                </li>
                <li>
                    ⏳ <strong>Load Table</strong> – Click <em>Apply Prefilters &amp; Search</em> to load only the filtered rows.
                    A warning appears if no prefilters are selected.
                </li>
                <li>
                    🔧 <strong>Sort, Refine, &amp; Reset the Table</strong> – Once the table is loaded:
                    <ul>
                        <li>↕️ <strong>Sort the Table</strong> – Click column headers to sort by Bayesian score, game time, or other attributes.</li>
                        <li>🔎 <strong>Refine Column Filters</strong> – Hover over column headers to access column-specific filters.
                            Start broad, then refine step by step for smooth browsing.</li>
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
                <li>
                The dataset is large, and all processing happens client-side in your browser.
                Without prefilters, loading can be slow and memory-intensive.
                </li>
                <li>⏳ You’ll see a “Loading Data…” overlay while it loads.</li>
                <li>✅ Using prefilters ensures a faster, smoother experience when exploring the table.</li>
            </ul>

            <hr style="margin: 12px 0;">

            🏷️ <strong>About Tags & How They Work</strong><br>
            <div style="padding-left: 20px;margin-top: 8px;">
                Tags in this tool are <strong>generated automatically</strong>, not assigned manually.<br>
                Each tag is based on <strong>text pattern matching (regex)</strong> applied to:
                <ul>
                    <li>📖 The game’s description</li>
                    <li>💬 User reviews</li>
                </ul>
                If certain keywords or patterns are found, the tag is added to the game.<br>
                Because this is a <strong>text-based system</strong>, it isn’t perfect:
                <ul>
                    <li>⚠ Some tags may appear due to <strong>metaphorical or contextual language</strong></li>
                    <li>❌ This can result in false positives or occasionally missed matches</li>
                    <li>🛠️ Tag accuracy depends heavily on how well the underlying patterns are defined</li>
                </ul>
                
                You can view the full tag patterns by clicking the <em>Tag Patterns</em> button.
            </div>

            <hr style="margin: 12px 0;">

            💡 <strong>Feedback Welcome</strong><br>
            <div style="padding-left: 20px;margin-top: 8px;">
                I’m actively refining the tag patterns. If you notice tags that consistently misfire, seem too broad, or miss obvious cases, your feedback is extremely helpful.
            </div>
        </div>
    `;
}

function bindHelpNoticeToggle(notice) {
    notice.style.cursor = 'pointer'; // user sees it’s clickable

    const toggleText = notice.querySelector('.help-notice-toggle-text');

    function toggleNotice() {
        const expanded = notice.classList.toggle('is-expanded');
        notice.classList.toggle('is-collapsed', !expanded);

        // Update toggle text
        toggleText.textContent = expanded ? 'Show Less ▲' : 'Show More ▼';
    }

    notice.addEventListener('click', toggleNotice);

    // Initial state
    notice.classList.add('is-collapsed');
}

})();