// screens/occupations.js
import { loadAndOrganizeData } from "../functions/dataOrg.js";
import { buildRequirementTreeBody } from "../functions/requirementsTree.js";

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeTitle(s = "") {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s*&\s*/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeArray(x) {
  return Array.isArray(x) ? x.filter(Boolean) : [];
}

function normalizeTechSkills(techSkills) {
  const out = [];
  if (Array.isArray(techSkills)) {
    for (const x of techSkills) {
      const s = String(x || "").trim();
      if (s) out.push(s);
    }
    return Array.from(new Set(out)).sort((a, b) => a.localeCompare(b));
  }
  if (techSkills && typeof techSkills === "object") {
    for (const v of Object.values(techSkills)) {
      if (Array.isArray(v)) {
        for (const x of v) {
          const s = String(x || "").trim();
          if (s) out.push(s);
        }
      } else {
        const s = String(v || "").trim();
        if (s) out.push(s);
      }
    }
  }
  return Array.from(new Set(out)).sort((a, b) => a.localeCompare(b));
}

function normalizeTasks(tasks) {
  if (!tasks) return [];
  if (Array.isArray(tasks)) {
    return tasks.map((t) => String(t || "").trim()).filter(Boolean);
  }
  if (typeof tasks === "object") {
    const out = [];
    for (const v of Object.values(tasks)) out.push(...(Array.isArray(v) ? v : [v]));
    return out.map((t) => String(t || "").trim()).filter(Boolean);
  }
  return [String(tasks).trim()].filter(Boolean);
}

function normalizeContexts(contextsObj) {
  const obj = contextsObj && typeof contextsObj === "object" ? contextsObj : {};
  const contexts = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  const contextRows = contexts.map((ctx) => {
    const skills = (obj[ctx] || [])
      .map((s) => String(s || "").trim())
      .filter((s) => s && s.toLowerCase() !== "nan")
      .sort((a, b) => a.localeCompare(b));
    return { ctx, skills };
  });

  const allSkillSet = new Set();
  for (const row of contextRows) for (const s of row.skills) allSkillSet.add(s);

  return {
    contexts,
    contextRows,
    allSkills: Array.from(allSkillSet).sort((a, b) => a.localeCompare(b)),
  };
}

function createModal({ title, subtitle, bodyNode, onClose }) {
  const overlay = document.createElement("div");
  overlay.className = "modalOverlay";

  const modal = document.createElement("div");
  modal.className = "modal";

  const head = document.createElement("div");
  head.className = "modalHead";
  head.innerHTML = `
    <div>
      <h3 class="modalTitle">${escapeHtml(title)}</h3>
      <div class="modalSub">${escapeHtml(subtitle || "")}</div>
    </div>
    <button class="iconBtn" type="button">Back</button>
  `;

  head.querySelector("button").addEventListener("click", () => {
    overlay.remove();
    onClose?.();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.remove();
      onClose?.();
    }
  });

  const body = document.createElement("div");
  body.className = "modalBody";
  body.appendChild(bodyNode);

  modal.appendChild(head);
  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

async function loadCategoriesFile() {
  const r = await fetch("./data/occupations_by_category.json");
  if (!r.ok) throw new Error("Could not load occupations_by_category.json");
  const obj = await r.json();
  return obj && typeof obj === "object" ? obj : {};
}

async function loadWagesFile() {
  // wages_by_occupation.json: { "Job Title": [ {A_MEAN,H_MEAN,...}, ...], ... }
  const r = await fetch("./data/wages_by_occupation.json");
  if (!r.ok) throw new Error("Could not load wages_by_occupation.json");
  const obj = await r.json();
  return obj && typeof obj === "object" ? obj : {};
}

function buildWagesIndex(wagesObj) {
  const idx = new Map(); // normalizedTitle -> records[]
  for (const rawTitle of Object.keys(wagesObj || {})) {
    const key = normalizeTitle(rawTitle);
    const recs = safeArray(wagesObj[rawTitle]);
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push(...recs);
  }
  return idx;
}

function pickWageSummary(records) {
  const recs = safeArray(records);
  if (!recs.length) return null;
  const best =
    recs.find((r) => r && (r.A_MEAN || r.H_MEAN || r.A_MEDIAN || r.H_MEDIAN)) || recs[0];
  return best || null;
}

function fmtMoneyOrBlank(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  } catch {
    return String(n);
  }
}

export async function renderOccupations(root) {
  // parse category from hash (#/occupations?cat=...)
  const hash = window.location.hash || "";
  const qs = hash.includes("?") ? hash.split("?")[1] : "";
  const params = new URLSearchParams(qs);
  const category = params.get("cat") || "";

  root.innerHTML = `
    <section class="page">
      <div class="hero">
        <h1>${escapeHtml(category || "Occupations")}</h1>
        <p>Filter occupations, then click one to view wage stats + full occupation details.</p>
        <div class="hero-chiprow">
          <a class="chip" href="#/explorer" style="text-decoration:none; color:#fff;">← Back to Categories</a>
        </div>
      </div>

      <div class="panel">
        <div class="toolbar">
          <div class="selectWrap" style="flex:1;">
            <div style="flex:1; min-width:240px;">
              <label class="small">Filter</label><br />
              <input
                id="filterInput"
                type="text"
                placeholder="Search occupations..."
                style="width:100%; padding:10px 12px; border-radius:12px; border:1px solid rgba(229,231,235,.95); font-weight:800;"
              />
              <div class="mini" id="countMeta"></div>
            </div>
          </div>

          <div class="selectWrap">
            <button class="btn-ghost" id="clearFilterBtn" type="button">Clear</button>
          </div>
        </div>

        <hr class="sep"/>

        <div id="list" class="list"></div>
        <div id="emptyState" class="mini" style="display:none;">No occupations found.</div>
      </div>
    </section>
  `;

  const filterInput = root.querySelector("#filterInput");
  const clearFilterBtn = root.querySelector("#clearFilterBtn");
  const list = root.querySelector("#list");
  const emptyState = root.querySelector("#emptyState");
  const countMeta = root.querySelector("#countMeta");

  // Load all needed data
  const [catObj, wagesObj, ORG] = await Promise.all([
    loadCategoriesFile(),
    loadWagesFile(),
    loadAndOrganizeData(),
  ]);

  const wagesIndex = buildWagesIndex(wagesObj);

  const titlesRaw = safeArray(catObj[category] || []);
  const titles = titlesRaw.slice().sort((a, b) => a.localeCompare(b));

  function openRequirementTreeModal(jobTitle) {
    const job = ORG?.jobs?.get(jobTitle);
    if (!job) return;

    const { allSkills } = normalizeContexts(job.contexts);
    const techSkills = normalizeTechSkills(job.techSkills);

    const bodyNode = buildRequirementTreeBody({
      jobTitle,
      dwas: job.dwas || [],
      skills: allSkills || [],
      techSkills: techSkills || [],
      onOpenItem: ({ branch, value }) => {
        // Lightweight: for now just a toast-like alert
        // (You can wire this to your credential/job drilldown later if you want.)
        console.log("Selected", branch, value);
      },
    });

    createModal({
      title: "Requirement Tree",
      subtitle: jobTitle,
      bodyNode,
    });
  }

  function openOccupationModal(jobTitle) {
    const job = ORG?.jobs?.get(jobTitle);
    const norm = normalizeTitle(jobTitle);
    const wageRecs = wagesIndex.get(norm) || [];
    const wageSummary = pickWageSummary(wageRecs);

    const A_MEAN = wageSummary?.A_MEAN ?? "";
    const H_MEAN = wageSummary?.H_MEAN ?? "";

    const description =
      (job?.description && String(job.description).trim()) || "No description available.";

    const { allSkills } = normalizeContexts(job?.contexts);
    const tasks = normalizeTasks(job?.tasks);
    const techSkills = normalizeTechSkills(job?.techSkills);

    const body = document.createElement("div");
    body.innerHTML = `
      <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-bottom:10px;">
        <div class="chip" style="color:black; font-weight:950; font-size:24px;">
          Annual Mean: <b style="margin-left:6px;">${escapeHtml(fmtMoneyOrBlank(A_MEAN) || "")}</b>
        </div>
        <div class="chip" style="color:black; font-weight:950; font-size:24px;">
          Hourly Mean: <b style="margin-left:6px;">${escapeHtml(fmtMoneyOrBlank(H_MEAN) || "")}</b>
        </div>
      </div>

      <hr class="sep" />

      <div style="margin-top:14px;">
        <div style="font-weight:950; margin-bottom:6px;">Occupation Description</div>
      </div>
      <div class="mini"><span style="font-size:14px;">${escapeHtml(description)}</span></div>

      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
        <button class="btn" id="openReqTreeBtn" type="button">Open Requirement Tree</button>
      </div>

      <hr class="sep" />

      <div style="margin-top:14px;">
        <div style="font-weight:950; margin-bottom:6px;">Skills</div>
        <div class="pillRow" id="allSkills"></div>
      </div>

      <hr class="sep" />

      <div style="margin-top:10px;">
        <div style="font-weight:950; margin-bottom:6px;">Tasks</div>
        <ul id="taskList" style="margin:0; padding-left:18px;"></ul>
      </div>

      <div style="margin-top:14px;">
        <div style="font-weight:950; margin-bottom:6px;">Technology Skills</div>
        <div class="pillRow" id="techSkills"></div>
      </div>
    `;

    const allSkillsEl = body.querySelector("#allSkills");
    const taskList = body.querySelector("#taskList");
    const techSkillsEl = body.querySelector("#techSkills");
    const openReqTreeBtn = body.querySelector("#openReqTreeBtn");

    openReqTreeBtn.addEventListener("click", () => openRequirementTreeModal(jobTitle));

    // skills pills
    if (!allSkills?.length) {
      allSkillsEl.innerHTML = `<div class="mini">No skills found.</div>`;
    } else {
      for (const s of allSkills) {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = s;
        allSkillsEl.appendChild(pill);
      }
    }

    // tasks
    if (!tasks.length) {
      taskList.innerHTML = `<li class="mini">No tasks found.</li>`;
    } else {
      for (const t of tasks) {
        const li = document.createElement("li");
        li.textContent = t;
        taskList.appendChild(li);
      }
    }

    // tech skills pills
    if (!techSkills.length) {
      techSkillsEl.innerHTML = `<div class="mini">No technology skills found.</div>`;
    } else {
      for (const ts of techSkills) {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = ts;
        techSkillsEl.appendChild(pill);
      }
    }

    createModal({
      title: jobTitle,
      subtitle: category ? `Category: ${category}` : "Occupation Profile",
      bodyNode: body,
    });
  }

  function renderList() {
    const q = String(filterInput.value || "").trim().toLowerCase();
    const filtered = titles.filter((t) => (!q ? true : t.toLowerCase().includes(q)));

    countMeta.textContent = `${filtered.length} shown • ${titles.length} total`;

    list.innerHTML = "";
    if (!filtered.length) {
      emptyState.style.display = "block";
      return;
    }
    emptyState.style.display = "none";

    for (const title of filtered) {
      const jobExists = !!ORG?.jobs?.get(title);
      const wageSummary = pickWageSummary(wagesIndex.get(normalizeTitle(title)) || []);
      const a = wageSummary?.A_MEAN ? fmtMoneyOrBlank(wageSummary.A_MEAN) : "";
      const h = wageSummary?.H_MEAN ? fmtMoneyOrBlank(wageSummary.H_MEAN) : "";

      const row = document.createElement("div");
      row.className = "contextItem";
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="contextName">${escapeHtml(title)}</div>
        <div class="contextJobs">
          ${jobExists ? "Click to view details →" : "No profile loaded for this title (but wages/categories may exist)."}
          ${a || h ? ` • Average Annual Income: ${escapeHtml(a || "—")} • Average Hourly Wage: ${escapeHtml(h || "—")}` : ""}
        </div>
      `;

      row.addEventListener("click", () => openOccupationModal(title));
      list.appendChild(row);
    }
  }

  filterInput.addEventListener("input", renderList);
  clearFilterBtn.addEventListener("click", () => {
    filterInput.value = "";
    renderList();
    filterInput.focus();
  });

  // Initial
  renderList();
  setTimeout(() => filterInput.focus(), 50);
}
