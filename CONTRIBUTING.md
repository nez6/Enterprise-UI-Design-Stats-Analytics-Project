# Workflow

This is a solo project, but it still follows the branch-and-pull-request workflow the course asks for, so the history shows how the work was reviewed.

1. **Never commit directly to `main`.** Make a branch (`feature/…`, `data/…`, `analysis/…`, `report/…`, `fix/…`), push it, and open a pull request.
2. **Self-review every PR** using the checklist in `.github/pull_request_template.md`. Read the diff on GitHub, leave comments on anything you'd question, and only then **Squash and merge**.
3. **Keep `main` reproducible.** Before merging, run:
   ```bash
   pytest && (cd site && npm test)
   python scripts/run_pipeline.py      # or --raw data/raw/live_sessions.csv
   ```
   Commit the regenerated `results/` and `report/REPORT.md` in the same PR.
4. **Edit `report/report_template.md`, never `report/REPORT.md`.** The pipeline overwrites the latter.
5. **Merging to `main` deploys the website** if `site/` changed, so check `npm run build` first.

## Suggested PRs

| PR | Branch |
|---|---|
| Teaching site, two-banner design, aligned pipeline | `feature/snow-teaching-site` |
| Live session data and regenerated results | `data/live-session` |
| Report prose rewritten for the real results | `report/final-results` |
| Slides polish | `report/presentation` |
