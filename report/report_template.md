# Selling the Single Pane of Glass: Does a One-Line Efficiency Claim Change How People Rate a Broken Ticketing Workflow?

**Authors:** [Your name] & [Partner name] · Module Project 2: Statistical Analysis · {{report_date}}

{{data_banner}}

---

## 1. Abstract

Enterprise software is often judged by how efficient its users *say* it is, and those judgments are made in an environment full of vendor messaging. We built a six-task IT-ticketing simulator and ran a randomised between-subjects experiment. Before two deliberately frustrating tasks (a malfunctioning AI assistant and a "documentation hunt" with a hidden submit button), half of participants saw a one-sentence efficiency claim: *"ServiceNow's single pane of glass is incredibly efficient."* The other half saw no banner. Our primary hypothesis (H1) was that the claim would raise perceived-efficiency ratings on the documentation-hunt task. With {{n_participants}} analysable participants ({{n_primed}} primed, {{n_control}} control), {{abstract_h1}} As secondary results, chaos tasks took {{h2_ratio}}× longer than baseline tasks within the same people (95% CI {{h2_ratio_ci}}; Holm-adjusted {{h2_p_holm_eq}}), and {{abstract_h3}} We discuss a floor effect in the efficiency scale, the limited power for anything smaller than a large effect, and what these findings imply for how organisations evaluate workflow and AI tools.

## 2. Background & Motivation

IT service management (ITSM) platforms and, increasingly, AI assistants sit between employees and almost every operational request they make: password resets, licences, hardware, access. Buying decisions and post-rollout reviews for these tools lean heavily on **self-reported satisfaction and perceived efficiency**, collected in organisations where the same tools are actively promoted by vendors and internal champions.

Two strands of behavioural research suggest this may be a problem:

- **Priming and anchoring.** Brief exposure to a statement or number can shift later judgments, even when the judgment should depend on the person's own experience (Tversky & Kahneman, 1974). Some well-known social-priming effects have failed to replicate (Doyen et al., 2012), so the size, and even the existence, of such effects in applied settings is an empirical question worth testing directly.
- **Perceived vs. measured usability.** Usability research separates behavioural measures (time on task, errors, abandonment) from attitudinal ones (ratings such as the SUS; Brooke, 1996). They can diverge, and when they do, it matters which one decision-makers look at.

Our question sits where these meet: **if users are told a system is efficient right before they struggle with it, do they rate it as more efficient than people who struggled the same amount without the message?** If they do, satisfaction surveys collected after marketing exposure would overstate how well a tool works, and senior stakeholders, who are often the most exposed to that messaging, may be the most affected.

## 3. Research Questions & Hypotheses

**Primary research question.** Does a one-sentence efficiency claim increase perceived-efficiency ratings of a frustrating ticketing task?

| | Null hypothesis (H₀) | Alternative hypothesis (H₁) | Role |
|---|---|---|---|
| **H1** | Test 6 perceived-efficiency ratings have the same distribution in the primed and control arms. | Primed participants' Test 6 ratings are stochastically **greater** (one-sided). | Primary, confirmatory |
| **H2** | Within participants, completion time on chaos tasks (5–6) is not longer than on baseline tasks (1–4). | Chaos-task completion time is **longer** (one-sided). | Secondary (manipulation check) |
| **H3** | Mean frustration on the chaos tasks has the same distribution in both arms. | Primed participants report **lower** frustration (one-sided). | Secondary |
| **H4** | The priming effect on Test 6 efficiency does not depend on job level (no arm × level interaction). | The priming effect differs by job level. | Exploratory |
| **H5** | Years of experience, arm and task do not predict abandoning a chaos task. | At least one of them does. | Exploratory |

The directions for H1–H3 were fixed before data collection, which justifies the one-sided tests. H2 and H3 form a secondary family and are Holm-corrected (Holm, 1979). H4 and H5 are exploratory and are reported without confirmatory claims.

## 4. Experimental Design

**Instrument.** A Streamlit web app (`app.py`) simulates a Friday 4:45 PM scenario: the participant is a project lead who must log six urgent IT tickets before the end of the day.

| Test | Task | Workflow | Condition |
|---|---|---|---|
| 1 | Password reset | Legacy ticketing | Baseline (clean form) |
| 2 | Software licence request | Legacy ticketing | Baseline |
| 3 | VPN access | AI assistant | Baseline (assistant pre-fills the category) |
| 4 | Laptop replacement | AI assistant | Baseline |
| 5 | Production outage | AI assistant | **Chaos**: vague replies, hallucinated categories, random fake errors |
| 6 | Conference-room AV | Legacy ticketing | **Chaos**: no submit button; a checkout code is buried in dense KB documentation |

**Independent variables.**
- *Priming arm* (between subjects; primed vs control). Primed participants see a banner before Test 5 ("our AI Assistant resolves 94% of tickets on first contact") and before Test 6 ("ServiceNow's single pane of glass is incredibly efficient"). Control participants see no banner.
- *Workflow condition* (within subjects): baseline (Tests 1–4) vs chaos (Tests 5–6).
- *Job level* (measured, not manipulated; optional): IC/Associate, Lead/Manager, Director/Executive.

**Dependent variables.**
- Perceived efficiency (1–10 slider, after each test). This is the **primary outcome** on Test 6.
- Frustration (1–10 slider, after each test).
- Completion time in seconds, logged automatically from when the test page opens to submission or abandonment.
- Error count: validation failures, wrong cart codes and fake bot errors.
- Rage-quit: a prominent "Abandon Ticket / I Give Up" button on every test.

**Control condition.** The control arm completes identical tasks with no banner. All other content, ordering and timing logic is the same.

**Randomisation.** Arms are allocated by **permuted blocks of four** (two primed, two control, in random order). This keeps the arms balanced at every multiple of four participants, which matters at class-sized samples. Allocation is automatic, so the facilitator cannot influence it. Participants are not told about the manipulation until the debrief at the end.

**Fixed task order.** All participants complete the tests in the same order (1→6). This keeps the experience identical across arms, so arm is the only thing that differs. The cost is that order and fatigue effects are confounded with the baseline/chaos contrast in H2 (see Limitations).

**Ethics.** Participants give consent on the start screen. No names or contact details are collected, demographics are optional, and everyone is debriefed about the priming manipulation at the end.

## 5. Power Analysis

Power analysis was done before data collection with `statsmodels.stats.power` (`scripts/power_analysis.py`).

**Assumptions for H1 (primary).**
- Smallest effect of interest: **d = {{p_d}}** (a "large" effect; Cohen, 1988). We chose this because a class-run study can realistically recruit about 50–60 people. Effects smaller than this would need far more participants (see the sensitivity table below).
- α = {{p_alpha}}, **one-sided** (direction pre-specified); target power = {{p_power}}.
- A two-sample t-test needs **{{p_n_t}} per group**. Because the planned test is Mann–Whitney U, whose asymptotic relative efficiency versus the t-test is never below 0.864 (Hodges & Lehmann, 1956), we divided by 0.864: **{{p_n_mwu}} per group ({{p_analysable}} analysable participants)**.
- Allowing for **{{p_attrition}} attrition** (dropouts, walk-aways, technical failures), and rounding up to an even number for block randomisation, the **recruitment target is {{p_recruit}} participants**.

**H2 (secondary, paired).** For a within-subject effect of d_z = {{p_dz}}, one-sided α = 0.05 and power 0.80, we need only {{p_h2_pairs}} pairs. H2 is therefore well powered at any realistic sample size.

**Sensitivity.** The smallest effect detectable with 80% power (one-sided α = 0.05, t-test approximation) at different group sizes:

{{sensitivity_table}}

**Simulation check.** We also estimated power by Monte Carlo: {{p_mc_sims}} simulated studies of {{p_analysable}} participants each, run under our simulation model (`lab/simulate.py`) with the exact planned test. The simulated power was **{{p_mc_power}}**. The reason is that the simulation model implies a true effect of only d ≈ {{p_d_sim}} on Test 6, much of it hidden by participants who already rate the task at the bottom of the scale. Detecting an effect that size would need about {{p_n_sim}} per group. We report this openly rather than retuning the simulation: it shows how sensitive the conclusions are to the d = {{p_d}} assumption.

{{fig_power}}

## 6. Data Collection & Cleaning

**Collection.** Participants complete the study in the app, either on the facilitator's laptop or through a shared link. Each completed test is appended as one row to `data/raw/live_sessions.csv`, with participant id, timestamp, demographics, arm, test, time, errors, rage-quit and the two ratings. Researcher dry runs are listed in `data/raw/excluded_ids.txt`.

**Cleaning rules** (`scripts/clean_data.py`). These were fixed before outcomes were examined:

1. Remove ids listed as dry runs or withdrawals.
2. Remove double-submitted rows (same participant and test), keeping the first.
3. Remove rows with impossible values (ratings outside 1–10, non-positive times, invalid flags).
4. Blank out-of-range demographics instead of dropping the participant (demographics are optional).
5. Re-derive the design columns (workflow, chaos and priming exposure) from the design definition, and drop any participant whose arm changes between rows.
6. Exclude participants with any single test longer than **30 minutes** (they walked away, so the time doesn't measure the task).
7. Keep only participants who completed **all six tests**.

We did **not** trim long chaos-task times below the 30-minute threshold. The long right tail is part of the phenomenon, not noise.

**Participant flow.**

{{cleaning_table}}

Of the {{n_participants}} analysable participants, {{n_with_demo}} answered the optional job-level question.

**Randomisation check.** Median years of experience: primed {{rand_years_p}}, control {{rand_years_c}} (Mann–Whitney {{rand_years_p_eq}}). Job-level distribution by arm: χ² {{rand_chi_p_eq}}. {{rand_verdict}}

## 7. Statistical Analysis

**Unit of analysis.** For H1 and H3 the unit is the **participant**, one value per person, so the independence assumption of two-sample tests holds. For H2 each participant contributes a **pair**: the geometric-mean time over baseline tests and over chaos tests.

**Software.** Python 3 with pandas, SciPy (Virtanen et al., 2020) and statsmodels (Seabold & Perktold, 2010). `scripts/analyze.py` produces every number in this section.

### 7.1 Descriptive statistics (completion time by test)

{{desc_table}}

{{desc_note}}

{{fig_times}}

### 7.2 H1 (primary): priming and perceived efficiency on Test 6

*Test choice.* Efficiency is a 1–10 rating, which is ordinal and bounded, so the pre-specified test is a **one-sided Mann–Whitney U** (Mann & Whitney, 1947). It doesn't require normality. Assumption checks support this choice: Shapiro–Wilk (Shapiro & Wilk, 1965) gives p = {{h1_sh_a}} (primed) and p = {{h1_sh_b}} (control), and Levene's test (Levene, 1960) gives p = {{h1_lev}}. We report a Welch t-test (Welch, 1947) as a sensitivity analysis.

| | Primed | Control |
|---|---|---|
| n | {{h1_n_a}} | {{h1_n_b}} |
| Mean (SD) | {{h1_mean_a}} ({{h1_sd_a}}) | {{h1_mean_b}} ({{h1_sd_b}}) |
| Median | {{h1_med_a}} | {{h1_med_b}} |

- **Mann–Whitney U = {{h1_U}}, one-sided {{h1_p_eq}}.**
- Effect size: rank-biserial r = **{{h1_r}}** (95% bootstrap CI {{h1_r_ci}}); Cohen's d = {{h1_d}} (95% CI {{h1_d_ci}}).
- Mean difference (primed − control) = {{h1_md}} points (Welch 95% CI {{h1_md_ci}}); median difference = {{h1_medd}} (bootstrap 95% CI {{h1_medd_ci}}).
- Sensitivity: Welch t({{h1_welch_df}}) = {{h1_welch_t}}, one-sided {{h1_welch_p_eq}}.

**Decision: {{h1_decision}}**

{{fig_h1}}

### 7.3 H2 (secondary): chaos vs baseline completion time (paired)

*Test choice.* Each participant has both conditions, so we use a paired test on the per-person difference in log time. Log times turn a multiplicative slowdown into an additive difference. Shapiro–Wilk on those differences gives p = {{h2_sh}}. We pre-specified the **one-sided Wilcoxon signed-rank test** (Wilcoxon, 1945) for robustness, and report the paired-t interval on the log scale, converted back to a ratio, as the estimate.

- Median participant: {{h2_base}} s per baseline test vs {{h2_chaos}} s per chaos test; {{h2_share}} of participants were slower on chaos tests.
- **Wilcoxon W = {{h2_W}}, one-sided {{h2_p_eq}}; Holm-adjusted {{h2_p_holm_eq}}.**
- Effect size: chaos tests took **{{h2_ratio}}× as long** (geometric-mean ratio; 95% CI {{h2_ratio_ci}}); d_z = {{h2_dz}}; matched-pairs rank-biserial r = {{h2_rmp}}.

**Decision: {{h2_decision}}**

{{fig_h2}}

### 7.4 H3 (secondary): priming and frustration on the chaos tests

Same approach as H1, applied to each participant's mean frustration across Tests 5–6. One-sided (primed < control); Shapiro p = {{h3_sh_a}} / {{h3_sh_b}}; Levene p = {{h3_lev}}.

| | Primed | Control |
|---|---|---|
| Mean (SD) | {{h3_mean_a}} ({{h3_sd_a}}) | {{h3_mean_b}} ({{h3_sd_b}}) |
| Median | {{h3_med_a}} | {{h3_med_b}} |

- **Mann–Whitney U = {{h3_U}}, one-sided {{h3_p_eq}}; Holm-adjusted {{h3_p_holm_eq}}.**
- Rank-biserial r = **{{h3_r}}** (95% CI {{h3_r_ci}}); Cohen's d = {{h3_d}} (95% CI {{h3_d_ci}}); mean difference = {{h3_md}} (95% CI {{h3_md_ci}}).

**Decision: {{h3_decision}}**

### 7.5 H4 (exploratory): does job level change the priming effect? Two-way ANOVA + post hoc

Model: `{{h4_formula}}`, Type II sums of squares, on the {{h4_n}} participants who reported a job level.

| Term | F | df | p | partial η² |
|---|---|---|---|---|
| Arm | {{h4_arm_F}} | {{h4_arm_df}} | {{h4_arm_p}} | {{h4_arm_eta}} |
| Job level | {{h4_lvl_F}} | {{h4_lvl_df}} | {{h4_lvl_p}} | {{h4_lvl_eta}} |
| Arm × job level | {{h4_int_F}} | {{h4_int_df}} | {{h4_int_p}} | {{h4_int_eta}} |

Assumptions: Shapiro–Wilk on residuals p = {{h4_res_sh}}; Levene across cells p = {{h4_lev}}. **Cell sizes are small** ({{h4_cells}}), so this analysis can only generate hypotheses.

Priming lift (primed − control mean efficiency) by level: {{h4_lift}}.

*Post hoc.* Tukey's HSD (Tukey, 1949) across all six level × arm cells found {{h4_tukey_sig}} of {{h4_tukey_n}} pairwise differences significant at a family-wise α of 0.05 (`results/tables/h4_tukey_hsd.csv`).

As a robustness check on the two-way design across *both* chaos tests, we fitted a linear mixed model `{{h4b_formula}}`. The workflow × arm interaction coefficient was {{h4b_coef}} ({{h4b_p_eq}}). {{h4b_note}}

{{fig_h4}}

### 7.6 H5 (exploratory): who rage-quits?

{{h5_text}}

{{fig_rq}}

## 8. Interpretation of Results

{{interpretation}}

## 9. Limitations

- **Simulated vs. real data.** {{limitation_data}}
- **Power.** The study is powered for a *large* priming effect (d = {{p_d}}). The sensitivity analysis shows we would likely miss a medium effect, and our own simulation model implies one of about d ≈ {{p_d_sim}}. A non-significant H1 is therefore weak evidence of *no* effect; the confidence interval is the honest summary.
- **Floor effect.** {{h1_floor}} of all Test 6 efficiency ratings were 1 or 2 out of 10. When almost everyone rates the task near the floor, a banner has little room to move the rating. A future version should use a multi-item scale (e.g. SUS) or a less brutal Test 6.
- **Fixed task order.** Chaos tests always come last, so fatigue and time pressure are confounded with the chaos manipulation in H2. Counterbalancing was ruled out to keep the arms identical. The priming comparison (H1/H3) is unaffected because both arms share the same order.
- **Sample and setting.** Participants are a convenience sample (classmates and their networks) using a simulation, not employees using their real ITSM tool under real deadlines. Job-level cells, especially directors, are small.
- **Single-item outcomes and demand effects.** Single-slider ratings are noisy. Participants who suspect the banner is a manipulation may react against it.
- **Multiple outcomes.** We guard against this with a single primary hypothesis, a Holm-corrected secondary family, and explicitly exploratory H4/H5.

## 10. Conclusion & Recommendations

{{conclusion}}

**Recommendations.**
1. **Measure behaviour alongside opinion.** Time on task, error counts and abandonment were large, consistent and unambiguous in this study. Ratings were noisy and bunched at the floor. Tool evaluations should report both.
2. **Keep marketing out of evaluation surveys.** Collect satisfaction ratings without banners, vendor claims or "as a reminder" framing, and randomise any messaging you want to study.
3. **Plan for realistic effect sizes.** A follow-up powered for d ≈ 0.5 needs roughly {{p_n_sim}} participants per group. That's feasible with a short online version of the simulator.
4. **Design AI assistants to fail gracefully.** A hallucinating assistant drove up time, errors and abandonment. Clear escalation paths and an obvious human fallback should be launch requirements.

## 11. References

Brooke, J. (1996). SUS: A "quick and dirty" usability scale. In P. W. Jordan, B. Thomas, B. A. Weerdmeester, & I. L. McClelland (Eds.), *Usability evaluation in industry* (pp. 189–194). Taylor & Francis.

Cohen, J. (1988). *Statistical power analysis for the behavioral sciences* (2nd ed.). Lawrence Erlbaum Associates.

Doyen, S., Klein, O., Pichon, C.-L., & Cleeremans, A. (2012). Behavioral priming: It's all in the mind, but whose mind? *PLoS ONE, 7*(1), e29081.

Hodges, J. L., & Lehmann, E. L. (1956). The efficiency of some nonparametric competitors of the t-test. *The Annals of Mathematical Statistics, 27*(2), 324–335.

Holm, S. (1979). A simple sequentially rejective multiple test procedure. *Scandinavian Journal of Statistics, 6*(2), 65–70.

Levene, H. (1960). Robust tests for equality of variances. In I. Olkin (Ed.), *Contributions to probability and statistics* (pp. 278–292). Stanford University Press.

Mann, H. B., & Whitney, D. R. (1947). On a test of whether one of two random variables is stochastically larger than the other. *The Annals of Mathematical Statistics, 18*(1), 50–60.

Seabold, S., & Perktold, J. (2010). statsmodels: Econometric and statistical modeling with Python. *Proceedings of the 9th Python in Science Conference*, 92–96.

Shapiro, S. S., & Wilk, M. B. (1965). An analysis of variance test for normality (complete samples). *Biometrika, 52*(3–4), 591–611.

Tukey, J. W. (1949). Comparing individual means in the analysis of variance. *Biometrics, 5*(2), 99–114.

Tversky, A., & Kahneman, D. (1974). Judgment under uncertainty: Heuristics and biases. *Science, 185*(4157), 1124–1131.

Virtanen, P., Gommers, R., Oliphant, T. E., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272.

Welch, B. L. (1947). The generalization of "Student's" problem when several different population variances are involved. *Biometrika, 34*(1–2), 28–35.

Wilcoxon, F. (1945). Individual comparisons by ranking methods. *Biometrics Bulletin, 1*(6), 80–83.

---

*Reproduce every number in this report with `python scripts/run_pipeline.py` (see README).*
