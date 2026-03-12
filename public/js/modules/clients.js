import { escapeHtml, formatDate } from "../helpers.js";
import { showToast } from "../ui.js";
import {
  listBusinessCollection,
  createClient,
  updateClient,
  deleteClient,
  getCurrentBusinessPlan,
  canCreateEntity,
  getPlanLimitMessage
} from "../firestore-service.js";

let clientsCache = [];
let filteredClients = [];

function buildUsageDots(current = 0, limit = 3) {
  return `
    <div class="plan-usage-dots">
      ${Array.from({ length: limit })
        .map((_, index) => `<span class="plan-usage-dot ${index < current ? "is-filled" : ""}"></span>`)
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
  const limit = plan.limits.clients;

  box.innerHTML = `
    <article class="app-panel plan-usage-card">
      <div class="card-head">
        <strong>Plan Inicio</strong>
        <span>${current}/${limit} clientes usados</span>
      </div>

      ${buildUsageDots(current, limit)}

      <p class="muted">
        Tu plan actual incluye hasta 3 clientes.
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
  const search = (document.getElementById("clients-search")?.value || "").toLowerCase().trim();

  filteredClients = clientsCache.filter(client => {
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

  const name = prompt("Empresa / Cliente", client?.name || "");
  if (name === null) return;

  const contact = prompt("Contacto", client?.contact || "");
  if (contact === null) return;

  const email = prompt("Correo", client?.email || "");
  if (email === null) return;

  const phone = prompt("Teléfono", client?.phone || "");
  if (phone === null) return;

  const payload = {
    name: name.trim(),
    contact: contact.trim(),
    email: email.trim(),
    phone: phone.trim()
  };

  if (isEdit) {
    updateClient(client.id, payload)
      .then(() => {
        showToast("Cliente actualizado");
        return loadClients();
      })
      .catch(error => {
        console.error(error);
        showToast("No se pudo actualizar el cliente");
      });
  } else {
    canCreateEntity("clients")
      .then(permission => {
        if (!permission.allowed) {
          showToast(getPlanLimitMessage("clients"));
          window.location.hash = "settings";
          return;
        }

        return createClient(payload).then(() => {
          showToast("Cliente creado");
          return loadClients();
        });
      })
      .catch(error => {
        console.error(error);
        showToast("No se pudo crear el cliente");
      });
  }
}

function renderClientRows() {
  const tbody = document.getElementById("clients-table-body");
  const count = document.getElementById("clients-count");

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
            <button class="btn btn-primary" id="create-first-client-btn" type="button">
              Crear cliente
            </button>
          </div>
        </td>
      </tr>
    `;

    document.getElementById("create-first-client-btn")?.addEventListener("click", () => openClientModal());
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
        <td>${client.createdAt?.toDate ? formatDate(client.createdAt.toDate()) : "—"}</td>
        <td>
          <div class="btn-row">
            <button class="btn btn-secondary btn-sm js-edit-client" data-id="${client.id}" type="button">Editar</button>
            <button class="btn btn-secondary btn-sm js-quote-client" data-id="${client.id}" type="button">Cotizar</button>
            <button class="btn btn-secondary btn-sm js-delete-client" data-id="${client.id}" type="button">Eliminar</button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");

  bindClientActions();
}

function bindClientActions() {
  document.querySelectorAll(".js-edit-client").forEach(btn => {
    btn.onclick = () => {
      const client = clientsCache.find(item => item.id === btn.dataset.id);
      if (client) openClientModal(client);
    };
  });

  document.querySelectorAll(".js-quote-client").forEach(btn => {
    btn.onclick = () => {
      window.location.hash = `quote-editor?type=client&id=${btn.dataset.id}`;
    };
  });

  document.querySelectorAll(".js-delete-client").forEach(btn => {
    btn.onclick = async () => {
      const client = clientsCache.find(item => item.id === btn.dataset.id);
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
          <button class="btn btn-primary" id="new-client-btn" type="button">Nuevo cliente</button>
        </div>
      </div>

      <div class="app-view-grid">
        <div id="clients-plan-alert"></div>

        <article class="app-panel">
          <div class="mb-4">
            <div class="field">
              <label>Buscar</label>
              <input id="clients-search" type="text" placeholder="Empresa, contacto, email, teléfono..." />
            </div>
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
                <tr>
                  <td colspan="6">Cargando clientes...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  `;
}

export function initClients() {
  loadClients();

  document.getElementById("new-client-btn")?.addEventListener("click", () => openClientModal());
  document.getElementById("clients-search")?.addEventListener("input", applyClientFilters);
}
