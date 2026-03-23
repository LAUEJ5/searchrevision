const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const express = require("express");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

const NOTES_ROOT = path.join(__dirname, "data", "notes");

function safeSegment(input) {
  const raw = String(input || "").trim();
  // allow letters, numbers, space, underscore, dash
  const cleaned = raw.replace(/[^a-zA-Z0-9 _-]/g, "").trim();
  return cleaned || "Inbox";
}

function safeFilename(input) {
  const raw = String(input || "").trim();
  const cleaned = raw.replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, " ");
  return cleaned || "Untitled";
}

function toSlug(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

function decodeNoteId(id) {
  const raw = String(id || "");
  if (!raw) return null;
  let rel = "";
  try {
    rel = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!rel.includes("/") || rel.includes("..")) return null;
  const [folder, filename] = rel.split("/");
  if (!folder || !filename) return null;
  if (!filename.endsWith(".md")) return null;
  return { folder, filename, rel };
}

async function fileExists(fullPath) {
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let draft = {
  id: crypto.randomUUID(),
  title: "",
  folder: "Inbox",
  text: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/notes/draft", async (_req, res) => {
  res.json(draft);
});

app.put("/api/notes/draft", async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title : draft.title;
  const folder = typeof req.body?.folder === "string" ? req.body.folder : draft.folder;
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  draft = { ...draft, title, folder, text, updatedAt: new Date().toISOString() };
  res.json({ ok: true, id: draft.id, updatedAt: draft.updatedAt });
});

app.post("/api/notes/draft/new", async (_req, res) => {
  draft = {
    id: crypto.randomUUID(),
    title: "",
    folder: "Inbox",
    text: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  res.json(draft);
});

app.post("/api/notes/save", async (req, res) => {
  const title = safeFilename(req.body?.title);
  const requestedFolder = safeSegment(req.body?.folder);
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const incomingId = typeof req.body?.id === "string" ? req.body.id : "";

  await fs.mkdir(NOTES_ROOT, { recursive: true });

  // If client provides an existing note id, overwrite that same file (no new filename).
  const decoded = decodeNoteId(incomingId);
  let folder = requestedFolder;
  let filename = "";
  let filePath = "";

  if (decoded) {
    folder = decoded.folder;
    filename = decoded.filename;
    filePath = path.join(NOTES_ROOT, folder, filename);
    if (!(await fileExists(filePath))) {
      return res.status(404).json({ error: "Saved note no longer exists", details: { id: incomingId } });
    }
  } else {
    const dir = path.join(NOTES_ROOT, folder);
    await fs.mkdir(dir, { recursive: true });

    const base = toSlug(title) || "note";
    // Prevent duplicates: if any existing file in the folder matches this title slug
    // (including old suffix forms like my-title-2.md), reject the save.
    const existing = await fs.readdir(dir).catch(() => []);
    const re = new RegExp(`^${escapeRegex(base)}(?:-\\d+)?\\.md$`, "i");
    const hasDuplicate = existing.some((name) => re.test(String(name)));
    if (hasDuplicate) {
      return res.status(409).json({
        error: "A note with this title already exists in this folder",
        details: { folder, title, slug: base }
      });
    }

    filename = `${base}.md`;
    filePath = path.join(dir, filename);
  }

  const header = `# ${title}\n\nSaved: ${new Date().toISOString()}\nFolder: ${folder}\n\n---\n\n`;
  await fs.writeFile(filePath, header + text + "\n", "utf8");

  res.json({
    ok: true,
    folder,
    title,
    filename,
    id: Buffer.from(`${folder}/${filename}`).toString("base64url")
  });
});

app.get("/api/notes/list", async (_req, res) => {
  try {
    await fs.mkdir(NOTES_ROOT, { recursive: true });
    const folders = await fs.readdir(NOTES_ROOT, { withFileTypes: true });
    const out = [];

    for (const f of folders) {
      if (!f.isDirectory()) continue;
      const folder = f.name;
      const dir = path.join(NOTES_ROOT, folder);
      const files = await fs.readdir(dir, { withFileTypes: true });
      for (const file of files) {
        if (!file.isFile()) continue;
        if (!file.name.endsWith(".md")) continue;
        out.push({
          id: Buffer.from(`${folder}/${file.name}`).toString("base64url"),
          folder,
          filename: file.name
        });
      }
    }

    // newest first by filename timestamp prefix
    out.sort((a, b) => b.filename.localeCompare(a.filename));
    res.json({ items: out });
  } catch (e) {
    res.status(500).json({ error: "Failed to list notes" });
  }
});

app.get("/api/notes/open", async (req, res) => {
  try {
    const id = String(req.query.id || "");
    if (!id) return res.status(400).json({ error: "Missing query param: id" });
    const decoded = decodeNoteId(id);
    if (!decoded) return res.status(400).json({ error: "Invalid id" });
    const full = path.join(NOTES_ROOT, decoded.rel);
    const text = await fs.readFile(full, "utf8");
    res.json({ ok: true, id, folder: decoded.folder, filename: decoded.filename, text });
  } catch (e) {
    res.status(500).json({ error: "Failed to open note" });
  }
});

app.post("/api/notes/clear", async (_req, res) => {
  try {
    // Delete everything under data/notes (all folders + all saved notes).
    await fs.rm(NOTES_ROOT, { recursive: true, force: true });
    await fs.mkdir(NOTES_ROOT, { recursive: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to clear notes" });
  }
});

app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Missing query param: q" });

    const provider = String(process.env.SEARCH_PROVIDER || "").trim().toLowerCase() || "wikipedia";

    if (provider === "wikipedia" || provider === "wiki") {
      const apiUrl = new URL("https://en.wikipedia.org/w/api.php");
      apiUrl.searchParams.set("action", "query");
      apiUrl.searchParams.set("list", "search");
      apiUrl.searchParams.set("srsearch", q);
      apiUrl.searchParams.set("srlimit", "10");
      apiUrl.searchParams.set("utf8", "1");
      apiUrl.searchParams.set("format", "json");
      apiUrl.searchParams.set("origin", "*");

      const r = await fetch(apiUrl.toString(), {
        headers: {
          // Friendly UA is recommended for public Wikimedia APIs.
          "User-Agent": "basic-chrome-search/0.1 (local dev)"
        }
      });
      const json = await r.json();
      if (!r.ok) {
        return res.status(r.status).json({
          error: "Wikipedia API error",
          details: json
        });
      }

      const results = Array.isArray(json?.query?.search) ? json.query.search : [];
      const stripHtml = (s) => String(s || "").replace(/<[^>]*>/g, "");

      return res.json({
        query: q,
        provider: "wikipedia",
        totalResults: json?.query?.searchinfo?.totalhits ? String(json.query.searchinfo.totalhits) : null,
        searchTime: null,
        items: results.map((it) => {
          const title = it?.title || "";
          const slug = encodeURIComponent(title.replaceAll(" ", "_"));
          const link = `/wiki/${slug}`;
          return {
            title,
            link,
            displayLink: "en.wikipedia.org",
            snippet: stripHtml(it?.snippet || "")
          };
        })
      });
    }

    if (provider === "bing") {
      const bingKey = process.env.BING_API_KEY;
      if (!bingKey) {
        return res.status(500).json({
          error: "Missing BING_API_KEY. Copy .env.example to .env and fill it in."
        });
      }

      const url = new URL("https://api.bing.microsoft.com/v7.0/search");
      url.searchParams.set("q", q);
      url.searchParams.set("textDecorations", "false");
      url.searchParams.set("textFormat", "Raw");

      const r = await fetch(url.toString(), {
        headers: { "Ocp-Apim-Subscription-Key": bingKey }
      });
      const json = await r.json();
      if (!r.ok) {
        return res.status(r.status).json({
          error: json?.error?.message || "Bing Search API error",
          details: json
        });
      }

      const items = Array.isArray(json?.webPages?.value) ? json.webPages.value : [];
      return res.json({
        query: q,
        provider: "bing",
        totalResults: json?.webPages?.totalEstimatedMatches
          ? String(json.webPages.totalEstimatedMatches)
          : null,
        searchTime: null,
        items: items.map((it) => ({
          title: it.name || "",
          link: it.url || "",
          displayLink: it.displayUrl || "",
          snippet: it.snippet || ""
        }))
      });
    }

    // Default: Google Custom Search JSON API.
    const apiKey = process.env.GOOGLE_API_KEY;
    const cseId = process.env.GOOGLE_CSE_ID;
    if (!apiKey || !cseId) {
      return res.status(500).json({
        error:
          "Missing GOOGLE_API_KEY / GOOGLE_CSE_ID. If you’re a new Google Custom Search customer in 2026, Google no longer enables API access for new customers—use SEARCH_PROVIDER=bing instead.",
        details: { provider: "google" }
      });
    }

    const url = new URL("https://customsearch.googleapis.com/customsearch/v1");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", cseId);
    url.searchParams.set("q", q);

    // Optional knobs (safe defaults).
    if (req.query.safe) url.searchParams.set("safe", String(req.query.safe));
    if (req.query.start) url.searchParams.set("start", String(req.query.start));

    const r = await fetch(url.toString());
    const json = await r.json();
    if (!r.ok) {
      const message = json?.error?.message || "Google Search API error";
      const forbiddenNoAccess =
        r.status === 403 &&
        typeof message === "string" &&
        message.toLowerCase().includes("does not have the access to custom search json api");

      return res.status(r.status).json({
        error: forbiddenNoAccess
          ? "Google Custom Search JSON API access is blocked for this project (Google docs: not available for new customers; discontinued Jan 1, 2027). Use SEARCH_PROVIDER=bing."
          : message,
        details: json
      });
    }

    const items = Array.isArray(json.items) ? json.items : [];
    return res.json({
      query: q,
      provider: "google",
      totalResults: json?.searchInformation?.formattedTotalResults || null,
      searchTime: json?.searchInformation?.searchTime || null,
      items: items.map((it) => ({
        title: it.title || "",
        link: it.link || "",
        displayLink: it.displayLink || "",
        snippet: it.snippet || ""
      }))
    });
  } catch (e) {
    res.status(500).json({
      error: "Unexpected server error",
      details: { message: e?.message ? String(e.message) : String(e) }
    });
  }
});

const publicDir = path.join(__dirname, "public");
app.use(
  express.static(publicDir, {
    etag: false,
    lastModified: false,
    setHeaders(res) {
      // This is a simple dev app; disable caching so JS/CSS changes apply immediately.
      res.setHeader("Cache-Control", "no-store");
    }
  })
);

// SPA-ish fallback (so /?q= and /wiki/... work on refresh)
// Important: never treat /api/* as SPA routes.
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(publicDir, "index.html"));
});

function listenWithFallback(preferredPort, maxAttempts = 10) {
  const tryListen = (port, attempt) => {
    const server = app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Listening on http://localhost:${port}`);
    });

    server.on("error", (err) => {
      if (err && err.code === "EADDRINUSE" && attempt < maxAttempts) {
        const nextPort = port + 1;
        // eslint-disable-next-line no-console
        console.warn(`Port ${port} in use, trying ${nextPort}…`);
        server.close(() => tryListen(nextPort, attempt + 1));
        return;
      }

      // eslint-disable-next-line no-console
      console.error("Failed to start server:", err);
      process.exit(1);
    });
  };

  tryListen(preferredPort, 1);
}

listenWithFallback(PORT);

