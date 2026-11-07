"""Download the teaching site's live data from Supabase into data/raw/.

Writes data/raw/live_sessions.csv (tickets), data/raw/live_feedback.csv (final surveys) and
data/raw/live_withdrawals.csv (participants who withdrew; the cleaning script drops them).

The raw tables are not readable with the website's public key (see supabase/schema.sql), so
this script needs the project's SECRET service_role key. Keep it out of the repository and
out of the website: set it only in your own terminal.

Usage:
    export SUPABASE_URL=https://<project>.supabase.co
    export SUPABASE_SERVICE_KEY=<service_role key>   # Project Settings -> API -> service_role (secret)
    python scripts/export_supabase.py --session pathfinders-oct28

De-identified copies only, with no secret key: --public reads the same views the website reads
(no free text, no timestamps, withdrawn people already removed), using the site's public settings.
This is enough to reproduce the analysis, which never uses free text:
    python scripts/export_supabase.py --public --session pathfinders-oct28
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


def fetch(base, key, table, session, page=1000, order=True):
    rows, offset = [], 0
    while True:
        query = {"select": "*", "limit": page, "offset": offset}
        if order:  # the public views have no id column
            query["order"] = "id"
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


def public_settings():
    """The site's public connection settings: site/.env.production (never the secret key)."""
    env = dict(line.split("=", 1) for line in (ROOT / "site" / ".env.production").read_text().splitlines()
               if line.strip() and not line.startswith("#"))
    return env["VITE_SUPABASE_URL"].rstrip("/"), env["VITE_SUPABASE_ANON_KEY"]


def export_public(session, out):
    base, key = public_settings()
    sub = pd.DataFrame(fetch(base, key, "submissions_public", session, order=False)).reindex(columns=COLUMNS)
    fb = pd.DataFrame(fetch(base, key, "feedback_public", session, order=False)).reindex(columns=FEEDBACK_COLUMNS)
    sub.to_csv(out / "live_sessions_deidentified.csv", index=False)
    fb.to_csv(out / "live_feedback_deidentified.csv", index=False)
    print(f"Saved {len(sub)} tickets ({sub['participant_id'].nunique()} participants) and {len(fb)} surveys to data/raw/*_deidentified.csv.")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--session", default=None, help="only this session label (default: all sessions)")
    ap.add_argument("--public", action="store_true", help="de-identified copies only, via the public views; needs no secret key")
    args = ap.parse_args()
    out = ROOT / "data" / "raw"
    out.mkdir(parents=True, exist_ok=True)
    if args.public:
        return export_public(args.session, out)
    base, key = os.environ.get("SUPABASE_URL", "").rstrip("/"), os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not base or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_KEY first (Supabase → Project Settings → API → service_role).")
    sub = pd.DataFrame(fetch(base, key, "submissions", args.session)).reindex(columns=COLUMNS)
    fb = pd.DataFrame(fetch(base, key, "feedback", args.session)).reindex(columns=FEEDBACK_COLUMNS)
    sub.to_csv(out / "live_sessions.csv", index=False)
    fb.to_csv(out / "live_feedback.csv", index=False)
    wd = pd.DataFrame(fetch(base, key, "withdrawals", args.session)).reindex(columns=["participant_id", "session_label"])
    wd.to_csv(out / "live_withdrawals.csv", index=False)
    # Public copies for the repository: no free text (ticket_text, comment) and no withdrawn people.
    gone = set(wd["participant_id"].dropna())
    sub[~sub.participant_id.isin(gone)].assign(ticket_text=None).to_csv(out / "live_sessions_deidentified.csv", index=False)
    fb[~fb.participant_id.isin(gone)].assign(comment=None).to_csv(out / "live_feedback_deidentified.csv", index=False)
    print(f"Saved {len(sub)} tickets ({sub['participant_id'].nunique()} participants), {len(fb)} surveys "
          f"and {len(wd)} withdrawals to data/raw/.")


if __name__ == "__main__":
    main()
