/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.sw = g.__NOTETAKR__.sw || {};

  const ns = g.__NOTETAKR__.sw;

  ns.handleNotes = async function handleNotes(req) {
    const { pathname } = new URL(req.url, "https://example.invalid");

    if (pathname === "/api/notes/draft" && req.method === "GET") {
      const draft = await ns.getDraft();
      await ns.setDraft(draft);
      return { ok: true, status: 200, json: draft };
    }

    if (pathname === "/api/notes/draft" && req.method === "PUT") {
      const cur = await ns.getDraft();
      const body = ns.parseJsonBody(req.body);
      const title = typeof body.title === "string" ? body.title : cur.title;
      const folder = typeof body.folder === "string" ? body.folder : cur.folder;
      const text = typeof body.text === "string" ? body.text : "";
      const lineLinks = Array.isArray(body.lineLinks) ? body.lineLinks : cur.lineLinks;
      const next = { ...cur, title, folder, text, lineLinks, updatedAt: ns.nowIso() };
      await ns.setDraft(next);
      return { ok: true, status: 200, json: { ok: true, id: next.id, updatedAt: next.updatedAt } };
    }

    if (pathname === "/api/notes/draft/new" && req.method === "POST") {
      const draft = {
        id: crypto.randomUUID(),
        title: "",
        folder: "Inbox",
        text: "",
        lineLinks: [],
        createdAt: ns.nowIso(),
        updatedAt: ns.nowIso()
      };
      await ns.setDraft(draft);
      return { ok: true, status: 200, json: draft };
    }

    return { ok: false, status: 404, json: { error: "Not found" } };
  };

  ns.handleApi = async function handleApi(req) {
    const u = new URL(req.url, "https://example.invalid");
    if (u.pathname === "/api/health") return { ok: true, status: 200, json: { ok: true } };
    if (u.pathname.startsWith("/api/notes/")) return ns.handleNotes(req);
    return { ok: false, status: 404, json: { error: "Not found" } };
  };
})();

