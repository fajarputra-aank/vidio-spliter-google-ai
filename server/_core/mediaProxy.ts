import type { Express, Request, Response } from "express";
import * as db from "../db";
import { storageGetSignedUrl } from "../storage";
import { sdk } from "./sdk";

const PUBLIC_SYSTEM_MEDIA = new Set([
  "lensa-saku-hero-studio_9f9ec738.jpg",
  "lensa-saku-headshot_83cca6e1.jpg",
  "lensa-saku-product_617755a2.jpg",
  "lensa-saku-food_26a6ef7f.jpg",
  "fajar-nugroho-logo_4219feaa.png",
  "fnp-brand-icon_fecf461e.png",
  "fajar-nugroho-logo_8fa9d033.png",
  "fnp-brand-icon_17f8efb6.png",
]);

function readKey(req: Request) {
  const raw = (req.params as Record<string, string>)[0];
  if (!raw || raw.includes("..") || raw.includes("\\")) return null;
  return decodeURIComponent(raw).replace(/^\/+/, "");
}

async function redirectToStorage(key: string, res: Response, cacheControl: string) {
  const url = await storageGetSignedUrl(key);
  res.set("Cache-Control", cacheControl);
  res.redirect(307, url);
}

export function registerMediaProxy(app: Express) {
  app.get("/api/media/public/*", async (req, res) => {
    const key = readKey(req);
    if (!key || (!PUBLIC_SYSTEM_MEDIA.has(key) && !key.startsWith("brand/"))) return res.status(404).send("Media tidak ditemukan.");
    try {
      await redirectToStorage(key, res, "public, max-age=86400");
    } catch (error) {
      console.error("[MediaProxy] public media failed", { key, error: String(error) });
      res.status(502).send("Media belum dapat dimuat.");
    }
  });

  app.get("/api/media/private/*", async (req, res) => {
    const key = readKey(req);
    if (!key) return res.status(404).send("Media tidak ditemukan.");
    try {
      const user = await sdk.authenticateRequest(req);
      if (user.isCron || !(await db.userOwnsPhotoMedia(user.id, `/manus-storage/${key}`))) return res.status(404).send("Media tidak ditemukan.");
      await redirectToStorage(key, res, "private, no-store");
    } catch (error) {
      console.error("[MediaProxy] private media failed", { key, error: String(error) });
      res.status(404).send("Media tidak ditemukan.");
    }
  });
}
