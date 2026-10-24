"""Generate the SIMULATED pilot dataset: data/raw/simulated_pilot_raw.csv.

This stands in for real participants so the whole pipeline (cleaning -> analysis
-> report) can be built and checked before data collection. It uses the same
data-generating process as the app's benchmark (lab/simulate.py), sized to the
recruitment target from the power analysis. It deliberately includes the kinds of
mess real sessions produce, so the cleaning script has something to do:

* 2 participants who dropped out after Test 4
* 1 participant who walked away from Test 6 for ~45 minutes
* 4 participants who skipped the optional demographics
* 3 double-submitted rows
* 1 researcher dry run (listed in data/raw/excluded_ids.txt)

Usage:  python scripts/generate_simulated_data.py [--n 54] [--seed 2026]
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from lab.simulate import simulate_panel  # noqa: E402

OUT = ROOT / "data" / "raw" / "simulated_pilot_raw.csv"
POWER_JSON = ROOT / "results" / "power_analysis.json"
DRY_RUN_PREFIX = "SIM-DRYRUN"


def default_n():
    """Recruit the number the power analysis asks for (fallback 54)."""
    if POWER_JSON.exists():
        return int(json.loads(POWER_JSON.read_text())["h1"]["recruit_total"])
    return 54


def build(n, seed):
    df = simulate_panel(n=n, seed=seed, id_prefix="SIM", source="simulated")
    rng = np.random.default_rng(seed)
    picks = rng.choice(df["participant_id"].unique(), size=7, replace=False)
    dropouts, walkaway, no_demo = picks[:2], picks[2], picks[3:7]

    df = df[~(df["participant_id"].isin(dropouts) & (df["test_num"] > 4))].copy()
    df.loc[(df["participant_id"] == walkaway) & (df["test_num"] == 6), "completion_time"] = 2712.4
    df.loc[df["participant_id"].isin(no_demo), ["years_experience", "job_level", "job_role"]] = np.nan
    dupes = df.sample(3, random_state=seed)
    dry_run = simulate_panel(n=1, seed=seed + 1, id_prefix=DRY_RUN_PREFIX, source="simulated")

    out = pd.concat([df, dupes, dry_run], ignore_index=True)
    return out.sort_values(["participant_id", "test_num"], kind="stable").reset_index(drop=True)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--n", type=int, default=None, help="participants to simulate (default: power-analysis target)")
    ap.add_argument("--seed", type=int, default=2026)
    args = ap.parse_args(argv)
    n = args.n or default_n()
    raw = build(n, args.seed)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    raw.to_csv(OUT, index=False)
    print(f"Wrote {len(raw)} rows ({raw['participant_id'].nunique()} participant ids) to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
