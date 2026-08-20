import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { trpcNonJsonMetricBuckets } from "../../drizzle/schema";
import { getDb } from "../db";

const operationGroups = new Set(["auth", "brand", "other"]);
const responseKinds = new Set(["html", "text", "empty", "other"]);

/** Accept only anonymous categorical telemetry from the transport fallback. */
export async function handleTrpcNonJsonMetric(req: Request, res: Response) {
  const body = req.body as { operationGroup?: unknown; responseKind?: unknown; statusClass?: unknown } | undefined;
  const operationGroup = typeof body?.operationGroup === "string" && operationGroups.has(body.operationGroup) ? body.operationGroup as "auth" | "brand" | "other" : null;
  const responseKind = typeof body?.responseKind === "string" && responseKinds.has(body.responseKind) ? body.responseKind as "html" | "text" | "empty" | "other" : null;
  const statusClass = typeof body?.statusClass === "number" && Number.isInteger(body.statusClass) && body.statusClass >= 0 && body.statusClass <= 5 ? body.statusClass : null;
  if (!operationGroup || !responseKind || statusClass === null) return res.status(204).end();
  try {
    const db = await getDb();
    if (db) {
      const observedAt = new Date(); const hourStartedAt = new Date(observedAt); hourStartedAt.setUTCMinutes(0, 0, 0);
      await db.insert(trpcNonJsonMetricBuckets).values({ hourStartedAt, operationGroup, responseKind, statusClass, occurrences: 1, lastObservedAt: observedAt }).onDuplicateKeyUpdate({ set: { occurrences: sql`${trpcNonJsonMetricBuckets.occurrences} + 1`, lastObservedAt: observedAt } });
    }
  } catch (error) {
    console.warn("[tRPC transport metric] aggregate write failed", error instanceof Error ? error.message : "unknown error");
  }
  return res.status(204).end();
}
