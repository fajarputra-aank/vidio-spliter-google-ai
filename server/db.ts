import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gt, gte, isNull, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { adminAccessAudits, authEmailTokens, authLoginAttempts, brandSettings, communityLikes, communityPosts, communityReports, creditLedger, creditPurchases, InsertPhotoTransform, InsertUser, manualCreditOrders, photoAlbumItems, photoAlbums, photoPromptFavorites, photoTransforms, scheduledJobs, userActiveSessions, userNotificationPreferences, userNotifications, userSecurityEvents, userSessionVersions, users } from "../drizzle/schema";
import type { CreditPackId } from "./creditProducts";
import { ENV } from "./_core/env";
import { dailyQuota, utcDayBounds } from "./photoQuota";
import { nextLoginAttempt } from "./localAuth";
import { shouldCreateArchivedAlbumReminder } from "./archivedAlbumReminderPolicy";
import { getManualTransferNotification } from "./manualTransferNotifications";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });

  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function createLocalUser(input: { name: string; email: string; passwordHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const existing = await getUserByEmail(input.email);
  if (existing) return null;
  const now = new Date();
  const result = await db.insert(users).values({
    openId: `local_${randomUUID()}`,
    name: input.name,
    email: input.email,
    loginMethod: "password",
    passwordHash: input.passwordHash,
    mustChangePassword: false,
    role: "user",
    unlimitedTransforms: false,
    lastSignedIn: now,
  });
  return getUserById(Number(result[0].insertId));
}

export async function updateLocalPassword(userId: number, passwordHash: string, mustChangePassword: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  await db.update(users).set({ passwordHash, loginMethod: "password", mustChangePassword, lastSignedIn: new Date() }).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function touchLocalSignIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

type AuthEmailTokenPurpose = "email_verification" | "password_reset";

export async function createAuthEmailToken(input: { userId: number; purpose: AuthEmailTokenPurpose; tokenHash: string; expiresAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const last = await db.select({ createdAt: authEmailTokens.createdAt }).from(authEmailTokens).where(and(eq(authEmailTokens.userId, input.userId), eq(authEmailTokens.purpose, input.purpose), isNull(authEmailTokens.consumedAt))).orderBy(desc(authEmailTokens.createdAt)).limit(1);
  if (last[0]?.createdAt && Date.now() - last[0].createdAt.getTime() < 60_000) return false;
  await db.delete(authEmailTokens).where(and(eq(authEmailTokens.userId, input.userId), eq(authEmailTokens.purpose, input.purpose), isNull(authEmailTokens.consumedAt)));
  await db.insert(authEmailTokens).values(input);
  return true;
}

export async function consumeAuthEmailToken(tokenHash: string, purpose: AuthEmailTokenPurpose) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const now = new Date();
  const found = await db.select().from(authEmailTokens).where(and(eq(authEmailTokens.tokenHash, tokenHash), eq(authEmailTokens.purpose, purpose), isNull(authEmailTokens.consumedAt), gt(authEmailTokens.expiresAt, now))).limit(1);
  const token = found[0];
  if (!token) return undefined;
  const result = await db.update(authEmailTokens).set({ consumedAt: now }).where(and(eq(authEmailTokens.id, token.id), isNull(authEmailTokens.consumedAt)));
  if (Number(result[0].affectedRows ?? 0) !== 1) return undefined;
  return getUserById(token.userId);
}

export async function markEmailVerified(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function getLoginLock(emailHash: string, now = new Date()) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ lockedUntil: authLoginAttempts.lockedUntil }).from(authLoginAttempts).where(eq(authLoginAttempts.emailHash, emailHash)).limit(1);
  return rows[0]?.lockedUntil && rows[0].lockedUntil > now ? rows[0].lockedUntil : null;
}

export async function recordFailedLogin(emailHash: string, now = new Date()) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(authLoginAttempts).where(eq(authLoginAttempts.emailHash, emailHash)).limit(1);
  const existing = rows[0];
  if (!existing) {
    await db.insert(authLoginAttempts).values({ emailHash, failedCount: 1, windowStartedAt: now, lockedUntil: null });
    return null;
  }
  const next = nextLoginAttempt(existing, now);
  await db.update(authLoginAttempts).set(next).where(eq(authLoginAttempts.id, existing.id));
  return next.lockedUntil;
}

export async function clearFailedLogins(emailHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(authLoginAttempts).where(eq(authLoginAttempts.emailHash, emailHash));
}

export type UserSecurityEventKind = "login" | "password_changed" | "password_reset" | "account_locked" | "all_sessions_signed_out";

export async function recordUserSecurityEvent(userId: number, kind: UserSecurityEventKind) {
  const db = await getDb();
  if (!db) return;
  await db.insert(userSecurityEvents).values({ userId, kind });
}

export async function listUserSecurityEvents(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userSecurityEvents).where(eq(userSecurityEvents.userId, userId)).orderBy(desc(userSecurityEvents.createdAt), desc(userSecurityEvents.id)).limit(50);
}

export async function getUserSessionVersion(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ version: userSessionVersions.version }).from(userSessionVersions).where(eq(userSessionVersions.userId, userId)).limit(1);
  return rows[0]?.version ?? 0;
}

export async function invalidateUserSessions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  await db.update(userActiveSessions).set({ revokedAt: new Date() }).where(and(eq(userActiveSessions.userId, userId), isNull(userActiveSessions.revokedAt)));
  await db.insert(userSessionVersions).values({ userId, version: 1 }).onDuplicateKeyUpdate({ set: { version: sql`${userSessionVersions.version} + 1`, updatedAt: new Date() } });
  return getUserSessionVersion(userId);
}

export async function createUserActiveSession(input: { id: string; userId: number; sessionVersion: number; deviceLabel: string; locationLabel: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(userActiveSessions).values(input);
}

export async function touchUserActiveSession(sessionId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(userActiveSessions).set({ lastSeenAt: new Date() }).where(and(eq(userActiveSessions.id, sessionId), isNull(userActiveSessions.revokedAt)));
}

export async function listUserActiveSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userActiveSessions).where(and(eq(userActiveSessions.userId, userId), isNull(userActiveSessions.revokedAt))).orderBy(desc(userActiveSessions.lastSeenAt), desc(userActiveSessions.createdAt)).limit(20);
}

export async function createPhotoTransform(transform: InsertPhotoTransform) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.insert(photoTransforms).values(transform);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(photoTransforms).where(eq(photoTransforms.id, id)).limit(1);
  return rows[0];
}

export async function completePhotoTransform(id: number, resultUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  await db
    .update(photoTransforms)
    .set({ status: "completed", resultUrl, completedAt: new Date(), errorMessage: null })
    .where(eq(photoTransforms.id, id));
  const rows = await db.select().from(photoTransforms).where(eq(photoTransforms.id, id)).limit(1);
  const transform = rows[0];
  if (transform) {
    const preferences = await db.select({ accountActivity: userNotificationPreferences.accountActivity }).from(userNotificationPreferences).where(eq(userNotificationPreferences.userId, transform.userId)).limit(1);
    if (preferences[0]?.accountActivity ?? true) await db.insert(userNotifications).values({ userId: transform.userId, kind: "account_activity", title: "Transformasi selesai", content: `“${transform.title}” sudah siap ditinjau, diunduh, atau disusun ke album privat.`, relatedPostId: null });
  }
  return rows[0];
}

export async function failPhotoTransform(id: number, message: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(photoTransforms)
    .set({ status: "failed", errorMessage: message.slice(0, 500), completedAt: new Date() })
    .where(eq(photoTransforms.id, id));
}

export async function listPhotoTransforms(userId: number, includeHidden = false) {
  const db = await getDb();
  if (!db) return [];
  const where = includeHidden ? eq(photoTransforms.userId, userId) : and(eq(photoTransforms.userId, userId), eq(photoTransforms.isHidden, false));
  return db
    .select()
    .from(photoTransforms)
    .where(where)
    .orderBy(desc(photoTransforms.createdAt));
}

export async function setPhotoTransformHidden(userId: number, transformId: number, isHidden: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.update(photoTransforms).set({ isHidden }).where(and(eq(photoTransforms.id, transformId), eq(photoTransforms.userId, userId)));
  return { success: Number(result[0].affectedRows ?? 0) > 0, isHidden };
}

export async function getDailyPhotoQuota(userId: number, now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const { start, end } = utcDayBounds(now);
  const result = await db
    .select({ used: count() })
    .from(photoTransforms)
    .where(and(eq(photoTransforms.userId, userId), gte(photoTransforms.createdAt, start), lt(photoTransforms.createdAt, end)));
  return { ...dailyQuota(Number(result[0]?.used ?? 0)), resetsAt: end };
}

export async function getPhotoProfileSummary(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const [quota, totalResult, credits] = await Promise.all([
    getDailyPhotoQuota(userId),
    db.select({ total: count() }).from(photoTransforms).where(eq(photoTransforms.userId, userId)),
    getCreditBalance(userId),
  ]);
  return { quota, totalTransforms: Number(totalResult[0]?.total ?? 0), credits };
}

export async function getCreditBalance(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.select({ balance: sql<number>`coalesce(sum(${creditLedger.credits}), 0)` }).from(creditLedger).where(eq(creditLedger.userId, userId));
  return Number(result[0]?.balance ?? 0);
}

export async function consumePurchasedCredit(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  return db.transaction(async (tx) => {
    const result = await tx.select({ balance: sql<number>`coalesce(sum(${creditLedger.credits}), 0)` }).from(creditLedger).where(eq(creditLedger.userId, userId));
    if (Number(result[0]?.balance ?? 0) < 1) return false;
    await tx.insert(creditLedger).values({ userId, credits: -1, reason: "usage" });
    return true;
  });
}

export async function refundPurchasedCredit(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(creditLedger).values({ userId, credits: 1, reason: "refund" });
}

export async function consumeHdExportCredit(userId: number, transformId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  return db.transaction(async (tx) => {
    const transform = await tx.select({ resultUrl: photoTransforms.resultUrl, status: photoTransforms.status }).from(photoTransforms).where(and(eq(photoTransforms.id, transformId), eq(photoTransforms.userId, userId))).limit(1);
    if (!transform[0]?.resultUrl || transform[0].status !== "completed") return { ok: false as const, reason: "not_ready" as const };
    const balance = await tx.select({ value: sql<number>`coalesce(sum(${creditLedger.credits}), 0)` }).from(creditLedger).where(eq(creditLedger.userId, userId));
    if (Number(balance[0]?.value ?? 0) < 1) return { ok: false as const, reason: "no_credit" as const };
    await tx.insert(creditLedger).values({ userId, credits: -1, reason: "hd_export" });
    return { ok: true as const, resultUrl: transform[0].resultUrl };
  });
}

export async function fulfillCreditPurchase(input: { userId: number; pack: { id: CreditPackId; credits: number }; stripeCheckoutSessionId: string; stripeEventId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  return db.transaction(async (tx) => {
    const duplicate = await tx.select({ id: creditPurchases.id }).from(creditPurchases).where(eq(creditPurchases.stripeEventId, input.stripeEventId)).limit(1);
    if (duplicate[0]) return false;
    await tx.insert(creditPurchases).values({ userId: input.userId, packId: input.pack.id, credits: input.pack.credits, stripeCheckoutSessionId: input.stripeCheckoutSessionId, stripeEventId: input.stripeEventId });
    await tx.insert(creditLedger).values({ userId: input.userId, credits: input.pack.credits, reason: "purchase" });
    return true;
  });
}

export async function listCreditPurchases(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  return db.select().from(creditPurchases).where(eq(creditPurchases.userId, userId)).orderBy(desc(creditPurchases.createdAt));
}

export async function createManualCreditOrder(userId: number, pack: { id: string; credits: number; unitAmount: number }, proofUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.insert(manualCreditOrders).values({ userId, packId: pack.id, credits: pack.credits, amountIdr: pack.unitAmount, proofUrl, status: "pending" });
  const records = await db.select().from(manualCreditOrders).where(eq(manualCreditOrders.id, Number(result[0].insertId))).limit(1);
  return records[0];
}

export async function listManualCreditOrders(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  return db.select().from(manualCreditOrders).where(eq(manualCreditOrders.userId, userId)).orderBy(desc(manualCreditOrders.createdAt));
}

export async function listAdminManualCreditOrders(input?: { search?: string; status?: "all" | "pending" | "approved" | "rejected" }) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const orders = await db.select({ id: manualCreditOrders.id, packId: manualCreditOrders.packId, credits: manualCreditOrders.credits, amountIdr: manualCreditOrders.amountIdr, proofUrl: manualCreditOrders.proofUrl, status: manualCreditOrders.status, createdAt: manualCreditOrders.createdAt, reviewedAt: manualCreditOrders.reviewedAt, userName: users.name, userEmail: users.email }).from(manualCreditOrders).innerJoin(users, eq(manualCreditOrders.userId, users.id)).orderBy(desc(manualCreditOrders.createdAt)).limit(120);
  const keyword = input?.search?.trim().toLowerCase();
  return orders.filter((order) => (input?.status && input.status !== "all" ? order.status === input.status : true) && (keyword ? `${order.userName ?? ""} ${order.userEmail ?? ""} ${order.packId}`.toLowerCase().includes(keyword) : true));
}

export async function reviewManualCreditOrder(orderId: number, reviewerUserId: number, action: "approve" | "reject") {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  return db.transaction(async (tx) => {
    const records = await tx.select().from(manualCreditOrders).where(eq(manualCreditOrders.id, orderId)).limit(1);
    const order = records[0];
    if (!order) throw new Error("Permintaan pembayaran tidak ditemukan.");
    if (order.status !== "pending") return { ...order, changed: false };
    const status = action === "approve" ? "approved" : "rejected";
    await tx.update(manualCreditOrders).set({ status, reviewerUserId, reviewedAt: new Date() }).where(eq(manualCreditOrders.id, orderId));
    if (action === "approve") await tx.insert(creditLedger).values({ userId: order.userId, credits: order.credits, reason: "purchase" });
    const preferences = await tx.select({ accountActivity: userNotificationPreferences.accountActivity }).from(userNotificationPreferences).where(eq(userNotificationPreferences.userId, order.userId)).limit(1);
    if (preferences[0]?.accountActivity ?? true) await tx.insert(userNotifications).values({ userId: order.userId, kind: "account_activity", ...getManualTransferNotification(action, order.credits) });
    return { ...order, status, reviewerUserId, changed: true };
  });
}

export async function publishCommunityPost(userId: number, transformId: number, caption?: string) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const transform = await db.select().from(photoTransforms).where(and(eq(photoTransforms.id, transformId), eq(photoTransforms.userId, userId))).limit(1);
  const record = transform[0];
  if (!record?.resultUrl || record.status !== "completed") throw new Error("Hanya hasil transformasi yang selesai dapat dipublikasikan.");
  const existing = await db.select().from(communityPosts).where(eq(communityPosts.transformId, transformId)).limit(1);
  if (existing[0]) {
    await db.update(communityPosts).set({ caption: caption ?? null, isPublished: true }).where(eq(communityPosts.id, existing[0].id));
    return { ...existing[0], caption: caption ?? null, isPublished: true };
  }
  const inserted = await db.insert(communityPosts).values({ transformId, userId, resultUrl: record.resultUrl, caption: caption ?? null, isPublished: true });
  const postId = Number(inserted[0].insertId);
  const posts = await db.select().from(communityPosts).where(eq(communityPosts.id, postId)).limit(1);
  return posts[0];
}

export async function unpublishCommunityPost(userId: number, postId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  await db.update(communityPosts).set({ isPublished: false }).where(and(eq(communityPosts.id, postId), eq(communityPosts.userId, userId)));
  return { success: true };
}

export async function deleteCommunityPost(userId: number, postId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  return db.transaction(async (tx) => {
    const post = await tx.select({ id: communityPosts.id }).from(communityPosts).where(and(eq(communityPosts.id, postId), eq(communityPosts.userId, userId))).limit(1);
    if (!post[0]) return { success: false };
    await tx.delete(communityLikes).where(eq(communityLikes.postId, postId));
    await tx.delete(communityPosts).where(eq(communityPosts.id, postId));
    return { success: true };
  });
}

export async function moderateDeleteCommunityPost(postId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  return db.transaction(async (tx) => {
    const post = await tx.select({ id: communityPosts.id, userId: communityPosts.userId }).from(communityPosts).where(and(eq(communityPosts.id, postId), eq(communityPosts.isPublished, true))).limit(1);
    if (!post[0]) return { success: false };
    await tx.delete(communityLikes).where(eq(communityLikes.postId, postId));
    await tx.delete(communityPosts).where(eq(communityPosts.id, postId));
    const preferences = await tx.select({ communityModeration: userNotificationPreferences.communityModeration }).from(userNotificationPreferences).where(eq(userNotificationPreferences.userId, post[0].userId)).limit(1);
    if (preferences[0]?.communityModeration ?? true) await tx.insert(userNotifications).values({ userId: post[0].userId, kind: "community_moderation", title: "Karya publik ditindak moderator", content: "Satu karya telah dihapus dari ruang komunitas setelah ditinjau moderator. Riwayat privatmu tetap tersimpan.", relatedPostId: postId });
    return { success: true };
  });
}

export async function listCommunityPosts(viewerId?: number) {
  const db = await getDb();
  if (!db) return [];
  const posts = await db.select({ post: communityPosts, authorName: users.name, recipe: photoTransforms.recipe, style: photoTransforms.style, aspectRatio: photoTransforms.aspectRatio }).from(communityPosts).innerJoin(users, eq(communityPosts.userId, users.id)).innerJoin(photoTransforms, eq(communityPosts.transformId, photoTransforms.id)).where(eq(communityPosts.isPublished, true)).orderBy(desc(communityPosts.createdAt));
  return Promise.all(posts.map(async ({ post, authorName, recipe, style, aspectRatio }) => {
    const likeCount = await db.select({ total: count() }).from(communityLikes).where(eq(communityLikes.postId, post.id));
    const viewerLike = viewerId ? await db.select({ id: communityLikes.id }).from(communityLikes).where(and(eq(communityLikes.postId, post.id), eq(communityLikes.userId, viewerId))).limit(1) : [];
    return { ...post, authorName: authorName || "Kreator", recipe, style, aspectRatio, likes: Number(likeCount[0]?.total ?? 0), likedByViewer: Boolean(viewerLike[0]) };
  }));
}

export async function createCommunityReport(reporterUserId: number, input: { postId: number; reason: "inappropriate" | "spam" | "copyright" | "other"; details?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const post = await db.select({ id: communityPosts.id, userId: communityPosts.userId }).from(communityPosts).where(and(eq(communityPosts.id, input.postId), eq(communityPosts.isPublished, true))).limit(1);
  if (!post[0]) throw new Error("Karya publik tidak ditemukan.");
  if (post[0].userId === reporterUserId) throw new Error("Kamu tidak dapat melaporkan karya sendiri.");
  const existing = await db.select({ id: communityReports.id }).from(communityReports).where(and(eq(communityReports.postId, input.postId), eq(communityReports.reporterUserId, reporterUserId))).limit(1);
  if (existing[0]) throw new Error("Kamu sudah melaporkan karya ini.");
  await db.insert(communityReports).values({ postId: input.postId, reporterUserId, reason: input.reason, details: input.details?.trim() || null });
  return { success: true };
}

export async function listAdminCommunityReports() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: communityReports.id, reason: communityReports.reason, details: communityReports.details, status: communityReports.status, createdAt: communityReports.createdAt, postId: communityReports.postId, resultUrl: communityPosts.resultUrl, caption: communityPosts.caption, authorName: users.name }).from(communityReports).innerJoin(communityPosts, eq(communityReports.postId, communityPosts.id)).innerJoin(users, eq(communityPosts.userId, users.id)).where(eq(communityReports.status, "open")).orderBy(desc(communityReports.createdAt));
}

export async function resolveCommunityReport(reportId: number, action: "dismiss" | "remove_public") {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  return db.transaction(async (tx) => {
    const report = await tx.select({ id: communityReports.id, postId: communityReports.postId }).from(communityReports).where(and(eq(communityReports.id, reportId), eq(communityReports.status, "open"))).limit(1);
    if (!report[0]) return { success: false };
    if (action === "remove_public") {
      const post = await tx.select({ userId: communityPosts.userId }).from(communityPosts).where(eq(communityPosts.id, report[0].postId)).limit(1);
      await tx.delete(communityLikes).where(eq(communityLikes.postId, report[0].postId));
      await tx.delete(communityPosts).where(eq(communityPosts.id, report[0].postId));
      await tx.update(communityReports).set({ status: "actioned", reviewedAt: new Date() }).where(eq(communityReports.id, reportId));
      if (post[0]) {
        const preferences = await tx.select({ communityModeration: userNotificationPreferences.communityModeration }).from(userNotificationPreferences).where(eq(userNotificationPreferences.userId, post[0].userId)).limit(1);
        if (preferences[0]?.communityModeration ?? true) await tx.insert(userNotifications).values({ userId: post[0].userId, kind: "community_moderation", title: "Laporan komunitas ditindaklanjuti", content: "Satu karya telah dihapus dari ruang komunitas setelah laporan ditinjau. Riwayat privatmu tetap tersimpan.", relatedPostId: report[0].postId });
      }
    } else {
      await tx.update(communityReports).set({ status: "dismissed", reviewedAt: new Date() }).where(eq(communityReports.id, reportId));
    }
    return { success: true };
  });
}

export async function listPhotoAlbums(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const albums = await db.select().from(photoAlbums).where(eq(photoAlbums.userId, userId)).orderBy(desc(photoAlbums.updatedAt));
  return Promise.all(albums.map(async (album) => {
    const [total, cover, items] = await Promise.all([
      db.select({ count: count() }).from(photoAlbumItems).where(eq(photoAlbumItems.albumId, album.id)),
      db.select({ resultUrl: photoTransforms.resultUrl }).from(photoAlbumItems).innerJoin(photoTransforms, eq(photoAlbumItems.transformId, photoTransforms.id)).where(eq(photoAlbumItems.albumId, album.id)).orderBy(desc(photoAlbumItems.createdAt)).limit(1),
      db.select({ transformId: photoTransforms.id, title: photoTransforms.title, resultUrl: photoTransforms.resultUrl, style: photoTransforms.style, aspectRatio: photoTransforms.aspectRatio }).from(photoAlbumItems).innerJoin(photoTransforms, eq(photoAlbumItems.transformId, photoTransforms.id)).where(eq(photoAlbumItems.albumId, album.id)).orderBy(desc(photoAlbumItems.createdAt)),
    ]);
    return { ...album, itemCount: Number(total[0]?.count ?? 0), coverUrl: cover[0]?.resultUrl ?? null, items };
  }));
}

export async function createPhotoAlbum(userId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const inserted = await db.insert(photoAlbums).values({ userId, name });
  const records = await db.select().from(photoAlbums).where(eq(photoAlbums.id, Number(inserted[0].insertId))).limit(1);
  return records[0];
}

export async function renamePhotoAlbum(userId: number, albumId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const album = await db.select({ id: photoAlbums.id }).from(photoAlbums).where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.userId, userId))).limit(1);
  if (!album[0]) return { success: false };
  await db.update(photoAlbums).set({ name }).where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.userId, userId)));
  return { success: true };
}

export async function setPhotoAlbumArchived(userId: number, albumId: number, isArchived: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const album = await db.select({ id: photoAlbums.id }).from(photoAlbums).where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.userId, userId))).limit(1);
  if (!album[0]) return { success: false };
  await db.update(photoAlbums).set({ isArchived, archivedAt: isArchived ? new Date() : null }).where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.userId, userId)));
  return { success: true, isArchived };
}

export async function touchPhotoAlbum(userId: number, albumId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.update(photoAlbums).set({ lastAccessedAt: new Date() }).where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.userId, userId)));
  return { success: Number(result[0].affectedRows ?? 0) > 0 };
}

export async function listArchivedPhotoAlbums(userId: number) {
  const albums = await listPhotoAlbums(userId);
  return albums.filter((album) => album.isArchived);
}

export async function deletePhotoAlbum(userId: number, albumId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  return db.transaction(async (tx) => {
    const album = await tx.select({ id: photoAlbums.id }).from(photoAlbums).where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.userId, userId))).limit(1);
    if (!album[0]) return { success: false };
    await tx.delete(photoAlbumItems).where(eq(photoAlbumItems.albumId, albumId));
    await tx.delete(photoAlbums).where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.userId, userId)));
    return { success: true };
  });
}

export async function addTransformToAlbum(userId: number, albumId: number, transformId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const [album, transform] = await Promise.all([
    db.select({ id: photoAlbums.id }).from(photoAlbums).where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.userId, userId))).limit(1),
    db.select({ id: photoTransforms.id }).from(photoTransforms).where(and(eq(photoTransforms.id, transformId), eq(photoTransforms.userId, userId))).limit(1),
  ]);
  if (!album[0] || !transform[0]) return { success: false };
  const existing = await db.select({ id: photoAlbumItems.id }).from(photoAlbumItems).where(and(eq(photoAlbumItems.albumId, albumId), eq(photoAlbumItems.transformId, transformId))).limit(1);
  if (!existing[0]) await db.insert(photoAlbumItems).values({ albumId, transformId });
  return { success: true };
}

export async function addTransformsToAlbum(userId: number, albumId: number, transformIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const uniqueIds = Array.from(new Set(transformIds));
  if (!uniqueIds.length) return { success: false, added: 0 };
  return db.transaction(async (tx) => {
    const album = await tx.select({ id: photoAlbums.id }).from(photoAlbums).where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.userId, userId))).limit(1);
    if (!album[0]) return { success: false, added: 0 };
    const transforms = await Promise.all(uniqueIds.map((transformId) => tx.select({ id: photoTransforms.id }).from(photoTransforms).where(and(eq(photoTransforms.id, transformId), eq(photoTransforms.userId, userId))).limit(1)));
    if (transforms.some((transform) => !transform[0])) return { success: false, added: 0 };
    const existing = await Promise.all(uniqueIds.map((transformId) => tx.select({ id: photoAlbumItems.id }).from(photoAlbumItems).where(and(eq(photoAlbumItems.albumId, albumId), eq(photoAlbumItems.transformId, transformId))).limit(1)));
    const newItems = uniqueIds.filter((_, index) => !existing[index][0]).map((transformId) => ({ albumId, transformId }));
    if (newItems.length) await tx.insert(photoAlbumItems).values(newItems);
    return { success: true, added: newItems.length };
  });
}

export async function removeTransformFromAlbum(userId: number, albumId: number, transformId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const album = await db.select({ id: photoAlbums.id }).from(photoAlbums).where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.userId, userId))).limit(1);
  if (!album[0]) return { success: false };
  await db.delete(photoAlbumItems).where(and(eq(photoAlbumItems.albumId, albumId), eq(photoAlbumItems.transformId, transformId)));
  return { success: true };
}

export async function listPhotoPromptFavorites(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(photoPromptFavorites).where(eq(photoPromptFavorites.userId, userId)).orderBy(desc(photoPromptFavorites.createdAt)).limit(12);
}

export async function createPhotoPromptFavorite(userId: number, instruction: string) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const clean = instruction.trim();
  const existing = await db.select().from(photoPromptFavorites).where(and(eq(photoPromptFavorites.userId, userId), eq(photoPromptFavorites.instruction, clean))).limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db.insert(photoPromptFavorites).values({ userId, instruction: clean });
  const records = await db.select().from(photoPromptFavorites).where(eq(photoPromptFavorites.id, Number(inserted[0].insertId))).limit(1);
  return records[0];
}

export async function deletePhotoPromptFavorite(userId: number, favoriteId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.delete(photoPromptFavorites).where(and(eq(photoPromptFavorites.id, favoriteId), eq(photoPromptFavorites.userId, userId)));
  return { success: Number(result[0].affectedRows ?? 0) > 0 };
}

export async function listUserNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userNotifications).where(eq(userNotifications.userId, userId)).orderBy(desc(userNotifications.createdAt)).limit(24);
}

export async function getUserNotificationDetail(userId: number, notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const notification = await db.select().from(userNotifications).where(and(eq(userNotifications.id, notificationId), eq(userNotifications.userId, userId))).limit(1);
  if (!notification[0]) return null;
  if (notification[0].kind !== "community_moderation" || !notification[0].relatedPostId) return { notification: notification[0], moderation: null };
  const review = await db.select({ status: communityReports.status, createdAt: communityReports.createdAt, reviewedAt: communityReports.reviewedAt }).from(communityReports).where(eq(communityReports.postId, notification[0].relatedPostId)).orderBy(desc(communityReports.reviewedAt)).limit(1);
  return {
    notification: notification[0],
    moderation: {
      action: "Publikasi komunitas dihapus; frame privat tetap tersimpan.",
      reviewedAt: review[0]?.reviewedAt ?? notification[0].createdAt,
      reviewStatus: review[0]?.status ?? "actioned",
      reportReceivedAt: review[0]?.createdAt ?? null,
    },
  };
}

export async function getUserNotificationPreferences(userId: number) {
  const db = await getDb();
  if (!db) return { communityModeration: true, accountActivity: true, productUpdates: false };
  const preferences = await db.select().from(userNotificationPreferences).where(eq(userNotificationPreferences.userId, userId)).limit(1);
  return preferences[0] ?? { communityModeration: true, accountActivity: true, productUpdates: false };
}

export async function upsertScheduledJob(name: string, taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  await db.insert(scheduledJobs).values({ name, taskUid }).onDuplicateKeyUpdate({ set: { taskUid } });
}

export async function getScheduledJobByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const jobs = await db.select().from(scheduledJobs).where(eq(scheduledJobs.taskUid, taskUid)).limit(1);
  return jobs[0];
}

export async function runArchivedAlbumReminderSweep(now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  return db.transaction(async (tx) => {
    const archivedAlbums = await tx.select().from(photoAlbums).where(eq(photoAlbums.isArchived, true));
    let reminded = 0;
    for (const album of archivedAlbums) {
      const preferences = await tx.select({ accountActivity: userNotificationPreferences.accountActivity }).from(userNotificationPreferences).where(eq(userNotificationPreferences.userId, album.userId)).limit(1);
      if (!shouldCreateArchivedAlbumReminder(album, preferences[0]?.accountActivity ?? true, now)) continue;
      await tx.insert(userNotifications).values({ userId: album.userId, kind: "album_inactivity", title: "Album terarsip belum dibuka", content: `Album “${album.name}” belum dibuka selama lebih dari enam bulan. Frame di dalamnya tetap aman.`, relatedAlbumId: album.id });
      await tx.update(photoAlbums).set({ lastInactivityReminderAt: now }).where(eq(photoAlbums.id, album.id));
      reminded += 1;
    }
    return { reminded, checked: archivedAlbums.length };
  });
}

export async function updateUserNotificationPreferences(userId: number, input: { communityModeration: boolean; accountActivity: boolean; productUpdates: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  await db.insert(userNotificationPreferences).values({ userId, ...input }).onDuplicateKeyUpdate({ set: input });
  return getUserNotificationPreferences(userId);
}

export async function markUserNotificationRead(userId: number, notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const notification = await db.select({ id: userNotifications.id }).from(userNotifications).where(and(eq(userNotifications.id, notificationId), eq(userNotifications.userId, userId))).limit(1);
  if (!notification[0]) return { success: false };
  await db.update(userNotifications).set({ isRead: true }).where(and(eq(userNotifications.id, notificationId), eq(userNotifications.userId, userId)));
  return { success: true };
}

export async function markAllUserNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.update(userNotifications).set({ isRead: true }).where(and(eq(userNotifications.userId, userId), eq(userNotifications.isRead, false)));
  return { success: true, marked: Number(result[0].affectedRows ?? 0) };
}

export async function toggleCommunityLike(userId: number, postId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const post = await db.select({ id: communityPosts.id }).from(communityPosts).where(and(eq(communityPosts.id, postId), eq(communityPosts.isPublished, true))).limit(1);
  if (!post[0]) throw new Error("Karya komunitas tidak ditemukan.");
  const existing = await db.select({ id: communityLikes.id }).from(communityLikes).where(and(eq(communityLikes.postId, postId), eq(communityLikes.userId, userId))).limit(1);
  if (existing[0]) await db.delete(communityLikes).where(eq(communityLikes.id, existing[0].id));
  else await db.insert(communityLikes).values({ postId, userId });
  const result = await db.select({ total: count() }).from(communityLikes).where(eq(communityLikes.postId, postId));
  return { liked: !existing[0], likes: Number(result[0]?.total ?? 0) };
}

export async function getAdminDashboard() {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const { start, end } = utcDayBounds(new Date());
  const [userCount, activity, purchaseCount, transforms, recentTransforms, recentPurchases] = await Promise.all([
    db.select({ total: count() }).from(users),
    db.select({ activeUsers: sql<number>`count(distinct ${photoTransforms.userId})`, transforms: count(), completed: sql<number>`coalesce(sum(case when ${photoTransforms.status} = 'completed' then 1 else 0 end), 0)`, failed: sql<number>`coalesce(sum(case when ${photoTransforms.status} = 'failed' then 1 else 0 end), 0)` }).from(photoTransforms).where(and(gte(photoTransforms.createdAt, start), lt(photoTransforms.createdAt, end))),
    db.select({ total: count() }).from(creditPurchases),
    db.select({ total: count() }).from(photoTransforms),
    db.select({ id: photoTransforms.id, recipe: photoTransforms.recipe, style: photoTransforms.style, status: photoTransforms.status, createdAt: photoTransforms.createdAt, userName: users.name }).from(photoTransforms).innerJoin(users, eq(photoTransforms.userId, users.id)).orderBy(desc(photoTransforms.createdAt)).limit(12),
    db.select({ id: creditPurchases.id, packId: creditPurchases.packId, credits: creditPurchases.credits, createdAt: creditPurchases.createdAt, userName: users.name, userEmail: users.email }).from(creditPurchases).innerJoin(users, eq(creditPurchases.userId, users.id)).orderBy(desc(creditPurchases.createdAt)).limit(12),
  ]);
  return {
    overview: {
      totalUsers: Number(userCount[0]?.total ?? 0),
      totalTransforms: Number(transforms[0]?.total ?? 0),
      activeUsersToday: Number(activity[0]?.activeUsers ?? 0),
      transformsToday: Number(activity[0]?.transforms ?? 0),
      completedToday: Number(activity[0]?.completed ?? 0),
      failedToday: Number(activity[0]?.failed ?? 0),
      completedPurchases: Number(purchaseCount[0]?.total ?? 0),
    },
    recentTransforms,
    recentPurchases,
    dayStart: start,
  };
}

const defaultBrand = {
  logoUrl: "/manus-storage/fajar-nugroho-logo_8fa9d033.png",
  iconUrl: "/manus-storage/fnp-brand-icon_17f8efb6.png",
  updatedByUserId: null,
  updatedAt: null as Date | null,
};

export async function getBrandSettings() {
  const db = await getDb();
  if (!db) return defaultBrand;
  const records = await db.select().from(brandSettings).where(eq(brandSettings.id, 1)).limit(1);
  return records[0] ?? defaultBrand;
}

export async function updateBrandSettings(actorUserId: number, input: { logoUrl?: string; iconUrl?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const current = await getBrandSettings();
  const next = { logoUrl: input.logoUrl ?? current.logoUrl, iconUrl: input.iconUrl ?? current.iconUrl };
  await db.insert(brandSettings).values({ id: 1, ...next, updatedByUserId: actorUserId }).onDuplicateKeyUpdate({ set: { ...next, updatedByUserId: actorUserId } });
  return getBrandSettings();
}

async function writeAdminAccessAudit(input: { actorUserId: number; targetUserId: number; action: "role_changed" | "unlimited_access_changed"; previousRole: "user" | "admin"; nextRole: "user" | "admin"; previousUnlimitedTransforms: boolean; nextUnlimitedTransforms: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  await db.insert(adminAccessAudits).values(input);
}

export async function listAdminAccessAudits() {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const records = await db.select().from(adminAccessAudits).orderBy(desc(adminAccessAudits.createdAt)).limit(48);
  const identities = new Map<number, { name: string | null; email: string | null }>();
  await Promise.all(Array.from(new Set(records.flatMap((record) => [record.actorUserId, record.targetUserId]))).map(async (userId) => {
    const user = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (user[0]) identities.set(userId, user[0]);
  }));
  return records.map((record) => ({ ...record, actorName: identities.get(record.actorUserId)?.name ?? "Administrator", actorEmail: identities.get(record.actorUserId)?.email ?? null, targetName: identities.get(record.targetUserId)?.name ?? "Pengguna", targetEmail: identities.get(record.targetUserId)?.email ?? null }));
}

export async function listUnlimitedTransformUsers(input: { search?: string; access?: "all" | "unlimited" | "standard" } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const search = input.search?.trim().toLowerCase();
  const conditions = [eq(users.role, "user")];
  if (input.access === "unlimited") conditions.push(eq(users.unlimitedTransforms, true));
  if (input.access === "standard") conditions.push(eq(users.unlimitedTransforms, false));
  if (search) conditions.push(sql`lower(${users.email}) like ${`%${search}%`}`);
  return db.select({ id: users.id, name: users.name, email: users.email, unlimitedTransforms: users.unlimitedTransforms, createdAt: users.createdAt }).from(users).where(and(...conditions)).orderBy(desc(users.updatedAt)).limit(48);
}

export async function setUnlimitedTransformsByEmail(email: string, enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const normalizedEmail = email.trim().toLowerCase();
  const records = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, unlimitedTransforms: users.unlimitedTransforms }).from(users).where(sql`lower(${users.email}) = ${normalizedEmail}`).limit(1);
  const user = records[0];
  if (!user) throw new Error("Akun belum ditemukan. Pengguna harus masuk setidaknya sekali terlebih dahulu.");
  if (user.role === "admin") return { ...user, unlimitedTransforms: true, changed: false, isAdmin: true };
  await db.update(users).set({ unlimitedTransforms: enabled }).where(eq(users.id, user.id));
  return { ...user, unlimitedTransforms: enabled, changed: user.unlimitedTransforms !== enabled, isAdmin: false };
}

export async function setUnlimitedTransformsByAdmin(actorUserId: number, email: string, enabled: boolean) {
  const result = await setUnlimitedTransformsByEmail(email, enabled);
  if (result.changed) await writeAdminAccessAudit({ actorUserId, targetUserId: result.id, action: "unlimited_access_changed", previousRole: result.role, nextRole: result.role, previousUnlimitedTransforms: !enabled, nextUnlimitedTransforms: enabled });
  return result;
}

export async function setUserRoleByEmail(actorUserId: number, email: string, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const normalizedEmail = email.trim().toLowerCase();
  const records = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, unlimitedTransforms: users.unlimitedTransforms }).from(users).where(sql`lower(${users.email}) = ${normalizedEmail}`).limit(1);
  const user = records[0];
  if (!user) throw new Error("Akun belum ditemukan. Pengguna harus masuk setidaknya sekali terlebih dahulu.");
  if (user.id === actorUserId) throw new Error("Untuk keamanan, ubah peran akunmu melalui administrator lain.");
  const nextUnlimitedTransforms = role === "admin" ? true : user.unlimitedTransforms;
  if (user.role === role && user.unlimitedTransforms === nextUnlimitedTransforms) return { ...user, changed: false };
  await db.update(users).set({ role, unlimitedTransforms: nextUnlimitedTransforms }).where(eq(users.id, user.id));
  await writeAdminAccessAudit({ actorUserId, targetUserId: user.id, action: "role_changed", previousRole: user.role, nextRole: role, previousUnlimitedTransforms: user.unlimitedTransforms, nextUnlimitedTransforms });
  return { ...user, role, unlimitedTransforms: nextUnlimitedTransforms, changed: true };
}
