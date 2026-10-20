/** Fail closed if the platform cron credential is missing or weak. */
export function cronAuthorised(authorization: string | null, secret: string | undefined): boolean {
  return Boolean(secret && secret.length >= 32 && authorization === "Bearer " + secret);
}
