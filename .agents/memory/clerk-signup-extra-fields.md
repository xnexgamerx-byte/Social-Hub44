---
name: Clerk sign-up extra fields (username/gender/age)
description: How to collect extra profile fields at sign-up with @clerk/expo v3 experimental hooks, and the cross-account replay pitfall.
---

# Collecting extra fields during Clerk sign-up

The `@clerk/expo` v3 experimental `useSignUp()` returns a composite `signUp` whose
`signUp.password({ emailAddress, password })` only forwards `identifier` + `password`
to the API — it does NOT accept `username` or `unsafeMetadata`. So extra sign-up
fields cannot be set during the sign-up flow itself.

**Approach used:** collect username/gender/age in the sign-up screen, stash them in
AsyncStorage, then apply to the Clerk **User** via `clerkUser.update({ username,
unsafeMetadata })` from AppContext once the session is active. `User.update` is the
stable API that accepts both `username` and `unsafeMetadata`.

**Why scope the stash by email:** a naive global AsyncStorage key (e.g.
`"pendingProfile"`) applied to *any* later `clerkUser` is an account-integrity bug —
if sign-up is abandoned, the next user to sign in on that device gets the stale
profile replayed onto their account. Store `{ email, ... }` and only apply when
`clerkUser.primaryEmailAddress.emailAddress` matches.

**How to apply (retry-safe):** only remove the stash AFTER a successful update. If
the full update fails (e.g. username already taken), retry with metadata-only so
gender/age aren't lost; keep the blob on transient failure so it retries on next
mount. Effect depends on `[clerkUser]`.
