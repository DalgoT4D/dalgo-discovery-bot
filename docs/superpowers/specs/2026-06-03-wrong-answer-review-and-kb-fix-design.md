# Wrong-answer review queue + LLM-assisted KB fix

**Date:** 2026-06-03
**Status:** Design approved, pending spec review

## Problem

Admins can already flag an assistant answer as wrong from two surfaces — the
live chat (when signed in as admin) and the admin conversation viewer — and the
report is written to `wrong_answer_reports`. But:

- **Nothing in the admin UI lists those reports.** The table is write-only from
  the UI's perspective (only tests read it). There are currently 12 reports, 4
  resolved, invisible to the team. There is no `app/admin/wrong-answers` page and
  no `GET` endpoint.
- The report captures a free-text **reason** ("what's wrong"), not a correction,
  so there is no clean path from "this is wrong" to "the KB is fixed."
- The only fix path is the report-time modal's inline KB editor, which handles
  *editing an existing candidate* but not *creating a new entry* when none
  existed, and isn't reachable later for reports filed quickly.

Goal: a gap-free loop from flag → review → approve → KB updated, with the fix
verified and regression-protected.

## What already works (do not rebuild)

- **KB writes re-embed.** `app/api/admin/kb/[id]/route.ts` (PATCH) detects when
  `question_variants`/`canonical_answer` change and re-embeds before saving;
  `app/api/admin/kb/route.ts` (POST) embeds on create. So a fix actually changes
  what retrieval matches.
- **KB edits are versioned + transactional** (`dalgo_knowledge_base` + version
  history + restore route; `BEGIN` / `FOR UPDATE`).
- **Provenance columns** on `dalgo_knowledge_base` (`source`,
  `source_message_id`, `author_email`) already support "this entry came from a
  corrected chat answer."
- **LLM-assisted KB drafting pattern** exists: `lib/llm/extract-qa.ts` +
  `app/api/admin/kb/extract-qa/route.ts`. The draft-fix endpoint follows it.
- **Eval store** exists: `dalgo_eval_cases` (+ versions, runs, run_results) and
  `/admin/evals`. Saving a regression case reuses this.
- **Message ids are DB UUIDs** end-to-end (fixed 2026-06-03), so reports filed
  from live chat carry a valid `message_id`.

## Flow

```
MARK WRONG                REVIEW QUEUE              RESOLVE (LLM-assisted)
┌──────────────┐          ┌──────────────┐         ┌─────────────────────────┐
│ Chat (admin) │──report─▶│ /admin/      │──open──▶│ 1. LLM drafts a fix     │
│ Admin convo  │          │  wrong-      │         │    (edit X | create new)│
│  viewer      │          │  answers     │         │ 2. Admin edits + Approve│
└──────────────┘          │ pending /    │         │ 3. Write KB (re-embed,  │
   reason +               │ resolved /   │         │    versioned)           │
   optional               │ dismissed    │         │ 4. Re-run question →    │
   suggested_answer       └──────────────┘         │    confirm top hit      │
                                  ▲                │ 5. Save eval case       │
                                  └────resolved────│ 6. report=resolved      │
                                                   │ 7. (optional) Run eval  │
                                       Dismiss ──▶ │    report=dismissed     │
                                                   └─────────────────────────┘
```

### Mark-wrong (report time)

The mark-wrong modal captures two fields:

- **What's wrong?** — `reason`, required.
- **What should it have said?** — `suggested_answer`, optional. A steer for the
  LLM, not the final text.

Both entry points (chat `assistant-actions`, admin conversation viewer) already
write the table; they gain the optional `suggested_answer` field. No other change
to those surfaces.

### Review queue

`/admin/wrong-answers` lists reports, pending first, each showing: reason,
suggested answer (if any), who/when, a snippet of the offending answer, a link to
the conversation, and a status badge. One nav entry is added to the admin
dashboard.

### Resolve (LLM-assisted, admin-approved)

1. **Draft.** `POST /api/admin/wrong-answers/[id]/draft-fix` runs the LLM over
   *wrong answer + reason + suggested_answer + retrieved candidates* (from the
   report's `retrieval_trace_snap`). Returns
   `{ action: 'edit' | 'create', target_kb_id?, draft: { question_variants,
   canonical_answer, status, ngo_framing?, evidence?, notes_for_sales? } }`.
   When the admin supplied a `suggested_answer`, the LLM formalizes it into a KB
   entry rather than inventing content.
2. **Review.** The resolve modal shows the draft; the admin can edit every field
   and flip edit↔create / change the target entry.
3. **Approve** → `POST /api/admin/wrong-answers/[id]/resolve` orchestrates,
   transactionally:
   - KB write via the existing create (POST) or update (PATCH) path → re-embed +
     version. Stamp provenance (`source = 'wrong_answer_fix'`,
     `source_message_id`, `author_email`).
   - Re-run the **original question** (the user message immediately preceding
     the reported assistant message, looked up by `message_id` + conversation
     order) through `runPipeline` (retrieval only) and return whether the fixed
     entry now ranks top. If it does **not** surface, the modal warns rather than
     silently closing.
   - If "Add eval case" is checked (default on), insert a `dalgo_eval_cases` row
     (question = the original user question; expected = the corrected answer).
     Exact `dalgo_eval_cases` column mapping to be confirmed against the table in
     the implementation plan.
   - Update the report: `status='resolved'`, `fixed_kb_id`, `fix_kind`,
     `resolved_by`, `resolved_at`.
4. **Run eval (optional).** After approval the modal shows a **"Run eval now"**
   button that triggers an eval run on the new case via the existing eval-run
   path. Creating the case is free and automatic; *running* it costs LLM calls
   and is opt-in.

### Dismiss

`status='dismissed'` for reports that aren't actually wrong / won't fix.
No KB write.

## Data model

Add to `wrong_answer_reports` (currently: id, message_id, reason,
retrieval_trace_snap, fixed_kb_id, reported_by, reported_at):

| Column            | Type        | Notes                                            |
|-------------------|-------------|--------------------------------------------------|
| `suggested_answer`| text NULL   | Optional correction captured at report time      |
| `status`          | text        | `'pending' \| 'resolved' \| 'dismissed'`, default `'pending'`, CHECK |
| `fix_kind`        | text NULL   | `'edited' \| 'created'` (set on resolve)         |
| `resolved_by`     | text NULL   | Admin email                                      |
| `resolved_at`     | timestamptz NULL |                                             |

No new tables. KB writes reuse existing routes; eval cases reuse
`dalgo_eval_cases`. Schema change applied to `schema.sql` AND the live DB (note
the standing schema-drift caveat in CLAUDE.md).

## Components

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `GET /api/admin/wrong-answers` | List reports (filter by status) joined to message text + conversation id + linked KB entry | auth, `wrong_answer_reports`, `messages` |
| `/admin/wrong-answers` page + nav entry | Review queue UI | the GET endpoint |
| `lib/llm/draft-kb-fix.ts` | LLM drafts a corrected KB entry; decides edit-vs-create | `lib/llm/client.ts`, follows `extract-qa.ts` |
| `POST /api/admin/wrong-answers/[id]/draft-fix` | Endpoint wrapper over the drafter | auth, report row, `draft-kb-fix` |
| `POST /api/admin/wrong-answers/[id]/resolve` | Transactional: KB write → re-run → eval case → report update | existing KB POST/PATCH logic, `runPipeline`, `dalgo_eval_cases` |
| Resolve modal (extend `WrongAnswerModal` or sibling) | Draft review, approve, dismiss, run-eval | the three endpoints above, existing `KbEditor` |

The report-time modal gains the optional `suggested_answer` field; the POST
create route persists it.

## No-gap guarantees

- **Retrieval changes:** KB writes re-embed (verified). Post-approval re-run
  proves the corrected entry ranks top before the report is marked resolved;
  failure surfaces a warning.
- **Atomic resolve:** KB write + report status + eval-case insert in one
  transaction — no half-applied state.
- **Regression-proof:** the saved eval case fails the suite if a later change
  breaks this answer.
- **Durable:** fix lives in the DB (authoritative) + KB version history; carried
  across machines via DB migration (pg_dump/restore or shared RDS), not re-seed.
  Seed files are bootstrap-only and will drift from the live KB — expected.
- **No duplicates:** the LLM prefers editing the offending existing entry over
  creating near-duplicates; admin confirms the target.

## Out of scope

- Non-admin / public reporting (admins only).
- Auto-approval without a human (admin always approves the draft).
- Writing fixes back into `lib/db/seed-data/*.ts` (optional future export
  script; DB is the source of truth).
- Bulk actions on the queue.

## Testing

- DB: migration adds columns; `wrong_answer_reports` insert with
  `suggested_answer` + status transitions.
- `GET /api/admin/wrong-answers` returns joined rows, filters by status, 401
  unauth.
- `draft-kb-fix` returns a well-formed draft for both edit and create cases
  (mock the LLM).
- `resolve` is transactional: KB written + re-embedded, report flipped, eval case
  created; a forced failure mid-way rolls everything back.
- Dismiss sets status without a KB write.
- Re-run confirmation reports top-hit correctly for a known fixed entry.
