import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyA_8cTI-s8LeBSbALq-KE6xQjRNzYyjEAs",
  authDomain: "orion-quotes.firebaseapp.com",
  projectId: "orion-quotes",
  storageBucket: "orion-quotes.firebasestorage.app",
  messagingSenderId: "167850264250",
  appId: "1:167850264250:web:39745de84fec547f50a483",
  measurementId: "G-ERH1SHWGZ1"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;