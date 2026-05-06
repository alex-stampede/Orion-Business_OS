const businessNames = [
  "Papelería Nova",
  "Café Bruma",
  "Taller Mecánico Ruiz",
  "Boutique Arena",
  "Estudio Pixel",
  "Ferretería El Roble",
  "Clínica Dental Sonríe",
  "Mueblería Altavista",
  "Distribuidora Norte",
  "Floristería Aurora",
  "Agencia Creativa Nexo",
  "Constructora Prisma",
  "Imprenta Punto Verde",
  "Repostería Canela",
  "Consultorio Vital",
  "Autopartes Delta",
  "Spa Serena",
  "Carpintería Cedro",
  "Tecno Soluciones MX",
  "Uniformes Atlas",
  "Lavandería Nube",
  "Vivero Raíces",
  "Cerrajería Express",
  "Marketing Local Pro",
  "Pastelería Dulce Norte",
  "Óptica Horizonte",
  "Arquitectura Línea",
  "Eventos Magnolia",
  "Seguros Punto Cero",
  "Restaurante Marea",
  "Suministros Médicos Ámbar",
  "Diseño Interior Casa Luz",
  "Academia Impulso",
  "Tienda Bike Ruta",
  "Refacciones Motor Plus",
  "Consultora Avanza",
  "Gym Fuerza 24",
  "Papelería El Faro",
  "Cocinas Urbanas",
  "Fotografía Prisma",
  "Veterinaria Huellitas",
  "Heladería Toscana",
  "Renta Equipos Pro",
  "Jardinería Verde Vivo",
  "Estética Bella Raíz",
  "Electro Hogar Centro",
  "Logística Rápida MX",
  "Panadería Molino",
  "Inmobiliaria Cumbre",
  "Servicios Contables Sigma",
  "Decoraciones Lirio",
  "Agroinsumos Campo Claro",
  "Librería Horizonte",
  "Climatización Ártica",
  "Mantenimiento Integral Koi",
  "Boutique Lienzo",
  "Proyectos Eléctricos Volt",
  "Consultorio NutriVida",
  "Bazar Casa Bonita",
  "Servicios Industriales Faro"
];

const productAmounts = [
  "18 productos",
  "27 productos",
  "35 productos",
  "42 productos",
  "56 productos",
  "64 productos",
  "73 productos",
  "88 productos",
  "96 productos",
  "120 productos"
];

const notificationTypes = [
  {
    icon: "✦",
    buildMessage: (name) => `${name} se ha suscrito a Orion Business OS Pro`,
    label: "Nueva suscripción"
  },
  {
    icon: "🧾",
    buildMessage: (name) => `${name} ha creado una cotización`,
    label: "Cotización creada"
  },
  {
    icon: "📦",
    buildMessage: (name, index) =>
      `${name} ha agregado ${productAmounts[index % productAmounts.length]} a su catálogo`,
    label: "Catálogo actualizado"
  },
  {
    icon: "🏆",
    buildMessage: (name) => `${name} ha ganado una cotización`,
    label: "Venta ganada"
  }
];

const STORAGE_KEY = "orionSocialProofShown";
const INITIAL_DELAY = 2800;
const VISIBLE_TIME = 5200;
const NEXT_DELAY_MIN = 7200;
const NEXT_DELAY_VARIANCE = 4200;

const shuffle = (items) => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }

  return copy;
};

const readShownMessages = () => {
  try {
    const storedValue = window.sessionStorage.getItem(STORAGE_KEY);
    return storedValue ? JSON.parse(storedValue) : [];
  } catch {
    return [];
  }
};

const saveShownMessages = (messages) => {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // The experience can continue without session storage.
  }
};

const createMessages = () =>
  shuffle(
    businessNames.flatMap((businessName, businessIndex) =>
      notificationTypes.map((type, typeIndex) => ({
        icon: type.icon,
        label: type.label,
        text: type.buildMessage(businessName, businessIndex + typeIndex)
      }))
    )
  );

const getNextMessage = (messages) => {
  const shownMessages = readShownMessages();
  const unusedMessages = messages.filter(
    (message) => !shownMessages.includes(message.text)
  );
  const availableMessages = unusedMessages.length > 0 ? unusedMessages : messages;
  const nextMessage = availableMessages[0];
  const nextShownMessages =
    unusedMessages.length > 0 ? [...shownMessages, nextMessage.text] : [nextMessage.text];

  saveShownMessages(nextShownMessages);
  return nextMessage;
};

const buildPopup = () => {
  const popup = document.createElement("div");
  popup.className = "social-proof-popup";
  popup.setAttribute("aria-live", "polite");
  popup.setAttribute("aria-atomic", "true");

  popup.innerHTML = `
    <div class="social-proof-popup__icon" aria-hidden="true"></div>
    <div class="social-proof-popup__copy">
      <span class="social-proof-popup__label"></span>
      <strong class="social-proof-popup__text"></strong>
    </div>
  `;

  document.body.appendChild(popup);
  return popup;
};

const showPopup = (popup, message) => {
  popup.querySelector(".social-proof-popup__icon").textContent = message.icon;
  popup.querySelector(".social-proof-popup__label").textContent = message.label;
  popup.querySelector(".social-proof-popup__text").textContent = message.text;
  popup.classList.add("is-visible");

  window.setTimeout(() => {
    popup.classList.remove("is-visible");
  }, VISIBLE_TIME);
};

const schedulePopups = (popup, messages) => {
  const showNext = () => {
    if (!document.hidden) {
      showPopup(popup, getNextMessage(messages));
    }

    const nextDelay = NEXT_DELAY_MIN + Math.random() * NEXT_DELAY_VARIANCE;
    window.setTimeout(showNext, nextDelay);
  };

  window.setTimeout(showNext, INITIAL_DELAY);
};

const initSocialProofPopups = () => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const popup = buildPopup();
  const messages = createMessages();
  schedulePopups(popup, messages);
};

initSocialProofPopups();
