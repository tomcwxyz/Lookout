import { createHash, timingSafeEqual } from "node:crypto";
import { authoriseAgentToken, authoriseOAuthAccessToken, authoriseOrganisationMcpReadToken } from "@lookout/db";
import { RESOURCE } from "./chatgpt-oauth";

export type LegacyHostedMcpIdentity =
  | { scope: "owner"; canContribute?: boolean; clientId?: string }
  | { scope: "project"; projectId: number; tokenId: number };

export type HostedMcpIdentity = LegacyHostedMcpIdentity | {scope:"organisation";organisationId:number;connectionId:number;userId:number;name:string};

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
  if (raw.startsWith("lko_")) {
    if (process.env.LOOKOUT_MULTIUSER_LAB !== "enabled") return null;
    const session=await authoriseOrganisationMcpReadToken(raw);
    return session ? {scope:"organisation",...session} : null;
  }
  if (ownerTokenMatches(raw, secret)) return { scope: "owner" };
  if (raw.startsWith("lk_oat_")) {
    const session = await authoriseOAuthAccessToken(raw, RESOURCE);
    return session ? { scope: "owner", canContribute: session.scope.split(/\s+/).includes("lookout:contribute"), clientId: session.clientId } : null;
  }
  if (!raw.startsWith("lkp_")) return null;
  const agent = await authoriseAgentToken(raw);
  return agent ? { scope: "project", projectId: agent.projectId, tokenId: agent.id } : null;
}
