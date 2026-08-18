import type { Request, Response } from "express";
import { sendSecuritySummaryEmail } from "../accountEmails";
import * as db from "../db";
import { sdk } from "../_core/sdk";
import { getSecuritySummaryPeriodKey } from "../securitySummarySchedule";

const JOB_NAME = "security-summary-sweep";

export async function handleSecuritySummaries(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const job = await db.getScheduledJobByTaskUid(user.taskUid);
    if (!job || job.name !== JOB_NAME) return res.json({ ok: true, skipped: "orphan" });
    const now = new Date();
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recipients = await db.listAutomaticSecuritySummaryRecipients();
    let sent = 0;
    let skipped = 0;
    for (const recipient of recipients) {
      const periodKey = getSecuritySummaryPeriodKey(recipient.frequency, now);
      if (!periodKey || !(await db.claimSecuritySummaryPeriod(recipient.userId, periodKey, now))) { skipped += 1; continue; }
      try {
        const events = await db.listRecentUserSecurityEvents(recipient.userId, since);
        await sendSecuritySummaryEmail({ email: recipient.email }, events);
        sent += 1;
      } catch (error) {
        console.error("[SecuritySummary] Email delivery failed", { userId: recipient.userId, error: String(error) });
      }
    }
    return res.json({ ok: true, sent, skipped, checked: recipients.length });
  } catch (error) {
    return res.status(500).json({ error: String(error), context: { path: req.path }, timestamp: new Date().toISOString() });
  }
}
