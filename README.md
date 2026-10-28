# SNOW Stats Lab

**File noisy ServiceNow-style tickets, then learn statistics and AI from the group's own data.**

**Live:**
- SNOW Stats Lab: https://nez6.github.io/Enterprise-UI-Design-Stats-Analytics-Project/?session=pathfinders
- Streamlit lab (runs in the browser): https://nez6.github.io/Enterprise-UI-Design-Stats-Analytics-Project/streamlit/index.html

Republish both after changes with `./scripts/deploy_pages.sh` (it builds `site/` and pushes the `gh-pages` branch).

A static website (GitHub Pages) with six pages:

| # | Page | What it teaches |
|---|---|---|
| 1 | **Service Portal** | Participants file six noisy tickets: three in a ServiceNow-style catalog, three with an AI agent built into the form. They rate each one, then give feedback on ServiceNow and the AI. |
| 2 | **The Shape of Noise** | Distributions, mean vs median (a draggable see-saw), SD/IQR/skew, and an animated **Central Limit Theorem** sampling machine |
| 3 | **Bayes & the Agent** | **Bayes' theorem** as area, base-rate traps, the AI agent's naive Bayes brain, and trust as a Beta posterior |
| 4 | **Did It Work?** | Permutation tests, t-tests and assumption checks, paired tests, power, two-way ANOVA + Tukey HSD, chi-square |
| 5 | **Regression → ML** | Least squares drawn as squares, multiple regression, logistic regression and confusion matrices, overfitting, Simpson's paradox |
| 6 | **LLMs & the Playbook** | Next-token probabilities, temperature and hallucination, calibration, the perception–performance gap, and an AI-in-ServiceNow implementation playbook |

Every lesson redraws live as tickets arrive. It also has a 300-person benchmark class, so the charts are populated before anyone submits.

**Update:** the AI team (the warning group) also sees the agent's confidence and gets an always-correct agent. The other team's agent fills in the wrong room and cart code on the meeting-room ticket; it submits anyway, and an angry email from AV follows unless they catch it. All three ServiceNow tickets now take the same effort.

**The experiment inside it:** each participant has two independent 50/50 chances of seeing a **positive** banner before the ServiceNow set ("ServiceNow's single pane of glass is incredibly efficient") and a **negative** banner before the AI set ("AI agents are known to hallucinate…"). Do the words change how efficient each tool *feels*, even when the stopwatch says the AI is faster?

> Not affiliated with or endorsed by ServiceNow, Inc. The portal is a look-alike training simulation with no logos and no login.

---

## Syllabus coverage

| Chapter | Where |
|---|---|
| 1 Practical statistics: population vs sample, descriptive vs inferential, how much data | Page 2 (population vs sample, sampling, CLT), page 4 (power) |
| 2 Probability distributions | Page 2 (field guide: binomial, Poisson, normal, lognormal, exponential), page 6 (softmax) |
| 3 Logic of hypothesis testing | Page 4 (permutation test, null world) |
| 4 Significance & power | Page 4 (power, “significant is not the same as important”) |
| 5 Sampling | Page 2 (random, stratified, systematic, convenience; CLT) |
| 6 Class balancing | Page 5 (oversampling, undersampling, class weights, SMOTE) |
| 7 Parametric tests | Page 4 (Student and Welch t, paired t) |
| 8 Nonparametric tests | Page 4 (Mann–Whitney, Wilcoxon signed-rank, permutation, chi-square) |
| 9 ANOVA | Page 4 (two-way ANOVA, interaction, Tukey HSD) |
| 10 Regression | Page 5 (OLS, multiple, logistic) |
| 11 Bayesian statistics | Page 3 (Bayes as area, naive Bayes, Beta updating) |
| 12 Model evaluation | Page 5 (confusion matrix, precision/recall, ROC/AUC, cross-validation, overfitting), page 6 (calibration) |

## Run the website locally

```bash
cd site
npm install
npm run dev          # http://localhost:5173 (demo mode: data stays in your browser)
npm test             # checks the in-browser statistics against SciPy/statsmodels
```

Presenting: in any lesson, **→ / ↓ / Space** jump to the next scene and **← / ↑** go back. Switch the data source (top right) between *Live class*, *Benchmark* and *Live + benchmark*.

## Put it online (GitHub Pages + Supabase)

**1. Create the shared database** (free tier is fine):
1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste [supabase/schema.sql](supabase/schema.sql) and run it. This creates the `submissions` and `feedback` tables, row-level security (anyone can insert and read; nobody can edit or delete), and live updates.
3. In **Project Settings → API**, copy the **Project URL** and the **anon public** key.

**2. Point the site at it:** in GitHub, go to **Settings → Secrets and variables → Actions → Variables** and add:
- `SUPABASE_URL` = the project URL
- `SUPABASE_ANON_KEY` = the anon key (it's designed to be public; the security policies protect the data)

**3. Turn on Pages:** go to **Settings → Pages → Source** and select **GitHub Actions**. Every push to `main` that touches `site/` builds and deploys via [.github/workflows/pages.yml](.github/workflows/pages.yml). Your URL will be `https://<user>.github.io/Enterprise-UI-Design-Stats-Analytics-Project/`.

**4. On the call:** share `…/?session=pathfinders-nov` (any label you like) so each session's data stays separate. The pill at the top right shows how many people are live.

Without step 2 the site still works in **demo mode**: each browser keeps its own data, and tabs in the same browser update live.

## The statistics course project (Python)

The graded analysis runs on the same data with scripts, not notebooks:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest                                   # cleaning-rule and helper tests
python scripts/run_pipeline.py           # simulated pilot, end to end
```

After the live session:

```bash
export SUPABASE_URL=… SUPABASE_ANON_KEY=…
python scripts/export_supabase.py --session pathfinders-nov    # → data/raw/live_sessions.csv + live_feedback.csv
python scripts/run_pipeline.py --raw data/raw/live_sessions.csv
```

| Step | Script | Writes |
|---|---|---|
| Power analysis | `scripts/power_analysis.py` | `results/power_analysis.json`, power-curve figure |
| Simulated pilot (default runs only) | `scripts/generate_simulated_data.py` | `data/raw/simulated_pilot_*.csv` |
| Cleaning (7 pre-registered rules) | `scripts/clean_data.py` | `data/clean/*.csv`, `results/cleaning_log.md` |
| Analysis (H1–H4 + exploratory) | `scripts/analyze.py` | `results/results.json`, `results/tables/`, `results/figures/` |
| Written report | `scripts/build_report.py` | [report/REPORT.md](report/REPORT.md) from [report/report_template.md](report/report_template.md) |

> ⚠️ The committed results are from a **simulated pilot**, clearly labelled throughout. Regenerate everything from the live export before submitting.

**Hypotheses.** H1: the praise banner raises ServiceNow ratings. H2: the warning lowers AI ratings. Both are primary, tested with one-sided Mann–Whitney U and Holm-corrected. H3: the AI is faster (paired Wilcoxon). H4: the warning increases AI overrides. The power analysis says to recruit **68 participants**.

## Repository layout

```
site/                 The website (Vite + D3 + KaTeX), deployed to GitHub Pages
  src/pages/          portal.js + lesson1–5.js (one file per page)
  src/stats/core.js   In-browser statistics, tested against SciPy (site/tests/)
  src/data/           Design, AI-agent classifier, benchmark class, Supabase/demo storage
supabase/schema.sql   Database tables, security policies and realtime
lab/                  Shared Python design, simulator and plotting style
scripts/              Export, power, simulation, cleaning, analysis, report, pipeline
data/                 Raw and cleaned data (see data/README.md)
results/              Figures, tables, results.json, cleaning log
report/               Report template (edit) and generated REPORT.md
presentation/         Talk outline and speaker script
tests/                Python tests
```
