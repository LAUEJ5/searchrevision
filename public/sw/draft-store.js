/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.sw = g.__NOTETAKR__.sw || {};

  const ns = g.__NOTETAKR__.sw;

  ns.getDraft = async function getDraft() {
    const r = await ns.storageGet([ns.NOTES_DRAFT_KEY]);
    return (
      r[ns.NOTES_DRAFT_KEY] || {
        id: crypto.randomUUID(),
        title: "",
        folder: "Inbox",
        text: "",
        lineLinks: [],
        createdAt: ns.nowIso(),
        updatedAt: ns.nowIso()
      }
    );
  };

  ns.setDraft = async function setDraft(nextDraft) {
    await ns.storageSet({ [ns.NOTES_DRAFT_KEY]: nextDraft });
    return nextDraft;
  };
})();

