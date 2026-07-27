const blockedKeys = /password|token|cookie|authorization|bankAccount/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, blockedKeys.test(key) ? "[REDACTED]" : redact(child)]),
    );
  }
  return value;
}

export function log(
  level: "info" | "warn" | "error",
  message: string,
  context: Record<string, unknown> = {},
) {
  const safeContext = redact(context) as Record<string, unknown>;
  console[level](JSON.stringify({ level, message, ...safeContext, timestamp: new Date().toISOString() }));
}
