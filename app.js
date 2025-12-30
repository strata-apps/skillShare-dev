// app.js
import { renderDashboard } from "./screens/dashboard.js";

const routes = {
  "#/dashboard": renderDashboard,
};

function getRoute() {
  const hash = window.location.hash || "#/dashboard";
  return routes[hash] ? hash : "#/dashboard";
}

function render() {
  const app = document.getElementById("app");
  if (!app) return;

  const route = getRoute();
  app.innerHTML = "";
  routes[route](app);
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  if (!window.location.hash) window.location.hash = "#/dashboard";
  render();
});
