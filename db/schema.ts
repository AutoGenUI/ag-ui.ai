import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const news = sqliteTable("news", {
  slug: text("slug").primaryKey(),
  canonicalUrl: text("canonical_url").notNull().unique(),
  status: text("status").notNull(),
  eventDate: text("event_date").notNull(),
  project: text("project").notNull(),
  category: text("category").notNull(),
  payload: text("payload").notNull(),
  hash: text("hash").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const revisions = sqliteTable("revisions", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  hash: text("hash").notNull(),
  payload: text("payload").notNull(),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
});
export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  url: text("url").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  checkedAt: text("checked_at"),
  successfulAt: text("successful_at"),
  error: text("error"),
});
export const trends = sqliteTable("trends", {
  slug: text("slug").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  result: text("result"),
});
export const subscribers = sqliteTable("subscribers", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  locale: text("locale").notNull(),
  topics: text("topics").notNull(),
  status: text("status").notNull(),
  tokenHash: text("token_hash"),
  tokenExpires: text("token_expires"),
  createdAt: text("created_at").notNull(),
  confirmedAt: text("confirmed_at"),
});
export const editions = sqliteTable("editions", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
});
export const deliveries = sqliteTable("deliveries", {
  id: text("id").primaryKey(),
  subscriberId: text("subscriber_id").notNull(),
  editionId: text("edition_id"),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  providerId: text("provider_id"),
  createdAt: text("created_at").notNull(),
  attemptedAt: text("attempted_at"),
  updatedAt: text("updated_at").notNull(),
  error: text("error"),
});
export const quota = sqliteTable("mail_quota", {
  day: text("day").primaryKey(),
  count: integer("count").notNull().default(0),
});
export const stats = sqliteTable(
  "stats_events",
  {
    id: text("id").primaryKey(),
    day: text("day").notNull(),
    path: text("path").notNull(),
    kind: text("kind").notNull(),
    visitor: text("visitor").notNull(),
    source: text("source"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("stats_dedupe").on(t.id, t.kind)],
);
export const limits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  expiresAt: integer("expires_at").notNull(),
});
