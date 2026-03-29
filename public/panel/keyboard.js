/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.panel = g.__NOTETAKR__.panel || {};

  const ns = g.__NOTETAKR__.panel;
  const { els, state } = ns;

  function getSelectionRangeInEditor() {
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!range) return null;
    if (!els.editorEl) return null;
    if (!els.editorEl.contains(range.commonAncestorContainer)) return null;
    return range;
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

  function setCaretAtOffset(root, offset) {
    const pos = ns.getNodeOffsetAtGlobalOffset(root, offset);
    try {
      const r = document.createRange();
      r.setStart(pos.node, pos.offset);
      r.collapse(true);
      const sel = window.getSelection?.();
      sel?.removeAllRanges?.();
      sel?.addRange?.(r);
    } catch {
      // ignore
    }
  }

  function insertTextAtSelection(text) {
    const range = getSelectionRangeInEditor();
    if (!range) return false;
    range.deleteContents();
    const node = document.createTextNode(String(text || ""));
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    const sel = window.getSelection?.();
    sel?.removeAllRanges?.();
    sel?.addRange?.(range);
    return true;
  }

  ns.initKeyboard = function initKeyboard() {
    els.editorEl?.addEventListener("keydown", (e) => {
      if (!els.editorEl) return;

      if (e.key === "Tab") {
        e.preventDefault();
        insertTextAtSelection("    ");
        ns.clampLineLinksToLines();
        ns.renderGutter();
        ns.queueDraftSave?.();
        return;
      }

      if (e.key === "Enter") {
        const range = getSelectionRangeInEditor();
        if (!range) return;

        const textBefore = ns.serializeEditorToBody(els.editorEl);
        const caret = getTextOffsetFromRange(els.editorEl, range);
        if (caret == null) return;
        const lineIndex = textBefore.slice(0, caret).split("\n").length - 1;
        const lineStart = textBefore.lastIndexOf("\n", caret - 1) + 1;
        const lineEndIdx = textBefore.indexOf("\n", caret);
        const lineEnd = lineEndIdx === -1 ? textBefore.length : lineEndIdx;
        const lineText = textBefore.slice(lineStart, lineEnd).trim();

        if (range.collapsed) {
          if (!Array.isArray(state.lineLinks)) state.lineLinks = [];
          state.lineLinks.splice(lineIndex + 1, 0, null);
        }

        if (lineText) {
          const pendingId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const existing =
            state.lineLinks[lineIndex] && typeof state.lineLinks[lineIndex] === "object" ? state.lineLinks[lineIndex] : null;
          if (!existing?.url) state.lineLinks[lineIndex] = { ...(existing || {}), pendingId };

          chrome.runtime.sendMessage({ type: "getActiveContext" }, (resp) => {
            const err = chrome.runtime.lastError;
            if (err || !resp?.ok || !resp?.url) return;
            const idx = Array.isArray(state.lineLinks)
              ? state.lineLinks.findIndex((m) => m && typeof m === "object" && m.pendingId === pendingId)
              : -1;
            if (idx === -1) return;
            state.lineLinks[idx] = { url: String(resp.url), scrollY: Number(resp.scrollY || 0), ts: Date.now() };
            ns.renderGutter();
            ns.queueDraftSave?.();
          });
        }

        setTimeout(() => {
          ns.clampLineLinksToLines();
          ns.renderGutter();
          ns.queueDraftSave?.();
        }, 0);
        return;
      }

      if ((e.key === "Backspace" || e.key === "Delete") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const range = getSelectionRangeInEditor();
        if (!range || !range.collapsed) return;
        const t = ns.serializeEditorToBody(els.editorEl);
        const caret = getTextOffsetFromRange(els.editorEl, range);
        if (caret == null) return;

        if (!Array.isArray(state.lineLinks) || !state.lineLinks.length) return;

        if (e.key === "Backspace" && caret > 0 && t[caret - 1] === "\n") {
          e.preventDefault();
          const curLineIndex = t.slice(0, caret).split("\n").length - 1;
          const prevIdx = curLineIndex - 1;
          if (prevIdx >= 0) {
            const prev = state.lineLinks[prevIdx];
            const cur = state.lineLinks[curLineIndex];
            if ((!prev || !prev.url) && cur && cur.url) state.lineLinks[prevIdx] = cur;
            state.lineLinks.splice(curLineIndex, 1);
          }
          const nextText = t.slice(0, caret - 1) + t.slice(caret);
          ns.renderEditorFromBody(els.editorEl, nextText);
          setCaretAtOffset(els.editorEl, caret - 1);
          ns.renderGutter();
          ns.queueDraftSave?.();
          return;
        }

        if (e.key === "Delete" && caret < t.length && t[caret] === "\n") {
          e.preventDefault();
          const curLineIndex = t.slice(0, caret).split("\n").length - 1;
          const nextIdx = curLineIndex + 1;
          const cur = state.lineLinks[curLineIndex];
          const next = state.lineLinks[nextIdx];
          if ((!cur || !cur.url) && next && next.url) state.lineLinks[curLineIndex] = next;
          if (nextIdx < state.lineLinks.length) state.lineLinks.splice(nextIdx, 1);
          const nextText = t.slice(0, caret) + t.slice(caret + 1);
          ns.renderEditorFromBody(els.editorEl, nextText);
          setCaretAtOffset(els.editorEl, caret);
          ns.renderGutter();
          ns.queueDraftSave?.();
        }
      }
    });
  };
})();

