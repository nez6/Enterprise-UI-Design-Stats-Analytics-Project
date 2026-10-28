"""Generate the SIMULATED pilot dataset in the teaching site's export format.

Writes data/raw/simulated_pilot_raw.csv (one row per ticket) and
data/raw/simulated_pilot_feedback.csv (one row per participant), so the cleaning
-> analysis -> report pipeline can be built and checked before real sessions.
It uses lab/simulate.py, sized to the recruitment target from the power analysis,
and deliberately adds the mess real sessions produce:

* 2 participants who stopped after three tickets (no feedback either)
* 1 participant who walked away from the documentation hunt for ~45 minutes
* 4 participants who skipped the optional demographics
* 3 double-submitted ticket rows and 1 double-submitted feedback row
* 1 researcher dry run (listed in data/raw/excluded_ids.txt)

Usage:  python scripts/generate_simulated_data.py [--n 70] [--seed 2026]
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
OUT_FB = ROOT / "data" / "raw" / "simulated_pilot_feedback.csv"
POWER_JSON = ROOT / "results" / "power_analysis.json"


def default_n():
    """Recruit the number the power analysis asks for (fallback 70)."""
    if POWER_JSON.exists():
        return int(json.loads(POWER_JSON.read_text())["h1_h2"]["recruit_total"])
    return 70


def build(n, seed):
    sub, fb = simulate_panel(n=n, seed=seed, id_prefix="SIM", source="simulated", session="simulated-pilot")
    rng = np.random.default_rng(seed)
    picks = rng.choice(sub["participant_id"].unique(), size=7, replace=False)
    dropouts, walkaway, no_demo = picks[:2], picks[2], picks[3:7]

    sub = sub[~(sub["participant_id"].isin(dropouts) & (sub["position"] > 3))].copy()
    fb = fb[~fb["participant_id"].isin(dropouts)].copy()
    sub.loc[(sub["participant_id"] == walkaway) & (sub["test_num"] == 3), "completion_time"] = 2712.4
    sub.loc[sub["participant_id"].isin(no_demo), ["years_experience", "job_level", "job_role"]] = np.nan
    fb.loc[fb["participant_id"].isin(no_demo), "job_level"] = np.nan

    dry_sub, dry_fb = simulate_panel(n=1, seed=seed + 1, id_prefix="SIM-DRYRUN", source="simulated", session="simulated-pilot")
    sub = pd.concat([sub, sub.sample(3, random_state=seed), dry_sub], ignore_index=True)
    fb = pd.concat([fb, fb.sample(1, random_state=seed), dry_fb], ignore_index=True)
    return sub.sort_values(["participant_id", "position"], kind="stable").reset_index(drop=True), fb


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--n", type=int, default=None, help="participants to simulate (default: power-analysis target)")
    ap.add_argument("--seed", type=int, default=2026)
    args = ap.parse_args(argv)
    sub, fb = build(args.n or default_n(), args.seed)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sub.to_csv(OUT, index=False)
    fb.to_csv(OUT_FB, index=False)
    print(f"Wrote {len(sub)} ticket rows and {len(fb)} feedback rows ({sub['participant_id'].nunique()} ids) to data/raw/")


if __name__ == "__main__":
    main()
