type RequestEvent = {
  event: "http.request";
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
};

export function recordRequestEvent(event: RequestEvent): void {
  const level = event.status >= 500 ? "error" : event.status >= 400 ? "warn" : "info";
  const payload = JSON.stringify({
    level,
    ...event,
    durationMs: Math.max(0, Math.round(event.durationMs)),
    recordedAt: new Date().toISOString(),
  });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.info(payload);
}

export function safeRoute(pathname: string): string {
  return pathname
    .split("/")
    .map((part) => {
      if (!part) return part;
      if (/^[0-9a-f-]{20,}$/i.test(part)) return ":id";
      if (/^(room|connection|circle|project|profile|user|cohort|invite|export|deletion)_[a-z0-9_.:-]+$/i.test(part)) return ":id";
      return part.length > 80 ? ":value" : part;
    })
    .join("/");
}
