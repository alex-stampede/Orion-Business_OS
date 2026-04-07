import { formatCurrency } from "../helpers.js";
import { getGlobalAdminMetrics } from "../firestore-service.js";
import { showToast } from "../ui.js";

let metricsCache = null;

function metricCard(label, value, helper = "") {
  return `
    <article class="metric-card">
      <span class="metric-label">${label}</span>
      <strong class="metric-value">${value}</strong>
      ${helper ? `<small class="metric-helper">${helper}</small>` : ""}
    </article>
  `;
}

function renderMetrics(metrics = {}) {
  const currency = "MXN";

  return `
    <div class="metrics-band">
      ${metricCard("Usuarios totales", metrics.totalUsers || 0)}
      ${metricCard("Negocios totales", metrics.totalBusinesses || 0)}
      ${metricCard("Usuarios Pro", metrics.totalProBusinesses || 0)}
      ${metricCard("Usuarios Free", metrics.totalFreeBusinesses || 0)}
      ${metricCard("Cotizaciones creadas", metrics.totalQuotes || 0)}
      ${metricCard("Prospectos creados", metrics.totalLeads || 0)}
      ${metricCard("Clientes creados", metrics.totalClients || 0)}
      ${metricCard("Monto total cotizado", formatCurrency(metrics.totalQuotedAmount || 0, currency))}
      ${metricCard("Monto total ganado", formatCurrency(metrics.totalWonAmount || 0, currency))}
      ${metricCard("Cotizaciones ganadas", metrics.totalWonQuotes || 0)}
    </div>
  `;
}

function renderRecentBlocks(metrics = {}) {
  return `
    <div class="app-panels-2">
      <article class="app-panel">
        <div class="card-head">
          <strong>Resumen comercial</strong>
          <span>Orion Business OS</span>
        </div>

        <div class="stats-list">
          <div class="stats-row">
            <span>MRR estimado</span>
            <strong>${formatCurrency(metrics.estimatedMRR || 0, "MXN")}</strong>
          </div>

          <div class="stats-row">
            <span>Tasa de conversión Free → Pro</span>
            <strong>${metrics.freeToProRate || 0}%</strong>
          </div>

          <div class="stats-row">
            <span>Ticket promedio cotizado</span>
            <strong>${formatCurrency(metrics.averageQuotedTicket || 0, "MXN")}</strong>
          </div>

          <div class="stats-row">
            <span>Ticket promedio ganado</span>
            <strong>${formatCurrency(metrics.averageWonTicket || 0, "MXN")}</strong>
          </div>
        </div>
      </article>

      <article class="app-panel">
        <div class="card-head">
          <strong>Para marketing</strong>
          <span>Pruebas sociales</span>
        </div>

        <div class="stats-list">
          <div class="stats-row">
            <span>Negocios usando Orion</span>
            <strong>${metrics.totalBusinesses || 0}</strong>
          </div>

          <div class="stats-row">
            <span>Cotizaciones generadas</span>
            <strong>${metrics.totalQuotes || 0}</strong>
          </div>

          <div class="stats-row">
            <span>Monto cotizado en la plataforma</span>
            <strong>${formatCurrency(metrics.totalQuotedAmount || 0, "MXN")}</strong>
          </div>

          <div class="stats-row">
            <span>Monto ganado registrado</span>
            <strong>${formatCurrency(metrics.totalWonAmount || 0, "MXN")}</strong>
          </div>
        </div>
      </article>
    </div>
  `;
}

async function loadAdminMetrics() {
  const target = document.getElementById("orion-admin-metrics");
  if (!target) return;

  target.innerHTML = `<p class="muted">Cargando métricas globales...</p>`;

  try {
    metricsCache = await getGlobalAdminMetrics();

    target.innerHTML = `
      ${renderMetrics(metricsCache)}
      ${renderRecentBlocks(metricsCache)}
    `;
  } catch (error) {
    console.error("ERROR CARGANDO MÉTRICAS ADMIN:", error);
    target.innerHTML = `<p class="muted">No se pudieron cargar las métricas.</p>`;
    showToast("No se pudieron cargar las métricas globales");
  }
}

export function renderOrionAdmin() {
  return `
    <section class="app-view glass">
      <div class="app-view-header">
        <div class="app-view-title">
          <p class="eyebrow-sm">Orion Control Center</p>
          <h2>Panel maestro del SaaS</h2>
          <p class="muted">
            Monitorea el crecimiento real de Orion Business OS y utiliza estas métricas para marketing, ventas y decisiones de producto.
          </p>
        </div>
      </div>

      <div id="orion-admin-metrics" class="app-view-grid">
        <p class="muted">Preparando métricas globales...</p>
      </div>
    </section>
  `;
}

export function initOrionAdmin() {
  loadAdminMetrics();
}
