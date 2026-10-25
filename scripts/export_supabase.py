"""Download the teaching site's live data from Supabase into data/raw/.

Writes data/raw/live_sessions.csv (tickets) and data/raw/live_feedback.csv (final surveys)
in the schema the cleaning script expects. Uses the same public anon key as the site,
which can read but never modify the data.

Usage:
    export SUPABASE_URL=https://<project>.supabase.co
    export SUPABASE_ANON_KEY=<anon key>
    python scripts/export_supabase.py --session pathfinders
"""

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from lab.design import COLUMNS, FEEDBACK_COLUMNS  # noqa: E402


def fetch(base, key, table, session, page=1000):
    rows, offset = [], 0
    while True:
        query = {"select": "*", "order": "id", "limit": page, "offset": offset}
        if session:
            query["session_label"] = f"eq.{session}"
        req = urllib.request.Request(f"{base}/rest/v1/{table}?{urllib.parse.urlencode(query)}",
                                     headers={"apikey": key, "Authorization": f"Bearer {key}"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            batch = json.loads(resp.read())
        rows += batch
        if len(batch) < page:
            return rows
        offset += page


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--session", default=None, help="only this session label (default: all sessions)")
    args = ap.parse_args()
    base, key = os.environ.get("SUPABASE_URL", "").rstrip("/"), os.environ.get("SUPABASE_ANON_KEY", "")
    if not base or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_ANON_KEY first (Supabase → Project Settings → API).")
    out = ROOT / "data" / "raw"
    out.mkdir(parents=True, exist_ok=True)
    sub = pd.DataFrame(fetch(base, key, "submissions", args.session)).reindex(columns=COLUMNS)
    fb = pd.DataFrame(fetch(base, key, "feedback", args.session)).reindex(columns=FEEDBACK_COLUMNS)
    sub.to_csv(out / "live_sessions.csv", index=False)
    fb.to_csv(out / "live_feedback.csv", index=False)
    print(f"Saved {len(sub)} tickets ({sub['participant_id'].nunique()} participants) and {len(fb)} surveys to data/raw/.")


if __name__ == "__main__":
    main()
