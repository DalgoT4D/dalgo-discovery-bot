# Managing the Knowledge Base

This guide is for the Dalgo team — anyone who reviews bot conversations and improves what the bot knows. **You do not need a developer to do any of this.** Every change you make below is live for the next user message, with no waiting and no deploy.

---

## What the bot retrieves from

The bot has three retrievable sources of truth, all hit at chat time:

| Source | What lives there | How it's updated |
|---|---|---|
| **Knowledge base** (`dalgo_knowledge_base`) | Curated Q&A about Dalgo's capabilities. ~200 entries today. | `/admin/kb/` — add, edit, delete from the admin UI |
| **Blog corpus** (`dalgo_blog_chunks`) | NGO customer stories from projecttech4dev.org/blog | Edit the upstream blog → click Refresh on `/admin/blogs/` |
| **Docs corpus** (`dalgo_docs_chunks`) *(shipping next)* | Official product docs from the DalgoT4D/dalgo_docs repo | Edit the upstream docs → click Refresh on `/admin/docs/` |

This doc focuses on the **knowledge base** — the one source you edit directly in the admin UI without touching another system.

---

## The three buttons under every bot reply

Open any past conversation at `/admin/conversations/<id>`. Each assistant message has three buttons:

### ↗ Promote to KB — *the bot improvised a great answer*

Use when the bot stitched together a really good answer from multiple KB entries (or partly from blogs/docs) and you want to **lock that quality in** so the bot doesn't have to improvise it again next time.

Click → modal opens with the previous user question + this assistant reply pre-filled → edit either if you want → save → it's a new KB entry, embedded immediately, retrievable on the next chat request.

**Example:** User asks "Can I export a dashboard as a PDF?" The bot composes a good answer from three different KB rows. Promote it. Now next time someone asks the same question, the bot finds this exact pre-written answer instead of rolling the dice.

### ⚠ This answer is wrong — *fix the KB entry that misled the bot*

Use when the reply is **wrong or misleading** AND you can identify a specific KB entry that confused the bot.

Click → three-stage modal:
1. Type what was wrong (free text, e.g., "claimed Dalgo has RLS but RLS is a Superset feature")
2. Modal shows the top KB candidates that fed this reply — pick the one that misled the bot
3. KB editor opens inline pre-filled with that row → fix the wording → save

The row gets re-embedded automatically. The report itself is saved with `fixed_kb_id` populated, so you can later see "X reports got fixed this way."

If none of the candidates were the culprit (sometimes the issue is the prompt, not a KB row), click **"None of these — skip fix."** The report still saves; you didn't lose the signal that something was wrong.

**Example:** Bot claims "Dalgo includes Superset for free." Click ⚠ → "Superset is a paid ₹48,000/year add-on, not included" → pick the pricing KB row → fix the wording to be crystal clear → save. The next user asking about Superset pricing within 60 seconds gets the corrected reply.

### 👁 View retrieval debug — *diagnose, don't fix*

Read-only X-ray of how the bot built this reply. Shows:

- The HyDE-expanded query rewrites (the bot rewrites the user's question into 1-3 hypothetical answers before searching, to get better vector matches)
- The top-12 candidates from vector + lexical search across KB + blogs + docs
- The Claude reranker's scores per candidate
- The final context the bot saw before composing the reply

**Use when:** You think something's off but you're not sure whether to fix the KB, fix the prompt, or add a new KB entry. The debug tells you which.

Two interpretations:
- **Retrieval brought the right info but the bot ignored it** → the prompt is the problem. Edit `/admin/prompts/rules` or `/admin/prompts/dalgo_vs_3rd_party`
- **Retrieval missed the right info** → the KB is the problem. Either add a new entry, or improve `question_variants` on an existing one so it gets matched

---

## Editing a KB entry directly at `/admin/kb/<id>`

Sometimes you don't need to fix a KB entry via a wrong-answer report — you just want to edit one. Go to `/admin/kb`, click any entry, edit fields, save.

**Which fields, when you edit, trigger a re-embed** (regenerating the vector representation OpenAI uses to find this entry):

| Field | Re-embeds on edit? | Why |
|---|---|---|
| **Question variants** (one per line) | **Yes** | These are what the bot's search "matches against." Changing them changes what kinds of questions retrieve this entry. |
| **Canonical answer** | **Yes** | This is what the bot reads to compose its reply. The vector is computed from question_variants + canonical_answer combined. |
| Status (yes / partial / no / roadmap) | No | Metadata only; doesn't affect retrieval. |
| Category | No | Used for filtering, doesn't affect the vector. |
| NGO framing | No | Internal field, not embedded. |
| Evidence (URLs) | No | Cited but not embedded. |
| Notes for sales | No | Internal, never shown to users. |

So: editing the **meaning** of an entry re-embeds; editing **metadata around it** doesn't. This is intentional — re-embedding costs a fraction of a cent per entry but adds a second or two of latency, so we skip it when nothing semantic changed.

**Adding a new entry** (`/admin/kb/new`): same form, fresh embed on save, available for retrieval on the very next chat request.

**Deleting an entry**: one click on the Delete button. The entry is gone immediately and can never be retrieved again. No orphan data to clean up.

---

## When does each change actually take effect?

| Change | Live on next chat request? |
|---|---|
| Add a new KB entry | **Yes**, immediately |
| Edit a KB entry's questions or answer | **Yes**, immediately |
| Edit a KB entry's metadata (status, category, etc.) | **Yes**, immediately |
| Delete a KB entry | **Yes**, immediately — gone for good |
| Edit a prompt at `/admin/prompts/` | Within 60 seconds (prompts have a 60s cache; KB doesn't) |
| Refresh blogs via `/admin/blogs/` | Whenever the refresh job finishes |
| Refresh docs via `/admin/docs/` *(once shipped)* | Whenever the refresh job finishes |

There is **no cache to bust** for KB. Every chat turn, every time the bot calls `search_dalgo_kb`, it queries the live database. The vector index updates automatically.

**Even mid-conversation:** if a user is chatting right now and you fix a KB entry, their next message in that same conversation already gets the corrected behavior. You don't need to "kick" them out.

---

## The healthy testing loop

The team's job during internal testing (before opening to NGOs) is to live in this loop:

1. **Use the bot** the way a curious NGO leader would. Ask the questions you think they'd ask. Try to break it.
2. **Read the transcript** at `/admin/conversations/`.
3. **For each suspicious reply:**
   - Open **debug** to see what retrieval brought
   - If retrieval was good but the bot ignored it → edit a **prompt section** at `/admin/prompts/`
   - If retrieval missed → **add a KB entry**, or improve question_variants on an existing one
   - If retrieval brought a wrong KB entry → **fix that entry** via the wrong-answer flow
4. **Repeat.** Each cycle the bot gets a little smarter without a single line of code changing.

---

## When you should still call a developer

The admin UI covers most needs. Call a developer if you want to:

- Add a **new prompt section** (we have 6: identity, tools_inventory, rules, consultant_mode, dalgo_vs_3rd_party, fit_assessment). Adding a 7th requires a small code change.
- Add a **new corpus type** (e.g., a Slack-history retriever, an FAQ from your website). Each new source needs schema + parser + tool.
- Add a **new tool** the bot can call.
- Change the **model** or retrieval thresholds.

Everything else — adding a fact, fixing a wrong answer, changing the bot's tone — is a thing you do yourself in the admin UI.

---

## Cost note

KB re-embedding uses OpenAI `text-embedding-3-small` at 1536 dimensions. Cost per re-embed: **~$0.0001** (a hundredth of a cent). Even rewriting every single KB entry from scratch would cost ~$0.02 total. Don't worry about embedding costs when editing — they're a rounding error.

The expensive thing in this system is the **chat** itself (Claude API), not the KB. So edit liberally — the cost is your team's time, not the API.
