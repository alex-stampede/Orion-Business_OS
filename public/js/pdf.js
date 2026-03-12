function formatMoney(value = 0, currency = "MXN") {
  const symbol = currency === "USD" ? "$" : "$";
  const amount = Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${symbol} ${amount}`;
}

function getQuoteThemePalette(theme = "green") {
  const palettes = {
    green: {
      primary: "#00382E",
      accent: "#0b8c67",
      soft: "#f3f8f5",
      border: "#d9e9e2",
      text: "#0d211c",
      muted: "#45635b",
      footer: "#6b847c"
    },
    black: {
      primary: "#111111",
      accent: "#2b2b2b",
      soft: "#f5f5f5",
      border: "#dfdfdf",
      text: "#111111",
      muted: "#4b5563",
      footer: "#6b7280"
    },
    blue: {
      primary: "#0A84FF",
      accent: "#3B82F6",
      soft: "#eef6ff",
      border: "#d9e7fb",
      text: "#132033",
      muted: "#4b5f7a",
      footer: "#6a7f99"
    },
    red: {
      primary: "#B42318",
      accent: "#EF4444",
      soft: "#fff1f1",
      border: "#f3d6d6",
      text: "#2b1616",
      muted: "#7a4d4d",
      footer: "#9b6d6d"
    },
    yellow: {
      primary: "#B54708",
      accent: "#F59E0B",
      soft: "#fff8eb",
      border: "#f1e0b8",
      text: "#2f2410",
      muted: "#7f6a3b",
      footer: "#9b875d"
    },
    orange: {
      primary: "#C2410C",
      accent: "#F97316",
      soft: "#fff4ec",
      border: "#f1dccd",
      text: "#2f1d12",
      muted: "#845743",
      footer: "#9a705d"
    },
    purple: {
      primary: "#6D28D9",
      accent: "#8B5CF6",
      soft: "#f5f0ff",
      border: "#e2d8fb",
      text: "#221735",
      muted: "#6d5a8b",
      footer: "#8b79a6"
    },
    pink: {
      primary: "#BE185D",
      accent: "#EC4899",
      soft: "#fff0f7",
      border: "#f3d6e5",
      text: "#321321",
      muted: "#8a5c72",
      footer: "#a8758c"
    }
  };

  return palettes[theme] || palettes.green;
}

function buildQuoteHTML(quote = {}) {
  const {
    folio = "COT-0001",
    clientName = quote.clientNameSnapshot || quote.clientName || "Cliente",
    businessName = "Mi Negocio",
    items = [],
    total = 0,
    subtotal = 0,
    taxes = 0,
    notes = "",
    currency = "MXN",
    logoUrl = "",
    businessPhone = "",
    businessEmail = "",

    paymentTermsEnabled = false,
    paymentTermsText = "",

    bankInfoEnabled = false,
    bankName = "",
    bankAccountHolder = "",
    bankAccountNumber = "",
    bankClabe = "",

    commercialTermsEnabled = false,
    deliveryTime = "",
    quoteValidityText = "",
    warrantyText = "",
    commercialNotes = "",

    quoteTheme = "green"
  } = quote;

  const palette = getQuoteThemePalette(quoteTheme);

  const rows = items
    .map(
      (item) => `
      <tr>
        <td>${item.name || "Servicio"}</td>
        <td>${item.qty || 1}</td>
        <td>${formatMoney(item.unitPrice || 0, currency)}</td>
        <td>${formatMoney(item.subtotal || 0, currency)}</td>
      </tr>
    `
    )
    .join("");

  const companyName = businessName || "Mi Negocio";
  const businessMeta = [businessEmail, businessPhone].filter(Boolean).join(" · ");

  const paymentTermsBlock =
    paymentTermsEnabled && paymentTermsText
      ? `
      <div class="info-block">
        <h3>Forma de pago</h3>
        <p>${paymentTermsText}</p>
      </div>
    `
      : "";

  const bankInfoBlock =
    bankInfoEnabled && (bankName || bankAccountHolder || bankAccountNumber || bankClabe)
      ? `
      <div class="info-block">
        <h3>Datos bancarios</h3>
        ${bankName ? `<p><strong>Banco:</strong> ${bankName}</p>` : ""}
        ${bankAccountHolder ? `<p><strong>Beneficiario:</strong> ${bankAccountHolder}</p>` : ""}
        ${bankAccountNumber ? `<p><strong>Cuenta:</strong> ${bankAccountNumber}</p>` : ""}
        ${bankClabe ? `<p><strong>CLABE:</strong> ${bankClabe}</p>` : ""}
      </div>
    `
      : "";

  const commercialTermsBlock =
    commercialTermsEnabled && (deliveryTime || quoteValidityText || warrantyText || commercialNotes)
      ? `
      <div class="info-block">
        <h3>Condiciones comerciales</h3>
        ${deliveryTime ? `<p><strong>Tiempo de entrega:</strong> ${deliveryTime}</p>` : ""}
        ${quoteValidityText ? `<p><strong>Vigencia de la cotización:</strong> ${quoteValidityText}</p>` : ""}
        ${warrantyText ? `<p><strong>Garantía:</strong> ${warrantyText}</p>` : ""}
        ${commercialNotes ? `<p><strong>Notas comerciales:</strong> ${commercialNotes}</p>` : ""}
      </div>
    `
      : "";

  return `
    <html lang="es">
      <head>
        <title>${folio}</title>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: Inter, Arial, sans-serif;
            padding: 38px 40px 70px;
            color: ${palette.text};
            position: relative;
            background: white;
          }

          h1, h2, h3, p {
            margin: 0 0 12px;
          }

          .head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 24px;
            margin-bottom: 32px;
          }

          .brand-wrap {
            display: flex;
            align-items: flex-start;
            gap: 16px;
          }

          .brand-logo {
            max-width: 120px;
            max-height: 70px;
            object-fit: contain;
          }

          .brand {
            font-size: 24px;
            font-weight: 800;
            color: ${palette.primary};
          }

          .sub {
            font-size: 13px;
            color: ${palette.muted};
          }

          .meta {
            text-align: right;
            font-size: 14px;
            color: ${palette.muted};
          }

          .meta p {
            margin-bottom: 6px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 24px;
          }

          th, td {
            border: 1px solid ${palette.border};
            padding: 12px;
            font-size: 12px;
            text-align: left;
          }

          th {
            background: ${palette.soft};
            color: ${palette.primary};
          }

          .totals {
            margin-top: 24px;
            margin-left: auto;
            width: min(360px, 100%);
          }

          .totals-row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            padding: 10px 0;
            border-bottom: 1px solid ${palette.border};
            font-size: 12px;
          }

          .totals-row.total {
            font-size: 14px;
            font-weight: 800;
            color: ${palette.primary};
          }

          .notes {
            margin-top: 32px;
            font-size: 11px;
            color: ${palette.muted};
            line-height: 1.7;
          }

          .extra-info {
            margin-top: 32px;
            display: grid;
            gap: 18px;
          }

          .info-block {
            border: 1px solid ${palette.border};
            border-radius: 16px;
            padding: 16px 18px;
            background: ${palette.soft};
          }

          .info-block h3 {
            font-size: 12px;
            color: ${palette.primary};
            margin-bottom: 12px;
          }

          .info-block p {
            font-size: 11px;
            color: ${palette.muted};
            line-height: 1.7;
            margin-bottom: 6px;
          }

          .footer {
            position: fixed;
            left: 40px;
            right: 40px;
            bottom: 22px;
            font-size: 11px;
            color: ${palette.footer};
            border-top: 1px solid ${palette.border};
            padding-top: 10px;
            text-align: center;
          }

          .top-actions {
            position: fixed;
            top: 16px;
            right: 16px;
            display: flex;
            gap: 10px;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .top-actions button {
            border: 1px solid ${palette.border};
            background: white;
            color: ${palette.text};
            border-radius: 12px;
            padding: 10px 14px;
            cursor: pointer;
            font-weight: 600;
          }

          @media print {
            .top-actions {
              display: none;
            }
          }
        </style>
      </head>

      <body>
        <div class="top-actions">
          <button onclick="window.print()">Imprimir / Guardar PDF</button>
          <button onclick="window.close()">Cerrar</button>
        </div>

        <div class="head">
          <div class="brand-wrap">
            ${logoUrl ? `<img class="brand-logo" src="${logoUrl}" alt="Logo" />` : ""}
            <div>
              <div class="brand">${companyName}</div>
              <div class="sub">${businessMeta || "Cotización profesional"}</div>
            </div>
          </div>

          <div class="meta">
            <p><strong>Folio:</strong> ${folio}</p>
            <p><strong>Cliente:</strong> ${clientName}</p>
            <p><strong>Moneda:</strong> ${currency}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Cantidad</th>
              <th>Precio unitario</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="4">Sin conceptos</td></tr>`}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span>Subtotal</span>
            <strong>${formatMoney(subtotal || 0, currency)}</strong>
          </div>
          <div class="totals-row">
            <span>Impuestos</span>
            <strong>${formatMoney(taxes || 0, currency)}</strong>
          </div>
          <div class="totals-row total">
            <span>Total</span>
            <strong>${formatMoney(total || 0, currency)}</strong>
          </div>
        </div>

        ${notes ? `<div class="notes"><strong>Notas:</strong><br>${notes}</div>` : ""}

        ${
          paymentTermsBlock || bankInfoBlock || commercialTermsBlock
            ? `
          <div class="extra-info">
            ${paymentTermsBlock}
            ${bankInfoBlock}
            ${commercialTermsBlock}
          </div>
        `
            : ""
        }

        <div class="footer">Cotización generada con Orion Business OS</div>
      </body>
    </html>
  `;
}

export async function exportQuoteToPDF(quote = {}, existingWindow = null) {
  const html = buildQuoteHTML(quote);

  const folio = quote?.folio || "cotizacion";
  const fileName = `${folio}.pdf`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";

  document.body.appendChild(iframe);

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow.print();
    }, 400);
  };

  iframe.src = url;
}
