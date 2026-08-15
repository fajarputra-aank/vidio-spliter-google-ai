import type { Express, Request, Response } from "express";
import express from "express";
import { getCreditPack } from "./creditProducts";
import * as db from "./db";
import { getStripe } from "./stripe";

export function registerStripeWebhook(app: Express) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature || typeof signature !== "string" || !secret) return res.status(400).json({ error: "Webhook Stripe belum dikonfigurasi." });

    try {
      const event = getStripe().webhooks.constructEvent(req.body, signature, secret);
      if (event.id.startsWith("evt_test_")) {
        console.log("[Stripe] Test event detected, returning verification response");
        return res.json({ verified: true });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const userId = Number(session.metadata?.user_id);
        const pack = getCreditPack(session.metadata?.pack_id ?? "");
        if (!Number.isInteger(userId) || userId < 1 || !pack) return res.status(400).json({ error: "Metadata checkout tidak valid." });

        const fulfilled = await db.fulfillCreditPurchase({
          userId,
          pack,
          stripeCheckoutSessionId: session.id,
          stripeEventId: event.id,
        });
        console.log(`[Stripe] checkout.session.completed ${event.id}; fulfilled=${fulfilled}`);
      }

      return res.json({ received: true });
    } catch (error) {
      console.error("[Stripe] Webhook verification failed", error);
      return res.status(400).json({ error: "Webhook tidak dapat diverifikasi." });
    }
  });
}
