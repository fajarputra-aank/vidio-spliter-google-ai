import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { communityLikes, communityPosts, creditLedger, creditPurchases, InsertPhotoTransform, InsertUser, photoTransforms, users } from "../drizzle/schema";
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

export async function listPhotoTransforms(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(photoTransforms)
    .where(eq(photoTransforms.userId, userId))
    .orderBy(desc(photoTransforms.createdAt));
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

export async function listCommunityPosts(viewerId?: number) {
  const db = await getDb();
  if (!db) return [];
  const posts = await db.select({ post: communityPosts, authorName: users.name }).from(communityPosts).innerJoin(users, eq(communityPosts.userId, users.id)).where(eq(communityPosts.isPublished, true)).orderBy(desc(communityPosts.createdAt));
  return Promise.all(posts.map(async ({ post, authorName }) => {
    const likeCount = await db.select({ total: count() }).from(communityLikes).where(eq(communityLikes.postId, post.id));
    const viewerLike = viewerId ? await db.select({ id: communityLikes.id }).from(communityLikes).where(and(eq(communityLikes.postId, post.id), eq(communityLikes.userId, viewerId))).limit(1) : [];
    return { ...post, authorName: authorName || "Kreator", likes: Number(likeCount[0]?.total ?? 0), likedByViewer: Boolean(viewerLike[0]) };
  }));
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
