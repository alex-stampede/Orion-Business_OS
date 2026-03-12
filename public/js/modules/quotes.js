import { formatCurrency, formatDate, escapeHtml } from "../helpers.js";
import { showToast } from "../ui.js";
import {
  listQuotes,
  getQuoteItems,
  getBusinessSettings,
  deleteQuote,
  updateQuoteStatus,
  getQuoteById,
  getCurrentBusinessPlan,
  canDeleteInCurrentPlan
} from "../firestore-service.js";
import { exportQuoteToPDF } from "../pdf.js";

let quotesCache = [];
let filteredQuotes = [];

function normalizeDate(value) {
  if (!value) return "—";
  if (value?.toDate) return formatDate(value.toDate());
  return formatDate(value);
}

function statusLabel(status) {
  return {
    draft: "Borrador",
    sent: "Enviada",
    pending: "Pendiente",
    negotiating: "Negociando",
    won: "Ganada",
    lost: "Perdida"
  }[status] || "Pendiente";
}

function quoteStatusOptions(current) {
  const statuses = ["draft", "sent", "pending", "negotiating", "won", "lost"];
  return statuses
    .map(
      status =>
        `<option value="${status}" ${current === status ? "selected" : ""}>${statusLabel(status)}</option>`
    )
    .join("");
}

function buildUsageDots(current = 0, limit = 3) {
  return `
    <div class="plan-usage-dots">
      ${Array.from({ length: limit })
        .map((_, index) => `<span class="plan-usage-dot ${index < current ? "is-filled" : ""}"></span>`)
        .join("")}
    </div>
  `;
}

function renderQuotePlanAlert() {
  const box = document.getElementById("quotes-plan-alert");
  if (!box) return;

  const plan = getCurrentBusinessPlan();

  if (plan.code === "pro") {
    box.innerHTML = "";
    return;
  }

  const current = quotesCache.length;
  const limit = plan.limits.quotes;

  box.innerHTML = `
    <article class="app-panel plan-usage-card">
      <div class="card-head">
        <strong>Plan Inicio</strong>
        <span>${current}/${limit} cotizaciones usadas</span>
      </div>

      ${buildUsageDots(current, limit)}

      <p class="muted">
        Actualiza a <strong>Plan Pro</strong> para tener cotizaciones ilimitadas.
      </p>

      <div class="btn-row mt-4">
        <a href="#settings" class="btn btn-secondary btn-sm">
          Actualizar a Plan Pro · $179 MXN / mes
        </a>
      </div>
    </article>
  `;
}

function applyFilters() {
  const search = (document.getElementById("quotes-search")?.value || "").toLowerCase().trim();
  const status = document.getElementById("quotes-filter-status")?.value || "";

  filteredQuotes = quotesCache.filter(q => {
    const haystack = [
      q.folio || "",
      q.clientNameSnapshot || "",
      q.companySnapshot || ""
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = !search || haystack.includes(search);
    const matchesStatus = !status || q.status === status;

    return matchesSearch && matchesStatus;
  });

  renderRows();
}

function renderRows() {
  const tbody = document.getElementById("quotes-table-body");
  const count = document.getElementById("quotes-count");
  const canDelete = canDeleteInCurrentPlan();

  count.textContent = `${filteredQuotes.length} registros`;

  if (!filteredQuotes.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div style="padding:40px;text-align:center">
            <h3>Aún no has creado cotizaciones</h3>
            <p class="muted">
              Empieza generando tu primera propuesta comercial.
            </p>
            <a href="#quote-editor" class="btn btn-primary">
              Crear cotización
            </a>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredQuotes
    .map(
      quote => `
      <tr>
        <td>${escapeHtml(quote.folio || "—")}</td>
        <td>${escapeHtml(quote.clientNameSnapshot || "—")}</td>
        <td>${normalizeDate(quote.createdAt)}</td>
        <td>${formatCurrency(Number(quote.total || 0), quote.currency || "MXN")}</td>
        <td>
          <select class="quote-status-select" data-id="${quote.id}">
            ${quoteStatusOptions(quote.status)}
          </select>
        </td>
        <td>${escapeHtml(quote.linkedType || "—")}</td>
        <td>
          <div class="btn-row">
            <a href="#quote-editor?id=${quote.id}" class="btn btn-secondary btn-sm">Editar</a>
            <button class="btn btn-secondary btn-sm js-download-quote" data-id="${quote.id}">PDF</button>
            ${
              canDelete
                ? `<button class="btn btn-secondary btn-sm js-delete-quote" data-id="${quote.id}">Eliminar</button>`
                : ""
            }
          </div>
        </td>
      </tr>
    `
    )
    .join("");

  bindActions();
}

async function loadQuotes() {
  try {
    quotesCache = await listQuotes();
    filteredQuotes = [...quotesCache];

    renderQuotePlanAlert();
    renderRows();
  } catch (error) {
    console.error("ERROR AL CARGAR COTIZACIONES:", error);
  }
}

function bindActions() {
  document.querySelectorAll(".quote-status-select").forEach(select => {
    select.onchange = async () => {
      const id = select.dataset.id;
      const status = select.value;

      await updateQuoteStatus(id, status);
      await loadQuotes();
    };
  });

  document.querySelectorAll(".js-delete-quote").forEach(btn => {
    btn.onclick = async () => {
      const quote = quotesCache.find(q => q.id === btn.dataset.id);
      if (!quote) return;

      if (!confirm(`Eliminar cotización ${quote.folio}?`)) return;

      await deleteQuote(quote.id, quote.folio);
      showToast("Cotización eliminada");
      await loadQuotes();
    };
  });

  document.querySelectorAll(".js-download-quote").forEach(btn => {
    btn.onclick = async () => {
      const quoteId = btn.dataset.id;

      const [quote, items, settings] = await Promise.all([
        getQuoteById(quoteId),
        getQuoteItems(quoteId),
        getBusinessSettings()
      ]);

      exportQuoteToPDF({
        ...quote,
        items,
        businessName: settings?.businessName || "",
        logoUrl: settings?.logoUrl || "",
        businessPhone: settings?.businessPhone || "",
        businessEmail: settings?.businessEmail || "",

        paymentTermsEnabled: settings?.paymentTermsEnabled,
        paymentTermsText: settings?.paymentTermsText,

        bankInfoEnabled: settings?.bankInfoEnabled,
        bankName: settings?.bankName,
        bankAccountHolder: settings?.bankAccountHolder,
        bankAccountNumber: settings?.bankAccountNumber,
        bankClabe: settings?.bankClabe,

        commercialTermsEnabled: settings?.commercialTermsEnabled,
        deliveryTime: settings?.deliveryTime,
        quoteValidityText: settings?.quoteValidityText,
        warrantyText: settings?.warrantyText,
        commercialNotes: settings?.commercialNotes
      });
    };
  });
}

export function renderQuotes() {
  return `
    <section class="app-view glass">
      <div class="app-view-header">
        <div class="app-view-title">
          <p class="eyebrow-sm">Cotizaciones</p>
          <h2>Control de propuestas comerciales</h2>
        </div>

        <div class="btn-row">
          <a href="#quote-editor" class="btn btn-primary">Nueva cotización</a>
        </div>
      </div>

      <div class="app-view-grid">
        <div id="quotes-plan-alert"></div>

        <article class="app-panel">
          <div class="form-grid-2 mb-4">
            <div class="field">
              <label>Buscar</label>
              <input id="quotes-search" type="text" placeholder="Folio o cliente"/>
            </div>

            <div class="field">
              <label>Estatus</label>
              <select id="quotes-filter-status">
                <option value="">Todos</option>
                <option value="draft">Borrador</option>
                <option value="sent">Enviada</option>
                <option value="pending">Pendiente</option>
                <option value="negotiating">Negociando</option>
                <option value="won">Ganada</option>
                <option value="lost">Perdida</option>
              </select>
            </div>
          </div>

          <div class="card-head">
            <strong>Listado de cotizaciones</strong>
            <span id="quotes-count">Cargando...</span>
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
                  <th>Vinculado a</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="quotes-table-body">
                <tr>
                  <td colspan="7">Cargando cotizaciones...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  `;
}

export function initQuotes() {
  loadQuotes();
  document.getElementById("quotes-search")?.addEventListener("input", applyFilters);
  document.getElementById("quotes-filter-status")?.addEventListener("change", applyFilters);
}
