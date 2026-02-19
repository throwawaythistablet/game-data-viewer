(() => {
	const csvTableElement = $("#csvTable");
	const localImagesModal = document.getElementById("localImagesModal");
	const localImagesModalTitle = document.getElementById("localImagesModalTitle");
	const localImagesModalGrid = document.getElementById("localImagesModalGrid");
	const localImagesOverlayImg = document.getElementById("localImagesOverlayImg");
	const closeImageModal = document.getElementById("closeImageModal");
	const localImagesOverlay = document.getElementById("localImagesOverlay");
	const SUPPORTED_IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];

	let scanCancelled = false;
	let activeOverlayImageUrl = null;
	let modalImageUrls = [];
	let lastFocusedElement = null;

	function openImagesForRow(rowElement) {
		if (!rowElement) return;

		if (!gamesFolderHandle) {
			GDV.utils.reportHardWarning("No Games Folder Selected", "Please select the games folder first.");
			return;
		}

		const dt = csvTableElement.DataTable();
		const rowData = dt.row(rowElement.closest("tr")).data();
		const folderPath = extractFolderPathFromRow(rowData);

		if (!folderPath) {
			GDV.utils.reportHardWarning("No Local Folder Path", "No local folder path found in this row.");
			return;
		}

		openImageModalForFolder(folderPath);
	}

	function closeImageModalHandler() {
		scanCancelled = true;
		hideImageModal();
		revokeAllModalUrls();
	}

	async function openImageModalForFolder(windowsPath) {
		const dir = await resolveDirHandleFromRelativePath(windowsPath);
		if (!dir) return;

		showImageModal();
		await scanDirectoryAndRenderImages(dir);
	}

	async function resolveDirHandleFromRelativePath(windowsPath) {
		const parts = windowsPath
			.replace(/^[A-Z]:\\/, "")
			.trim()
			.split("\\")
			.filter(Boolean);

		let dir = gamesFolderHandle;
		const gamesFolderName = dir?.name;

		const dataIndex = parts.indexOf(gamesFolderName);
		if (dataIndex === -1) {
			GDV.utils.reportHardWarning("Invalid Path", `Selected games folder "${gamesFolderName}" is not part of this path.`, null, { windowsPath, gamesFolderName });
			return null;
		}

		const relativeParts = parts.slice(dataIndex + 1);
		if (!relativeParts || relativeParts.length === 0) return null;

		try {
			for (const part of relativeParts) {
				dir = await dir.getDirectoryHandle(part);
			}
			return dir;
		} catch (err) {
			GDV.utils.reportHardError("Folder Resolution Failed", "Could not find folder using the selected games folder.", err, { windowsPath, relativeParts });
			return null;
		}
	}

	function showImageModal() {
		// Cleanup old URLs if modal is reused
		modalImageUrls.forEach((url) => URL.revokeObjectURL(url));
		modalImageUrls = [];

		// Remove all children safely
		while (localImagesModalGrid.firstChild) {
			localImagesModalGrid.removeChild(localImagesModalGrid.firstChild);
		}
		showModalAccessibility();
		localImagesModal.style.display = "flex";
	}

	function hideImageModal() {
		localImagesModal.style.display = "none";
		hideModalAccessibility();
	}

	async function scanDirectoryAndRenderImages(dir) {
		const imagesFound = [];
		scanCancelled = false;

		await scanDirectoryIncrementallyForImages(dir, (imgHandle) => {
			imagesFound.push(imgHandle);
			appendImageToModal(imgHandle);
		});

		localImagesModalTitle.textContent = `Images (${imagesFound.length})`;
	}

	// Iterative, incremental directory scan
	async function scanDirectoryIncrementallyForImages(dirHandle, onImageFound) {
		const stack = [dirHandle];

		while (stack.length) {
			if (scanCancelled) return; // STOP if modal was closed
			const currentDir = stack.pop();

			for await (const [name, handle] of currentDir.entries()) {
				if (handle.kind === "file") {
					const ext = name.split(".").pop().toLowerCase();
					if (SUPPORTED_IMAGE_EXTS.includes(ext)) {
						onImageFound(handle);
						await GDV.utils.yieldToBrowser();
					}
				} else if (handle.kind === "directory") {
					stack.push(handle);
				}
			}
		}
	}

	async function appendImageToModal(h) {
		const file = await h.getFile();
		const url = URL.createObjectURL(file);
		modalImageUrls.push(url);

		const img = document.createElement("img");
		img.src = url;

		img.onclick = () => {
			// Revoke previous overlay URL
			if (activeOverlayImageUrl) URL.revokeObjectURL(activeOverlayImageUrl);
			activeOverlayImageUrl = URL.createObjectURL(file);
			localImagesOverlayImg.src = activeOverlayImageUrl;
			localImagesOverlay.style.display = "flex";
		};

		localImagesModalGrid.appendChild(img);
	}

	function revokeAllModalUrls() {
		if (Array.isArray(modalImageUrls)) {
			modalImageUrls.forEach((url) => URL.revokeObjectURL(url));
			modalImageUrls = [];
		}

		if (activeOverlayImageUrl) {
			URL.revokeObjectURL(activeOverlayImageUrl);
			activeOverlayImageUrl = null;
		}
	}

	function extractFolderPathFromRow(rowData) {
		for (let v of Object.values(rowData)) {
			if (typeof v !== "string") continue;
			v = v.trim().replace(/^"|"$/g, "").replace(/\\\\/g, "\\");

			const hyperlinkMatch = v.match(/^=HYPERLINK\("([^"]+)",/i);
			if (hyperlinkMatch) return hyperlinkMatch[1];

			const htmlHrefMatch = v.match(/href="file:\/\/\/([^"]+)"/i);
			if (htmlHrefMatch) return htmlHrefMatch[1].replace(/\//g, "\\");

			if (/^[A-Z]:\\/.test(v)) return v;
		}
		return null;
	}

	function showModalAccessibility() {
		if (!localImagesModal) return;

		// Save last focused element
		lastFocusedElement = document.activeElement;

		// Show modal
		localImagesModal.style.display = "flex";
		localImagesModal.setAttribute("aria-hidden", "false");
		localImagesModal.setAttribute("role", "dialog");
		localImagesModal.setAttribute("aria-modal", "true");
		localImagesModal.setAttribute("aria-labelledby", "localImagesModalTitle");

		// Make sure close button has aria-label
		if (closeImageModal) closeImageModal.setAttribute("aria-label", "Close Images Modal");

		// Focus the close button
		if (closeImageModal) closeImageModal.focus();

		// Listen for keyboard events
		document.addEventListener("keydown", handleKeyDown);
	}

	function hideModalAccessibility() {
		if (!localImagesModal) return;

		// Hide modal
		localImagesModal.style.display = "none";
		localImagesModal.setAttribute("aria-hidden", "true");

		// Remove keyboard listener
		document.removeEventListener("keydown", handleKeyDown);

		// Restore focus to last focused element
		if (lastFocusedElement) lastFocusedElement.focus();
	}

	function handleKeyDown(e) {
		if (e.key === "Escape") {
			e.preventDefault();
			closeImageModalHandler();
		} else if (e.key === "Tab") {
			const focusableEls = Array.from(localImagesModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.disabled && el.offsetParent !== null);
			if (focusableEls.length === 0) return;
			const firstEl = focusableEls[0];
			const lastEl = focusableEls[focusableEls.length - 1];
			if (e.shiftKey && document.activeElement === firstEl) {
				e.preventDefault();
				lastEl.focus();
			} else if (!e.shiftKey && document.activeElement === lastEl) {
				e.preventDefault();
				firstEl.focus();
			}
		}
	}

	// View images
	csvTableElement.on("click", ".view-images", function () {
		openImagesForRow(this);
	});

	// Close handlers
	closeImageModal.onclick = () => closeImageModalHandler();
	localImagesOverlay.onclick = () => (localImagesOverlay.style.display = "none");

	// Escape button
	localImagesOverlay.addEventListener("keydown", (e) => {
		if (e.key === "Escape") localImagesOverlay.style.display = "none";
	});

	localImagesOverlay.setAttribute("tabindex", "-1");
})();
