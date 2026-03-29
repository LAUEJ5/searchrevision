/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.panel = g.__NOTETAKR__.panel || {};
  const ns = g.__NOTETAKR__.panel;

  ns.normalizeTitle = function normalizeTitle(t) {
    const raw = String(t || "").trim().replace(/\s+/g, " ");
    return raw || "Untitled";
  };

  ns.focusEditorEnd = function focusEditorEnd(el) {
    if (!el) return;
    el.focus();
    try {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const sel = window.getSelection?.();
      sel?.removeAllRanges?.();
      sel?.addRange?.(r);
    } catch {
      // ignore
    }
  };

  ns.ensureEditorInitialized = function ensureEditorInitialized(editorEl) {
    if (!editorEl) return;
    editorEl.spellcheck = true;
    // Chromium supports plaintext-only; keeps newlines as real \n.
    // Falls back to normal contenteditable if unsupported.
    editorEl.setAttribute("contenteditable", "plaintext-only");
  };

  ns.renderEditorFromBody = function renderEditorFromBody(editorEl, bodyText) {
    if (!editorEl) return;
    ns.ensureEditorInitialized(editorEl);
    editorEl.textContent = String(bodyText || "").replace(/\r\n/g, "\n");
  };

  ns.serializeEditorToBody = function serializeEditorToBody(editorEl) {
    if (!editorEl) return "";
    return String(editorEl.textContent || "").replace(/\u00a0/g, " ").replace(/\r\n/g, "\n").trimEnd();
  };
})();

