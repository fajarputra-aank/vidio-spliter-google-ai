import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
    title: varchar("title", { length: 120 }).notNull(),
    sourceKey: varchar("sourceKey", { length: 512 }).notNull(),
    sourceUrl: text("sourceUrl").notNull(),
    resultUrl: text("resultUrl"),
    status: mysqlEnum("status", ["processing", "completed", "failed"]).default("processing").notNull(),
    errorMessage: varchar("errorMessage", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  (table) => [index("photoTransforms_user_created_idx").on(table.userId, table.createdAt)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PhotoTransform = typeof photoTransforms.$inferSelect;
export type InsertPhotoTransform = typeof photoTransforms.$inferInsert;
