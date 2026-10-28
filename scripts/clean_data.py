"""Clean raw telemetry into analysis-ready tables.

Input : a ticket CSV and a feedback CSV in the site's export schema
        (lab.design.COLUMNS / FEEDBACK_COLUMNS), e.g. from scripts/export_supabase.py
        or scripts/generate_simulated_data.py.
Output: data/clean/analysis_ready.csv   one row per participant x ticket
        data/clean/participants.csv     one row per participant (unit of analysis)
        results/cleaning_log.{json,md}  every rule applied, with counts

Rules (fixed before looking at outcomes; report section 6):
1. Drop ids listed in data/raw/excluded_ids.txt (dry runs) and every participant in
   data/raw/live_withdrawals.csv (people who withdrew at the debrief).
2. Drop double-submitted rows (same participant and ticket), keeping the first.
3. Drop rows with impossible values (ratings outside 1-10, non-positive times...).
4. Blank out-of-range demographics rather than dropping the participant.
5. Re-derive design columns from lab.design, and drop participants whose banner
   assignment changes between rows.
6. Exclude participants with any ticket longer than 30 minutes (walked away).
7. Keep only participants who completed all six tickets.

Usage:  python scripts/clean_data.py --raw data/raw/live_sessions.csv --feedback data/raw/live_feedback.csv
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from lab.design import AI, COLUMNS, FEEDBACK_COLUMNS, JOB_LEVELS, JOB_ROLES, LEGACY, TESTS  # noqa: E402

WALKAWAY_SECONDS = 30 * 60
NUMERIC = ["years_experience", "snow_primed", "ai_primed", "test_num", "position", "primed", "completion_time",
           "error_count", "rage_quit", "frustration", "efficiency", "ai_confidence", "ai_correct",
           "ai_error_injected", "ai_error_caught"]


def read_excluded(path):
    if not path or not Path(path).exists():
        return set()
    lines = (line.strip() for line in Path(path).read_text().splitlines())
    return {line for line in lines if line and not line.startswith("#")}


def clean(raw, excluded_ids=()):
    """Apply the cleaning rules. Returns (clean long dataframe, list of log entries)."""
    missing = set(COLUMNS) - set(raw.columns)
    if missing:
        raise ValueError(f"raw data is missing columns: {sorted(missing)}")
    df = raw[COLUMNS].copy()
    log = [dict(rule="Raw data loaded", rows_before=len(df), rows_after=len(df),
                participants_before=df["participant_id"].nunique(), participants_after=df["participant_id"].nunique(), note="")]

    def step(rule, new_df, note=""):
        log.append(dict(rule=rule, rows_before=len(df), rows_after=len(new_df),
                        participants_before=df["participant_id"].nunique(),
                        participants_after=new_df["participant_id"].nunique(), note=note))
        return new_df

    df = step("Excluded ids removed (dry runs / withdrawals)", df[~df["participant_id"].isin(excluded_ids)])
    df = step("Double-submitted rows removed", df.drop_duplicates(["participant_id", "test_num"], keep="first"))

    for col in NUMERIC:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    valid = (
        df["test_num"].isin(TESTS) & df["frustration"].between(1, 10) & df["efficiency"].between(1, 10)
        & (df["completion_time"] > 0) & (df["error_count"] >= 0) & df["rage_quit"].isin([0, 1])
        & df["snow_primed"].isin([0, 1]) & df["ai_primed"].isin([0, 1])
    )
    df = step("Rows with impossible values removed", df[valid].copy())

    bad_demo = (~df["job_level"].isin(JOB_LEVELS)) | (~df["job_role"].isin(JOB_ROLES)) | (~df["years_experience"].between(0, 25))
    df.loc[~df["job_level"].isin(JOB_LEVELS), "job_level"] = np.nan
    df.loc[~df["job_role"].isin(JOB_ROLES), "job_role"] = np.nan
    df.loc[~df["years_experience"].between(0, 25), "years_experience"] = np.nan
    df = step("Demographics validated (blanked, not dropped)", df,
              f"{df.loc[bad_demo, 'participant_id'].nunique()} participant(s) have at least one missing/blank demographic")

    # Design columns are re-derived so a bug in the site can never mislabel a condition.
    df["test_num"] = df["test_num"].astype(int)
    for col, key in [("test_name", "name"), ("workflow", "workflow"), ("ticket_type", "type")]:
        df[col] = df["test_num"].map(lambda t, k=key: TESTS[t][k])
    df["primed"] = np.where(df["workflow"] == AI, df["ai_primed"], df["snow_primed"]).astype(int)
    changes = df.groupby("participant_id")[["snow_primed", "ai_primed"]].nunique().max(axis=1)
    df = step("Participants with inconsistent banner assignment removed", df[~df["participant_id"].isin(changes[changes > 1].index)])

    walked = df.loc[df["completion_time"] > WALKAWAY_SECONDS, "participant_id"].unique()
    df = step("Walk-aways removed (any ticket > 30 min)", df[~df["participant_id"].isin(walked)])

    counts = df.groupby("participant_id")["test_num"].nunique()
    df = step("Incomplete participants removed (< 6 tickets)", df[df["participant_id"].isin(counts[counts == len(TESTS)].index)])

    for col in ["snow_primed", "ai_primed", "error_count", "rage_quit", "frustration", "efficiency"]:
        df[col] = df[col].astype(int)
    return df.sort_values(["participant_id", "test_num"]).reset_index(drop=True), log


def clean_feedback(fb, keep_ids):
    fb = fb[[c for c in FEEDBACK_COLUMNS if c in fb.columns]].copy()
    fb = fb[fb["participant_id"].isin(keep_ids)].drop_duplicates("participant_id", keep="first")
    for col in ["mc_snow", "mc_ai"]:
        if col in fb:
            fb.loc[~fb[col].isin(["yes", "no", "unsure"]), col] = np.nan
    for col in ["nps_servicenow", "ai_trust", "prefer_ai"]:
        fb[col] = pd.to_numeric(fb[col], errors="coerce")
    fb.loc[~fb["nps_servicenow"].between(0, 10), "nps_servicenow"] = np.nan
    fb.loc[~fb["ai_trust"].between(1, 10), "ai_trust"] = np.nan
    fb.loc[~fb["prefer_ai"].isin([0, 1]), "prefer_ai"] = np.nan
    return fb


def participant_table(df, fb=None):
    """One row per participant: the unit of analysis for every confirmatory test."""
    def geo(s):
        return float(np.exp(np.log(s).mean()))

    g = df.groupby("participant_id")
    out = g.agg(snow_primed=("snow_primed", "first"), ai_primed=("ai_primed", "first"),
                years_experience=("years_experience", "first"), job_level=("job_level", "first"),
                job_role=("job_role", "first"), rage_quits=("rage_quit", "sum"))
    # Which set came first, from the ticket actually shown first.
    out["set_order"] = df.sort_values("position").groupby("participant_id")["workflow"].first().map({LEGACY: "legacy_first", AI: "ai_first"})
    for wf, tag in [(LEGACY, "sn"), (AI, "ai")]:
        sub = df[df["workflow"] == wf].groupby("participant_id")
        out[f"{tag}_eff"] = sub["efficiency"].mean()
        out[f"{tag}_frust"] = sub["frustration"].mean()
        out[f"{tag}_time_gm"] = sub["completion_time"].apply(geo)
    ai = df[(df["workflow"] == AI) & df["ai_correct"].notna()].groupby("participant_id")["ai_correct"]
    out["ai_tickets_rated"] = ai.size()
    out["override_rate"] = 1 - ai.mean()
    out = out.reset_index()
    if fb is not None and len(fb):
        out = out.merge(fb[["participant_id", "nps_servicenow", "ai_trust", "prefer_ai"]], on="participant_id", how="left")
    return out


def write_log(log, data_source, raw_path, n_feedback):
    md = ["# Cleaning log", "", f"Raw file: `{raw_path}` · data source: **{data_source}** · final-survey responses kept: {n_feedback}", "",
          "| Rule | Rows before → after | Participants before → after | Note |", "|---|---|---|---|"]
    md += [f"| {e['rule']} | {e['rows_before']} → {e['rows_after']} | {e['participants_before']} → {e['participants_after']} | {e['note']} |" for e in log]
    out = ROOT / "results"
    out.mkdir(exist_ok=True)
    (out / "cleaning_log.md").write_text("\n".join(md) + "\n")
    (out / "cleaning_log.json").write_text(json.dumps(dict(data_source=data_source, raw_file=str(raw_path), n_feedback=n_feedback, steps=log), indent=2))


def main(argv=None):
    ap = argparse.ArgumentParser(description="Clean raw telemetry into analysis-ready tables.")
    ap.add_argument("--raw", default=str(ROOT / "data" / "raw" / "simulated_pilot_raw.csv"))
    ap.add_argument("--feedback", default=None, help="feedback CSV (default: <raw stem with _raw→_feedback>)")
    ap.add_argument("--excluded", default=str(ROOT / "data" / "raw" / "excluded_ids.txt"))
    args = ap.parse_args(argv)

    raw_path = Path(args.raw)
    fb_path = Path(args.feedback) if args.feedback else raw_path.with_name(raw_path.name.replace("_raw", "_feedback").replace("_sessions", "_feedback"))
    raw = pd.read_csv(raw_path)
    fb_raw = pd.read_csv(fb_path) if fb_path.exists() else pd.DataFrame(columns=FEEDBACK_COLUMNS)
    sources = sorted(raw["source"].dropna().unique())
    data_source = "simulated" if sources == ["simulated"] else "live" if sources == ["live"] else "+".join(sources)

    excluded = read_excluded(args.excluded)
    wd_path = raw_path.with_name("live_withdrawals.csv")
    if wd_path.exists():
        excluded |= set(pd.read_csv(wd_path)["participant_id"].dropna())
    df, log = clean(raw, excluded)
    if df.empty:
        sys.exit("No participants survived cleaning. Check the raw file and the log.")
    fb = clean_feedback(fb_raw, set(df["participant_id"]))
    clean_dir = ROOT / "data" / "clean"
    clean_dir.mkdir(parents=True, exist_ok=True)
    # Data minimisation: the analysis never uses free text, so it is not kept in the clean data.
    df.drop(columns=["ticket_text"]).to_csv(clean_dir / "analysis_ready.csv", index=False)
    fb.drop(columns=["comment"], errors="ignore").to_csv(clean_dir / "feedback.csv", index=False)
    participant_table(df, fb).to_csv(clean_dir / "participants.csv", index=False)
    rel = raw_path.resolve().relative_to(ROOT) if raw_path.resolve().is_relative_to(ROOT) else raw_path
    write_log(log, data_source, rel, len(fb))
    print(f"Clean data: {df['participant_id'].nunique()} participants, {len(df)} tickets, {len(fb)} surveys ({data_source}).")


if __name__ == "__main__":
    main()
