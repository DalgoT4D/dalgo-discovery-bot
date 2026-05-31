# Lead Follow-up Opt-in, Role Capture & Admin Triage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the email-re-asking in-chat CTA with a passive follow-up opt-in, capture an optional role at the email gate, and add per-person New/Approved/Rejected triage to the admin leads table.

**Architecture:** Person-centric on `sessions` (one email = one session). Three new `sessions` columns (`work_domain`, `wants_followup`, `triage_status`) hold role, opt-in, and triage. The `leads` table stays an event log; the admin "Leads" view becomes one row per non-admin session with an email, left-joined to `leads` for a "requested demo" flag.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, raw `pg`, Vitest, Tailwind v4, NextAuth v5.

**Spec:** `docs/superpowers/specs/2026-05-31-lead-followup-role-and-triage-design.md`

**Branch:** `feat/lead-followup-triage` (already created).

---

## File Structure

**New files:**
- `lib/db/migrations/2026-05-31-lead-triage-role-followup.sql` — schema migration
- `lib/work-domains.ts` — shared role taxonomy (value→label) + types
- `app/api/followup/route.ts` — guest PATCH to set `wants_followup`
- `app/api/admin/leads/[sessionId]/route.ts` — admin PATCH to set `triage_status`
- `components/followup-optin.tsx` — passive opt-in card
- Test files under `tests/api/…` mirroring the routes

**Modified files:**
- `lib/db/schema.sql` — append the three `ALTER TABLE sessions` statements
- `lib/db/queries/sessions.ts` — widen `updateSession` patch type; add setters
- `app/api/intake/route.ts` — accept + persist optional `work_domain`
- `app/api/admin/leads/route.ts` — person-centric query
- `components/admin/lead-table.tsx` — columns, tabs, approve/reject
- `app/(landing)/page.tsx` — optional role dropdown
- `components/chat-stream.tsx` — swap `SoftCtaBanner` for `FollowupOptin`

**Deleted files:**
- `components/soft-cta-banner.tsx`
- `app/api/lead/route.ts`

---

## Task 1: Schema migration + schema.sql

**Files:**
- Create: `lib/db/migrations/2026-05-31-lead-triage-role-followup.sql`
- Modify: `lib/db/schema.sql` (append near the existing `sessions` ALTERs at the end of the file)

- [ ] **Step 1: Write the migration file**

Create `lib/db/migrations/2026-05-31-lead-triage-role-followup.sql`:

```sql
-- Lead triage, role capture, and follow-up opt-in (per-person on sessions).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS work_domain    text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS wants_followup boolean NOT NULL DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS triage_status  text NOT NULL DEFAULT 'new'
  CHECK (triage_status IN ('new','approved','rejected'));

CREATE INDEX IF NOT EXISTS sessions_triage_status_idx ON sessions (triage_status);
```

- [ ] **Step 2: Mirror the columns into `schema.sql`**

Append to the end of `lib/db/schema.sql` (after the `is_admin` block around line 461):

```sql
-- Lead triage, role capture, and follow-up opt-in (kept in sync with
-- migration 2026-05-31-lead-triage-role-followup.sql).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS work_domain    text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS wants_followup boolean NOT NULL DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS triage_status  text NOT NULL DEFAULT 'new'
  CHECK (triage_status IN ('new','approved','rejected'));
CREATE INDEX IF NOT EXISTS sessions_triage_status_idx ON sessions (triage_status);
```

- [ ] **Step 3: Apply the migration to the local DB**

Run:
```bash
docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery < lib/db/migrations/2026-05-31-lead-triage-role-followup.sql
```
Expected: `ALTER TABLE` ×3 and `CREATE INDEX` with no errors.

- [ ] **Step 4: Verify columns exist**

Run:
```bash
docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery -c "\d sessions" | grep -E "work_domain|wants_followup|triage_status"
```
Expected: three rows showing the new columns.

- [ ] **Step 5: Commit**

```bash
git add lib/db/migrations/2026-05-31-lead-triage-role-followup.sql lib/db/schema.sql
git commit -m "feat(db): add sessions work_domain, wants_followup, triage_status"
```

---

## Task 2: Shared work-domains taxonomy

**Files:**
- Create: `lib/work-domains.ts`
- Test: `tests/lib/work-domains.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/work-domains.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { WORK_DOMAINS, WORK_DOMAIN_VALUES, workDomainLabel } from '@/lib/work-domains';

describe('work-domains', () => {
  it('has the 6 webapp_v2 values', () => {
    expect(WORK_DOMAIN_VALUES).toEqual([
      'none',
      'monitoring_evaluation',
      'program_manager',
      'data_tech',
      'leadership',
      'field_worker',
    ]);
  });

  it('maps value to label', () => {
    expect(workDomainLabel('monitoring_evaluation')).toBe('Monitoring & Evaluation');
    expect(workDomainLabel('none')).toBe('None / Prefer not to say');
  });

  it('returns a dash for null/unknown', () => {
    expect(workDomainLabel(null)).toBe('—');
    expect(workDomainLabel('bogus')).toBe('—');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/work-domains.test.ts`
Expected: FAIL — cannot find module `@/lib/work-domains`.

- [ ] **Step 3: Write the implementation**

Create `lib/work-domains.ts`:

```ts
// Role / work-domain taxonomy, copied verbatim from webapp_v2's signup flow
// (webapp_v2/app/invitations/page.tsx, `work_domain` field). Keep values in
// sync so the Discovery Bot and the main product agree.
export const WORK_DOMAINS = [
  { value: 'none', label: 'None / Prefer not to say' },
  { value: 'monitoring_evaluation', label: 'Monitoring & Evaluation' },
  { value: 'program_manager', label: 'Program Manager' },
  { value: 'data_tech', label: 'Data & Tech' },
  { value: 'leadership', label: 'Leadership (COO, Founder, CTO etc.)' },
  { value: 'field_worker', label: 'Field worker' },
] as const;

export type WorkDomain = (typeof WORK_DOMAINS)[number]['value'];

export const WORK_DOMAIN_VALUES = WORK_DOMAINS.map((d) => d.value) as WorkDomain[];

export function workDomainLabel(value: string | null | undefined): string {
  const found = WORK_DOMAINS.find((d) => d.value === value);
  return found ? found.label : '—';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/work-domains.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/work-domains.ts tests/lib/work-domains.test.ts
git commit -m "feat: add shared work-domain taxonomy"
```

---

## Task 3: Extend sessions queries

**Files:**
- Modify: `lib/db/queries/sessions.ts`
- Test: `tests/lib/db/sessions-triage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/db/sessions-triage.test.ts`:

```ts
import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { getSession, setWantsFollowup, setTriageStatus } from '@/lib/db/queries/sessions';

async function newSession(): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO sessions (email) VALUES ($1) RETURNING id`,
    [`triage-${Date.now()}-${Math.round(performance.now())}@x.org`],
  );
  return rows[0].id;
}

describe('sessions triage helpers', () => {
  it('setWantsFollowup flips the flag and is idempotent', async () => {
    const id = await newSession();
    await setWantsFollowup(id);
    await setWantsFollowup(id);
    const s = await getSession(id);
    expect(s.wants_followup).toBe(true);
  });

  it('setTriageStatus updates the status', async () => {
    const id = await newSession();
    await setTriageStatus(id, 'approved');
    const s = await getSession(id);
    expect(s.triage_status).toBe('approved');
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/db/sessions-triage.test.ts`
Expected: FAIL — `setWantsFollowup`/`setTriageStatus` not exported.

- [ ] **Step 3: Widen `updateSession` and add the two setters**

In `lib/db/queries/sessions.ts`, replace the `updateSession` patch type and append the helpers. Change the `updateSession` signature's patch type to:

```ts
export async function updateSession(
  id: string,
  patch: Partial<{
    ngo_summary: string;
    pdf_url: string;
    pdf_text: string;
    ended_at: string;
    work_domain: string;
    wants_followup: boolean;
    triage_status: 'new' | 'approved' | 'rejected';
  }>,
) {
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = keys.map(k => (patch as any)[k]);
  values.push(id);
  await query(`UPDATE sessions SET ${setClause} WHERE id = $${keys.length + 1}`, values);
}
```

Then append at the end of the file:

```ts
export async function setWantsFollowup(id: string): Promise<void> {
  await query(`UPDATE sessions SET wants_followup = true WHERE id = $1`, [id]);
}

export async function setTriageStatus(
  id: string,
  status: 'new' | 'approved' | 'rejected',
): Promise<void> {
  await query(`UPDATE sessions SET triage_status = $2 WHERE id = $1`, [id, status]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/db/sessions-triage.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/sessions.ts tests/lib/db/sessions-triage.test.ts
git commit -m "feat(db): sessions setWantsFollowup + setTriageStatus helpers"
```

---

## Task 4: Intake captures optional role

**Files:**
- Modify: `app/api/intake/route.ts`
- Test: `tests/api/intake.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/intake.test.ts`:

```ts
import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { POST } from '@/app/api/intake/route';

function req(body: unknown) {
  return new Request('http://localhost/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

describe('POST /api/intake work_domain', () => {
  it('persists work_domain when provided', async () => {
    const email = `intake-${Date.now()}@x.org`;
    const res = await POST(req({ email, work_domain: 'leadership' }));
    expect(res.status).toBe(200);
    const { session_id } = await res.json();
    const { rows } = await query(`SELECT work_domain FROM sessions WHERE id = $1`, [session_id]);
    expect(rows[0].work_domain).toBe('leadership');
  });

  it('allows omitting work_domain', async () => {
    const email = `intake-norole-${Date.now()}@x.org`;
    const res = await POST(req({ email }));
    expect(res.status).toBe(200);
    const { session_id } = await res.json();
    const { rows } = await query(`SELECT work_domain FROM sessions WHERE id = $1`, [session_id]);
    expect(rows[0].work_domain).toBeNull();
  });

  it('rejects an invalid work_domain', async () => {
    const res = await POST(req({ email: `bad-${Date.now()}@x.org`, work_domain: 'wizard' }));
    expect(res.status).toBe(400);
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/intake.test.ts`
Expected: FAIL — invalid `work_domain` returns 200 (not yet validated) and column not written.

- [ ] **Step 3: Update the intake route**

In `app/api/intake/route.ts`, add the import and extend the schema + insert. Replace the import block and `IntakeBody`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db/client';
import { insertLead } from '@/lib/db/queries/leads';
import { emit } from '@/lib/telemetry';
import { WORK_DOMAIN_VALUES } from '@/lib/work-domains';

const IntakeBody = z.object({
  email: z.string().email(),
  work_domain: z.enum(WORK_DOMAIN_VALUES as [string, ...string[]]).optional(),
});
```

Then update the resume branch to backfill role if newly provided, and the insert to include `work_domain`. Replace from the resume block through the insert:

```ts
  const email = parsed.data.email.toLowerCase().trim();
  const workDomain = parsed.data.work_domain ?? null;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  // Email-keyed resume: if a session already exists for this email, return it
  // without creating a new session or lead row. Backfill work_domain only if a
  // value was provided and none is stored yet (don't overwrite with null).
  const existing = await query<{ id: string }>(
    `SELECT id FROM sessions WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
    [email],
  );
  if (existing.rows[0]) {
    if (workDomain) {
      await query(
        `UPDATE sessions SET work_domain = $2 WHERE id = $1 AND work_domain IS NULL`,
        [existing.rows[0].id, workDomain],
      );
    }
    return NextResponse.json({ session_id: existing.rows[0].id, resumed: true });
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO sessions (ip, email, work_domain) VALUES ($1, $2, $3) RETURNING id`,
    [ip, email, workDomain],
  );
  const sessionId = rows[0].id;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/api/intake.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/intake/route.ts tests/api/intake.test.ts
git commit -m "feat(intake): capture optional work_domain at the email gate"
```

---

## Task 5: Follow-up opt-in endpoint

**Files:**
- Create: `app/api/followup/route.ts`
- Test: `tests/api/followup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/followup.test.ts`:

```ts
import { describe, it, expect, afterAll, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';

vi.mock('@/lib/slack', () => ({ postHotLead: vi.fn(async () => {}) }));

import { PATCH } from '@/app/api/followup/route';

function req(body: unknown) {
  return new Request('http://localhost/api/followup', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function newSession(): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO sessions (email) VALUES ($1) RETURNING id`,
    [`followup-${Date.now()}@x.org`],
  );
  return rows[0].id;
}

describe('PATCH /api/followup', () => {
  it('sets wants_followup and is idempotent', async () => {
    const id = await newSession();
    const res1 = await PATCH(req({ session_id: id }));
    expect(res1.status).toBe(200);
    await PATCH(req({ session_id: id }));
    const { rows } = await query(`SELECT wants_followup FROM sessions WHERE id = $1`, [id]);
    expect(rows[0].wants_followup).toBe(true);
  });

  it('404 on unknown session', async () => {
    const res = await PATCH(req({ session_id: '00000000-0000-0000-0000-000000000000' }));
    expect(res.status).toBe(404);
  });

  it('400 on invalid body', async () => {
    const res = await PATCH(req({ nope: true }));
    expect(res.status).toBe(400);
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/followup.test.ts`
Expected: FAIL — cannot find module `@/app/api/followup/route`.

- [ ] **Step 3: Write the endpoint**

Create `app/api/followup/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, setWantsFollowup } from '@/lib/db/queries/sessions';
import { postHotLead } from '@/lib/slack';
import { emit } from '@/lib/telemetry';

const Body = z.object({ session_id: z.string().uuid() });

export async function PATCH(req: NextRequest | Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const { session_id } = parsed.data;

  let session;
  try {
    session = await getSession(session_id);
  } catch {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }

  await setWantsFollowup(session_id);
  await emit('lead_captured', { intent: 'followup', source_cta: 'followup_optin' }, session_id);

  // Non-fatal: a Slack failure must not break the user's opt-in.
  try {
    if (session.email) {
      await postHotLead({
        email: session.email,
        ngo_url: session.ngo_url ?? undefined,
        session_id,
      });
    }
  } catch {
    // swallow — telemetry already recorded the opt-in
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/api/followup.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/followup/route.ts tests/api/followup.test.ts
git commit -m "feat(api): follow-up opt-in endpoint sets wants_followup"
```

---

## Task 6: Person-centric admin leads query

**Files:**
- Modify: `app/api/admin/leads/route.ts`
- Test: `tests/api/admin/leads.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/admin/leads.test.ts`:

```ts
import { describe, it, expect, afterAll, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';
import { insertLead } from '@/lib/db/queries/leads';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com' } }),
}));

import { GET } from '@/app/api/admin/leads/route';

describe('GET /api/admin/leads (person-centric)', () => {
  it('returns one row per non-admin session with email + demo flag', async () => {
    const email = `leadq-${Date.now()}@x.org`;
    const { rows } = await query<{ id: string }>(
      `INSERT INTO sessions (email, work_domain, wants_followup) VALUES ($1,'data_tech',true) RETURNING id`,
      [email],
    );
    const sessionId = rows[0].id;
    await insertLead({ sessionId, email, intent: 'email_signup' });
    await insertLead({ sessionId, email, intent: 'demo' });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const mine = body.items.filter((r: { email: string }) => r.email === email);
    expect(mine.length).toBe(1);
    expect(mine[0].session_id).toBe(sessionId);
    expect(mine[0].requested_demo).toBe(true);
    expect(mine[0].wants_followup).toBe(true);
    expect(mine[0].work_domain).toBe('data_tech');
    expect(mine[0].triage_status).toBe('new');
  });

  it('excludes admin sessions', async () => {
    const email = `leadadmin-${Date.now()}@x.org`;
    await query(`INSERT INTO sessions (email, is_admin) VALUES ($1, true)`, [email]);
    const res = await GET();
    const body = await res.json();
    expect(body.items.find((r: { email: string }) => r.email === email)).toBeUndefined();
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/admin/leads.test.ts`
Expected: FAIL — current query returns one row per lead and has no `requested_demo`/`wants_followup`.

- [ ] **Step 3: Rewrite the GET query**

Replace the body of `app/api/admin/leads/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { rows } = await query(
    `SELECT
        s.id                                   AS session_id,
        s.created_at,
        s.email,
        s.work_domain,
        s.ngo_url,
        s.wants_followup,
        s.triage_status,
        COALESCE(bool_or(l.intent = 'demo'), false) AS requested_demo
     FROM sessions s
     LEFT JOIN leads l ON l.session_id = s.id
     WHERE s.email IS NOT NULL AND s.is_admin = false
     GROUP BY s.id
     ORDER BY s.created_at DESC`,
  );
  return NextResponse.json({ items: rows });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/api/admin/leads.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/leads/route.ts tests/api/admin/leads.test.ts
git commit -m "feat(admin): person-centric leads query with demo + followup flags"
```

---

## Task 7: Admin triage PATCH endpoint

**Files:**
- Create: `app/api/admin/leads/[sessionId]/route.ts`
- Test: `tests/api/admin/leads-triage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/admin/leads-triage.test.ts`:

```ts
import { describe, it, expect, afterAll, vi } from 'vitest';
import 'dotenv/config';
import { query, pool } from '@/lib/db/client';

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'admin@example.com' } }),
}));

import { PATCH } from '@/app/api/admin/leads/[sessionId]/route';

function req(body: unknown) {
  return new Request('http://localhost/api/admin/leads/x', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function newSession(): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO sessions (email) VALUES ($1) RETURNING id`,
    [`triagep-${Date.now()}@x.org`],
  );
  return rows[0].id;
}

describe('PATCH /api/admin/leads/[sessionId]', () => {
  it('updates triage_status', async () => {
    const id = await newSession();
    const res = await PATCH(req({ triage_status: 'approved' }), { params: Promise.resolve({ sessionId: id }) });
    expect(res.status).toBe(200);
    const { rows } = await query(`SELECT triage_status FROM sessions WHERE id = $1`, [id]);
    expect(rows[0].triage_status).toBe('approved');
  });

  it('400 on invalid status', async () => {
    const id = await newSession();
    const res = await PATCH(req({ triage_status: 'maybe' }), { params: Promise.resolve({ sessionId: id }) });
    expect(res.status).toBe(400);
  });

  it('404 on unknown session', async () => {
    const fake = '00000000-0000-0000-0000-000000000000';
    const res = await PATCH(req({ triage_status: 'rejected' }), { params: Promise.resolve({ sessionId: fake }) });
    expect(res.status).toBe(404);
  });

  afterAll(async () => { await pool().end(); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/admin/leads-triage.test.ts`
Expected: FAIL — cannot find module `@/app/api/admin/leads/[sessionId]/route`.

- [ ] **Step 3: Write the endpoint**

Create `app/api/admin/leads/[sessionId]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db/client';

const Body = z.object({
  triage_status: z.enum(['new', 'approved', 'rejected']),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { sessionId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const { rowCount } = await query(
    `UPDATE sessions SET triage_status = $2 WHERE id = $1`,
    [sessionId, parsed.data.triage_status],
  );
  if (!rowCount) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/api/admin/leads-triage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/leads/[sessionId]/route.ts" tests/api/admin/leads-triage.test.ts
git commit -m "feat(admin): triage PATCH endpoint for lead status"
```

---

## Task 8: Remove the soft-CTA banner and /api/lead

**Files:**
- Delete: `components/soft-cta-banner.tsx`, `app/api/lead/route.ts`
- Modify: `components/chat-stream.tsx` (remove import + render block)

- [ ] **Step 1: Remove the render + import in chat-stream.tsx**

In `components/chat-stream.tsx`, delete the import line `import { SoftCtaBanner } from './soft-cta-banner';` and delete this block (around line 229):

```tsx
      {messages.filter((m) => m.role === 'user').length >= 3 && (
        <div className="px-4">
          <SoftCtaBanner sessionId={sessionId} />
        </div>
      )}
```

(Leave a placeholder comment `{/* follow-up opt-in mounts in Task 9 */}` where it was, to wire in next.)

- [ ] **Step 2: Delete the files**

Run:
```bash
git rm components/soft-cta-banner.tsx app/api/lead/route.ts
```

- [ ] **Step 3: Verify nothing else references them**

Run:
```bash
grep -rn "soft-cta\|SoftCtaBanner\|/api/lead" app/ components/ tests/ || echo "clean"
```
Expected: `clean` (no remaining references).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `soft-cta-banner`, `SoftCtaBanner`, or `api/lead`.

- [ ] **Step 5: Commit**

Use explicit paths — do NOT use `git add -A`/`git add .` (the working tree
carries unrelated uncommitted changes that must not be swept in). The `git rm`
in Step 2 already staged the two deletions; just add the edited file:

```bash
git add components/chat-stream.tsx
git commit -m "chore: remove redundant soft-CTA banner and /api/lead"
```

---

## Task 9: Follow-up opt-in component

**Files:**
- Create: `components/followup-optin.tsx`
- Modify: `components/chat-stream.tsx` (mount it; it already receives `sessionId`)
- Note: the component needs the visitor's email. `app/chat/[sessionId]/page.tsx` already fetches `meta.email` via `/api/chat?session_id=`. Pass it down through `ChatStream` props.

- [ ] **Step 1: Write the component**

Create `components/followup-optin.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const LS_KEY = (sessionId: string) => `dalgo_followup_${sessionId}`;

export function FollowupOptin({
  sessionId,
  email,
}: {
  sessionId: string;
  email?: string | null;
}) {
  const initiallyHidden =
    typeof window !== 'undefined' && !!window.localStorage.getItem(LS_KEY(sessionId));
  const [done, setDone] = useState(initiallyHidden);
  const [submitting, setSubmitting] = useState(false);

  if (done || !email) return null;

  function remember() {
    try {
      window.localStorage.setItem(LS_KEY(sessionId), '1');
    } catch {
      // ignore storage failures
    }
  }

  async function optIn() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/followup', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) throw new Error('failed');
      remember();
      setDone(true);
    } catch {
      setSubmitting(false); // keep the card so they can retry
    }
  }

  function dismiss() {
    remember();
    setDone(true);
  }

  return (
    <Card className="border-l-[3px] border-l-primary px-4 py-3">
      <p className="text-sm font-medium text-foreground">
        Want the Dalgo team to reach out to you at{' '}
        <span className="text-primary">{email}</span>?
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Button type="button" size="sm" onClick={optIn} disabled={submitting}>
          {submitting ? 'Saving…' : 'Yes, please'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
          No thanks
        </Button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Thread `email` into ChatStream and mount the card**

In `components/chat-stream.tsx`:
1. Add `email` to the component's props type (alongside `sessionId`): `email?: string | null;`
2. Replace the Task 8 placeholder comment with a responsive mount. On `lg+` it floats in the right margin; on small screens it sits inline after ≥3 user messages:

```tsx
      {messages.filter((m) => m.role === 'user').length >= 3 && (
        <div className="px-4 lg:fixed lg:right-6 lg:top-28 lg:z-10 lg:w-72 lg:px-0">
          <FollowupOptin sessionId={sessionId} email={email} />
        </div>
      )}
```

3. Add the import at the top: `import { FollowupOptin } from './followup-optin';`

In `app/chat/[sessionId]/page.tsx`, pass `email={meta?.email}` to `<ChatStream ... />` (it already has `meta.email`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, enter an email at the gate, send 3+ messages. Expected: the follow-up card appears (right margin on a wide window). Click "Yes, please" → it disappears and `wants_followup` is set:
```bash
docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery -c "SELECT email, wants_followup FROM sessions ORDER BY created_at DESC LIMIT 1;"
```
Expected: `wants_followup = t`. Reload the page → the card does not reappear.

- [ ] **Step 5: Commit**

```bash
git add components/followup-optin.tsx components/chat-stream.tsx "app/chat/[sessionId]/page.tsx"
git commit -m "feat(chat): passive follow-up opt-in card using stored email"
```

---

## Task 10: Role dropdown at the email gate

**Files:**
- Modify: `app/(landing)/page.tsx`

- [ ] **Step 1: Add role state and send it to intake**

In `app/(landing)/page.tsx`:
1. Add the import: `import { WORK_DOMAINS } from '@/lib/work-domains';`
2. Add state near the other `useState`s: `const [workDomain, setWorkDomain] = useState('');`
3. Change `startSession` to include the role when set. Update the `fetch('/api/intake', …)` body:

```tsx
      body: JSON.stringify({
        email: emailValue,
        ...(workDomain ? { work_domain: workDomain } : {}),
      }),
```

- [ ] **Step 2: Render the optional dropdown in the guest form**

In the guest form (where the email `<Input>` is), add below the email input:

```tsx
        <select
          value={workDomain}
          onChange={(e) => setWorkDomain(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        >
          <option value="">Your role (optional)</option>
          {WORK_DOMAINS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, on the landing page pick a role (e.g. "Monitoring & Evaluation") and submit. Expected:
```bash
docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery -c "SELECT email, work_domain FROM sessions ORDER BY created_at DESC LIMIT 1;"
```
shows `work_domain = monitoring_evaluation`. Submitting without picking a role stores `NULL`.

- [ ] **Step 5: Commit**

```bash
git add "app/(landing)/page.tsx"
git commit -m "feat(landing): optional role dropdown at the email gate"
```

---

## Task 11: Admin lead-table — columns, tabs, approve/reject

**Files:**
- Modify: `components/admin/lead-table.tsx`

- [ ] **Step 1: Rewrite the table component**

Replace the contents of `components/admin/lead-table.tsx`:

```tsx
'use client';
import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { workDomainLabel } from '@/lib/work-domains';

type TriageStatus = 'new' | 'approved' | 'rejected';

type LeadRow = {
  session_id: string;
  created_at: string;
  email: string;
  work_domain: string | null;
  ngo_url: string | null;
  wants_followup: boolean;
  requested_demo: boolean;
  triage_status: TriageStatus;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const TABS: TriageStatus[] = ['new', 'approved', 'rejected'];

export function LeadTable() {
  const { data, error, isLoading, mutate } = useSWR<{ items: LeadRow[] }>(
    '/api/admin/leads',
    fetcher,
  );
  const [tab, setTab] = useState<TriageStatus>('new');

  async function setStatus(sessionId: string, status: TriageStatus) {
    await fetch(`/api/admin/leads/${sessionId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ triage_status: status }),
    });
    mutate();
  }

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>Error.</p>;

  const items = data?.items ?? [];
  const rows = items.filter((l) => l.triage_status === tab);
  const count = (s: TriageStatus) => items.filter((l) => l.triage_status === s).length;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              'rounded-md px-3 py-1.5 text-sm capitalize ' +
              (tab === t
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80')
            }
          >
            {t} ({count(t)})
          </button>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="p-2">Created</th>
            <th className="p-2">Email</th>
            <th className="p-2">Role</th>
            <th className="p-2">NGO URL</th>
            <th className="p-2">Follow-up?</th>
            <th className="p-2">Demo?</th>
            <th className="p-2"></th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.session_id} className="border-b border-border">
              <td className="p-2">{new Date(l.created_at).toLocaleString()}</td>
              <td className="p-2">{l.email}</td>
              <td className="p-2">{workDomainLabel(l.work_domain)}</td>
              <td className="p-2">{l.ngo_url ?? '—'}</td>
              <td className="p-2">{l.wants_followup ? '✓' : '—'}</td>
              <td className="p-2">{l.requested_demo ? '✓' : '—'}</td>
              <td className="p-2">
                <Link
                  href={`/admin/conversations?session_id=${l.session_id}`}
                  className="text-primary underline"
                >
                  transcript
                </Link>
              </td>
              <td className="p-2">
                <div className="flex gap-1">
                  {l.triage_status !== 'approved' && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(l.session_id, 'approved')}>
                      Approve
                    </Button>
                  )}
                  {l.triage_status !== 'rejected' && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(l.session_id, 'rejected')}>
                      Reject
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="p-4 text-muted-foreground" colSpan={8}>
                No {tab} leads.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint components/admin/lead-table.tsx`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, sign into `/admin`. Expected: tabs `new / approved / rejected` with counts; rows show Role, Follow-up?, Demo?. Click **Approve** on a New row → it disappears from New and appears under Approved. Verify:
```bash
docker exec -i dalgo-discovery-db psql -U dalgo -d dalgo_discovery -c "SELECT email, triage_status FROM sessions WHERE triage_status='approved' ORDER BY created_at DESC LIMIT 3;"
```

- [ ] **Step 4: Commit**

```bash
git add components/admin/lead-table.tsx
git commit -m "feat(admin): per-person leads table with tabs + approve/reject"
```

---

## Task 12: Full test sweep + journal

**Files:**
- Modify: `docs/JOURNAL.md`

- [ ] **Step 1: Run the full unit/integration suite**

Run: `npm test`
Expected: all tests pass, including the new `work-domains`, `sessions-triage`, `intake`, `followup`, `leads`, and `leads-triage` suites.

- [ ] **Step 2: Typecheck + lint the whole project**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Append a journal entry**

Add a dated entry to `docs/JOURNAL.md` following the existing template (Added / Removed / Why / Eval delta / Carried forward):
- **Added:** role capture at the email gate; passive follow-up opt-in card; per-person admin triage (new/approved/rejected) with `sessions.work_domain`, `wants_followup`, `triage_status`.
- **Removed:** `soft-cta-banner.tsx`, `/api/lead` (redundant email re-collection).
- **Why:** email is already captured at intake; make follow-up a one-click signal and the leads list actionable.
- **Eval delta:** none (no KB/retrieval change).
- **Carried forward:** `request_demo` conversational tool unchanged.

- [ ] **Step 4: Commit**

```bash
git add docs/JOURNAL.md
git commit -m "docs(journal): lead follow-up, role capture, admin triage"
```

---

## Self-Review Notes

- **Spec coverage:** schema (T1), role taxonomy (T2), sessions helpers (T3), role at gate (T4+T10), follow-up endpoint (T5) + card (T9), person-centric leads (T6), triage PATCH (T7) + table UI (T11), banner/`/api/lead` removal (T8), tests + journal (T12). All spec sections mapped.
- **Type consistency:** `triage_status` union `'new'|'approved'|'rejected'` is identical across T3, T7, T11; `work_domain` values flow from the T2 constant into intake validation (T4) and labels (T11). `requested_demo`/`wants_followup` names match between T6 query and T11 table.
- **Admin exclusion** (`is_admin = false`) and **client-side tab filtering** are implemented in T6/T11 per the spec's self-review fixes.
- **Auth:** admin endpoints (T6, T7) mirror the existing `auth()` guard pattern from the current leads route and eval-runs tests.
