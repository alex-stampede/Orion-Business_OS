const Stripe = require("stripe");
const admin = require("firebase-admin");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

async function verifyAuth(event) {
  const firebaseAdmin = getFirebaseAdmin();
  const authHeader = event.headers.authorization || event.headers.Authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("No autorizado");
  }

  const idToken = authHeader.replace("Bearer ", "").trim();
  const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
  return decoded;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Método no permitido" })
    };
  }

  try {
    const firebaseAdmin = getFirebaseAdmin();
    const db = firebaseAdmin.firestore();

    const decoded = await verifyAuth(event);
    const body = JSON.parse(event.body || "{}");
    const { businessId } = body;

    if (!businessId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Falta businessId" })
      };
    }

    const userRef = db.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Usuario no encontrado" })
      };
    }

    const userData = userSnap.data();

    if (userData.businessId !== businessId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "No autorizado para este negocio" })
      };
    }

    const businessRef = db.collection("businesses").doc(businessId);
    const businessSnap = await businessRef.get();

    if (!businessSnap.exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Negocio no encontrado" })
      };
    }

    const businessData = businessSnap.data();
    const stripeCustomerId = businessData.stripeCustomerId || "";

    if (!stripeCustomerId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Este negocio no tiene cliente de Stripe" })
      };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.APP_URL}/app.html#settings`
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        url: session.url
      })
    };
  } catch (error) {
    console.error("create-portal-session error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || "No se pudo crear la sesión del portal"
      })
    };
  }
};