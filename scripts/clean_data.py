"""Clean raw telemetry into analysis-ready tables.

Input : a raw CSV in the app's schema (lab.design.COLUMNS), e.g.
        data/raw/live_sessions.csv (real participants) or
        data/raw/simulated_pilot_raw.csv (simulated pilot).
Output: data/clean/analysis_ready.csv   one row per participant x test
        data/clean/participants.csv     one row per participant (unit of analysis)
        results/cleaning_log.{json,md}  every rule applied, with counts

The rules below were fixed before looking at outcomes (see report section 6):

1. Drop ids listed in data/raw/excluded_ids.txt (dry runs, withdrawals).
2. Drop double-submitted rows (same participant_id and test_num): keep the first.
3. Drop rows with impossible values (ratings outside 1-10, non-positive times...).
4. Blank out-of-range demographics rather than dropping the participant.
5. Re-derive design columns (workflow, chaos, priming exposure) from lab.design,
   and drop participants whose randomised arm changes between rows.
6. Exclude participants with any test longer than 30 minutes (walked away).
7. Keep only participants who completed all six tests.

Usage:  python scripts/clean_data.py --raw data/raw/live_sessions.csv
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from lab.design import COLUMNS, JOB_LEVELS, JOB_ROLES, TESTS  # noqa: E402

WALKAWAY_SECONDS = 30 * 60
NUMERIC = ["years_experience", "primed_arm", "test_num", "workflow_chaos", "priming_exposed",
           "completion_time", "error_count", "rage_quit", "frustration", "efficiency"]


def read_excluded(path):
    if not path or not Path(path).exists():
        return set()
    lines = (l.strip() for l in Path(path).read_text().splitlines())
    return {l for l in lines if l and not l.startswith("#")}


def clean(raw, excluded_ids=()):
    """Apply the cleaning rules. Returns (clean long dataframe, list of log entries)."""
    missing = set(COLUMNS) - set(raw.columns)
    if missing:
        raise ValueError(f"raw data is missing columns: {sorted(missing)}")

    log = []
    df = raw[COLUMNS].copy()

    def step(rule, new_df, note=""):
        log.append(dict(
            rule=rule,
            rows_before=len(df), rows_after=len(new_df),
            participants_before=df["participant_id"].nunique(),
            participants_after=new_df["participant_id"].nunique(),
            note=note,
        ))
        return new_df

    log.append(dict(rule="Raw data loaded", rows_before=len(df), rows_after=len(df),
                    participants_before=df["participant_id"].nunique(),
                    participants_after=df["participant_id"].nunique(), note=""))

    # 1. Excluded ids
    df = step("Excluded ids removed (dry runs / withdrawals)",
              df[~df["participant_id"].isin(excluded_ids)])

    # 2. Duplicates
    df = step("Double-submitted rows removed",
              df.drop_duplicates(["participant_id", "test_num"], keep="first"))

    # 3. Types and impossible values
    for col in NUMERIC:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    valid = (
        df["test_num"].isin(TESTS)
        & df["frustration"].between(1, 10)
        & df["efficiency"].between(1, 10)
        & (df["completion_time"] > 0)
        & (df["error_count"] >= 0)
        & df["rage_quit"].isin([0, 1])
        & df["primed_arm"].isin([0, 1])
    )
    df = step("Rows with impossible values removed", df[valid].copy())

    # 4. Demographics: blank anything unexpected, keep the participant
    bad_demo = ~df["job_level"].isin(JOB_LEVELS) | ~df["job_role"].isin(JOB_ROLES) \
        | ~df["years_experience"].between(0, 25)
    df.loc[~df["job_level"].isin(JOB_LEVELS), "job_level"] = np.nan
    df.loc[~df["job_role"].isin(JOB_ROLES), "job_role"] = np.nan
    df.loc[~df["years_experience"].between(0, 25), "years_experience"] = np.nan
    n_missing_demo = df.loc[bad_demo, "participant_id"].nunique()
    df = step("Demographics validated (blanked, not dropped)", df,
              f"{n_missing_demo} participant(s) have at least one missing/blank demographic")

    # 5. Design columns are re-derived so a typo in the app can never mislabel a condition
    df["test_num"] = df["test_num"].astype(int)
    df["test_name"] = df["test_num"].map(lambda t: TESTS[t]["name"])
    df["workflow"] = df["test_num"].map(lambda t: TESTS[t]["workflow"])
    df["workflow_chaos"] = df["test_num"].map(lambda t: TESTS[t]["chaos"])
    df["priming_exposed"] = (df["primed_arm"] * df["workflow_chaos"]).astype(int)
    arm_changes = df.groupby("participant_id")["primed_arm"].nunique()
    df = step("Participants with inconsistent arm removed",
              df[~df["participant_id"].isin(arm_changes[arm_changes > 1].index)])

    # 6. Walk-aways
    walked = df.loc[df["completion_time"] > WALKAWAY_SECONDS, "participant_id"].unique()
    df = step("Walk-aways removed (any test > 30 min)", df[~df["participant_id"].isin(walked)])

    # 7. Completers only
    counts = df.groupby("participant_id")["test_num"].nunique()
    df = step("Incomplete participants removed (< 6 tests)",
              df[df["participant_id"].isin(counts[counts == len(TESTS)].index)])

    for col in ["primed_arm", "error_count", "rage_quit", "frustration", "efficiency"]:
        df[col] = df[col].astype(int)
    return df.sort_values(["participant_id", "test_num"]).reset_index(drop=True), log


def participant_table(df):
    """One row per participant: the unit of analysis for H1-H3."""
    def geo_mean(s):
        return float(np.exp(np.log(s).mean()))

    g = df.groupby("participant_id")
    out = g.agg(
        primed_arm=("primed_arm", "first"),
        years_experience=("years_experience", "first"),
        job_level=("job_level", "first"),
        job_role=("job_role", "first"),
        rage_quits=("rage_quit", "sum"),
    )
    out["arm"] = np.where(out["primed_arm"] == 1, "Primed", "Control")
    out["baseline_time_gm"] = df[df["workflow_chaos"] == 0].groupby("participant_id")["completion_time"].apply(geo_mean)
    out["chaos_time_gm"] = df[df["workflow_chaos"] == 1].groupby("participant_id")["completion_time"].apply(geo_mean)
    chaos = df[df["workflow_chaos"] == 1].groupby("participant_id")
    out["chaos_frustration"] = chaos["frustration"].mean()
    out["chaos_efficiency"] = chaos["efficiency"].mean()
    t6 = df[df["test_num"] == 6].set_index("participant_id")
    out["t6_efficiency"] = t6["efficiency"]
    out["t6_frustration"] = t6["frustration"]
    out["t6_time"] = t6["completion_time"]
    return out.reset_index()


def write_log(log, data_source, raw_path):
    md = ["# Cleaning log", "",
          f"Raw file: `{raw_path}` · data source: **{data_source}**", "",
          "| Rule | Rows before → after | Participants before → after | Note |",
          "|---|---|---|---|"]
    for e in log:
        md.append(f"| {e['rule']} | {e['rows_before']} → {e['rows_after']} | "
                  f"{e['participants_before']} → {e['participants_after']} | {e['note']} |")
    out = ROOT / "results"
    out.mkdir(exist_ok=True)
    (out / "cleaning_log.md").write_text("\n".join(md) + "\n")
    (out / "cleaning_log.json").write_text(json.dumps(
        dict(data_source=data_source, raw_file=str(raw_path), steps=log), indent=2))


def main(argv=None):
    ap = argparse.ArgumentParser(description="Clean raw telemetry into analysis-ready tables.")
    ap.add_argument("--raw", default=str(ROOT / "data" / "raw" / "simulated_pilot_raw.csv"))
    ap.add_argument("--excluded", default=str(ROOT / "data" / "raw" / "excluded_ids.txt"))
    args = ap.parse_args(argv)

    raw_path = Path(args.raw)
    raw = pd.read_csv(raw_path)
    sources = sorted(raw["source"].dropna().unique())
    data_source = "simulated" if sources == ["simulated"] else "live" if sources == ["live"] else "+".join(sources)

    df, log = clean(raw, read_excluded(args.excluded))
    if df.empty:
        sys.exit("No participants survived cleaning. Check the raw file and the log.")
    clean_dir = ROOT / "data" / "clean"
    clean_dir.mkdir(parents=True, exist_ok=True)
    df.to_csv(clean_dir / "analysis_ready.csv", index=False)
    participant_table(df).to_csv(clean_dir / "participants.csv", index=False)
    rel = raw_path.resolve().relative_to(ROOT) if raw_path.resolve().is_relative_to(ROOT) else raw_path
    write_log(log, data_source, rel)
    print(f"Clean data: {df['participant_id'].nunique()} participants, {len(df)} rows ({data_source}).")


if __name__ == "__main__":
    main()
