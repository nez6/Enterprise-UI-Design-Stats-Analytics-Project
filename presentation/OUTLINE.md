# Presentation plan

Two ways to present. The course talk is 8 minutes; the AI Pathfinders session can run longer and is live.

## A. AI Pathfinders live session (~45–60 min)

The website *is* the presentation. Share `https://<user>.github.io/Enterprise-UI-Design-Stats-Analytics-Project/?session=<label>`.

| Time | Page | What happens |
|---|---|---|
| 0–10 min | 1 · Service Portal | Everyone files their six tickets. Watch the live counter climb. |
| 10–18 | 2 · The Shape of Noise | Switch the data source to **Live + benchmark**. Their dots drop in; drag the see-saw; run the CLT machine. |
| 18–26 | 3 · Bayes & the Agent | Bayes as area, the cry-wolf alarm, type a ticket into the agent's brain, replay trust. |
| 26–38 | 4 · Did It Work? | **The reveal:** explain the banners, shuffle 1,000×, show the crossing lines and the warned users' overrides. |
| 38–46 | 5 · Regression → ML | Snap the line, move the threshold, overfit on purpose, flip Simpson's paradox. |
| 46–55 | 6 · LLMs & the Playbook | Temperature slider, Nova 2.0 hallucinating, calibration, the perception–performance map, the playbook. |

Tips: use **→ / Space** to step through scenes, and keep the debrief until after page 4 so people don't learn about the banners too early.

## B. Course presentation (8 minutes max)

Numbers are from `report/REPORT.md` (real Oct 28 session). Regenerate the report before quoting them if the data changes.

| # | Slide | Time | Message | Visual |
|---|---|---|---|---|
| 1 | Title + hook | 0:30 | Does one sentence change how efficient a tool feels? | Portal screenshot |
| 2 | Motivation | 0:50 | Tools are judged on ratings collected amid praise for incumbents and warnings about AI | Banner text, side by side |
| 3 | Question & hypotheses | 0:50 | H1 praise raises ServiceNow ratings; H2 AI team rates AI lower; H3 AI faster; H4 more overrides | H0 / H1 table |
| 4 | The experiment | 1:10 | Six tickets, two coin flips, platform within people; the AI team differs in three ways at once | 2 × 2 diagram |
| 5 | Power & sample | 0:40 | Planned 60 analysable (recruit 68); got 30 of 46 starters, so this is a pilot | `fig5_power_curve.png` |
| 6 | Banners (H1, H2) | 1:20 | H1 +0.53 points, Holm p = 0.739. H2 ran the opposite way, +1.44, Holm p = 0.986, and the planted error is a likely reason. Neither supported | `fig1_h1_h2_ratings.png` |
| 7 | Tools (H3, ratings) | 1:00 | AI 1.7× faster (95% CI 1.3–2.2×); efficiency +2.56; abandoned 32 of 90 vs 2 of 90; 72% prefer AI. H4: AI team overrode more (p = 0.025), a lead only | `fig3_h3_paired_times.png` |
| 8 | What could mislead us | 0:50 | Scenarios tied to platform; 43% vs 19% excluded by first set (p = 0.117); few people noticed the banners; abandoned tickets cut the clock | Dropout table |
| 9 | Takeaways | 0:50 | Measure behaviour next to ratings; test messaging rather than assume it; rerun with the separated design (`docs/IRB_REVIEW.md`, section 6) | Three bullets |

Online cohort: record under 8:00, upload as unlisted, and test the link in a private window.
