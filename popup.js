/**
 * Veoruga — popup logic.
 *   • "Snip a region" asks the service worker to inject the overlay, then closes.
 *   • "Capture visible area" grabs the viewport and previews it here with
 *     Download / Copy. Capture works via the "activeTab" grant created when the
 *     user clicks the toolbar icon.
 */

const $ = (id) => document.getElementById(id);

const snipBtn = $("snipBtn");
const visibleBtn = $("visibleBtn");
const note = $("note");
const actions = $("actions");
const result = $("result");
const preview = $("preview");
const downloadBtn = $("downloadBtn");
const copyBtn = $("copyBtn");
const backBtn = $("backBtn");

let currentDataUrl = null;

function isRestricted(url = "") {
  return (
    /^(chrome|edge|brave|about|chrome-extension|moz-extension|devtools|view-source|data):/i.test(
      url
    ) ||
    url.startsWith("https://chrome.google.com/webstore") ||
    url.startsWith("https://chromewebstore.google.com")
  );
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(
    d.getHours()
  )}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function init() {
  const tab = await getActiveTab();
  if (!tab || isRestricted(tab.url)) {
    snipBtn.disabled = true;
    visibleBtn.disabled = true;
    note.hidden = false;
    note.textContent =
      "Veoruga can't run on browser system pages or the Chrome Web Store. Open a normal website and try again.";
  }
}

snipBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "start-snip" });
  window.close();
});

visibleBtn.addEventListener("click", async () => {
  try {
    const tab = await getActiveTab();
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });
    currentDataUrl = dataUrl;
    preview.src = dataUrl;
    actions.hidden = true;
    result.hidden = false;
  } catch (e) {
    note.hidden = false;
    note.textContent = "Couldn't capture this page.";
  }
});

downloadBtn.addEventListener("click", () => {
  if (!currentDataUrl) return;
  const a = document.createElement("a");
  a.href = currentDataUrl;
  a.download = `veoruga_${timestamp()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

copyBtn.addEventListener("click", async () => {
  if (!currentDataUrl) return;
  try {
    const blob = await (await fetch(currentDataUrl)).blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    copyBtn.textContent = "Copied!";
  } catch (e) {
    copyBtn.textContent = "Copy failed";
  }
  setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
});

backBtn.addEventListener("click", () => {
  result.hidden = true;
  actions.hidden = false;
  currentDataUrl = null;
});

init();
