import { formatCurrency, formatDate, escapeHtml } from "../helpers.js";
import { getDashboardMetrics } from "../firestore-service.js";

let dashboardCache = {
  metrics: {
    totalQuotes: 0,
    wonQuotes: 0,
    lostQuotes: 0,
    pendingQuotes: 0,
    totalLeads: 0,
    totalClients: 0,
    totalQuotedAmount: 0,
    totalWonAmount: 0,
    closeRate: 0,
    averageQuote: 0
  },
  quotes: [],
  activities: []
};

function normalizeDate(value) {
  if (!value) return "—";
  if (value?.toDate) return formatDate(value.toDate());
  return formatDate(value);
}

function activityLabel(activity) {
  return activity?.message || "Actividad registrada";
}

export function renderDashboard(state = {}) {
  const businessName = state.business?.name || "Tu negocio";
  const m = dashboardCache.metrics;
  const recentQuotes = dashboardCache.quotes.slice(0, 4);
  const recentActivities = dashboardCache.activities;

  return `
    <section class="app-view glass">
      <div class="app-view-header">
        <div class="app-view-title">
          <p class="eyebrow-sm">Resumen general</p>
          <h2>Bienvenido a ${escapeHtml(businessName)}</h2>
          <p class="muted">
            Aquí puedes visualizar las métricas reales de tu cuenta y la actividad reciente de tu operación.
          </p>
        </div>
      </div>

      <div class="app-view-grid">
        <div class="app-kpi-grid">
          <article class="app-kpi-card">
            <small>Cotizaciones</small>
            <strong>${m.totalQuotes}</strong>
          </article>
          <article class="app-kpi-card">
            <small>Leads activos</small>
            <strong>${m.totalLeads}</strong>
          </article>
          <article class="app-kpi-card">
            <small>Clientes</small>
            <strong>${m.totalClients}</strong>
          </article>
          <article class="app-kpi-card">
            <small>Tasa de cierre</small>
            <strong>${m.closeRate.toFixed(0)}%</strong>
          </article>
        </div>

        <div class="app-kpi-grid">
          <article class="app-kpi-card">
            <small>Monto cotizado</small>
            <strong>${formatCurrency(m.totalQuotedAmount)}</strong>
          </article>
          <article class="app-kpi-card">
            <small>Monto ganado</small>
            <strong>${formatCurrency(m.totalWonAmount)}</strong>
          </article>
          <article class="app-kpi-card">
            <small>Promedio por cotización</small>
            <strong>${formatCurrency(m.averageQuote)}</strong>
          </article>
          <article class="app-kpi-card">
            <small>Pendientes</small>
            <strong>${m.pendingQuotes}</strong>
          </article>
        </div>

        <div class="app-panels-2">
          <article class="app-panel">
            <div class="card-head">
              <strong>Actividad reciente</strong>
              <span>${recentActivities.length} eventos</span>
            </div>

            <div class="activity-list" id="dashboard-activities">
              ${
                recentActivities.length
                  ? recentActivities
                      .map(
                        activity => `
                          <div class="activity-item">
                            <span class="activity-dot"></span>
                            <p>
                              ${escapeHtml(activityLabel(activity))}
                              <br>
                              <small style="color:var(--text-muted);">${normalizeDate(activity.createdAt)}</small>
                            </p>
                          </div>
                        `
                      )
                      .join("")
                  : `
                    <div class="activity-item">
                      <span class="activity-dot"></span>
                      <p>Aún no hay actividad reciente en esta cuenta.</p>
                    </div>
                  `
              }
            </div>
          </article>

          <article class="app-panel">
            <div class="card-head">
              <strong>Resumen de estatus</strong>
              <span>Tiempo real</span>
            </div>

            <div class="stats-grid">
              <div class="stat-card">
                <small>Ganadas</small>
                <strong>${m.wonQuotes}</strong>
              </div>
              <div class="stat-card">
                <small>Perdidas</small>
                <strong>${m.lostQuotes}</strong>
              </div>
              <div class="stat-card">
                <small>Pendientes</small>
                <strong>${m.pendingQuotes}</strong>
              </div>
              <div class="stat-card">
                <small>Total</small>
                <strong>${m.totalQuotes}</strong>
              </div>
            </div>
          </article>
        </div>

        <article class="app-panel">
          <div class="card-head">
            <strong>Cotizaciones recientes</strong>
            <span>${recentQuotes.length} registros</span>
          </div>

          <div class="table-shell">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Estatus</th>
                </tr>
              </thead>
              <tbody>
                ${
                  recentQuotes.length
                    ? recentQuotes
                        .map(
                          quote => `
                            <tr>
                              <td>${escapeHtml(quote.folio || "—")}</td>
                              <td>${escapeHtml(quote.clientNameSnapshot || quote.companySnapshot || "—")}</td>
                              <td>${normalizeDate(quote.createdAt)}</td>
                              <td>${formatCurrency(Number(quote.total || 0), quote.currency || "MXN")}</td>
                              <td><span class="status-pill ${quote.status || "pending"}">${escapeHtml(quote.status || "pending")}</span></td>
                            </tr>
                          `
                        )
                        .join("")
                    : `<tr><td colspan="5">Aún no tienes cotizaciones registradas.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  `;
}

export async function initDashboardRefresh(renderCallback) {
  dashboardCache = await getDashboardMetrics();
  if (typeof renderCallback === "function") {
    renderCallback();
  }
}

export async function preloadDashboardData() {
  dashboardCache = await getDashboardMetrics();
}