import { $, formatCurrency, escapeHtml, getHashParams } from "../helpers.js";
import { showToast } from "../ui.js";
import {
  listBusinessCollection,
  getBusinessDocById,
  getBusinessSettings,
  getNextQuoteFolio,
  createLead,
  createQuote,
  getQuoteById,
  getQuoteItems,
  updateQuote,
  canCreateEntity,
  getPlanLimitMessage,
  getCurrentBusinessPlan,
} from "../firestore-service.js";
import { exportQuoteToPDF } from "../pdf.js";

let leadsCache = [];
let clientsCache = [];
let settingsCache = null;
let editingQuoteId = null;

function getRouteParams() {
  const params = getHashParams();
  return {
    id: params.get("id"),
    type: params.get("type"),
    linkedId: params.get("id"),
  };
}

function calculateTotals(items, taxRate = 16) {
  const subtotal = items.reduce((acc, item) => {
    const qty = Number(item.qty || 0);
    const unitPrice = Number(item.unitPrice || 0);
    return acc + qty * unitPrice;
  }, 0);

  const taxes = subtotal * (Number(taxRate || 0) / 100);
  const total = subtotal + taxes;

  return { subtotal, taxes, total };
}

function getSelectedLinkData() {
  const linkType = $("#quote-link-type")?.value || "none";
  const existingLeadId = $("#quote-existing-lead")?.value || "";
  const existingClientId = $("#quote-existing-client")?.value || "";

  return {
    linkType,
    existingLeadId,
    existingClientId,
  };
}

function renderLeadOptions() {
  const select = $("#quote-existing-lead");
  if (!select) return;

  select.innerHTML = `
    <option value="">Selecciona un lead</option>
    ${leadsCache
      .map(
        (lead) =>
          `<option value="${lead.id}">${escapeHtml(lead.name || "Sin nombre")} ${lead.company ? `— ${escapeHtml(lead.company)}` : ""}</option>`,
      )
      .join("")}
  `;
}

function renderClientOptions() {
  const select = $("#quote-existing-client");
  if (!select) return;

  select.innerHTML = `
    <option value="">Selecciona un cliente</option>
    ${clientsCache
      .map(
        (client) =>
          `<option value="${client.id}">${escapeHtml(client.name || "Sin nombre")}</option>`,
      )
      .join("")}
  `;
}

function updateLinkPanels() {
  const type = $("#quote-link-type")?.value || "none";
  const leadPanel = $("#quote-link-lead-panel");
  const clientPanel = $("#quote-link-client-panel");
  const newLeadPanel = $("#quote-new-lead-panel");

  if (leadPanel) leadPanel.style.display = type === "lead" ? "block" : "none";
  if (clientPanel)
    clientPanel.style.display = type === "client" ? "block" : "none";
  if (newLeadPanel)
    newLeadPanel.style.display = type === "new-lead" ? "block" : "none";
}

function readItems() {
  const rows = Array.from(document.querySelectorAll(".item-row"));

  return rows
    .map((row) => {
      const name = row.querySelector(".item-name")?.value.trim() || "";
      const qty = Number(row.querySelector(".item-qty")?.value || 0);
      const unitPrice = Number(row.querySelector(".item-price")?.value || 0);

      return {
        name,
        qty,
        unitPrice,
        subtotal: qty * unitPrice,
      };
    })
    .filter((item) => item.name || item.qty || item.unitPrice);
}

function updateSummary() {
  const taxRate = Number($("#quote-tax")?.value || 0);
  const currency = $("#quote-currency")?.value || "MXN";
  const items = readItems();
  const { subtotal, taxes, total } = calculateTotals(items, taxRate);

  const summary = $("#quote-summary");
  if (!summary) return;

  summary.innerHTML = `
    <div class="activity-item"><span class="activity-dot"></span><p>Subtotal estimado: <strong>${formatCurrency(subtotal, currency)}</strong></p></div>
    <div class="activity-item"><span class="activity-dot"></span><p>Impuestos: <strong>${formatCurrency(taxes, currency)}</strong></p></div>
    <div class="activity-item"><span class="activity-dot"></span><p>Total: <strong>${formatCurrency(total, currency)}</strong></p></div>
  `;
}

function bindItemInputs() {
  document
    .querySelectorAll(
      ".item-name, .item-qty, .item-price, #quote-tax, #quote-currency",
    )
    .forEach((input) => {
      input.removeEventListener("input", updateSummary);
      input.addEventListener("input", updateSummary);
      input.removeEventListener("change", updateSummary);
      input.addEventListener("change", updateSummary);
    });
}

function addItemRow(item = null) {
  const itemsContainer = $("#quote-items");
  if (!itemsContainer) return;

  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <div class="form-grid-3">
      <div class="field">
        <label>Concepto</label>
        <input class="item-name" type="text" placeholder="Nuevo concepto" value="${escapeHtml(item?.name || "")}" />
      </div>
      <div class="field">
        <label>Cantidad</label>
        <input class="item-qty" type="number" value="${item?.qty || 1}" />
      </div>
      <div class="field">
        <label>Precio unitario</label>
        <input class="item-price" type="number" value="${item?.unitPrice || 0}" />
      </div>
    </div>
    <div class="btn-row mt-4">
      <button class="btn btn-secondary btn-sm remove-item-btn" type="button">Quitar</button>
    </div>
  `;

  itemsContainer.appendChild(row);

  row.querySelector(".remove-item-btn")?.addEventListener("click", () => {
    row.remove();
    updateSummary();
  });

  bindItemInputs();
  updateSummary();
}

function renderQuotePlanAlert() {
  const box = $("#quote-editor-plan-alert");
  if (!box) return;

  const plan = getCurrentBusinessPlan();

  if (plan.code === "pro") {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = `
    <article class="app-panel">
      <div class="card-head">
        <strong>${plan.name}</strong>
        <span>Hasta ${plan.limits.quotes} cotizaciones</span>
      </div>
      <p class="muted">
        Si necesitas crear más cotizaciones, puedes mejorar tu plan y operar sin límites.
      </p>
      <div class="btn-row mt-4">
        <a href="#settings" class="btn btn-secondary btn-sm">Mejorar plan</a>
      </div>
    </article>
  `;
}

async function preloadLinkedEntity(type, id) {
  if (!type || !id) return;

  if (type === "lead") {
    const lead = await getBusinessDocById("leads", id);
    if (!lead) return;
    $("#quote-link-type").value = "lead";
    renderLeadOptions();
    $("#quote-existing-lead").value = id;
    $("#quote-client").value = lead.name || "";
  }

  if (type === "client") {
    const client = await getBusinessDocById("clients", id);
    if (!client) return;
    $("#quote-link-type").value = "client";
    renderClientOptions();
    $("#quote-existing-client").value = id;
    $("#quote-client").value = client.contact || client.name || "";
  }

  updateLinkPanels();
}

async function preloadQuoteForEdit(quoteId) {
  const quote = await getQuoteById(quoteId);
  const items = await getQuoteItems(quoteId);

  if (!quote) return;

  editingQuoteId = quoteId;

  $("#quote-client").value = quote.clientNameSnapshot || "";
  $("#quote-validity").value = quote.validUntil || "";
  $("#quote-currency").value = quote.currency || "MXN";
  $("#quote-tax").value = quote.taxRate || 16;
  $("#quote-notes").value = quote.notes || "";

  $("#quote-link-type").value =
    quote.linkedType === "lead"
      ? "lead"
      : quote.linkedType === "client"
        ? "client"
        : "none";

  renderLeadOptions();
  renderClientOptions();

  if (quote.linkedType === "lead" && quote.linkedId) {
    $("#quote-existing-lead").value = quote.linkedId;
  }

  if (quote.linkedType === "client" && quote.linkedId) {
    $("#quote-existing-client").value = quote.linkedId;
  }

  updateLinkPanels();

  const container = $("#quote-items");
  if (container) container.innerHTML = "";

  if (items.length) {
    items.forEach((item) => addItemRow(item));
  } else {
    addItemRow();
  }

  const title = $("#quote-editor-title");
  if (title) title.textContent = "Editar cotización";

  const submitText = $("#quote-submit-text");
  if (submitText) submitText.textContent = "Actualizar cotización";

  updateSummary();
}

function buildPdfPayload({
  quoteBase = {},
  items = [],
  subtotal = 0,
  taxes = 0,
  total = 0,
  currency = "MXN",
  fallbackFolio = "COT-0001",
}) {
  return {
    ...quoteBase,
    items,
    subtotal,
    taxes,
    total,
    currency,

    businessName: settingsCache?.businessName || "Mi Negocio",
    logoUrl: settingsCache?.logoUrl || "",
    businessPhone: settingsCache?.businessPhone || "",
    businessEmail: settingsCache?.businessEmail || "",

    paymentTermsEnabled: settingsCache?.paymentTermsEnabled || false,
    paymentTermsText: settingsCache?.paymentTermsText || "",

    bankInfoEnabled: settingsCache?.bankInfoEnabled || false,
    bankName: settingsCache?.bankName || "",
    bankAccountHolder: settingsCache?.bankAccountHolder || "",
    bankAccountNumber: settingsCache?.bankAccountNumber || "",
    bankClabe: settingsCache?.bankClabe || "",

    commercialTermsEnabled: settingsCache?.commercialTermsEnabled || false,
    deliveryTime: settingsCache?.deliveryTime || "",
    quoteValidityText: settingsCache?.quoteValidityText || "",
    warrantyText: settingsCache?.warrantyText || "",
    commercialNotes: settingsCache?.commercialNotes || "",

    folio: quoteBase?.folio || fallbackFolio,
  };
}

export function renderQuoteEditor() {
  return `
    <section class="app-view glass">
      <div class="app-view-header">
        <div class="app-view-title">
          <p class="eyebrow-sm">Cotización</p>
          <h2 id="quote-editor-title">Nueva cotización</h2>
          <p class="muted">
            Crea una propuesta profesional, vincúlala a un lead o cliente y genera su PDF.
          </p>
        </div>
      </div>

      <div class="app-view-grid">
        <div id="quote-editor-plan-alert"></div>

        <article class="app-panel">
          <form id="quote-form">
            <div class="card-head">
              <strong>Datos generales</strong>
              <span>Encabezado</span>
            </div>

            <div class="form-grid-2">
              <div class="field">
                <label for="quote-client">Nombre del cliente</label>
                <input id="quote-client" type="text" placeholder="Nombre del cliente o empresa" required />
              </div>

              <div class="field">
                <label for="quote-validity">Vigencia</label>
                <input id="quote-validity" type="date" />
              </div>

              <div class="field">
                <label for="quote-currency">Moneda</label>
                <select id="quote-currency">
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              <div class="field">
                <label for="quote-tax">Impuesto (%)</label>
                <input id="quote-tax" type="number" value="16" />
              </div>
            </div>

            <div class="card-head" style="margin-top:24px;">
              <strong>Vinculación</strong>
              <span>Lead / Cliente</span>
            </div>

            <div class="form-grid-2">
              <div class="field">
                <label for="quote-link-type">¿Cómo quieres vincularla?</label>
                <select id="quote-link-type">
                  <option value="none">Sin vincular</option>
                  <option value="lead">Lead existente</option>
                  <option value="client">Cliente existente</option>
                  <option value="new-lead">Crear nuevo lead</option>
                </select>
              </div>
            </div>

            <div id="quote-link-lead-panel" style="display:none; margin-top:16px;">
              <div class="field">
                <label for="quote-existing-lead">Selecciona un lead</label>
                <select id="quote-existing-lead"></select>
              </div>
            </div>

            <div id="quote-link-client-panel" style="display:none; margin-top:16px;">
              <div class="field">
                <label for="quote-existing-client">Selecciona un cliente</label>
                <select id="quote-existing-client"></select>
              </div>
            </div>

            <div id="quote-new-lead-panel" style="display:none; margin-top:16px;">
              <div class="form-grid-2">
                <div class="field">
                  <label for="new-lead-name">Nombre</label>
                  <input id="new-lead-name" type="text" />
                </div>
                <div class="field">
                  <label for="new-lead-company">Empresa</label>
                  <input id="new-lead-company" type="text" />
                </div>
                <div class="field">
                  <label for="new-lead-email">Email</label>
                  <input id="new-lead-email" type="email" />
                </div>
                <div class="field">
                  <label for="new-lead-phone">Teléfono</label>
                  <input id="new-lead-phone" type="text" />
                </div>
                <div class="field">
                  <label for="new-lead-source">Origen</label>
                  <input id="new-lead-source" type="text" placeholder="Manual" />
                </div>
                <div class="field">
                  <label for="new-lead-status">Estatus</label>
                  <select id="new-lead-status">
                    <option>Nuevo</option>
                    <option>Contactado</option>
                    <option>Cotización enviada</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="card-head" style="margin-top:24px;">
              <strong>Conceptos</strong>
              <span>Items de la cotización</span>
            </div>

            <div class="items-list" id="quote-items"></div>

            <div class="btn-row mt-5">
              <button class="btn btn-secondary" id="add-item-btn" type="button">Agregar concepto</button>
            </div>

            <div class="app-panels-2" style="margin-top:24px;">
              <article class="app-panel">
                <div class="card-head">
                  <strong>Notas</strong>
                  <span>Opcional</span>
                </div>

                <div class="field">
                  <label for="quote-notes">Observaciones</label>
                  <textarea id="quote-notes" rows="6" placeholder="Términos, tiempos de entrega, condiciones comerciales, etc."></textarea>
                </div>
              </article>

              <article class="app-panel">
                <div class="card-head">
                  <strong>Resumen</strong>
                  <span>Vista rápida</span>
                </div>

                <div class="activity-list" id="quote-summary">
                  <div class="activity-item"><span class="activity-dot"></span><p>Subtotal estimado: <strong>$ 0.00</strong></p></div>
                  <div class="activity-item"><span class="activity-dot"></span><p>Impuestos: <strong>$ 0.00</strong></p></div>
                  <div class="activity-item"><span class="activity-dot"></span><p>Total: <strong>$ 0.00</strong></p></div>
                </div>

                <div class="btn-row mt-5">
                  <button class="btn btn-primary" type="submit"><span id="quote-submit-text">Guardar cotización</span></button>
                  <button class="btn btn-secondary" id="preview-pdf-btn" type="button">Exportar PDF</button>
                </div>
              </article>
            </div>
          </form>
        </article>
      </div>
    </section>
  `;
}

export async function initQuoteEditor() {
  const form = $("#quote-form");
  const addItemBtn = $("#add-item-btn");
  const previewPdfBtn = $("#preview-pdf-btn");
  const linkTypeSelect = $("#quote-link-type");

  if (!form) return;

  renderQuotePlanAlert();

  settingsCache = await getBusinessSettings();
  leadsCache = await listBusinessCollection("leads");
  clientsCache = await listBusinessCollection("clients");

  renderLeadOptions();
  renderClientOptions();

  const defaults = await getNextQuoteFolio();
  $("#quote-currency").value = defaults.currency || "MXN";
  $("#quote-tax").value = defaults.taxRate || 16;

  if (!document.querySelector(".item-row")) {
    addItemRow();
  }

  const params = getRouteParams();

  if (params.id && !params.type) {
    await preloadQuoteForEdit(params.id);
  } else if (params.type && params.linkedId) {
    await preloadLinkedEntity(params.type, params.linkedId);
  }

  linkTypeSelect?.addEventListener("change", updateLinkPanels);
  addItemBtn?.addEventListener("click", () => addItemRow());

  previewPdfBtn?.addEventListener("click", async () => {
    const popup = window.open("", "_blank", "width=980,height=760");
    if (!popup) {
      showToast("El navegador bloqueó la ventana del PDF");
      return;
    }

    const currency = $("#quote-currency")?.value || "MXN";
    const taxRate = Number($("#quote-tax")?.value || 0);
    const items = readItems();
    const { subtotal, taxes, total } = calculateTotals(items, taxRate);

    try {
      const currentQuote = editingQuoteId
        ? await getQuoteById(editingQuoteId)
        : null;

      const pdfPayload = buildPdfPayload({
        quoteBase: {
          ...(currentQuote || {}),
          clientName: $("#quote-client")?.value || "Cliente",
          notes: $("#quote-notes")?.value || "",
          currency,
        },
        items,
        subtotal,
        taxes,
        total,
        currency,
        fallbackFolio: currentQuote?.folio || defaults.folio,
      });

      await exportQuoteToPDF(pdfPayload, popup);
    } catch (error) {
      console.error(error);
      popup.close();
      showToast("No se pudo generar el PDF");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const items = readItems();
      if (!items.length) {
        showToast("Agrega al menos un concepto");
        return;
      }

      const currency = $("#quote-currency")?.value || "MXN";
      const taxRate = Number($("#quote-tax")?.value || 16);
      const { subtotal, taxes, total } = calculateTotals(items, taxRate);

      let linkedType = null;
      let linkedId = null;
      let clientNameSnapshot = $("#quote-client")?.value.trim() || "";
      let companySnapshot = "";
      let emailSnapshot = "";
      let phoneSnapshot = "";

      const { linkType, existingLeadId, existingClientId } =
        getSelectedLinkData();

      if (linkType === "lead" && existingLeadId) {
        const lead = await getBusinessDocById("leads", existingLeadId);
        if (lead) {
          linkedType = "lead";
          linkedId = existingLeadId;
          clientNameSnapshot = lead.name || clientNameSnapshot;
          companySnapshot = lead.company || "";
          emailSnapshot = lead.email || "";
          phoneSnapshot = lead.phone || "";
        }
      }

      if (linkType === "client" && existingClientId) {
        const client = await getBusinessDocById("clients", existingClientId);
        if (client) {
          linkedType = "client";
          linkedId = existingClientId;
          clientNameSnapshot = client.contact || clientNameSnapshot;
          companySnapshot = client.name || "";
          emailSnapshot = client.email || "";
          phoneSnapshot = client.phone || "";
        }
      }

      if (linkType === "new-lead") {
        const newLeadPayload = {
          name: $("#new-lead-name")?.value.trim() || clientNameSnapshot,
          company: $("#new-lead-company")?.value.trim() || "",
          email: $("#new-lead-email")?.value.trim() || "",
          phone: $("#new-lead-phone")?.value.trim() || "",
          source: $("#new-lead-source")?.value.trim() || "Manual",
          status: $("#new-lead-status")?.value || "Nuevo",
        };

        const newLeadId = await createLead(newLeadPayload);
        linkedType = "lead";
        linkedId = newLeadId;
        clientNameSnapshot = newLeadPayload.name;
        companySnapshot = newLeadPayload.company;
        emailSnapshot = newLeadPayload.email;
        phoneSnapshot = newLeadPayload.phone;
      }

      if (!editingQuoteId) {
        const permission = await canCreateEntity("quotes");

        if (!permission.allowed) {
          showToast(getPlanLimitMessage("quotes"));
          window.location.hash = "settings";
          return;
        }

        const folioInfo = await getNextQuoteFolio();

        const quotePayload = {
          folio: folioInfo.folio,
          linkedType: linkedType || null,
          linkedId: linkedId || null,
          clientNameSnapshot,
          companySnapshot,
          emailSnapshot,
          phoneSnapshot,
          currency,
          taxRate,
          subtotal,
          taxes,
          total,
          status: "pending",
          notes: $("#quote-notes")?.value.trim() || "",
          validUntil: $("#quote-validity")?.value || "",
        };

        await createQuote({
          quoteData: quotePayload,
          items,
        });

        showToast("Cotización creada correctamente");
      } else {
        const existingQuote = await getQuoteById(editingQuoteId);

        await updateQuote(
          editingQuoteId,
          {
            folio: existingQuote?.folio || "",
            linkedType: linkedType || null,
            linkedId: linkedId || null,
            clientNameSnapshot,
            companySnapshot,
            emailSnapshot,
            phoneSnapshot,
            currency,
            taxRate,
            subtotal,
            taxes,
            total,
            status: existingQuote?.status || "pending",
            notes: $("#quote-notes")?.value.trim() || "",
            validUntil: $("#quote-validity")?.value || "",
          },
          items,
        );

        showToast("Cotización actualizada correctamente");
      }

      window.location.hash = "quotes";
    } catch (error) {
      console.error(error);
      showToast("No se pudo guardar la cotización");
    }
  });

  updateLinkPanels();
  bindItemInputs();
  updateSummary();
}
