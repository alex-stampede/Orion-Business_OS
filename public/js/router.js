import { $, getHashRoute } from "./helpers.js";
import { getState, setState, subscribe, setSidebarCollapsed } from "./state.js";
import { setNavActive, setPageTitle, toggleSidebarUI, syncUpgradeButton } from "./ui.js";

import { renderDashboard, preloadDashboardData } from "./modules/dashboard.js";
import { renderQuotes, initQuotes } from "./modules/quotes.js";
import { renderQuoteEditor, initQuoteEditor } from "./modules/quote-editor.js";
import { renderClients, initClients } from "./modules/clients.js";
import { renderLeads, initLeads } from "./modules/leads.js";
import { renderPipeline, initPipeline } from "./modules/pipeline.js";
import { renderProducts, initProducts } from "./modules/products.js";
import { renderSettings, initSettings } from "./modules/settings.js";

/* NUEVO */
import { renderOrionAdmin, initOrionAdmin } from "./modules/orion-admin.js";

const routes = {
  dashboard: {
    title: "Dashboard",
    render: renderDashboard,
    preload: preloadDashboardData,
    init: null
  },

  quotes: {
    title: "Cotizaciones",
    render: renderQuotes,
    init: initQuotes
  },

  "quote-editor": {
    title: "Nueva cotización",
    render: renderQuoteEditor,
    init: initQuoteEditor
  },

  clients: {
    title: "Clientes",
    render: renderClients,
    init: initClients
  },

  leads: {
    title: "Leads",
    render: renderLeads,
    init: initLeads
  },

  pipeline: {
    title: "Pipeline",
    render: renderPipeline,
    init: initPipeline
  },

  products: {
    title: "Productos e inventario",
    render: renderProducts,
    init: initProducts
  },

  settings: {
    title: "Configuración",
    render: renderSettings,
    init: initSettings
  },

  /* NUEVA RUTA ADMIN */
  "orion-admin": {
    title: "Orion Control Center",
    render: renderOrionAdmin,
    init: initOrionAdmin
  }
};

let isRendering = false;

function isSuperAdmin() {
  const state = getState();
  const role = String(state.user?.role || "").trim().toLowerCase();

  // Compatibilidad: en producción el rol global existe como "super_admin".
  return role === "super_admin" || role === "orion_super_admin";
}

function protectAdminRoute(route) {
  if (route === "orion-admin" && !isSuperAdmin()) {
    return "dashboard";
  }
  return route;
}

function updateAdminNavVisibility() {
  const adminNav = document.querySelector('[data-route="orion-admin"]');
  if (!adminNav) return;

  if (isSuperAdmin()) {
    adminNav.style.removeProperty("display");
    adminNav.hidden = false;
    return;
  }

  // Fuerza ocultar incluso cuando existen reglas CSS con `display: flex !important`.
  adminNav.style.setProperty("display", "none", "important");
  adminNav.hidden = true;
}

export async function renderCurrentRoute() {
  if (isRendering) return;
  isRendering = true;

  try {
    const content = $("#app-content");
    if (!content) return;

    updateAdminNavVisibility();

    let route = getHashRoute();
    route = protectAdminRoute(route);

    const current = routes[route] || routes.dashboard;

    setState({ route });

    setNavActive(route);
    setPageTitle(current.title);
    syncUpgradeButton();

    if (typeof current.preload === "function") {
      content.innerHTML = `
        <section class="app-view glass">
          <p class="muted">Cargando datos...</p>
        </section>
      `;
      await current.preload();
    }

    content.innerHTML = current.render(getState());

    if (typeof current.init === "function") {
      current.init(getState());
    }

    syncUpgradeButton();
  } finally {
    isRendering = false;
  }
}

export function initRouter() {
  renderCurrentRoute();

  window.addEventListener("hashchange", renderCurrentRoute);

  $("#start-tour-btn")?.addEventListener("click", async () => {
    const { startTutorial } = await import("./tutorial.js");
    startTutorial();
  });

  subscribe(() => {
    syncUpgradeButton();
    updateAdminNavVisibility();
  });

  syncUpgradeButton();
  updateAdminNavVisibility();
}
