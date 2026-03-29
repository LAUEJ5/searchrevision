/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.panel = g.__NOTETAKR__.panel || {};

  const ns = g.__NOTETAKR__.panel;
  const { els, state } = ns;

  function getEditorLines() {
    const t = ns.serializeEditorToBody(els.editorEl);
    const lines = String(t).split("\n");
    return lines.length ? lines : [""];
  }

  function getLineStartOffsets(text) {
    const t = String(text || "");
    const out = [0];
    for (let i = 0; i < t.length; i++) {
      if (t[i] === "\n") out.push(i + 1);
    }
    return out;
  }

  ns.getNodeOffsetAtGlobalOffset = function getNodeOffsetAtGlobalOffset(root, globalOffset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let off = Math.max(0, Number(globalOffset || 0));
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const len = node?.nodeValue?.length || 0;
      if (off <= len) return { node, offset: off };
      off -= len;
    }
    return { node: root, offset: 0 };
  };

  function rectForTextOffset(root, fullText, offset) {
    try {
      const t = String(fullText || "");
      const len = t.length;
      if (!len) return null;
      let start = Math.max(0, Math.min(Number(offset || 0), len - 1));
      let end = Math.min(len, start + 1);
      if (t[start] === "\n" && start + 1 < len) {
        start = start + 1;
        end = Math.min(len, start + 1);
      }

      const a = ns.getNodeOffsetAtGlobalOffset(root, start);
      const b = ns.getNodeOffsetAtGlobalOffset(root, end);
      const r = document.createRange();
      r.setStart(a.node, a.offset);
      r.setEnd(b.node, b.offset);
      const rect = r.getBoundingClientRect();
      if (!rect || !rect.height) return null;
      return rect;
    } catch {
      return null;
    }
  }

  ns.syncGutterScroll = function syncGutterScroll() {
    if (!state.gutterInnerEl || !els.editorEl) return;
    state.gutterInnerEl.style.top = `-${Math.round(els.editorEl.scrollTop || 0)}px`;
  };

  ns.syncLineHeightVar = function syncLineHeightVar() {
    if (!els.editorEl) return;
    const lh = window.getComputedStyle(els.editorEl).lineHeight;
    if (!lh || lh === "normal") return;
    document.documentElement.style.setProperty("--srLineH", lh);
  };

  ns.clampLineLinksToLines = function clampLineLinksToLines(lines) {
    const arr = Array.isArray(lines) ? lines : getEditorLines();
    const n = arr.length;
    if (!Array.isArray(state.lineLinks)) state.lineLinks = [];
    if (state.lineLinks.length > n) state.lineLinks = state.lineLinks.slice(0, n);

    for (let i = 0; i < n; i++) {
      if (!String(arr[i] || "").trim()) state.lineLinks[i] = null;
    }

    if (n === 1 && !String(arr[0] || "").trim()) state.lineLinks = [];
  };

  ns.renderGutter = function renderGutter() {
    if (!els.gutterEl) return;
    const fullText = ns.serializeEditorToBody(els.editorEl);
    const lines = String(fullText).split("\n");
    ns.clampLineLinksToLines(lines);

    const inner = document.createElement("div");
    inner.className = "srNotesGutterInner";

    const offsets = getLineStartOffsets(fullText);
    const editorRect = els.editorEl?.getBoundingClientRect?.();

    for (let i = 0; i < lines.length; i++) {
      const isEmpty = !String(lines[i] || "").trim();
      const meta = state.lineLinks[i] && typeof state.lineLinks[i] === "object" ? state.lineLinks[i] : null;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "srNotesLineLinkBtn";
      btn.textContent = "↩";
      if (isEmpty || !meta?.url) {
        btn.disabled = true;
      } else {
        const url = String(meta.url);
        btn.title = url;
        btn.addEventListener("click", () => {
          chrome.runtime.sendMessage({ type: "openContext", url, scrollY: Number(meta.scrollY || 0) }, () => {});
        });
      }

      if (editorRect) {
        const rect = rectForTextOffset(els.editorEl, fullText, offsets[i] ?? 0);
        if (rect) {
          const contentY = rect.top - editorRect.top + (els.editorEl.scrollTop || 0);
          btn.style.position = "absolute";
          btn.style.top = `${Math.round(contentY)}px`;
          btn.style.right = "0";
        }
      }

      inner.appendChild(btn);
    }

    els.gutterEl.innerHTML = "";
    els.gutterEl.appendChild(inner);
    state.gutterInnerEl = inner;
    ns.syncGutterScroll();
  };
})();

