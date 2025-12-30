// functions/requirementsTree.js
//
// Interactive 3-branch Requirement Tree (pan + horizontal scroll).
// Branches:
//   (1) DWAs
//   (2) Skills
//   (3) Tech Skills
//
// NOTE: No fetching here. Pass job data in from dashboard/dataOrg.
//
// Usage:
//   import { buildRequirementTreeBody } from "../functions/requirementsTree.js";
//   const bodyNode = buildRequirementTreeBody({
//     jobTitle,
//     dwas: job.dwas,
//     skills: allSkills,
//     techSkills,
//     onOpenItem: ({ branch, value }) => { ... }
//   });

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function dedupeSort(arr) {
  return Array.from(
    new Set((Array.isArray(arr) ? arr : []).map((x) => String(x || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

function injectStylesOnce() {
  if (document.getElementById("reqTreeStyles")) return;
  const style = document.createElement("style");
  style.id = "reqTreeStyles";
  style.textContent = `
    .rt-wrap{
      position: relative;
      border-radius: 18px;
      background: rgba(255,255,255,.75);
      border: 1px solid rgba(15,23,42,.10);
      overflow: hidden;
    }

    .rt-topbar{
      position: sticky;
      top: 0;
      z-index: 5;
      backdrop-filter: blur(10px);
      background: rgba(255,255,255,.75);
      border-bottom: 1px solid rgba(15,23,42,.08);
      padding: 10px 12px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 10px;
    }

    .rt-title{
      font-weight: 950;
      font-size: 14px;
      line-height: 1.2;
    }
    .rt-sub{
      font-weight: 800;
      color: var(--muted);
      font-size: 12px;
      margin-top: 2px;
    }

    .rt-pills{ display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
    .rt-pill{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding: 8px 10px;
      border-radius: 999px;
      border: 1px solid rgba(15,23,42,.10);
      background: rgba(255,255,255,.85);
      font-weight: 900;
      font-size: 12px;
      cursor: pointer;
      user-select:none;
      transition: transform .15s ease, box-shadow .15s ease;
    }
    .rt-pill:hover{
      transform: translateY(-1px);
      box-shadow: 0 8px 22px rgba(15,23,42,.08);
    }
    .rt-dot{
      width:10px;height:10px;border-radius:999px;
      box-shadow: 0 2px 10px rgba(0,0,0,.10);
    }

    .rt-viewport{
      height: 520px;                 /* scroll area within modal */
      overflow: auto;                /* both directions */
      cursor: grab;
      padding: 14px;
      scroll-behavior: smooth;
      background:
        radial-gradient(circle at 20% 10%, rgba(124,58,237,.08), transparent 42%),
        radial-gradient(circle at 80% 30%, rgba(96,165,250,.08), transparent 45%),
        radial-gradient(circle at 30% 85%, rgba(52,211,153,.08), transparent 45%),
        #ffffff;
    }
    .rt-viewport:active{ cursor: grabbing; }

    .rt-canvas{
      position: relative;
      min-width: 1100px;             /* enables horizontal scroll */
      padding: 24px 16px 24px 16px;
    }

    /* trunk */
    .rt-trunk{
      position:absolute;
      left: 110px;
      top: 40px;
      bottom: 40px;
      width: 6px;
      border-radius: 99px;
      background: rgba(15,23,42,.10);
    }
    .rt-rootNode{
      position: absolute;
      left: 52px;
      top: 30px;
      width: 175px;
      border-radius: 18px;
      border: 1px solid rgba(15,23,42,.10);
      background: rgba(255,255,255,.92);
      box-shadow: 0 10px 30px rgba(15,23,42,.08);
      padding: 12px 12px;
    }
    .rt-rootNode .t{
      font-weight: 950;
      font-size: 13px;
    }
    .rt-rootNode .m{
      margin-top: 6px;
      font-weight: 800;
      color: var(--muted);
      font-size: 12px;
    }

    /* branch columns */
    .rt-branches{
      position: relative;
      display: grid;
      grid-template-columns: 240px 1fr 1fr 1fr; /* root spacer + 3 columns */
      gap: 18px;
      align-items: start;
      padding-left: 240px; /* space for root area */
    }

    .rt-col{
      position: relative;
      padding-top: 6px;
    }

    .rt-colHead{
      position: sticky;
      top: 0;
      z-index: 2;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 8px;
      margin-bottom: 10px;
      padding: 10px 10px;
      border-radius: 16px;
      border: 1px solid rgba(15,23,42,.10);
      background: rgba(255,255,255,.88);
      box-shadow: 0 10px 28px rgba(15,23,42,.06);
    }
    .rt-colHead .h{
      font-weight: 950;
      font-size: 13px;
      display:flex;
      align-items:center;
      gap: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .rt-colHead .c{
      font-weight: 900;
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
    }

    /* connector from trunk to each column header */
    .rt-connector{
      position:absolute;
      left: -18px;
      top: 26px;
      height: 2px;
      width: 18px;
      background: rgba(15,23,42,.12);
      border-radius: 99px;
    }

    /* nodes */
    .rt-node{
      position: relative;
      display:flex;
      gap: 10px;
      align-items:flex-start;
      text-align:left;
      width: 100%;
      padding: 12px 12px;
      border-radius: 16px;
      border: 1px solid rgba(15,23,42,.10);
      background: rgba(255,255,255,.92);
      box-shadow: 0 8px 24px rgba(15,23,42,.06);
      cursor: pointer;
      transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
    }
    .rt-node:hover{
      transform: translateY(-2px);
      box-shadow: 0 16px 36px rgba(15,23,42,.10);
      border-color: rgba(15,23,42,.16);
    }

    .rt-nodeDot{
      width: 12px;
      height: 12px;
      border-radius: 999px;
      margin-top: 4px;
      flex: 0 0 auto;
      box-shadow: 0 4px 14px rgba(0,0,0,.12);
    }

    .rt-nodeBody{ min-width:0; }
    .rt-nodeTitle{
      font-weight: 950;
      font-size: 14px;
      line-height: 1.25;
      color: #0f172a;
    }
    .rt-nodeMeta{
      margin-top: 6px;
      font-weight: 800;
      font-size: 12px;
      color: var(--muted);
    }

    /* subtle vertical line in each column (like a branch) */
    .rt-branchLine{
      position:absolute;
      left: 10px;
      top: 74px;
      bottom: 10px;
      width: 3px;
      border-radius: 99px;
      background: rgba(15,23,42,.08);
    }

    .rt-nodeWrap{
      display:flex;
      flex-direction:column;
      gap: 12px;
      padding-left: 22px; /* space for branch line */
    }
  `;
  document.head.appendChild(style);
}

function branchTheme(branch) {
  if (branch === "dwa") return { label: "Requirement Items (DWAs)", color: "#7c3aed" };
  if (branch === "skill") return { label: "Skills", color: "#60a5fa" };
  return { label: "Technology Skills", color: "#34d399" };
}

function scrollToColumn(viewport, colEl) {
  if (!viewport || !colEl) return;
  const vpRect = viewport.getBoundingClientRect();
  const cRect = colEl.getBoundingClientRect();
  const dx = (cRect.left - vpRect.left) - 14; // align with padding
  viewport.scrollLeft += dx;
}

function enablePan(viewport) {
  let isDown = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const onDown = (clientX, clientY) => {
    isDown = true;
    startX = clientX;
    startY = clientY;
    startLeft = viewport.scrollLeft;
    startTop = viewport.scrollTop;
    viewport.style.cursor = "grabbing";
  };

  const onMove = (clientX, clientY) => {
    if (!isDown) return;
    const dx = clientX - startX;
    const dy = clientY - startY;
    viewport.scrollLeft = startLeft - dx;
    viewport.scrollTop = startTop - dy;
  };

  const onUp = () => {
    isDown = false;
    viewport.style.cursor = "grab";
  };

  // mouse
  viewport.addEventListener("mousedown", (e) => {
    // allow clicking on nodes without starting drag
    if (e.target.closest(".rt-node") || e.target.closest(".rt-pill")) return;
    onDown(e.clientX, e.clientY);
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
  window.addEventListener("mouseup", onUp);

  // touch (single finger)
  viewport.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      // don’t hijack when tapping a node
      if (e.target.closest(".rt-node") || e.target.closest(".rt-pill")) return;
      onDown(t.clientX, t.clientY);
    },
    { passive: true }
  );

  viewport.addEventListener(
    "touchmove",
    (e) => {
      if (!isDown || e.touches.length !== 1) return;
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    },
    { passive: true }
  );

  viewport.addEventListener("touchend", onUp);
}

export function buildRequirementTreeBody({
  jobTitle,
  dwas = [],
  skills = [],
  techSkills = [],
  onOpenItem,
}) {
  injectStylesOnce();

  const D = dedupeSort(dwas);
  const S = dedupeSort(skills);
  const T = dedupeSort(techSkills);

  const root = document.createElement("div");
  root.className = "rt-wrap";

  root.innerHTML = `
    <div class="rt-topbar">
      <div>
        <div class="rt-title">${escapeHtml(jobTitle)}</div>
        <div class="rt-sub">Drag to pan • Scroll to explore • Click a node to drill down</div>
      </div>
      <div class="rt-pills">
        <button class="rt-pill" type="button" data-jump="dwa">
          <span class="rt-dot" style="background:#7c3aed;"></span>
          DWAs <span style="color:var(--muted);font-weight:900;">(${D.length})</span>
        </button>
        <button class="rt-pill" type="button" data-jump="skill">
          <span class="rt-dot" style="background:#60a5fa;"></span>
          Skills <span style="color:var(--muted);font-weight:900;">(${S.length})</span>
        </button>
        <button class="rt-pill" type="button" data-jump="tech_skill">
          <span class="rt-dot" style="background:#34d399;"></span>
          Tech <span style="color:var(--muted);font-weight:900;">(${T.length})</span>
        </button>
      </div>
    </div>

    <div class="rt-viewport" id="rtViewport">
      <div class="rt-canvas">
        <div class="rt-trunk"></div>
        <div class="rt-rootNode">
          <div class="t">Occupation</div>
          <div class="m">${escapeHtml(jobTitle)}</div>
        </div>

        <div class="rt-branches">
          <div></div>

          <div class="rt-col" data-col="dwa">
            <div class="rt-connector"></div>
            <div class="rt-colHead">
              <div class="h"><span class="rt-dot" style="background:#7c3aed;"></span> Requirement Items (DWAs)</div>
              <div class="c">${D.length}</div>
            </div>
            <div class="rt-branchLine"></div>
            <div class="rt-nodeWrap" id="dwaNodes"></div>
          </div>

          <div class="rt-col" data-col="skill">
            <div class="rt-connector"></div>
            <div class="rt-colHead">
              <div class="h"><span class="rt-dot" style="background:#60a5fa;"></span> Skills</div>
              <div class="c">${S.length}</div>
            </div>
            <div class="rt-branchLine"></div>
            <div class="rt-nodeWrap" id="skillNodes"></div>
          </div>

          <div class="rt-col" data-col="tech_skill">
            <div class="rt-connector"></div>
            <div class="rt-colHead">
              <div class="h"><span class="rt-dot" style="background:#34d399;"></span> Technology Skills</div>
              <div class="c">${T.length}</div>
            </div>
            <div class="rt-branchLine"></div>
            <div class="rt-nodeWrap" id="techNodes"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const viewport = root.querySelector("#rtViewport");
  enablePan(viewport);

  function addNodes(container, items, branch) {
    const theme = branchTheme(branch);
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "mini";
      empty.textContent = "No items found.";
      container.appendChild(empty);
      return;
    }

    items.forEach((text, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rt-node";

      btn.innerHTML = `
        <div class="rt-nodeDot" style="background:${theme.color};"></div>
        <div class="rt-nodeBody">
          <div class="rt-nodeTitle">${escapeHtml(text)}</div>
          <div class="rt-nodeMeta">${theme.label} • ${idx + 1} / ${items.length}</div>
        </div>
      `;

      if (typeof onOpenItem === "function") {
        btn.addEventListener("click", () => onOpenItem({ branch, value: text }));
      } else {
        btn.style.cursor = "default";
      }

      container.appendChild(btn);
    });
  }

  addNodes(root.querySelector("#dwaNodes"), D, "dwa");
  addNodes(root.querySelector("#skillNodes"), S, "skill");
  addNodes(root.querySelector("#techNodes"), T, "tech_skill");

  // quick jump pills
  const cols = {
    dwa: root.querySelector('[data-col="dwa"]'),
    skill: root.querySelector('[data-col="skill"]'),
    tech_skill: root.querySelector('[data-col="tech_skill"]'),
  };

  root.querySelectorAll(".rt-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const key = pill.getAttribute("data-jump");
      scrollToColumn(viewport, cols[key]);
    });
  });

  return root;
}
