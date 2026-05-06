const businessNames = [
  "Papelería Luna",
  "Café Monteverde",
  "Taller Rápido Norte",
  "Muebles Casa Nova",
  "Ferretería El Roble",
  "Agencia Pixel Azul",
  "Clínica Dental Sonrisa",
  "Boutique Alma",
  "Distribuidora Sol",
  "Imprenta Prisma",
  "Consultoría Delta",
  "Repostería Dulce Día",
];

const activityTemplates = [
  {
    icon: "✨",
    text: (business) => `${business} se ha suscrito a Orion Business OS Pro`,
  },
  {
    icon: "📄",
    text: (business) => `${business} ha creado una cotización`,
  },
  {
    icon: "📦",
    text: (business) => `${business} ha agregado ${randomBetween(12, 86)} productos`,
  },
  {
    icon: "🏆",
    text: (business) => `${business} ha ganado una cotización`,
  },
];

const popupInterval = 6200;
const popupVisibleTime = 4700;
let currentPopup = null;
let activityTimer = null;
let lastBusinessIndex = -1;
let lastTemplateIndex = -1;

function isAllowedActivityPage() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const allowedPages = new Set(["index.html", "como-empezar.html"]);

  return allowedPages.has(currentPage);
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickNextIndex(length, previousIndex) {
  if (length <= 1) return 0;

  let nextIndex = previousIndex;

  while (nextIndex === previousIndex) {
    nextIndex = randomBetween(0, length - 1);
  }

  return nextIndex;
}

function buildActivity() {
  lastBusinessIndex = pickNextIndex(businessNames.length, lastBusinessIndex);
  lastTemplateIndex = pickNextIndex(activityTemplates.length, lastTemplateIndex);

  const business = businessNames[lastBusinessIndex];
  const template = activityTemplates[lastTemplateIndex];

  return {
    icon: template.icon,
    message: template.text(business),
  };
}

function removeCurrentPopup() {
  if (!currentPopup) return;

  currentPopup.classList.remove("is-visible");
  currentPopup.classList.add("is-hiding");

  const popupToRemove = currentPopup;
  currentPopup = null;

  setTimeout(() => {
    popupToRemove.remove();
  }, 360);
}

function showActivityPopup() {
  const container = document.querySelector("[data-activity-popups]");
  if (!container) return;

  removeCurrentPopup();

  const activity = buildActivity();
  const popup = document.createElement("div");
  popup.className = "activity-popup glass";
  popup.setAttribute("role", "status");
  popup.setAttribute("aria-live", "polite");
  popup.innerHTML = `
    <span class="activity-popup__icon" aria-hidden="true">${activity.icon}</span>
    <span class="activity-popup__content">
      <span class="activity-popup__label">Actividad reciente</span>
      <strong>${activity.message}</strong>
    </span>
  `;

  container.appendChild(popup);
  currentPopup = popup;

  requestAnimationFrame(() => {
    popup.classList.add("is-visible");
  });

  setTimeout(() => {
    if (currentPopup === popup) {
      removeCurrentPopup();
    }
  }, popupVisibleTime);
}

function startActivityPopups() {
  if (!isAllowedActivityPage()) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  showActivityPopup();

  if (reducedMotion.matches) return;

  activityTimer = setInterval(() => {
    if (document.hidden) return;
    showActivityPopup();
  }, popupInterval);
}

window.addEventListener("pagehide", () => {
  if (activityTimer) {
    clearInterval(activityTimer);
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startActivityPopups);
} else {
  startActivityPopups();
}
