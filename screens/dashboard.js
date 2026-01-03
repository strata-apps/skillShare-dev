// screens/dashboard.js
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function tile({ title, color, icon, badge, href }) {
  return `
    <a class="walletTile" href="${href}">
      <div class="walletTileTop">
        <div class="walletTileTitle">${escapeHtml(title)}</div>
      </div>

      <div class="walletTileIcon">${escapeHtml(icon)}</div>

      <div class="walletTileBadge">
        <span>${escapeHtml(String(badge ?? ""))}</span>
      </div>
    </a>
  `;
}

export async function renderDashboard(root) {
  root.innerHTML = `
    <section class="walletHome">
      <div class="walletHeader">
        <div class="walletBrand">
          <div class="walletBrandName">Camp Catanese Foundation</div>
        </div>
      </div>

      <div class="walletTitle">Wallet</div>

      <div class="walletGrid">
        ${tile({ title: "IDs",                  color: "var(--tile-yellow)", icon: "🪪", badge: 3,  href: "#/ids" })}
        ${tile({ title: "Learning History",     color: "var(--tile-mint)",   icon: "🎒", badge: 70, href: "#/learning-history" })}
        ${tile({ title: "Employment Credentials", color: "var(--tile-coral)",  icon: "🧩", badge: 35, href: "#/employment-credentials" })}
        ${tile({ title: "Achievements",         color: "var(--tile-lav)",    icon: "🏆", badge: 82, href: "#/achievements" })}
      </div>
    </section>
  `;  
}
