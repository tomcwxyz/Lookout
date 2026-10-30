import { timingSafeEqual } from "node:crypto";

/** Recovery proves knowledge of the previous Lookout owner credential.
 * The value is never logged, returned or persisted in the database.
 */
/** Legacy Basic auth accepted any non-empty configured password. Recovery must\n * check the same credential, even if it predates current length recommendations. */\nexport function legacyRecoveryConfigured(configured: string | undefined): boolean {\n  return typeof configured === "string" && configured.length > 0;\n}\n\nexport function validLegacyRecoveryPassword(
  supplied: unknown, configured: string | undefined
): boolean {
  if (typeof supplied !== "string" || !legacyRecoveryConfigured(configured) || supplied.length === 0 ||
      supplied.length > 1024) return false;
  const actual = Buffer.from(supplied, "utf8");
  const expected = Buffer.from(configured, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
