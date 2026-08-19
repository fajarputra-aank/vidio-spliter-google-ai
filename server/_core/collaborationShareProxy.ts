import type { Express, Request, Response } from "express";
import * as db from "../db";
import { hashSecurityToken } from "../localAuth";
import { storageGetSignedUrl } from "../storage";

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
      return res.redirect(307, url);
    } catch (error) {
      console.error("[CollaborationShare] media failed", { error: String(error) });
      return res.status(404).send("Tautan tidak tersedia atau telah berakhir.");
    }
  });
}
