const DEFAULT_NOTIFICATION_EMAIL = "contacto@marketingorion.com";
const DEFAULT_FROM_EMAIL = "Orion Business OS <notificaciones@marketingorion.com>";

function getNotificationRecipient() {
  return process.env.NOTIFICATION_TO_EMAIL || DEFAULT_NOTIFICATION_EMAIL;
}

function getNotificationSender() {
  return process.env.NOTIFICATION_FROM_EMAIL || DEFAULT_FROM_EMAIL;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatLine(label, value) {
  if (value === undefined || value === null || value === "") return "";

  return `<p style="margin:0 0 8px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

function buildEmailHtml({ title, intro, lines = [] }) {
  const details = lines
    .map(({ label, value }) => formatLine(label, value))
    .filter(Boolean)
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;max-width:640px;">
      <h1 style="font-size:22px;margin:0 0 12px;color:#0f766e;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 16px;">${escapeHtml(intro)}</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        ${details}
      </div>
    </div>
  `;
}

async function sendNotificationEmail({ subject, title, intro, lines }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("RESEND_API_KEY is not configured; notification email skipped.");
    return { skipped: true, reason: "missing_resend_api_key" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: getNotificationSender(),
      to: [getNotificationRecipient()],
      subject,
      html: buildEmailHtml({ title, intro, lines })
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend email failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

async function notifyNewUserRegistration({ fullName, email, businessName, businessId, uid }) {
  return sendNotificationEmail({
    subject: "Nuevo usuario registrado en Orion Business OS",
    title: "Nuevo registro de usuario",
    intro: "Se creó una nueva cuenta en Orion Business OS.",
    lines: [
      { label: "Nombre", value: fullName },
      { label: "Correo", value: email },
      { label: "Negocio", value: businessName },
      { label: "Business ID", value: businessId },
      { label: "UID", value: uid }
    ]
  });
}

async function notifyUserUpgradedToPro({ businessName, businessId, ownerName, ownerEmail, stripeCustomerId, stripeSubscriptionId }) {
  return sendNotificationEmail({
    subject: "Usuario actualizado a Plan Pro en Orion Business OS",
    title: "Usuario pasó a Plan Pro",
    intro: "Una cuenta fue actualizada correctamente al Plan Pro.",
    lines: [
      { label: "Negocio", value: businessName },
      { label: "Business ID", value: businessId },
      { label: "Usuario", value: ownerName },
      { label: "Correo", value: ownerEmail },
      { label: "Stripe Customer", value: stripeCustomerId },
      { label: "Stripe Subscription", value: stripeSubscriptionId }
    ]
  });
}

module.exports = {
  notifyNewUserRegistration,
  notifyUserUpgradedToPro
};
