import { escapeHtml, formatCurrency } from "../helpers.js";
import { showToast, openModal, closeModal } from "../ui.js";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getInventoryMetrics,
  getCurrentBusinessPlan,
  isProPlan
} from "../firestore-service.js";

let productsCache = [];
let filteredProducts = [];
let inventoryMetricsCache = null;

function getProductStatus(product = {}) {
  const stock = Number(product.stock || 0);
  const minStock = Number(product.minStock || 0);

  if (stock <= 0) {
    return {
      key: "out",
      label: "Agotado"
    };
  }

  if (stock <= minStock) {
    return {
      key: "low",
      label: "Stock bajo"
    };
  }

  return {
    key: "active",
    label: "Activo"
  };
}

function buildProBadge() {
  return `<span class="badge-pro">PRO</span>`;
}

function renderProductsLockState() {
  return `
    <section class="app-view glass">
      <div class="app-view-header">
        <div class="app-view-title">
          <p class="eyebrow-sm">Productos e inventario</p>
          <h2>Controla tu catálogo y stock</h2>
          <p class="muted">
            Organiza tus productos, lleva control de inventario y acelera tus cotizaciones.
          </p>
        </div>
      </div>

      <div class="app-view-grid">
        <article class="app-panel plan-usage-card">
          <div class="card-head">
            <strong>Disponible en Plan Pro</strong>
            <span>Inventario + catálogo</span>
          </div>

          <p class="muted">
            Con <strong>Plan Pro</strong> puedes registrar productos, controlar existencias,
            detectar stock bajo y usar tu catálogo para cotizar más rápido.
          </p>

          <div class="activity-list" style="margin-top:8px;">
            <div class="activity-item">
              <span class="activity-dot"></span>
              <p>Catálogo de productos centralizado</p>
            </div>
            <div class="activity-item">
              <span class="activity-dot"></span>
              <p>Alertas de stock bajo y agotado</p>
            </div>
            <div class="activity-item">
              <span class="activity-dot"></span>
              <p>Productos reutilizables en cotizaciones</p>
            </div>
          </div>

          <div class="btn-row mt-5">
            <a href="#settings" class="btn btn-primary">
              Actualizar a Plan Pro
            </a>
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderKpis() {
  const metrics = inventoryMetricsCache || {
    totalProducts: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    inventoryValue: 0
  };

  return `
    <div class="app-kpi-grid">
      <article class="app-kpi-card">
        <small>Total de productos</small>
        <strong>${metrics.totalProducts || 0}</strong>
      </article>

      <article class="app-kpi-card">
        <small>Stock bajo</small>
        <strong>${metrics.lowStockCount || 0}</strong>
      </article>

      <article class="app-kpi-card">
        <small>Agotados</small>
        <strong>${metrics.outOfStockCount || 0}</strong>
      </article>

      <article class="app-kpi-card">
        <small>Valor estimado</small>
        <strong>${formatCurrency(metrics.inventoryValue || 0, "MXN")}</strong>
      </article>
    </div>
  `;
}

function renderAlerts() {
  const lowStockProducts = productsCache.filter(p => getProductStatus(p).key === "low");
  const outProducts = productsCache.filter(p => getProductStatus(p).key === "out");

  if (!lowStockProducts.length && !outProducts.length) {
    return `
      <article class="app-panel">
        <div class="card-head">
          <strong>Alertas de inventario</strong>
          <span>Todo en orden</span>
        </div>
        <p class="muted">
          No hay productos con stock bajo ni agotados por el momento.
        </p>
      </article>
    `;
  }

  return `
    <article class="app-panel">
      <div class="card-head">
        <strong>Alertas de inventario</strong>
        <span>${lowStockProducts.length + outProducts.length} alerta(s)</span>
      </div>

      <div class="activity-list">
        ${outProducts
          .map(
            product => `
              <div class="activity-item">
                <span class="activity-dot"></span>
                <p>
                  <strong>${escapeHtml(product.name || "Producto")}</strong> está agotado.
                </p>
              </div>
            `
          )
          .join("")}

        ${lowStockProducts
          .map(
            product => `
              <div class="activity-item">
                <span class="activity-dot"></span>
                <p>
                  <strong>${escapeHtml(product.name || "Producto")}</strong> tiene stock bajo
                  (${Number(product.stock || 0)} disponible / mínimo ${Number(product.minStock || 0)}).
                </p>
              </div>
            `
          )
          .join("")}
      </div>
    </article>
  `;
}

function applyFilters() {
  const search = (document.getElementById("products-search")?.value || "").trim().toLowerCase();
  const status = document.getElementById("products-filter-status")?.value || "";

  filteredProducts = productsCache.filter(product => {
    const haystack = [
      product.name || "",
      product.sku || "",
      product.category || "",
      product.description || ""
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = !search || haystack.includes(search);
    const matchesStatus = !status || getProductStatus(product).key === status;

    return matchesSearch && matchesStatus;
  });

  renderProductsTable();
}

function renderProductsTable() {
  const tbody = document.getElementById("products-table-body");
  const count = document.getElementById("products-count");

  if (!tbody || !count) return;

  count.textContent = `${filteredProducts.length} registro(s)`;

  if (!filteredProducts.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="table-empty-state">
            <h3>Aún no has agregado productos</h3>
            <p class="muted">
              Empieza creando tu primer producto para llevar control de inventario y cotizar más rápido.
            </p>
            <button class="btn btn-primary" type="button" id="empty-create-product-btn">
              Agregar producto
            </button>
          </div>
        </td>
      </tr>
    `;

    document.getElementById("empty-create-product-btn")?.addEventListener("click", () => {
      openCreateProductModal();
    });

    return;
  }

  tbody.innerHTML = filteredProducts
    .map(product => {
      const status = getProductStatus(product);

      return `
        <tr>
          <td>
            <strong>${escapeHtml(product.name || "—")}</strong>
            ${
              product.description
                ? `<div class="muted" style="margin-top:4px; font-size:12px;">${escapeHtml(product.description)}</div>`
                : ""
            }
          </td>
          <td>${escapeHtml(product.sku || "—")}</td>
          <td>${escapeHtml(product.category || "—")}</td>
          <td>${formatCurrency(Number(product.unitPrice || 0), "MXN")}</td>
          <td>${Number(product.stock || 0)}</td>
          <td>${Number(product.minStock || 0)}</td>
          <td>
            <span class="status-pill ${status.key === "active" ? "won" : status.key === "low" ? "pending" : "lost"}">
              ${status.label}
            </span>
          </td>
          <td>
            <div class="btn-row">
              <button class="btn btn-secondary btn-sm js-edit-product" data-id="${product.id}">
                Editar
              </button>
              <button class="btn btn-secondary btn-sm js-delete-product" data-id="${product.id}">
                Eliminar
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  bindTableActions();
}

function bindTableActions() {
  document.querySelectorAll(".js-edit-product").forEach(btn => {
    btn.onclick = () => {
      const product = productsCache.find(p => p.id === btn.dataset.id);
      if (!product) return;
      openEditProductModal(product);
    };
  });

  document.querySelectorAll(".js-delete-product").forEach(btn => {
    btn.onclick = async () => {
      const product = productsCache.find(p => p.id === btn.dataset.id);
      if (!product) return;

      const confirmed = window.confirm(
        `¿Eliminar el producto "${product.name || "Sin nombre"}"?`
      );

      if (!confirmed) return;

      try {
        await deleteProduct(product.id, product.name || "");
        showToast("Producto eliminado correctamente");
        await loadProducts();
      } catch (error) {
        console.error(error);
        showToast("No se pudo eliminar el producto");
      }
    };
  });
}

function productFormMarkup(product = {}) {
  return `
    <div class="modal-grid-2">
      <div class="field">
        <label>Producto</label>
        <input
          id="product-name"
          type="text"
          placeholder="Nombre del producto"
          value="${escapeHtml(product.name || "")}"
        />
      </div>

      <div class="field">
        <label>SKU</label>
        <input
          id="product-sku"
          type="text"
          placeholder="Ej. SKU-001"
          value="${escapeHtml(product.sku || "")}"
        />
      </div>

      <div class="field">
        <label>Categoría</label>
        <input
          id="product-category"
          type="text"
          placeholder="Ej. Herramientas, Refacciones, Servicios"
          value="${escapeHtml(product.category || "")}"
        />
      </div>

      <div class="field">
        <label>Precio unitario</label>
        <input
          id="product-unit-price"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value="${Number(product.unitPrice || 0)}"
        />
      </div>

      <div class="field">
        <label>Stock actual</label>
        <input
          id="product-stock"
          type="number"
          min="0"
          step="1"
          placeholder="0"
          value="${Number(product.stock || 0)}"
        />
      </div>

      <div class="field">
        <label>Stock mínimo</label>
        <input
          id="product-min-stock"
          type="number"
          min="0"
          step="1"
          placeholder="0"
          value="${Number(product.minStock || 0)}"
        />
      </div>
    </div>

    <div class="field" style="margin-top:16px;">
      <label>Descripción</label>
      <textarea
        id="product-description"
        rows="4"
        placeholder="Descripción breve del producto"
      >${escapeHtml(product.description || "")}</textarea>
    </div>
  `;
}

function getProductFormPayload() {
  return {
    name: document.getElementById("product-name")?.value.trim() || "",
    sku: document.getElementById("product-sku")?.value.trim() || "",
    category: document.getElementById("product-category")?.value.trim() || "",
    description: document.getElementById("product-description")?.value.trim() || "",
    unitPrice: Number(document.getElementById("product-unit-price")?.value || 0),
    stock: Number(document.getElementById("product-stock")?.value || 0),
    minStock: Number(document.getElementById("product-min-stock")?.value || 0)
  };
}

function openCreateProductModal() {
  openModal({
    title: `Agregar producto ${buildProBadge()}`,
    content: productFormMarkup(),
    actions: `
      <button class="btn btn-secondary" type="button" id="cancel-product-modal-btn">
        Cancelar
      </button>
      <button class="btn btn-primary" type="button" id="save-product-modal-btn">
        Guardar producto
      </button>
    `
  });

  document.getElementById("cancel-product-modal-btn")?.addEventListener("click", closeModal);

  document.getElementById("save-product-modal-btn")?.addEventListener("click", async () => {
    const payload = getProductFormPayload();

    if (!payload.name) {
      showToast("Escribe el nombre del producto");
      return;
    }

    try {
      await createProduct(payload);
      closeModal();
      showToast("Producto creado correctamente");
      await loadProducts();
    } catch (error) {
      console.error(error);
      showToast("No se pudo crear el producto");
    }
  });
}

function openEditProductModal(product = {}) {
  openModal({
    title: `Editar producto ${buildProBadge()}`,
    content: productFormMarkup(product),
    actions: `
      <button class="btn btn-secondary" type="button" id="cancel-product-modal-btn">
        Cancelar
      </button>
      <button class="btn btn-primary" type="button" id="update-product-modal-btn">
        Guardar cambios
      </button>
    `
  });

  document.getElementById("cancel-product-modal-btn")?.addEventListener("click", closeModal);

  document.getElementById("update-product-modal-btn")?.addEventListener("click", async () => {
    const payload = getProductFormPayload();

    if (!payload.name) {
      showToast("Escribe el nombre del producto");
      return;
    }

    try {
      await updateProduct(product.id, payload);
      closeModal();
      showToast("Producto actualizado correctamente");
      await loadProducts();
    } catch (error) {
      console.error(error);
      showToast("No se pudo actualizar el producto");
    }
  });
}

async function loadProducts() {
  try {
    const [products, metrics] = await Promise.all([
      listProducts(),
      getInventoryMetrics()
    ]);

    productsCache = Array.isArray(products) ? products : [];
    filteredProducts = [...productsCache];
    inventoryMetricsCache = metrics || null;

    const kpiBox = document.getElementById("products-kpis");
    const alertsBox = document.getElementById("products-alerts");

    if (kpiBox) kpiBox.innerHTML = renderKpis();
    if (alertsBox) alertsBox.innerHTML = renderAlerts();

    renderProductsTable();
  } catch (error) {
    console.error("ERROR AL CARGAR PRODUCTOS:", error);
    showToast("No se pudo cargar el módulo de productos");
  }
}

export function renderProducts() {
  const plan = getCurrentBusinessPlan();

  if (!isProPlan()) {
    return renderProductsLockState();
  }

  return `
    <section class="app-view glass">
      <div class="app-view-header">
        <div class="app-view-title">
          <p class="eyebrow-sm">Productos e inventario</p>
          <h2>Control de catálogo y stock</h2>
          <p class="muted">
            Lleva registro de tus productos, detecta inventario bajo y prepara tu negocio para cotizar más rápido.
          </p>
        </div>

        <div class="btn-row">
          <button class="btn btn-primary" type="button" id="create-product-btn">
            Agregar producto
          </button>
        </div>
      </div>

      <div class="app-view-grid">
        <div id="products-kpis">
          ${renderKpis()}
        </div>

        <div id="products-alerts">
          ${renderAlerts()}
        </div>

        <article class="app-panel">
          <div class="form-grid-2 mb-4">
            <div class="field">
              <label>Buscar</label>
              <input
                id="products-search"
                type="text"
                placeholder="Producto, SKU o categoría"
              />
            </div>

            <div class="field">
              <label>Estatus</label>
              <select id="products-filter-status">
                <option value="">Todos</option>
                <option value="active">Activo</option>
                <option value="low">Stock bajo</option>
                <option value="out">Agotado</option>
              </select>
            </div>
          </div>

          <div class="card-head">
            <strong>Listado de productos</strong>
            <span id="products-count">Cargando...</span>
          </div>

          <div class="table-shell">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="products-table-body">
                <tr>
                  <td colspan="8">Cargando productos...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  `;
}

export function initProducts() {
  if (!isProPlan()) return;

  loadProducts();

  document.getElementById("create-product-btn")?.addEventListener("click", () => {
    openCreateProductModal();
  });

  document.getElementById("products-search")?.addEventListener("input", applyFilters);
  document.getElementById("products-filter-status")?.addEventListener("change", applyFilters);
}
