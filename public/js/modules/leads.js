import { escapeHtml, formatDate } from "../helpers.js";
import { showToast } from "../ui.js";
import {
  listBusinessCollection,
  createLead,
  updateLead,
  deleteLead,
  getCurrentBusinessPlan,
  canCreateEntity,
  getPlanLimitMessage
} from "../firestore-service.js";

let leadsCache = [];
let filteredLeads = [];

function buildUsageDots(current = 0, limit = 3) {
  return `
    <div class="plan-usage-dots">
      ${Array.from({ length: limit })
        .map((_, index) => `<span class="plan-usage-dot ${index < current ? "is-filled" : ""}"></span>`)
        .join("")}
    </div>
  `;
}

function renderLeadPlanAlert() {
  const box = document.getElementById("leads-plan-alert");
  if (!box) return;

  const plan = getCurrentBusinessPlan();

  if (plan.code === "pro") {
    box.innerHTML = "";
    return;
  }

  const current = leadsCache.length;
  const limit = plan.limits.leads;

  box.innerHTML = `
    <article class="app-panel plan-usage-card">
      <div class="card-head">
        <strong>Plan Inicio</strong>
        <span>${current}/${limit} leads usados</span>
      </div>

      ${buildUsageDots(current, limit)}

      <p class="muted">
        Tu plan actual incluye hasta 3 leads.
      </p>

      <div class="btn-row mt-4">
        <a href="#settings" class="btn btn-secondary btn-sm">
          Actualizar a Plan Pro · $179 MXN / mes
        </a>
      </div>
    </article>
  `;
}

function applyLeadFilters() {
  const search = (document.getElementById("leads-search")?.value || "").toLowerCase().trim();
  const status = document.getElementById("leads-filter-status")?.value || "";

  filteredLeads = leadsCache.filter(lead => {
    const haystack = [
      lead.name || "",
      lead.company || "",
      lead.email || "",
      lead.phone || ""
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = !search || haystack.includes(search);
    const matchesStatus = !status || lead.status === status;

    return matchesSearch && matchesStatus;
  });

  renderLeadRows();
}

function openLeadModal(lead = null) {
  const isEdit = Boolean(lead);

  const name = prompt("Nombre del lead", lead?.name || "");
  if (name === null) return;

  const company = prompt("Empresa", lead?.company || "");
  if (company === null) return;

  const email = prompt("Correo", lead?.email || "");
  if (email === null) return;

  const phone = prompt("Teléfono", lead?.phone || "");
  if (phone === null) return;

  const source = prompt("Origen", lead?.source || "Manual");
  if (source === null) return;

  const status = prompt("Estatus", lead?.status || "Nuevo");
  if (status === null) return;

  const payload = {
    name: name.trim(),
    company: company.trim(),
    email: email.trim(),
    phone: phone.trim(),
    source: source.trim(),
    status: status.trim() || "Nuevo"
  };

  if (isEdit) {
    updateLead(lead.id, payload)
      .then(() => {
        showToast("Lead actualizado");
        return loadLeads();
      })
      .catch(error => {
        console.error(error);
        showToast("No se pudo actualizar el lead");
      });
  } else {
    canCreateEntity("leads")
      .then(permission => {
        if (!permission.allowed) {
          showToast(getPlanLimitMessage("leads"));
          window.location.hash = "settings";
          return;
        }

        return createLead(payload).then(() => {
          showToast("Lead creado");
          return loadLeads();
        });
      })
      .catch(error => {
        console.error(error);
        showToast("No se pudo crear el lead");
      });
  }
}

function renderLeadRows() {
  const tbody = document.getElementById("leads-table-body");
  const count = document.getElementById("leads-count");

  count.textContent = `${filteredLeads.length} registros`;

  if (!filteredLeads.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div style="padding:40px;text-align:center">
            <h3>Aún no has creado leads</h3>
            <p class="muted">
              Empieza agregando tu primer lead.
            </p>
            <button class="btn btn-primary" id="create-first-lead-btn" type="button">
              Crear lead
            </button>
          </div>
        </td>
      </tr>
    `;

    document.getElementById("create-first-lead-btn")?.addEventListener("click", () => openLeadModal());
    return;
  }

  tbody.innerHTML = filteredLeads
    .map(
      lead => `
      <tr>
        <td>${escapeHtml(lead.name || "—")}</td>
        <td>${escapeHtml(lead.company || "—")}</td>
        <td>${escapeHtml(lead.source || "—")}</td>
        <td>${escapeHtml(lead.status || "—")}</td>
        <td>${lead.createdAt?.toDate ? formatDate(lead.createdAt.toDate()) : "—"}</td>
        <td>
          <div class="btn-row">
            <button class="btn btn-secondary btn-sm js-edit-lead" data-id="${lead.id}" type="button">Editar</button>
            <button class="btn btn-secondary btn-sm js-quote-lead" data-id="${lead.id}" type="button">Cotizar</button>
            <button class="btn btn-secondary btn-sm js-delete-lead" data-id="${lead.id}" type="button">Eliminar</button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");

  bindLeadActions();
}

function bindLeadActions() {
  document.querySelectorAll(".js-edit-lead").forEach(btn => {
    btn.onclick = () => {
      const lead = leadsCache.find(item => item.id === btn.dataset.id);
      if (lead) openLeadModal(lead);
    };
  });

  document.querySelectorAll(".js-quote-lead").forEach(btn => {
    btn.onclick = () => {
      window.location.hash = `quote-editor?type=lead&id=${btn.dataset.id}`;
    };
  });

  document.querySelectorAll(".js-delete-lead").forEach(btn => {
    btn.onclick = async () => {
      const lead = leadsCache.find(item => item.id === btn.dataset.id);
      if (!lead) return;

      if (!confirm(`Eliminar lead "${lead.name}"?`)) return;

      try {
        await deleteLead(lead.id);
        showToast("Lead eliminado");
        await loadLeads();
      } catch (error) {
        console.error(error);
        showToast("No se pudo eliminar el lead");
      }
    };
  });
}

async function loadLeads() {
  try {
    leadsCache = await listBusinessCollection("leads");
    filteredLeads = [...leadsCache];

    renderLeadPlanAlert();
    renderLeadRows();
  } catch (error) {
    console.error("ERROR AL CARGAR LEADS:", error);
  }
}

export function renderLeads() {
  return `
    <section class="app-view glass">
      <div class="app-view-header">
        <div class="app-view-title">
          <p class="eyebrow-sm">Leads</p>
          <h2>Prospectos y oportunidades iniciales</h2>
          <p class="muted">
            Captura, organiza, filtra y da seguimiento a los leads antes de convertirlos en clientes.
          </p>
        </div>

        <div class="btn-row">
          <button class="btn btn-primary" id="new-lead-btn" type="button">Nuevo lead</button>
        </div>
      </div>

      <div class="app-view-grid">
        <div id="leads-plan-alert"></div>

        <article class="app-panel">
          <div class="form-grid-2 mb-4">
            <div class="field">
              <label>Buscar</label>
              <input id="leads-search" type="text" placeholder="Nombre, empresa, email, teléfono..." />
            </div>

            <div class="field">
              <label>Filtrar por estatus</label>
              <select id="leads-filter-status">
                <option value="">Todos</option>
                <option value="Nuevo">Nuevo</option>
                <option value="Contactado">Contactado</option>
                <option value="Cotización enviada">Cotización enviada</option>
                <option value="Seguimiento">Seguimiento</option>
              </select>
            </div>
          </div>

          <div class="card-head">
            <strong>Listado de leads</strong>
            <span id="leads-count">Cargando...</span>
          </div>

          <div class="table-shell">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Empresa</th>
                  <th>Origen</th>
                  <th>Estatus</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="leads-table-body">
                <tr>
                  <td colspan="6">Cargando leads...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  `;
}

export function initLeads() {
  loadLeads();

  document.getElementById("new-lead-btn")?.addEventListener("click", () => openLeadModal());
  document.getElementById("leads-search")?.addEventListener("input", applyLeadFilters);
  document.getElementById("leads-filter-status")?.addEventListener("change", applyLeadFilters);
}
