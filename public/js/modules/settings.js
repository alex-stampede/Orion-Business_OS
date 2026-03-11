import { $, escapeHtml } from "../helpers.js";
import { showToast } from "../ui.js";
import {
  getBusinessSettings,
  saveBusinessSettings,
  addActivity,
  uploadBusinessLogo,
  getCurrentBusinessPlan,
  updateBusinessPlan
} from "../firestore-service.js";
import { getState, setState } from "../state.js";
import { syncUpgradeButton } from "../ui.js";

let settingsCache = {
  businessEmail: "",
  businessPhone: "",
  currency: "MXN",
  quotePrefix: "COT",
  nextQuoteNumber: 1,
  taxRate: 16,
  logoUrl: "",

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

export function renderSettings(state = {}) {
  const business = state.business || {};
  const currentPlan = business.plan === "pro" ? "pro" : "free";
  const currentPlanName = currentPlan === "pro" ? "Plan Pro" : "Plan Inicio";

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
            <span>${currentPlanName}</span>
          </div>
          <p class="muted">
            ${
              currentPlan === "pro"
                ? "Tu cuenta opera sin límites y tienes acceso completo a leads, clientes y cotizaciones ilimitadas."
                : "Tu cuenta incluye hasta 3 leads, 3 clientes y 3 cotizaciones."
            }
          </p>
          <div class="btn-row mt-4">
            ${
              currentPlan === "pro"
                ? `<button class="btn btn-secondary" type="button" id="cancel-pro-btn">Cancelar Plan Pro</button>`
                : `<button class="btn btn-primary" type="button" id="upgrade-pro-btn">Mejorar a Plan Pro · $149 MXN/mes</button>`
            }
          </div>
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
                  value="${escapeHtml(business.name || "")}"
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

async function loadSettingsIntoForm() {
  const settings = await getBusinessSettings();
  settingsCache = { ...settingsCache, ...(settings || {}) };

  $("#business-email").value = settingsCache.businessEmail || "";
  $("#business-phone").value = settingsCache.businessPhone || "";
  $("#business-currency").value = settingsCache.currency || "MXN";
  $("#quote-prefix").value = settingsCache.quotePrefix || "COT";
  $("#quote-next-number").value = settingsCache.nextQuoteNumber || 1;
  $("#tax-rate").value = settingsCache.taxRate || 16;

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
}

export function initSettings() {
  const form = $("#settings-form");
  if (!form) return;

  loadSettingsIntoForm();

  document.getElementById("upgrade-pro-btn")?.addEventListener("click", async () => {
    try {
      await updateBusinessPlan("pro");

      const state = getState();
      setState({
        business: {
          ...state.business,
          plan: "pro",
          planName: "Plan Pro",
          planPrice: 149
        }
      });

      syncUpgradeButton();
      showToast("Tu cuenta ahora es Plan Pro");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch (error) {
      console.error(error);
      showToast("No se pudo actualizar el plan");
    }
  });

  document.getElementById("cancel-pro-btn")?.addEventListener("click", async () => {
    const ok = window.confirm("¿Seguro que quieres volver al Plan Inicio?");
    if (!ok) return;

    try {
      await updateBusinessPlan("free");

      const state = getState();
      setState({
        business: {
          ...state.business,
          plan: "free",
          planName: "Plan Inicio",
          planPrice: 0
        }
      });

      syncUpgradeButton();
      showToast("Tu cuenta volvió al Plan Inicio");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch (error) {
      console.error(error);
      showToast("No se pudo cancelar el plan");
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    try {
      let logoUrl = settingsCache.logoUrl || "";
      const logoFile = $("#logo-file")?.files?.[0] || null;

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
        taxRate: Number($("#tax-rate")?.value || 16),
        logoUrl,

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
      await addActivity("settings_updated", "Se actualizó la configuración del negocio.");
      renderLogoPreview();
      showToast("Configuración guardada correctamente");
    } catch (error) {
      console.error(error);
      showToast("No se pudo guardar la configuración");
    }
  });
}