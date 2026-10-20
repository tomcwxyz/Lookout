/** Manual scans require an exact same-origin browser POST (CSRF protection). */
export function sameOriginPost(origin: string | null, expectedOrigin: string): boolean {
  return origin !== null && origin === expectedOrigin;
}
