// app.js
import { renderDashboard } from "./screens/dashboard.js"; // NEW dashboard home
import { renderEmploymentCredentials } from "./screens/employmentCredentials.js"; // OLD dashboard renamed

import { renderExplorer } from "./screens/explorer.js";
import { renderOccupations } from "./screens/occupations.js";

import { renderIDs } from "./screens/ids.js";


// Optional placeholders (simple)
import { renderSimpleScreen } from "./screens/simpleScreens.js";

const routes = {
  "#/dashboard": renderDashboard,

  "#/employment-credentials": renderEmploymentCredentials,
  "#/explorer": renderExplorer,
  "#/occupations": renderOccupations,
  "#/ids": renderIDs,

  "#/learning-history": (root) => renderSimpleScreen(root, "Learning History", "Coming soon."),
  "#/achievements": (root) => renderSimpleScreen(root, "Achievements", "Coming soon."),
  "#/notifications": (root) => renderSimpleScreen(root, "Notifications", "Coming soon."),
};

function getRouteKey() {
  const hash = window.location.hash || "#/dashboard";
  const key = hash.split("?")[0]; // keep this so occupations?cat=... works
  return routes[key] ? key : "#/dashboard";
}

function render() {
  const app = document.getElementById("app");
  if (!app) return;
  const routeKey = getRouteKey();
  app.innerHTML = "";
  routes[routeKey](app);
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  if (!window.location.hash) window.location.hash = "#/dashboard";
  render();
});
