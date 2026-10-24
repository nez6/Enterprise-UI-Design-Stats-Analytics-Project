# The Enterprise Workflow & Applied Statistics Lab

A single-file Streamlit app (`app.py`) that does two things:

1. **Runs a live split-test.** Participants work through six simulated IT tickets, comparing legacy enterprise ticketing with an AI bot workflow. The app records completion time, errors, rage-quits and per-test survey ratings.
2. **Teaches a graduate statistics syllabus on that data.** It covers EDA, hypothesis testing, power, two-way ANOVA, logistic and OLS regression, Simpson's paradox and Bayesian updating, all as interactive Plotly visuals.

## Quick start

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

## Tabs

| Tab | Chapters | What it shows |
|---|---|---|
| 1 · Live Simulator | — | Scenario card, optional demographics, then the six tests. Tests 1–4 are clean baselines (two legacy, two AI assistant). Test 5 is the chaos AI bot. Test 6 is the primed documentation hunt, where the checkout code is buried in a KB article. Every test has a survey and an abandon button. |
| 2 · EDA & Demographics | 1, 2 | Mean, median, SD, IQR and skewness per test; a mean-vs-median dumbbell chart; histograms and boxplots by job level and experience. |
| 3 · Hypothesis Testing | 3, 4, 6 | Shapiro–Wilk and Levene checks, automatic selection of Student's t, Welch's t or Mann–Whitney U, a one- or two-sided toggle with p-value shading, and `TTestIndPower` curves. |
| 4 · Two-Way ANOVA | 7, 9 | `ols(... C(workflow) + C(priming) + C(job_level) + C(workflow):C(priming))` with `anova_lm`, partial η², interaction plots, a priming-by-seniority test and Tukey's HSD. |
| 5 · Regression | 10, 12 | Logistic model of rage-quits (with odds ratios), an OLS model of frustration drivers, residual diagnostics and a Simpson's paradox toggle. |
| 6 · Bayes & Manifesto | 11 | Beta–Binomial trust updating, a discrete Bayes error calculator, and a data-driven executive summary. |

## Experimental design notes

- **Priming is randomised.** Each live participant has a 50% chance of joining the primed arm. Primed participants see a banner before Test 5 (AI bot) and Test 6 (the ServiceNow "single pane of glass" line). Priming both an AI test and a legacy test keeps workflow × priming fully crossed.
- **The ANOVA uses only Tests 5–6.** Tests 1–4 are never primed, so including them would confound priming with chaos.
- **Benchmark data:** `generate_benchmark()` builds 300 participants × 6 tests with `np.random.seed(42)`. It has right-skewed chaos times, priming effects that are strongest for directors, a rage-quit model driven by chaos and experience, and a built-in Simpson's paradox between experience and perceived efficiency.
- **Live telemetry stays in the browser session.** Download it as CSV from the sidebar before you reset.
