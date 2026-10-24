# Presentation: 8 minutes max (in class Nov 3)

Nine slides, about 50 seconds each, split between the two presenters. Figures come straight from `results/figures/`, so rerun the pipeline on real data and the slides update with it. Numbers in **[brackets]** are from the simulated pilot. Replace them with the real-data values from `report/REPORT.md` before presenting.

| # | Slide | Time | Speaker | Visual |
|---|---|---|---|---|
| 1 | Title + hook | 0:30 | A | Title, both names |
| 2 | Motivation | 0:50 | A | Two short contrasts: what tools promise vs. what users live through |
| 3 | Research question & hypotheses | 0:50 | A | H1 big; H2, H3 small; H4–H5 marked exploratory |
| 4 | The experiment | 1:10 | B | 6-test table + screenshot of the Test 6 banner; "randomised, permuted blocks" |
| 5 | Power & sample | 0:40 | B | `fig5_power_curve.png`; "24 per group, recruit 54" |
| 6 | Manipulation check (H2) | 0:50 | B | `fig3_h2_paired_times.png` |
| 7 | Primary result (H1) + H3 | 1:20 | A | `fig1_h1_t6_efficiency.png`; one line for H3 |
| 8 | Exploratory: seniority & rage-quits | 0:50 | B | `fig4_h4_interaction.png` (caveat the n's) |
| 9 | Takeaways & limitations | 0:50 | A+B | Three takeaways, three limitations |

**Total ≈ 8:00.** Rehearse with a timer. If you run long, cut slide 8 to one sentence.

## Speaker script

**1. Title (A).** "It's 4:45 on a Friday and you have six tickets to log before you can leave. We built that experience and asked one question: if someone tells you the system is efficient right before it fails you, do you rate it as more efficient?"

**2. Motivation (A).** Companies buy and keep ITSM and AI tools largely on satisfaction surveys, and those surveys are collected in a sea of vendor messaging. Priming research says brief statements can shift judgments, but many priming effects haven't replicated. So it's worth testing directly, in a setting that matters to anyone who has filed a ticket.

**3. Hypotheses (A).** Primary H1: primed participants rate the broken Test 6 as more efficient (one-sided). Secondary: H2, chaos tasks are slower (manipulation check); H3, priming lowers frustration. H4 and H5 are exploratory. We fixed the directions and the tests before collecting data.

**4. Experiment (B).** Walk through the six tasks: four clean, then a hallucinating AI bot and a documentation hunt with the submit button hidden in a KB article. Arm (banner vs no banner) is randomised in permuted blocks of four. Same tasks, same order for everyone. Outcomes: 1–10 efficiency and frustration ratings after every test, plus time, errors and rage-quits.

**5. Power (B).** Planned for a large effect, d = 0.8, at one-sided α = .05 and 80% power: 20 per group for a t-test, 24 for Mann–Whitney, and 54 recruited to allow for dropouts. Be upfront: we can only reliably detect a large effect. Our own simulation suggests the true effect could be closer to d ≈ 0.6, which would need about 45 per group.

**6. H2 (B).** Each line is one person. Everyone was slower in chaos: **[3.6×]** longer (95% CI **[3.2–4.1]**), Wilcoxon p < .001. The manipulation worked, so there was a real gap between the claim and the experience.

**7. H1 + H3 (A).** Show the dot plot. Report Mann–Whitney p, rank-biserial r and its CI: **[p = .67, r = −0.07, CI −0.37 to 0.24]**. If the result is null, say clearly that this is absence of evidence, and point to the floor: **[59%]** of ratings were 1 or 2. Then H3: **[primed participants reported lower frustration, Holm p < .001]**. The banner may change how people *feel* more than what they *judge*.

**8. Exploratory (B).** The interaction plot suggests seniors might be more susceptible, but point at the n's: three or five people per cell. It's a hypothesis, not a finding. Rage-quits happen almost only in the chaos tests.

**9. Takeaways & limitations (A+B).**
Takeaways:
1. Behavioural metrics (time, errors, abandonment) were large and unambiguous. Ratings were compressed and noisy.
2. Keep marketing out of evaluation surveys, and randomise any messaging you want to test.
3. Plan studies around realistic effect sizes.

Limitations: powered only for large effects; floor effect on the rating scale; fixed task order; convenience sample in a simulation.

## Recording (online cohort)

Record a screen share of the slides with both presenters on camera (Zoom or Loom), keep it under 8:00, upload it as **unlisted** (YouTube or Drive with "anyone with the link can view"), and **test the link in a private browser window** before submitting.
