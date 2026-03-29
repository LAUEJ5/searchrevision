/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.panel = g.__NOTETAKR__.panel || {};

  const ns = g.__NOTETAKR__.panel;
  const { els, state } = ns;

  function isEditingNow() {
    if (!document.hasFocus?.()) return false;
    const active = document.activeElement;
    return Boolean(active && (active === els.titleInput || active === els.editorEl || Boolean(active.closest?.("#srNotesEditor"))));
  }

  ns.queueDraftSave = function queueDraftSave() {
    clearTimeout(state.saveT);
    state.saveT = setTimeout(() => {
      try {
        ns.apiFetch("/api/notes/draft", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: els.titleInput?.value || "",
            folder: "Inbox",
            text: ns.serializeEditorToBody(els.editorEl),
            lineLinks: state.lineLinks
          })
        }).catch(() => {});
      } catch {
        // ignore
      }
    }, 250);
  };

  ns.loadDraftOnStartup = async function loadDraftOnStartup() {
    const r = await ns.apiFetch("/api/notes/draft");
    const json = await r.json().catch(() => ({}));
    if (!r.ok) return;
    if (els.titleInput) els.titleInput.value = json.title || "";
    const nextText = typeof json.text === "string" ? json.text : "";
    state.lastRenderedDraftText = nextText;
    ns.renderEditorFromBody(els.editorEl, nextText);
    state.lineLinks = Array.isArray(json.lineLinks) ? json.lineLinks : [];
    ns.syncLineHeightVar();
    ns.renderGutter();
  };

  ns.initDraftSync = function initDraftSync() {
    els.titleInput?.addEventListener("input", () => ns.queueDraftSave());

    els.editorEl?.addEventListener("input", () => {
      ns.clampLineLinksToLines();
      ns.renderGutter();
      ns.search?.updateSearchPopup?.();
      ns.queueDraftSave();
    });

    chrome.runtime?.onMessage?.addListener?.((msg, _sender, sendResponse) => {
      if (!msg || msg.type !== "srNotesDraftUpdated") return;
      const draft = msg.draft || {};
      const newText = typeof draft.text === "string" ? draft.text : null;
      if (!newText) return sendResponse?.({ ok: false });

      const editing = isEditingNow();
      const local = ns.serializeEditorToBody(els.editorEl);
      const localTrim = String(local || "").trimEnd();
      const newTrim = String(newText || "").trimEnd();

      if (!editing || newTrim.startsWith(localTrim)) {
        state.lastRenderedDraftText = newText;
        ns.renderEditorFromBody(els.editorEl, newText);
        if (Array.isArray(draft.lineLinks)) state.lineLinks = draft.lineLinks;
        ns.renderGutter();
      }

      sendResponse?.({ ok: true });
    });

    chrome.storage?.onChanged?.addListener?.((changes, areaName) => {
      if (areaName !== "local") return;
      if (!changes || !changes.notes_draft_v1) return;
      if (isEditingNow()) return;
      ns.loadDraftOnStartup();
    });

    setInterval(async () => {
      try {
        const r = await ns.apiFetch("/api/notes/draft");
        const json = await r.json().catch(() => ({}));
        if (!r.ok) return;
        const nextText = typeof json.text === "string" ? json.text : "";
        if (state.lastRenderedDraftText === null) state.lastRenderedDraftText = nextText;
        if (nextText !== state.lastRenderedDraftText) {
          if (isEditingNow()) return;
          state.lastRenderedDraftText = nextText;
          ns.renderEditorFromBody(els.editorEl, nextText);
          state.lineLinks = Array.isArray(json.lineLinks) ? json.lineLinks : [];
          ns.renderGutter();
        }
      } catch {
        // ignore
      }
    }, 2000);
  };
})();

