/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.panel = g.__NOTETAKR__.panel || {};

  const ns = g.__NOTETAKR__.panel;
  const { els, state } = ns;
  const C = g.__NOTETAKR__?.constants || {};

  const LINE_LINKS_START = String(C.LINE_LINKS_START || "--- SEARCHREVISION_LINE_LINKS ---");
  const LINE_LINKS_END = String(C.LINE_LINKS_END || "--- /SEARCHREVISION_LINE_LINKS ---");

  ns.filenameToTitle = function filenameToTitle(name) {
    const base = String(name || "")
      .replace(/^.*[\\/]/, "")
      .replace(/\.txt$/i, "")
      .trim();
    return base || "Untitled";
  };

  ns.buildExportText = function buildExportText(body, links) {
    const text = String(body || "").replace(/\r\n/g, "\n").trimEnd();
    const lines = text.split("\n");
    const map = {};
    const arr = Array.isArray(links) ? links : [];
    for (let i = 0; i < lines.length; i++) {
      const meta = arr[i] && typeof arr[i] === "object" ? arr[i] : null;
      if (!meta?.url) continue;
      if (!String(lines[i] || "").trim()) continue;
      map[i] = { url: String(meta.url), scrollY: Number(meta.scrollY || 0) };
    }
    const hasLinks = Object.keys(map).length > 0;
    if (!hasLinks) return text + "\n";
    return `${text}\n\n${LINE_LINKS_START}\n${JSON.stringify(map)}\n${LINE_LINKS_END}\n`;
  };

  ns.parseImportText = function parseImportText(fullText) {
    const t = String(fullText || "").replace(/\r\n/g, "\n");
    const startNeedle = `\n${LINE_LINKS_START}\n`;
    const endNeedle = `\n${LINE_LINKS_END}`;
    const sIdx = t.lastIndexOf(startNeedle);
    if (sIdx === -1) return { body: t.trimEnd(), lineLinks: [] };
    const eIdx = t.indexOf(endNeedle, sIdx + startNeedle.length);
    if (eIdx === -1) return { body: t.trimEnd(), lineLinks: [] };

    const body = t.slice(0, sIdx).trimEnd();
    const jsonText = t.slice(sIdx + startNeedle.length, eIdx).trim();

    let map = null;
    try {
      map = JSON.parse(jsonText);
    } catch {
      map = null;
    }

    const lines = String(body).split("\n");
    const out = new Array(lines.length).fill(null);
    if (map && typeof map === "object") {
      for (const [k, v] of Object.entries(map)) {
        const idx = Number(k);
        if (!Number.isFinite(idx) || idx < 0 || idx >= out.length) continue;
        if (!v || typeof v !== "object") continue;
        const url = typeof v.url === "string" ? v.url : "";
        if (!url) continue;
        out[idx] = { url, scrollY: Number(v.scrollY || 0) };
      }
    }

    return { body, lineLinks: out };
  };

  ns.loadTextIntoDraft = async function loadTextIntoDraft({ title, text, lineLinks: nextLineLinks = null } = {}) {
    if (els.titleInput) els.titleInput.value = String(title || "").trim();
    ns.renderEditorFromBody(els.editorEl, String(text || "").replace(/\r\n/g, "\n"));
    state.lineLinks = Array.isArray(nextLineLinks) ? nextLineLinks : [];
    ns.syncLineHeightVar();
    ns.renderGutter();
    ns.focusEditorEnd(els.editorEl);

    await ns
      .apiFetch("/api/notes/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: els.titleInput?.value || "",
          folder: "Inbox",
          text: ns.serializeEditorToBody(els.editorEl),
          lineLinks: state.lineLinks
        })
      })
      .catch(() => {});
  };

  ns.openViaPicker = async function openViaPicker() {
    // Prefer native picker.
    try {
      if (typeof window.showOpenFilePicker === "function") {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [{ description: "Text", accept: { "text/plain": [".txt"] } }],
          excludeAcceptAllOption: false
        });
        if (!handle) return;
        const file = await handle.getFile();
        const imported = ns.parseImportText(await file.text());
        await ns.loadTextIntoDraft({
          title: ns.filenameToTitle(file.name),
          text: imported.body,
          lineLinks: imported.lineLinks
        });
        return;
      }
    } catch (e) {
      const name = String(e?.name || "");
      if (name === "AbortError") return;
      // fall through to input fallback
    }

    // Fallback picker using an <input type="file">.
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,text/plain";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener(
      "change",
      async () => {
        try {
          const file = input.files?.[0];
          if (!file) return;
          const imported = ns.parseImportText(await file.text());
          await ns.loadTextIntoDraft({
            title: ns.filenameToTitle(file.name),
            text: imported.body,
            lineLinks: imported.lineLinks
          });
        } finally {
          input.remove();
        }
      },
      { once: true }
    );
    input.click();
  };

  ns.saveViaPicker = async function saveViaPicker() {
    if (!els.titleInput || !els.editorEl) return;

    const rawTitle = String(els.titleInput.value || "").trim();
    if (!rawTitle) {
      const next = String(prompt("Title for this file?", "") || "").trim();
      if (!next) return;
      els.titleInput.value = next;
    }

    ns.queueDraftSave?.();

    const title = ns.normalizeTitle(els.titleInput.value);
    const body = ns.serializeEditorToBody(els.editorEl);
    const text = ns.buildExportText(body, state.lineLinks);

    const safeBase =
      title
        .replace(/[\/\\:*?"<>|]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || "notes";
    const suggestedName = safeBase.toLowerCase().endsWith(".txt") ? safeBase : `${safeBase}.txt`;

    // Prefer the native OS save dialog via File System Access API.
    try {
      if (typeof window.showSaveFilePicker === "function") {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{ description: "Text", accept: { "text/plain": [".txt"] } }],
          excludeAcceptAllOption: true
        });
        const writable = await handle.createWritable();
        await writable.write(new Blob([text], { type: "text/plain;charset=utf-8" }));
        await writable.close();
        return;
      }
    } catch (e) {
      const name = String(e?.name || "");
      if (name === "AbortError") return;
    }

    // Fallback: Chrome downloads "Save As…" (still uses a picker, but via downloads).
    chrome.runtime.sendMessage({ type: "downloadNotesTxt", title: suggestedName, text }, (resp) => {
      const err = chrome.runtime.lastError;
      if (err) alert(String(err.message || err));
      else if (!resp?.ok) alert(String(resp?.error || "Failed to save file"));
    });
  };
})();

