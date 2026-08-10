/**
 * Veoruga — background service worker (Manifest V3)
 *
 * Responsibilities:
 *   1. Inject the region-selection overlay into the active tab (from the popup).
 *   2. Capture the visible viewport on the overlay's behalf, since
 *      chrome.tabs.captureVisibleTab is not available to content scripts.
 *
 * Permissions used: "activeTab" (temporary access to the tab the user acts on)
 * and "scripting" (to inject the overlay). No host permissions, no storage,
 * no network — nothing leaves the browser.
 */

// Pages the browser forbids extensions from scripting or capturing.
function isRestricted(url = "") {
  return (
    /^(chrome|edge|brave|about|chrome-extension|moz-extension|devtools|view-source|data):/i.test(
      url
    ) ||
    url.startsWith("https://chrome.google.com/webstore") ||
    url.startsWith("https://chromewebstore.google.com")
  );
}

async function injectOverlay(tabId) {
  await chrome.scripting.insertCSS({ target: { tabId }, files: ["overlay.css"] });
  await chrome.scripting.executeScript({ target: { tabId }, files: ["overlay.js"] });
}

async function startSnipOnActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !tab.id || isRestricted(tab.url)) return false;
  await injectOverlay(tab.id);
  return true;
}

// Messages from the popup and the overlay content script.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "start-snip") {
    startSnipOnActiveTab()
      .then((ok) => sendResponse({ ok }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true; // async response
  }

  if (msg && msg.type === "capture-visible") {
    const windowId = sender.tab ? sender.tab.windowId : chrome.windows.WINDOW_ID_CURRENT;
    chrome.tabs
      .captureVisibleTab(windowId, { format: "png" })
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true; // async response
  }
});
