# Guided eval-case editor — Design

**Date:** 2026-05-30
**Status:** Approved, ready for implementation plan

## Problem

The `/admin/evals/new` (and `/admin/evals/[id]`) editor at [components/admin/eval-case-editor.tsx](components/admin/eval-case-editor.tsx) requires teammates to hand-write the `expected` field as raw JSON. They have to know that ticking `retrieval-judge` implies fields like `must_cite_one_of` or `must_not_hallucinate_urls`, but nothing in the form tells them that. The "Common fields" footnote lists field names without meanings, examples, or which judge consumes what. The JSON textarea also doesn't react to judge-checkbox changes, so teammates discover the right JSON shape by reading existing seed files.

Non-technical reviewers — the people most likely to author cases — cannot use the form without coaching.

## Goal

A teammate who has never written JSON can author a new eval case by:
1. Picking a bucket from a dropdown (judges and expected defaults appear automatically).
2. Filling labelled form fields ("URLs the answer must include (at least one)", "Bot must express uncertainty", etc.).
3. Reading a context-aware help panel that explains the currently selected judge with two real examples and a "Load this example" button.

Power users keep an "Edit JSON directly" toggle for hand-written cases.

## Non-goals

- No changes to the eval judges themselves (`lib/llm/eval/judges/*.ts`). Same fields, same semantics.
- No changes to the DB schema or API endpoints. `dalgo_eval_cases.expected` is still a free-form `jsonb`; `POST /api/admin/eval-cases` still accepts `{ expected: Record<string, unknown>, judges: string[], ... }`.
- No mobile-first redesign. A single-column fallback below the `md` breakpoint is enough.
- No "preview the eval result before saving" feature. Out of scope.
- No bulk import / CSV import.

## Layout

The page widens from `max-w-3xl` (today) to a two-column grid on `md+` screens:

- Left column: the form (~⅔ width).
- Right column: the help panel (~⅓ width, sticky inside the viewport when scrolling).

Below the `md` breakpoint the help panel stacks beneath the form.

## Form behaviour

### Case key auto-fill

- On mount, the editor fetches the existing case-key list once via the same `GET /api/admin/eval-cases` endpoint the list page uses.
- Each bucket has a fixed prefix: `citations → cit-`, `guardrails → gr-`, `problem-statement → ps-`, `structure → st-`, `tool-names → tn-`.
- When the bucket changes, the editor computes the next zero-padded number for that prefix (existing `cit-01..cit-12` → `cit-13`) and writes it into the case-key input — **only** if the input is currently empty or still equal to a previously-auto-filled value. A custom key the user typed is never overwritten.
- The input stays fully editable. The user can replace the suggestion with anything.
- As the user types, an inline "Already exists" hint appears below the field if the current value matches an existing case key. (Server-side uniqueness still catches it on save; this is just a quicker signal.)
- In `mode === 'edit'` the input is disabled (today's behavior). The auto-fill logic and duplicate-warning logic both no-op in edit mode.

### Bucket → template

Changing the bucket applies a template — wholesale replacing `judges` and `expected`:

| Bucket | Judges | Expected |
|---|---|---|
| `citations` | `[retrieval-judge]` | `{ must_not_hallucinate_urls: true }` |
| `guardrails` | `[retrieval-judge, llm-judge]` | `{ must_express_uncertainty: true, must_record_unanswered: true }` |
| `problem-statement` | `[retrieval-judge]` | `{ matched_pattern: '' }` |
| `structure` | `[llm-judge]` | `{ structure: ['problem_framing','dalgo_approach','evidence'] }` |
| `tool-names` | `[llm-judge]` | `{}` |

Templates only apply when the bucket changes (not on every render). Once applied, the user can untick judges, change expected fields, or load an example — all of which override the template.

In edit mode, switching bucket on an existing case **also** applies the template. The user is overwriting an existing case's structure intentionally if they change the bucket; treating the bucket switch as "change everything to match" is consistent with create mode.

### Judges checkbox group

Same UI as today: checkboxes for `retrieval-judge`, `llm-judge`, `exact-match`. Ticking/unticking a judge:
- Adds/removes the judge from `value.judges`.
- Reveals/hides that judge's fields in the visual Expected form below.
- Removes the unchecked judge's fields from `value.expected` so the saved JSON doesn't carry stale data. Fields shared between judges (e.g. `matched_pattern` shared between retrieval-judge and exact-match) only get removed when the **last** owning judge is unchecked.

### Expected — visual form (replaces JSON textarea)

The textarea is replaced by labelled inputs that appear conditionally based on which judges are checked.

Field ownership comes from what each judge actually reads in `lib/llm/eval/judges/*.ts` at HEAD:

**Retrieval-judge fields** (reads `must_cite_one_of`, `must_not_hallucinate_urls`, `matched_pattern`):
- `must_cite_one_of` — chip-list URL input. Label: "URLs the answer must include (at least one)". User pastes a URL and presses Enter or clicks "Add"; chips are removable. Stored as `string[]`.
- `must_not_hallucinate_urls` — toggle. Label: "Reject any URL the bot invents (not in the retrieved sources)".
- `matched_pattern` — text input. Label: "Expected problem-pattern slug" (with helper text linking to `lib/db/seed-data/problem-patterns.ts`).
- `must_retrieve_blog_mentioning` — text input. Label: "At least one retrieved blog chunk must contain this term". **Note:** This field is set on the seed `tool-names` cases but the runner does not currently consume it. We still expose the input so existing cases can be edited round-trip without data loss; the help-panel description should call this out as "advisory: not enforced by the current runner".

**LLM-judge fields** (reads `structure`, `must_express_uncertainty`):
- `must_express_uncertainty` — toggle. Label: "Bot must say 'not sure' or equivalent".
- `structure` — three checkboxes for `problem_framing`, `dalgo_approach`, `evidence`. Label: "Required sections of the 3-part consultant reply". Checked sections are kept in order `[problem_framing, dalgo_approach, evidence]`.

**Exact-match fields** (reads `must_record_unanswered` only — confirmed in `lib/llm/eval/judges/exact-match.ts`):
- `must_record_unanswered` — toggle. Label: "An `unanswered_questions` row must be created for this question".

Empty/falsy values (empty string, empty array, `false`) are **stripped** from `value.expected` on save so we don't bloat the DB row with `false`/`""` entries the judges would ignore anyway.

### Edit JSON directly (toggle)

A small toggle ("Edit JSON directly") below the Expected form swaps the visual form for the current JSON textarea. Behavior:

- Toggle **on** (form → JSON): `JSON.stringify(value.expected, null, 2)` is loaded into the textarea. The visual form hides.
- Toggle **off** (JSON → form): we `JSON.parse` the textarea. If parse succeeds, the result becomes `value.expected` and the visual form reappears. If parse fails, the toggle stays on and the existing parse-error message shows.

Both modes write to the same `value.expected` source of truth. No drift.

### Other fields

`User input`, `Notes`, `Enabled`, `Create / Save / Delete` — unchanged from today.

## Help panel (right column)

Context-aware. Shows help for the **last-toggled-on** judge. If no judges are checked yet, shows the bucket's template description ("Citations cases use retrieval-judge to verify the bot only cites URLs that were actually retrieved").

For each judge, three sections:

1. **What it checks.** One sentence in plain English.
   - retrieval-judge: "Looks at which URLs the bot cited and whether they came from the retrieved sources. Also checks pattern-matching and the unanswered-questions log."
   - llm-judge: "Asks Claude Haiku to score the response against your stated expectations (uncertainty language, structure)."
   - exact-match: "Checks that a specific substring appears verbatim in the response."
2. **Fields it uses.** A definition list mapping each form-field label to a one-line meaning and "when to use it".
3. **Examples.** Two real examples per judge, sourced from `lib/llm/eval/cases/*.ts` at build time. Each example shows:
   - The `id` (e.g. `cit-05`) and bucket
   - The `input` (user question)
   - The `expected` JSON (pretty-printed)
   - A **"Load this example"** button.

**"Load this example" behavior:** overwrites `bucket`, `input`, `judges`, `expected`, `notes`. Preserves `case_key` (so a half-typed identifier isn't clobbered) and `enabled`. After loading, the case-key duplicate-warning logic re-runs against the new state.

A small "Show all judges" link at the top of the panel expands a static reference card listing every judge and every field — for the rare case where someone wants the full reference (e.g., authoring a case in edit mode where the help is currently scoped to the changed judge).

## Data flow

Single source of truth: `value: EvalCaseFormValue` (same shape as today, defined at [components/admin/eval-case-editor.tsx:5-13](components/admin/eval-case-editor.tsx#L5-L13)).

- Visual form fields read/write directly into `value.expected[fieldName]`.
- JSON textarea reads `JSON.stringify(value.expected)` and writes `JSON.parse(...)` back.
- The "edit JSON directly" toggle only swaps the rendering, not the source.
- Bucket-change handler is the only place that wholesale replaces `judges` + `expected` (the template apply).
- "Load this example" is the only other place that wholesale replaces multiple fields.

`save()` (existing) strips empty/falsy entries from `value.expected`, then POSTs/PUTs to the existing endpoint. No API change.

## Files

- **New** `lib/eval-case-templates.ts` — pure data: bucket → template, judge → metadata, judge → example IDs. No React, no DB. The examples themselves are pulled from `lib/llm/eval/cases/*.ts` by importing the case arrays and filtering by ID.
- **New** `components/admin/eval-case-form-fields.tsx` — the visual Expected form. Takes `{ judges: string[]; expected: Record<string, unknown>; onChange: (next) => void }`. Renders the right fields based on which judges are checked.
- **New** `components/admin/eval-case-help-panel.tsx` — the right-side panel. Takes `{ judges: string[]; bucket: string; activeJudge: string | null; onLoadExample: (example) => void }`.
- **Modify** `components/admin/eval-case-editor.tsx` — wraps the existing fields in a two-column grid, wires up the case-key auto-fill, the bucket-template handler, the "Edit JSON directly" toggle, and the help panel. The existing JSON textarea code is kept as the toggle-on view (DRY: don't duplicate it).
- **No backend changes.**

## Testing

### Unit (Vitest)

- `tests/lib/eval-case-templates.test.ts` — for each bucket, the template object has the expected `judges` array and `expected` object. For each judge, the field-metadata array has the right field names. For each judge, the example IDs resolve to real cases in `lib/llm/eval/cases/*.ts`.
- `tests/lib/eval-case-templates.test.ts` — `computeNextCaseKey(prefix, existingKeys)` returns the right next-zero-padded id (e.g. `('cit-', ['cit-01','cit-12']) → 'cit-13'`; `('gr-', []) → 'gr-01'`; ignores non-matching prefixes).

### Component (Vitest + Testing Library)

- Bucket change applies the template: switching from `citations` to `guardrails` sets judges to `[retrieval-judge, llm-judge]` and expected to `{ must_express_uncertainty: true, must_record_unanswered: true }`.
- Bucket change does NOT clobber a custom case key: pre-fill `case_key: 'custom-key-99'`, switch bucket, key stays `custom-key-99`.
- Ticking llm-judge reveals the structure picker; unticking it removes the structure field from `value.expected`.
- Ticking retrieval-judge then exact-match: `matched_pattern` field is shared (single input). Unticking exact-match while retrieval-judge still ticked keeps the field. Unticking retrieval-judge while exact-match still ticked also keeps it. Only unticking both removes it.
- "Load this example" fills bucket/input/judges/expected/notes but preserves case_key + enabled.
- "Edit JSON directly" toggle round-trips: visual → JSON → visual, value.expected is identical at the end.
- Invalid JSON keeps the toggle on and shows the parse error.

### Manual smoke

1. Start dev server, sign in as admin, open `/admin/evals/new`.
2. Create one case per bucket via the form (no JSON editing). Verify each saves, then open the edit page and confirm `expected` matches what the form built.
3. Toggle "Edit JSON directly", edit raw JSON, toggle back. Confirm visual form reflects the change.
4. Trigger duplicate-key warning by typing an existing key.
5. Click "Load this example" on a retrieval-judge example, confirm form is filled and case_key is preserved.

## Risks and notes

- **Help-panel examples are read from `lib/llm/eval/cases/*.ts`.** That file is imported at build time so examples are always in sync with the seed cases. If a teammate later changes a case in the DB, the example pulled from the seed file may not match what's in production — acceptable, since the help panel is for authorship guidance, not for showing live production state.
- **Bucket templates use today's prefixes.** If the team adds a new bucket later, `lib/eval-case-templates.ts` needs a new entry. Same risk as any add-a-bucket change. Documented in the file's header comment.
- **"Sticky" right column requires a fixed-height container or sticky positioning.** Standard Tailwind `md:sticky md:top-N` works inside the `max-w-6xl` page layout.
- **No accessibility-of-chip-list field test in scope.** Keyboard support (Enter to add, Backspace to remove last) is part of the design but verified manually.
- **The shared `matched_pattern` field** is a known quirk in the data model. Documented in the help panel ("Used by both retrieval-judge and exact-match when checked").
