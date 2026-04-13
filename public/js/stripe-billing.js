import { auth } from "./firebase-config.js";
import { getState } from "./state.js";

async function getIdTokenOrThrow() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("No hay usuario autenticado");
  }

  return user.getIdToken();
}

async function postToFunction(functionName, payload = {}) {
  const token = await getIdTokenOrThrow();

  const response = await fetch(`/.netlify/functions/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || `No se pudo ejecutar ${functionName}`);
  }

  return data;
}

export async function startProCheckout() {
  const state = getState();
  const businessId = state.user?.businessId;

  if (!businessId) {
    throw new Error("No se encontró businessId");
  }

  const data = await postToFunction("create-checkout-session", { businessId });

  if (!data?.url) {
    throw new Error("Stripe no devolvió URL de checkout");
  }

  window.location.href = data.url;
}

export async function openCustomerPortal() {
  const state = getState();
  const businessId = state.user?.businessId;

  if (!businessId) {
    throw new Error("No se encontró businessId");
  }

  const data = await postToFunction("create-portal-session", { businessId });

  if (!data?.url) {
    throw new Error("Stripe no devolvió URL del portal");
  }

  window.location.href = data.url;
}
