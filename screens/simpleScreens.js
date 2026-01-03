// screens/simpleScreens.js
export function renderSimpleScreen(root, title, text) {
  root.innerHTML = `
    <section class="page">
      <div class="hero">
        <h1>${title}</h1>
        <p>${text}</p>
      </div>
      <div class="panel">
        <a class="btn-ghost" href="#/dashboard">← Back to Wallet</a>
      </div>
    </section>
  `;
}
