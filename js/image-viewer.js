
function openImagesForRow(rowElement) {
    if (!rowElement) return;

    if (!gamesFolderHandle) {
        reportHardWarning('No Games Folder Selected', 'Please select the games folder first.');
        return;
    }

    const dt = csvTableElement.DataTable();
    const rowData = dt.row($(rowElement).closest('tr')).data();
    const folderPath = extractFolderPathFromRow(rowData);

    if (!folderPath) {
        reportHardWarning('No Local Folder Path', 'No local folder path found in this row.');
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
    const parts = windowsPath.replace(/^[A-Z]:\\/, '').trim().split('\\').filter(Boolean);

    let dir = gamesFolderHandle;
    const gamesFolderName = dir?.name;

    const dataIndex = parts.indexOf(gamesFolderName);
    if (dataIndex === -1) {
        reportHardWarning('Invalid Path', `Selected games folder "${gamesFolderName}" is not part of this path.`, null, { windowsPath, gamesFolderName });
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
        reportHardError('Folder Resolution Failed', 'Could not find folder using the selected games folder.', err, { windowsPath, relativeParts });
        return null;
    }
}

function showImageModal() {
    const grid = document.getElementById('imageModalGrid');

    // Cleanup old URLs if modal is reused
    modalImageUrls.forEach(url => URL.revokeObjectURL(url));
    modalImageUrls = [];

    // Clear DOM
    grid.innerHTML = '';

    document.getElementById('imageModal').style.display = 'flex';
}

function hideImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) modal.style.display = 'none';
}

async function scanDirectoryAndRenderImages(dir) {
    const imagesFound = [];
    scanCancelled = false;

    await scanDirectoryIncrementallyForImages(dir, imgHandle => {
        imagesFound.push(imgHandle);
        appendImageToModal(imgHandle);
    });

    document.getElementById('imageModalTitle').textContent = `Images (${imagesFound.length})`;
}

// Iterative, incremental directory scan
async function scanDirectoryIncrementallyForImages(dirHandle, onImageFound) {
    const stack = [dirHandle];

    while (stack.length) {
        if (scanCancelled) return; // STOP if modal was closed
        const currentDir = stack.pop();

        for await (const [name, handle] of currentDir.entries()) {
            if (handle.kind === 'file') {
                const ext = name.split('.').pop().toLowerCase();
                if (SUPPORTED_IMAGE_EXTS.includes(ext)) {
                    onImageFound(handle);
                    await yieldToBrowser();
                }
            } else if (handle.kind === 'directory') {
                stack.push(handle);
            }
        }
    }
}

async function appendImageToModal(h) {
    const grid = document.getElementById('imageModalGrid');
    const file = await h.getFile();
    const url = URL.createObjectURL(file);
    modalImageUrls.push(url);

    const img = document.createElement('img');
    img.src = url;

    img.onclick = () => {
        // Revoke previous overlay URL
        if (activeOverlayImageUrl) URL.revokeObjectURL(activeOverlayImageUrl);
        activeOverlayImageUrl = URL.createObjectURL(file);
        const overlayImg = document.getElementById('imageOverlayImg');
        overlayImg.src = activeOverlayImageUrl;
        document.getElementById('imageOverlay').style.display = 'flex';
    };

    grid.appendChild(img);
}

function revokeAllModalUrls() {
    if (Array.isArray(modalImageUrls)) {
        modalImageUrls.forEach(url => URL.revokeObjectURL(url));
        modalImageUrls = [];
    }

    if (activeOverlayImageUrl) {
        URL.revokeObjectURL(activeOverlayImageUrl);
        activeOverlayImageUrl = null;
    }
}

function extractFolderPathFromRow(rowData) {
    for (let v of Object.values(rowData)) {
        if (typeof v !== 'string') continue;
        v = v.trim().replace(/^"|"$/g, '').replace(/\\\\/g, '\\');

        const hyperlinkMatch = v.match(/^=HYPERLINK\("([^"]+)",/i);
        if (hyperlinkMatch) return hyperlinkMatch[1];

        const htmlHrefMatch = v.match(/href="file:\/\/\/([^"]+)"/i);
        if (htmlHrefMatch) return htmlHrefMatch[1].replace(/\//g, '\\');

        if (/^[A-Z]:\\/.test(v)) return v;
    }
    return null;
}