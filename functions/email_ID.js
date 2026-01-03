// functions/email_ID.js
// Generates Gmail-safe HTML for sharing a single ID "details page" via email.

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function labelizeKey(k) {
  return String(k)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
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

/**
 * Build an email payload for a given ID object
 * @param {object} item - The ID object from ids.json
 * @param {object} opts
 * @param {string} opts.brandName - Optional brand label in header
 */
export default function buildIdEmail(item, opts = {}) {
  const brandName = opts.brandName || "Digital Credential Wallet";

  const title = item?.id_name || item?.card_type || "ID";
  const cardType = item?.card_type || "";
  const color = brandColorForType(cardType || title);
  const emoji = iconForType(cardType || title);

  const active = String(item?.status || "").toLowerCase() === "active";
  const holder = item?.holder?.full_name || "";
  const issuedOn = fmtDate(item?.issued_on);
  const issuedBy = item?.issuer?.organization || "";
  const campus =
    item?.issuer?.campus ||
    item?.details?.campus ||
    item?.details?.institution ||
    "";

  const org = item?.issuer?.organization || item?.details?.institution || "";
  const subtitle = org || item?.issuer?.jurisdiction || item?.issuer?.campus || "";

  const detailsObj = item?.details && typeof item.details === "object" ? item.details : {};
  const detailRows = Object.entries(detailsObj);

  const subject = `Shared ID: ${title}${holder ? ` — ${holder}` : ""}`;

  const detailsTable = `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
      <tr>
        <td style="padding:10px 0;color:#6b7280;font-size:12px;">Issued To</td>
        <td style="padding:10px 0;color:#111827;font-size:12px;font-weight:700;text-align:right;">${escapeHtml(holder || "—")}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#6b7280;font-size:12px;">Card Type</td>
        <td style="padding:10px 0;color:#111827;font-size:12px;font-weight:700;text-align:right;">${escapeHtml(cardType || "—")}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#6b7280;font-size:12px;">Campus</td>
        <td style="padding:10px 0;color:#111827;font-size:12px;font-weight:700;text-align:right;">${escapeHtml(campus || "—")}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#6b7280;font-size:12px;">Issued On</td>
        <td style="padding:10px 0;color:#111827;font-size:12px;font-weight:700;text-align:right;">${escapeHtml(issuedOn || "—")}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#6b7280;font-size:12px;">Issued By</td>
        <td style="padding:10px 0;color:#111827;font-size:12px;font-weight:700;text-align:right;">${escapeHtml(issuedBy || "—")}</td>
      </tr>

      ${
        detailRows.length
          ? `
            <tr><td colspan="2" style="padding:14px 0 6px;border-top:1px solid #e5e7eb;"></td></tr>
            ${detailRows
              .map(([k, v]) => {
                const val = v === null || v === undefined ? "" : String(v);
                return `
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;font-size:12px;">${escapeHtml(labelizeKey(k))}</td>
                    <td style="padding:10px 0;color:#111827;font-size:12px;font-weight:700;text-align:right;">${escapeHtml(val || "—")}</td>
                  </tr>
                `;
              })
              .join("")}
          `
          : ""
      }
    </table>
  `;

  const html = `
  <div style="background:#f3f4f6;padding:24px 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:0 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;border-collapse:collapse;">
            
            <!-- Header -->
            <tr>
              <td style="padding:10px 4px 14px;color:#6b7280;font-size:12px;">
                ${escapeHtml(brandName)} • Shared ID
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
                
                <!-- Accent bar -->
                <div style="height:6px;background:${escapeHtml(color)};"></div>

                <div style="padding:18px 18px 16px;">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:42px;height:42px;border-radius:12px;background:${escapeHtml(color)};color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;">
                      ${escapeHtml(emoji)}
                    </div>

                    <div style="flex:1;min-width:0;">
                      <div style="font-weight:900;color:#111827;font-size:16px;line-height:1.2;">
                        ${escapeHtml(String(title).toUpperCase())}
                      </div>
                      <div style="color:#6b7280;font-size:12px;margin-top:2px;">
                        ${escapeHtml(subtitle || "")}
                      </div>
                    </div>

                    <div style="font-size:11px;font-weight:800;padding:6px 10px;border-radius:999px;border:1px solid ${escapeHtml(color)};color:${escapeHtml(color)};white-space:nowrap;">
                      ${active ? "ACTIVE ID" : escapeHtml(item?.status || "STATUS")}
                    </div>
                  </div>

                  <!-- Preview -->
                  <div style="margin-top:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:14px;display:flex;justify-content:space-between;gap:12px;">
                    <div>
                      <div style="color:#6b7280;font-size:11px;font-weight:700;">Card Holder</div>
                      <div style="color:#111827;font-size:13px;font-weight:900;margin-top:2px;">
                        ${escapeHtml(holder || "—")}
                      </div>
                    </div>
                    <div style="text-align:right;">
                      <div style="color:#6b7280;font-size:11px;font-weight:700;">Issuer</div>
                      <div style="color:#111827;font-size:13px;font-weight:900;margin-top:2px;">
                        ${escapeHtml(issuedBy || subtitle || "—")}
                      </div>
                    </div>
                  </div>

                  <!-- Details -->
                  <div style="margin-top:14px;">
                    <div style="color:#111827;font-weight:900;font-size:13px;margin-bottom:6px;">
                      Details
                    </div>
                    ${detailsTable}
                  </div>

                  <div style="margin-top:14px;color:#6b7280;font-size:11px;line-height:1.4;">
                    This ID was shared with you from a digital credential wallet. If anything looks incorrect, reply to the sender.
                  </div>
                </div>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:12px 4px;color:#9ca3af;font-size:11px;">
                Sent from ${escapeHtml(brandName)}.
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>
  `.trim();

  return { subject, html };
}
