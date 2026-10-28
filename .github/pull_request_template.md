## What this PR does

<!-- One or two sentences. Link the report section or hypothesis it affects. -->

## Why

<!-- The problem or requirement behind it. -->

## How to verify

```bash
pytest
python scripts/run_pipeline.py   # add --raw data/raw/live_sessions.csv once real data exists
```

<!-- Paste the pipeline's summary line (H1 / H2 / H3) and note anything that changed. -->

## Checklist

- [ ] Branch is up to date with `main`
- [ ] `pytest` passes
- [ ] Pipeline runs end to end, and regenerated `results/` and `report/REPORT.md` are committed
- [ ] Statistical changes match the analysis plan (or the plan is updated and the deviation explained in the report)
- [ ] Prose edits were made in `report/report_template.md`, not `REPORT.md`
- [ ] No personal data added to `data/`
- [ ] Partner requested as reviewer
