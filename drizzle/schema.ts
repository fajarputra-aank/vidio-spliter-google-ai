import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/** Core identity table for local, email-and-password application accounts. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  mustChangePassword: boolean("mustChangePassword").notNull().default(false),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  unlimitedTransforms: boolean("unlimitedTransforms").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** One-time, hashed security links; browser-facing tokens are never persisted in plaintext. */
export const authEmailTokens = mysqlTable(
  "authEmailTokens",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    purpose: mysqlEnum("purpose", ["email_verification", "password_reset"]).notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    consumedAt: timestamp("consumedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("authEmailTokens_hash_unique").on(table.tokenHash), index("authEmailTokens_user_purpose_created_idx").on(table.userId, table.purpose, table.createdAt)]
);

/** Minimal, hashed-email state for short-term login throttling. */
export const authLoginAttempts = mysqlTable(
  "authLoginAttempts",
  {
    id: int("id").autoincrement().primaryKey(),
    emailHash: varchar("emailHash", { length: 64 }).notNull(),
    failedCount: int("failedCount").notNull().default(0),
    windowStartedAt: timestamp("windowStartedAt").notNull(),
    lockedUntil: timestamp("lockedUntil"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("authLoginAttempts_email_hash_unique").on(table.emailHash), index("authLoginAttempts_locked_until_idx").on(table.lockedUntil)]
);

/** Owner-visible audit trail for authentication activity, excluding IP addresses and credentials. */
export const userSecurityEvents = mysqlTable(
  "userSecurityEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    kind: mysqlEnum("kind", ["login", "password_changed", "password_reset", "account_locked", "all_sessions_signed_out", "session_signed_out", "new_device_login"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("userSecurityEvents_user_created_idx").on(table.userId, table.createdAt)]
);

/** Monotonic version invalidates every local session issued before an account-security action. */
export const userSessionVersions = mysqlTable("userSessionVersions", {
  userId: int("userId").primaryKey(),
  version: int("version").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Private device session metadata. Exact IP addresses and coordinates are never persisted. */
export const userActiveSessions = mysqlTable(
  "userActiveSessions",
  {
    id: varchar("id", { length: 48 }).primaryKey(),
    userId: int("userId").notNull(),
    sessionVersion: int("sessionVersion").notNull(),
    deviceLabel: varchar("deviceLabel", { length: 160 }).notNull(),
    locationLabel: varchar("locationLabel", { length: 160 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
    revokedAt: timestamp("revokedAt"),
  },
  (table) => [index("userActiveSessions_user_active_idx").on(table.userId, table.revokedAt, table.lastSeenAt)]
);

/** Rotating mobile refresh tokens; plaintext tokens are never persisted. */
export const mobileRefreshTokens = mysqlTable(
  "mobileRefreshTokens",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    sessionId: varchar("sessionId", { length: 48 }).notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    lastUsedAt: timestamp("lastUsedAt"),
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("mobileRefreshTokens_hash_unique").on(table.tokenHash), index("mobileRefreshTokens_user_active_idx").on(table.userId, table.revokedAt, table.expiresAt), index("mobileRefreshTokens_session_idx").on(table.sessionId)]
);

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

/** Anonymous hourly counters for transient tRPC transport responses that were not JSON. */
export const trpcNonJsonMetricBuckets = mysqlTable(
  "trpcNonJsonMetricBuckets",
  {
    id: int("id").autoincrement().primaryKey(),
    hourStartedAt: timestamp("hourStartedAt").notNull(),
    operationGroup: mysqlEnum("operationGroup", ["auth", "brand", "other"]).notNull(),
    responseKind: mysqlEnum("responseKind", ["html", "text", "empty", "other"]).notNull(),
    statusClass: int("statusClass").notNull(),
    occurrences: int("occurrences").notNull().default(0),
    lastObservedAt: timestamp("lastObservedAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("trpcNonJsonMetricBuckets_bucket_unique").on(table.hourStartedAt, table.operationGroup, table.responseKind, table.statusClass), index("trpcNonJsonMetricBuckets_hour_idx").on(table.hourStartedAt)]
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
    secondarySourceKey: varchar("secondarySourceKey", { length: 512 }),
    secondarySourceUrl: text("secondarySourceUrl"),
    collaborationTemplate: varchar("collaborationTemplate", { length: 32 }),
    collaborationInviteId: int("collaborationInviteId"),
    collaborationLayout: text("collaborationLayout"),
    resultUrl: text("resultUrl"),
    retryOfTransformId: int("retryOfTransformId"),
    requestId: varchar("requestId", { length: 64 }),
    retryInstruction: varchar("retryInstruction", { length: 360 }),
    queuePosition: int("queuePosition"),
    providerAttemptCount: int("providerAttemptCount").notNull().default(1),
    autoRetryAt: timestamp("autoRetryAt"),
    status: mysqlEnum("status", ["processing", "completed", "failed", "cancelled"]).default("processing").notNull(),
    isHidden: boolean("isHidden").notNull().default(false),
    trashedAt: timestamp("trashedAt"),
    trashExpiresAt: timestamp("trashExpiresAt"),
    errorMessage: varchar("errorMessage", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  (table) => [index("photoTransforms_user_created_idx").on(table.userId, table.createdAt), index("photoTransforms_user_hidden_created_idx").on(table.userId, table.isHidden, table.createdAt), index("photoTransforms_user_trash_expiry_idx").on(table.userId, table.trashedAt, table.trashExpiresAt), index("photoTransforms_user_retry_idx").on(table.userId, table.retryOfTransformId, table.createdAt), index("photoTransforms_user_request_idx").on(table.userId, table.requestId)]
);

/** Last known provider capacity state. This contains no user, media, request, or provider diagnostic data. */
export const aiProviderCapacityStatus = mysqlTable("aiProviderCapacityStatus", {
  id: int("id").primaryKey(),
  status: mysqlEnum("status", ["unknown", "available", "unavailable"]).notNull().default("unknown"),
  observedAt: timestamp("observedAt").defaultNow().notNull(),
  retryAt: timestamp("retryAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Owner-scoped request to retry a failed collaboration after the provider becomes available. */
export const collaborationProviderRetryQueues = mysqlTable(
  "collaborationProviderRetryQueues",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    sourceTransformId: int("sourceTransformId").notNull(),
    priority: mysqlEnum("priority", ["admin", "standard"]).notNull(),
    status: mysqlEnum("status", ["queued", "processing", "completed", "cancelled"]).notNull().default("queued"),
    nextAttemptAt: timestamp("nextAttemptAt").notNull(),
    retryTransformId: int("retryTransformId"),
    notifiedAt: timestamp("notifiedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("collabProviderRetryQueue_source_unique").on(table.sourceTransformId),
    index("collabProviderRetryQueue_due_priority_idx").on(table.status, table.nextAttemptAt, table.priority, table.createdAt),
    index("collabProviderRetryQueue_user_created_idx").on(table.userId, table.createdAt),
  ]
);

/** Explicit, time-limited consent to join a private two-photo collaboration. No image data is stored here. */
export const photoCollaborationInvites = mysqlTable(
  "photoCollaborationInvites",
  {
    id: int("id").autoincrement().primaryKey(),
    inviterUserId: int("inviterUserId").notNull(),
    inviteeUserId: int("inviteeUserId").notNull(),
    template: varchar("template", { length: 32 }).notNull(),
    aspectRatio: varchar("aspectRatio", { length: 8 }).notNull(),
    style: varchar("style", { length: 24 }).notNull(),
    note: varchar("note", { length: 360 }),
    status: mysqlEnum("status", ["pending", "accepted", "declined", "used", "cancelled"]).notNull().default("pending"),
    transformId: int("transformId"),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    respondedAt: timestamp("respondedAt"),
  },
  (table) => [index("photoCollaborationInvites_invitee_status_created_idx").on(table.inviteeUserId, table.status, table.createdAt), index("photoCollaborationInvites_inviter_created_idx").on(table.inviterUserId, table.createdAt)]
);

/** Opaque, revocable access tokens for one completed collaboration result. Only a token hash is persisted. */
export const photoCollaborationShareLinks = mysqlTable(
  "photoCollaborationShareLinks",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    transformId: int("transformId").notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    watermarkText: varchar("watermarkText", { length: 72 }),
    watermarkLogoId: int("watermarkLogoId"),
    accessCount: int("accessCount").notNull().default(0),
    lastAccessedAt: timestamp("lastAccessedAt"),
    expiryNotifiedAt: timestamp("expiryNotifiedAt"),
    expiresAt: timestamp("expiresAt").notNull(),
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("photoCollaborationShareLinks_user_transform_created_idx").on(table.userId, table.transformId, table.createdAt), index("photoCollaborationShareLinks_token_expiry_idx").on(table.tokenHash, table.expiresAt)]
);

/** Administrator-configurable caps for active collaboration share links. A null cap is unlimited. */
export const collaborationShareRoleLimits = mysqlTable("collaborationShareRoleLimits", {
  role: mysqlEnum("role", ["user", "admin"]).primaryKey(),
  maxActiveLinks: int("maxActiveLinks"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Owner-scoped image assets used only as optional overlays on shared collaboration copies. */
export const photoCollaborationBrandLogos = mysqlTable(
  "photoCollaborationBrandLogos",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 48 }).notNull(),
    storageKey: varchar("storageKey", { length: 520 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("photoCollaborationBrandLogos_user_created_idx").on(table.userId, table.createdAt)]
);

/** Reusable private layout values for the two local collaboration inputs. */
export const photoCollaborationLayoutPresets = mysqlTable(
  "photoCollaborationLayoutPresets",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 48 }).notNull(),
    layout: text("layout").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => [index("photoCollaborationLayoutPresets_user_updated_idx").on(table.userId, table.updatedAt)]
);

/** Private record of a completed result shared by its owner; no destination account or external URL is stored. */
export const photoShareEvents = mysqlTable(
  "photoShareEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    transformId: int("transformId").notNull(),
    userId: int("userId").notNull(),
    platform: mysqlEnum("platform", ["whatsapp", "instagram", "facebook", "tiktok", "other"]).notNull(),
    caption: varchar("caption", { length: 500 }).notNull(),
    watermarkText: varchar("watermarkText", { length: 72 }),
    outcome: mysqlEnum("outcome", ["shared", "copied", "downloaded"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("photoShareEvents_user_transform_created_idx").on(table.userId, table.transformId, table.createdAt)]
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

/** User-submitted bank-transfer requests. Credits are issued only after an administrator approves. */
export const manualCreditOrders = mysqlTable(
  "manualCreditOrders",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    packId: varchar("packId", { length: 40 }).notNull(),
    credits: int("credits").notNull(),
    amountIdr: int("amountIdr").notNull(),
    proofUrl: text("proofUrl"),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
    reviewerUserId: int("reviewerUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    reviewedAt: timestamp("reviewedAt"),
  },
  (table) => [index("manualCreditOrders_user_created_idx").on(table.userId, table.createdAt), index("manualCreditOrders_status_created_idx").on(table.status, table.createdAt)]
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

/** Private owner feedback on completed collaboration results; never visible publicly. */
export const photoCollaborationResultReports = mysqlTable(
  "photoCollaborationResultReports",
  {
    id: int("id").autoincrement().primaryKey(),
    transformId: int("transformId").notNull(),
    reporterUserId: int("reporterUserId").notNull(),
    reason: mysqlEnum("reason", ["face_mismatch", "subject_changed", "background_issue", "other"]).notNull(),
    details: varchar("details", { length: 320 }),
    status: mysqlEnum("status", ["open", "reviewed"]).default("open").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    reviewedAt: timestamp("reviewedAt"),
  },
  (table) => [uniqueIndex("photoCollaborationResultReports_transform_reporter_unique").on(table.transformId, table.reporterUserId), index("photoCollaborationResultReports_status_created_idx").on(table.status, table.createdAt)]
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

/** Reusable private social captions; never exposed in community metadata or activity exports. */
export const photoCaptionTemplates = mysqlTable(
  "photoCaptionTemplates",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 60 }).notNull(),
    caption: varchar("caption", { length: 500 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("photoCaptionTemplates_user_name_unique").on(table.userId, table.name), index("photoCaptionTemplates_user_created_idx").on(table.userId, table.createdAt)]
);

/** Reusable private watermark settings; the original result file is never altered. */
export const photoWatermarkPresets = mysqlTable(
  "photoWatermarkPresets",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 60 }).notNull(),
    text: varchar("text", { length: 72 }).notNull(),
    position: mysqlEnum("position", ["top-left", "top-right", "center", "bottom-left", "bottom-right"]).notNull(),
    size: int("size").notNull(),
    font: mysqlEnum("font", ["sans", "serif", "mono"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("photoWatermarkPresets_user_name_unique").on(table.userId, table.name), index("photoWatermarkPresets_user_created_idx").on(table.userId, table.createdAt)]
);

/** Active presets are brand-managed and readable in the share dialog by every user. */
export const globalWatermarkPresets = mysqlTable(
  "globalWatermarkPresets",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 60 }).notNull(),
    text: varchar("text", { length: 72 }).notNull(),
    position: mysqlEnum("position", ["top-left", "top-right", "center", "bottom-left", "bottom-right"]).notNull(),
    size: int("size").notNull(),
    font: mysqlEnum("font", ["sans", "serif", "mono"]).notNull(),
    isActive: boolean("isActive").notNull().default(true),
    sortOrder: int("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("globalWatermarkPresets_name_unique").on(table.name), index("globalWatermarkPresets_active_order_idx").on(table.isActive, table.sortOrder)]
);

/** Server-owned background choices reserved for administrator collaboration work. */
export const collaborationBrandBackgroundPresets = mysqlTable(
  "collaborationBrandBackgroundPresets",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 60 }).notNull(),
    background: mysqlEnum("background", ["studio-ivory", "soft-gray", "charcoal", "cafe", "garden", "office"]).notNull(),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("collaborationBrandBackgroundPresets_name_unique").on(table.name), index("collaborationBrandBackgroundPresets_active_idx").on(table.isActive)]
);

/** Append-only administrator activity for global watermark branding changes. */
export const globalWatermarkPresetAudits = mysqlTable(
  "globalWatermarkPresetAudits",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId").notNull(),
    presetId: int("presetId"),
    action: mysqlEnum("action", ["created", "updated", "reordered"]).notNull(),
    summary: varchar("summary", { length: 240 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("globalWatermarkPresetAudits_created_idx").on(table.createdAt), index("globalWatermarkPresetAudits_preset_created_idx").on(table.presetId, table.createdAt)]
);

/** Saved recipe IDs are private shortcuts and never exposed in community metadata. */
export const photoRecipeFavorites = mysqlTable(
  "photoRecipeFavorites",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    recipeId: varchar("recipeId", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("photoRecipeFavorites_user_recipe_unique").on(table.userId, table.recipeId), index("photoRecipeFavorites_user_created_idx").on(table.userId, table.createdAt)]
);

/** Administrator-managed recipe groups; recipe IDs stay server-validated. */
export const seasonalRecipeCollections = mysqlTable(
  "seasonalRecipeCollections",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 48 }).notNull().unique(),
    name: varchar("name", { length: 80 }).notNull(),
    season: mysqlEnum("season", ["ramadan", "lebaran"]).notNull(),
    description: varchar("description", { length: 240 }).notNull(),
    recipeIds: text("recipeIds").notNull(),
    isActive: boolean("isActive").notNull().default(true),
    startsAt: timestamp("startsAt"),
    endsAt: timestamp("endsAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("seasonalRecipeCollections_active_updated_idx").on(table.isActive, table.updatedAt), index("seasonalRecipeCollections_active_schedule_idx").on(table.isActive, table.startsAt, table.endsAt)]
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

/** Per-user opt-in cadence for automatic security summaries; delivery is deduplicated by period key. */
export const userSecuritySummaryPreferences = mysqlTable(
  "userSecuritySummaryPreferences",
  {
    userId: int("userId").primaryKey(),
    frequency: mysqlEnum("frequency", ["disabled", "daily", "weekly"]).notNull().default("disabled"),
    lastSentAt: timestamp("lastSentAt"),
    lastSentPeriodKey: varchar("lastSentPeriodKey", { length: 40 }),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("userSecuritySummaryPreferences_frequency_idx").on(table.frequency)]
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
