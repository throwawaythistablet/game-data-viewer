(() => {
    GDV.helpNotice.createHelpNotice = () => {
        const notice = document.createElement("div");
        notice.className = "help-notice";

        // Insert the help content and expand/collapse control.
        notice.innerHTML = `
            ${getHelpNoticeContent()}
            <div class="help-notice-toggle-text">Show Help ▼</div>
        `;

        // Initialize the notice's initial state.
        initializeHelpNotice(notice);

        // Attach the expand/collapse event listener.
        bindHelpNoticeToggle(notice);

        return notice;
    };

    function initializeHelpNotice(notice) {
        // Start collapsed, with the help content unavailable for interaction.
        updateHelpNoticeState(notice, false);
    }

    function bindHelpNoticeToggle(notice) {
        // Register the handler responsible for expanding and collapsing the notice.
        notice.addEventListener("click", handleHelpNoticeToggle);
    }

    function handleHelpNoticeToggle(event) {
        const notice = event.currentTarget;
        const isExpanded = notice.classList.contains("is-expanded");

        // Toggle the notice's current state.
        updateHelpNoticeState(notice, !isExpanded);
    }

    function updateHelpNoticeState(notice, isExpanded) {
        const body = notice.querySelector(".help-notice-body");
        const toggleText = notice.querySelector(".help-notice-toggle-text");
        if (!body || !toggleText) {
            return;
        }

        // Update the visual state.
        notice.classList.toggle("is-expanded", isExpanded);
        notice.classList.toggle("is-collapsed", !isExpanded);

        // Disable interaction with hidden content while collapsed.
        body.inert = !isExpanded;

        // Update the toggle label.
        toggleText.textContent = isExpanded ? "Hide Help ▲" : "Show Help ▼";

        // Return the collapsed preview to the beginning of the content.
        if (!isExpanded) {
            body.scrollTop = 0;
        }
    }

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
                Use the glowing search box to quickly locate specific prefilter sections. Prefilters are also grouped into categories such as <em>Game Info, Art &amp; Visual Style, Content, Features, Genres,</em> and others, so you can browse by category instead of searching by name.
            </li>

            <li>
                ✅ <strong>Use Prefilters</strong> – Apply checkboxes, ranges, or text inputs to reduce the dataset before loading.
                Combine tags for more precise results (for example: <em>site: female protagonist</em> + <em>text search: 2D CG</em>).
                <br>
                The <strong>eye button</strong> on prefilter cards lets you display a detail in the results table without using it as a filter. This means you can choose what information appears in the table independently of the conditions that determine which games appear in your results.
            </li>

            <li>
                ⚙️ <strong>Expression Builder</strong> – Prefilters form a connected logical expression instead of isolated items.
                <br>
                When you add an item, it becomes part of a single expression that determines what data is shown. Each item contributes to the expression and can be adjusted in how it relates to other items.
                <br>
                Each item has controls that define how it behaves within the expression:
                <ul>
                    <li><strong>Remove</strong> – Removes the selected item from the expression.</li>
                    <li><strong>NOT</strong> – Inverts the selected item (excludes matches instead of including them).</li>
                    <li><strong>AND</strong> – Requires the selected item to be grouped together with others.</li>
                    <li><strong>OR</strong> – Allows alternative matching within the same expression branch.</li>
                    <li><strong>Group In</strong> – Moves the selected item into a subexpression.</li>
                    <li><strong>Group Out</strong> – Moves the selected item out of its current subexpression.</li>
                </ul>
                The system automatically maintains the structure of the full expression as items are modified, so you only need to focus on how each item relates within the expression.
                <br>
                <strong>📋 Expression Tools (Copy / Paste / Fix)</strong>
                <ul>
                    <li><strong>Copy Prefilters</strong> – Copies your full filter setup (conditions + expression structure) to the clipboard.</li>
                    <li><strong>Paste Prefilters</strong> – Restores a saved setup from the clipboard (invalid or outdated setups will be rejected).</li>
                    <li><strong>Fix Expression</strong> – Cleans up messy or broken logic without changing what your filters mean.</li>
                </ul>
                These tools let you save, reuse, and repair complex filter setups without rebuilding them manually.
            </li>

            <li>
                🧱 <strong>Customize Search Results Columns</strong> – Choose exactly which columns appear in the results table and arrange them in your preferred order. Put the information you care about first and hide columns you don't need.
                <ul>
                    <li><strong>Drag columns</strong> to reorder them.</li>
                    <li>Use the keyboard's <strong>Left/Right arrow keys</strong> to change their order.</li>
                    <li>Click the <strong>on-screen arrow buttons</strong> to move columns.</li>
                </ul>
                You can configure the displayed columns independently of your prefilter conditions. Changing which details appear in the table does not change which games match your search.
            </li>

            <li>
                🎮 <strong>Find Similar Games</strong> – You can configure a similarity search before generating the table by entering a reference game in the <strong>Similarity</strong> field in the Prefilters panel.
                <br>
                The table will include a similarity score column, allowing you to sort games by how closely they resemble your chosen reference game.
                <br>
                🎯 <strong>Category-Based Similarity</strong> – Choose which categories influence the comparison, such as <em>art, gameplay, scenarios,</em> or <em>themes</em>. For example, if you're mainly interested in similar gameplay, you can prioritize that category without letting differences in story or themes influence the comparison as much. This makes it easier to find games that resemble your reference title in the ways that matter most to you.
                <br>
                You can also start a similarity search from an existing table by using the <strong>Similarity</strong> field in the thumbnail column header or clicking <strong>Find Similar Games</strong> on a game's thumbnail.
            </li>

            <li>
                ⏳ <strong>Generate Table</strong> – Once you've configured your prefilters, displayed columns, and any similarity settings, click <em>Generate Table</em> to create the table.
                A warning appears if no prefilters are selected.
                <br>
                The table uses game data prefetched from the site, collected at a specific point in time, so it may not reflect the latest updates.
            </li>

            <li>
                🔧 <strong>Sort, Refine, &amp; Reset the Table</strong> – Once the table is loaded:
                <ul>
                    <li>↕️ <strong>Sort the Table</strong> – Click column headers to sort by Bayesian score, play time, similarity score, sentiment, or other available attributes.</li>
                    <li>🔎 <strong>Refine Column Filters</strong> – Hover over column headers to access column-specific filters. Start broad, then refine step by step for smoother browsing. You can also search for specific games or attributes.</li>
                    <li>☑️ <strong>Quick Filtering</strong> – Some columns have checkboxes for quick filtering (e.g., adult content, visual novel, engine, etc.).</li>
                    <li>🔄 <strong>Reset Column Filters</strong> – Use the <em>Reset Column Filters</em> button to restore the table's column filters to their default state.</li>
                </ul>
            </li>

            <li>
                ⭐ <strong>Bayesian Score</strong> – Ratings are normalized using a Bayesian average, so games with very few reviews don't appear artificially high or low.
            </li>

            <li>
                ⏱️ <strong>Play Time Hours</strong> – The tool estimates playtime by extracting time-related information from reviews, with basic outlier filtering, to estimate how long a game takes to complete.
            </li>

            <li>
                💬 <strong>Sentiment Data</strong> – The tool includes sentiment analysis based on reviews for:
                <ul>
                    <li>Overall sentiment</li>
                    <li>Art / visuals sentiment</li>
                    <li>Story / writing sentiment</li>
                    <li>Content / themes sentiment</li>
                    <li>Gameplay sentiment</li>
                </ul>
                You can sort and filter these values to see which aspects reviewers feel positively or negatively about.
            </li>

            <li>
                🔍 <strong>Find Games Again</strong> – Click <em>Find Games</em> to adjust your prefilters or load a new set of results.
            </li>

            <li>
                💬 <strong>Provide Feedback</strong> – Click the <em>Feedback</em> button to suggest new tags, report issues, or give general feedback.
            </li>

            <li>
                🌗 <strong>Toggle Light / Dark Theme</strong> – Use the button at the top of the page to switch between light and dark themes.
            </li>
        </ol>

        <hr style="margin: 12px 0;">

        ⚠️ <strong>Important: Use Prefilters to Reduce Load</strong><br>
        <ul style="margin-top: 8px;">
            <li>The dataset is large and all processing happens client-side in your browser. Without prefilters, loading can be slow and memory-intensive.</li>
            <li>⏳ You’ll see a “Loading Data...” overlay while it loads.</li>
            <li>✅ Using prefilters can help make the experience faster and smoother when exploring the table.</li>
            <li>🔄 If loading takes too long, try using prefilters to limit the data, or refresh the page to retry.</li>
        </ul>

        <hr style="margin: 12px 0;">

        🏷️ <strong>About Tags &amp; How They Work</strong><br>
        <div style="padding-left: 20px; margin-top: 8px;">
            Tags are <strong>automatically generated</strong> from text and metadata — they are not manually assigned by the tool.
            The tool uses pattern matching (regex) to detect tags across:
            <ul>
                <li>📖 Game descriptions</li>
                <li>✍️ Author descriptions</li>
                <li>🌐 Official site information</li>
                <li>🗂️ VNDB information</li>
                <li>💬 User reviews</li>
                <li>📝 Forum recommendation threads</li>
            </ul>

            <strong>Tag types (visible as prefixes)</strong>
            <ul>
                <li><code>site:</code> — Tags automatically assigned by the official site.</li>
                <li><code>assigned:</code> — Tags automatically assigned from author descriptions, site tags, and VNDB tags.</li>
                <li><code>text search:</code> — Tags automatically detected by regex/text scanning of descriptions and reviews.</li>
                <li><code>forum recommendation:</code> — Tags automatically detected from forum recommendation threads.</li>
            </ul>

            <p>
                <strong>Improved tag detection:</strong>
                The tool now has a more comprehensive system for detecting tags across descriptions, metadata, reviews, and forum recommendations. It uses pattern matching and regex rules to recognize different expressions for the same concept. For example, the <code>female protagonist</code> tag can match terms like <code>FMC</code>, <code>FEMC</code>, or other combinations in the text.
            </p>

            <p>
                <strong>How to use tag types:</strong>
                You can combine broader tags (<code>text search:</code> / <code>forum recommendation:</code>) that may include some false positives with stricter tags (<code>site:</code> / <code>assigned:</code>) to refine results more reliably.
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

            <p>
                <strong>Tag Patterns</strong><br>
                You can view full tag patterns and their rules by clicking the <em>Tag Patterns</em> button. You can also view them here:
                <a href="https://throwawaythistablet.github.io/game-data-viewer/tags/tag_patterns.txt" target="_blank" rel="noopener noreferrer">Tag Patterns</a>.
                Examples include patterns for terms such as <code>ai cg</code>, <code>ai shoujo</code>, and <code>ai slop</code>.
            </p>
        </div>

        <hr style="margin: 12px 0;">

        💡 <strong>Feedback &amp; Troubleshooting</strong><br>
        <div style="padding-left: 20px; margin-top: 8px;">
            If a tag consistently misfires or seems too broad, please report it via the <em>Feedback</em> button. Including the <strong>Copy Shareable URL</strong> (above the table) helps a lot, as it shows your exact filters and makes reproducing the issue quick.
        </div>
    </div>
    `;
    }

})();
