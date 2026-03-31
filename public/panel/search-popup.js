/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.panel = g.__NOTETAKR__.panel || {};

  const ns = g.__NOTETAKR__.panel;
  const { els, state } = ns;

  function getHighlightedNoteText() {
    if (!els.editorEl) return "";
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return "";
    const range = sel.getRangeAt(0);
    if (!range || range.collapsed) return "";
    if (!els.editorEl.contains(range.commonAncestorContainer)) return "";
    return String(sel.toString() || "").trim();
  }

  function positionSearchBtnNearRect(rect) {
    if (!els.searchBtn) return;
    const wrap = els.searchBtn.parentElement;
    if (!wrap) return;
    const wRect = wrap.getBoundingClientRect();
    const margin = 10;
    const bw = els.searchBtn.offsetWidth || 120;
    const bh = els.searchBtn.offsetHeight || 34;

    let left = rect.left - wRect.left + rect.width / 2 - bw / 2;
    let top = rect.top - wRect.top - bh - 14;

    left = Math.max(margin, Math.min(left, wRect.width - bw - margin));
    top = Math.min(top, wRect.height - bh - margin);

    els.searchBtn.style.left = `${Math.round(left)}px`;
    els.searchBtn.style.top = `${Math.round(top)}px`;
    els.searchBtn.style.right = "auto";
  }

  function selectionRectInEditor() {
    try {
      if (!els.editorEl) return null;
      const sel = window.getSelection?.();
      if (!sel || sel.rangeCount === 0) return null;
      const range = sel.getRangeAt(0);
      if (!range || range.collapsed) return null;
      if (!els.editorEl.contains(range.commonAncestorContainer)) return null;
      const rect = range.getBoundingClientRect?.();
      if (!rect || (!rect.width && !rect.height)) return null;
      return rect;
    } catch {
      return null;
    }
  }

  function updateSearchPopup() {
    if (!els.searchBtn || !els.editorEl) return;
    const t = getHighlightedNoteText();
    if (t) {
      state.lastSearchSelection = t;
      const rect = selectionRectInEditor();
      if (rect) positionSearchBtnNearRect(rect);
      els.searchBtn.hidden = false;
      return;
    }

    els.searchBtn.hidden = true;
  }

  ns.search = {
    getHighlightedNoteText,
    updateSearchPopup
  };

  ns.initSearchPopup = function initSearchPopup() {
    if (!els.editorEl) return;

    els.editorEl.addEventListener("mouseup", () => updateSearchPopup());
    els.editorEl.addEventListener("keyup", () => updateSearchPopup());
    els.editorEl.addEventListener("click", () => updateSearchPopup());

    els.editorEl.addEventListener("mousedown", () => {
      if (els.searchBtn) els.searchBtn.hidden = true;
    });
    els.editorEl.addEventListener("input", () => {
      if (els.searchBtn) els.searchBtn.hidden = true;
    });
    els.editorEl.addEventListener("blur", () => {
      if (els.searchBtn) els.searchBtn.hidden = true;
    });

    document.addEventListener("selectionchange", () => {
      if (!els.editorEl) return;
      const active = document.activeElement;
      if (active !== els.editorEl && !active?.closest?.("#srNotesEditor")) return;
      updateSearchPopup();
    });

    document.addEventListener(
      "mousedown",
      (e) => {
        if (!els.searchBtn || els.searchBtn.hidden) return;
        const t = e.target;
        if (t === els.searchBtn || (t && typeof t === "object" && els.searchBtn.contains(t))) return;
        els.searchBtn.hidden = true;
      },
      true
    );

    // Prevent selection collapse before click fires.
    els.searchBtn?.addEventListener("mousedown", (e) => e.preventDefault());

    els.searchBtn?.addEventListener("click", () => {
      const q = getHighlightedNoteText() || state.lastSearchSelection;
      if (!q) return;
      chrome.runtime.sendMessage({ type: "openGoogleSearch", q }, () => {});
      els.searchBtn.hidden = true;
    });
  };
})();

