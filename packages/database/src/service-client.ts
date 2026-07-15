export type ServiceAssertionProvider = (input: { action: string; scope: string }) => Promise<string>;

export class BuildmatesDataServiceClient {
  constructor(
    private readonly baseUrl: string,
    private readonly assertion: ServiceAssertionProvider,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async request<T>(input: { action: string; scope: string; path: string; method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown }): Promise<T> {
    const token = await this.assertion({ action: input.action, scope: input.scope });
    const response = await this.fetcher(new URL(input.path, this.baseUrl), {
      method: input.method ?? (input.body === undefined ? "GET" : "POST"),
      headers: { authorization: `Bearer ${token}`, accept: "application/json", ...(input.body === undefined ? {} : { "content-type": "application/json" }) },
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
    });
    if (!response.ok) throw new DataServiceError(response.status, await safeError(response));
    return response.json() as Promise<T>;
  }
}

export class DataServiceError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = "DataServiceError"; }
}

async function safeError(response: Response): Promise<string> {
  try { return String((await response.json() as { error?: unknown }).error ?? `data_service_${response.status}`); }
  catch { return `data_service_${response.status}`; }
}
