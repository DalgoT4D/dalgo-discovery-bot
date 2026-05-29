# Admin sign-in enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the landing page's "Sign in as admin" path actually reject random credentials by adding a server-authoritative `POST /api/admin-intake` endpoint and gating the chat-start on its response.

**Architecture:** A new server route (`app/api/admin-intake/route.ts`) calls NextAuth `auth()` to confirm the caller has a real admin session (from the `admins` table). It then runs the same session-create + lead-insert logic as `/api/intake`, but using the server-trusted email from the auth session. The landing page (`app/(landing)/page.tsx`) still calls client `signIn()` to set the NextAuth cookie, but stops trusting `signIn`'s flaky v5-beta return value — instead it calls `admin-intake` and only proceeds to `/chat/<id>` on `200`. On `401` it shows "Invalid email or password" and signs the user out to clear any half-state cookie.

**Tech Stack:** Next.js 16 App Router, React 19, NextAuth v5 beta, raw `pg`, Vitest (with `vi.mock('@/lib/auth')`), TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-29-admin-signin-enforcement-design.md`

---

## File Structure

- **Create:** `app/api/admin-intake/route.ts` — server-authoritative admin intake. Calls `auth()`, 401s if absent, else creates/resumes a session using the server-trusted email.
- **Create:** `tests/api/admin-intake.test.ts` — Vitest integration test against the real DB (mirrors `tests/api/intake.test.ts` style); mocks `@/lib/auth` to simulate auth states.
- **Modify:** `app/(landing)/page.tsx` — replace `onAdminSubmit`'s reliance on `signIn`'s return shape with a server-authoritative check via `POST /api/admin-intake`; add `signOut` import; clear any half-set cookie on `401`.

No DB migrations, no schema changes, no other files touched.

---

## Task 1: Server route — `/api/admin-intake` returns 401 when no admin session

**Files:**
- Create: `app/api/admin-intake/route.ts`
- Test: `tests/api/admin-intake.test.ts`

- [ ] **Step 1: Write the failing test (auth absent → 401)**

Create `tests/api/admin-intake.test.ts`:

```ts
import { describe, it, expect, afterAll, vi, beforeEach } from 'vitest';
import 'dotenv/config';
import { pool, query } from '@/lib/db/client';

const authMock = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: () => authMock(),
}));

// Imported after vi.mock so the route picks up the mocked module.
import { POST } from '@/app/api/admin-intake/route';

function mockReq(): Request {
  return new Request('http://test/api/admin-intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/admin-intake', () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it('returns 401 when there is no authenticated session', async () => {
    authMock.mockResolvedValue(null);

    const res = await POST(mockReq() as any);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('unauthorized');

    // No DB rows should have been created.
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM sessions WHERE email LIKE 'admintest+%@example.org'`,
    );
    expect(rows[0]?.count).toBe('0');
  });

  afterAll(async () => {
    await pool().end();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/admin-intake.test.ts`
Expected: FAIL — the import of `@/app/api/admin-intake/route` cannot be resolved because the file doesn't exist yet (or, in some setups, the test file itself fails to compile). Either way, the suite must not pass.

- [ ] **Step 3: Create the route with just the auth check**

Create `app/api/admin-intake/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // Session-create logic added in Task 2.
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/api/admin-intake.test.ts`
Expected: PASS — the 401 case is now correctly handled.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin-intake/route.ts tests/api/admin-intake.test.ts
git commit -m "feat(admin-intake): 401 when no admin session"
```

---

## Task 2: Server route — create session + lead on authenticated POST

**Files:**
- Modify: `app/api/admin-intake/route.ts`
- Test: `tests/api/admin-intake.test.ts`

- [ ] **Step 1: Write the failing test (auth present → 200, creates session + lead)**

Append to `tests/api/admin-intake.test.ts` inside the existing `describe` block (before `afterAll`):

```ts
  it('creates a session and lead for the authenticated admin email', async () => {
    const email = `admintest+${Date.now()}@example.org`;
    authMock.mockResolvedValue({ user: { email } });

    const res = await POST(mockReq() as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.session_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(json.resumed).toBe(false);

    const { rows: sessionRows } = await query<{ email: string | null }>(
      `SELECT email FROM sessions WHERE id = $1`,
      [json.session_id],
    );
    expect(sessionRows[0]?.email).toBe(email);

    const { rows: leadRows } = await query<{ intent: string; email: string }>(
      `SELECT intent, email FROM leads WHERE session_id = $1`,
      [json.session_id],
    );
    expect(leadRows[0]).toEqual({ intent: 'email_signup', email });
  });

  it('resumes the existing session when the same admin posts twice', async () => {
    const email = `admintest+resume+${Date.now()}@example.org`;
    authMock.mockResolvedValue({ user: { email } });

    const first = await POST(mockReq() as any);
    const firstJson = await first.json();
    expect(first.status).toBe(200);
    expect(firstJson.resumed).toBe(false);

    const second = await POST(mockReq() as any);
    const secondJson = await second.json();
    expect(second.status).toBe(200);
    expect(secondJson.resumed).toBe(true);
    expect(secondJson.session_id).toBe(firstJson.session_id);

    const { rows: sessionRows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM sessions WHERE email = $1`,
      [email],
    );
    expect(sessionRows[0]?.count).toBe('1');

    const { rows: leadRows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM leads WHERE email = $1`,
      [email],
    );
    expect(leadRows[0]?.count).toBe('1');
  });

  it('lowercases and trims the email from the auth session', async () => {
    const raw = `  ADMINTEST+CASE+${Date.now()}@Example.Org  `;
    const normalized = raw.toLowerCase().trim();
    authMock.mockResolvedValue({ user: { email: raw } });

    const res = await POST(mockReq() as any);
    expect(res.status).toBe(200);
    const json = await res.json();

    const { rows } = await query<{ email: string | null }>(
      `SELECT email FROM sessions WHERE id = $1`,
      [json.session_id],
    );
    expect(rows[0]?.email).toBe(normalized);
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- tests/api/admin-intake.test.ts`
Expected: FAIL on the three new tests — current route returns `501 not_implemented`; the first test (401 case) still passes.

- [ ] **Step 3: Implement session-create logic**

Replace the contents of `app/api/admin-intake/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';
import { insertLead } from '@/lib/db/queries/leads';
import { emit } from '@/lib/telemetry';

export async function POST(req: NextRequest) {
  const session = await auth();
  const rawEmail = session?.user?.email;
  if (!rawEmail) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const email = rawEmail.toLowerCase().trim();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  // Email-keyed resume: if a session already exists for this admin email, return it
  // without creating a new session or lead row. Matches /api/intake behavior.
  const existing = await query<{ id: string }>(
    `SELECT id FROM sessions WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
    [email],
  );
  if (existing.rows[0]) {
    return NextResponse.json({ session_id: existing.rows[0].id, resumed: true });
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO sessions (ip, email) VALUES ($1, $2) RETURNING id`,
    [ip, email],
  );
  const sessionId = rows[0].id;

  await insertLead({ sessionId, email, intent: 'email_signup' });
  await emit('session_started', { has_pdf: false }, sessionId);
  await emit('lead_captured', { intent: 'email_signup', source_cta: 'email_gate' }, sessionId);

  return NextResponse.json({ session_id: sessionId, resumed: false });
}
```

- [ ] **Step 4: Run tests to verify all four pass**

Run: `npm test -- tests/api/admin-intake.test.ts`
Expected: PASS on all four tests (401 + create + resume + normalize).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin-intake/route.ts tests/api/admin-intake.test.ts
git commit -m "feat(admin-intake): create/resume session for authenticated admin"
```

---

## Task 3: Landing page — call `/api/admin-intake` and trust its response

**Files:**
- Modify: `app/(landing)/page.tsx`

The landing-page change has no automated test in this plan — it's a client component using NextAuth's `signIn`/`signOut`, which is awkward to fully simulate without an E2E. Task 4 covers the manual smoke check that closes the bug.

- [ ] **Step 1: Update imports**

In `app/(landing)/page.tsx`, replace:

```ts
import { signIn } from 'next-auth/react';
```

with:

```ts
import { signIn, signOut } from 'next-auth/react';
```

- [ ] **Step 2: Rewrite `onAdminSubmit` to use the server-authoritative endpoint**

In `app/(landing)/page.tsx`, replace the entire `onAdminSubmit` function (currently lines 65-81) with:

```ts
  async function onAdminSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Set the NextAuth cookie via Credentials. We do NOT trust the return value
      // (NextAuth v5-beta's client signIn for Credentials with redirect:false
      // doesn't reliably surface auth failures). The server-side admin-intake
      // call below is the actual gate.
      await signIn('admin-credentials', { email, password, redirect: false });

      const res = await fetch('/api/admin-intake', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });

      if (res.status === 401) {
        // Clear any half-set cookie so a subsequent guest session doesn't
        // appear as admin in the chat header.
        await signOut({ redirect: false });
        setError('Invalid email or password.');
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        setError('Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }

      const { session_id } = (await res.json()) as { session_id: string };
      window.localStorage.setItem(LS_SESSION, session_id);
      window.localStorage.setItem(LS_EMAIL, email);
      router.push(`/chat/${session_id}`);
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }
```

- [ ] **Step 3: Sanity-check the file compiles**

Run: `npm run lint`
Expected: PASS (no new ESLint errors). If TypeScript complains, the most likely cause is a stale `result` reference left over from the old function — re-check that the entire old `onAdminSubmit` body was replaced.

- [ ] **Step 4: Commit**

```bash
git add app/\(landing\)/page.tsx
git commit -m "fix(landing): server-authoritative admin sign-in via /api/admin-intake"
```

---

## Task 4: Manual smoke verification

**Files:** none modified — this task validates the fix end-to-end against the running app.

- [ ] **Step 1: Start the dev server and DB**

```bash
docker compose up -d
npm run dev
```

Wait for "Ready" output, then open `http://localhost:3000` in a private/incognito window (to ensure no stale `dalgo_session_id` in `localStorage` or NextAuth cookies).

- [ ] **Step 2: Confirm random creds are rejected**

On the landing page:
1. Click "or continue as admin".
2. Enter `random@example.test` and `wrongpassword`.
3. Click "Sign in as admin".

Expected:
- Inline red error: "Invalid email or password."
- URL stays on `/`. No redirect to `/chat/<id>`.
- DB check: `docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery -c "SELECT id, email FROM sessions WHERE email = 'random@example.test';"` returns 0 rows.

- [ ] **Step 3: Confirm guest path still works**

Click "← back" to return to guest mode. Enter `guest+manual@example.test`. Click "Start chatting →".

Expected: routes to `/chat/<id>`, chat UI loads, no admin badge in the header.

- [ ] **Step 4: Confirm a real admin can still sign in**

Open a second incognito window. If no admin exists yet, the bootstrap path will create one on first sign-in attempt (from `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` in `.env.local`). Use those creds — the seeded email format is `${ADMIN_USERNAME}@local.admin`.

On the landing page:
1. Click "or continue as admin".
2. Enter the seeded admin email and the plaintext password matching `ADMIN_PASSWORD_HASH`.
3. Click "Sign in as admin".

Expected:
- Redirects to `/chat/<id>`.
- The chat header shows the admin badge (`showAdminBadge` is driven by `useSession`, so the NextAuth cookie set in step 2 of the admin flow makes the badge visible).
- DB check: `docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery -c "SELECT id, email FROM sessions WHERE email = '<seeded-admin-email>' ORDER BY created_at DESC LIMIT 1;"` returns one row.

- [ ] **Step 5: Confirm an admin created from `/admin/admins` can sign in**

While logged in as the system admin in window 2, open `/admin/admins`. Add a new admin with email `teammate+manual@example.test` and a password (≥8 chars), e.g. `teammate-pw-123`.

Open a third incognito window. Go to `/`, switch to admin mode, sign in with `teammate+manual@example.test` / `teammate-pw-123`.

Expected: chat starts, admin badge shows. This proves the create-from-panel → distribute-to-teammate → teammate-signs-in flow works end-to-end.

- [ ] **Step 6: If any step above fails**

Do not mark this task complete. Capture the failing step in a comment on the eventual PR and re-open the bug — most likely the landing-page `onAdminSubmit` change wasn't applied cleanly, or the NextAuth cookie isn't being sent on the `fetch('/api/admin-intake')` call (default behavior, but worth verifying with browser devtools → Network → request headers).

- [ ] **Step 7: Commit (only if a tracking file changed)**

This task changes no files. Skip the commit step unless a `JOURNAL.md` entry is being added — see Task 5.

---

## Task 5: Journal entry

**Files:**
- Modify: `docs/JOURNAL.md`

- [ ] **Step 1: Read the current top of the journal to match its template**

Read `docs/JOURNAL.md` (top ~40 lines). Note the exact section headers it uses (Added / Removed / Why / Eval delta / Carried forward) and the date format of the most recent entry.

- [ ] **Step 2: Prepend a new dated entry**

Add a new entry at the top of the timeline (under whatever heading sits above the existing latest entry — preserve the file's existing structure exactly; do not reorder anything else):

```markdown
## 2026-05-29 — Admin sign-in enforcement on chat landing

**Added:** `POST /api/admin-intake` — server-authoritative admin intake that uses NextAuth `auth()` to confirm the caller is a real admin (row in `admins` table) before creating a chat session. Landing page's admin mode now gates on this endpoint's response instead of NextAuth v5-beta's flaky client `signIn` return value.

**Removed:** Implicit trust in `signIn('admin-credentials', ...)`'s `result.ok` on the landing page. The cookie-set side effect of `signIn` is still used; the success/failure decision is server-side.

**Why:** Bug — visitors could type any random email + password in the landing's admin mode and start a chat. Root cause: NextAuth v5-beta's client `signIn` for Credentials with `redirect: false` does not reliably set `ok: false` on bad credentials, AND `/api/intake` had no auth check, so even a failed `signIn` did not block the subsequent session-create call.

**Eval delta:** None — change is in the auth/session-create path, not the LLM pipeline.

**Carried forward:** `/api/intake` remains open for guest sessions (intentional — anyone can chat as a guest). `sessions.is_admin` not introduced; admin test chats still appear in `/admin/conversations` and `/admin/leads` alongside guest chats. Follow-up if the noise becomes a problem.
```

If the journal's actual template uses different field names or ordering, adapt the body to match what's already there — do not invent new section names.

- [ ] **Step 3: Commit**

```bash
git add docs/JOURNAL.md
git commit -m "docs(journal): admin sign-in enforcement on chat landing"
```

---

## Self-review

**Spec coverage:**
- Goal "random creds must not start chat" → Task 3 (server-authoritative client flow) + Task 4 step 2 (verifies behavior).
- Goal "real admin can sign in" → Task 4 steps 4-5.
- New `POST /api/admin-intake` requirements (uses `auth()`, 401s without session, uses server email, mirrors intake semantics) → Tasks 1-2.
- Landing-page `onAdminSubmit` change (stop trusting `result.ok`, call admin-intake, `signOut` on 401) → Task 3.
- Non-goals (no `sessions.is_admin`, no changes to `lib/auth.ts`, no schema changes, guest path untouched) → respected; no task touches those files.

**Placeholder scan:** No "TBD", "TODO", "fill in", or "similar to" patterns. Each code-bearing step has full code. Each command step has the exact command and expected output.

**Type consistency:** Route file uses `NextRequest`, `NextResponse`, `auth`, `query`, `insertLead`, `emit` — all verified to exist in the codebase. Response shape `{ session_id, resumed }` matches `/api/intake`'s contract that the landing page already consumes via `startSession`. Test file uses the same `vi.mock('@/lib/auth', () => ({ auth: ... }))` pattern as `tests/api/admin/kb-extract-qa.test.ts` and the real-DB integration style of `tests/api/intake.test.ts`. `LS_SESSION` / `LS_EMAIL` constants in Task 3 refer to the existing module-level constants in `app/(landing)/page.tsx` (lines 10-11); no redefinition needed.
