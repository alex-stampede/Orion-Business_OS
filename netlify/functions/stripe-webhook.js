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

async function updateBusinessById(db, businessId, payload) {
  if (!businessId) return;
  const ref = db.collection("businesses").doc(businessId);
  await ref.set(payload, { merge: true });
}

async function findBusinessByCustomerId(db, stripeCustomerId) {
  const snap = await db
    .collection("businesses")
    .where("stripeCustomerId", "==", stripeCustomerId)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  return { id: doc.id, ref: doc.ref, data: doc.data() };
}

async function logBusinessActivity(db, businessId, type, message, meta = {}) {
  if (!businessId) return;

  await db.collection("businesses").doc(businessId).collection("activities").add({
    type,
    message,
    meta,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Método no permitido"
    };
  }

  try {
    const firebaseAdmin = getFirebaseAdmin();
    const db = firebaseAdmin.firestore();

    const signature = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
    const rawBody = event.body;
    const isBase64 = event.isBase64Encoded;

    const bodyBuffer = isBase64
      ? Buffer.from(rawBody, "base64")
      : Buffer.from(rawBody, "utf8");

    const stripeEvent = stripe.webhooks.constructEvent(
      bodyBuffer,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (stripeEvent.type) {
      case "checkout.session.completed": {
        const session = stripeEvent.data.object;
        const businessId = session.metadata?.businessId || session.subscription_data?.metadata?.businessId || null;

        if (businessId) {
          await updateBusinessById(db, businessId, {
            stripeCustomerId: session.customer || "",
            stripeSubscriptionId: session.subscription || "",
            checkoutCompletedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          await logBusinessActivity(
            db,
            businessId,
            "stripe_checkout_completed",
            "El cliente completó Stripe Checkout.",
            {
              stripeCustomerId: session.customer || "",
              stripeSubscriptionId: session.subscription || ""
            }
          );
        }

        break;
      }

      case "invoice.paid": {
        const invoice = stripeEvent.data.object;
        const stripeCustomerId = invoice.customer;

        const business = await findBusinessByCustomerId(db, stripeCustomerId);
        if (business) {
          await business.ref.set(
            {
              plan: "pro",
              planName: "Plan Pro",
              planPrice: 149,
              billingCycle: "monthly",
              subscriptionStatus: "active",
              stripeCustomerId: stripeCustomerId || "",
              stripeSubscriptionId: invoice.subscription || business.data.stripeSubscriptionId || "",
              cancelAtPeriodEnd: false,
              lastInvoicePaidAt: admin.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
          );

          await logBusinessActivity(
            db,
            business.id,
            "stripe_invoice_paid",
            "Se confirmó el pago de la suscripción Pro.",
            {
              stripeCustomerId,
              stripeSubscriptionId: invoice.subscription || ""
            }
          );
        }

        break;
      }

      case "customer.subscription.updated": {
        const subscription = stripeEvent.data.object;
        const stripeCustomerId = subscription.customer;

        const business = await findBusinessByCustomerId(db, stripeCustomerId);
        if (business) {
          await business.ref.set(
            {
              stripeSubscriptionId: subscription.id,
              subscriptionStatus: subscription.status || "inactive",
              currentPeriodEnd: subscription.current_period_end || null,
              cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
              plan: subscription.status === "active" ? "pro" : business.data.plan || "free",
              planName: subscription.status === "active" ? "Plan Pro" : business.data.planName || "Plan Inicio",
              planPrice: subscription.status === "active" ? 149 : Number(business.data.planPrice || 0)
            },
            { merge: true }
          );

          await logBusinessActivity(
            db,
            business.id,
            "stripe_subscription_updated",
            "La suscripción cambió de estado.",
            {
              stripeSubscriptionId: subscription.id,
              status: subscription.status || "",
              cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
            }
          );
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = stripeEvent.data.object;
        const stripeCustomerId = subscription.customer;

        const business = await findBusinessByCustomerId(db, stripeCustomerId);
        if (business) {
          await business.ref.set(
            {
              plan: "free",
              planName: "Plan Inicio",
              planPrice: 0,
              billingCycle: "monthly",
              subscriptionStatus: "canceled",
              stripeSubscriptionId: subscription.id || "",
              currentPeriodEnd: subscription.current_period_end || null,
              cancelAtPeriodEnd: false
            },
            { merge: true }
          );

          await logBusinessActivity(
            db,
            business.id,
            "stripe_subscription_deleted",
            "La suscripción Pro fue cancelada.",
            {
              stripeSubscriptionId: subscription.id || ""
            }
          );
        }

        break;
      }

      default:
        break;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };
  } catch (error) {
    console.error("stripe-webhook error:", error);

    return {
      statusCode: 400,
      body: `Webhook error: ${error.message}`
    };
  }
};