import { pgTable, serial, text, integer, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import type { InfrastructureResource } from "@lookout/core";
import { projects } from "./schema";

export const infrastructureResources = pgTable("infrastructure_resources", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  provider: text("provider").notNull(),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  parentKey: text("parent_key"),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  linkMethod: text("link_method"),
  snapshot: jsonb("snapshot").$type<InfrastructureResource>().notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, table => [
  index("infra_provider_idx").on(table.provider),
  index("infra_project_idx").on(table.projectId)
]);

export const infrastructureFindings = pgTable("infrastructure_findings", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id").notNull().references(() => infrastructureResources.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  kind: text("kind").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  explanation: text("explanation").notNull(),
  evidenceUrl: text("evidence_url").notNull(),
  status: text("status").notNull().default("open"),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull()
}, table => [
  uniqueIndex("infra_finding_resource_key_uq").on(table.resourceId, table.key),
  index("infra_finding_status_idx").on(table.status)
]);

export const sourceSyncRuns = pgTable("source_sync_runs", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  status: text("status").notNull(),
  count: integer("count").notNull().default(0),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true })
}, table => [index("source_sync_provider_idx").on(table.provider, table.startedAt)]);
