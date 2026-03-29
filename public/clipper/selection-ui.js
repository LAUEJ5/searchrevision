/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.clipper = g.__NOTETAKR__.clipper || {};
  const ns = g.__NOTETAKR__.clipper;
  const { state } = ns;

  function getSelectionText() {
    try {
      const sel = window.getSelection?.();
      if (!sel || sel.rangeCount === 0) return "";
      return String(sel.toString() || "").replace(/\s+\n/g, "\n").trim();
    } catch {
      return "";
    }
  }

  function getSelectionRect() {
    try {
      const sel = window.getSelection?.();
      if (!sel || sel.rangeCount === 0) return null;
      const range = sel.getRangeAt(0);
      if (!range) return null;
      const rect = range.getBoundingClientRect?.();
      if (!rect) return null;
      if (!Number.isFinite(rect.top) || (!rect.width && !rect.height)) return null;
      return rect;
    } catch {
      return null;
    }
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  ns.ensureButton = function ensureButton() {
    if (state.btn) return state.btn;
    if (document.getElementById(state.BTN_ID)) return null;

    const btn = document.createElement("button");
    btn.id = state.BTN_ID;
    btn.type = "button";
    btn.textContent = "Add to notes";
    btn.setAttribute("aria-label", "Add selection to notes");
    btn.setAttribute("aria-disabled", "false");
    document.documentElement.appendChild(btn);
    state.btn = btn;
    return btn;
  };

  ns.hideBtn = function hideBtn() {
    if (!state.btn) return;
    state.btn.style.display = "none";
  };

  ns.showBtnNearSelection = function showBtnNearSelection() {
    const btn = state.btn;
    if (!btn) return;

    const text = getSelectionText();
    if (!text || text.length < 2) return ns.hideBtn();
    if (text === state.lastSelectionText && btn.style.display !== "none") return;

    const rect = getSelectionRect();
    if (!rect) return ns.hideBtn();

    state.lastSelectionText = text;

    const margin = 10;
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;

    btn.style.display = "inline-flex";
    const bw = btn.offsetWidth || 160;
    const bh = btn.offsetHeight || 34;

    let left = rect.right + margin;
    let top = rect.bottom + margin;

    if (left + bw > vw - margin) left = rect.left - bw - margin;
    left = clamp(left, margin, Math.max(margin, vw - bw - margin));

    if (top + bh > vh - margin) top = rect.top - bh - margin;
    top = clamp(top, margin, Math.max(margin, vh - bh - margin));

    btn.style.left = `${Math.round(left)}px`;
    btn.style.top = `${Math.round(top)}px`;

    if (state.hideT) clearTimeout(state.hideT);
    state.hideT = setTimeout(() => ns.hideBtn(), 2500);
  };

  ns.getSelectionText = getSelectionText;
})();

