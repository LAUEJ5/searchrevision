/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.panel = g.__NOTETAKR__.panel || {};

  const ns = g.__NOTETAKR__.panel;
  const { els, state } = ns;

  function pointInRect(x, y, rect, pad = 2) {
    if (!rect) return false;
    const px = Number(x);
    const py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return false;
    return px >= rect.left - pad && px <= rect.right + pad && py >= rect.top - pad && py <= rect.bottom + pad;
  }

  function getHighlightedNoteText() {
    if (!els.editorEl) return "";
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return "";
    const range = sel.getRangeAt(0);
    if (!range || range.collapsed) return "";
    if (!els.editorEl.contains(range.commonAncestorContainer)) return "";
    return String(sel.toString() || "").trim();
  }

  function updateSearchPopup() {
    if (!els.searchBtn || !els.editorEl) return;
    const t = getHighlightedNoteText();
    if (t) {
      state.lastSearchSelection = t;
      els.searchBtn.hidden = false;
      return;
    }

    if (state.hoverSearchWord) {
      els.searchBtn.hidden = false;
      return;
    }

    els.searchBtn.hidden = true;
  }

  function getCaretRangeFromPoint(x, y) {
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (!pos) return null;
      const r = document.createRange();
      r.setStart(pos.offsetNode, pos.offset);
      r.collapse(true);
      return r;
    }
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
    return null;
  }

  function getTextOffsetFromRange(root, range) {
    try {
      const pre = document.createRange();
      pre.selectNodeContents(root);
      pre.setEnd(range.startContainer, range.startOffset);
      return pre.toString().length;
    } catch {
      return null;
    }
  }

  function computeWordAtOffset(text, offset) {
    const t = String(text || "");
    const i = Math.max(0, Math.min(Number(offset || 0), t.length));
    const isWordChar = (ch) => /[A-Za-z0-9'_’-]/.test(ch);
    if (!t[i] && i > 0 && !isWordChar(t[i - 1])) return null;
    let left = i;
    let right = i;
    if (left > 0 && isWordChar(t[left - 1]) && !isWordChar(t[left])) left--;
    while (left > 0 && isWordChar(t[left - 1])) left--;
    while (right < t.length && isWordChar(t[right])) right++;
    const word = t.slice(left, right);
    if (!word.trim()) return null;
    return { word, left, right };
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

  function scheduleHoverHide() {
    if (state.hoverHideT) clearTimeout(state.hoverHideT);
    state.hoverHideT = setTimeout(() => {
      if (state.isSearchBtnHovered) return;
      state.hoverSearchWord = "";
      state.lastHoverWordRect = null;
      updateSearchPopup();
    }, 90);
  }

  function cancelHoverHide() {
    if (state.hoverHideT) clearTimeout(state.hoverHideT);
    state.hoverHideT = null;
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

    els.editorEl.addEventListener("mousemove", (e) => {
      cancelAnimationFrame(state.hoverRAF);
      const x = e.clientX;
      const y = e.clientY;
      if (e.buttons) return;
      state.hoverRAF = requestAnimationFrame(() => {
        const range = getCaretRangeFromPoint(x, y);
        if (!range || !els.editorEl.contains(range.startContainer)) {
          if (state.hoverSearchWord) scheduleHoverHide();
          return;
        }

        const text = ns.serializeEditorToBody(els.editorEl);
        const off = getTextOffsetFromRange(els.editorEl, range);
        const w = computeWordAtOffset(text, off);
        if (!w) {
          if (state.hoverSearchWord) scheduleHoverHide();
          return;
        }

        const startPos = ns.getNodeOffsetAtGlobalOffset(els.editorEl, w.left);
        const endPos = ns.getNodeOffsetAtGlobalOffset(els.editorEl, w.right);
        const wr = document.createRange();
        let rect = null;
        try {
          wr.setStart(startPos.node, startPos.offset);
          wr.setEnd(endPos.node, endPos.offset);
          rect = wr.getBoundingClientRect();
        } catch {
          rect = null;
        }

        if (!rect || !rect.width || !rect.height || !pointInRect(x, y, rect, 3)) {
          if (state.hoverSearchWord) scheduleHoverHide();
          return;
        }

        state.lastHoverWordRect = rect;

        if (w.word !== state.hoverSearchWord) {
          cancelHoverHide();
          state.hoverSearchWord = w.word;
          positionSearchBtnNearRect(rect);
          updateSearchPopup();
          return;
        }

        if (!els.searchBtn?.hidden) positionSearchBtnNearRect(rect);
      });
    });

    els.editorEl.addEventListener("mouseleave", () => {
      if (state.hoverSearchWord) scheduleHoverHide();
    });

    els.searchBtn?.addEventListener("mouseenter", () => {
      state.isSearchBtnHovered = true;
      cancelHoverHide();
    });

    els.searchBtn?.addEventListener("mouseleave", () => {
      state.isSearchBtnHovered = false;
      if (state.hoverSearchWord) scheduleHoverHide();
      else {
        if (state.hoverHideT) clearTimeout(state.hoverHideT);
        state.hoverHideT = setTimeout(() => {
          state.hoverSearchWord = "";
          updateSearchPopup();
        }, 200);
      }
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
      const q = getHighlightedNoteText() || state.lastSearchSelection || state.hoverSearchWord;
      if (!q) return;
      chrome.runtime.sendMessage({ type: "openGoogleSearch", q }, () => {});
      els.searchBtn.hidden = true;
    });
  };
})();

