// screens/ids.js
import buildIdEmail from "../functions/email_ID.js";
import emailAPI from "../functions/email_API.js";


function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(iso);
  }
}

function labelizeKey(k) {
  return String(k)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function iconForType(cardType = "") {
  const t = String(cardType).toLowerCase();
  if (t.includes("student")) return "🎓";
  if (t.includes("driver")) return "🚗";
  if (t.includes("passport")) return "🛂";
  if (t.includes("business")) return "💼";
  return "🪪";
}

function brandColorForType(cardType = "") {
  const t = String(cardType).toLowerCase();
  if (t.includes("student")) return "#0ea5e9";
  if (t.includes("driver")) return "#22c55e";
  if (t.includes("passport")) return "#111827";
  if (t.includes("business")) return "#a855f7";
  return "#2563eb";
}

async function loadIDs() {
  const r = await fetch("./data/ids.json");
  if (!r.ok) throw new Error("Could not load ids.json");
  const j = await r.json();
  return Array.isArray(j?.ids) ? j.ids : [];
}

function getQuery() {
  const hash = window.location.hash || "#/ids";
  const qs = hash.includes("?") ? hash.split("?")[1] : "";
  return new URLSearchParams(qs);
}

function setHashWithId(id) {
  const qp = new URLSearchParams();
  if (id) qp.set("id", id);
  window.location.hash = `#/ids${id ? "?" + qp.toString() : ""}`;
}

function renderList(root, ids) {
  root.innerHTML = `
    <section class="idsPage">
      <div class="idsTop">
        <div class="idsTopLeft">
          <a class="idsBackLink" href="#/dashboard">← Wallet</a>
          <div class="idsTitleRow">
            <div class="idsIcon">👤</div>
            <div class="idsTitle">IDs</div>
          </div>
        </div>

        <div class="idsTopRight">
          <button class="idsRoundBtn" type="button" title="Add">＋</button>
          <button class="idsRoundBtn" type="button" title="More">⋯</button>
        </div>
      </div>

      <div class="idsList">
        ${ids
          .map((it) => {
            const active = String(it?.status || "").toLowerCase() === "active";
            const badge = active ? "ACTIVE" : (it?.status || "STATUS");
            const color = brandColorForType(it?.card_type || it?.id_name);

            const org = it?.issuer?.organization || it?.details?.institution || "";
            const subtitle = org ? org : (it?.issuer?.jurisdiction || it?.issuer?.campus || "");

            return `
                <div class="idWaveCard" data-id="${escapeHtml(it?.id_id)}" style="--wave:${escapeHtml(color)};">
                    <!-- Decorative wave header (like your example) -->
                    <svg class="idWaveSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 320" preserveAspectRatio="none">
                    <path fill="var(--wave)" fill-opacity="0.85"
                        d="M0,128L48,154.7C96,181,192,235,288,261.3C384,288,480,288,576,266.7C672,245,768,203,864,192C960,181,1056,203,1152,224C1248,245,1344,267,1392,277.3L1440,288L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"></path>
                    </svg>

                    <div class="idWaveBody">
                    <div class="idWaveTopRow">
                        <div class="idWaveBadge ${active ? "active" : ""}">
                        ${escapeHtml(active ? "ACTIVE" : (it?.status || "STATUS"))}
                        </div>

                        <div class="idWaveActions">
                        <button class="idOpenBtn" type="button">Open</button>
                        <button class="idKebabBtn" type="button" title="More">⋯</button>
                        </div>
                    </div>

                    <div class="idWaveMain">
                        <div class="idWaveIcon">${escapeHtml(iconForType(it?.card_type || it?.id_name))}</div>

                        <div class="idWaveText">
                        <div class="idWaveName">${escapeHtml(it?.id_name || it?.card_type || "ID")}</div>
                        <div class="idWaveSub">${escapeHtml(subtitle)}</div>
                        </div>
                    </div>
                    </div>
                </div>
            `;

          })
          .join("")}
      </div>
    </section>
  `;

  root.querySelectorAll(".idWaveCard").forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.getAttribute("data-id");
      setHashWithId(id);
    });
  });

  root.querySelectorAll(".idOpenBtn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const card = e.target.closest(".idWaveCard");
        const id = card?.getAttribute("data-id");
        setHashWithId(id);
    });
  });


  // prevent buttons from double-firing
  root.querySelectorAll(".idOpenBtn, .idKebabBtn").forEach((btn) => {
    btn.addEventListener("click", (e) => e.stopPropagation());
  });
}

function renderDetail(root, item) {
  if (!item) {
    root.innerHTML = `
      <section class="idsPage">
        <div class="panel">
          <h3 class="cardTitle">ID not found</h3>
          <a class="btn-ghost" href="#/ids">← Back to IDs</a>
        </div>
      </section>
    `;
    return;
  }

  const color = brandColorForType(item?.card_type || item?.id_name);
  const active = String(item?.status || "").toLowerCase() === "active";

  const title = item?.id_name || item?.card_type || "ID";
  const org = item?.issuer?.organization || item?.details?.institution || "";
  const subtitle = org || item?.issuer?.jurisdiction || item?.issuer?.campus || "";

  const holder = item?.holder?.full_name || "";
  const issuedOn = fmtDate(item?.issued_on);
  const issuedBy = item?.issuer?.organization || "";
  const campus = item?.issuer?.campus || item?.details?.campus || item?.details?.institution || "";
  const cardType = item?.card_type || "";

  const detailsObj = item?.details && typeof item.details === "object" ? item.details : {};
  const detailRows = Object.entries(detailsObj);

  root.innerHTML = `
    <section class="idDetailPage">
      <div class="idDetailTop">
        <a class="idDetailBack" href="#/ids">←</a>
        <div class="idDetailHead">
          <div class="idDetailTitle">${escapeHtml(title).toUpperCase()}</div>
          <div class="idDetailSub">${escapeHtml(subtitle)}</div>
          <div class="idDetailStatus ${active ? "active" : ""}">
            ${active ? "ACTIVE ID" : escapeHtml(item?.status || "STATUS")}
          </div>
        </div>
      </div>

      <div class="idPreviewCard" style="border-top-color:${escapeHtml(color)}">
        <div class="idPreviewLeft">
          <div class="idPreviewAvatar"></div>
          <div class="idPreviewName">${escapeHtml(holder || "Card Holder")}</div>
        </div>
        <div class="idPreviewRight">
          <div class="idPreviewOrg">${escapeHtml(issuedBy || subtitle || "Issuer")}</div>
          <div class="idPreviewEmoji">${escapeHtml(iconForType(cardType || title))}</div>
        </div>
      </div>

      <div class="idDetailSheet">
        <div class="idDetailSectionTitle">Details</div>

        <div class="idDetailGrid">
          <div class="idDetailKey">Issued To</div>
          <div class="idDetailVal">${escapeHtml(holder)}</div>

          <div class="idDetailKey">Card Type</div>
          <div class="idDetailVal">${escapeHtml(cardType)}</div>

          <div class="idDetailKey">Campus</div>
          <div class="idDetailVal">${escapeHtml(campus)}</div>

          <div class="idDetailKey">Issued On</div>
          <div class="idDetailVal">${escapeHtml(issuedOn)}</div>

          <div class="idDetailKey">Issued By</div>
          <div class="idDetailVal">${escapeHtml(issuedBy)}</div>

          ${
            detailRows.length
              ? `<div class="idDetailDivider"></div>
                 ${detailRows
                   .map(([k, v]) => {
                     const val = v === null || v === undefined ? "" : String(v);
                     return `
                      <div class="idDetailKey">${escapeHtml(labelizeKey(k))}</div>
                      <div class="idDetailVal">${escapeHtml(val)}</div>
                     `;
                   })
                   .join("")}`
              : ""
          }
        </div>

        <div class="idDetailActions">
          <button class="idShareBtn" type="button">📤 Share</button>
          <button class="idDeleteBtn" type="button">🗑️ Delete</button>
        </div>

      </div>
    </section>
  `;

  // (placeholder) delete action
  root.querySelector(".idDeleteBtn")?.addEventListener("click", () => {
    alert("Delete is a placeholder in this version.");
  });

    // Share action: sign in -> preview -> input recipient -> send
  root.querySelector(".idShareBtn")?.addEventListener("click", async () => {
    try {
      // 1) Build email content
      const { subject, html } = buildIdEmail(item, { brandName: "Digital Credential Wallet" });

      // 2) Ensure Gmail auth (prompts if not yet granted)
      await emailAPI.ensureSignedIn();

      // 3) Preview + recipient modal
      const to = await openShareModal({ subject, html });
      if (!to) return; // user cancelled

      // 4) Send
      await emailAPI.sendHtml({ to, subject, html });
      alert("✅ ID shared successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to share ID.\n\n" + (e?.message || e));
    }
  });

  function openShareModal({ subject, html }) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.background = "rgba(0,0,0,.35)";
      overlay.style.zIndex = "9999";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close(null);
      });

      const card = document.createElement("div");
      card.className = "card";
      card.style.width = "min(900px, 94vw)";
      card.style.maxHeight = "86vh";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.gap = "10px";
      card.style.padding = "14px";
      card.style.overflow = "hidden";

      const head = document.createElement("div");
      head.style.display = "flex";
      head.style.justifyContent = "space-between";
      head.style.alignItems = "center";
      head.style.gap = "10px";

      const left = document.createElement("div");
      left.innerHTML = `
        <div class="kicker">Share ID</div>
        <div class="big" style="margin-top:2px">Preview Email</div>
        <div class="label" style="margin-top:4px">Subject: ${escapeHtml(subject)}</div>
      `;

      const x = document.createElement("button");
      x.className = "btn";
      x.textContent = "✕";
      x.onclick = () => close(null);

      head.append(left, x);

      const toRow = document.createElement("div");
      toRow.style.display = "flex";
      toRow.style.gap = "8px";
      toRow.style.alignItems = "center";
      toRow.style.flexWrap = "wrap";

      const toInput = document.createElement("input");
      toInput.className = "input";
      toInput.type = "email";
      toInput.placeholder = "Recipient email address";
      toInput.style.flex = "1";
      toInput.style.minWidth = "260px";

      const sendBtn = document.createElement("button");
      sendBtn.className = "btn-primary";
      sendBtn.textContent = "Send";

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btn";
      cancelBtn.textContent = "Cancel";

      toRow.append(toInput, cancelBtn, sendBtn);

      const preview = document.createElement("div");
      preview.style.flex = "1";
      preview.style.overflow = "auto";
      preview.style.border = "1px solid #e5e7eb";
      preview.style.borderRadius = "12px";
      preview.style.background = "#fff";
      preview.style.padding = "10px";

      // Use an iframe so the email HTML renders safely without affecting your page CSS
      const iframe = document.createElement("iframe");
      iframe.style.width = "100%";
      iframe.style.height = "460px";
      iframe.style.border = "0";
      preview.appendChild(iframe);

      overlay.appendChild(card);
      card.append(head, toRow, preview);
      document.body.appendChild(overlay);

      // Write HTML into iframe
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }

      cancelBtn.onclick = () => close(null);

      sendBtn.onclick = () => {
        const to = (toInput.value || "").trim();
        if (!to) {
          alert("Please enter a recipient email.");
          return;
        }
        close(to);
      };

      function close(val) {
        overlay.remove();
        resolve(val);
      }
    });
  }

}

export async function renderIDs(root) {
  const ids = await loadIDs(); // from ./data/ids.json :contentReference[oaicite:1]{index=1}
  const qp = getQuery();
  const idId = qp.get("id");

  if (!idId) {
    renderList(root, ids);
    return;
  }

  const item = ids.find((x) => String(x?.id_id) === String(idId));
  renderDetail(root, item);
}
