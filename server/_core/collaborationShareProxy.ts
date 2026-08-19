import type { Express, Request, Response } from "express";
import * as db from "../db";
import { hashSecurityToken } from "../localAuth";
import { storageGetSignedUrl } from "../storage";
import sharp, { type OverlayOptions } from "sharp";

function escapeSvg(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" })[character] || character);
}

export function registerCollaborationShareProxy(app: Express) {
  app.get("/api/collaboration-share/:token", async (req: Request, res: Response) => {
    const token = String(req.params.token || "");
    if (!/^[A-Za-z0-9_-]{32,100}$/.test(token)) return res.status(404).send("Tautan tidak tersedia.");
    try {
      const shared = await db.getPhotoCollaborationShareByTokenHash(hashSecurityToken(token));
      const key = shared?.resultUrl?.replace(/^\/manus-storage\//, "");
      if (!shared || !key || key === shared.resultUrl) return res.status(404).send("Tautan tidak tersedia atau telah berakhir.");
      const url = await storageGetSignedUrl(key);
      res.set("Cache-Control", "no-store, max-age=0");
      await db.recordPhotoCollaborationShareAccess(shared.shareLinkId);
      if (!shared.watermarkText && !shared.logoStorageKey) return res.redirect(307, url);
      const upstream = await fetch(url);
      if (!upstream.ok) throw new Error(`Shared image fetch failed (${upstream.status})`);
      const source = Buffer.from(await upstream.arrayBuffer()); const image = sharp(source); const metadata = await image.metadata(); const width = metadata.width || 1600; const height = metadata.height || 1200; const fontSize = Math.max(18, Math.round(width * 0.025)); const margin = Math.max(18, Math.round(width * 0.025)); const text = escapeSvg(shared.watermarkText ?? "");
      const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="${margin}" y="${height - fontSize * 2 - margin}" width="${Math.min(width - margin * 2, text.length * fontSize * 0.72 + fontSize)}" height="${fontSize * 1.7}" rx="${Math.round(fontSize * .2)}" fill="#1b1b18" fill-opacity=".76"/><text x="${margin + fontSize * .35}" y="${height - margin - fontSize * .45}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#f6f1e7">${text}</text></svg>`;
      const composites: OverlayOptions[] = shared.watermarkText ? [{ input: Buffer.from(svg), top: 0, left: 0 }] : [];
      if (shared.logoStorageKey) { const logoUrl = await storageGetSignedUrl(shared.logoStorageKey); const logoResponse = await fetch(logoUrl); if (logoResponse.ok) { const logo = await sharp(Buffer.from(await logoResponse.arrayBuffer())).resize(Math.round(width * .18), Math.round(height * .18), { fit: "inside", withoutEnlargement: true }).png().toBuffer(); composites.push({ input: logo, gravity: "southeast" }); } }
      const watermarked = await image.composite(composites).png().toBuffer();
      return res.type("image/png").send(watermarked);
    } catch (error) {
      console.error("[CollaborationShare] media failed", { error: String(error) });
      return res.status(404).send("Tautan tidak tersedia atau telah berakhir.");
    }
  });
}
