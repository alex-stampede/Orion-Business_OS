import { db } from "./firebase-config.js";
import { getState, setState } from "./state.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const PLAN_CONFIG = {
  free: {
    code: "free",
    name: "Plan Inicio",
    price: 0,
    limits: {
      leads: 3,
      clients: 3,
      quotes: 3
    },
    canDelete: false
  },
  pro: {
    code: "pro",
    name: "Plan Pro",
    price: 179,
    limits: {
      leads: Infinity,
      clients: Infinity,
      quotes: Infinity
    },
    canDelete: true
  }
};

export const QUOTE_THEME_CONFIG = {
  green: {
    key: "green",
    label: "Verde Orion",
    primary: "#00382E",
    accent: "#0b8c67",
    soft: "#E8F5EF"
  },
  black: {
    key: "black",
    label: "Negro",
    primary: "#111111",
    accent: "#2B2B2B",
    soft: "#F3F4F6"
  },
  blue: {
    key: "blue",
    label: "Azul",
    primary: "#0A84FF",
    accent: "#3B82F6",
    soft: "#EAF3FF"
  },
  red: {
    key: "red",
    label: "Rojo",
    primary: "#B42318",
    accent: "#EF4444",
    soft: "#FEECEC"
  },
  yellow: {
    key: "yellow",
    label: "Amarillo",
    primary: "#B54708",
    accent: "#F59E0B",
    soft: "#FFF7E8"
  },
  orange: {
    key: "orange",
    label: "Naranja",
    primary: "#C2410C",
    accent: "#F97316",
    soft: "#FFF1E8"
  },
  purple: {
    key: "purple",
    label: "Morado",
    primary: "#6D28D9",
    accent: "#8B5CF6",
    soft: "#F3EEFF"
  },
  pink: {
    key: "pink",
    label: "Rosa",
    primary: "#BE185D",
    accent: "#EC4899",
    soft: "#FDECF5"
  }
};

function getBusinessId() {
  const state = getState();
  const businessId = state.user?.businessId;

  if (!businessId) {
    throw new Error("No se encontró businessId en el estado actual.");
  }

  return businessId;
}

export function getBusinessCollection(collectionName) {
  const businessId = getBusinessId();
  return collection(db, "businesses", businessId, collectionName);
}

export function getBusinessDoc(collectionName, docId) {
  const businessId = getBusinessId();
  return doc(db, "businesses", businessId, collectionName, docId);
}

export function getQuoteItemsCollection(quoteId) {
  const businessId = getBusinessId();
  return collection(db, "businesses", businessId, "quotes", quoteId, "items");
}

export function getQuoteThemeConfig(themeKey = "green") {
  return QUOTE_THEME_CONFIG[themeKey] || QUOTE_THEME_CONFIG.green;
}

export async function listBusinessCollection(
  collectionName,
  orderField = "createdAt",
  direction = "desc"
) {
  const ref = getBusinessCollection(collectionName);
  const q = query(ref, orderBy(orderField, direction));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));
}

export async function listRecentActivities(maxItems = 8) {
  const ref = getBusinessCollection("activities");
  const q = query(ref, orderBy("createdAt", "desc"), limit(maxItems));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));
}

export async function createBusinessDoc(collectionName, data) {
  const ref = getBusinessCollection(collectionName);
  const payload = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const result = await addDoc(ref, payload);
  return result.id;
}

export async function updateBusinessDoc(collectionName, docId, data) {
  const ref = getBusinessDoc(collectionName, docId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function removeBusinessDoc(collectionName, docId) {
  const ref = getBusinessDoc(collectionName, docId);
  await deleteDoc(ref);
}

export async function getBusinessDocById(collectionName, docId) {
  const ref = getBusinessDoc(collectionName, docId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

export async function getBusinessSettings() {
  const businessId = getBusinessId();
  const ref = doc(db, "businesses", businessId, "settings", "general");
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

export async function saveBusinessSettings(data) {
  const businessId = getBusinessId();
  const ref = doc(db, "businesses", businessId, "settings", "general");

  await setDoc(
    ref,
    {
      ...data,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function uploadBusinessLogo(file) {
  const businessId = getBusinessId();

  const formData = new FormData();
  formData.append("logo", file);
  formData.append("businessId", businessId);

  const response = await fetch(
    "https://marketingorion.com/orion_flow_database/upload-logo.php",
    {
      method: "POST",
      body: formData
    }
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    throw new Error("La respuesta del servidor no es JSON válido.");
  }

  if (!response.ok || !data.success) {
    throw new Error(data?.message || "No se pudo subir el logo");
  }

  return data.url;
}

export async function addActivity(type, message, meta = {}) {
  const ref = getBusinessCollection("activities");

  await addDoc(ref, {
    type,
    message,
    meta,
    createdAt: serverTimestamp()
  });
}

export async function createLead(data) {
  const id = await createBusinessDoc("leads", data);
  await addActivity(
    "lead_created",
    `Se creó el lead "${data.name || "Sin nombre"}".`,
    {
      leadId: id,
      name: data.name || ""
    }
  );
  return id;
}

export async function updateLead(leadId, data) {
  await updateBusinessDoc("leads", leadId, data);
  await addActivity("lead_updated", "Se actualizó un lead.", { leadId });
}

export async function deleteLead(leadId, leadName = "") {
  await removeBusinessDoc("leads", leadId);
  await addActivity(
    "lead_deleted",
    `Se eliminó el lead "${leadName || "Sin nombre"}".`,
    { leadId }
  );
}

export async function createClient(data) {
  const id = await createBusinessDoc("clients", data);
  await addActivity(
    "client_created",
    `Se creó el cliente "${data.name || "Sin nombre"}".`,
    {
      clientId: id,
      name: data.name || ""
    }
  );
  return id;
}

export async function updateClient(clientId, data) {
  await updateBusinessDoc("clients", clientId, data);
  await addActivity("client_updated", "Se actualizó un cliente.", { clientId });
}

export async function deleteClient(clientId, clientName = "") {
  await removeBusinessDoc("clients", clientId);
  await addActivity(
    "client_deleted",
    `Se eliminó el cliente "${clientName || "Sin nombre"}".`,
    { clientId }
  );
}

export async function getDashboardMetrics() {
  const [quotes, leads, clients, activities] = await Promise.all([
    listBusinessCollection("quotes"),
    listBusinessCollection("leads"),
    listBusinessCollection("clients"),
    listRecentActivities(6)
  ]);

  const totalQuotes = quotes.length;
  const wonQuotes = quotes.filter(q => q.status === "won").length;
  const lostQuotes = quotes.filter(q => q.status === "lost").length;
  const pendingQuotes = quotes.filter(q => !["won", "lost"].includes(q.status)).length;

  const totalQuotedAmount = quotes.reduce(
    (acc, q) => acc + Number(q.total || 0),
    0
  );

  const totalWonAmount = quotes
    .filter(q => q.status === "won")
    .reduce((acc, q) => acc + Number(q.total || 0), 0);

  const closeRate = totalQuotes > 0 ? (wonQuotes / totalQuotes) * 100 : 0;
  const averageQuote = totalQuotes > 0 ? totalQuotedAmount / totalQuotes : 0;

  return {
    quotes,
    leads,
    clients,
    activities,
    metrics: {
      totalQuotes,
      wonQuotes,
      lostQuotes,
      pendingQuotes,
      totalLeads: leads.length,
      totalClients: clients.length,
      totalQuotedAmount,
      totalWonAmount,
      closeRate,
      averageQuote
    }
  };
}

export async function convertLeadToClient(leadId, leadData, quoteId = null) {
  const businessId = getBusinessId();
  const batch = writeBatch(db);

  const leadRef = doc(db, "businesses", businessId, "leads", leadId);
  const newClientRef = doc(collection(db, "businesses", businessId, "clients"));

  batch.set(newClientRef, {
    name: leadData.company || leadData.name || "Cliente sin nombre",
    contact: leadData.name || "",
    email: leadData.email || "",
    phone: leadData.phone || "",
    sourceLeadId: leadId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  batch.delete(leadRef);

  if (quoteId) {
    const quoteRef = doc(db, "businesses", businessId, "quotes", quoteId);
    batch.update(quoteRef, {
      linkedType: "client",
      linkedId: newClientRef.id,
      updatedAt: serverTimestamp()
    });
  }

  await batch.commit();

  await addActivity(
    "lead_converted",
    `El lead "${leadData.name || "Sin nombre"}" se convirtió en cliente.`,
    {
      leadId,
      clientId: newClientRef.id,
      quoteId: quoteId || null
    }
  );

  return newClientRef.id;
}

/* =========================
   QUOTES
========================= */

export async function getNextQuoteFolio() {
  const settings = (await getBusinessSettings()) || {};
  const prefix = settings.quotePrefix || "COT";
  const nextNumber = Number(settings.nextQuoteNumber || 1);
  const padded = String(nextNumber).padStart(4, "0");

  return {
    prefix,
    nextNumber,
    folio: `${prefix}-${padded}`,
    taxRate: Number(settings.taxRate || 16),
    currency: settings.currency || "MXN",
    quoteTheme: settings.quoteTheme || "green",
    settings
  };
}

export async function incrementQuoteSequence() {
  const settings = (await getBusinessSettings()) || {};
  const nextNumber = Number(settings.nextQuoteNumber || 1);

  await saveBusinessSettings({
    ...settings,
    nextQuoteNumber: nextNumber + 1
  });
}

export async function listQuotes() {
  return listBusinessCollection("quotes");
}

export async function getQuoteById(quoteId) {
  return getBusinessDocById("quotes", quoteId);
}

export async function getQuoteItems(quoteId) {
  const ref = getQuoteItemsCollection(quoteId);
  const q = query(ref, orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));
}

export async function createQuote({ quoteData, items }) {
  const quoteId = await createBusinessDoc("quotes", quoteData);

  for (const item of items) {
    await addDoc(getQuoteItemsCollection(quoteId), {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  await incrementQuoteSequence();

  await addActivity(
    "quote_created",
    `Se creó la cotización "${quoteData.folio}".`,
    { quoteId, folio: quoteData.folio }
  );

  return quoteId;
}

export async function updateQuote(quoteId, quoteData, items = null) {
  await updateBusinessDoc("quotes", quoteId, quoteData);

  if (Array.isArray(items)) {
    const businessId = getBusinessId();
    const existingItems = await getQuoteItems(quoteId);
    const batch = writeBatch(db);

    existingItems.forEach(item => {
      const itemRef = doc(
        db,
        "businesses",
        businessId,
        "quotes",
        quoteId,
        "items",
        item.id
      );
      batch.delete(itemRef);
    });

    items.forEach(item => {
      const itemRef = doc(
        collection(db, "businesses", businessId, "quotes", quoteId, "items")
      );

      batch.set(itemRef, {
        ...item,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
  }

  await addActivity("quote_updated", "Se actualizó una cotización.", { quoteId });
}

export async function deleteQuote(quoteId, folio = "") {
  const businessId = getBusinessId();
  const existingItems = await getQuoteItems(quoteId);
  const batch = writeBatch(db);

  existingItems.forEach(item => {
    const itemRef = doc(
      db,
      "businesses",
      businessId,
      "quotes",
      quoteId,
      "items",
      item.id
    );
    batch.delete(itemRef);
  });

  const quoteRef = doc(db, "businesses", businessId, "quotes", quoteId);
  batch.delete(quoteRef);

  await batch.commit();

  await addActivity(
    "quote_deleted",
    `Se eliminó la cotización "${folio || quoteId}".`,
    { quoteId, folio }
  );
}

export async function updateQuoteStatus(quoteId, status) {
  await updateBusinessDoc("quotes", quoteId, { status });

  await addActivity(
    "quote_status_updated",
    `Se actualizó el estatus de una cotización a "${status}".`,
    { quoteId, status }
  );

  const quote = await getQuoteById(quoteId);

  if (quote && status === "won" && quote.linkedType === "lead" && quote.linkedId) {
    const lead = await getBusinessDocById("leads", quote.linkedId);
    if (lead) {
      await convertLeadToClient(quote.linkedId, lead, quoteId);
    }
  }
}

/* =========================
   PIPELINE
========================= */

const PIPELINE_STATUS_MAP = [
  { key: "draft", stage: "lead", label: "Lead" },
  { key: "sent", stage: "contacted", label: "Contactado" },
  { key: "pending", stage: "quoted", label: "Cotización" },
  { key: "negotiating", stage: "negotiation", label: "Negociación" },
  { key: "won", stage: "won", label: "Ganado" },
  { key: "lost", stage: "lost", label: "Perdido" }
];

export function getPipelineColumns() {
  return [
    { id: "lead", title: "Lead" },
    { id: "contacted", title: "Contactado" },
    { id: "quoted", title: "Cotización" },
    { id: "negotiation", title: "Negociación" },
    { id: "won", title: "Ganado" },
    { id: "lost", title: "Perdido" }
  ];
}

export async function getPipelineData() {
  const quotes = await listQuotes();

  return getPipelineColumns().map(column => {
    const items = quotes.filter(quote => {
      const found = PIPELINE_STATUS_MAP.find(x => x.key === (quote.status || "pending"));
      return found?.stage === column.id;
    });

    return {
      ...column,
      items
    };
  });
}

/* =========================
   FREEMIUM
========================= */

export function getCurrentBusinessPlan() {
  const state = getState();
  const planCode = state.business?.plan || "free";
  return PLAN_CONFIG[planCode] || PLAN_CONFIG.free;
}

export function isProPlan() {
  return getCurrentBusinessPlan().code === "pro";
}

export function canDeleteInCurrentPlan() {
  return getCurrentBusinessPlan().canDelete;
}

export async function getUsageCounts() {
  const [leads, clients, quotes] = await Promise.all([
    listBusinessCollection("leads"),
    listBusinessCollection("clients"),
    listBusinessCollection("quotes")
  ]);

  return {
    leads: leads.length,
    clients: clients.length,
    quotes: quotes.length
  };
}

export async function canCreateEntity(entityType) {
  const plan = getCurrentBusinessPlan();
  const counts = await getUsageCounts();
  const currentCount = counts[entityType] || 0;
  const entityLimit = plan.limits[entityType];

  if (entityLimit === Infinity) {
    return {
      allowed: true,
      currentCount,
      limit: entityLimit
    };
  }

  return {
    allowed: currentCount < entityLimit,
    currentCount,
    limit: entityLimit
  };
}

export function getPlanLimitMessage(entityType) {
  const messages = {
    leads: "¿Necesitas agregar más leads? Mejora tu plan para seguir captando oportunidades.",
    clients: "¿Necesitas agregar más clientes? Mejora tu plan para administrar más relaciones comerciales.",
    quotes: "¿Necesitas crear más cotizaciones? Mejora tu plan y opera sin límites."
  };

  return messages[entityType] || "Mejora tu plan para desbloquear más funciones.";
}

export async function updateBusinessPlan(planCode) {
  const state = getState();
  const businessId = state.user?.businessId;

  if (!businessId) {
    throw new Error("No se encontró businessId");
  }

  const selectedPlan = PLAN_CONFIG[planCode] || PLAN_CONFIG.free;
  const ref = doc(db, "businesses", businessId);

  await updateDoc(ref, {
    plan: selectedPlan.code,
    planName: selectedPlan.name,
    planPrice: selectedPlan.price,
    billingCycle: "monthly",
    updatedAt: serverTimestamp()
  });

  setState({
    business: {
      ...state.business,
      plan: selectedPlan.code,
      planName: selectedPlan.name,
      planPrice: selectedPlan.price,
      billingCycle: "monthly"
    }
  });

  await addActivity(
    "plan_updated",
    selectedPlan.code === "pro"
      ? "La cuenta cambió a Plan Pro."
      : "La cuenta volvió a Plan Inicio.",
    { plan: selectedPlan.code }
  );

  return selectedPlan;
}

/* =========================
   ORION ADMIN / GLOBAL METRICS
========================= */

async function listAllUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));
}

async function listAllBusinesses() {
  const snapshot = await getDocs(collection(db, "businesses"));
  return snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));
}

async function listAllSubcollectionDocs(subcollectionName, orderField = "createdAt") {
  const businesses = await listAllBusinesses();

  const results = await Promise.all(
    businesses.map(async business => {
      const ref = collection(db, "businesses", business.id, subcollectionName);

      try {
        const q = query(ref, orderBy(orderField, "desc"));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(item => ({
          id: item.id,
          businessId: business.id,
          ...item.data()
        }));
      } catch {
        const snapshot = await getDocs(ref);
        return snapshot.docs.map(item => ({
          id: item.id,
          businessId: business.id,
          ...item.data()
        }));
      }
    })
  );

  return results.flat();
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export async function getGlobalAdminMetrics() {
  const [users, businesses, allQuotes, allLeads, allClients] = await Promise.all([
    listAllUsers(),
    listAllBusinesses(),
    listAllSubcollectionDocs("quotes"),
    listAllSubcollectionDocs("leads"),
    listAllSubcollectionDocs("clients")
  ]);

  const totalUsers = users.length;
  const totalBusinesses = businesses.length;

  const totalProBusinesses = businesses.filter(
    business => (business.plan || "free") === "pro"
  ).length;

  const totalFreeBusinesses = businesses.filter(
    business => (business.plan || "free") !== "pro"
  ).length;

  const totalQuotes = allQuotes.length;
  const totalLeads = allLeads.length;
  const totalClients = allClients.length;

  const wonQuotes = allQuotes.filter(quote => quote.status === "won");
  const totalWonQuotes = wonQuotes.length;

  const totalQuotedAmount = round2(
    allQuotes.reduce((acc, quote) => acc + Number(quote.total || 0), 0)
  );

  const totalWonAmount = round2(
    wonQuotes.reduce((acc, quote) => acc + Number(quote.total || 0), 0)
  );

  const estimatedMRR = round2(totalProBusinesses * PLAN_CONFIG.pro.price);

  const freeToProRate =
    totalBusinesses > 0
      ? round2((totalProBusinesses / totalBusinesses) * 100)
      : 0;

  const averageQuotedTicket =
    totalQuotes > 0
      ? round2(totalQuotedAmount / totalQuotes)
      : 0;

  const averageWonTicket =
    totalWonQuotes > 0
      ? round2(totalWonAmount / totalWonQuotes)
      : 0;

  return {
    totalUsers,
    totalBusinesses,
    totalProBusinesses,
    totalFreeBusinesses,
    totalQuotes,
    totalLeads,
    totalClients,
    totalWonQuotes,
    totalQuotedAmount,
    totalWonAmount,
    estimatedMRR,
    freeToProRate,
    averageQuotedTicket,
    averageWonTicket
  };
}
