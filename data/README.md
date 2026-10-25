# Data

## Files

| File | What it is |
|---|---|
| `raw/simulated_pilot_raw.csv`, `raw/simulated_pilot_feedback.csv` | **Simulated** participants from `scripts/generate_simulated_data.py`, with deliberate mess (dropouts, a walk-away, duplicates, a dry run, missing demographics) to exercise the cleaning rules. Not real people. |
| `raw/live_sessions.csv`, `raw/live_feedback.csv` | Real participants, exported from Supabase by `scripts/export_supabase.py`. |
| `raw/excluded_ids.txt` | Participant ids to drop before analysis (dry runs, withdrawals). |
| `clean/analysis_ready.csv` | Cleaned tickets: one row per participant × ticket, completers only. |
| `clean/feedback.csv` | Cleaned final surveys, one per participant. |
| `clean/participants.csv` | One row per participant: the unit of analysis. |

No names or contact details are collected. Ids are random (`P-xxxxxx`), and demographics are optional and coarse. Ticket text is free-form, so participants are asked not to type personal information. Check it before publishing real data.

## Tickets (`submissions` table / `*_sessions.csv`)

| Column | Meaning |
|---|---|
| `participant_id`, `session_label` | Random id; the `?session=` label from the link they used |
| `source`, `submitted_at` | `live` / `simulated` / `benchmark`; UTC timestamp |
| `years_experience`, `job_level`, `job_role` | Optional demographics |
| `snow_primed` | 1 = saw the positive ServiceNow banner (coin flip 1) |
| `ai_primed` | 1 = saw the AI hallucination warning (coin flip 2, independent) |
| `set_order` | `legacy_first` or `ai_first` |
| `test_num`, `position` | Ticket 1–6 (1–3 ServiceNow, 4–6 AI agent); order shown, 1–6 |
| `test_name`, `ticket_type`, `workflow` | Ticket name; access / software / facilities; `ServiceNow` or `AI Agent` |
| `primed` | Banner shown before *this* ticket's set |
| `completion_time` | Seconds from opening the ticket to submitting or abandoning it |
| `error_count` | Validation errors, wrong cart codes, corrections of the AI |
| `rage_quit` | 1 = pressed "Abandon ticket / I give up" |
| `frustration`, `efficiency` | 1–10 ratings after the ticket (`efficiency` is the primary outcome) |
| `ticket_text` | What the participant typed (≤ 500 characters) |
| `chosen_category` | Category finally submitted |
| `ai_category`, `ai_confidence` | AI agent's guess and stated confidence (AI tickets only) |
| `ai_correct` | 1 = participant kept the AI's category, 0 = changed it |

## Final survey (`feedback` table / `*_feedback.csv`)

| Column | Meaning |
|---|---|
| `nps_servicenow` | 0–10, how likely to recommend the ServiceNow catalog |
| `ai_trust` | 1–10, trust in the AI agent for the next ticket |
| `prefer_ai` | 1 = would rather use the AI agent next time |
| `comment` | Optional free text (≤ 400 characters) |

## Participant table (`clean/participants.csv`)

`sn_eff` / `ai_eff` and `sn_frust` / `ai_frust` are mean ratings per platform. `sn_time_gm` / `ai_time_gm` are geometric-mean seconds per ticket. `override_rate` is the share of AI tickets where the category was changed. The survey columns are merged in.
