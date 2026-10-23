import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { listVerifiedIdentityOrganisations } from "@lookout/db";
import { getLabIdentity } from "./lab-server";

export const ACTIVE_ORGANISATION_COOKIE = "lookout-active-organisation";
export type LookoutContext =
  | { mode: "legacy" }
  | { mode: "account"; organisationId: number; name: string; role: string };

function validLegacyBasic(header: string | null, password: string | undefined): boolean {
  if (!header?.startsWith("Basic ") || !password) return false;
  try {
    const raw = Buffer.from(header.slice(6), "base64").toString("utf8");
    const index = raw.indexOf(":");
    if (index < 0) return false;
    const provided = Buffer.from(raw.slice(index + 1));
    const expected = Buffer.from(password);
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  } catch { return false; }
}

/** A common authentication boundary for Lookout's ORIGINAL pages.
 * Never interpret an organisation cookie as a grant: check current memberships
 * against a server-verified Neon Auth session on every request.
 */
export async function getLookoutContext(): Promise<LookoutContext> {
  if (process.env.LOOKOUT_MULTIUSER_LAB !== "enabled") return { mode: "legacy" };

  const header = (await headers()).get("authorization");
  if (validLegacyBasic(header, process.env.LOOKOUT_DASHBOARD_TOKEN)) return { mode: "legacy" };

  const identity = await getLabIdentity();
  if (!identity?.authenticated) redirect("/auth/sign-in");

  const organisations = await listVerifiedIdentityOrganisations(identity.issuer, identity.subject);
  if (!organisations.length) redirect("/lab");

  const raw = (await cookies()).get(ACTIVE_ORGANISATION_COOKIE)?.value;
  const selected = raw && /^[1-9][0-9]{0,12}$/.test(raw) ? Number(raw) : null;
  const organisation = organisations.find(item => item.id === selected)
    ?? (!raw && organisations.length === 1 ? organisations[0] : null);

  if (!organisation) redirect("/lab");
  return { mode: "account", organisationId: organisation.id,
    name: organisation.name, role: organisation.role };
}
