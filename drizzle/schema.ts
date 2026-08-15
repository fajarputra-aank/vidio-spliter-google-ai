import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/** Core identity table backing the OAuth session flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** A private record of one source image and its AI-produced result. */
export const photoTransforms = mysqlTable(
  "photoTransforms",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    recipe: varchar("recipe", { length: 40 }).notNull(),
    aspectRatio: varchar("aspectRatio", { length: 8 }).notNull().default("1:1"),
    style: varchar("style", { length: 24 }).notNull().default("editorial"),
    title: varchar("title", { length: 120 }).notNull(),
    sourceKey: varchar("sourceKey", { length: 512 }).notNull(),
    sourceUrl: text("sourceUrl").notNull(),
    resultUrl: text("resultUrl"),
    status: mysqlEnum("status", ["processing", "completed", "failed"]).default("processing").notNull(),
    isHidden: boolean("isHidden").notNull().default(false),
    errorMessage: varchar("errorMessage", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  (table) => [index("photoTransforms_user_created_idx").on(table.userId, table.createdAt), index("photoTransforms_user_hidden_created_idx").on(table.userId, table.isHidden, table.createdAt)]
);

/** Immutable business ledger for paid extra transformations. */
export const creditLedger = mysqlTable(
  "creditLedger",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    credits: int("credits").notNull(),
    reason: mysqlEnum("reason", ["purchase", "usage", "refund", "hd_export"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("creditLedger_user_created_idx").on(table.userId, table.createdAt)]
);

/** Idempotent payment fulfillment record; only Stripe identifiers and business fulfillment data are stored. */
export const creditPurchases = mysqlTable(
  "creditPurchases",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    packId: varchar("packId", { length: 40 }).notNull(),
    credits: int("credits").notNull(),
    stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }).notNull(),
    stripeEventId: varchar("stripeEventId", { length: 255 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("creditPurchases_session_unique").on(table.stripeCheckoutSessionId),
    uniqueIndex("creditPurchases_event_unique").on(table.stripeEventId),
    index("creditPurchases_user_created_idx").on(table.userId, table.createdAt),
  ]
);

/** Explicitly published result; source assets and private transforms remain private. */
export const communityPosts = mysqlTable(
  "communityPosts",
  {
    id: int("id").autoincrement().primaryKey(),
    transformId: int("transformId").notNull(),
    userId: int("userId").notNull(),
    resultUrl: text("resultUrl").notNull(),
    caption: varchar("caption", { length: 240 }),
    isPublished: boolean("isPublished").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("communityPosts_transform_unique").on(table.transformId),
    index("communityPosts_published_created_idx").on(table.isPublished, table.createdAt),
    index("communityPosts_user_created_idx").on(table.userId, table.createdAt),
  ]
);

export const communityLikes = mysqlTable(
  "communityLikes",
  {
    id: int("id").autoincrement().primaryKey(),
    postId: int("postId").notNull(),
    userId: int("userId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("communityLikes_post_user_unique").on(table.postId, table.userId), index("communityLikes_post_idx").on(table.postId)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PhotoTransform = typeof photoTransforms.$inferSelect;
export type InsertPhotoTransform = typeof photoTransforms.$inferInsert;
