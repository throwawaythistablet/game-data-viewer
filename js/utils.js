

async function yieldToBrowser() {
    await new Promise(r => setTimeout(r, 0)); // OLD
    // if (!document.hidden) await new Promise(r => setTimeout(r, 0));
}

