/**
 * Pull the server's own message out of a failed request.
 *
 * Every API error body is `{ error: string }` in Arabic, so surfacing it beats
 * any generic string the client could invent. Falls back only when the shape
 * is unexpected (a network failure, a proxy error page).
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: string } } })?.response?.data;
  if (typeof data?.error === "string" && data.error.trim()) return data.error;
  const message = (err as { message?: string })?.message;
  if (typeof message === "string" && message.trim() && !message.startsWith("HTTP")) {
    return message;
  }
  return fallback;
}
