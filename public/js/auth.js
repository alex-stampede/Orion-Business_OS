import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { $, getHashRoute } from "./helpers.js";
import { setState, resetState } from "./state.js";
import { showToast, updateSidebarProfile } from "./ui.js";
import { initRouter } from "./router.js";
import { maybeRunTutorial } from "./tutorial.js";

const loginForm = $("#login-form");
const registerForm = $("#register-form");
const logoutBtn = $("#logout-btn");

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fullName = $("#fullName")?.value.trim();
    const businessName = $("#businessName")?.value.trim();
    const email = $("#email")?.value.trim();
    const password = $("#password")?.value;
    const messageEl = $("#register-message");

    try {
      if (messageEl) messageEl.textContent = "Creando cuenta...";

      const credentials = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = credentials.user;
      const businessId = `biz_${user.uid}`;

      await updateProfile(user, { displayName: fullName });

      // 1) Crear negocio
      await setDoc(doc(db, "businesses", businessId), {
        name: businessName,
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
        onboardingCompleted: false,
        plan: "free",
      });

      // 2) Crear perfil principal del usuario PRIMERO
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName,
        email,
        businessId,
        createdAt: serverTimestamp(),
      });

      // 3) Crear usuario dentro del negocio
      await setDoc(doc(db, "businesses", businessId, "users", user.uid), {
        uid: user.uid,
        fullName,
        email,
        role: "owner",
        createdAt: serverTimestamp(),
      });

      // 4) Crear settings generales
      await setDoc(doc(db, "businesses", businessId, "settings", "general"), {
        currency: "MXN",
        quotePrefix: "COT",
        nextQuoteNumber: 1,
        taxRate: 16,
        businessEmail: email,
        businessPhone: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (messageEl)
        messageEl.textContent = "Cuenta creada correctamente. Redirigiendo...";
      showToast("Cuenta creada correctamente");

      setTimeout(() => {
        window.location.href = "app.html#dashboard";
      }, 900);
    } catch (error) {
      console.error("REGISTER ERROR:", error);

      if (messageEl) {
        messageEl.textContent = error?.message || "No se pudo crear la cuenta.";
      }

      showToast("Error al crear la cuenta");
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("#email")?.value.trim();
    const password = $("#password")?.value;
    const messageEl = $("#login-message");

    try {
      if (messageEl) messageEl.textContent = "Ingresando...";

      await signInWithEmailAndPassword(auth, email, password);

      if (messageEl) messageEl.textContent = "Acceso correcto. Redirigiendo...";
      showToast("Bienvenido a Orion Flow");

      setTimeout(() => {
        window.location.href = "app.html#dashboard";
      }, 700);
    } catch (error) {
      console.error("LOGIN ERROR:", error);

      if (messageEl) {
        messageEl.textContent = "Correo o contraseña incorrectos.";
      }

      showToast("No se pudo iniciar sesión");
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      showToast("Sesión cerrada");
      window.location.href = "login.html";
    } catch (error) {
      console.error("LOGOUT ERROR:", error);
      showToast("No se pudo cerrar sesión");
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  const path = window.location.pathname;
  const isAppPage = path.includes("app.html");
  const isAuthPage =
    path.includes("login.html") || path.includes("register.html");

  if (!user) {
    resetState();

    if (isAppPage) {
      window.location.href = "login.html";
    }
    return;
  }

  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const userData = userSnap.exists() ? userSnap.data() : null;

    let businessData = null;
    let businessUserData = null;

    if (userData?.businessId) {
      const businessSnap = await getDoc(
        doc(db, "businesses", userData.businessId),
      );
      businessData = businessSnap.exists() ? businessSnap.data() : null;

      const businessUserSnap = await getDoc(
        doc(db, "businesses", userData.businessId, "users", user.uid),
      );
      businessUserData = businessUserSnap.exists() ? businessUserSnap.data() : null;
    }

    const role = String(
      userData?.role || businessUserData?.role || "",
    ).trim().toLowerCase();
    const isSuperAdmin = role === "super_admin";

    if (isSuperAdmin) {
      businessData = {
        ...(businessData || {}),
        plan: "pro",
        planName: "Plan Pro",
        planPrice: 0,
        subscriptionStatus: "active",
      };
    }

    const fullUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      ...(userData || {}),
      role: userData?.role || businessUserData?.role || "",
    };

    setState({
      user: fullUser,
      business: businessData,
      route: getHashRoute(),
    });

    if (isAuthPage) {
      window.location.href = "app.html#dashboard";
      return;
    }

    if (isAppPage) {
      updateSidebarProfile(fullUser, businessData || {});
      initRouter();
      maybeRunTutorial();
    }
  } catch (error) {
    console.error("SESSION LOAD ERROR:", error);
  }
});
