import { openModal, closeModal } from "./ui.js";
import { setTutorialSeen, getState } from "./state.js";

const tutorialSteps = [
  {
    title: "Bienvenido a Orion Flow",
    text: "Aquí podrás centralizar cotizaciones, leads, clientes y oportunidades comerciales."
  },
  {
    title: "Dashboard",
    text: "Tu panel principal resume cotizaciones, métricas y actividad reciente."
  },
  {
    title: "Cotizaciones",
    text: "Desde aquí podrás crear, editar, exportar a PDF y dar seguimiento a cada propuesta."
  },
  {
    title: "Leads y Clientes",
    text: "Organiza prospectos antes de convertirlos en clientes, con mejor contexto comercial."
  },
  {
    title: "Pipeline",
    text: "Visualiza tus oportunidades por etapa para detectar qué avanza y qué se enfría."
  }
];

export function startTutorial() {
  let current = 0;

  const renderStep = () => {
    const step = tutorialSteps[current];

    openModal({
      title: step.title,
      content: `
        <p style="color:#a8c7bb; line-height:1.8; margin:0;">
          ${step.text}
        </p>
        <div style="margin-top:18px; font-size:12px; color:#7f9d92; font-weight:700;">
          Paso ${current + 1} de ${tutorialSteps.length}
        </div>
      `,
      actions: `
        ${current > 0 ? `<button id="tutorial-prev" class="btn btn-secondary">Atrás</button>` : ""}
        ${
          current < tutorialSteps.length - 1
            ? `<button id="tutorial-next" class="btn btn-primary">Siguiente</button>`
            : `<button id="tutorial-finish" class="btn btn-primary">Finalizar</button>`
        }
      `
    });

    document.getElementById("tutorial-prev")?.addEventListener("click", () => {
      current -= 1;
      renderStep();
    });

    document.getElementById("tutorial-next")?.addEventListener("click", () => {
      current += 1;
      renderStep();
    });

    document.getElementById("tutorial-finish")?.addEventListener("click", () => {
      setTutorialSeen(true);
      closeModal();
    });
  };

  renderStep();
}

export function maybeRunTutorial() {
  const state = getState();
  if (!state.tutorialSeen) {
    startTutorial();
  }
}