import { $, getInitials } from "./helpers.js";
import { getState } from "./state.js";

let toastTimeout = null;

export function showToast(message = "") {
  let toast = $("#app-toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.style.position = "fixed";
    toast.style.right = "20px";
    toast.style.bottom = "20px";
    toast.style.zIndex = "9999";
    toast.style.padding = "12px 16px";
    toast.style.borderRadius = "14px";
    toast.style.background = "rgba(14, 28, 24, 0.92)";
    toast.style.color = "#ffffff";
    toast.style.border = "1px solid rgba(255,255,255,0.1)";
    toast.style.boxShadow = "0 20px 50px rgba(0,0,0,0.22)";
    toast.style.fontSize = "14px";
    toast.style.fontWeight = "700";
    toast.style.maxWidth = "320px";
    toast.style.backdropFilter = "blur(12px)";
    toast.style.webkitBackdropFilter = "blur(12px)";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";
  toast.style.transition = "opacity .25s ease, transform .25s ease";

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
  }, 2400);
}

export function setNavActive(route) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    const itemRoute = item.dataset.route;
    item.classList.toggle("is-active", itemRoute === route);
  });
}

export function setPageTitle(title = "Dashboard") {
  const pageTitle = $("#page-title");
  if (pageTitle) {
    pageTitle.textContent = title;
  }
}

export function toggleSidebarUI(isCollapsed = false) {
  const appShell = $(".app-shell");
  const sidebar = $(".sidebar");

  if (!appShell || !sidebar) return;

  if (window.innerWidth <= 1180) {
    appShell.style.gridTemplateColumns = "1fr";
    sidebar.style.display = isCollapsed ? "none" : "flex";
    return;
  }

  sidebar.style.display = "flex";
  appShell.style.gridTemplateColumns = isCollapsed ? "88px 1fr" : "292px 1fr";

  sidebar.classList.toggle("is-collapsed", isCollapsed);

  document.querySelectorAll(".sidebar .hide-on-collapse").forEach((el) => {
    el.style.display = isCollapsed ? "none" : "";
  });
}

export function updateSidebarProfile(user = {}, business = {}) {
  const profileName = $("#sidebar-profile-name");
  const profileBusiness = $("#sidebar-profile-business");
  const avatar = $("#sidebar-avatar");
  const brandName = $("#sidebar-brand-name");
  const brandTagline = $("#sidebar-brand-tagline");

  const resolvedUserName =
    user.fullName ||
    user.displayName ||
    user.name ||
    user.email?.split("@")[0] ||
    "Usuario";

  const resolvedBusinessName =
    business.name || business.businessName || "Mi negocio";

  if (profileName) {
    profileName.textContent = resolvedUserName;
  }

  if (profileBusiness) {
    profileBusiness.textContent = resolvedBusinessName;
  }

  if (avatar) {
    avatar.textContent = getInitials(resolvedUserName || "OB");
  }

  if (brandName) {
    brandName.textContent = "Orion Business OS";
  }

  if (brandTagline) {
    brandTagline.textContent = "Dirige tu negocio desde un solo lugar";
  }

  syncProductsNavState();
}

export function syncUpgradeButton() {
  const button = $("#upgrade-plan-btn");
  if (!button) return;

  const state = getState();
  const isSuperAdmin = String(state.user?.role || "").trim().toLowerCase() === "super_admin";
  const isPro = (state.business?.plan || "free") === "pro";

  button.style.display = isPro || isSuperAdmin ? "none" : "inline-flex";
}

export function syncProductsNavState() {
  const state = getState();
  const isPro = (state.business?.plan || "free") === "pro";

  const productsNav = document.querySelector('[data-route="products"]');
  if (!productsNav) return;

  const badge = productsNav.querySelector(".badge-pro");

  if (isPro) {
    productsNav.classList.remove("nav-item-locked");
    productsNav.removeAttribute("aria-disabled");
    productsNav.title = "";
    if (badge) {
      badge.style.display = "none";
    }
  } else {
    productsNav.classList.add("nav-item-locked");
    productsNav.setAttribute("aria-disabled", "true");
    productsNav.title = "Disponible en Plan Pro";
    if (badge) {
      badge.style.display = "inline-flex";
    }
  }
}

export function openModal({ title = "", content = "", actions = "" } = {}) {
  closeModal();

  const previousOverflow = document.body.style.overflow;
  document.body.dataset.previousOverflow = previousOverflow || "";
  document.body.style.overflow = "hidden";

  const overlay = document.createElement("div");
  overlay.id = "app-modal-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "9998";
  overlay.style.background = "rgba(0,0,0,0.45)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "20px";
  overlay.style.backdropFilter = "blur(4px)";
  overlay.style.webkitBackdropFilter = "blur(4px)";

  const modal = document.createElement("div");
  modal.id = "app-modal";
  modal.style.width = "min(720px, 100%)";
  modal.style.maxHeight = "min(88vh, 900px)";
  modal.style.overflowY = "auto";
  modal.style.borderRadius = "24px";
  modal.style.padding = "24px";
  modal.style.background =
    "linear-gradient(180deg, rgba(18,33,28,0.95), rgba(13,24,20,0.95))";
  modal.style.border = "1px solid rgba(255,255,255,0.08)";
  modal.style.boxShadow = "0 30px 80px rgba(0,0,0,0.35)";
  modal.style.color = "#fff";

  modal.innerHTML = `
    <div style="display:grid; gap:16px;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
        <div style="min-width:0;">
          <h3 style="margin:0 0 8px; font-size:24px; line-height:1.1;">${title}</h3>
        </div>

        <button
          type="button"
          id="app-modal-close"
          aria-label="Cerrar"
          style="
            width:42px;
            height:42px;
            min-width:42px;
            border-radius:14px;
            border:1px solid rgba(255,255,255,0.08);
            background:rgba(255,255,255,0.05);
            color:#fff;
            font-size:22px;
            cursor:pointer;
          "
        >
          ×
        </button>
      </div>

      <div>${content}</div>

      <div class="btn-row">${actions}</div>
    </div>
  `;

  overlay.appendChild(modal);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeModal();
    }
  });

  document.body.appendChild(overlay);

  $("#app-modal-close")?.addEventListener("click", closeModal);

  document.addEventListener("keydown", handleModalEscape);

  injectModalHelpers();
}

function handleModalEscape(event) {
  if (event.key === "Escape") {
    closeModal();
  }
}

function injectModalHelpers() {
  if ($("#app-modal-helper-styles")) return;

  const style = document.createElement("style");
  style.id = "app-modal-helper-styles";
  style.textContent = `
    .modal-grid-2{
      display:grid;
      grid-template-columns:repeat(2, minmax(0,1fr));
      gap:16px;
    }

    .modal-note{
      color:rgba(255,255,255,0.68);
      font-size:14px;
      line-height:1.6;
      margin:0 0 4px;
    }

    @media (max-width: 640px){
      #app-modal-overlay{
        padding:12px !important;
        align-items:flex-end !important;
      }

      #app-modal{
        width:100% !important;
        max-height:90vh !important;
        border-radius:22px !important;
        padding:16px !important;
      }

      .modal-grid-2{
        grid-template-columns:1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

export function closeModal() {
  $("#app-modal-overlay")?.remove();

  const previousOverflow = document.body.dataset.previousOverflow ?? "";
  document.body.style.overflow = previousOverflow;
  delete document.body.dataset.previousOverflow;

  document.removeEventListener("keydown", handleModalEscape);
}

export function bindModalFormSubmit(formId, handler) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handler(form);
  });
}
