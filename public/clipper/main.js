/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.clipper = g.__NOTETAKR__.clipper || {};

  const ns = g.__NOTETAKR__.clipper;
  const { state } = ns;

  // Guard: if already installed once on the page, don't double-inject.
  if (document.getElementById(state.BTN_ID)) return;

  const btn = ns.ensureButton?.();
  if (!btn) return;

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.getAttribute("aria-disabled") === "true") return;

    const text = ns.getSelectionText?.();
    if (!text) return ns.hideBtn?.();

    btn.setAttribute("aria-disabled", "true");
    const old = btn.textContent;
    btn.textContent = "Adding…";

    try {
      const resp = await ns.appendToNotes?.(text);
      if (!resp?.ok) {
        btn.textContent = "Failed";
        btn.title = resp?.error ? String(resp.error) : "Failed to add to notes";
        try {
          alert(btn.title);
        } catch {
          // ignore
        }
        return;
      }

      btn.title = "";
      btn.textContent = "Added";
      try {
        window.getSelection?.()?.removeAllRanges?.();
      } catch {
        // ignore
      }
      setTimeout(() => ns.hideBtn?.(), 500);
    } finally {
      setTimeout(() => {
        btn.setAttribute("aria-disabled", "false");
        btn.textContent = old;
      }, 700);
    }
  });

  document.addEventListener("selectionchange", () => {
    clearTimeout(state.hideT);
    state.hideT = setTimeout(() => ns.showBtnNearSelection?.(), 60);
  });

  window.addEventListener("scroll", () => ns.hideBtn?.(), true);
  window.addEventListener("resize", () => ns.hideBtn?.(), true);
  document.addEventListener(
    "mousedown",
    (e) => {
      const t = e.target;
      if (t === btn || (t && typeof t === "object" && btn.contains(t))) return;
      ns.hideBtn?.();
    },
    true
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") ns.hideBtn?.();
  });
})();

