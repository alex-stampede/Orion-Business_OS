import { $, formatDate, escapeHtml } from "../helpers.js";
import { showToast } from "../ui.js";
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
let editingClientId = null;

function normalizeDate(value) {
  if (!value) return "—";
  if (value?.toDate) return formatDate(value.toDate());
  return formatDate(value);
}

function getClientById(id) {
  return clientsCache.find(item => item.id === id) || null;
}

function renderClientPlanAlert() {
  const box = $("#clients-plan-alert");
  if (!box) return;

  const plan = getCurrentBusinessPlan();

  if (plan.code === "pro") {
    box.innerHTML = "";
    return;
  }

  const current = clientsCache.length;
  const limit = plan.limits.clients;
  const reached = current >= limit;

  box.innerHTML = `
    <article class="app-panel">
      <div class="card-head">
        <strong>${plan.name}</strong>
        <span>${current}/${limit} clientes usados</span>
      </div>
      <p class="muted">
        ${
          reached
            ? "¿Necesitas agregar más clientes? Mejora tu plan para administrar más relaciones comerciales."
            : "Tu plan actual incluye hasta 3 clientes."
        }
      </p>
      <div class="btn-row mt-4">
        <a href="#settings" class="btn btn-secondary btn-sm">Mejorar plan</a>
      </div>
    </article>
  `;
}

function applyFilters() {
  const search = ($("#clients-search")?.value || "").toLowerCase().trim();

  filteredClients = clientsCache.filter(client => {
    const haystack = [
      client.name || "",
      client.contact || "",
      client.email || "",
      client.phone || ""
    ].join(" ").toLowerCase();

    return !search || haystack.includes(search);
  });

  renderClientRows();
}

function renderClientRows() {
  const tbody = $("#clients-table-body");
  const count = $("#clients-count");
  const canDelete = canDeleteInCurrentPlan();

  if (!tbody || !count) return;

  count.textContent = `${filteredClients.length} registros`;

  if (!filteredClients.length) {
    tbody.innerHTML = `<tr><td colspan="6">No se encontraron clientes.</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredClients
    .map(
      client => `
        <tr>
          <td>${escapeHtml(client.name || "—")}</td>
          <td>${escapeHtml(client.contact || "—")}</td>
          <td>${escapeHtml(client.email || "—")}</td>
          <td>${escapeHtml(client.phone || "—")}</td>
          <td>${normalizeDate(client.createdAt)}</td>
          <td>
            <div class="btn-row" style="gap:8px;">
              <button class="btn btn-secondary btn-sm js-edit-client" data-id="${client.id}">Editar</button>
              ${canDelete ? `<button class="btn btn-secondary btn-sm js-delete-client" data-id="${client.id}">Eliminar</button>` : ``}
              <a class="btn btn-secondary btn-sm" href="#quote-editor?type=client&id=${client.id}">Cotizar</a>
            </div>
          </td>
        </tr>
      `
    )
    .join("");

  bindClientRowActions();
}

async function loadClients() {
  try {
    clientsCache = await listBusinessCollection("clients");
    filteredClients = [...clientsCache];
    renderClientPlanAlert();
    renderClientRows();
  } catch (error) {
    console.error(error);
    const tbody = $("#clients-table-body");
    const count = $("#clients-count");
    if (count) count.textContent = "Error";
    if (tbody) tbody.innerHTML = `<tr><td colspan="6">No se pudieron cargar los clientes.</td></tr>`;
  }
}

function fillClientForm(client = null) {
  $("#client-name").value = client?.name || "";
  $("#client-contact").value = client?.contact || "";
  $("#client-email").value = client?.email || "";
  $("#client-phone").value = client?.phone || "";
}

function resetClientForm() {
  editingClientId = null;
  fillClientForm(null);
  const submitText = $("#client-submit-text");
  if (submitText) submitText.textContent = "Guardar cliente";
}

function bindClientRowActions() {
  document.querySelectorAll(".js-edit-client").forEach(button => {
    button.onclick = () => {
      const id = button.dataset.id;
      const client = getClientById(id);
      const panel = $("#client-form-panel");
      const submitText = $("#client-submit-text");

      if (!client) return;

      editingClientId = id;
      fillClientForm(client);
      if (panel) panel.style.display = "block";
      if (submitText) submitText.textContent = "Actualizar cliente";
    };
  });

  document.querySelectorAll(".js-delete-client").forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.id;
      const client = getClientById(id);
      if (!client) return;

      const ok = window.confirm(`¿Eliminar el cliente "${client.name || "Sin nombre"}"?`);
      if (!ok) return;

      try {
        await deleteClient(id, client.name || "");
        showToast("Cliente eliminado correctamente");
        await loadClients();
      } catch (error) {
        console.error(error);
        showToast("No se pudo eliminar el cliente");
      }
    };
  });
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
          <button class="btn btn-primary" type="button" id="new-client-btn">Nuevo cliente</button>
        </div>
      </div>

      <div class="app-view-grid">
        <div id="clients-plan-alert"></div>

        <article class="app-panel">
          <div class="field" style="margin-bottom:16px;">
            <label for="clients-search">Buscar</label>
            <input id="clients-search" type="text" placeholder="Empresa, contacto, email, teléfono..." />
          </div>

          <div class="card-head">
            <strong>Listado de clientes</strong>
            <span id="clients-count">Cargando...</span>
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
              <tbody id="clients-table-body">
                <tr><td colspan="6">Cargando clientes...</td></tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="app-panel" id="client-form-panel" style="display:none;">
          <div class="card-head">
            <strong>Cliente</strong>
            <span>Captura rápida</span>
          </div>

          <form id="client-form">
            <div class="form-grid-2">
              <div class="field">
                <label for="client-name">Empresa</label>
                <input id="client-name" type="text" required />
              </div>
              <div class="field">
                <label for="client-contact">Contacto</label>
                <input id="client-contact" type="text" />
              </div>
              <div class="field">
                <label for="client-email">Email</label>
                <input id="client-email" type="email" />
              </div>
              <div class="field">
                <label for="client-phone">Teléfono</label>
                <input id="client-phone" type="text" />
              </div>
            </div>

            <div class="btn-row mt-5">
              <button class="btn btn-primary" type="submit"><span id="client-submit-text">Guardar cliente</span></button>
              <button class="btn btn-secondary" type="button" id="cancel-client-edit-btn">Cancelar</button>
            </div>
          </form>
        </article>
      </div>
    </section>
  `;
}

export function initClients() {
  const newBtn = $("#new-client-btn");
  const panel = $("#client-form-panel");
  const form = $("#client-form");
  const cancelBtn = $("#cancel-client-edit-btn");

  loadClients();

  $("#clients-search")?.addEventListener("input", applyFilters);

  newBtn?.addEventListener("click", async () => {
    const permission = await canCreateEntity("clients");

    if (!permission.allowed) {
      showToast(getPlanLimitMessage("clients"));
      renderClientPlanAlert();
      return;
    }

    resetClientForm();
    if (panel) panel.style.display = "block";
  });

  cancelBtn?.addEventListener("click", () => {
    resetClientForm();
    if (panel) panel.style.display = "none";
  });

  form?.addEventListener("submit", async event => {
    event.preventDefault();

    const payload = {
      name: $("#client-name")?.value.trim() || "",
      contact: $("#client-contact")?.value.trim() || "",
      email: $("#client-email")?.value.trim() || "",
      phone: $("#client-phone")?.value.trim() || ""
    };

    try {
      if (editingClientId) {
        await updateClient(editingClientId, payload);
        showToast("Cliente actualizado correctamente");
      } else {
        const permission = await canCreateEntity("clients");

        if (!permission.allowed) {
          showToast(getPlanLimitMessage("clients"));
          renderClientPlanAlert();
          return;
        }

        await createClient(payload);
        showToast("Cliente guardado correctamente");
      }

      resetClientForm();
      if (panel) panel.style.display = "none";
      await loadClients();
    } catch (error) {
      console.error(error);
      showToast("No se pudo guardar el cliente");
    }
  });
}