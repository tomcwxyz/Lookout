import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { demoEvents, demoProjects, demoStories } from "../apps/web/app/demo/fixtures";

describe("isolated synthetic demo", () => {
 it("has unique fictional projects with linked synthetic repositories", () => {
  expect(demoProjects).toHaveLength(8);
  expect(new Set(demoProjects.map(project => project.id)).size).toBe(demoProjects.length);
  expect(demoProjects.every(project => project.repos.length > 0)).toBe(true);
  expect(demoProjects.every(project => !project.repos.some(repo => repo.includes("/")))).toBe(true);
 });
 it("links all events and guided stories to defined projects", () => {
  const ids = new Set(demoProjects.map(project => project.id));
  expect(demoEvents.every(event => ids.has(event.projectId))).toBe(true);
  expect(demoStories.every(story => ids.has(story.id))).toBe(true);
  expect(demoEvents.some(event => event.source === "agent" && !event.verified)).toBe(true);
  expect(demoEvents.some(event => event.source === "human" && event.verified)).toBe(true);
 });
 it("does not read production providers or secrets in fixture module", () => {
  const source = readFileSync("apps/web/app/demo/fixtures.ts", "utf8");
  expect(source).not.toMatch(/process\.env|DATABASE_URL|GITHUB_TOKEN|fetch\s*\(|@lookout\/db/);
 });
 it("limits public authentication bypass to the demo route", () => {
  const middleware = readFileSync("apps/web/middleware.ts", "utf8");
  expect(middleware).toContain('request.nextUrl.pathname === "/demo"');
  expect(middleware).not.toMatch(/startsWith\(["']\/demo/);
 });
});
