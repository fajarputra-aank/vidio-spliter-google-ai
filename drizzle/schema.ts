import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/** Core identity table backing the OAuth session flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  unlimitedTransforms: boolean("unlimitedTransforms").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Singleton brand identity. File bytes stay in object storage; this table only holds safe delivery URLs. */
export const brandSettings = mysqlTable("brandSettings", {
  id: int("id").primaryKey(),
  logoUrl: text("logoUrl").notNull(),
  iconUrl: text("iconUrl").notNull(),
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Append-only operational record for changes to roles and special transform access. */
export const adminAccessAudits = mysqlTable(
  "adminAccessAudits",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId").notNull(),
    targetUserId: int("targetUserId").notNull(),
    action: mysqlEnum("action", ["role_changed", "unlimited_access_changed"]).notNull(),
    previousRole: mysqlEnum("previousRole", ["user", "admin"]).notNull(),
    nextRole: mysqlEnum("nextRole", ["user", "admin"]).notNull(),
    previousUnlimitedTransforms: boolean("previousUnlimitedTransforms").notNull(),
    nextUnlimitedTransforms: boolean("nextUnlimitedTransforms").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("adminAccessAudits_created_idx").on(table.createdAt), index("adminAccessAudits_target_created_idx").on(table.targetUserId, table.createdAt)]
);

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

/** Authenticated, duplicate-safe reports on a currently public community post. */
export const communityReports = mysqlTable(
  "communityReports",
  {
    id: int("id").autoincrement().primaryKey(),
    postId: int("postId").notNull(),
    reporterUserId: int("reporterUserId").notNull(),
    reason: mysqlEnum("reason", ["inappropriate", "spam", "copyright", "other"]).notNull(),
    details: varchar("details", { length: 320 }),
    status: mysqlEnum("status", ["open", "dismissed", "actioned"]).default("open").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    reviewedAt: timestamp("reviewedAt"),
  },
  (table) => [
    uniqueIndex("communityReports_post_reporter_unique").on(table.postId, table.reporterUserId),
    index("communityReports_status_created_idx").on(table.status, table.createdAt),
  ]
);

/** Private grouping metadata; transforms themselves remain immutable and private. */
export const photoAlbums = mysqlTable(
  "photoAlbums",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    isArchived: boolean("isArchived").notNull().default(false),
    archivedAt: timestamp("archivedAt"),
    lastAccessedAt: timestamp("lastAccessedAt").defaultNow().notNull(),
    lastInactivityReminderAt: timestamp("lastInactivityReminderAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("photoAlbums_user_name_unique").on(table.userId, table.name), index("photoAlbums_user_archived_created_idx").on(table.userId, table.isArchived, table.createdAt)]
);

export const photoAlbumItems = mysqlTable(
  "photoAlbumItems",
  {
    id: int("id").autoincrement().primaryKey(),
    albumId: int("albumId").notNull(),
    transformId: int("transformId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("photoAlbumItems_album_transform_unique").on(table.albumId, table.transformId), index("photoAlbumItems_album_idx").on(table.albumId)]
);

/** Reusable private directions, never copied into public community metadata. */
export const photoPromptFavorites = mysqlTable(
  "photoPromptFavorites",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    instruction: varchar("instruction", { length: 360 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("photoPromptFavorites_user_instruction_unique").on(table.userId, table.instruction), index("photoPromptFavorites_user_created_idx").on(table.userId, table.createdAt)]
);

/** Private in-app events, including actions performed by community moderators. */
export const userNotifications = mysqlTable(
  "userNotifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    kind: mysqlEnum("kind", ["community_moderation", "account_activity", "album_inactivity"]).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    content: varchar("content", { length: 360 }).notNull(),
    relatedPostId: int("relatedPostId"),
    relatedAlbumId: int("relatedAlbumId"),
    isRead: boolean("isRead").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("userNotifications_user_read_created_idx").on(table.userId, table.isRead, table.createdAt)]
);

/** Per-user choices for which private in-app notification categories may be created. */
export const userNotificationPreferences = mysqlTable(
  "userNotificationPreferences",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    communityModeration: boolean("communityModeration").notNull().default(true),
    accountActivity: boolean("accountActivity").notNull().default(true),
    productUpdates: boolean("productUpdates").notNull().default(false),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("userNotificationPreferences_user_unique").on(table.userId)]
);

/** Durable mapping for platform-managed project-level scheduled callbacks. */
export const scheduledJobs = mysqlTable(
  "scheduledJobs",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    taskUid: varchar("taskUid", { length: 65 }).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("scheduledJobs_name_unique").on(table.name), uniqueIndex("scheduledJobs_task_uid_unique").on(table.taskUid)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PhotoTransform = typeof photoTransforms.$inferSelect;
export type InsertPhotoTransform = typeof photoTransforms.$inferInsert;
