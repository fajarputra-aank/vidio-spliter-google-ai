import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { photoCollaborationBrandLogos, photoCollaborationInvites, photoCollaborationLayoutPresets, photoCollaborationShareLinks } from "../drizzle/schema";
import { adminAccessAudits, authEmailTokens, authLoginAttempts, brandSettings, communityLikes, communityPosts, communityReports, creditLedger, creditPurchases, globalWatermarkPresetAudits, globalWatermarkPresets, InsertPhotoTransform, InsertUser, manualCreditOrders, photoAlbumItems, photoAlbums, photoCaptionTemplates, photoPromptFavorites, photoRecipeFavorites, photoShareEvents, photoTransforms, photoWatermarkPresets, scheduledJobs, seasonalRecipeCollections, userActiveSessions, userNotificationPreferences, userNotifications, userSecurityEvents, userSecuritySummaryPreferences, userSessionVersions, users } from "../drizzle/schema";
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

export type UserSecurityEventKind = "login" | "password_changed" | "password_reset" | "account_locked" | "all_sessions_signed_out" | "session_signed_out" | "new_device_login";

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

export async function listRecentUserSecurityEvents(userId: number, since: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userSecurityEvents).where(and(eq(userSecurityEvents.userId, userId), gte(userSecurityEvents.createdAt, since))).orderBy(desc(userSecurityEvents.createdAt), desc(userSecurityEvents.id)).limit(100);
}

export async function createAccountActivityNotification(userId: number, title: string, content: string) {
  const db = await getDb();
  if (!db) return false;
  const preferences = await db.select({ accountActivity: userNotificationPreferences.accountActivity }).from(userNotificationPreferences).where(eq(userNotificationPreferences.userId, userId)).limit(1);
  if (!(preferences[0]?.accountActivity ?? true)) return false;
  await db.insert(userNotifications).values({ userId, kind: "account_activity", title, content, relatedPostId: null });
  return true;
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

export async function hasKnownActiveSession(userId: number, deviceLabel: string, locationLabel: string) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: userActiveSessions.id }).from(userActiveSessions).where(and(eq(userActiveSessions.userId, userId), eq(userActiveSessions.deviceLabel, deviceLabel), eq(userActiveSessions.locationLabel, locationLabel))).limit(1);
  return rows.length > 0;
}

export async function isUserActiveSession(userId: number, sessionId: string, sessionVersion: number) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: userActiveSessions.id }).from(userActiveSessions).where(and(eq(userActiveSessions.id, sessionId), eq(userActiveSessions.userId, userId), eq(userActiveSessions.sessionVersion, sessionVersion), isNull(userActiveSessions.revokedAt))).limit(1);
  return rows.length > 0;
}

export async function revokeUserActiveSession(userId: number, sessionId: string) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(userActiveSessions).set({ revokedAt: new Date() }).where(and(eq(userActiveSessions.id, sessionId), eq(userActiveSessions.userId, userId), isNull(userActiveSessions.revokedAt)));
  return Number(result[0].affectedRows) > 0;
}

export async function createPhotoTransform(transform: InsertPhotoTransform) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.insert(photoTransforms).values(transform);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(photoTransforms).where(eq(photoTransforms.id, id)).limit(1);
  return rows[0];
}

export async function createPhotoCollaborationInvite(inviterUserId: number, inviteeEmail: string, input: { template: string; aspectRatio: string; style: string; note?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const invitee = await getUserByEmail(inviteeEmail);
  if (!invitee?.email) throw new Error("Akun penerima undangan tidak ditemukan.");
  if (invitee.id === inviterUserId) throw new Error("Kamu tidak dapat mengundang akunmu sendiri.");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const result = await db.insert(photoCollaborationInvites).values({ inviterUserId, inviteeUserId: invitee.id, template: input.template, aspectRatio: input.aspectRatio, style: input.style, note: input.note?.trim() || null, expiresAt });
  const id = Number(result[0].insertId); const rows = await db.select().from(photoCollaborationInvites).where(eq(photoCollaborationInvites.id, id)).limit(1);
  await createAccountActivityNotification(invitee.id, "Undangan Kolaborasi Foto", "Ada undangan kolaborasi privat yang menunggu persetujuanmu. Tidak ada foto atau hasil yang dibagikan sampai kamu menyetujui.");
  return rows[0];
}

export async function listPhotoCollaborationInvites(userId: number) {
  const db = await getDb();
  if (!db) return { incoming: [], outgoing: [] };
  const [incoming, outgoing] = await Promise.all([
    db.select({ id: photoCollaborationInvites.id, template: photoCollaborationInvites.template, aspectRatio: photoCollaborationInvites.aspectRatio, style: photoCollaborationInvites.style, note: photoCollaborationInvites.note, status: photoCollaborationInvites.status, expiresAt: photoCollaborationInvites.expiresAt, createdAt: photoCollaborationInvites.createdAt, respondedAt: photoCollaborationInvites.respondedAt, inviterName: users.name, inviterEmail: users.email }).from(photoCollaborationInvites).leftJoin(users, eq(users.id, photoCollaborationInvites.inviterUserId)).where(eq(photoCollaborationInvites.inviteeUserId, userId)).orderBy(desc(photoCollaborationInvites.createdAt)).limit(30),
    db.select({ id: photoCollaborationInvites.id, template: photoCollaborationInvites.template, aspectRatio: photoCollaborationInvites.aspectRatio, style: photoCollaborationInvites.style, note: photoCollaborationInvites.note, status: photoCollaborationInvites.status, expiresAt: photoCollaborationInvites.expiresAt, createdAt: photoCollaborationInvites.createdAt, respondedAt: photoCollaborationInvites.respondedAt, inviteeName: users.name, inviteeEmail: users.email }).from(photoCollaborationInvites).leftJoin(users, eq(users.id, photoCollaborationInvites.inviteeUserId)).where(eq(photoCollaborationInvites.inviterUserId, userId)).orderBy(desc(photoCollaborationInvites.createdAt)).limit(30),
  ]);
  return { incoming, outgoing };
}

export async function respondPhotoCollaborationInvite(inviteeUserId: number, inviteId: number, action: "accepted" | "declined") {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const current = await db.select().from(photoCollaborationInvites).where(and(eq(photoCollaborationInvites.id, inviteId), eq(photoCollaborationInvites.inviteeUserId, inviteeUserId), eq(photoCollaborationInvites.status, "pending"), gt(photoCollaborationInvites.expiresAt, new Date()))).limit(1);
  if (!current[0]) throw new Error("Undangan tidak tersedia atau sudah berakhir.");
  await db.update(photoCollaborationInvites).set({ status: action, respondedAt: new Date() }).where(eq(photoCollaborationInvites.id, inviteId));
  await createAccountActivityNotification(current[0].inviterUserId, action === "accepted" ? "Kolaborasi disetujui" : "Kolaborasi ditolak", action === "accepted" ? "Undangan Kolaborasi Foto telah disetujui. Kamu dapat memprosesnya sebelum masa persetujuan berakhir." : "Undangan Kolaborasi Foto ditolak. Tidak ada foto atau hasil yang dibagikan.");
  return { success: true, status: action };
}

export async function getAcceptedPhotoCollaborationInvite(inviterUserId: number, inviteId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(photoCollaborationInvites).where(and(eq(photoCollaborationInvites.id, inviteId), eq(photoCollaborationInvites.inviterUserId, inviterUserId), eq(photoCollaborationInvites.status, "accepted"), gt(photoCollaborationInvites.expiresAt, new Date()))).limit(1);
  return rows[0] ?? null;
}

export async function markPhotoCollaborationInviteUsed(inviterUserId: number, inviteId: number, transformId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  await db.update(photoCollaborationInvites).set({ status: "used", transformId }).where(and(eq(photoCollaborationInvites.id, inviteId), eq(photoCollaborationInvites.inviterUserId, inviterUserId), eq(photoCollaborationInvites.status, "accepted")));
}

export async function cancelPhotoCollaborationInvite(inviterUserId: number, inviteId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const current = await db.select().from(photoCollaborationInvites).where(and(eq(photoCollaborationInvites.id, inviteId), eq(photoCollaborationInvites.inviterUserId, inviterUserId), inArray(photoCollaborationInvites.status, ["pending", "accepted"]))).limit(1);
  if (!current[0]) throw new Error("Undangan tidak dapat dibatalkan.");
  await db.update(photoCollaborationInvites).set({ status: "cancelled", respondedAt: new Date() }).where(eq(photoCollaborationInvites.id, inviteId));
  await createAccountActivityNotification(current[0].inviteeUserId, "Undangan Kolaborasi dibatalkan", "Pengirim membatalkan undangan Kolaborasi Foto. Tidak ada foto atau hasil yang dibagikan.");
  return { success: true };
}

export async function listPhotoCollaborationProjects(userId: number, filters: { template?: string; status?: "processing" | "completed" | "failed" | "cancelled" } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(photoTransforms.userId, userId), eq(photoTransforms.recipe, "collaboration")];
  if (filters.template) conditions.push(eq(photoTransforms.collaborationTemplate, filters.template));
  if (filters.status) conditions.push(eq(photoTransforms.status, filters.status));
  return db.select({ id: photoTransforms.id, title: photoTransforms.title, template: photoTransforms.collaborationTemplate, aspectRatio: photoTransforms.aspectRatio, style: photoTransforms.style, status: photoTransforms.status, resultUrl: photoTransforms.resultUrl, errorMessage: photoTransforms.errorMessage, createdAt: photoTransforms.createdAt, completedAt: photoTransforms.completedAt }).from(photoTransforms).where(and(...conditions)).orderBy(desc(photoTransforms.createdAt)).limit(100);
}

export async function createPhotoCollaborationShareLink(userId: number, transformId: number, tokenHash: string, expiresAt: Date, watermarkText: string | null, watermarkLogoId: number | null, allowUnlimitedActiveLinks = false) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const transform = await db.select({ id: photoTransforms.id }).from(photoTransforms).where(and(eq(photoTransforms.id, transformId), eq(photoTransforms.userId, userId), eq(photoTransforms.recipe, "collaboration"), eq(photoTransforms.status, "completed"), isNotNull(photoTransforms.resultUrl))).limit(1);
  if (!transform[0]) throw new Error("Hanya hasil Kolaborasi Foto yang selesai dapat dibagikan.");
  const active = await db.select({ total: count() }).from(photoCollaborationShareLinks).where(and(eq(photoCollaborationShareLinks.userId, userId), eq(photoCollaborationShareLinks.transformId, transformId), isNull(photoCollaborationShareLinks.revokedAt), gt(photoCollaborationShareLinks.expiresAt, new Date())));
  if (!allowUnlimitedActiveLinks && Number(active[0]?.total ?? 0) >= 3) throw new Error("Maksimal tiga tautan berbagi aktif untuk setiap hasil. Cabut atau tunggu salah satunya berakhir.");
  if (watermarkLogoId) { const logo = await db.select({ id: photoCollaborationBrandLogos.id }).from(photoCollaborationBrandLogos).where(and(eq(photoCollaborationBrandLogos.id, watermarkLogoId), eq(photoCollaborationBrandLogos.userId, userId))).limit(1); if (!logo[0]) throw new Error("Logo watermark tidak ditemukan."); }
  const result = await db.insert(photoCollaborationShareLinks).values({ userId, transformId, tokenHash, expiresAt, watermarkText: watermarkText?.trim() || null, watermarkLogoId });
  const rows = await db.select().from(photoCollaborationShareLinks).where(eq(photoCollaborationShareLinks.id, Number(result[0].insertId))).limit(1);
  return rows[0];
}

export async function listPhotoCollaborationShareLinks(userId: number, transformId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: photoCollaborationShareLinks.id, watermarkText: photoCollaborationShareLinks.watermarkText, watermarkLogoId: photoCollaborationShareLinks.watermarkLogoId, accessCount: photoCollaborationShareLinks.accessCount, lastAccessedAt: photoCollaborationShareLinks.lastAccessedAt, expiresAt: photoCollaborationShareLinks.expiresAt, revokedAt: photoCollaborationShareLinks.revokedAt, createdAt: photoCollaborationShareLinks.createdAt }).from(photoCollaborationShareLinks).where(and(eq(photoCollaborationShareLinks.userId, userId), eq(photoCollaborationShareLinks.transformId, transformId))).orderBy(desc(photoCollaborationShareLinks.createdAt)).limit(20);
}

export async function revokePhotoCollaborationShareLink(userId: number, shareLinkId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.update(photoCollaborationShareLinks).set({ revokedAt: new Date() }).where(and(eq(photoCollaborationShareLinks.id, shareLinkId), eq(photoCollaborationShareLinks.userId, userId), isNull(photoCollaborationShareLinks.revokedAt)));
  if (!Number(result[0].affectedRows)) throw new Error("Tautan tidak dapat dicabut.");
  return { success: true };
}

export async function getPhotoCollaborationShareByTokenHash(tokenHash: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ shareLinkId: photoCollaborationShareLinks.id, transformId: photoTransforms.id, title: photoTransforms.title, template: photoTransforms.collaborationTemplate, aspectRatio: photoTransforms.aspectRatio, resultUrl: photoTransforms.resultUrl, watermarkText: photoCollaborationShareLinks.watermarkText, logoStorageKey: photoCollaborationBrandLogos.storageKey, expiresAt: photoCollaborationShareLinks.expiresAt }).from(photoCollaborationShareLinks).innerJoin(photoTransforms, eq(photoTransforms.id, photoCollaborationShareLinks.transformId)).leftJoin(photoCollaborationBrandLogos, eq(photoCollaborationBrandLogos.id, photoCollaborationShareLinks.watermarkLogoId)).where(and(eq(photoCollaborationShareLinks.tokenHash, tokenHash), isNull(photoCollaborationShareLinks.revokedAt), gt(photoCollaborationShareLinks.expiresAt, new Date()), eq(photoTransforms.recipe, "collaboration"), eq(photoTransforms.status, "completed"), isNotNull(photoTransforms.resultUrl))).limit(1);
  return rows[0] ?? null;
}

export async function recordPhotoCollaborationShareAccess(shareLinkId: number) {
  const db = await getDb(); if (!db) return;
  await db.update(photoCollaborationShareLinks).set({ accessCount: sql`${photoCollaborationShareLinks.accessCount} + 1`, lastAccessedAt: new Date() }).where(eq(photoCollaborationShareLinks.id, shareLinkId));
}

export async function listPhotoCollaborationBrandLogos(userId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select({ id: photoCollaborationBrandLogos.id, name: photoCollaborationBrandLogos.name, createdAt: photoCollaborationBrandLogos.createdAt }).from(photoCollaborationBrandLogos).where(eq(photoCollaborationBrandLogos.userId, userId)).orderBy(desc(photoCollaborationBrandLogos.createdAt)).limit(12);
}

export async function createPhotoCollaborationBrandLogo(userId: number, name: string, storageKey: string) {
  const db = await getDb(); if (!db) throw new Error("Basis data belum tersedia.");
  const inserted = await db.insert(photoCollaborationBrandLogos).values({ userId, name, storageKey });
  return (await db.select().from(photoCollaborationBrandLogos).where(eq(photoCollaborationBrandLogos.id, Number(inserted[0].insertId))).limit(1))[0];
}

export async function deletePhotoCollaborationBrandLogo(userId: number, logoId: number) {
  const db = await getDb(); if (!db) throw new Error("Basis data belum tersedia.");
  const activeUse = await db.select({ id: photoCollaborationShareLinks.id }).from(photoCollaborationShareLinks).where(and(eq(photoCollaborationShareLinks.userId, userId), eq(photoCollaborationShareLinks.watermarkLogoId, logoId), isNull(photoCollaborationShareLinks.revokedAt), gt(photoCollaborationShareLinks.expiresAt, new Date()))).limit(1);
  if (activeUse[0]) throw new Error("Logo masih digunakan oleh tautan berbagi aktif.");
  const result = await db.delete(photoCollaborationBrandLogos).where(and(eq(photoCollaborationBrandLogos.id, logoId), eq(photoCollaborationBrandLogos.userId, userId)));
  return { success: Number(result[0].affectedRows || 0) > 0 };
}

export async function runPhotoCollaborationShareExpiryReminderSweep(now = new Date()) {
  const db = await getDb(); if (!db) return { notified: 0 };
  const cutoff = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const due = await db.select({ id: photoCollaborationShareLinks.id, userId: photoCollaborationShareLinks.userId, expiresAt: photoCollaborationShareLinks.expiresAt }).from(photoCollaborationShareLinks).where(and(isNull(photoCollaborationShareLinks.revokedAt), isNull(photoCollaborationShareLinks.expiryNotifiedAt), gt(photoCollaborationShareLinks.expiresAt, now), lte(photoCollaborationShareLinks.expiresAt, cutoff))).limit(200);
  let notified = 0;
  for (const link of due) {
    const update = await db.update(photoCollaborationShareLinks).set({ expiryNotifiedAt: now }).where(and(eq(photoCollaborationShareLinks.id, link.id), isNull(photoCollaborationShareLinks.expiryNotifiedAt)));
    if (Number(update[0].affectedRows || 0) > 0) { await createAccountActivityNotification(link.userId, "Tautan Kolaborasi akan berakhir", `Satu tautan berbagi hasil Kolaborasi Foto akan berakhir pada ${link.expiresAt.toLocaleString("id-ID")}. Cabut atau buat tautan baru bila diperlukan.`); notified++; }
  }
  return { notified };
}

export async function listPhotoCollaborationLayoutPresets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(photoCollaborationLayoutPresets).where(eq(photoCollaborationLayoutPresets.userId, userId)).orderBy(desc(photoCollaborationLayoutPresets.updatedAt), desc(photoCollaborationLayoutPresets.id)).limit(24);
}

export async function createPhotoCollaborationLayoutPreset(userId: number, name: string, layout: string) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.insert(photoCollaborationLayoutPresets).values({ userId, name: name.trim(), layout });
  const rows = await db.select().from(photoCollaborationLayoutPresets).where(eq(photoCollaborationLayoutPresets.id, Number(result[0].insertId))).limit(1);
  return rows[0];
}

export async function deletePhotoCollaborationLayoutPreset(userId: number, presetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.delete(photoCollaborationLayoutPresets).where(and(eq(photoCollaborationLayoutPresets.id, presetId), eq(photoCollaborationLayoutPresets.userId, userId)));
  if (!Number(result[0].affectedRows)) throw new Error("Preset tidak ditemukan.");
  return { success: true };
}

export async function getOwnedPhotoTransform(userId: number, transformId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(photoTransforms).where(and(eq(photoTransforms.id, transformId), eq(photoTransforms.userId, userId))).limit(1);
  return rows[0] ?? null;
}

export async function recordPhotoShareEvent(userId: number, input: { transformId: number; platform: "whatsapp" | "instagram" | "facebook" | "tiktok" | "other"; caption: string; watermarkText: string | null; outcome: "shared" | "copied" | "downloaded" }) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const transform = await db.select({ id: photoTransforms.id }).from(photoTransforms).where(and(eq(photoTransforms.id, input.transformId), eq(photoTransforms.userId, userId), eq(photoTransforms.status, "completed"), isNotNull(photoTransforms.resultUrl))).limit(1);
  if (!transform[0]) throw new Error("Hanya hasil transformasi selesai yang dapat dicatat sebagai dibagikan.");
  const result = await db.insert(photoShareEvents).values({ ...input, userId, watermarkText: input.watermarkText?.trim() || null });
  const records = await db.select().from(photoShareEvents).where(eq(photoShareEvents.id, Number(result[0].insertId))).limit(1);
  if (!records[0]) throw new Error("Riwayat berbagi belum dapat disimpan.");
  return records[0];
}

export async function listPhotoShareEvents(userId: number, transformId: number, filters: { platform?: "whatsapp" | "instagram" | "facebook" | "tiktok" | "other"; from?: Date; to?: Date; captionQuery?: string } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(photoShareEvents.userId, userId), eq(photoShareEvents.transformId, transformId)];
  if (filters.platform) conditions.push(eq(photoShareEvents.platform, filters.platform));
  if (filters.from) conditions.push(gte(photoShareEvents.createdAt, filters.from));
  if (filters.to) conditions.push(lte(photoShareEvents.createdAt, filters.to));
  if (filters.captionQuery?.trim()) conditions.push(sql`LOWER(${photoShareEvents.caption}) LIKE ${`%${filters.captionQuery.trim().toLowerCase()}%`}`);
  return db.select().from(photoShareEvents).where(and(...conditions)).orderBy(desc(photoShareEvents.createdAt)).limit(100);
}

export async function listPhotoShareEventsForTransforms(userId: number, transformIds: number[], filters: { from?: Date; to?: Date } = {}) {
  const db = await getDb();
  if (!db) return [];
  const uniqueTransformIds = Array.from(new Set(transformIds));
  if (!uniqueTransformIds.length) return [];
  const conditions = [eq(photoShareEvents.userId, userId), inArray(photoShareEvents.transformId, uniqueTransformIds)];
  if (filters.from) conditions.push(gte(photoShareEvents.createdAt, filters.from));
  if (filters.to) conditions.push(lte(photoShareEvents.createdAt, filters.to));
  return db.select().from(photoShareEvents).where(and(...conditions)).orderBy(desc(photoShareEvents.createdAt), desc(photoShareEvents.id)).limit(500);
}

export async function listPhotoCaptionTemplates(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(photoCaptionTemplates).where(eq(photoCaptionTemplates.userId, userId)).orderBy(desc(photoCaptionTemplates.createdAt)).limit(30);
}

export async function createPhotoCaptionTemplate(userId: number, name: string, caption: string) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.insert(photoCaptionTemplates).values({ userId, name: name.trim(), caption: caption.trim() });
  const records = await db.select().from(photoCaptionTemplates).where(eq(photoCaptionTemplates.id, Number(result[0].insertId))).limit(1);
  if (!records[0]) throw new Error("Template caption belum dapat disimpan.");
  return records[0];
}

export async function deletePhotoCaptionTemplate(userId: number, templateId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.delete(photoCaptionTemplates).where(and(eq(photoCaptionTemplates.id, templateId), eq(photoCaptionTemplates.userId, userId)));
  return Number(result[0].affectedRows ?? 0) > 0;
}

export async function listPhotoWatermarkPresets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(photoWatermarkPresets).where(eq(photoWatermarkPresets.userId, userId)).orderBy(desc(photoWatermarkPresets.createdAt)).limit(30);
}

export async function createPhotoWatermarkPreset(userId: number, input: { name: string; text: string; position: "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right"; size: number; font: "sans" | "serif" | "mono" }) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.insert(photoWatermarkPresets).values({ ...input, userId, name: input.name.trim(), text: input.text.trim() });
  const records = await db.select().from(photoWatermarkPresets).where(eq(photoWatermarkPresets.id, Number(result[0].insertId))).limit(1);
  if (!records[0]) throw new Error("Preset watermark belum dapat disimpan.");
  return records[0];
}

export async function deletePhotoWatermarkPreset(userId: number, presetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.delete(photoWatermarkPresets).where(and(eq(photoWatermarkPresets.id, presetId), eq(photoWatermarkPresets.userId, userId)));
  return Number(result[0].affectedRows ?? 0) > 0;
}

export async function listGlobalWatermarkPresets(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(globalWatermarkPresets).where(activeOnly ? eq(globalWatermarkPresets.isActive, true) : undefined).orderBy(globalWatermarkPresets.sortOrder, globalWatermarkPresets.id).limit(50);
}

type GlobalWatermarkPresetInput = { name: string; text: string; position: "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right"; size: number; font: "sans" | "serif" | "mono"; isActive: boolean };

export async function createGlobalWatermarkPreset(actorUserId: number, input: GlobalWatermarkPresetInput) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const last = await db.select({ highestOrder: sql<number>`COALESCE(MAX(${globalWatermarkPresets.sortOrder}), -1)` }).from(globalWatermarkPresets);
  const result = await db.insert(globalWatermarkPresets).values({ ...input, name: input.name.trim(), text: input.text.trim(), sortOrder: Number(last[0]?.highestOrder ?? -1) + 1 });
  const records = await db.select().from(globalWatermarkPresets).where(eq(globalWatermarkPresets.id, Number(result[0].insertId))).limit(1);
  if (!records[0]) throw new Error("Preset branding belum dapat disimpan.");
  await db.insert(globalWatermarkPresetAudits).values({ actorUserId, presetId: records[0].id, action: "created", summary: `Membuat preset “${records[0].name}” pada urutan ${records[0].sortOrder + 1}.` });
  return records[0];
}

export async function updateGlobalWatermarkPreset(actorUserId: number, id: number, input: GlobalWatermarkPresetInput) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const previous = await db.select().from(globalWatermarkPresets).where(eq(globalWatermarkPresets.id, id)).limit(1);
  if (!previous[0]) throw new Error("Preset branding tidak ditemukan.");
  await db.update(globalWatermarkPresets).set({ ...input, name: input.name.trim(), text: input.text.trim() }).where(eq(globalWatermarkPresets.id, id));
  const records = await db.select().from(globalWatermarkPresets).where(eq(globalWatermarkPresets.id, id)).limit(1);
  if (!records[0]) throw new Error("Preset branding tidak ditemukan.");
  const changed = (["name", "text", "position", "size", "font", "isActive"] as const).filter((field) => previous[0]![field] !== records[0]![field]);
  if (changed.length) await db.insert(globalWatermarkPresetAudits).values({ actorUserId, presetId: id, action: "updated", summary: `Memperbarui ${changed.join(", ")} pada preset “${records[0].name}”.` });
  return records[0];
}

export async function reorderGlobalWatermarkPresets(actorUserId: number, presetIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const presets = await db.select({ id: globalWatermarkPresets.id }).from(globalWatermarkPresets).limit(50);
  const existingIds = presets.map((preset) => preset.id).sort((a, b) => a - b);
  const submittedIds = [...presetIds].sort((a, b) => a - b);
  if (existingIds.length !== submittedIds.length || existingIds.some((id, index) => id !== submittedIds[index])) throw new Error("Urutan preset tidak lengkap atau sudah berubah. Muat ulang daftar lalu coba lagi.");
  await db.transaction(async (tx) => {
    for (let sortOrder = 0; sortOrder < presetIds.length; sortOrder += 1) await tx.update(globalWatermarkPresets).set({ sortOrder }).where(eq(globalWatermarkPresets.id, presetIds[sortOrder]!));
    await tx.insert(globalWatermarkPresetAudits).values({ actorUserId, presetId: null, action: "reordered", summary: `Mengatur ulang urutan ${presetIds.length} preset watermark global.` });
  });
  return listGlobalWatermarkPresets(false);
}

type GlobalWatermarkAuditFilters = { search?: string; action?: "all" | "created" | "updated" | "reordered" };

function globalWatermarkAuditConditions(filters: GlobalWatermarkAuditFilters) {
  const conditions = [];
  if (filters.action && filters.action !== "all") conditions.push(eq(globalWatermarkPresetAudits.action, filters.action));
  if (filters.search?.trim()) {
    const pattern = `%${filters.search.trim().toLowerCase()}%`;
    conditions.push(or(sql`LOWER(COALESCE(${users.name}, '')) LIKE ${pattern}`, sql`LOWER(COALESCE(${users.email}, '')) LIKE ${pattern}`)!);
  }
  return conditions;
}

export async function listGlobalWatermarkPresetAudits(filters: GlobalWatermarkAuditFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = globalWatermarkAuditConditions(filters);
  return db.select({ id: globalWatermarkPresetAudits.id, presetId: globalWatermarkPresetAudits.presetId, action: globalWatermarkPresetAudits.action, summary: globalWatermarkPresetAudits.summary, createdAt: globalWatermarkPresetAudits.createdAt, actorName: users.name, actorEmail: users.email }).from(globalWatermarkPresetAudits).leftJoin(users, eq(users.id, globalWatermarkPresetAudits.actorUserId)).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(globalWatermarkPresetAudits.createdAt), desc(globalWatermarkPresetAudits.id)).limit(50);
}

export async function summarizeGlobalWatermarkPresetAudits(filters: GlobalWatermarkAuditFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = globalWatermarkAuditConditions(filters);
  return db.select({ actorUserId: globalWatermarkPresetAudits.actorUserId, actorName: users.name, actorEmail: users.email, actionCount: count(globalWatermarkPresetAudits.id) }).from(globalWatermarkPresetAudits).leftJoin(users, eq(users.id, globalWatermarkPresetAudits.actorUserId)).where(conditions.length ? and(...conditions) : undefined).groupBy(globalWatermarkPresetAudits.actorUserId, users.name, users.email).orderBy(desc(count(globalWatermarkPresetAudits.id))).limit(30);
}

export async function getProcessingQueueStatus() {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const rows = await db.select({ activeCount: count() }).from(photoTransforms).where(eq(photoTransforms.status, "processing"));
  const activeCount = Number(rows[0]?.activeCount ?? 0);
  const completed = await db.select({ createdAt: photoTransforms.createdAt, completedAt: photoTransforms.completedAt }).from(photoTransforms).where(and(eq(photoTransforms.status, "completed"), isNotNull(photoTransforms.completedAt))).orderBy(desc(photoTransforms.completedAt)).limit(30);
  const durations = completed.map((item) => Math.max(1, Math.round((item.completedAt!.getTime() - item.createdAt.getTime()) / 1000))).filter((seconds) => seconds <= 15 * 60);
  const averageDurationSeconds = durations.length ? Math.round(durations.reduce((total, seconds) => total + seconds, 0) / durations.length) : 45;
  const position = activeCount + 1;
  return { activeCount, position, averageDurationSeconds, estimatedWaitSeconds: averageDurationSeconds * Math.max(0, position - 1), estimatedCompletionSeconds: averageDurationSeconds * position, sampleSize: durations.length };
}

export async function markPhotoTransformAutoRetry(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(photoTransforms).set({ providerAttemptCount: 2, autoRetryAt: new Date() }).where(and(eq(photoTransforms.id, id), eq(photoTransforms.status, "processing")));
}

export function getPhotoTransformCompletionActivity(transform: { title: string; providerAttemptCount: number }) {
  const recovered = transform.providerAttemptCount > 1;
  return {
    title: recovered ? "Transformasi selesai setelah pemulihan" : "Transformasi selesai",
    content: recovered ? `“${transform.title}” berhasil diselesaikan setelah sistem mencoba ulang akibat gangguan sementara.` : `“${transform.title}” sudah siap ditinjau, diunduh, atau disusun ke album privat.`,
  };
}

export async function completePhotoTransform(id: number, resultUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  await db
    .update(photoTransforms)
    .set({ status: "completed", resultUrl, completedAt: new Date(), errorMessage: null })
    .where(and(eq(photoTransforms.id, id), eq(photoTransforms.status, "processing")));
  const rows = await db.select().from(photoTransforms).where(eq(photoTransforms.id, id)).limit(1);
  const transform = rows[0];
  if (transform?.status === "completed") {
    const preferences = await db.select({ accountActivity: userNotificationPreferences.accountActivity }).from(userNotificationPreferences).where(eq(userNotificationPreferences.userId, transform.userId)).limit(1);
    if (preferences[0]?.accountActivity ?? true) {
      const activity = getPhotoTransformCompletionActivity(transform);
      await db.insert(userNotifications).values({ userId: transform.userId, kind: "account_activity", ...activity, relatedPostId: null });
    }
  }
  return rows[0];
}

export async function failPhotoTransform(id: number, message: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(photoTransforms)
    .set({ status: "failed", errorMessage: message.slice(0, 500), completedAt: new Date() })
    .where(and(eq(photoTransforms.id, id), eq(photoTransforms.status, "processing")));
}

export async function cancelPhotoTransform(userId: number, requestId: string) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.update(photoTransforms).set({ status: "cancelled", errorMessage: "Transformasi dibatalkan oleh pengguna. Foto sumber tetap aman di riwayat.", completedAt: new Date() }).where(and(eq(photoTransforms.userId, userId), eq(photoTransforms.requestId, requestId), eq(photoTransforms.status, "processing")));
  return { cancelled: Number(result[0].affectedRows ?? 0) > 0 };
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

export async function userOwnsPhotoMedia(userId: number, storageUrl: string) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: photoTransforms.id }).from(photoTransforms).where(and(eq(photoTransforms.userId, userId), or(eq(photoTransforms.sourceUrl, storageUrl), eq(photoTransforms.resultUrl, storageUrl)))).limit(1);
  return rows.length > 0;
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

export async function listPhotoRecipeFavorites(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(photoRecipeFavorites).where(eq(photoRecipeFavorites.userId, userId)).orderBy(desc(photoRecipeFavorites.createdAt)).limit(80);
}

export async function createPhotoRecipeFavorite(userId: number, recipeId: string) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const existing = await db.select().from(photoRecipeFavorites).where(and(eq(photoRecipeFavorites.userId, userId), eq(photoRecipeFavorites.recipeId, recipeId))).limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db.insert(photoRecipeFavorites).values({ userId, recipeId });
  const records = await db.select().from(photoRecipeFavorites).where(eq(photoRecipeFavorites.id, Number(inserted[0].insertId))).limit(1);
  return records[0];
}

export async function deletePhotoRecipeFavorite(userId: number, recipeId: string) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const result = await db.delete(photoRecipeFavorites).where(and(eq(photoRecipeFavorites.userId, userId), eq(photoRecipeFavorites.recipeId, recipeId)));
  return { success: Number(result[0].affectedRows ?? 0) > 0 };
}

type SeasonalCollectionInput = { slug: string; name: string; season: "ramadan" | "lebaran"; description: string; recipeIds: string[]; isActive: boolean; startsAt: Date | null; endsAt: Date | null };

function parseSeasonalRecipeIds(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toSeasonalCollection(record: typeof seasonalRecipeCollections.$inferSelect) {
  return { ...record, recipeIds: parseSeasonalRecipeIds(record.recipeIds) };
}

export async function listActiveSeasonalRecipeCollections() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const records = await db.select().from(seasonalRecipeCollections).where(and(eq(seasonalRecipeCollections.isActive, true), or(isNull(seasonalRecipeCollections.startsAt), lte(seasonalRecipeCollections.startsAt, now)), or(isNull(seasonalRecipeCollections.endsAt), gt(seasonalRecipeCollections.endsAt, now)))).orderBy(desc(seasonalRecipeCollections.updatedAt));
  return records.map(toSeasonalCollection);
}

export async function listAdminSeasonalRecipeCollections() {
  const db = await getDb();
  if (!db) return [];
  const records = await db.select().from(seasonalRecipeCollections).orderBy(desc(seasonalRecipeCollections.updatedAt));
  return records.map(toSeasonalCollection);
}

export async function createSeasonalRecipeCollection(input: SeasonalCollectionInput) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const inserted = await db.insert(seasonalRecipeCollections).values({ ...input, recipeIds: JSON.stringify(Array.from(new Set(input.recipeIds))) });
  const records = await db.select().from(seasonalRecipeCollections).where(eq(seasonalRecipeCollections.id, Number(inserted[0].insertId))).limit(1);
  if (!records[0]) throw new Error("Koleksi musiman belum dapat disimpan.");
  return toSeasonalCollection(records[0]);
}

export async function updateSeasonalRecipeCollection(id: number, input: Omit<SeasonalCollectionInput, "slug"> & { slug: string }) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  await db.update(seasonalRecipeCollections).set({ ...input, recipeIds: JSON.stringify(Array.from(new Set(input.recipeIds))) }).where(eq(seasonalRecipeCollections.id, id));
  const records = await db.select().from(seasonalRecipeCollections).where(eq(seasonalRecipeCollections.id, id)).limit(1);
  if (!records[0]) throw new Error("Koleksi musiman tidak ditemukan.");
  return toSeasonalCollection(records[0]);
}

export async function duplicateSeasonalRecipeCollection(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const records = await db.select().from(seasonalRecipeCollections).where(eq(seasonalRecipeCollections.id, id)).limit(1);
  const source = records[0];
  if (!source) throw new Error("Koleksi musiman tidak ditemukan.");
  const suffix = `-draf-${Date.now().toString(36)}`;
  const slug = `${source.slug.slice(0, Math.max(3, 48 - suffix.length))}${suffix}`;
  return createSeasonalRecipeCollection({ slug, name: `[Draf] ${source.name}`.slice(0, 80), season: source.season, description: source.description, recipeIds: parseSeasonalRecipeIds(source.recipeIds), isActive: false, startsAt: null, endsAt: null });
}

export async function getRecipePopularity(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(photoTransforms.status, "completed")];
  if (userId) conditions.push(eq(photoTransforms.userId, userId));
  const records = await db.select({ recipeId: photoTransforms.recipe, uses: count(photoTransforms.id) }).from(photoTransforms).where(and(...conditions)).groupBy(photoTransforms.recipe).orderBy(desc(count(photoTransforms.id))).limit(80);
  return records.map((record) => ({ recipeId: record.recipeId, uses: Number(record.uses) }));
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

export type SecuritySummaryFrequency = "disabled" | "daily" | "weekly";

export async function getUserSecuritySummaryPreference(userId: number) {
  const db = await getDb();
  if (!db) return { userId, frequency: "disabled" as const, lastSentAt: null, lastSentPeriodKey: null };
  const rows = await db.select().from(userSecuritySummaryPreferences).where(eq(userSecuritySummaryPreferences.userId, userId)).limit(1);
  return rows[0] ?? { userId, frequency: "disabled" as const, lastSentAt: null, lastSentPeriodKey: null };
}

export async function updateUserSecuritySummaryPreference(userId: number, frequency: SecuritySummaryFrequency) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  await db.insert(userSecuritySummaryPreferences).values({ userId, frequency }).onDuplicateKeyUpdate({ set: { frequency } });
  return getUserSecuritySummaryPreference(userId);
}

export async function listAutomaticSecuritySummaryRecipients() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ userId: userSecuritySummaryPreferences.userId, email: users.email, frequency: userSecuritySummaryPreferences.frequency, lastSentPeriodKey: userSecuritySummaryPreferences.lastSentPeriodKey }).from(userSecuritySummaryPreferences).innerJoin(users, eq(users.id, userSecuritySummaryPreferences.userId)).where(and(ne(userSecuritySummaryPreferences.frequency, "disabled"), isNotNull(users.email)));
}

export async function claimSecuritySummaryPeriod(userId: number, periodKey: string, sentAt = new Date()) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(userSecuritySummaryPreferences).set({ lastSentPeriodKey: periodKey, lastSentAt: sentAt }).where(and(eq(userSecuritySummaryPreferences.userId, userId), or(isNull(userSecuritySummaryPreferences.lastSentPeriodKey), ne(userSecuritySummaryPreferences.lastSentPeriodKey, periodKey))));
  return Number(result[0].affectedRows ?? 0) > 0;
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
