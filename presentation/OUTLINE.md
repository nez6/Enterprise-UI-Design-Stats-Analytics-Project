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

| # | Slide | Time | Visual |
|---|---|---|---|
| 1 | Title + hook | 0:30 | “One sentence changed how fast people thought the AI was.” |
| 2 | Motivation | 0:50 | Tools are judged on ratings collected amid praise for incumbents and warnings about AI |
| 3 | Question & hypotheses | 0:50 | H1 praise ↑ ServiceNow; H2 warning ↓ AI; H3 AI faster; H4 overrides |
| 4 | The experiment | 1:10 | Portal screenshot, 2 × 2 coin flips, six tickets |
| 5 | Power & sample | 0:40 | `fig5_power_curve.png`: 30 per group, recruit 68 |
| 6 | Performance (H3) | 0:40 | `fig3_h3_paired_times.png` |
| 7 | Perception (H1, H2) | 1:20 | `fig1_h1_h2_ratings.png` and `fig4_interaction.png` |
| 8 | The gap | 0:50 | `fig6_perception_performance.png`, plus overrides and trust |
| 9 | Takeaways & limitations | 1:10 | Measure behaviour; run rollouts as experiments; manage the narrative · simulation, sample, floor effects |

Fill every number from `report/REPORT.md` after the live export. Online cohort: record under 8:00, upload as unlisted, and test the link in a private window.
