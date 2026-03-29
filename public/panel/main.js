/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.panel = g.__NOTETAKR__.panel || {};

  const ns = g.__NOTETAKR__.panel;
  const { els, state } = ns;

  ns.init = function init() {
    ns.ensureEditorInitialized?.(els.editorEl);
    ns.syncLineHeightVar?.();
    ns.renderGutter?.();

    ns.initSearchPopup?.();
    ns.initKeyboard?.();
    ns.initDraftSync?.();

    els.editorEl?.addEventListener("scroll", () => ns.syncGutterScroll?.());
    window.addEventListener("resize", () => {
      ns.syncLineHeightVar?.();
      ns.renderGutter?.();
    });

    els.newBtn?.addEventListener("click", async () => {
      const r = await ns.apiFetch("/api/notes/draft/new", { method: "POST" });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) return;
      if (els.titleInput) els.titleInput.value = json.title || "";
      ns.renderEditorFromBody(els.editorEl, "");
      state.lineLinks = [];
      ns.renderGutter();
      ns.focusEditorEnd(els.editorEl);
      ns.queueDraftSave?.();
    });

    els.openBtn?.addEventListener("click", async () => {
      await ns.openViaPicker?.();
    });

    els.saveBtn?.addEventListener("click", async () => {
      await ns.saveViaPicker?.();
    });

    ns.loadDraftOnStartup?.();
  };

  ns.init();
})();

