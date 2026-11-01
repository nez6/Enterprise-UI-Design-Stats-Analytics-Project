# Data

## Files

| File | What it is |
|---|---|
| `raw/simulated_pilot_raw.csv` | **Simulated** participants from `scripts/generate_simulated_data.py`. Includes deliberate mess (dropouts, a walk-away, duplicates, a dry run, missing demographics) to exercise the cleaning rules. Not real people. |
| `raw/live_sessions.csv` | Real participants, written by `app.py` as they complete each test. Created on the first real session. |
| `raw/excluded_ids.txt` | Participant ids to drop before analysis (researcher dry runs, withdrawals). |
| `clean/analysis_ready.csv` | Cleaned long table: one row per participant × test, for completers only. |
| `clean/participants.csv` | One row per participant: the unit of analysis for H1–H3. |

No names, emails or other identifiers are collected. Participant ids are random (`LIVE-xxxxxx`), and demographics are optional and coarse.

## Raw / long-table columns (`lab/design.py: COLUMNS`)

| Column | Type | Meaning |
|---|---|---|
| `participant_id` | str | Random id assigned at the start of a session |
| `source` | str | `live` (real), `simulated` (pilot) or `benchmark` (teaching data) |
| `submitted_at` | ISO-8601 UTC | When the survey for this test was submitted (blank for simulated rows) |
| `years_experience` | int 0–25, optional | Years of work experience (25 = 25+) |
| `job_level` | category, optional | `IC / Associate`, `Lead / Manager`, `Director / Executive` |
| `job_role` | category, optional | `Project / Product Management`, `Engineering / Tech`, `Operations`, `Other` |
| `primed_arm` | 0/1 | Randomised arm (1 = sees banners before Tests 5–6) |
| `test_num` | 1–6 | Which task |
| `test_name` | str | Task name |
| `workflow` | category | `Legacy Ticketing` or `AI Bot` |
| `workflow_chaos` | 0/1 | 1 for Tests 5–6 |
| `priming_exposed` | 0/1 | `primed_arm × workflow_chaos`: was a banner shown before *this* test |
| `completion_time` | float, seconds | From test page load to submission or abandonment |
| `error_count` | int | Validation errors, wrong cart codes, fake bot errors |
| `rage_quit` | 0/1 | Pressed "Abandon Ticket / I Give Up" |
| `frustration` | int 1–10 | Post-test rating |
| `efficiency` | int 1–10 | Post-test perceived system efficiency (**primary outcome on Test 6**) |

## Participant table (`clean/participants.csv`)

| Column | Meaning |
|---|---|
| `arm` | `Primed` / `Control` |
| `baseline_time_gm`, `chaos_time_gm` | Geometric-mean completion time over Tests 1–4 and 5–6 (H2) |
| `chaos_frustration`, `chaos_efficiency` | Mean rating over Tests 5–6 (H3) |
| `t6_efficiency`, `t6_frustration`, `t6_time` | Test 6 values (H1) |
| `rage_quits` | Number of abandoned tests |

The cleaning rules and their counts are in `../results/cleaning_log.md`.
