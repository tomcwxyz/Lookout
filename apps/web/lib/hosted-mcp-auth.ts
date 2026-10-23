import { createHash, timingSafeEqual } from "node:crypto";
import { authoriseAgentToken, authoriseOAuthAccessToken } from "@lookout/db";
import { RESOURCE } from "./chatgpt-oauth";

export type HostedMcpIdentity =
  | { scope: "owner" }
  | { scope: "project"; projectId: number; tokenId: number };

export function ownerTokenMatches(raw: string | null, secret: string | undefined): boolean {
  if (!raw || !secret || secret.length < 48 || raw.length > 512) return false;
  const a = createHash("sha256").update(raw).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

export function mcpBearer(header: string | null): string | null {
  const match = /^Bearer ([^\s]{1,512})$/.exec(header ?? "");
  return match?.[1] ?? null;
}

export async function authoriseHostedMcp(
  header: string | null,
  secret = process.env.LOOKOUT_MCP_OWNER_TOKEN
): Promise<HostedMcpIdentity | null> {
  const raw = mcpBearer(header);
  if (!raw) return null;
  if (ownerTokenMatches(raw, secret)) return { scope: "owner" };
  if (raw.startsWith("lk_oat_")) {
    return await authoriseOAuthAccessToken(raw, RESOURCE) ? { scope: "owner" } : null;
  }
  if (!raw.startsWith("lkp_")) return null;
  const agent = await authoriseAgentToken(raw);
  return agent ? { scope: "project", projectId: agent.projectId, tokenId: agent.id } : null;
}
