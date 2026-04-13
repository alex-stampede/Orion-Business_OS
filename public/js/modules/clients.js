import { escapeHtml, formatDate } from "../helpers.js";
import {
  showToast,
  openModal,
  closeModal,
  bindModalFormSubmit
} from "../ui.js";

import {
  listBusinessCollection,
  createClient,
  updateClient,
  deleteClient,
  getCurrentBusinessPlan,
  canCreateEntity,
  getPlanLimitMessage,
  canDeleteInCurrentPlan
} from "../firestore-service.js";

let clientsCache = [];
let filteredClients = [];

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

function renderClientPlanAlert() {
  const box = document.getElementById("clients-plan-alert");
  if (!box) return;

  const plan = getCurrentBusinessPlan();

  if (plan.code === "pro") {
    box.innerHTML = "";
    return;
  }

  const current = clientsCache.length;
  const limit = plan.limits.clients || 3;

  box.innerHTML = `
    <article class="app-panel plan-usage-card">
      <div class="card-head">
        <strong>Plan Inicio</strong>
        <span>${current}/${limit} clientes usados</span>
      </div>

      ${buildUsageDots(current, limit)}

      <p class="muted">
        Actualiza a Plan Pro para tener clientes ilimitados.
      </p>

      <div class="btn-row mt-4">
        <a href="#settings" class="btn btn-secondary btn-sm">
          Actualizar a Plan Pro · $179 MXN / mes
        </a>
      </div>
    </article>
  `;
}

function applyClientFilters() {
  const search = (document.getElementById("clients-search")?.value || "")
    .toLowerCase()
    .trim();

  filteredClients = clientsCache.filter((client) => {
    const haystack = [
      client.name || "",
      client.contact || "",
      client.email || "",
      client.phone || ""
    ]
      .join(" ")
      .toLowerCase();

    return !search || haystack.includes(search);
  });

  renderClientRows();
}

function openClientModal(client = null) {
  const isEdit = Boolean(client);

  openModal({
    title: isEdit ? "Editar cliente" : "Nuevo cliente",

    content: `
<form id="client-modal-form" style="display:grid;gap:16px">

<p class="modal-note">
${
  isEdit
    ? "Actualiza la información del cliente."
    : "Registra un nuevo cliente dentro de tu base comercial."
}
</p>

<div class="modal-grid-2">

<div class="field">
<label>Empresa / Cliente</label>
<input
  name="name"
  value="${escapeHtml(client?.name || "")}"
  placeholder="Nombre del cliente o empresa"
  required
>
</div>

<div class="field">
<label>Contacto</label>
<input
  name="contact"
  value="${escapeHtml(client?.contact || "")}"
  placeholder="Nombre del contacto"
>
</div>

<div class="field">
<label>Email</label>
<input
  name="email"
  value="${escapeHtml(client?.email || "")}"
  placeholder="correo@empresa.com"
>
</div>

<div class="field">
<label>Teléfono</label>
<input
  name="phone"
  value="${escapeHtml(client?.phone || "")}"
  placeholder="33 0000 0000"
>
</div>

</div>
</form>
`,

    actions: `
<button class="btn btn-secondary" id="cancel-client-modal">
Cancelar
</button>

<button class="btn btn-primary" type="submit" form="client-modal-form">
${isEdit ? "Guardar cambios" : "Crear cliente"}
</button>
`
  });

  document
    .getElementById("cancel-client-modal")
    ?.addEventListener("click", closeModal);

  bindModalFormSubmit("client-modal-form", async (form) => {
    const data = Object.fromEntries(new FormData(form));

    try {
      if (isEdit) {
        await updateClient(client.id, data);
        showToast("Cliente actualizado");
      } else {
        const permission = await canCreateEntity("clients");

        if (!permission.allowed) {
          showToast(getPlanLimitMessage("clients"));
          window.location.hash = "settings";
          return;
        }

        await createClient(data);
        showToast("Cliente creado");
      }

      closeModal();
      await loadClients();
    } catch (error) {
      console.error(error);
      showToast("Error guardando cliente");
    }
  });
}

function renderClientRows() {
  const tbody = document.getElementById("clients-table-body");
  const count = document.getElementById("clients-count");

  const canDelete = canDeleteInCurrentPlan();

  if (!tbody || !count) return;

  count.textContent = `${filteredClients.length} registros`;

  if (!filteredClients.length) {
    tbody.innerHTML = `
<tr>
<td colspan="6">
<div style="padding:40px;text-align:center">

<h3>Aún no has creado clientes</h3>

<p class="muted">
Empieza agregando tu primer cliente.
</p>

<button class="btn btn-primary" id="create-first-client-btn">
Crear cliente
</button>

</div>
</td>
</tr>
`;

    document
      .getElementById("create-first-client-btn")
      ?.addEventListener("click", () => openClientModal());

    return;
  }

  tbody.innerHTML = filteredClients
    .map(
      (client) => `
<tr>

<td>${escapeHtml(client.name || "—")}</td>

<td>${escapeHtml(client.contact || "—")}</td>

<td>${escapeHtml(client.email || "—")}</td>

<td>${escapeHtml(client.phone || "—")}</td>

<td>${
        client.createdAt?.toDate
          ? formatDate(client.createdAt.toDate())
          : "—"
      }</td>

<td>

<div class="btn-row">

<button class="btn btn-secondary btn-sm js-edit-client"
data-id="${client.id}">
Editar
</button>

<button class="btn btn-secondary btn-sm js-quote-client"
data-id="${client.id}">
Cotizar
</button>

<button class="btn btn-secondary btn-sm js-delete-client ${
        canDelete ? "" : "btn-disabled"
      }"
data-id="${client.id}"
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

  bindClientActions();
}

function bindClientActions() {
  document.querySelectorAll(".js-edit-client").forEach((btn) => {
    btn.onclick = () => {
      const client = clientsCache.find((c) => c.id === btn.dataset.id);
      openClientModal(client);
    };
  });

  document.querySelectorAll(".js-quote-client").forEach((btn) => {
    btn.onclick = () => {
      window.location.hash = `quote-editor?type=client&id=${btn.dataset.id}`;
    };
  });

  document.querySelectorAll(".js-delete-client").forEach((btn) => {
    btn.onclick = async () => {
      if (!canDeleteInCurrentPlan()) {
        showToast("Eliminar clientes está disponible en Plan Pro");
        window.location.hash = "settings";
        return;
      }

      const client = clientsCache.find((c) => c.id === btn.dataset.id);
      if (!client) return;

      if (!confirm(`Eliminar cliente "${client.name}"?`)) return;

      try {
        await deleteClient(client.id);
        showToast("Cliente eliminado");
        await loadClients();
      } catch (error) {
        console.error(error);
        showToast("No se pudo eliminar el cliente");
      }
    };
  });
}

async function loadClients() {
  try {
    clientsCache = await listBusinessCollection("clients");
    filteredClients = [...clientsCache];

    renderClientPlanAlert();
    renderClientRows();
  } catch (error) {
    console.error("ERROR AL CARGAR CLIENTES:", error);
  }
}

export function renderClients() {
  return `
<section class="app-view glass">

<div class="app-view-header">

<div class="app-view-title">
<p class="eyebrow-sm">Clientes</p>
<h2>Base comercial organizada</h2>
<p class="muted">
Consulta, filtra y gestiona tus clientes desde un solo lugar.
</p>
</div>

<div class="btn-row">
<button class="btn btn-primary" id="new-client-btn">
Nuevo cliente
</button>
</div>

</div>

<div class="app-view-grid">

<div id="clients-plan-alert"></div>

<article class="app-panel">

<div class="mb-4">
<div class="field">
<label>Buscar</label>
<input
  id="clients-search"
  placeholder="Empresa, contacto, email, teléfono..."
>
</div>
</div>

<div class="card-head">
<strong>Listado de clientes</strong>
<span id="clients-count"></span>
</div>

<div class="table-shell">
<table class="data-table">
<thead>
<tr>
<th>Empresa</th>
<th>Contacto</th>
<th>Email</th>
<th>Teléfono</th>
<th>Desde</th>
<th>Acciones</th>
</tr>
</thead>
<tbody id="clients-table-body"></tbody>
</table>
</div>

</article>

</div>

</section>
`;
}

export function initClients() {
  loadClients();

  document
    .getElementById("new-client-btn")
    ?.addEventListener("click", () => openClientModal());

  document
    .getElementById("clients-search")
    ?.addEventListener("input", applyClientFilters);
}
