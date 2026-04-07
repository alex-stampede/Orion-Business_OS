import { $, escapeHtml } from "../helpers.js";
import { showToast, syncUpgradeButton } from "../ui.js";
import {
  getBusinessSettings,
  saveBusinessSettings,
  addActivity,
  uploadBusinessLogo
} from "../firestore-service.js";
import { getState, setState } from "../state.js";
import { startProCheckout, openCustomerPortal } from "../stripe-billing.js";

let settingsCache = {
  businessEmail: "",
  businessPhone: "",
  currency: "MXN",
  quotePrefix: "COT",
  nextQuoteNumber: 1,
  taxEnabled: false,
  taxRate: 16,
  logoUrl: "",
  quoteTheme: "green",

  paymentTermsEnabled: false,
  paymentTermsText: "",

  bankInfoEnabled: false,
  bankName: "",
  bankAccountHolder: "",
  bankAccountNumber: "",
  bankClabe: "",

  commercialTermsEnabled: false,
  deliveryTime: "",
  quoteValidityText: "",
  warrantyText: "",
  commercialNotes: ""
};

const QUOTE_THEME_OPTIONS = [
  { value: "green", label: "Verde Orion" },
  { value: "black", label: "Negro" },
  { value: "blue", label: "Azul" },
  { value: "red", label: "Rojo" },
  { value: "yellow", label: "Amarillo" },
  { value: "orange", label: "Naranja" },
  { value: "purple", label: "Morado" },
  { value: "pink", label: "Rosa" }
];

function formatUnixDate(unixSeconds) {
  if (!unixSeconds) return "";
  return new Date(unixSeconds * 1000).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function getPlanUI(state = {}) {
  const business = state.business || {};
  const isPro = business.plan === "pro";
  const subscriptionStatus = business.subscriptionStatus || "inactive";
  const cancelAtPeriodEnd = Boolean(business.cancelAtPeriodEnd);
  const currentPeriodEnd = business.currentPeriodEnd || business.subscriptionEndsAt || null;
  const paymentIssue = Boolean(business.paymentIssue);

  return {
    isPro,
    planName: isPro ? "Plan Pro" : "Plan Inicio",
    subscriptionStatus,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    paymentIssue,
    priceText: isPro ? "$179 MXN / mes" : "Gratis"
  };
}

function renderSubscriptionBadge(subscriptionStatus = "inactive") {
  const labelMap = {
    active: "Activa",
    trialing: "Prueba",
    past_due: "Pago pendiente",
    unpaid: "Impaga",
    canceled: "Cancelada",
    inactive: "Inactiva"
  };

  return `
    <span class="chip" style="margin-top:8px;">
      ${labelMap[subscriptionStatus] || subscriptionStatus}
    </span>
  `;
}

function renderPlanStatusPanels(plan = {}) {
  const blocks = [];

  if (plan.paymentIssue) {
    blocks.push(`
      <div class="app-panel" style="margin-top:16px; padding:16px 18px;">
        <strong style="display:block; margin-bottom:6px;">Tuvimos un problema con tu pago</strong>
        <p class="muted" style="margin-bottom:10px;">
          No pudimos procesar el cobro de tu suscripción. Revisa tu método de pago para evitar interrupciones en tu cuenta.
        </p>
        <div class="btn-row mt-4">
          <button class="btn btn-primary" type="button" id="manage-subscription-btn">
            Actualizar método de pago
          </button>
        </div>
      </div>
    `);
  }

  if (plan.cancelAtPeriodEnd) {
    blocks.push(`
      <div class="app-panel" style="margin-top:16px; padding:16px 18px;">
        <strong style="display:block; margin-bottom:6px;">Tu plan terminará pronto</strong>
        <p class="muted" style="margin-bottom:10px;">
          Tu Plan Pro sigue activo por ahora, pero está programado para cancelarse el
          <strong>${formatUnixDate(plan.currentPeriodEnd) || "final del periodo actual"}</strong>.
        </p>
        <p class="muted">
          Reactiva tu suscripción antes de esa fecha para no perder acceso a leads, clientes y cotizaciones ilimitadas.
        </p>
        <div class="btn-row mt-4">
          <button class="btn btn-primary" type="button" id="manage-subscription-btn">
            Reactivar / administrar suscripción
          </button>
        </div>
      </div>
    `);
  }

  return blocks.join("");
}

function renderQuoteThemeOptions() {
  return QUOTE_THEME_OPTIONS.map(
    (item) => `<option value="${item.value}">${item.label}</option>`
  ).join("");
}

function renderQuoteThemePreview(theme = "green") {
  const palette = {
    green: { primary: "#00382E", accent: "#0b8c67", label: "Verde Orion" },
    black: { primary: "#111111", accent: "#2b2b2b", label: "Negro" },
    blue: { primary: "#0A84FF", accent: "#3B82F6", label: "Azul" },
    red: { primary: "#B42318", accent: "#EF4444", label: "Rojo" },
    yellow: { primary: "#B54708", accent: "#F59E0B", label: "Amarillo" },
    orange: { primary: "#C2410C", accent: "#F97316", label: "Naranja" },
    purple: { primary: "#6D28D9", accent: "#8B5CF6", label: "Morado" },
    pink: { primary: "#BE185D", accent: "#EC4899", label: "Rosa" }
  };

  const current = palette[theme] || palette.green;

  return `
    <div style="display:grid; gap:10px; margin-top:14px;">
      <div style="font-size:13px; color:rgba(255,255,255,.68);">
        Vista previa: ${current.label}
      </div>

      <div style="
        border-radius:18px;
        overflow:hidden;
        border:1px solid rgba(255,255,255,.08);
        background:rgba(255,255,255,.03);
        max-width:360px;
      ">
        <div style="
          background:${current.primary};
          color:#fff;
          padding:16px 18px;
          font-weight:700;
          font-size:14px;
        ">
          Cotización
        </div>

        <div style="padding:16px 18px; display:grid; gap:10px;">
          <div style="height:10px; width:70%; background:rgba(255,255,255,.08); border-radius:999px;"></div>
          <div style="height:10px; width:48%; background:rgba(255,255,255,.08); border-radius:999px;"></div>

          <div style="
            margin-top:6px;
            display:inline-flex;
            width:max-content;
            padding:8px 12px;
            border-radius:12px;
            background:${current.accent};
            color:#fff;
            font-size:12px;
            font-weight:700;
          ">
            Total / Resumen
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderSettings(state = {}) {
  const business = state.business || {};
  const plan = getPlanUI(state);

  return `
    <section class="app-view glass">
      <div class="app-view-header">
        <div class="app-view-title">
          <p class="eyebrow-sm">Configuración</p>
          <h2>Personaliza tu sistema</h2>
          <p class="muted">
            Ajusta la identidad del negocio, numeración de cotizaciones y branding del PDF.
          </p>
        </div>
      </div>

      <div class="app-view-grid">
        <article class="app-panel">
          <div class="card-head">
            <strong>Tu plan actual</strong>
            <span>${plan.priceText}</span>
          </div>

          <h3 style="margin-bottom:10px;">${plan.planName}</h3>
          ${renderSubscriptionBadge(plan.subscriptionStatus)}

          <p class="muted" style="margin-top:14px;">
            ${
              plan.isPro
                ? "Tu cuenta opera sin límites y tiene acceso completo a leads, clientes y cotizaciones ilimitadas."
                : "Tu cuenta incluye hasta 3 leads, 3 clientes y 3 cotizaciones."
            }
          </p>

          ${
            !plan.cancelAtPeriodEnd && !plan.paymentIssue
              ? `
                <div class="btn-row mt-4">
                  ${
                    plan.isPro
                      ? `
                        <button class="btn btn-secondary" type="button" id="manage-subscription-btn">
                          Administrar suscripción
                        </button>
                      `
                      : `
                        <button class="btn btn-primary" type="button" id="upgrade-pro-btn">
                          Mejorar a Plan Pro · $179 MXN/mes
                        </button>
                      `
                  }
                </div>
              `
              : ""
          }

          ${renderPlanStatusPanels(plan)}
        </article>

        <article class="app-panel">
          <div class="card-head">
            <strong>Datos del negocio</strong>
            <span>Branding</span>
          </div>

          <form id="settings-form">
            <div class="form-grid-2">
              <div class="field">
                <label for="business-name-input">Nombre comercial</label>
                <input
                  id="business-name-input"
                  type="text"
                  value="${escapeHtml(business.name || business.businessName || "")}"
                  placeholder="Nombre del negocio"
                />
              </div>

              <div class="field">
                <label for="business-email">Correo comercial</label>
                <input id="business-email" type="email" placeholder="contacto@negocio.com" />
              </div>

              <div class="field">
                <label for="business-phone">Teléfono</label>
                <input id="business-phone" type="text" placeholder="33 0000 0000" />
              </div>

              <div class="field">
                <label for="business-currency">Moneda</label>
                <select id="business-currency">
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              <div class="field">
                <label for="quote-prefix">Prefijo</label>
                <input id="quote-prefix" type="text" placeholder="COT" />
              </div>

              <div class="field">
                <label for="quote-next-number">Siguiente número</label>
                <input id="quote-next-number" type="number" placeholder="1" />
              </div>

              <div class="field">
                <label>
                  <input id="tax-enabled" type="checkbox" />
                  Activar impuestos automáticos
                </label>
                 <p class="muted" style="margin-top:8px;">
                  Al activar esta casilla podrás definir el porcentaje de impuestos que se agregará automáticamente a los productos en cada cotización.
                </p>
              </div>

              <div class="field">
                <label for="tax-rate">Impuesto (%)</label>
                <input id="tax-rate" type="number" placeholder="16" />
              </div>

              <div class="field">
                <label for="logo-file">Logo del negocio</label>
                <input id="logo-file" type="file" accept="image/*" />
              </div>
            </div>

            <div id="logo-preview-box" class="mt-5"></div>

            <article class="app-panel" style="margin-top:24px;">
              <div class="card-head">
                <strong>Color de cotización</strong>
                <span>${plan.isPro ? "Branding Pro" : "Disponible en Plan Pro"}</span>
              </div>

              <div class="field">
                <label for="quote-theme">
                  Color principal del PDF
                  ${
                    plan.isPro
                      ? ""
                      : `<span class="badge-pro" style="margin-left:8px;">PRO</span>`
                  }
                </label>

                <select id="quote-theme" ${plan.isPro ? "" : "disabled"}>
                  ${renderQuoteThemeOptions()}
                </select>
              </div>

              <p class="muted" style="margin-top:10px;">
                ${
                  plan.isPro
                    ? "Personaliza el color principal de tus cotizaciones para que se adapten mejor al estilo de tu marca."
                    : "Desbloquea colores personalizados para tus cotizaciones con Plan Pro."
                }
              </p>

              <div id="quote-theme-preview">
                ${renderQuoteThemePreview(settingsCache.quoteTheme || "green")}
              </div>
            </article>

            <article class="app-panel" style="margin-top:24px;">
              <div class="card-head">
                <strong>Formas de pago</strong>
                <span>PDF comercial</span>
              </div>

              <div class="field">
                <label>
                  <input id="payment-terms-enabled" type="checkbox" />
                  Activar formas de pago en el PDF
                </label>
              </div>

              <div class="field mt-4">
                <label for="payment-terms-text">Forma de pago</label>
                <textarea
                  id="payment-terms-text"
                  rows="3"
                  placeholder="Ej. 60% de anticipo y 40% contra entrega."
                ></textarea>
              </div>
            </article>

            <article class="app-panel" style="margin-top:24px;">
              <div class="card-head">
                <strong>Datos bancarios</strong>
                <span>Transferencias</span>
              </div>

              <div class="field">
                <label>
                  <input id="bank-info-enabled" type="checkbox" />
                  Activar datos bancarios en el PDF
                </label>
              </div>

              <div class="form-grid-2 mt-4">
                <div class="field">
                  <label for="bank-name">Banco</label>
                  <input id="bank-name" type="text" placeholder="Ej. BBVA" />
                </div>

                <div class="field">
                  <label for="bank-account-holder">Titular / Beneficiario</label>
                  <input id="bank-account-holder" type="text" placeholder="Nombre del titular" />
                </div>

                <div class="field">
                  <label for="bank-account-number">Número de cuenta</label>
                  <input id="bank-account-number" type="text" placeholder="1234567890" />
                </div>

                <div class="field">
                  <label for="bank-clabe">CLABE</label>
                  <input id="bank-clabe" type="text" placeholder="012345678901234567" />
                </div>
              </div>
            </article>

            <article class="app-panel" style="margin-top:24px;">
              <div class="card-head">
                <strong>Condiciones comerciales</strong>
                <span>PDF profesional</span>
              </div>

              <div class="field">
                <label>
                  <input id="commercial-terms-enabled" type="checkbox" />
                  Activar condiciones comerciales en el PDF
                </label>
              </div>

              <div class="form-grid-2 mt-4">
                <div class="field">
                  <label for="delivery-time">Tiempo de entrega</label>
                  <input id="delivery-time" type="text" placeholder="Ej. 15 días hábiles" />
                </div>

                <div class="field">
                  <label for="quote-validity-text">Vigencia de la cotización</label>
                  <input id="quote-validity-text" type="text" placeholder="Ej. 15 días naturales" />
                </div>

                <div class="field">
                  <label for="warranty-text">Garantía</label>
                  <input id="warranty-text" type="text" placeholder="Ej. 12 meses contra defectos de fabricación" />
                </div>

                <div class="field">
                  <label for="commercial-notes">Notas comerciales</label>
                  <textarea
                    id="commercial-notes"
                    rows="3"
                    placeholder="Ej. Precios sujetos a cambio sin previo aviso."
                  ></textarea>
                </div>
              </div>
            </article>

            <div class="btn-row mt-5">
              <button class="btn btn-primary" type="submit">Guardar cambios</button>
            </div>
          </form>
        </article>
      </div>
    </section>
  `;
}

function renderLogoPreview() {
  const box = $("#logo-preview-box");
  if (!box) return;

  if (!settingsCache.logoUrl) {
    box.innerHTML = `<p class="muted">Aún no has subido un logo.</p>`;
    return;
  }

  box.innerHTML = `
    <div class="preview-card" style="max-width:320px;">
      <div class="card-head">
        <strong>Logo actual</strong>
      </div>
      <img
        src="${settingsCache.logoUrl}"
        alt="Logo del negocio"
        style="max-width:220px; max-height:100px; object-fit:contain;"
      />
    </div>
  `;
}

function bindQuoteThemePreview() {
  const themeSelect = $("#quote-theme");
  const preview = $("#quote-theme-preview");
  if (!themeSelect || !preview) return;

  themeSelect.addEventListener("change", () => {
    preview.innerHTML = renderQuoteThemePreview(themeSelect.value || "green");
  });
}

function toggleTaxRateInput() {
  const taxEnabled = $("#tax-enabled")?.checked || false;
  const taxRateInput = $("#tax-rate");
  if (!taxRateInput) return;

  taxRateInput.disabled = !taxEnabled;
}

async function loadSettingsIntoForm() {
  const settings = await getBusinessSettings();
  settingsCache = { ...settingsCache, ...(settings || {}) };

  $("#business-email").value = settingsCache.businessEmail || "";
  $("#business-phone").value = settingsCache.businessPhone || "";
  $("#business-currency").value = settingsCache.currency || "MXN";
  $("#quote-prefix").value = settingsCache.quotePrefix || "COT";
  $("#quote-next-number").value = settingsCache.nextQuoteNumber || 1;
  $("#tax-enabled").checked = Boolean(settingsCache.taxEnabled);
  $("#tax-rate").value = settingsCache.taxRate ?? 16;
  toggleTaxRateInput();
  if ($("#quote-theme")) $("#quote-theme").value = settingsCache.quoteTheme || "green";

  $("#payment-terms-enabled").checked = Boolean(settingsCache.paymentTermsEnabled);
  $("#payment-terms-text").value = settingsCache.paymentTermsText || "";

  $("#bank-info-enabled").checked = Boolean(settingsCache.bankInfoEnabled);
  $("#bank-name").value = settingsCache.bankName || "";
  $("#bank-account-holder").value = settingsCache.bankAccountHolder || "";
  $("#bank-account-number").value = settingsCache.bankAccountNumber || "";
  $("#bank-clabe").value = settingsCache.bankClabe || "";

  $("#commercial-terms-enabled").checked = Boolean(settingsCache.commercialTermsEnabled);
  $("#delivery-time").value = settingsCache.deliveryTime || "";
  $("#quote-validity-text").value = settingsCache.quoteValidityText || "";
  $("#warranty-text").value = settingsCache.warrantyText || "";
  $("#commercial-notes").value = settingsCache.commercialNotes || "";

  renderLogoPreview();
  if ($("#quote-theme-preview")) {
    $("#quote-theme-preview").innerHTML = renderQuoteThemePreview(settingsCache.quoteTheme || "green");
  }
}

function bindBillingButtons() {
  $("#upgrade-pro-btn")?.addEventListener("click", async () => {
    try {
      showToast("Redirigiendo a Stripe...");
      await startProCheckout();
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo iniciar Stripe Checkout");
    }
  });

  $("#manage-subscription-btn")?.addEventListener("click", async () => {
    try {
      showToast("Abriendo portal de suscripción...");
      await openCustomerPortal();
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo abrir el portal de Stripe");
    }
  });
}

export function initSettings() {
  const form = $("#settings-form");
  if (!form) return;

  loadSettingsIntoForm().then(() => {
    bindQuoteThemePreview();
  });

  bindBillingButtons();
  $("#tax-enabled")?.addEventListener("change", toggleTaxRateInput);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    try {
      let logoUrl = settingsCache.logoUrl || "";
      const logoFile = $("#logo-file")?.files?.[0] || null;
      const state = getState();
      const isPro = (state.business?.plan || "free") === "pro";

      if (logoFile) {
        logoUrl = await uploadBusinessLogo(logoFile);
      }

      const payload = {
        businessName: $("#business-name-input")?.value.trim() || "",
        businessEmail: $("#business-email")?.value.trim() || "",
        businessPhone: $("#business-phone")?.value.trim() || "",
        currency: $("#business-currency")?.value || "MXN",
        quotePrefix: $("#quote-prefix")?.value.trim() || "COT",
        nextQuoteNumber: Number($("#quote-next-number")?.value || 1),
        taxEnabled: $("#tax-enabled")?.checked || false,
        taxRate: Number($("#tax-rate")?.value ?? 16),
        logoUrl,
        quoteTheme: isPro ? ($("#quote-theme")?.value || "green") : "green",

        paymentTermsEnabled: $("#payment-terms-enabled")?.checked || false,
        paymentTermsText: $("#payment-terms-text")?.value.trim() || "",

        bankInfoEnabled: $("#bank-info-enabled")?.checked || false,
        bankName: $("#bank-name")?.value.trim() || "",
        bankAccountHolder: $("#bank-account-holder")?.value.trim() || "",
        bankAccountNumber: $("#bank-account-number")?.value.trim() || "",
        bankClabe: $("#bank-clabe")?.value.trim() || "",

        commercialTermsEnabled: $("#commercial-terms-enabled")?.checked || false,
        deliveryTime: $("#delivery-time")?.value.trim() || "",
        quoteValidityText: $("#quote-validity-text")?.value.trim() || "",
        warrantyText: $("#warranty-text")?.value.trim() || "",
        commercialNotes: $("#commercial-notes")?.value.trim() || ""
      };

      await saveBusinessSettings(payload);
      settingsCache = { ...settingsCache, ...payload };

      const business = state.business || {};

      setState({
        business: {
          ...business,
          name: payload.businessName || business.name || "Mi negocio",
          businessName: payload.businessName || business.businessName || "Mi negocio"
        }
      });

      await addActivity("settings_updated", "Se actualizó la configuración del negocio.");
      renderLogoPreview();
      syncUpgradeButton();
      showToast("Configuración guardada correctamente");
    } catch (error) {
      console.error(error);
      showToast("No se pudo guardar la configuración");
    }
  });
}
