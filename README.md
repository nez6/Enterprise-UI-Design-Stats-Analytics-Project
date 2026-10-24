# Selling the Single Pane of Glass

**Does a one-line efficiency claim change how people rate a broken ticketing workflow?**
Module Project 2 (Statistical Analysis): a randomised experiment, run in a custom Streamlit simulator, with a fully scripted analysis pipeline.

> ⚠️ **Data status:** the committed results and report come from a **simulated pilot** (`data/raw/simulated_pilot_raw.csv`) used to build and test the pipeline. After collecting real participants, regenerate everything with one command (see [Reproduce with real data](#reproduce-with-real-data)).

| Deliverable | Where |
|---|---|
| Written report | [report/REPORT.md](report/REPORT.md) (generated from [report/report_template.md](report/report_template.md)) |
| Data collection instrument | [app.py](app.py) |
| Cleaning / power / analysis scripts | [scripts/](scripts/) |
| Raw and cleaned data | [data/](data/) (see the [data dictionary](data/README.md)) |
| Figures and tables | [results/](results/) |
| Presentation | [presentation/OUTLINE.md](presentation/OUTLINE.md) (8-minute script and slide plan) |
| Collaboration workflow | [CONTRIBUTING.md](CONTRIBUTING.md) |

## The experiment in one paragraph

Participants play a project lead logging six urgent IT tickets at 4:45 PM on a Friday. Tests 1–4 are clean baselines (two legacy forms, two AI-assisted). Test 5 is a hallucinating AI bot. Test 6 is a "documentation hunt" whose submit button is hidden inside a dense KB article. Participants are randomised (permuted blocks of 4) to a **primed** arm, which sees *"ServiceNow's single pane of glass is incredibly efficient"* before Test 6 (and a similar AI claim before Test 5), or a **control** arm, which sees nothing. After every test they rate frustration and perceived efficiency (1–10). The app also logs completion time, errors and rage-quits.

| | Hypothesis | Test |
|---|---|---|
| **H1 (primary)** | Priming raises Test 6 perceived efficiency | One-sided Mann–Whitney U |
| H2 | Chaos tests take longer than baseline (within subjects) | One-sided Wilcoxon signed-rank, Holm-corrected |
| H3 | Priming lowers chaos-test frustration | One-sided Mann–Whitney U, Holm-corrected |
| H4 (exploratory) | Priming × job level | Two-way ANOVA + Tukey HSD; mixed model |
| H5 (exploratory) | Predictors of rage-quitting | Logistic regression, clustered SEs |

## Setup

```bash
git clone https://github.com/nez6/Enterprise-UI-Design-Stats-Analytics-Project.git
cd Enterprise-UI-Design-Stats-Analytics-Project
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Tested with Python 3.12.

## Reproduce the analysis (simulated pilot)

```bash
python scripts/run_pipeline.py
```

This runs five steps in order. Each step is also a standalone script:

| Step | Script | Writes |
|---|---|---|
| 1. Power analysis | `scripts/power_analysis.py` | `results/power_analysis.json`, `results/figures/fig5_power_curve.png` |
| 2. Simulated pilot | `scripts/generate_simulated_data.py` | `data/raw/simulated_pilot_raw.csv` |
| 3. Cleaning | `scripts/clean_data.py --raw <file>` | `data/clean/*.csv`, `results/cleaning_log.{md,json}` |
| 4. Analysis | `scripts/analyze.py` | `results/results.json`, `results/tables/*.csv`, `results/figures/*.png` |
| 5. Report | `scripts/build_report.py` | `report/REPORT.md` |

Every random step is seeded, so reruns reproduce the same numbers. Run the unit tests for the cleaning rules and effect-size helpers with `pytest`.

## Collect real data

```bash
streamlit run app.py
```

- Each participant uses **Tab 1 · Live Simulator**: consent → optional demographics → six tests → debrief (about 10 minutes).
- Every completed test is appended to `data/raw/live_sessions.csv`. Run all sessions from the same machine or deployment so they land in one file. To write somewhere else, set `LAB_DATA_PATH=/path/file.csv`.
- If the app runs on a host with a read-only disk, participants can download their rows from the sidebar instead. Concatenate those CSVs into `data/raw/live_sessions.csv`.
- Add your own test runs to `data/raw/excluded_ids.txt` before analysing.
- **Don't tell participants about the banner** until data collection is finished. The debrief screen asks them not to.
- Target: **54 participants** (from the power analysis, including 10% attrition).

Tabs 2–6 of the app are an interactive statistics textbook (EDA, hypothesis tests, ANOVA, regression, Bayesian updating). They run on live sessions or a 300-person synthetic benchmark.

## Reproduce with real data

```bash
python scripts/run_pipeline.py --raw data/raw/live_sessions.csv
```

The report regenerates with real numbers. Every result-dependent sentence (reject / fail to reject, abstract, interpretation) is filled in from `results/results.json`, and the "simulated data" banner disappears. Then reread the generated report and adjust the prose in `report/report_template.md` if the story has changed.

## Repository layout

```
app.py                      Streamlit data-collection instrument + teaching dashboard
lab/                        Shared code: design constants, simulator, plotting style
scripts/                    Power analysis, simulation, cleaning, analysis, report, pipeline
data/raw/                   Raw telemetry (simulated pilot; live_sessions.csv once collected)
data/clean/                 Analysis-ready long table + one-row-per-participant table
results/                    JSON results, CSV tables, PNG figures, cleaning log
report/                     Report template (edit) and generated REPORT.md (don't edit)
presentation/               Slide plan and 8-minute speaker script
tests/                      pytest unit tests
```
