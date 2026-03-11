import { $, formatDate, escapeHtml } from "../helpers.js";
import { showToast } from "../ui.js";
import {
  listBusinessCollection,
  createLead,
  updateLead,
  deleteLead,
  getCurrentBusinessPlan,
  canCreateEntity,
  getPlanLimitMessage,
  canDeleteInCurrentPlan
} from "../firestore-service.js";

let leadsCache = [];
let filteredLeads = [];
let editingLeadId = null;

function normalizeDate(value) {
  if (!value) return "—";
  if (value?.toDate) return formatDate(value.toDate());
  return formatDate(value);
}

function getLeadById(id) {
  return leadsCache.find(item => item.id === id) || null;
}

function renderLeadPlanAlert() {
  const box = $("#leads-plan-alert");
  if (!box) return;

  const plan = getCurrentBusinessPlan();

  if (plan.code === "pro") {
    box.innerHTML = "";
    return;
  }

  const current = leadsCache.length;
  const limit = plan.limits.leads;
  const reached = current >= limit;

  box.innerHTML = `
    <article class="app-panel">
      <div class="card-head">
        <strong>${plan.name}</strong>
        <span>${current}/${limit} leads usados</span>
      </div>
      <p class="muted">
        ${
          reached
            ? "¿Necesitas agregar más leads? Mejora tu plan para seguir captando oportunidades."
            : "Tu plan actual incluye hasta 3 leads."
        }
      </p>
      <div class="btn-row mt-4">
        <a href="#settings" class="btn btn-secondary btn-sm">Mejorar plan</a>
      </div>
    </article>
  `;
}

function applyFilters() {
  const search = ($("#leads-search")?.value || "").toLowerCase().trim();
  const status = $("#leads-filter-status")?.value || "";

  filteredLeads = leadsCache.filter(lead => {
    const haystack = [
      lead.name || "",
      lead.company || "",
      lead.source || "",
      lead.email || "",
      lead.phone || ""
    ].join(" ").toLowerCase();

    const matchesSearch = !search || haystack.includes(search);
    const matchesStatus = !status || lead.status === status;

    return matchesSearch && matchesStatus;
  });

  renderLeadRows();
}

function renderLeadRows() {
  const tbody = $("#leads-table-body");
  const count = $("#leads-count");
  const canDelete = canDeleteInCurrentPlan();

  if (!tbody || !count) return;

  count.textContent = `${filteredLeads.length} registros`;

  if (!filteredLeads.length) {
    tbody.innerHTML = `<tr><td colspan="6">No se encontraron leads.</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredLeads
    .map(
      lead => `
        <tr>
          <td>${escapeHtml(lead.name || "—")}</td>
          <td>${escapeHtml(lead.company || "—")}</td>
          <td>${escapeHtml(lead.source || "—")}</td>
          <td>${escapeHtml(lead.status || "Nuevo")}</td>
          <td>${normalizeDate(lead.createdAt)}</td>
          <td>
            <div class="btn-row" style="gap:8px;">
              <button class="btn btn-secondary btn-sm js-edit-lead" data-id="${lead.id}">Editar</button>
              ${canDelete ? `<button class="btn btn-secondary btn-sm js-delete-lead" data-id="${lead.id}">Eliminar</button>` : ``}
              <a class="btn btn-secondary btn-sm" href="#quote-editor?type=lead&id=${lead.id}">Cotizar</a>
            </div>
          </td>
        </tr>
      `
    )
    .join("");

  bindLeadRowActions();
}

async function loadLeads() {
  try {
    leadsCache = await listBusinessCollection("leads");
    filteredLeads = [...leadsCache];
    renderLeadPlanAlert();
    renderLeadRows();
  } catch (error) {
    console.error(error);
    const tbody = $("#leads-table-body");
    const count = $("#leads-count");
    if (count) count.textContent = "Error";
    if (tbody) tbody.innerHTML = `<tr><td colspan="6">No se pudieron cargar los leads.</td></tr>`;
  }
}

function fillLeadForm(lead = null) {
  $("#lead-name").value = lead?.name || "";
  $("#lead-company").value = lead?.company || "";
  $("#lead-source").value = lead?.source || "";
  $("#lead-status").value = lead?.status || "Nuevo";
  $("#lead-email").value = lead?.email || "";
  $("#lead-phone").value = lead?.phone || "";
}

function resetLeadForm() {
  editingLeadId = null;
  fillLeadForm(null);
  const submitText = $("#lead-submit-text");
  if (submitText) submitText.textContent = "Guardar lead";
}

function bindLeadRowActions() {
  document.querySelectorAll(".js-edit-lead").forEach(button => {
    button.onclick = () => {
      const id = button.dataset.id;
      const lead = getLeadById(id);
      const panel = $("#lead-form-panel");
      const submitText = $("#lead-submit-text");

      if (!lead) return;

      editingLeadId = id;
      fillLeadForm(lead);
      if (panel) panel.style.display = "block";
      if (submitText) submitText.textContent = "Actualizar lead";
    };
  });

  document.querySelectorAll(".js-delete-lead").forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.id;
      const lead = getLeadById(id);
      if (!lead) return;

      const ok = window.confirm(`¿Eliminar el lead "${lead.name || "Sin nombre"}"?`);
      if (!ok) return;

      try {
        await deleteLead(id, lead.name || "");
        showToast("Lead eliminado correctamente");
        await loadLeads();
      } catch (error) {
        console.error(error);
        showToast("No se pudo eliminar el lead");
      }
    };
  });
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
          <button class="btn btn-primary" type="button" id="new-lead-btn">Nuevo lead</button>
        </div>
      </div>

      <div class="app-view-grid">
        <div id="leads-plan-alert"></div>

        <article class="app-panel">
          <div class="form-grid-2" style="margin-bottom:16px;">
            <div class="field">
              <label for="leads-search">Buscar</label>
              <input id="leads-search" type="text" placeholder="Nombre, empresa, email, teléfono..." />
            </div>
            <div class="field">
              <label for="leads-filter-status">Filtrar por estatus</label>
              <select id="leads-filter-status">
                <option value="">Todos</option>
                <option value="Nuevo">Nuevo</option>
                <option value="Contactado">Contactado</option>
                <option value="Cotización enviada">Cotización enviada</option>
                <option value="Negociación">Negociación</option>
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
                <tr><td colspan="6">Cargando leads...</td></tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="app-panel" id="lead-form-panel" style="display:none;">
          <div class="card-head">
            <strong>Lead</strong>
            <span>Captura rápida</span>
          </div>

          <form id="lead-form">
            <div class="form-grid-2">
              <div class="field">
                <label for="lead-name">Nombre</label>
                <input id="lead-name" type="text" required />
              </div>
              <div class="field">
                <label for="lead-company">Empresa</label>
                <input id="lead-company" type="text" />
              </div>
              <div class="field">
                <label for="lead-source">Origen</label>
                <input id="lead-source" type="text" placeholder="WhatsApp, Web, Instagram..." />
              </div>
              <div class="field">
                <label for="lead-status">Estatus</label>
                <select id="lead-status">
                  <option>Nuevo</option>
                  <option>Contactado</option>
                  <option>Cotización enviada</option>
                  <option>Negociación</option>
                </select>
              </div>
              <div class="field">
                <label for="lead-email">Email</label>
                <input id="lead-email" type="email" />
              </div>
              <div class="field">
                <label for="lead-phone">Teléfono</label>
                <input id="lead-phone" type="text" />
              </div>
            </div>

            <div class="btn-row mt-5">
              <button class="btn btn-primary" type="submit"><span id="lead-submit-text">Guardar lead</span></button>
              <button class="btn btn-secondary" type="button" id="cancel-lead-edit-btn">Cancelar</button>
            </div>
          </form>
        </article>
      </div>
    </section>
  `;
}

export function initLeads() {
  const newBtn = $("#new-lead-btn");
  const panel = $("#lead-form-panel");
  const form = $("#lead-form");
  const cancelBtn = $("#cancel-lead-edit-btn");

  loadLeads();

  $("#leads-search")?.addEventListener("input", applyFilters);
  $("#leads-filter-status")?.addEventListener("change", applyFilters);

  newBtn?.addEventListener("click", async () => {
    const permission = await canCreateEntity("leads");

    if (!permission.allowed) {
      showToast(getPlanLimitMessage("leads"));
      renderLeadPlanAlert();
      return;
    }

    resetLeadForm();
    if (panel) panel.style.display = "block";
  });

  cancelBtn?.addEventListener("click", () => {
    resetLeadForm();
    if (panel) panel.style.display = "none";
  });

  form?.addEventListener("submit", async event => {
    event.preventDefault();

    const payload = {
      name: $("#lead-name")?.value.trim() || "",
      company: $("#lead-company")?.value.trim() || "",
      source: $("#lead-source")?.value.trim() || "Manual",
      status: $("#lead-status")?.value || "Nuevo",
      email: $("#lead-email")?.value.trim() || "",
      phone: $("#lead-phone")?.value.trim() || ""
    };

    try {
      if (editingLeadId) {
        await updateLead(editingLeadId, payload);
        showToast("Lead actualizado correctamente");
      } else {
        const permission = await canCreateEntity("leads");

        if (!permission.allowed) {
          showToast(getPlanLimitMessage("leads"));
          renderLeadPlanAlert();
          return;
        }

        await createLead(payload);
        showToast("Lead guardado correctamente");
      }

      resetLeadForm();
      if (panel) panel.style.display = "none";
      await loadLeads();
    } catch (error) {
      console.error(error);
      showToast("No se pudo guardar el lead");
    }
  });
}