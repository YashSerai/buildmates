export type R2Like = {
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  delete(key: string): Promise<void>;
};

export async function runR2Diagnostic(bucket: R2Like, actorKey: string) {
  const key = `capability-checks/${actorKey}/${crypto.randomUUID()}.txt`;
  const nonce = crypto.randomUUID();
  await bucket.put(key, nonce, { httpMetadata: { contentType: "text/plain" } });
  try {
    const object = await bucket.get(key);
    if (!object || (await object.text()) !== nonce) throw new Error("R2 read-after-write diagnostic failed");
  } finally {
    await bucket.delete(key);
  }
  return { binding: "ASSETS", put: true, read: true, delete: true } as const;
}
