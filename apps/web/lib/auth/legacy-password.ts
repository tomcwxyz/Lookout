import { timingSafeEqual } from "node:crypto";

/** Recovery proves knowledge of the previous Lookout owner credential.
 * The value is never logged, returned or persisted in the database.
 */
export function validLegacyRecoveryPassword(
  supplied: unknown, configured: string | undefined
): boolean {
  if (typeof supplied !== "string" || !configured || configured.length < 16 ||
      supplied.length > 1024) return false;
  const actual = Buffer.from(supplied, "utf8");
  const expected = Buffer.from(configured, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
