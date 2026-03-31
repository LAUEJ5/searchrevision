/* global chrome */

(() => {
  const g = globalThis;
  g.__NOTETAKR__ = g.__NOTETAKR__ || {};
  g.__NOTETAKR__.panel = g.__NOTETAKR__.panel || {};

  const ns = g.__NOTETAKR__.panel;
  const { els } = ns;

  const DEMO_URL = "https://en.wikipedia.org/wiki/The_Goldfinch_(painting)";

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") n.className = String(v);
      else if (k === "text") n.textContent = String(v);
      else if (k === "html") n.innerHTML = String(v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, String(v));
    }
    for (const c of children) n.appendChild(c);
    return n;
  }

  function openDemoPage() {
    chrome.runtime.sendMessage({ type: "openUrl", url: DEMO_URL }, () => {});
  }

  const steps = [
    {
      title: "Welcome to Notetakr",
      html: `
        <p>We’ll cover:</p>
        <ul>
          <li>Clipping highlighted text from a webpage</li>
          <li>Return-to-source ↩ links (URL + scroll position)</li>
          <li>Highlight-to-search from inside notes</li>
          <li>Saving and reloading notes</li>
        </ul>
      `
    },
    {
      title: "Clipping (webpage → notes)",
      html: `
        <p>On the Wikipedia page, highlighted text can be clipped into your notes.</p>
        <ul>
          <li>An <strong>Add to notes</strong> button appears near the selection.</li>
          <li>The clipped text is appended into the notes editor.</li>
        </ul>
        <div class="srTutHint">
          The clipper also stamps the page URL + scroll position into the ↩ metadata for each pasted line.
        </div>
      `
    },
    {
      title: "Return to source (↩)",
      html: `
        <p>Each non-empty line can have a ↩ button in the gutter.</p>
        <ul>
          <li>↩ stores the source URL and scroll position.</li>
          <li>Using ↩ reopens the source and restores your approximate reading position.</li>
        </ul>
      `
    },
    {
      title: "Context for typed lines",
      html: `
        <p>Notetakr can also capture context for lines you type while browsing.</p>
        <ul>
          <li>When you press <strong>Enter</strong>, Notetakr records the current tab’s URL + scroll position for the line you just finished.</li>
        </ul>
        <div class="srTutHint">
          This keeps ↩ links accurate even as you move between pages while taking notes.
        </div>
      `
    },
    {
      title: "Highlight-to-search (notes → Google)",
      html: `
        <p>Highlighted text inside your notes can be searched instantly.</p>
        <ul>
          <li>An <strong>Add to search</strong> button appears when text is highlighted.</li>
          <li>It searches the highlighted text in your current tab.</li>
        </ul>
      `
    },
    {
      title: "Save + reload (.txt)",
      html: `
        <p>Notes can be saved to a plain <strong>.txt</strong> file and re-opened later.</p>
        <ul>
          <li>Saving includes your text plus ↩ metadata.</li>
          <li>Re-opening restores the text and the ↩ links.</li>
        </ul>
        <div class="srTutHint">
          ↩ metadata is embedded at the end of the .txt file between marker lines.
        </div>
      `
    }
  ];

  let backdrop = null;
  let stepIdx = 0;

  function render() {
    if (!backdrop) return;
    const card = backdrop.querySelector(".srTutCard");
    if (!card) return;
    const step = steps[stepIdx];

    const titleEl = card.querySelector("[data-sr-title]");
    const bodyEl = card.querySelector("[data-sr-body]");
    const prevBtn = card.querySelector("[data-sr-prev]");
    const nextBtn = card.querySelector("[data-sr-next]");
    const counterEl = card.querySelector("[data-sr-counter]");

    if (titleEl) titleEl.textContent = step?.title || "Tutorial";
    if (bodyEl) bodyEl.innerHTML = step?.html || "";
    if (counterEl) counterEl.textContent = `${stepIdx + 1} / ${steps.length}`;

    if (prevBtn) prevBtn.disabled = stepIdx === 0;
    if (nextBtn) nextBtn.textContent = stepIdx === steps.length - 1 ? "Done" : "Next";

    // no per-step wiring needed
  }

  function close() {
    if (!backdrop) return;
    backdrop.remove();
    backdrop = null;
  }

  function start() {
    // Auto-navigate to demo page on tutorial start.
    openDemoPage();

    if (backdrop) {
      stepIdx = 0;
      render();
      return;
    }

    backdrop = el("div", { class: "srTutBackdrop", role: "dialog", "aria-modal": "true" }, [
      el("div", { class: "srTutCard" }, [
        el("div", { class: "srTutHeader" }, [
          el("div", { class: "srTutTitle", "data-sr-title": "true", text: "Tutorial" }),
          el("button", { class: "srTutClose", type: "button", "aria-label": "Close tutorial", onclick: close }, [
            el("span", { text: "×", "aria-hidden": "true" })
          ])
        ]),
        el("div", { class: "srTutBody", "data-sr-body": "true" }),
        el("div", { class: "srTutActions" }, [
          el("div", { class: "srTutCounter", "data-sr-counter": "true", text: "1 / 1" }),
          el("div", { class: "srTutNav" }, [
            el("button", { class: "srTutBtn", type: "button", "data-sr-prev": "true" }, []),
            el("button", { class: "srTutBtn srTutBtnPrimary", type: "button", "data-sr-next": "true" }, [])
          ])
        ])
      ])
    ]);

    document.body.appendChild(backdrop);

    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) close();
    });
    document.addEventListener(
      "keydown",
      (e) => {
        if (!backdrop) return;
        if (e.key === "Escape") close();
      },
      { capture: true }
    );

    const prevBtn = backdrop.querySelector("[data-sr-prev]");
    const nextBtn = backdrop.querySelector("[data-sr-next]");

    if (prevBtn) {
      prevBtn.textContent = "Back";
      prevBtn.addEventListener("click", () => {
        stepIdx = Math.max(0, stepIdx - 1);
        render();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (stepIdx >= steps.length - 1) return close();
        stepIdx = Math.min(steps.length - 1, stepIdx + 1);
        render();
      });
    }

    stepIdx = 0;
    render();
  }

  els?.infoBtn?.addEventListener?.("click", () => start());
})();

