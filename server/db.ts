import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { communityLikes, communityPosts, communityReports, creditLedger, creditPurchases, InsertPhotoTransform, InsertUser, photoAlbumItems, photoAlbums, photoTransforms, userNotifications, users } from "../drizzle/schema";
import type { CreditPackId } from "./creditProducts";
import { ENV } from "./_core/env";
import { dailyQuota, utcDayBounds } from "./photoQuota";

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
  if (!db) return [];
  return db.select().from(creditPurchases).where(eq(creditPurchases.userId, userId)).orderBy(desc(creditPurchases.createdAt));
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
    await tx.insert(userNotifications).values({ userId: post[0].userId, kind: "community_moderation", title: "Karya publik ditindak moderator", content: "Satu karya telah dihapus dari ruang komunitas setelah ditinjau moderator. Riwayat privatmu tetap tersimpan.", relatedPostId: postId });
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
      if (post[0]) await tx.insert(userNotifications).values({ userId: post[0].userId, kind: "community_moderation", title: "Laporan komunitas ditindaklanjuti", content: "Satu karya telah dihapus dari ruang komunitas setelah laporan ditinjau. Riwayat privatmu tetap tersimpan.", relatedPostId: report[0].postId });
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

export async function removeTransformFromAlbum(userId: number, albumId: number, transformId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const album = await db.select({ id: photoAlbums.id }).from(photoAlbums).where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.userId, userId))).limit(1);
  if (!album[0]) return { success: false };
  await db.delete(photoAlbumItems).where(and(eq(photoAlbumItems.albumId, albumId), eq(photoAlbumItems.transformId, transformId)));
  return { success: true };
}

export async function listUserNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userNotifications).where(eq(userNotifications.userId, userId)).orderBy(desc(userNotifications.createdAt)).limit(24);
}

export async function markUserNotificationRead(userId: number, notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Basis data belum tersedia.");
  const notification = await db.select({ id: userNotifications.id }).from(userNotifications).where(and(eq(userNotifications.id, notificationId), eq(userNotifications.userId, userId))).limit(1);
  if (!notification[0]) return { success: false };
  await db.update(userNotifications).set({ isRead: true }).where(and(eq(userNotifications.id, notificationId), eq(userNotifications.userId, userId)));
  return { success: true };
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
