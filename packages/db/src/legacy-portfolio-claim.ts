import { sql } from "drizzle-orm";
import { getDatabase } from "./client";

/** Records only the owner organisation, not a new source of authorisation.
 * Caller MUST separately verify the previous admin credential and the
 * current Neon Auth session. Membership is checked again inside this transaction.
 */
export async function claimLegacyPortfolio(args: {
  issuer: string; subject: string; organisationId: number;
}) {
  if (!args.issuer.startsWith("https://") || !args.subject || args.subject.length > 512 ||
      !Number.isSafeInteger(args.organisationId) || args.organisationId < 1)
    throw new Error("Invalid recovery request");

  return getDatabase().transaction(async tx => {
    const members = await tx.execute(sql`
      SELECT m.user_id
      FROM lookout_auth_identities i
      JOIN lookout_users u ON u.id=i.user_id AND u.disabled_at IS NULL
      JOIN lookout_organisation_memberships m ON m.user_id=u.id
      WHERE i.issuer=${args.issuer} AND i.subject=${args.subject}
        AND m.organisation_id=${args.organisationId} AND m.role='owner'
      FOR UPDATE OF m
    `);
    if (members.length !== 1) throw new Error("Organisation owner session required");
    const userId = Number(members[0]!.user_id);

    // A single database row is the global claim lock, enforced by its primary key.
    const claimed = await tx.execute(sql`
      INSERT INTO lookout_legacy_portfolio_claim(id, organisation_id, claimed_by_user_id)
      VALUES (1, ${args.organisationId}, ${userId})
      ON CONFLICT DO NOTHING RETURNING id
    `);
    if (!claimed.length) {
      const existing = await tx.execute(sql`
        SELECT organisation_id, claimed_by_user_id
        FROM lookout_legacy_portfolio_claim WHERE id=1
      `);
      if (Number(existing[0]?.organisation_id) !== args.organisationId ||
          Number(existing[0]?.claimed_by_user_id) !== userId)
        throw new Error("Previous portfolio has already been claimed");
      return { alreadyClaimed: true, projectCount: 0 };
    }

    // Never inherit another tenant's assignments: a reviewed migration is
    // required rather than granting blanket access if any grants already exist.
    const previous = await tx.execute(sql`
      SELECT EXISTS(SELECT 1 FROM lookout_project_access) AS has_grants
    `);
    if (previous[0]?.has_grants) throw new Error("Portfolio has existing organisation assignments");

    const grants = await tx.execute(sql`
      INSERT INTO lookout_project_access(organisation_id, portfolio_project_id)
      SELECT ${args.organisationId}, p.id FROM portfolio_projects p
      ON CONFLICT DO NOTHING RETURNING portfolio_project_id
    `);
    return { alreadyClaimed: false, projectCount: grants.length };
  });
}

/** Call only after an organisation-authenticated session, for recovery UI. */
export async function getLegacyPortfolioClaim() {
  const rows = await getDatabase().execute(sql`
    SELECT organisation_id FROM lookout_legacy_portfolio_claim WHERE id=1
  `);
  return rows.length ? Number(rows[0]!.organisation_id) : null;
}
