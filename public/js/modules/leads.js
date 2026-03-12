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
  getPlanLimitMessage,
  canDeleteInCurrentPlan
} from "../firestore-service.js";

let leadsCache = [];
let filteredLeads = [];

function buildUsageDots(current = 0, limit = 3) {
  return `
    <div class="plan-usage-dots">
      ${Array.from({ length: limit })
        .map(
          (_, i) =>
            `<span class="plan-usage-dot ${
              i < current ? "is-filled" : ""
            }"></span>`
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
<form id="lead-modal-form" style="display:grid;gap:16px">

<p class="modal-note">
${
  isEdit
    ? "Actualiza la información del prospecto."
    : "Captura la información del lead para dar seguimiento comercial."
}
</p>

<div class="modal-grid-2">

<div class="field">
<label>Nombre</label>
<input name="name" value="${escapeHtml(lead?.name || "")}" required>
</div>

<div class="field">
<label>Empresa</label>
<input name="company" value="${escapeHtml(lead?.company || "")}">
</div>

<div class="field">
<label>Email</label>
<input name="email" value="${escapeHtml(lead?.email || "")}">
</div>

<div class="field">
<label>Teléfono</label>
<input name="phone" value="${escapeHtml(lead?.phone || "")}">
</div>

<div class="field">
<label>Origen</label>
<input name="source" value="${escapeHtml(lead?.source || "Manual")}">
</div>

<div class="field">
<label>Estatus</label>
<select name="status">

<option value="Nuevo">Nuevo</option>
<option value="Contactado">Contactado</option>
<option value="Cotización enviada">Cotización enviada</option>
<option value="Seguimiento">Seguimiento</option>

</select>
</div>

</div>
</form>
`,

    actions: `
<button class="btn btn-secondary" id="cancel-lead-modal">
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
    const data = Object.fromEntries(new FormData(form));

    try {
      if (isEdit) {
        await updateLead(lead.id, data);
        showToast("Lead actualizado");
      } else {
        const permission = await canCreateEntity("leads");

        if (!permission.allowed) {
          showToast(getPlanLimitMessage("leads"));
          window.location.hash = "settings";
          return;
        }

        await createLead(data);
        showToast("Lead creado");
      }

      closeModal();
      await loadLeads();
    } catch (error) {
      console.error(error);
      showToast("Error guardando lead");
    }
  });
}

function renderLeadRows() {
  const tbody = document.getElementById("leads-table-body");
  const count = document.getElementById("leads-count");

  const canDelete = canDeleteInCurrentPlan();

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

<button class="btn btn-primary" id="create-first-lead-btn">
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

<td>${
        lead.createdAt?.toDate
          ? formatDate(lead.createdAt.toDate())
          : "—"
      }</td>

<td>

<div class="btn-row">

<button class="btn btn-secondary btn-sm js-edit-lead"
data-id="${lead.id}">
Editar
</button>

<button class="btn btn-secondary btn-sm js-quote-lead"
data-id="${lead.id}">
Cotizar
</button>

<button class="btn btn-secondary btn-sm js-delete-lead ${
        canDelete ? "" : "btn-disabled"
      }"
data-id="${lead.id}"
${canDelete ? "" : "disabled"}>

Eliminar ${
        canDelete
          ? ""
          : '<span class="badge-pro">PRO</span>'
      }

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
      const lead = leadsCache.find((l) => l.id === btn.dataset.id);
      openLeadModal(lead);
    };
  });

  document.querySelectorAll(".js-quote-lead").forEach((btn) => {
    btn.onclick = () => {
      window.location.hash = `quote-editor?type=lead&id=${btn.dataset.id}`;
    };
  });

  document.querySelectorAll(".js-delete-lead").forEach((btn) => {
    btn.onclick = async () => {
      if (!canDeleteInCurrentPlan()) {
        showToast("Eliminar leads está disponible en Plan Pro");
        window.location.hash = "settings";
        return;
      }

      const lead = leadsCache.find((l) => l.id === btn.dataset.id);

      if (!confirm(`Eliminar lead "${lead.name}"?`)) return;

      await deleteLead(lead.id);

      showToast("Lead eliminado");

      loadLeads();
    };
  });
}

async function loadLeads() {
  leadsCache = await listBusinessCollection("leads");
  filteredLeads = [...leadsCache];

  renderLeadPlanAlert();
  renderLeadRows();
}

export function renderLeads() {
  return `
<section class="app-view glass">

<div class="app-view-header">

<div class="app-view-title">

<p class="eyebrow-sm">Leads</p>

<h2>Prospectos y oportunidades iniciales</h2>

<p class="muted">
Captura y da seguimiento a oportunidades comerciales.
</p>

</div>

<div class="btn-row">

<button class="btn btn-primary" id="new-lead-btn">
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

<input id="leads-search">

</div>

<div class="field">

<label>Estatus</label>

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

<span id="leads-count"></span>

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

<tbody id="leads-table-body"></tbody>

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
