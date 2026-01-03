// screens/explorer.js
import { loadAndOrganizeData } from "../functions/dataOrg.js";

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function colorForText(text) {
  const colors = ["#7c3aed", "#60a5fa", "#34d399", "#fb7185", "#fbbf24"];
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

function initialsForText(text) {
  const parts = String(text).split(/\s+/).filter(Boolean);
  if (!parts.length) return "C";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

async function loadCategoriesFile() {
  // occupations_by_category.json: { "Category": ["Job Title", ...], ... }
  const r = await fetch("./data/occupations_by_category.json");
  if (!r.ok) throw new Error("Could not load occupations_by_category.json");
  const obj = await r.json();
  return obj && typeof obj === "object" ? obj : {};
}

export async function renderExplorer(root) {
  root.innerHTML = `
    <section class="page">
      <div class="hero">
        <h1>Explorer</h1>
        <p>Browse career categories. Pick a category to see the occupations inside it.</p>
        <div class="hero-chiprow">
          <div class="chip">Categories → Occupations → Details</div>
        </div>
      </div>

      <div class="panel">
        <div class="toolbar">
          <div class="selectWrap">
            <div>
              <label class="small">Career Categories</label><br />
              <div class="mini">Tap a category to explore occupations and wage stats.</div>
            </div>
          </div>

          <div class="selectWrap">
            <button class="btn-ghost" id="refreshBtn" type="button">Refresh</button>
          </div>
        </div>

        <hr class="sep"/>

        <div id="grid" class="grid"></div>
        <div id="emptyState" class="mini" style="display:none;">No categories found.</div>
      </div>
    </section>
  `;

  const grid = root.querySelector("#grid");
  const emptyState = root.querySelector("#emptyState");
  const refreshBtn = root.querySelector("#refreshBtn");

  async function renderGrid() {
    grid.innerHTML = "";
    emptyState.style.display = "none";

    // Load categories file
    const categoryObj = await loadCategoriesFile();

    // Also load ORG so we can count which occupations exist in your unified job map
    // (Optional — but gives nicer counts)
    let ORG = null;
    try {
      ORG = await loadAndOrganizeData();
    } catch {
      ORG = null;
    }

    const categories = Object.keys(categoryObj).sort((a, b) => a.localeCompare(b));
    if (!categories.length) {
      emptyState.style.display = "block";
      return;
    }

    for (const cat of categories) {
      const titles = Array.isArray(categoryObj[cat]) ? categoryObj[cat] : [];
      const count = titles.length;

      // how many of those titles exist in ORG.jobs (if available)
      let knownCount = null;
      if (ORG?.jobs && typeof ORG.jobs.get === "function") {
        let k = 0;
        for (const t of titles) if (ORG.jobs.get(t)) k++;
        knownCount = k;
      }

      const color = colorForText(cat);

      const card = document.createElement("div");
      card.className = "card";
      card.style.cursor = "pointer";

      card.innerHTML = `
        <div class="cardTop">
          <div class="badge" style="background:${color};">${escapeHtml(initialsForText(cat))}</div>
          <div style="min-width:0;">
            <h3 class="cardTitle" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${escapeHtml(cat)}
            </h3>
            <div class="cardMeta">
              ${count} occupation${count === 1 ? "" : "s"}
              ${knownCount === null ? "" : ` • ${knownCount} loaded`}
            </div>
          </div>
        </div>

        <div class="cardActions">
          <button class="btn-ghost" type="button" data-action="open">Open</button>
        </div>
      `;

      const open = () => {
        const qp = new URLSearchParams({ cat });
        window.location.hash = `#/occupations?${qp.toString()}`;
      };

      card.querySelector('[data-action="open"]').addEventListener("click", (e) => {
        e.stopPropagation();
        open();
      });

      card.addEventListener("click", open);

      grid.appendChild(card);
    }
  }

  refreshBtn.addEventListener("click", () => {
    renderGrid().catch((e) => {
      grid.innerHTML = `
        <div class="card">
          <h3 class="cardTitle">Could not load categories</h3>
          <div class="mini">${escapeHtml(e?.message || String(e))}</div>
        </div>
      `;
    });
  });

  renderGrid().catch((e) => {
    grid.innerHTML = `
      <div class="card">
        <h3 class="cardTitle">Could not load categories</h3>
        <div class="mini">${escapeHtml(e?.message || String(e))}</div>
      </div>
    `;
  });
}
