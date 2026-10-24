"""Run the pre-specified analysis plan on the cleaned data.

Input : data/clean/analysis_ready.csv, data/clean/participants.csv, results/cleaning_log.json
Output: results/results.json        every number the report quotes
        results/tables/*.csv        descriptive and model tables
        results/figures/*.png       report and slide figures

Analysis plan (report section 7):
  H1 (primary)     Priming raises Test 6 perceived efficiency.
                   One-sided Mann-Whitney U; rank-biserial r, Cohen's d, Welch 95% CI.
  H2 (secondary)   Chaos tests take longer than baseline tests (within subjects).
                   One-sided Wilcoxon signed-rank on per-participant log time difference;
                   geometric-mean ratio with 95% CI.
  H3 (secondary)   Priming lowers frustration on the chaos tests.
                   One-sided Mann-Whitney U on per-participant mean chaos frustration.
                   H2 and H3 are Holm-corrected as one family.
  H4 (exploratory) Priming x job level on Test 6 efficiency: two-way ANOVA (Type II),
                   partial eta squared, Tukey HSD; plus a mixed model for
                   workflow x priming across Tests 5-6.
  H5 (exploratory) Rage-quit logistic regression with participant-clustered SEs.

Usage:  python scripts/analyze.py
"""

import json
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf
from scipy import stats
from statsmodels.stats.anova import anova_lm
from statsmodels.stats.multicomp import pairwise_tukeyhsd
from statsmodels.stats.multitest import multipletests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from lab.design import JOB_LEVELS, TESTS  # noqa: E402
from lab.plotting import ARM_COLORS, BLUE, INK, INK2, MUTED, ORANGE, plt, save  # noqa: E402

ALPHA = 0.05
N_BOOT = 5000
RESULTS = ROOT / "results"
TABLES = RESULTS / "tables"
FIGS = RESULTS / "figures"
rng = np.random.default_rng(0)


# ---------------------------------------------------------------------------
# Effect-size helpers
# ---------------------------------------------------------------------------

def rank_biserial(x, y):
    """P(X > Y) - P(X < Y): +1 means every x beats every y, 0 means no tendency."""
    diff = np.sign(np.subtract.outer(np.asarray(x, float), np.asarray(y, float)))
    return float(diff.mean())


def boot_ci(stat, x, y, n_boot=N_BOOT):
    """Percentile bootstrap 95% CI for a two-sample statistic (resampling within groups)."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    draws = [stat(rng.choice(x, len(x)), rng.choice(y, len(y))) for _ in range(n_boot)]
    return [float(np.percentile(draws, 2.5)), float(np.percentile(draws, 97.5))]


def cohens_d(x, y):
    nx, ny = len(x), len(y)
    pooled = np.sqrt(((nx - 1) * np.var(x, ddof=1) + (ny - 1) * np.var(y, ddof=1)) / (nx + ny - 2))
    d = (np.mean(x) - np.mean(y)) / pooled if pooled > 0 else 0.0
    se = np.sqrt((nx + ny) / (nx * ny) + d ** 2 / (2 * (nx + ny)))
    return float(d), [float(d - 1.96 * se), float(d + 1.96 * se)]


def assumption_checks(x, y):
    sx, sy = stats.shapiro(x), stats.shapiro(y)
    lev = stats.levene(x, y)
    return dict(shapiro_p_a=float(sx.pvalue), shapiro_p_b=float(sy.pvalue), levene_p=float(lev.pvalue),
                normal=bool(sx.pvalue > ALPHA and sy.pvalue > ALPHA), equal_var=bool(lev.pvalue > ALPHA))


def two_group(x, y, alternative):
    """Planned MWU plus Welch t as a sensitivity check, with effect sizes and CIs."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    mwu = stats.mannwhitneyu(x, y, alternative=alternative)
    welch = stats.ttest_ind(x, y, equal_var=False, alternative=alternative)
    welch_ci = stats.ttest_ind(x, y, equal_var=False).confidence_interval(0.95)
    d, d_ci = cohens_d(x, y)
    return dict(
        n_a=len(x), n_b=len(y),
        mean_a=float(x.mean()), mean_b=float(y.mean()),
        median_a=float(np.median(x)), median_b=float(np.median(y)),
        sd_a=float(x.std(ddof=1)), sd_b=float(y.std(ddof=1)),
        mean_diff=float(x.mean() - y.mean()), mean_diff_ci=[float(welch_ci.low), float(welch_ci.high)],
        median_diff=float(np.median(x) - np.median(y)),
        median_diff_ci=boot_ci(lambda a, b: np.median(a) - np.median(b), x, y),
        mwu_U=float(mwu.statistic), mwu_p=float(mwu.pvalue),
        rank_biserial=rank_biserial(x, y), rank_biserial_ci=boot_ci(rank_biserial, x, y),
        welch_t=float(welch.statistic), welch_df=float(welch.df), welch_p=float(welch.pvalue),
        cohens_d=d, cohens_d_ci=d_ci,
        assumptions=assumption_checks(x, y),
    )


def mean_ci(s):
    s = pd.Series(s).dropna()
    if len(s) < 2:
        return float(s.mean()), 0.0
    return float(s.mean()), float(stats.t.ppf(0.975, len(s) - 1) * s.std(ddof=1) / np.sqrt(len(s)))


# ---------------------------------------------------------------------------
# Analyses
# ---------------------------------------------------------------------------

def descriptives(df):
    g = df.groupby("test_num")
    tab = pd.DataFrame({
        "test": [TESTS[t]["short"] for t in g.groups],
        "workflow": [TESTS[t]["workflow"] for t in g.groups],
        "n": g.size().values,
        "time_mean": g["completion_time"].mean().values,
        "time_median": g["completion_time"].median().values,
        "time_sd": g["completion_time"].std().values,
        "time_iqr": (g["completion_time"].quantile(0.75) - g["completion_time"].quantile(0.25)).values,
        "time_skew": g["completion_time"].apply(lambda s: stats.skew(s, bias=False)).values,
        "frustration_mean": g["frustration"].mean().values,
        "efficiency_mean": g["efficiency"].mean().values,
        "rage_quit_rate": g["rage_quit"].mean().values,
    })
    tab.round(3).to_csv(TABLES / "descriptives_by_test.csv", index=False)
    return tab


def randomisation_check(pp):
    out = {}
    yrs = pp.dropna(subset=["years_experience"])
    a, b = yrs.loc[yrs.arm == "Primed", "years_experience"], yrs.loc[yrs.arm == "Control", "years_experience"]
    out["years_median_primed"], out["years_median_control"] = float(a.median()), float(b.median())
    out["years_mwu_p"] = float(stats.mannwhitneyu(a, b).pvalue)
    ct = pd.crosstab(pp["job_level"], pp["arm"])
    out["job_level_table"] = ct.to_dict()
    out["job_level_chi2_p"] = float(stats.chi2_contingency(ct).pvalue)
    out["min_expected_count"] = float(stats.chi2_contingency(ct).expected_freq.min())
    return out


def h2_paired(pp):
    diff = np.log(pp["chaos_time_gm"]) - np.log(pp["baseline_time_gm"])
    w = stats.wilcoxon(diff, alternative="greater")
    t = stats.ttest_1samp(diff, 0)
    ci = t.confidence_interval(0.95)
    ranks = stats.rankdata(np.abs(diff))
    r_mp = float((ranks[diff > 0].sum() - ranks[diff < 0].sum()) / ranks.sum())
    return dict(
        n_pairs=int(len(diff)),
        baseline_gm_median=float(pp["baseline_time_gm"].median()),
        chaos_gm_median=float(pp["chaos_time_gm"].median()),
        share_slower_in_chaos=float((diff > 0).mean()),
        wilcoxon_W=float(w.statistic), wilcoxon_p=float(w.pvalue),
        ratio=float(np.exp(diff.mean())), ratio_ci=[float(np.exp(ci.low)), float(np.exp(ci.high))],
        dz=float(diff.mean() / diff.std(ddof=1)),
        matched_rank_biserial=r_mp,
        shapiro_p_log_diff=float(stats.shapiro(diff).pvalue),
    )


def h4_anova(df):
    t6 = df[df.test_num == 6].dropna(subset=["job_level"]).copy()
    t6["arm"] = np.where(t6.primed_arm == 1, "Primed", "Control")
    cells = t6.groupby(["job_level", "arm"]).size()
    full = cells.min() >= 2 and len(cells) == 6
    formula = "efficiency ~ C(arm) * C(job_level)" if full else "efficiency ~ C(arm) + C(job_level)"
    model = smf.ols(formula, data=t6).fit()
    aov = anova_lm(model, typ=2)
    aov["partial_eta_sq"] = aov["sum_sq"] / (aov["sum_sq"] + aov.loc["Residual", "sum_sq"])
    aov.loc["Residual", "partial_eta_sq"] = np.nan
    aov.round(4).to_csv(TABLES / "h4_anova.csv")

    labels = t6["job_level"].str.split(" /").str[0] + " · " + t6["arm"]
    tk = pairwise_tukeyhsd(t6["efficiency"], labels, alpha=ALPHA)
    tk_tab = pd.DataFrame(tk.summary().data[1:], columns=tk.summary().data[0])
    tk_tab.to_csv(TABLES / "h4_tukey_hsd.csv", index=False)

    lift = {}
    for lvl in JOB_LEVELS:
        sub = t6[t6.job_level == lvl]
        p, c = sub.loc[sub.arm == "Primed", "efficiency"], sub.loc[sub.arm == "Control", "efficiency"]
        lift[lvl] = dict(n_primed=int(len(p)), n_control=int(len(c)),
                         diff=float(p.mean() - c.mean()) if len(p) and len(c) else None)

    def row(term):
        if term not in aov.index:
            return None
        r = aov.loc[term]
        return dict(F=float(r["F"]), df=float(r["df"]), p=float(r["PR(>F)"]), partial_eta_sq=float(r["partial_eta_sq"]))

    return dict(
        formula=formula, interaction_included=bool(full), n=int(model.nobs),
        cell_counts={f"{k[0]} | {k[1]}": int(v) for k, v in cells.items()},
        arm=row("C(arm)"), job_level=row("C(job_level)"), interaction=row("C(arm):C(job_level)"),
        residual_shapiro_p=float(stats.shapiro(model.resid).pvalue),
        levene_cells_p=float(stats.levene(*[g["efficiency"].values for _, g in t6.groupby(["job_level", "arm"])]).pvalue),
        tukey_significant_pairs=int(tk_tab["reject"].astype(str).eq("True").sum()),
        tukey_pairs=int(len(tk_tab)),
        priming_lift_by_level=lift,
    ), t6


def h4b_mixed(df):
    chaos = df[df.workflow_chaos == 1].copy()
    chaos["arm"] = np.where(chaos.primed_arm == 1, "Primed", "Control")
    m = smf.mixedlm("frustration ~ C(workflow) * C(arm)", chaos, groups=chaos["participant_id"]).fit(reml=True)
    tab = pd.DataFrame({"coef": m.params, "se": m.bse, "z": m.tvalues, "p": m.pvalues}).round(4)
    tab.to_csv(TABLES / "h4b_mixed_model.csv")
    inter = [k for k in m.params.index if ":" in k][0]
    return dict(formula="frustration ~ C(workflow) * C(arm) + (1 | participant)",
                interaction_coef=float(m.params[inter]), interaction_p=float(m.pvalues[inter]),
                converged=bool(m.converged))


def h5_logit(df):
    """Rage-quit model on the chaos tests only.

    In small samples nobody may quit a baseline test, which makes a chaos indicator
    perfectly separate the outcome (infinite odds ratio). Baseline vs chaos quit rates
    are therefore reported descriptively, and the model asks what predicts quitting
    *given* a chaos test.
    """
    d = df[(df.workflow_chaos == 1)].dropna(subset=["years_experience"]).copy()
    d["doc_hunt"] = (d["test_num"] == 6).astype(int)
    groups = pd.factorize(d["participant_id"])[0]
    m = smf.logit("rage_quit ~ years_experience + primed_arm + doc_hunt", data=d).fit(
        disp=0, cov_type="cluster", cov_kwds={"groups": groups})
    ci = m.conf_int()
    tab = pd.DataFrame({"coef": m.params, "se": m.bse, "z": m.tvalues, "p": m.pvalues,
                        "odds_ratio": np.exp(m.params), "or_ci_low": np.exp(ci[0]), "or_ci_high": np.exp(ci[1])})
    tab.round(4).to_csv(TABLES / "h5_logit.csv")
    return dict(
        formula="rage_quit ~ years_experience + primed_arm + doc_hunt (Tests 5-6, clustered SEs)",
        n_rows=int(m.nobs), n_rage_quits=int(d["rage_quit"].sum()), pseudo_r2=float(m.prsquared),
        baseline_quit_rate=float(df.loc[df.workflow_chaos == 0, "rage_quit"].mean()),
        chaos_quit_rate=float(df.loc[df.workflow_chaos == 1, "rage_quit"].mean()),
        terms={k: dict(odds_ratio=float(np.exp(m.params[k])), or_ci=[float(np.exp(ci.loc[k, 0])), float(np.exp(ci.loc[k, 1]))],
                       p=float(m.pvalues[k])) for k in m.params.index if k != "Intercept"},
    )


# ---------------------------------------------------------------------------
# Figures
# ---------------------------------------------------------------------------

def strip_box(ax, groups, colors, ylabel):
    """Box (quartiles) with every participant drawn as a jittered dot."""
    for i, (label, vals) in enumerate(groups.items()):
        vals = np.asarray(vals, float)
        ax.boxplot(vals, positions=[i], widths=0.45, showfliers=False, patch_artist=True,
                   boxprops=dict(facecolor="none", edgecolor=INK2), medianprops=dict(color=INK, lw=2),
                   whiskerprops=dict(color=INK2), capprops=dict(color=INK2))
        jitter = rng.uniform(-0.14, 0.14, len(vals))
        ax.scatter(i + jitter, vals + rng.uniform(-0.12, 0.12, len(vals)), s=26, color=colors[label],
                   alpha=0.75, edgecolor="white", linewidth=0.6, zorder=3)
        ax.annotate(f"median {np.median(vals):g}\nmean {vals.mean():.2f}\nn = {len(vals)}", (i + 0.3, np.median(vals)),
                    fontsize=8.5, color=INK2, va="center")
    ax.set_xticks(range(len(groups)), list(groups))
    ax.set_xlim(-0.6, len(groups) - 0.1)
    ax.set_ylabel(ylabel)


def figures(df, pp, t6, desc, R):
    # Fig 1: H1
    fig, ax = plt.subplots(figsize=(6.5, 4.2))
    strip_box(ax, {"Control": pp.loc[pp.arm == "Control", "t6_efficiency"],
                   "Primed": pp.loc[pp.arm == "Primed", "t6_efficiency"]}, ARM_COLORS,
              "Perceived efficiency, Test 6 (1–10)")
    h1 = R["h1"]
    ax.set_title(f"H1: priming and perceived efficiency (MWU one-sided {p_eq(h1['mwu_p'])})")
    ax.set_ylim(0.5, 10.5)
    save(fig, FIGS / "fig1_h1_t6_efficiency.png")

    # Fig 2: completion-time distributions per test, mean vs median
    fig, ax = plt.subplots(figsize=(8, 4.2))
    data = [df.loc[df.test_num == t, "completion_time"].values for t in TESTS]
    ax.boxplot(data, positions=range(6), widths=0.5, showfliers=True, patch_artist=True,
               boxprops=dict(facecolor="none", edgecolor=INK2), medianprops=dict(color=BLUE, lw=2.2),
               whiskerprops=dict(color=INK2), capprops=dict(color=INK2),
               flierprops=dict(marker="o", markersize=3.5, markerfacecolor=MUTED, markeredgecolor="none"))
    ax.scatter(range(6), desc["time_mean"], marker="D", s=40, color=ORANGE, zorder=4, label="Mean",
               edgecolor="white", linewidth=1)
    ax.plot([], [], color=BLUE, lw=2.2, label="Median")
    ax.set_yscale("log")
    plain_log_axis(ax)
    ax.set_xticks(range(6), desc["test"], rotation=0, fontsize=8.5)
    ax.set_ylabel("Completion time (s, log scale)")
    ax.set_title("Chaos tests are slower, and their long right tails pull the mean above the median")
    ax.legend(loc="upper left")
    save(fig, FIGS / "fig2_completion_times.png")

    # Fig 3: H2 paired slope chart
    fig, ax = plt.subplots(figsize=(5.2, 4.4))
    for _, r in pp.iterrows():
        ax.plot([0, 1], [r.baseline_time_gm, r.chaos_time_gm], color=MUTED, lw=0.8, alpha=0.6)
    ax.plot([0, 1], [pp.baseline_time_gm.median(), pp.chaos_time_gm.median()], color=ORANGE, lw=3,
            marker="o", markersize=8, label="Median participant")
    ax.set_yscale("log")
    plain_log_axis(ax)
    ax.set_xticks([0, 1], ["Baseline\n(Tests 1–4)", "Chaos\n(Tests 5–6)"])
    ax.set_xlim(-0.3, 1.3)
    ax.set_ylabel("Geometric-mean time per test (s, log)")
    h2 = R["h2"]
    ax.set_title(f"H2: {h2['ratio']:.1f}× slower in chaos (Wilcoxon {p_eq(h2['wilcoxon_p'])})")
    ax.legend(loc="upper left")
    save(fig, FIGS / "fig3_h2_paired_times.png")

    # Fig 4: H4 interaction plot
    fig, ax = plt.subplots(figsize=(7, 4.2))
    short = [l.split(" /")[0] for l in JOB_LEVELS]
    for k, arm in enumerate(["Control", "Primed"]):
        cells = [mean_ci(t6.loc[(t6.job_level == l) & (t6.arm == arm), "efficiency"]) for l in JOB_LEVELS]
        xs = np.arange(3) + (k - 0.5) * 0.08
        ax.errorbar(xs, [m for m, _ in cells], yerr=[h for _, h in cells], color=ARM_COLORS[arm], lw=2,
                    marker="o", markersize=7, capsize=3, label=arm)
        for x, l, (m, _) in zip(xs, JOB_LEVELS, cells):
            n = int(((t6.job_level == l) & (t6.arm == arm)).sum())
            ax.annotate(f"n={n}", (x, m), xytext=(8 if k else -8, 0), textcoords="offset points",
                        ha="left" if k else "right", va="center", fontsize=8, color=INK2)
    ax.set_ylim(0.5, 10.5)
    ax.set_xlim(-0.45, 2.45)
    ax.set_xticks(range(3), short)
    ax.set_ylabel("Mean perceived efficiency, Test 6 (±95% CI)")
    ax.set_title("H4 (exploratory): does seniority change susceptibility to priming?")
    ax.legend(loc="upper left")
    save(fig, FIGS / "fig4_h4_interaction.png")

    # Fig 6: rage-quit rates by test
    fig, ax = plt.subplots(figsize=(7, 3.6))
    ax.bar(range(6), desc["rage_quit_rate"] * 100, color=BLUE, width=0.6)
    for i, v in enumerate(desc["rage_quit_rate"] * 100):
        ax.annotate(f"{v:.0f}%", (i, v), ha="center", va="bottom", fontsize=8.5, color=INK2,
                    xytext=(0, 2), textcoords="offset points")
    ax.set_xticks(range(6), desc["test"], fontsize=8.5)
    ax.set_ylabel("Abandoned tickets (%)")
    ax.set_title("Abandonment (rage-quit) rate by test")
    save(fig, FIGS / "fig6_rage_quit_rates.png")


def fmt_p(p):
    return "< 0.001" if p < 0.001 else f"{p:.3f}"


def p_eq(p):
    """'p < 0.001' or 'p = 0.042' for titles."""
    return "p < 0.001" if p < 0.001 else f"p = {p:.3f}"


def plain_log_axis(ax):
    from matplotlib.ticker import FuncFormatter, LogLocator
    ax.yaxis.set_major_locator(LogLocator(base=10, subs=(1, 2, 5)))
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:g}"))
    ax.yaxis.set_minor_formatter(FuncFormatter(lambda v, _: ""))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    TABLES.mkdir(parents=True, exist_ok=True)
    FIGS.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(ROOT / "data" / "clean" / "analysis_ready.csv")
    pp = pd.read_csv(ROOT / "data" / "clean" / "participants.csv")
    clog = json.loads((RESULTS / "cleaning_log.json").read_text())
    power = json.loads((RESULTS / "power_analysis.json").read_text())

    R = dict(
        data_source=clog["data_source"],
        n_participants=int(len(pp)), n_rows=int(len(df)),
        n_primed=int((pp.arm == "Primed").sum()), n_control=int((pp.arm == "Control").sum()),
        n_with_demographics=int(pp["job_level"].notna().sum()),
        cleaning=clog["steps"], power=power,
    )
    R["randomisation"] = randomisation_check(pp)
    desc = descriptives(df)
    R["descriptives"] = desc.round(4).to_dict(orient="records")

    p_, c_ = pp.loc[pp.arm == "Primed"], pp.loc[pp.arm == "Control"]
    R["h1"] = two_group(p_["t6_efficiency"], c_["t6_efficiency"], "greater")
    R["h2"] = h2_paired(pp)
    R["h3"] = two_group(p_["chaos_frustration"], c_["chaos_frustration"], "less")

    reject, p_holm, _, _ = multipletests([R["h2"]["wilcoxon_p"], R["h3"]["mwu_p"]], alpha=ALPHA, method="holm")
    R["h2"]["p_holm"], R["h3"]["p_holm"] = float(p_holm[0]), float(p_holm[1])
    R["h2"]["reject"], R["h3"]["reject"] = bool(reject[0]), bool(reject[1])
    R["h1"]["reject"] = bool(R["h1"]["mwu_p"] < ALPHA)

    R["h4"], t6 = h4_anova(df)
    for key, fn in [("h4b", h4b_mixed), ("h5", h5_logit)]:
        try:
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always")
                R[key] = fn(df)
            R[key]["warnings"] = sorted({str(w.message).split(".")[0] for w in caught})
        except Exception as exc:  # noqa: BLE001 - small real samples can break these models
            R[key] = dict(error=str(exc))

    pd.DataFrame([
        ["H1", "Priming ↑ T6 efficiency", "Mann–Whitney U (one-sided)", R["h1"]["mwu_p"], None, R["h1"]["rank_biserial"]],
        ["H2", "Chaos ↑ completion time", "Wilcoxon signed-rank (one-sided)", R["h2"]["wilcoxon_p"], R["h2"]["p_holm"],
         R["h2"]["matched_rank_biserial"]],
        ["H3", "Priming ↓ chaos frustration", "Mann–Whitney U (one-sided)", R["h3"]["mwu_p"], R["h3"]["p_holm"],
         R["h3"]["rank_biserial"]],
    ], columns=["hypothesis", "claim", "test", "p", "p_holm", "rank_biserial"]).round(4).to_csv(
        TABLES / "hypothesis_summary.csv", index=False)

    figures(df, pp, t6.assign(arm=np.where(t6.primed_arm == 1, "Primed", "Control")), desc, R)
    (RESULTS / "results.json").write_text(json.dumps(R, indent=2, default=float))
    print(f"H1 p = {fmt_p(R['h1']['mwu_p'])} (r = {R['h1']['rank_biserial']:.2f}) · "
          f"H2 p_holm = {fmt_p(R['h2']['p_holm'])} (ratio {R['h2']['ratio']:.2f}×) · "
          f"H3 p_holm = {fmt_p(R['h3']['p_holm'])}")


if __name__ == "__main__":
    main()
