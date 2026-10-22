import { bigint, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { CheckpointInput } from "@lookout/core";
import { projects, agentAccessTokens } from "./schema";
import { portfolioProjects } from "./portfolio-schema";

export const agentContributions = pgTable("agent_contributions", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  portfolioProjectId: integer("portfolio_project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),
  observedProjectId: integer("observed_project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tokenId: integer("token_id").notNull().references(() => agentAccessTokens.id),
  eventId: text("event_id").notNull(),
  kind: text("kind").notNull(),
  agent: text("agent").notNull(),
  title: text("title").notNull(),
  payload: jsonb("payload").$type<CheckpointInput>().notNull(),
  payloadHash: text("payload_hash").notNull(),
  status: text("status").notNull().default("proposed"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull()
}, t => [
  uniqueIndex("agent_contributions_project_event_uq").on(t.portfolioProjectId, t.eventId),
  index("agent_contributions_project_time_idx").on(t.portfolioProjectId, t.recordedAt),
  index("agent_contributions_observed_idx").on(t.observedProjectId, t.recordedAt)
]);
