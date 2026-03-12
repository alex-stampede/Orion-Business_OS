import { escapeHtml, formatDate } from "../helpers.js";
import {
  showToast,
  openModal,
  closeModal,
  bindModalFormSubmit
} from "../ui.js";
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
        .map(
          (_, index) =>
            `<span class="plan-usage-dot ${index < current ? "is-filled" : ""}"></span>`
        )
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
  const limit = plan.limits.leads || 3;

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
  const search = (document.getElementById("leads-search")?.value || "")
    .toLowerCase()
    .trim();

  const status = document.getElementById("leads-filter-status")?.value || "";

  filteredLeads = leadsCache.filter((lead) => {
    const haystack = [
      lead.name || "",
      lead.company || "",
      lead.email || "",
      lead.phone || "",
      lead.source || ""
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

  openModal({
    title: isEdit ? "Editar lead" : "Nuevo lead",
    content: `
      <form id="lead-modal-form" style="display:grid; gap:16px;">
        <p class="modal-note">
          ${
            isEdit
              ? "Actualiza la información del prospecto."
              : "Captura la información del lead para dar seguimiento comercial."
          }
        </p>

        <div class="modal-grid-2">
          <div class="field">
            <label for="lead-name">Nombre</label>
            <input
              id="lead-name"
              name="name"
              type="text"
              value="${escapeHtml(lead?.name || "")}"
              placeholder="Nombre del contacto"
              required
            />
          </div>

          <div class="field">
            <label for="lead-company">Empresa</label>
            <input
              id="lead-company"
              name="company"
              type="text"
              value="${escapeHtml(lead?.company || "")}"
              placeholder="Empresa o negocio"
            />
          </div>

          <div class="field">
            <label for="lead-email">Correo</label>
            <input
              id="lead-email"
              name="email"
              type="email"
              value="${escapeHtml(lead?.email || "")}"
              placeholder="correo@empresa.com"
            />
          </div>

          <div class="field">
            <label for="lead-phone">Teléfono</label>
            <input
              id="lead-phone"
              name="phone"
              type="text"
              value="${escapeHtml(lead?.phone || "")}"
              placeholder="33 0000 0000"
            />
          </div>

          <div class="field">
            <label for="lead-source">Origen</label>
            <input
              id="lead-source"
              name="source"
              type="text"
              value="${escapeHtml(lead?.source || "Manual")}"
              placeholder="Manual, referido, web..."
            />
          </div>

          <div class="field">
            <label for="lead-status">Estatus</label>
            <select id="lead-status" name="status">
              <option value="Nuevo" ${
                (lead?.status || "Nuevo") === "Nuevo" ? "selected" : ""
              }>Nuevo</option>
              <option value="Contactado" ${
                lead?.status === "Contactado" ? "selected" : ""
              }>Contactado</option>
              <option value="Cotización enviada" ${
                lead?.status === "Cotización enviada" ? "selected" : ""
              }>Cotización enviada</option>
              <option value="Seguimiento" ${
                lead?.status === "Seguimiento" ? "selected" : ""
              }>Seguimiento</option>
            </select>
          </div>
        </div>
      </form>
    `,
    actions: `
      <button class="btn btn-secondary" type="button" id="cancel-lead-modal">
        Cancelar
      </button>
      <button class="btn btn-primary" type="submit" form="lead-modal-form">
        ${isEdit ? "Guardar cambios" : "Crear lead"}
      </button>
    `
  });

  document
    .getElementById("cancel-lead-modal")
    ?.addEventListener("click", closeModal);

  bindModalFormSubmit("lead-modal-form", async (form) => {
    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") || "").trim(),
      company: String(formData.get("company") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      source: String(formData.get("source") || "").trim() || "Manual",
      status: String(formData.get("status") || "").trim() || "Nuevo"
    };

    try {
      if (isEdit) {
        await updateLead(lead.id, payload);
        showToast("Lead actualizado");
      } else {
        const permission = await canCreateEntity("leads");

        if (!permission.allowed) {
          showToast(getPlanLimitMessage("leads"));
          window.location.hash = "settings";
          return;
        }

        await createLead(payload);
        showToast("Lead creado");
      }

      closeModal();
      await loadLeads();
    } catch (error) {
      console.error(error);
      showToast(isEdit ? "No se pudo actualizar el lead" : "No se pudo crear el lead");
    }
  });
}

function renderLeadRows() {
  const tbody = document.getElementById("leads-table-body");
  const count = document.getElementById("leads-count");

  if (!tbody || !count) return;

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

    document
      .getElementById("create-first-lead-btn")
      ?.addEventListener("click", () => openLeadModal());

    return;
  }

  tbody.innerHTML = filteredLeads
    .map(
      (lead) => `
      <tr>
        <td>${escapeHtml(lead.name || "—")}</td>
        <td>${escapeHtml(lead.company || "—")}</td>
        <td>${escapeHtml(lead.source || "—")}</td>
        <td>${escapeHtml(lead.status || "—")}</td>
        <td>${lead.createdAt?.toDate ? formatDate(lead.createdAt.toDate()) : "—"}</td>
        <td>
          <div class="btn-row">
            <button class="btn btn-secondary btn-sm js-edit-lead" data-id="${lead.id}" type="button">
              Editar
            </button>
            <button class="btn btn-secondary btn-sm js-quote-lead" data-id="${lead.id}" type="button">
              Cotizar
            </button>
            <button class="btn btn-secondary btn-sm js-delete-lead" data-id="${lead.id}" type="button">
              Eliminar
            </button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");

  bindLeadActions();
}

function bindLeadActions() {
  document.querySelectorAll(".js-edit-lead").forEach((btn) => {
    btn.onclick = () => {
      const lead = leadsCache.find((item) => item.id === btn.dataset.id);
      if (lead) openLeadModal(lead);
    };
  });

  document.querySelectorAll(".js-quote-lead").forEach((btn) => {
    btn.onclick = () => {
      window.location.hash = `quote-editor?type=lead&id=${btn.dataset.id}`;
    };
  });

  document.querySelectorAll(".js-delete-lead").forEach((btn) => {
    btn.onclick = async () => {
      const lead = leadsCache.find((item) => item.id === btn.dataset.id);
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
          <button class="btn btn-primary" id="new-lead-btn" type="button">
            Nuevo lead
          </button>
        </div>
      </div>

      <div class="app-view-grid">
        <div id="leads-plan-alert"></div>

        <article class="app-panel">
          <div class="form-grid-2 mb-4">
            <div class="field">
              <label>Buscar</label>
              <input
                id="leads-search"
                type="text"
                placeholder="Nombre, empresa, email, teléfono..."
              />
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

  document
    .getElementById("new-lead-btn")
    ?.addEventListener("click", () => openLeadModal());

  document
    .getElementById("leads-search")
    ?.addEventListener("input", applyLeadFilters);

  document
    .getElementById("leads-filter-status")
    ?.addEventListener("change", applyLeadFilters);
}
