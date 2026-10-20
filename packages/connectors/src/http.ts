/** Read-only, bounded HTTP client. It accepts only a fixed provider origin and GET paths. */
export class ReadOnlyProviderClient {
  constructor(private readonly base: string, private readonly token: string, private readonly http: typeof fetch = fetch) {
    if (!token) throw new Error("Provider API token is required");
  }

  async get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Provider path must be relative");
    const url = new URL(path, this.base);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const response = await this.http(url.toString(), {
      method: "GET",
      headers: {
        Authorization: "Bearer " + this.token,
        Accept: "application/json",
        "User-Agent": "lookout-agent/0.2"
      },
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 180);
      throw new Error(url.hostname + " HTTP " + response.status + " on " + url.pathname + ": " + detail);
    }
    return await response.json() as T;
  }
}
