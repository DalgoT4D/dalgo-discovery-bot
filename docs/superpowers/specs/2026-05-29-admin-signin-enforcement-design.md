# Admin sign-in enforcement on chat landing — Design

**Date:** 2026-05-29
**Status:** Approved, ready for implementation plan

## Problem

On the chat landing page, a visitor can switch to "continue as admin", type any random email and password, click "Sign in as admin", and the chat starts anyway. Admin authentication is not actually enforced before a session is created.

The intended model — confirmed with the user — is:
- Normal users: type their email and start chatting (no auth). Works today.
- Admins: must already exist in the `admins` table (added by the system admin via `/admin/admins`), must sign in with their real credentials, only then can they start a chat.

The create-admin half of this model already works correctly via `/admin/admins` and `POST /api/admin/admins`. The hole is purely on the landing page.

## Root cause

Two issues stack:

1. **Client-side `signIn` is unreliable in NextAuth v5-beta.** [app/(landing)/page.tsx:70](app/(landing)/page.tsx#L70) calls `signIn('admin-credentials', { email, password, redirect: false })` and gates the next step on `result?.ok`. With NextAuth v5-beta and Credentials + `redirect: false`, the return shape does not reliably set `ok = false` on bad credentials, so the guard passes.

2. **`POST /api/intake` has no auth check.** [app/api/intake/route.ts:11](app/api/intake/route.ts#L11) validates only the email format and creates a `sessions` row plus a `leads` row for any email. So even if `signIn` had failed and the cookie was not set, the subsequent call to `startSession(email)` still creates a chat session.

The credential check in [lib/auth.ts:33-36](lib/auth.ts#L33-L36) is correct on its own — `findAdminByEmail` returns `null` for unknown emails, and `compare()` rejects mismatched passwords. The bug is only in the landing-page flow that consumes this auth.

## Goal

When a visitor clicks "Sign in as admin" on the landing page with credentials that do not match a row in the `admins` table, the chat must not start. The user must see "Invalid email or password" and stay on the landing page.

Only visitors whose credentials match an existing row in `admins` can proceed into a chat from the admin path.

## Non-goals

- No change to how admins are created. `/admin/admins` and `POST /api/admin/admins` already do this correctly.
- No `sessions.is_admin` column. Admin chats are not tagged or filtered out of `/admin/conversations` or `/admin/leads` in this change.
- No change to `lib/auth.ts`, `/signin`, `/api/auth/*`, or `/api/chat`.
- No change to the guest path. Anyone can still chat as a guest by entering their email.
- No password reset, email invite, or Google-SSO changes.

## Approach

The server is the authority. The landing page's admin path calls `signIn` to set the cookie, then immediately calls a new server route that uses `auth()` to verify the cookie actually represents a real admin. If verification fails, no session is created and the UI shows an error.

### New route: `POST /api/admin-intake`

A server-side, admin-gated mirror of `/api/intake`.

Behavior:
1. Call `await auth()` from `lib/auth.ts`.
2. If `session?.user?.email` is missing → return `401 { error: 'unauthorized' }`. Do not create any rows.
3. Otherwise, run the exact session-creation logic from `/api/intake`, using `session.user.email` as the email:
   - Lowercase + trim.
   - Email-keyed resume: `SELECT id FROM sessions WHERE email = $1 ORDER BY created_at DESC LIMIT 1`. If a row exists, return `{ session_id, resumed: true }`.
   - Otherwise, `INSERT INTO sessions (ip, email) VALUES ($1, $2) RETURNING id`.
   - `insertLead({ sessionId, email, intent: 'email_signup' })`.
   - Emit `session_started` and `lead_captured` telemetry.
   - Return `{ session_id, resumed: false }`.

The client may not supply an email — the server uses the authenticated session's email so a tampered client cannot start a session under someone else's identity.

### Landing page change

In [app/(landing)/page.tsx](app/(landing)/page.tsx), modify `onAdminSubmit`:

1. Call `signIn('admin-credentials', { email, password, redirect: false })` as today (this sets the NextAuth cookie if `authorize()` returned a user).
2. Instead of checking `result?.ok`, call `POST /api/admin-intake` with no body.
3. On `401`:
   - Show "Invalid email or password."
   - Call `signOut({ redirect: false })` to clear any half-set cookie so the admin badge doesn't appear on a subsequent guest session.
   - Stay on the landing page.
4. On `200`:
   - Read `{ session_id }` from the response.
   - Write `session_id` and `email` to `localStorage` (`dalgo_session_id`, `dalgo_email`) — same keys as today.
   - Route to `/chat/${session_id}`.

The guest path (`onGuestSubmit`) is untouched. It continues to call `POST /api/intake`.

### Why this fixes the bug

- The NextAuth v5-beta quirk in `signIn`'s return shape no longer matters — we ignore it.
- The server-side `auth()` check is authoritative. It only succeeds if `authorize()` in [lib/auth.ts:33-36](lib/auth.ts#L33-L36) returned a real user, which only happens for emails in the `admins` table with a matching bcrypt password.
- Even a direct `curl POST /api/admin-intake` without a valid NextAuth cookie gets a 401 and creates no rows.

## Files

- New: `app/api/admin-intake/route.ts`
- Modified: `app/(landing)/page.tsx` (add `signOut` import; rewrite `onAdminSubmit`)

No DB migrations. No schema changes. No changes to `lib/auth.ts` or `lib/db/queries/*`.

## Testing

### Vitest (server route)

Add `tests/api/admin-intake.test.ts`:
- Mocks `auth()` to return `null` → expect `401`, expect no row in `sessions` or `leads`.
- Mocks `auth()` to return a session with `user.email = 'a@b.test'` → expect `200`, expect a `sessions` row with that email, expect `resumed: false`.
- Mocks `auth()` returning a session with an email that already has a `sessions` row → expect `200` with `resumed: true` and no new row.

### Manual smoke

1. With local DB seeded and no admin signed in: open `/`, click "or continue as admin", enter `random@x.test` / `wrongpass`. Expect "Invalid email or password" inline, no redirect, no row in `sessions` with that email.
2. As the env-seeded system admin (or any admin created via `/admin/admins`): same flow with real credentials → routes to `/chat/<id>`, admin badge visible in the chat header.
3. Sign out from `/admin`, return to `/`, switch to admin, try random creds again → still rejected.
4. As a guest from `/`: enter `me@ngo.org` with no password field shown → chat starts as before.

## Risks and notes

- **`signIn` cookie side-effect on failed admin sign-in.** In NextAuth v5-beta, a failed Credentials `authorize()` should not set a session cookie at all, so `signOut` on the `401` branch is defensive — but cheap and avoids a subtle "guest chat thinks I'm admin" state if the v5-beta behavior shifts.
- **`/api/intake` remains open.** This is intentional: guests are anonymous. Anyone who knows the endpoint can still create a guest session. That is the current product behavior and not in scope here.
- **No `is_admin` tag on admin chats.** Their conversations and leads will still appear in admin views alongside real NGO leads. If this becomes noisy, a follow-up can add `sessions.is_admin` and exclude these from `/admin/leads`.
