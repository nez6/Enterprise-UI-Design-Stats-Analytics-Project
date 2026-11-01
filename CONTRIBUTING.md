# Collaboration workflow

The course requires branches and pull requests, with **at least one PR from each team member** and real reviews. This is how we work.

## Rules

1. **Never commit directly to `main`.** Every change goes through a branch and a PR.
2. **One purpose per branch:** `feature/<thing>`, `data/<thing>`, `analysis/<thing>`, `report/<thing>`, `fix/<thing>`.
3. **The other partner reviews and approves** before merging. Authors don't merge their own PRs without a review.
4. **Keep `main` reproducible.** Before opening a PR, run:
   ```bash
   pytest
   python scripts/run_pipeline.py      # or --raw data/raw/live_sessions.csv
   ```
   Commit the regenerated `results/` and `report/REPORT.md` in the same PR as the change that caused them.
5. **Edit `report/report_template.md`, never `report/REPORT.md`.** The latter is overwritten by the pipeline.

## Typical flow

```bash
git checkout main && git pull
git checkout -b analysis/my-change
# ...edit, run tests and the pipeline...
git add -A && git commit -m "Short imperative summary"
git push -u origin analysis/my-change
# open a PR on GitHub, fill in the template, request your partner's review
```

## What a good review looks like

- Pull the branch and **run the pipeline yourself**. Do the numbers in the PR description match?
- For statistical changes, check the assumptions, the test choice, the one- vs two-sided direction and the effect sizes against the plan in the report (section 3).
- Leave specific comments on lines, not just "LGTM". Approve only when the checklist in the PR template is complete.
- Resolve conversations before merging. Use **Squash and merge** so `main` gets one clean commit per PR.

## Suggested split so both partners have substantive PRs

| PR | Owner | Branch idea |
|---|---|---|
| Study app, pipeline, simulated pilot, report template | Partner A | `feature/stats-project-pipeline` (this one) |
| Run real sessions, add `data/raw/live_sessions.csv`, update `excluded_ids.txt`, regenerate results | Partner B | `data/live-sessions` |
| Rewrite report prose for the real results (background, interpretation, limitations) | Partner B | `report/final-results` |
| Presentation slides and figures polish | Either | `report/presentation` |
