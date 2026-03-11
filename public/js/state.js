import { getLocal, setLocal } from "./helpers.js";

const defaultState = {
  user: null,
  business: null,
  route: "dashboard",
  tutorialSeen: false,
  sidebarCollapsed: false
};

let state = {
  ...defaultState,
  tutorialSeen: getLocal("orion_tutorial_seen", false),
  sidebarCollapsed: getLocal("orion_sidebar_collapsed", false)
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch = {}) {
  state = { ...state, ...patch };
  listeners.forEach(listener => listener(state));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetState() {
  state = {
    ...defaultState,
    tutorialSeen: getLocal("orion_tutorial_seen", false),
    sidebarCollapsed: getLocal("orion_sidebar_collapsed", false)
  };
  listeners.forEach(listener => listener(state));
}

export function setTutorialSeen(value) {
  setLocal("orion_tutorial_seen", value);
  setState({ tutorialSeen: value });
}

export function setSidebarCollapsed(value) {
  setLocal("orion_sidebar_collapsed", value);
  setState({ sidebarCollapsed: value });
}