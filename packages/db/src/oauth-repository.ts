import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDatabase } from "./client";

const fingerprint = (raw: string) => createHash("sha256").update(raw).digest("hex");
const newToken = (prefix: string) => prefix + randomBytes(32).toString("hex");

export type OAuthCode = {
  clientId: string; redirectUri: string; codeChallenge: string;
  resource: string; scope: string;
};
export async function createOAuthCode(data: OAuthCode) {
  const code = newToken("lk_oac_");
  await getDatabase().execute(sql`
    INSERT INTO lookout_oauth_codes
      (code_hash, client_id, redirect_uri, code_challenge, resource, scope, expires_at)
    VALUES (${fingerprint(code)}, ${data.clientId}, ${data.redirectUri},
      ${data.codeChallenge}, ${data.resource}, ${data.scope}, now() + interval '5 minutes')
  `);
  return code;
}

export async function consumeOAuthCode(
  raw: string, clientId: string, redirectUri: string, resource: string
): Promise<{ codeChallenge: string; scope: string } | null> {
  if (!/^lk_oac_[a-f0-9]{64}$/.test(raw)) return null;
  const rows = await getDatabase().execute(sql`
    DELETE FROM lookout_oauth_codes
    WHERE code_hash = ${fingerprint(raw)} AND client_id = ${clientId}
      AND redirect_uri = ${redirectUri} AND resource = ${resource}
      AND expires_at > now()
    RETURNING code_challenge, scope
  `);
  const row = rows[0];
  return row ? { codeChallenge: String(row.code_challenge), scope: String(row.scope) } : null;
}

export async function issueOAuthTokens(clientId: string, resource: string, scope: string) {
  const access = newToken("lk_oat_");
  const refresh = newToken("lk_ort_");
  await getDatabase().transaction(async tx => {
    await tx.execute(sql`
      INSERT INTO lookout_oauth_access_tokens (token_hash, client_id, resource, scope, expires_at)
      VALUES (${fingerprint(access)}, ${clientId}, ${resource}, ${scope}, now() + interval '1 hour')
    `);
    await tx.execute(sql`
      INSERT INTO lookout_oauth_refresh_tokens (token_hash, client_id, resource, scope, expires_at)
      VALUES (${fingerprint(refresh)}, ${clientId}, ${resource}, ${scope}, now() + interval '30 days')
    `);
  });
  return { access_token: access, token_type: "Bearer" as const,
    expires_in: 3600, refresh_token: refresh, scope };
}

export async function rotateOAuthRefreshToken(raw: string, clientId: string, resource: string) {
  if (!/^lk_ort_[a-f0-9]{64}$/.test(raw)) return null;
  const rows = await getDatabase().execute(sql`
    DELETE FROM lookout_oauth_refresh_tokens
    WHERE token_hash = ${fingerprint(raw)} AND client_id = ${clientId}
      AND resource = ${resource} AND expires_at > now()
    RETURNING scope
  `);
  if (!rows[0]) return null;
  return issueOAuthTokens(clientId, resource, String(rows[0].scope));
}

export async function authoriseOAuthAccessToken(raw: string, resource: string): Promise<boolean> {
  if (!/^lk_oat_[a-f0-9]{64}$/.test(raw)) return false;
  const rows = await getDatabase().execute(sql`
    SELECT token_hash FROM lookout_oauth_access_tokens
    WHERE token_hash = ${fingerprint(raw)} AND resource = ${resource}
      AND scope LIKE '%lookout:read%' AND expires_at > now()
    LIMIT 1
  `);
  return rows.length > 0;
}

export function verifyPKCE(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) return false;
  const digest = createHash("sha256").update(verifier).digest("base64url");
  return timingSafeEqual(Buffer.from(digest), Buffer.from(challenge));
}
