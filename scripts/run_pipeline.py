"""Run the whole analysis end to end: power -> (simulate) -> clean -> analyze -> report.

Simulated pilot (default):
    python scripts/run_pipeline.py
Real participants from the teaching site (after scripts/export_supabase.py):
    python scripts/run_pipeline.py --raw data/raw/live_sessions.csv
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import analyze  # noqa: E402
import build_report  # noqa: E402
import clean_data  # noqa: E402
import generate_simulated_data  # noqa: E402
import power_analysis  # noqa: E402

SIMULATED = ROOT / "data" / "raw" / "simulated_pilot_raw.csv"


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--raw", default=str(SIMULATED), help="raw telemetry CSV (default: simulated pilot)")
    ap.add_argument("--feedback", default=None, help="final-survey CSV (default: inferred from --raw)")
    ap.add_argument("--sims", type=int, default=300, help="Monte Carlo replications for the power check")
    args = ap.parse_args()

    print("1/5 Power analysis");  power_analysis.main(["--sims", str(args.sims)])
    if Path(args.raw).resolve() == SIMULATED.resolve():
        print("2/5 Simulated pilot"); generate_simulated_data.main([])
    else:
        print("2/5 Using real data:", args.raw)
    print("3/5 Cleaning");        clean_data.main(["--raw", args.raw] + (["--feedback", args.feedback] if args.feedback else []))
    print("4/5 Analysis");        analyze.main()
    print("5/5 Report");          build_report.main()


if __name__ == "__main__":
    main()
