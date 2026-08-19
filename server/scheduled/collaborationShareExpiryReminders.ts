import type { Request, Response } from "express";
import * as db from "../db";
import { sdk } from "../_core/sdk";

const JOB_NAME = "collaboration-share-expiry-reminders";

export async function handleCollaborationShareExpiryReminders(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const job = await db.getScheduledJobByTaskUid(user.taskUid);
    if (!job || job.name !== JOB_NAME) return res.json({ ok: true, skipped: "orphan" });
    return res.json({ ok: true, ...(await db.runPhotoCollaborationShareExpiryReminderSweep()) });
  } catch (error) {
    return res.status(500).json({ error: String(error), context: { path: req.path }, timestamp: new Date().toISOString() });
  }
}
