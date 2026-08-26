/**
 * Structural shapes for the parts of the SSO result we inspect. Declared here
 * rather than imported: @clerk/types is a transitive package, not a direct
 * dependency, so importing from it would break the build.
 */
interface SsoStatusResource {
  status?: string | null;
  missingFields?: string[];
  unverifiedFields?: string[];
}

/**
 * Outcome of a social sign-in attempt.
 *
 * `startSSOFlow` resolves with `createdSessionId: null` in several very
 * different situations — the user closed the browser, Clerk needs more fields
 * before it can create the account, or another factor is outstanding. Treating
 * them all as "do nothing" is what made Google sign-in bounce back to the app
 * with no session and no explanation.
 */
export type SsoOutcome =
  | { kind: "session"; sessionId: string }
  | { kind: "cancelled" }
  | { kind: "incomplete"; message: string };

interface SsoResult {
  createdSessionId: string | null;
  authSessionResult?: { type?: string } | null;
  signIn?: SsoStatusResource;
  signUp?: SsoStatusResource;
}

/** Human-readable reason an OAuth flow stopped short of a session. */
function describeIncomplete(result: SsoResult): string {
  const signUp = result.signUp;
  const signIn = result.signIn;

  if (signUp?.status === "missing_requirements") {
    // Clerk lists exactly what it still needs; showing it turns a dead end
    // into something actionable.
    const missing = [
      ...(signUp.missingFields ?? []),
      ...(signUp.unverifiedFields ?? []),
    ];
    const labels: Record<string, string> = {
      password: "كلمة مرور",
      email_address: "بريد إلكتروني",
      phone_number: "رقم هاتف",
      username: "اسم مستخدم",
      first_name: "الاسم الأول",
      last_name: "اسم العائلة",
    };
    const named = missing.map((f) => labels[f] ?? f).join("، ");
    return named
      ? `الحساب يحتاج ${named} لإكماله. أنشئ حساباً بالبريد بدلاً من Google.`
      : "تعذّر إكمال إنشاء الحساب عبر Google.";
  }

  if (signIn?.status && signIn.status !== "complete") {
    return `تسجيل الدخول يحتاج خطوة إضافية (${signIn.status}).`;
  }
  if (signUp?.status && signUp.status !== "complete") {
    return `إنشاء الحساب يحتاج خطوة إضافية (${signUp.status}).`;
  }
  return "لم تكتمل عملية Google. حاول مرة أخرى أو استخدم البريد الإلكتروني.";
}

/**
 * Interpret a `startSSOFlow` result. Activating the session stays with the
 * caller so navigation keeps flowing through AuthGate.
 */
export function readSsoResult(result: SsoResult): SsoOutcome {
  if (result.createdSessionId) {
    return { kind: "session", sessionId: result.createdSessionId };
  }
  // Closing the in-app browser is a deliberate choice, not an error worth
  // shouting about.
  const type = result.authSessionResult?.type;
  if (type === "cancel" || type === "dismiss" || type === "locked") {
    return { kind: "cancelled" };
  }
  return { kind: "incomplete", message: describeIncomplete(result) };
}
