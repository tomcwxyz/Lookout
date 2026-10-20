import { pgTable, serial, text, integer, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import type { ProjectSnapshot } from "@lookout/core";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  providerId: text("provider_id").notNull().unique(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  snapshot: jsonb("snapshot").$type<ProjectSnapshot>().notNull(),
  snapshotHash: text("snapshot_hash").notNull(),
  ruleSummary: text("rule_summary").notNull(),
  aiBrief: text("ai_brief"),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const attentionItems = pgTable("attention_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  kind: text("kind").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  explanation: text("explanation").notNull(),
  evidenceUrl: text("evidence_url").notNull(),
  status: text("status").notNull().default("open"),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull()
}, table => [uniqueIndex("attention_project_key_uq").on(table.projectId, table.key)]);

export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull(),
  projectCount: integer("project_count").notNull().default(0),
  error: text("error")
});

export const ideas = pgTable("ideas", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  note: text("note"),
  status: text("status").notNull().default("inbox"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

/** Explicit user confirmations override suggested GitHub interpretations. */
export const workDecisions = pgTable("work_decisions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  workKey: text("work_key").notNull(),
  status: text("status").notNull(),
  note: text("note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, table => [uniqueIndex("work_decision_project_key_uq").on(table.projectId, table.workKey)]);

/** Scoped API credentials never contain a Lookout database secret. */
export const agentAccessTokens = pgTable("agent_access_tokens", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  prefix: text("prefix").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true })
});

export const agentCheckpoints = pgTable("agent_checkpoints", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tokenId: integer("token_id").notNull().references(() => agentAccessTokens.id),
  eventId: text("event_id").notNull(),
  agent: text("agent").notNull(),
  title: text("title").notNull(),
  payload: jsonb("payload").$type<import("@lookout/core").CheckpointInput>().notNull(),
  payloadHash: text("payload_hash").notNull(),
  status: text("status").notNull().default("proposed"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull()
}, t => [uniqueIndex("agent_checkpoint_event_uq").on(t.projectId,t.eventId)]);
