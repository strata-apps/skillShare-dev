// screens/dashboard.js
import { loadAndOrganizeData } from "../functions/dataOrg.js";
import { buildRequirementTreeBody } from "../functions/requirementsTree.js";


// LocalStorage keys (new names since credentials are now DWAs)
const LS_KEY = "wallet_imported_dwa_v1";

function loadImported() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveImported(items) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

function toast(title, body, ms = 3500) {
  const root = document.getElementById("toast-root");
  if (!root) return;

  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `
    <div class="toastTitle">${escapeHtml(title)}</div>
    <div class="toastBody">${escapeHtml(body)}</div>
  `;
  root.appendChild(el);

  const t = setTimeout(() => {
    el.remove();
    clearTimeout(t);
  }, ms);
}

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

  const closeBtn = head.querySelector("button");
  closeBtn.addEventListener("click", () => {
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

function normalizeTechSkills(techSkills) {
  // Accepts: array OR object-of-arrays OR object-of-strings
  const out = [];

  if (Array.isArray(techSkills)) {
    for (const x of techSkills) {
      const s = String(x || "").trim();
      if (s) out.push(s);
    }
    return out;
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

  // dedupe + sort
  return Array.from(new Set(out)).sort((a, b) => a.localeCompare(b));
}

function normalizeTasks(tasks) {
  if (!tasks) return [];
  if (Array.isArray(tasks)) {
    return tasks.map((t) => String(t || "").trim()).filter(Boolean);
  }
  // if tasks came in as object, flatten values
  if (typeof tasks === "object") {
    const out = [];
    for (const v of Object.values(tasks)) {
      if (Array.isArray(v)) out.push(...v);
      else out.push(v);
    }
    return out.map((t) => String(t || "").trim()).filter(Boolean);
  }
  return [String(tasks).trim()].filter(Boolean);
}

function normalizeContexts(contextsObj) {
  // contextsObj: { [context]: [skills...] } (expected)
  // fallback to empty object
  const obj = contextsObj && typeof contextsObj === "object" ? contextsObj : {};
  const contexts = Object.keys(obj).sort((a, b) => a.localeCompare(b));

  const contextRows = contexts.map((ctx) => {
    const skills = (obj[ctx] || [])
      .map((s) => String(s || "").trim())
      .filter((s) => s && s.toLowerCase() !== "nan")
      .sort((a, b) => a.localeCompare(b));
    return { ctx, skills };
  });

  // union skills for “All Skills” bucket
  const allSkillSet = new Set();
  for (const row of contextRows) for (const s of row.skills) allSkillSet.add(s);

  return {
    contexts,
    contextRows,
    allSkills: Array.from(allSkillSet).sort((a, b) => a.localeCompare(b)),
  };
}

export async function renderDashboard(root) {
  root.innerHTML = `
    <section class="page">
      <div class="hero">
        <h1>Wallet</h1>
      </div>

      <div class="panel">
        <div class="toolbar">
          <div class="selectWrap">
            <button class="btn" id="openImportModalBtn" type="button">+ Import Credential</button>
            <button class="btn-ghost" id="clearBtn" type="button">Clear Wallet</button>
          </div>

          <div class="selectWrap">
            <div>
              <label class="small">Wallet</label><br />
              <div id="walletMeta" class="chip">0 imported</div>
            </div>
          </div>
        </div>

        <hr class="sep"/>

        <div id="grid" class="grid"></div>
        <div id="emptyState" class="mini" style="display:none;">
          Your wallet is empty. Click <b>Import Credential</b> to add a DWA.
        </div>
      </div>
    </section>
  `;

  const openImportModalBtn = root.querySelector("#openImportModalBtn");
  const clearBtn = root.querySelector("#clearBtn");

  const grid = root.querySelector("#grid");
  const walletMeta = root.querySelector("#walletMeta");
  const emptyState = root.querySelector("#emptyState");

  // Load & organize all datasets through dataOrg.js
  let ORG;
  try {
    ORG = await loadAndOrganizeData();
  } catch (e) {
    grid.innerHTML = `
      <div class="card">
        <h3 class="cardTitle">Could not load data</h3>
        <div class="cardMeta">Check your JSON files in <code>./data/</code> and <code>functions/dataOrg.js</code>.</div>
        <div class="mini">${escapeHtml(e?.message || String(e))}</div>
      </div>
    `;
    return;
  }

  // Expected shape from dataOrg.js
  // jobs: Map(jobTitle -> { title, description, dwas, contexts, techSkills, tasks })
  // dwaIndex: Map(dwaText -> Set(jobTitle))
  // allDWAs: string[]
  const { jobs, dwaIndex, allDWAs } = ORG;

  // Wallet state (imported credentials = DWA text)
  let imported = loadImported();

  function updateMeta() {
    walletMeta.textContent = `${imported.length} imported`;
  }

  function openRequirementTreeModal(jobTitle) {
    const job = jobs?.get(jobTitle);
    if (!job) {
      toast("Missing job", "Could not find this job in the organized data.");
      return;
    }

    // skills branch = union of context skills
    const { allSkills } = normalizeContexts(job.contexts);

    // tech branch = flattened tech skills
    const techSkills = normalizeTechSkills(job.techSkills);

    const bodyNode = buildRequirementTreeBody({
      jobTitle,
      dwas: job.dwas || [],
      skills: allSkills || [],
      techSkills: techSkills || [],
      // Optional: clicking an item can do something
      onOpenItem: ({ branch, value }) => {
        if (branch === "dwa") {
          // Reuse your existing credential → jobs drilldown
          openCredentialModal(value);
        } else {
          // For now: simple toast (you can wire to a modal later)
          toast("Selected", value);
        }
      },
    });

    createModal({
      title: "Requirement Tree",
      subtitle: jobTitle,
      bodyNode,
    });
  }


  // -------------------------
  // Drilldown: Job Profile
  // -------------------------
  function openJobModal(jobTitle) {
    const job = jobs?.get(jobTitle);
    if (!job) {
      toast("Missing job", "Could not find this job in the organized data.");
      return;
    }

    const description = (job.description && String(job.description).trim()) || "No description available.";

    const { contextRows, allSkills } = normalizeContexts(job.contexts);
    const tasks = normalizeTasks(job.tasks);
    const techSkills = normalizeTechSkills(job.techSkills);

    const body = document.createElement("div");
    body.innerHTML = `

      <div style="margin-top:14px;">
        <div style="font-weight:950; margin-bottom:6px;">Occupation Description</div>
        <div class="pillRow"></div>
      </div>

      <div class="mini"><span style = "font-size:14px;">${escapeHtml(description)}</span></div>

      <!-- NEW BUTTON -->
      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn" id="openReqTreeBtn" type="button">Open Requirement Tree</button>
      </div>

      <hr class="sep" />

      <div style="margin-top:14px;">
        <div style="font-weight:950; margin-bottom:6px;">All Skills (unique)</div>
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

    const ctxList = body.querySelector("#ctxList");
    const allSkillsEl = body.querySelector("#allSkills");
    const taskList = body.querySelector("#taskList");
    const techSkillsEl = body.querySelector("#techSkills");

    // requirement tree button wiring 
    const openReqTreeBtn = body.querySelector("#openReqTreeBtn");
    openReqTreeBtn.addEventListener("click", () => openRequirementTreeModal(jobTitle));


    // all skills
    if (!allSkills.length) {
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

    // tech skills
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
      subtitle: "Occupation Profile",
      bodyNode: body,
    });
  }

  // -----------------------------------
  // Drilldown: Credential → Jobs list
  // -----------------------------------
  function openCredentialModal(dwaText) {
    const jobSet = dwaIndex?.get(dwaText);
    const jobTitles = jobSet ? Array.from(jobSet).sort((a, b) => a.localeCompare(b)) : [];

    const body = document.createElement("div");
    body.innerHTML = `
      <div class="mini">
        This credential is associated with <b>${jobTitles.length}</b> occupation${jobTitles.length === 1 ? "" : "s"}.
        Click an occupation to explore its description, skills, and tasks.
      </div>

      <hr class="sep"/>

      <div class="list" id="jobList"></div>
    `;

    const jobList = body.querySelector("#jobList");

    if (!jobTitles.length) {
      jobList.innerHTML = `<div class="mini">No occupations found for this credential.</div>`;
    } else {
      for (const job of jobTitles) {
        const row = document.createElement("div");
        row.className = "contextItem";
        row.style.cursor = "pointer";
        row.innerHTML = `
          <div class="contextName">${escapeHtml(job)}</div>
          <div class="contextJobs">Click to explore this occupation →</div>
        `;
        row.addEventListener("click", () => openJobModal(job));
        jobList.appendChild(row);
      }
    }

    createModal({
      title: "Credential",
      subtitle: dwaText,
      bodyNode: body,
    });
  }

  // -------------------
  // Import Modal (DWAs)
  // -------------------
  function openImportModal() {
    let query = "";
    let selected = allDWAs[0] || "";

    const body = document.createElement("div");
    body.innerHTML = `
      <div class="mini">
        Choose a DWA credential to import into your wallet.
      </div>

      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <input
          id="credSearch"
          type="text"
          placeholder="Search credentials..."
          style="flex:1; min-width:220px; padding:10px 12px; border-radius:12px; border:1px solid rgba(229,231,235,.95); font-weight:700;"
        />
        <button class="btn" id="confirmImportBtn" type="button">Import</button>
      </div>

      <div style="margin-top:12px;" class="panel">
        <div id="credList" style="max-height: 320px; overflow:auto; padding:6px;"></div>
      </div>

      <div class="mini" style="margin-top:10px;">
        Tip: Imported credentials appear as cards on your Dashboard.
      </div>
    `;

    const importedSet = new Set(imported);

    const listEl = body.querySelector("#credList");
    const searchEl = body.querySelector("#credSearch");
    const confirmBtn = body.querySelector("#confirmImportBtn");

    function renderList() {
      const q = query.trim().toLowerCase();

      const filtered = allDWAs.filter((d) => {
        if (!q) return true;
        return d.toLowerCase().includes(q);
      });

      // not-imported first
      filtered.sort((a, b) => {
        const ai = importedSet.has(a) ? 1 : 0;
        const bi = importedSet.has(b) ? 1 : 0;
        if (ai !== bi) return ai - bi;
        return a.localeCompare(b);
      });

      if (!filtered.includes(selected)) selected = filtered[0] || "";

      listEl.innerHTML = "";

      if (!filtered.length) {
        listEl.innerHTML = `<div class="mini" style="padding:10px;">No credentials match your search.</div>`;
        return;
      }

      for (const dwaText of filtered) {
        const isImported = importedSet.has(dwaText);
        const isSelected = selected === dwaText;

        const color = colorForText(dwaText);

        const row = document.createElement("button");
        row.type = "button";
        row.className = "btn-ghost";
        row.style.cssText = `
          width:100%;
          text-align:left;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding:10px 12px;
          margin:6px 0;
          border-radius:14px;
          border: 1px solid rgba(15,23,42,.10);
          background: ${isSelected ? "rgba(124,58,237,.10)" : "transparent"};
          opacity: ${isImported ? "0.55" : "1"};
        `;

        const jobCount = (dwaIndex?.get(dwaText)?.size || 0);

        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; min-width:0;">
            <div class="badge" style="width:34px;height:34px;border-radius:12px;background:${color};">
              ${escapeHtml(initialsForText(dwaText))}
            </div>
            <div style="min-width:0;">
              <div style="font-weight:950; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${escapeHtml(dwaText)}
              </div>
              <div style="font-size:12px;color:var(--muted);font-weight:700;">
                ${isImported ? "Already imported" : `${jobCount} occupation${jobCount === 1 ? "" : "s"}`}
              </div>
            </div>
          </div>
          <div style="font-weight:950;">
            ${isImported ? "✓" : "→"}
          </div>
        `;

        row.addEventListener("click", () => {
          selected = dwaText;
          renderList();
        });

        listEl.appendChild(row);
      }
    }

    function doImport() {
      if (!selected) return;

      if (imported.includes(selected)) {
        toast("Already in wallet", "That credential is already imported.");
        return;
      }

      imported = [selected, ...imported];
      saveImported(imported);
      renderGrid();

      toast("Credential Imported", "Added to wallet.");
      document.querySelector(".modalOverlay")?.remove();
    }

    searchEl.addEventListener("input", (e) => {
      query = e.target.value || "";
      renderList();
    });

    confirmBtn.addEventListener("click", doImport);

    renderList();

    createModal({
      title: "Import Credential",
      subtitle: "Select a DWA item to add to your wallet",
      bodyNode: body,
    });

    setTimeout(() => searchEl.focus(), 30);
  }

  // -------------------
  // Wallet Grid
  // -------------------
  function renderGrid() {
    updateMeta();

    grid.innerHTML = "";
    if (!imported.length) {
      emptyState.style.display = "block";
      return;
    }
    emptyState.style.display = "none";

    for (const dwaText of imported) {
      const color = colorForText(dwaText);
      const jobCount = (dwaIndex?.get(dwaText)?.size || 0);

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <div class="cardTop">
          <div class="badge" style="background:${color};">${escapeHtml(initialsForText(dwaText))}</div>
          <div style="min-width:0;">
            <h3 class="cardTitle" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${escapeHtml(dwaText)}
            </h3>
            <div class="cardMeta">${jobCount} related job${jobCount === 1 ? "" : "s"}</div>
          </div>
        </div>

        <div class="cardActions">
          <button class="btn-ghost" type="button" data-action="inspect">Inspect</button>
          <button class="btn-ghost" type="button" data-action="remove">Remove</button>
        </div>
      `;

      card.querySelector('[data-action="inspect"]').addEventListener("click", () => {
        openCredentialModal(dwaText);
      });

      card.querySelector('[data-action="remove"]').addEventListener("click", () => {
        imported = imported.filter((x) => x !== dwaText);
        saveImported(imported);
        renderGrid();
      });

      card.addEventListener("click", (e) => {
        const t = e.target;
        if (t && t.closest && t.closest("button")) return;
        openCredentialModal(dwaText);
      });

      grid.appendChild(card);
    }
  }

  // Buttons
  openImportModalBtn.addEventListener("click", openImportModal);

  clearBtn.addEventListener("click", () => {
    imported = [];
    saveImported(imported);
    renderGrid();
    toast("Wallet cleared", "All imported credentials removed.");
  });

  // Initial render
  renderGrid();
}
