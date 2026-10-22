import { boolean, integer, pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { projects } from "./schema";

export const portfolioProjects = pgTable("portfolio_projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status"),
  statusNote: text("status_note"),
  statusConfirmedAt: timestamp("status_confirmed_at", { withTimezone: true }),
  legacyProjectId: integer("legacy_project_id").unique().references(() => projects.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
export const repositoryInventory = pgTable("repository_inventory", {
  providerId: text("provider_id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  visibility: text("visibility").notNull().default("unknown"),
  archived: boolean("archived").notNull().default(false),
  fork: boolean("fork").notNull().default(false),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  detailedAt: timestamp("detailed_at", { withTimezone: true }),
  inspectionError: text("inspection_error")
});
export const portfolioRepositoryLinks = pgTable("portfolio_repository_links", {
  repositoryProviderId: text("repository_provider_id").primaryKey().references(() => repositoryInventory.providerId, { onDelete: "cascade" }),
  portfolioProjectId: integer("portfolio_project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),
  linkedAt: timestamp("linked_at", { withTimezone: true }).defaultNow().notNull()
}, t => [index("portfolio_repo_project_idx").on(t.portfolioProjectId)]);
export const githubScanState = pgTable("github_scan_state", {
  id: integer("id").primaryKey(),
  nextOffset: integer("next_offset").notNull().default(0),
  inventoryCount: integer("inventory_count").notNull().default(0),
  lastInventoryAt: timestamp("last_inventory_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const portfolioInfrastructureLinks = pgTable("portfolio_infrastructure_links", {
  resourceKey: text("resource_key").primaryKey(),
  portfolioProjectId: integer("portfolio_project_id").notNull().references(() => portfolioProjects.id, { onDelete: "cascade" }),
  linkedAt: timestamp("linked_at", { withTimezone: true }).defaultNow().notNull()
}, t => [index("portfolio_infra_project_idx").on(t.portfolioProjectId)]);
