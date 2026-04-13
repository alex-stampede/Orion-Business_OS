export function getHashRoute() {
  const raw = window.location.hash.replace("#", "").trim() || "dashboard";
  return raw.split("?")[0] || "dashboard";
}

export function getHashParams() {
  const raw = window.location.hash.replace("#", "").trim();
  const [, queryString = ""] = raw.split("?");
  return new URLSearchParams(queryString);
}

export function $(selector, scope = document) {
  return scope.querySelector(selector);
}

export function $all(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

export function formatCurrency(amount = 0, currency = "MXN") {
  const symbol = currency === "USD" ? "$" : "$";
  const value = Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${symbol} ${value}`;
}

export function formatDate(dateValue) {
  if (!dateValue) return "—";

  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function safeJSONParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function setLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getLocal(key, fallback = null) {
  const raw = localStorage.getItem(key);
  return raw ? safeJSONParse(raw, fallback) : fallback;
}

export function removeLocal(key) {
  localStorage.removeItem(key);
}

export function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("");
}

export function slugify(text = "") {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function generateId(prefix = "id") {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${random}`;
}

export function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}