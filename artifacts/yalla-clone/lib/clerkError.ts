/**
 * Clerk reports failures either as a returned `error` object or a thrown one,
 * and nests the human-readable text differently per shape. Surface that text
 * instead of a generic message — a swallowed cause makes instance
 * misconfiguration (a disabled strategy, a required field the form never
 * collects) impossible to tell apart from wrong credentials.
 */
export function clerkErrorMessage(err: unknown, fallback: string): string {
  const e = err as {
    errors?: { longMessage?: string; message?: string }[];
    message?: string;
  };
  const first = e?.errors?.[0];
  return first?.longMessage ?? first?.message ?? e?.message ?? fallback;
}
