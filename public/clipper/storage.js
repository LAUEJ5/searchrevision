/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.clipper = g.__NOTETAKR__.clipper || {};
  const ns = g.__NOTETAKR__.clipper;
  const C = g.__NOTETAKR__?.constants || {};

  const NOTES_DRAFT_KEY = String(C.NOTES_DRAFT_KEY || "notes_draft_v1");

  function nowIso() {
    return new Date().toISOString();
  }

  ns.appendToNotes = async function appendToNotes(text) {
    const pageUrl = String(window.location.href || "").trim();
    const scrollY = Number(window.scrollY || 0);
    const clean = String(text || "").replace(/\r\n/g, "\n").trim();
    if (!clean) return { ok: false, error: "Empty selection" };

    const draft = await new Promise((resolve) => {
      chrome.storage?.local?.get?.([NOTES_DRAFT_KEY], (res) => {
        const err = chrome.runtime.lastError;
        if (err) return resolve({ __error: String(err.message || err) });
        resolve(res?.[NOTES_DRAFT_KEY] || null);
      });
    });

    if (draft && draft.__error) return { ok: false, error: draft.__error };

    const cur = draft && typeof draft === "object" ? draft : null;
    const curText = typeof cur?.text === "string" ? cur.text : "";
    const base = String(curText || "").replace(/\r\n/g, "\n").trimEnd();
    const nextText = base ? `${base}\n\n${clean}` : clean;

    const curLinks = Array.isArray(cur?.lineLinks) ? cur.lineLinks.slice() : [];
    const baseLines = base ? base.split("\n") : [""];
    const cleanLines = clean.split("\n");
    const insertStart = base ? baseLines.length + 1 : 0; // +1 for blank separator line
    const nextLinks = curLinks.slice();

    const totalLines = nextText.split("\n").length;
    while (nextLinks.length < totalLines) nextLinks.push(null);

    for (let i = 0; i < cleanLines.length; i++) {
      const line = String(cleanLines[i] || "").trim();
      if (!line) continue;
      nextLinks[insertStart + i] = { url: pageUrl, scrollY, ts: Date.now() };
    }

    const nextDraft = {
      ...(cur && typeof cur === "object" ? cur : {}),
      id: typeof cur?.id === "string" ? cur.id : crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      title: typeof cur?.title === "string" ? cur.title : "",
      folder: typeof cur?.folder === "string" ? cur.folder : "Inbox",
      text: nextText,
      lineLinks: nextLinks,
      createdAt: typeof cur?.createdAt === "string" ? cur.createdAt : nowIso(),
      updatedAt: nowIso()
    };

    const setOk = await new Promise((resolve) => {
      chrome.storage?.local?.set?.({ [NOTES_DRAFT_KEY]: nextDraft }, () => {
        const err = chrome.runtime.lastError;
        if (err) return resolve({ ok: false, error: String(err.message || err) });
        resolve({ ok: true });
      });
    });

    if (!setOk?.ok) return setOk;

    try {
      chrome.runtime.sendMessage({ type: "openSidePanel" }, () => {});
    } catch {
      // ignore
    }

    return { ok: true };
  };
})();

