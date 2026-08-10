/**
 * Veoruga — region-selection overlay (injected content script).
 *
 * Flow: user drags a rectangle over the page → we hide our own UI so it is
 * not part of the shot → ask the service worker to capture the visible tab →
 * crop the returned PNG to the selection with a canvas → show Download / Copy.
 * Everything happens locally in the page; no data is uploaded.
 */
(() => {
  if (window.__veorugaActive) return;
  window.__veorugaActive = true;

  const dpr = window.devicePixelRatio || 1;

  const root = document.createElement("div");
  root.className = "veoruga-root";

  const backdrop = document.createElement("div");
  backdrop.className = "veoruga-backdrop";

  const box = document.createElement("div");
  box.className = "veoruga-box";
  box.style.display = "none";

  const hint = document.createElement("div");
  hint.className = "veoruga-hint";
  hint.textContent = "Drag to snip · Esc to cancel";

  root.append(backdrop, box, hint);
  document.documentElement.appendChild(root);

  let startX = 0,
    startY = 0,
    curX = 0,
    curY = 0,
    dragging = false;

  const rect = () => ({
    x: Math.min(startX, curX),
    y: Math.min(startY, curY),
    w: Math.abs(curX - startX),
    h: Math.abs(curY - startY),
  });

  function drawBox() {
    const r = rect();
    box.style.left = r.x + "px";
    box.style.top = r.y + "px";
    box.style.width = r.w + "px";
    box.style.height = r.h + "px";
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    dragging = true;
    startX = curX = e.clientX;
    startY = curY = e.clientY;
    box.style.display = "block";
    backdrop.style.opacity = "0"; // rely on the box's cut-out dim instead
    hint.style.opacity = "0";
    drawBox();
    e.preventDefault();
    e.stopPropagation();
  }

  function onMouseMove(e) {
    if (!dragging) return;
    curX = e.clientX;
    curY = e.clientY;
    drawBox();
  }

  function onMouseUp(e) {
    if (!dragging) return;
    dragging = false;
    const r = rect();
    if (r.w < 5 || r.h < 5) {
      cleanup();
      return;
    }
    finalize(r);
    e.preventDefault();
    e.stopPropagation();
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
    }
  }

  function removeDragListeners() {
    window.removeEventListener("mousedown", onMouseDown, true);
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseup", onMouseUp, true);
  }

  function cleanup() {
    removeDragListeners();
    window.removeEventListener("keydown", onKey, true);
    root.remove();
    window.__veorugaActive = false;
  }

  async function finalize(r) {
    removeDragListeners();
    // Hide our overlay so it is not captured, then wait for a repaint.
    root.style.display = "none";
    await new Promise((res) =>
      requestAnimationFrame(() => requestAnimationFrame(res))
    );

    let resp;
    try {
      resp = await chrome.runtime.sendMessage({ type: "capture-visible" });
    } catch (e) {
      resp = { ok: false, error: String(e) };
    }
    if (!resp || !resp.ok) {
      cleanup();
      alert("Veoruga couldn't capture this page.");
      return;
    }

    const cropped = await crop(resp.dataUrl, r);
    showResult(cropped);
  }

  function crop(dataUrl, r) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(r.w * dpr));
        canvas.height = Math.max(1, Math.round(r.h * dpr));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(
          img,
          Math.round(r.x * dpr),
          Math.round(r.y * dpr),
          Math.round(r.w * dpr),
          Math.round(r.h * dpr),
          0,
          0,
          canvas.width,
          canvas.height
        );
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = dataUrl;
    });
  }

  function timestamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(
      d.getHours()
    )}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  }

  function button(label, onClick, primary) {
    const b = document.createElement("button");
    b.className = "veoruga-btn" + (primary ? " veoruga-primary" : "");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  async function copyToClipboard(dataUrl) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      return true;
    } catch (e) {
      return false;
    }
  }

  function download(dataUrl) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `veoruga_${timestamp()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function showResult(dataUrl) {
    root.style.display = "block";
    root.className = "veoruga-root veoruga-result";
    root.innerHTML = "";

    const card = document.createElement("div");
    card.className = "veoruga-card";

    const preview = document.createElement("img");
    preview.className = "veoruga-preview";
    preview.src = dataUrl;
    preview.alt = "Snip preview";

    const bar = document.createElement("div");
    bar.className = "veoruga-bar";

    const copyBtn = button("Copy", async () => {
      const ok = await copyToClipboard(dataUrl);
      copyBtn.textContent = ok ? "Copied!" : "Copy failed";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
    });
    const downloadBtn = button("Download", () => download(dataUrl), true);
    const closeBtn = button("Close", () => cleanup());

    bar.append(downloadBtn, copyBtn, closeBtn);
    card.append(preview, bar);
    root.appendChild(card);

    // Click the dimmed area (outside the card) to close.
    root.addEventListener("click", (e) => {
      if (e.target === root) cleanup();
    });
    window.addEventListener("keydown", onKey, true);
  }

  window.addEventListener("mousedown", onMouseDown, true);
  window.addEventListener("mousemove", onMouseMove, true);
  window.addEventListener("mouseup", onMouseUp, true);
  window.addEventListener("keydown", onKey, true);
})();
