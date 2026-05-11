const admin = require("firebase-admin");
const { notifyNewUserRegistration } = require("./utils/email-notifications");

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
      })
    });
  }

  return admin;
}

function getBearerToken(event) {
  const header = event.headers.authorization || event.headers.Authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) return null;
  return token;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Método no permitido"
    };
  }

  try {
    const token = getBearerToken(event);

    if (!token) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Token de autenticación requerido" })
      };
    }

    const firebaseAdmin = getFirebaseAdmin();
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    const db = firebaseAdmin.firestore();

    const userSnap = await db.collection("users").doc(decodedToken.uid).get();

    if (!userSnap.exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Usuario no encontrado" })
      };
    }

    const userData = userSnap.data();
    const businessId = userData.businessId;
    let businessData = {};

    if (businessId) {
      const businessSnap = await db.collection("businesses").doc(businessId).get();
      businessData = businessSnap.exists ? businessSnap.data() : {};
    }

    await notifyNewUserRegistration({
      fullName: userData.fullName || decodedToken.name || "",
      email: userData.email || decodedToken.email || "",
      businessName: businessData.name || "",
      businessId,
      uid: decodedToken.uid
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };
  } catch (error) {
    console.error("notify-registration error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "No se pudo enviar la notificación" })
    };
  }
};
