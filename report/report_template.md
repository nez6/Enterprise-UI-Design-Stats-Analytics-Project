# Praise for the Incumbent, Warnings for the AI: How One Sentence Shifts Ratings of Enterprise Ticketing Tools

**Author:** Natalie Zachariah · Module Project 2: Statistical Analysis · {{report_date}}

{{data_banner}}

---

## 1. Abstract

Organisations decide whether to keep legacy tools or adopt AI largely from what users *report*, and those reports are collected amid strong messaging: vendors praise incumbent platforms, and public discussion warns that AI "hallucinates". We built a ServiceNow-style service portal in which every participant filed six realistic, noisy IT tickets, three through classic catalog forms and three with an AI agent embedded in the form, and rated each one. Two independent coin flips decided whether participants saw a **positive banner** before the ServiceNow set ("ServiceNow's single pane of glass is incredibly efficient") and a **negative banner** before the AI set ("AI agents are known to hallucinate…"). With {{n_participants}} analysable participants, {{abstract_h1}} {{abstract_h2}} Meanwhile, the AI agent was {{h3_speedup}}× faster per ticket (95% CI {{h3_speedup_ci}}). {{abstract_close}}

## 2. Background & Motivation

IT service management (ITSM) platforms such as ServiceNow, and the AI agents now being built into them, sit between employees and almost every operational request. Purchasing, renewal and rollout decisions lean heavily on **perceived efficiency and satisfaction**: survey ratings, NPS, and "would you use it again?". Those perceptions are formed in an environment saturated with framing. Incumbent vendors market efficiency ("single pane of glass"), while AI tools arrive wrapped in warnings about hallucination and error.

Behavioural research suggests framing can shift judgments that should depend on experience. Anchoring and framing effects are well documented (Tversky & Kahneman, 1974; 1981), although some priming effects have not replicated (Doyen et al., 2012), so their size in applied settings needs testing directly. Usability research also separates **behavioural** measures (time on task, errors, abandonment) from **attitudinal** ones (ratings such as the SUS; Brooke, 1996), and the two can diverge.

This study asks whether framing pushes perception **against** performance in both directions: up for a slow incumbent, down for a fast AI. If it does, satisfaction surveys collected after vendor or media messaging would mis-rank tools, and AI programmes would be judged unfairly at exactly the moment adoption decisions are made.

## 3. Research Questions & Hypotheses

| | Null hypothesis (H₀) | Alternative (H₁) | Role |
|---|---|---|---|
| **H1** | Mean ServiceNow efficiency ratings have the same distribution with and without the praise banner. | Praise-banner participants rate ServiceNow **higher** (one-sided). | Primary |
| **H2** | Mean AI-agent efficiency ratings have the same distribution for the AI team and the other team. | The AI team (warned, shown confidence, always-correct agent) rates the AI agent **lower** (one-sided). | Primary |
| **H3** | Within participants, AI-agent tickets are not faster than ServiceNow tickets. | AI-agent tickets are **faster** (one-sided). | Performance check |
| **H4** | The AI team and the other team override the AI agent's category at the same rate. | The AI team overrides **more** (one-sided), even though its agent was always right. | Secondary |
| E | — | Platform × banner interaction; who chooses the AI next time; NPS and trust; effects by job level. | Exploratory |

The directions were fixed before data collection, which justifies the one-sided tests. H1 and H2 form the primary family and are **Holm-corrected** (Holm, 1979). The exploratory analyses carry no confirmatory claims.

## 4. Experimental Design

**Instrument.** A static web app hosted on GitHub Pages (`site/`) recreates a ServiceNow-style service portal. Participants are told it is 4:45 PM on a Friday and they have six urgent requests to log. For every ticket they describe the problem **in their own words** (so the ticket text is realistic and noisy), then rate it.

| Ticket | ServiceNow set (catalog forms) | AI agent set (AI fills the form) |
|---|---|---|
| Access | Password reset | MFA reset |
| Software | Licence request (cost-centre format validation) | Software install |
| Facilities | Boardroom AV | Meeting-room camera: for the non-AI team, the agent fills in the **wrong room and cart code** |

Every ServiceNow ticket takes the same effort: four mandatory fields, a description, and a Shopping Cart checkout whose reference code is in a KB article.

In the AI set, the participant types a description and an AI agent fills in the same four fields, the category, a short description and the cart reference. The participant reviews the ticket, can correct anything, and submits; AI tickets always submit. If the AV ticket's wrong room is not corrected, the participant then receives an angry email from the (fictional) AV Operations team before rating the ticket.

**Independent variables.**
- *Praise banner* (between subjects, 50%): shown before and during the ServiceNow set.
- *AI team* (between subjects, 50%, **independent** of the praise banner): a hallucination-warning banner before and during the AI set, the agent's confidence shown on every AI ticket, and an agent that is always right. The other team sees no banner and no confidence score, and its agent gets the AV ticket wrong. These three elements change together, so H2 and H4 test the package, not the banner alone.
- *Platform* (within subjects): ServiceNow vs AI agent.
- *Set order* (randomised 50/50): ServiceNow first or AI first, to balance learning and fatigue.
- *Job level and experience* (measured, optional).

**Dependent variables.** Perceived efficiency (1–10, primary), how frustrating the ticket was (1–10), whether a planted AI error was caught, completion time (seconds, logged automatically), errors and corrections, abandonment ("I give up" button), whether the participant kept or overrode the AI's category, and a final survey: recommend-ServiceNow (0–10, NPS), trust in the AI agent (1–10), and which tool they would rather use next time.

**Controls and randomisation.** Each banner has a no-banner control. Because the two banners are independent coin flips, every participant contributes to **both** primary comparisons, and the 2 × 2 factorial lets us check that one banner does not alter the other's effect. Allocation happens in the participant's browser with a cryptographic random number generator, so the facilitator cannot influence it. Participants are debriefed about the banners at the end.

**Ethics.** Participants consent on the start screen. No names or contact details are collected, demographics are optional, and participants are asked not to type personal information into tickets.

## 5. Power Analysis

Power analysis was done before data collection with `statsmodels.stats.power` (`scripts/power_analysis.py`).

- **Primary tests (H1, H2):** smallest effect of interest **d = {{p_d}}** (Cohen's "large"; Cohen, 1988). This is realistic for a session-sized sample, and the sensitivity table shows the trade-off. Because Holm's first step tests at α/2, each test is planned at **one-sided α = {{p_alpha_each}}**, with target power {{p_power}}.
- A two-sample t-test needs **{{p_n_t}} per banner group**. Dividing by Mann–Whitney's minimum asymptotic relative efficiency of 0.864 (Hodges & Lehmann, 1956) gives **{{p_n_mwu}} per group ({{p_analysable}} analysable participants)**. Every participant counts in both comparisons, so this one number serves H1 and H2.
- Allowing **{{p_attrition}} attrition** gives a **recruitment target of {{p_recruit}}**.
- **H3 (paired):** d_z = {{p_dz}} needs only {{p_h3}} pairs.

**Sensitivity** (smallest d detectable with 80% power, one-sided α = {{p_alpha_each}}):

{{sensitivity_table}}

**Simulation check.** Across {{p_mc_sims}} simulated studies of {{p_analysable}} participants under our simulation model (`lab/simulate.py`), the Holm-corrected tests rejected H1 in {{p_mc1}}, H2 in {{p_mc2}}, and both in {{p_mc_both}} of studies. The model implies effects of d ≈ {{p_dsim1}} (praise) and d ≈ {{p_dsim2}} (warning). The praise effect is the harder one to detect.

{{fig_power}}

## 6. Data Collection & Cleaning

**Collection.** Participants complete the study on the live site. Every rated ticket is inserted as one row in a Supabase (PostgreSQL) table, and every final survey as one row in a second table. Row-level security allows anonymous inserts and reads but no edits or deletions. `scripts/export_supabase.py` downloads both tables to `data/raw/`.

**Cleaning rules** (`scripts/clean_data.py`), fixed before outcomes were examined:

1. Remove ids listed as dry runs or withdrawals (`data/raw/excluded_ids.txt`).
2. Remove double-submitted rows (same participant and ticket), keeping the first.
3. Remove rows with impossible values (ratings outside 1–10, non-positive times, invalid flags).
4. Blank out-of-range demographics rather than dropping the participant.
5. Re-derive the design columns from the design definition, and drop anyone whose banner assignment changes between rows.
6. Exclude participants with any ticket longer than **30 minutes** (they walked away).
7. Keep only participants who completed **all six tickets**.

Long but genuine completion times under the 30-minute rule were **not** trimmed.

{{cleaning_table}}

**Analysable sample:** {{n_participants}} participants ({{n_snow_banner}} saw the praise banner; {{n_ai_banner}} saw the warning). Banner cells: {{cells}}. {{n_with_demo}} gave a job level, and {{n_feedback}} completed the final survey.

**Randomisation check.** {{rand_text}}

## 7. Statistical Analysis

**Unit of analysis.** The participant. Each person's three ServiceNow ratings and three AI ratings are averaged, so two-sample tests compare independent people. **Software:** Python with pandas, SciPy (Virtanen et al., 2020) and statsmodels (Seabold & Perktold, 2010). The teaching site recomputes the same tests in the browser, and its implementation is checked against SciPy and statsmodels in `site/tests/`.

### 7.1 Descriptive statistics

{{desc_table}}

{{desc_note}}

{{fig_times}}

### 7.2 H1 and H2 (primary): do the banners move ratings?

*Test choice.* The outcomes are averages of 1–10 ratings: bounded, ordinal-ish and often skewed. The pre-specified test is a **one-sided Mann–Whitney U** (Mann & Whitney, 1947), with Welch's t (Welch, 1947) as a sensitivity check. Normality was checked with Shapiro–Wilk (Shapiro & Wilk, 1965) and equal variances with Levene's test (Levene, 1960).

| | H1: ServiceNow, praise banner | H2: AI agent, warning banner |
|---|---|---|
| Banner group: n, mean (SD), median | {{h1_n_a}}, {{h1_mean_a}} ({{h1_sd_a}}), {{h1_med_a}} | {{h2_n_a}}, {{h2_mean_a}} ({{h2_sd_a}}), {{h2_med_a}} |
| No banner: n, mean (SD), median | {{h1_n_b}}, {{h1_mean_b}} ({{h1_sd_b}}), {{h1_med_b}} | {{h2_n_b}}, {{h2_mean_b}} ({{h2_sd_b}}), {{h2_med_b}} |
| Shapiro–Wilk p (banner / none) | {{h1_sh_a}} / {{h1_sh_b}} | {{h2_sh_a}} / {{h2_sh_b}} |
| Levene p | {{h1_lev}} | {{h2_lev}} |
| **Mann–Whitney U, one-sided p** | **U = {{h1_U}}, {{h1_p_eq}}** | **U = {{h2_U}}, {{h2_p_eq}}** |
| **Holm-adjusted p** | **{{h1_p_holm}}** | **{{h2_p_holm}}** |
| Rank-biserial r (95% bootstrap CI) | {{h1_r}} {{h1_r_ci}} | {{h2_r}} {{h2_r_ci}} |
| Cohen's d (95% CI) | {{h1_d}} {{h1_d_ci}} | {{h2_d}} {{h2_d_ci}} |
| Mean difference (Welch 95% CI) | {{h1_md}} {{h1_md_ci}} | {{h2_md}} {{h2_md_ci}} |
| Welch t sensitivity | t({{h1_welch_df}}) = {{h1_welch_t}}, {{h1_welch_p_eq}} | t({{h2_welch_df}}) = {{h2_welch_t}}, {{h2_welch_p_eq}} |

**Decision, H1:** {{h1_decision}}
**Decision, H2:** {{h2_decision}}

{{fig_h1h2}}

### 7.3 H3 (performance check): is the AI agent actually faster?

Each participant used both platforms, so we use a **paired** test on the per-person difference in log geometric-mean time. On a log scale a multiplicative speed-up becomes an additive difference. The pre-specified test is the **one-sided Wilcoxon signed-rank test** (Wilcoxon, 1945); the paired-t interval on the log scale gives the estimate. Shapiro–Wilk on the log differences: p = {{h3_sh}}.

- Median participant: {{h3_sn}} s per ServiceNow ticket vs {{h3_ai}} s per AI-agent ticket; {{h3_share}} of participants were faster with the AI.
- **Wilcoxon W = {{h3_W}}, {{h3_p_eq}}.** Speed-up **{{h3_speedup}}×** (95% CI {{h3_speedup_ci}}); d_z = {{h3_dz}}; matched-pairs rank-biserial r = {{h3_rmp}}.

**Decision:** {{h3_decision}}

{{fig_h3}}

### 7.4 H4 (secondary): does the warning make people overrule the AI?

Each participant's override rate is the share of their AI tickets where they changed the AI's category. Warned: mean {{h4_mean_a}} (n = {{h4_n_a}}); unwarned: mean {{h4_mean_b}} (n = {{h4_n_b}}). **Mann–Whitney U = {{h4_U}}, one-sided {{h4_p_eq}}**, rank-biserial r = {{h4_r}} {{h4_r_ci}}. At ticket level the override rates were {{h4_t_warned}} vs {{h4_t_unwarned}} (χ² = {{h4_chi}}, {{h4_chi_p}}). Tickets from the same person are not independent, so the χ² is descriptive only.

**Decision:** {{h4_decision}}

### 7.5 Exploratory: the platform × banner interaction (two-way ANOVA, post hoc)

Each person contributes one mean rating per platform. A **linear mixed model** with a random intercept per participant, `{{int_formula}}`, is the formal test: the interaction coefficient was **{{int_coef}} ({{int_p}})**. For comparison with the course's two-way ANOVA, the Type II ANOVA on the same data (which ignores the pairing) gives:

| Term | F | df | p | partial η² |
|---|---|---|---|---|
| Platform | {{a_pl_F}} | {{a_pl_df}} | {{a_pl_p}} | {{a_pl_eta}} |
| Banner | {{a_bn_F}} | {{a_bn_df}} | {{a_bn_p}} | {{a_bn_eta}} |
| Platform × banner | {{a_in_F}} | {{a_in_df}} | {{a_in_p}} | {{a_in_eta}} |

*Post hoc.* Tukey's HSD (Tukey, 1949) across the four platform × banner cells found {{tukey_sig}} of {{tukey_n}} pairwise differences significant at a family-wise α of 0.05 (`results/tables/interaction_tukey_hsd.csv`).

{{fig_int}}

### 7.6 Exploratory: choice, NPS, trust, and who is most affected

{{explore_text}}

{{fig_pp}}

## 8. Interpretation of Results

{{interpretation}}

## 9. Limitations

- **Data.** {{limitation_data}}
- **Power and effect sizes.** The study is powered for large effects (d = {{p_d}}). The praise effect implied by our own simulation model is closer to d ≈ {{p_dsim1}}, so a non-significant H1 would be weak evidence of no effect.
- **Floor effects.** {{t3_floor}} of documentation-hunt efficiency ratings were 1 or 2, which leaves little room for a banner to act on the worst ServiceNow ticket.
- **The AI-team manipulation is a package.** The warning, the displayed confidence and the agent's accuracy all differ between the AI teams, so any difference cannot be attributed to the warning alone. The planted error also lowers the other team's AI ratings, which works against H2.
- **The AI agent is simple.** A naive Bayes classifier is not a large language model, but it behaves like a real routing AI: usually right, sometimes confidently wrong, with a visible confidence score.
- **Simulation, not the workplace.** Participants were not under real deadlines and were filing tickets about scenarios they were given, using a portal that only resembles ServiceNow (no affiliation).
- **Convenience sample.** Participants were drawn from a teaching session. Job-level cells, especially directors, are small.
- **Single-item ratings and demand effects.** Single sliders are noisy, and participants who spot a banner as a manipulation may react against it.

## 10. Conclusion & Recommendations

{{conclusion}}

**Recommendations for implementing AI in ServiceNow.**
1. **Measure behaviour, not just opinion.** Time per ticket, completion, corrections and abandonment should sit next to every satisfaction score.
2. **Run rollouts as experiments.** Randomise who gets the AI and what they are told, and size the pilot with a power analysis first.
3. **Manage the narrative deliberately.** Warnings about AI shape ratings and overrides. Pair honest risk communication with evidence of performance, and keep evaluation surveys free of marketing.
4. **Report uncertainty.** Effect sizes with confidence intervals, and posteriors for accuracy claims, not single numbers.

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

Tversky, A., & Kahneman, D. (1981). The framing of decisions and the psychology of choice. *Science, 211*(4481), 453–458.

Virtanen, P., Gommers, R., Oliphant, T. E., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272.

Welch, B. L. (1947). The generalization of "Student's" problem when several different population variances are involved. *Biometrika, 34*(1–2), 28–35.

Wilcoxon, F. (1945). Individual comparisons by ranking methods. *Biometrics Bulletin, 1*(6), 80–83.

---

*Reproduce every number in this report with `python scripts/run_pipeline.py` (see README).*
