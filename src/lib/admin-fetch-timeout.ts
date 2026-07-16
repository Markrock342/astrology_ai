/** Thai error when an adminFetch AbortController times out. */
export function adminFetchTimeoutMessage(timeoutMs: number): string {
  return `หมดเวลารอการตอบ (${Math.round(timeoutMs / 1000)} วินาที) — ลองอีกครั้งหรือตรวจ API key`;
}
