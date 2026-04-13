import { formatCurrency, escapeHtml } from "../helpers.js";
import { getPipelineData } from "../firestore-service.js";

let pipelineCache = [];

function renderCard(item) {
  return `
    <div class="kanban-card">
      <strong>${escapeHtml(item.companySnapshot || item.clientNameSnapshot || "Sin nombre")}</strong>
      <p>${escapeHtml(item.folio || "Sin folio")}</p>
      <p>${formatCurrency(Number(item.total || 0), item.currency || "MXN")}</p>
      <div class="btn-row mt-4">
        <a class="btn btn-secondary btn-sm" href="#quote-editor?id=${item.id}">Editar</a>
      </div>
    </div>
  `;
}

function renderColumns() {
  const wrap = document.getElementById("pipeline-columns");
  if (!wrap) return;

  if (!pipelineCache.length) {
    wrap.innerHTML = `<p class="muted">No hay datos en el pipeline.</p>`;
    return;
  }

  wrap.innerHTML = pipelineCache
    .map(column => `
      <article class="kanban-col">
        <h3>${escapeHtml(column.title)}</h3>
        <div class="kanban-stack">
          ${
            column.items.length
              ? column.items.map(renderCard).join("")
              : `<p class="muted">Sin oportunidades</p>`
          }
        </div>
      </article>
    `)
    .join("");
}

async function loadPipeline() {
  try {
    pipelineCache = await getPipelineData();
    renderColumns();
  } catch (error) {
    console.error(error);
    const wrap = document.getElementById("pipeline-columns");
    if (wrap) wrap.innerHTML = `<p class="muted">No se pudo cargar el pipeline.</p>`;
  }
}

export function renderPipeline() {
  return `
    <section class="app-view glass">
      <div class="app-view-header">
        <div class="app-view-title">
          <p class="eyebrow-sm">Pipeline</p>
          <h2>Visualiza tu flujo comercial</h2>
          <p class="muted">
            El pipeline se alimenta automáticamente con el estatus real de tus cotizaciones.
          </p>
        </div>
      </div>

      <div class="app-view-grid">
        <div class="kanban-grid" id="pipeline-columns">
          <p class="muted">Cargando pipeline...</p>
        </div>
      </div>
    </section>
  `;
}

export function initPipeline() {
  loadPipeline();
}