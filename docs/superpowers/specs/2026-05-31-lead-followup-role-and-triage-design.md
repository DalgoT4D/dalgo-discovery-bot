# Design: Lead follow-up opt-in, role capture, and admin triage

**Date:** 2026-05-31
**Status:** Approved (pending spec review)
**Author:** Himanshu (with Claude)

## Summary

Three related changes to the Discovery Bot's lead lifecycle:

1. **Stop re-asking for email in chat.** Email is already captured at the
   landing email-gate. Replace the in-chat "Schedule a demo" popup (which
   redundantly re-collects email) with a **passive, dismissible follow-up
   opt-in** that uses the email we already have: *"Want the Dalgo team to
   reach out to you at &lt;their email&gt;?"* → on Yes, set a flag.
2. **Capture the visitor's role** (`work_domain`) at the email gate, optional,
   reusing the exact taxonomy from `webapp_v2`'s signup flow.
3. **Triage leads in the admin panel.** Mark each person New / Approved /
   Rejected, with tabs `New | Approved | Rejected` so a reviewer can work the
   approved list.

## Motivation

- The current [`soft-cta-banner.tsx`](../../../components/soft-cta-banner.tsx)
  re-asks for an email the system already stored at intake — wasteful and
  slightly jarring. The visitor should just chat; opting into follow-up should
  be one passive click, not a form.
- Sales/ops want to know **who to contact** and **what kind of org they are**.
  Role + an explicit "yes, contact me" signal makes the leads list actionable.
- The leads list is currently an undifferentiated dump. A triage workflow
  (approve/reject) lets a reviewer focus on real prospects.

## Key decisions (from brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Triage granularity | **Per person (session)** | One email = one session (intake dedups by email), so role/follow-up/status are person attributes. |
| Triage states | **new / approved / rejected** | New leads default to `new`; reviewer approves or rejects. |
| Tabs | **New, Approved, Rejected** (no "All") | User explicitly did not want an "All" tab. |
| Follow-up opt-in action | **Flag on the person's record** (`wants_followup`) | Everyone still appears in leads; the flag highlights who actively wants contact. No new lead row. |
| Role at email gate | **Optional** | Don't add friction; `none / Prefer not to say` is one of the options anyway. |
| `/api/lead` | **Remove** | Only the deleted banner used it. |
| `request_demo` tool | **Keep as-is** | Separate agentic path; bot can still capture an explicit demo ask in conversation. |

## Architecture

Person-centric data model: role, follow-up opt-in, and triage status are all
attributes of the **person**, which is the `sessions` row (one per email). The
`leads` table is retained as the underlying **event log** (`email_signup` at
intake, `demo` via `request_demo`). The admin "Leads" view becomes **one row
per person** (sessions with an email), left-joined to `leads` to surface
whether they ever requested a demo.

### Data flow

```
Landing email gate
  ├─ email + (optional) work_domain
  └─ POST /api/intake
       ├─ upsert session (email-keyed); store work_domain
       └─ insert leads row (intent='email_signup')

Chat
  └─ Follow-up opt-in card (uses session.email; no re-entry)
       └─ PATCH /api/followup  → sessions.wants_followup = true
                                → telemetry lead_captured + Slack hot-lead ping

Admin /admin (Leads)
  ├─ GET  /api/admin/leads             → sessions w/ email (+ demo flag), filter by triage_status
  └─ PATCH /api/admin/leads/[sessionId] → sessions.triage_status = new|approved|rejected
```

## Components & changes

### 1. Schema (`lib/db/schema.sql`)

Add three columns to `sessions` (idempotent, backward-compatible):

```sql
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS work_domain    text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS wants_followup boolean NOT NULL DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS triage_status  text NOT NULL DEFAULT 'new'
  CHECK (triage_status IN ('new','approved','rejected'));
```

A matching migration goes under `lib/db/migrations/`. `work_domain` stores the
raw webapp_v2 value; labels are a UI concern. Per the project's known schema
drift, update `schema.sql` directly (the live DB is ALTERed manually).

**Role taxonomy** (value → label), copied verbatim from
`webapp_v2/app/invitations/page.tsx` (`work_domain` field):

| value | label |
|---|---|
| `none` | None / Prefer not to say |
| `monitoring_evaluation` | Monitoring & Evaluation |
| `program_manager` | Program Manager |
| `data_tech` | Data & Tech |
| `leadership` | Leadership (COO, Founder, CTO etc.) |
| `field_worker` | Field worker |

A shared constant (e.g. `lib/work-domains.ts`) holds this list so the gate and
the admin table render consistent labels.

### 2. Email gate role capture

- `app/(landing)/page.tsx`: add an optional role `<select>` beneath the email
  input (guest flow only). State is sent to intake as `work_domain`.
- `app/api/intake/route.ts`: accept optional `work_domain` (zod enum of the 6
  values, `.optional()`); persist it when creating/updating the session. On
  email-keyed resume of an existing session, update `work_domain` only if a
  value was provided (don't overwrite an existing value with null).

### 3. Follow-up opt-in (replaces soft-CTA banner)

- **Delete** `components/soft-cta-banner.tsx` and its usage in
  `components/chat-stream.tsx` (the `messages.filter(... >= 3)` block).
- **Add** `components/followup-optin.tsx`: a slim, dismissible card.
  - Copy: *"Want the Dalgo team to reach out to you at &lt;email&gt;?"* with a
    single **"Yes, please"** button and a dismiss (✕).
  - Needs the session's email → passed in via the existing chat-page meta fetch
    (`/api/chat?session_id=` already returns `email`).
  - Placement: floats in the **right margin** on `lg+` screens (the empty space
    beside the centered chat column); collapses to a one-line inline card below
    the thread on small screens. Use Tailwind responsive utilities; no new
    layout framework.
  - Shows after ≥3 user messages (same trigger as today), renders once, and
    remembers dismissal/opt-in via `localStorage` keyed by session id so it
    doesn't reappear.
  - On **Yes** → `PATCH /api/followup { session_id }`. On success show a small
    "Thanks — we'll be in touch" confirmation in place.
- **Add** `app/api/followup/route.ts` (`PATCH`): validates the session exists,
  sets `wants_followup = true`, emits `lead_captured` telemetry
  (`source_cta: 'followup_optin'`), and fires the existing
  `postHotLead` Slack ping (reusing `session.email` + `session.ngo_url`).
- **Remove** `app/api/lead/route.ts`.

### 4. Admin leads triage (per-person + tabs)

- `app/api/admin/leads/route.ts` (GET): change to a person-centric query —
  `sessions s WHERE s.email IS NOT NULL AND s.is_admin = false` (exclude admin
  sessions — they sign in with an email but are not prospects), LEFT JOIN an
  aggregate over `leads` to compute `requested_demo boolean` (any
  `leads.intent = 'demo'` for that session). Return: `session_id, created_at,
  email, work_domain, ngo_url, wants_followup, requested_demo, triage_status`.
  The endpoint returns all (non-admin) rows; **tab filtering by
  `triage_status` happens client-side** in the table component (small dataset,
  matches the existing `useTableFilter` pattern). No `?status=` query param.
- **Add** `app/api/admin/leads/[sessionId]/route.ts` (`PATCH`, admin-only via
  the existing NextAuth guard): body `{ triage_status }`, validates enum,
  updates the session.
- `components/admin/lead-table.tsx`:
  - Columns: **Created · Email · Role · NGO URL · Follow-up? · Status ·
    transcript**. Role renders the label from the shared constant;
    Follow-up? shows a ✓ badge when `wants_followup`.
  - **Tabs:** `New | Approved | Rejected` (replaces the current intent facet as
    the primary axis; the existing `useTableFilter` search/date can remain).
  - Per-row **Approve / Reject** buttons call the PATCH endpoint and revalidate
    (SWR `mutate`), moving the row to the corresponding tab.
  - The transcript link continues to point at
    `/admin/conversations?session_id=<session_id>`.

## Error handling

- `/api/followup`: 404 if session not found; 400 on invalid body; idempotent
  (setting `wants_followup = true` twice is a no-op). Slack/telemetry failures
  are non-fatal (log and continue) so the user still sees success.
- `/api/admin/leads/[sessionId]`: 401/403 if not an admin; 400 on invalid
  status; 404 if session missing.
- Intake: invalid `work_domain` → 400; missing `work_domain` is allowed.
- Follow-up card: network error → keep the card, show an inline retry; never
  block chatting.

## Testing

- **Unit/integration (Vitest):**
  - `intake` persists `work_domain` when provided; allows omission; doesn't
    clobber an existing value with null on resume.
  - `PATCH /api/followup` flips `wants_followup` and is idempotent; 404 on
    unknown session.
  - `PATCH /api/admin/leads/[sessionId]` updates `triage_status`, rejects bad
    enum, enforces admin auth.
  - `GET /api/admin/leads` returns one row per person, correct `requested_demo`
    aggregate, and respects the status filter.
- **Component:** follow-up card renders with the email, hides after opt-in/
  dismiss, persists across reloads via localStorage.
- **E2E (optional/happy path):** gate with a role → chat → opt in → row appears
  under **New** with Role + Follow-up ✓ → admin approves → row moves to
  **Approved**.

## Out of scope (YAGNI)

- Editing/auditing triage history (just the current status).
- Notifying the visitor when approved/rejected.
- Bulk approve/reject.
- Backfilling `work_domain` for historical sessions (stays null).
- Changing the `request_demo` conversational tool.

## Files touched

**New:** `lib/work-domains.ts`, `components/followup-optin.tsx`,
`app/api/followup/route.ts`, `app/api/admin/leads/[sessionId]/route.ts`,
`lib/db/migrations/<n>-lead-triage-role-followup.sql`.

**Changed:** `lib/db/schema.sql`, `app/(landing)/page.tsx`,
`app/api/intake/route.ts`, `components/chat-stream.tsx`,
`app/api/admin/leads/route.ts`, `components/admin/lead-table.tsx`,
`lib/db/queries/sessions.ts` (+ getters for new fields as needed).

**Removed:** `components/soft-cta-banner.tsx`, `app/api/lead/route.ts`.
