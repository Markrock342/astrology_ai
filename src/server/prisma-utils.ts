/** Prisma pool / connectivity errors that are worth retrying once. */
export function isPrismaPoolError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const message = "message" in err ? String((err as Error).message) : "";
  const code = "code" in err ? String((err as { code?: string }).code) : "";
  return (
    message.includes("connection pool") ||
    message.includes("Timed out fetching a new connection") ||
    code === "P1001" ||
    code === "P2024"
  );
}

/** Short backoff retry for transient pool contention on warm serverless instances. */
export async function withPrismaRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 150;
  let last: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isPrismaPoolError(err) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }

  throw last;
}
