"""Run the pre-specified analysis plan on the cleaned data.

Input : data/clean/{analysis_ready,participants,feedback}.csv, results/{cleaning_log,power_analysis}.json
Output: results/results.json   every number the report quotes
        results/tables/*.csv   descriptive and model tables
        results/figures/*.png  report and slide figures

Analysis plan (report section 7). The unit of analysis is the participant.
  H1 (primary)   Positive ServiceNow banner raises ServiceNow efficiency ratings.
                 One-sided Mann-Whitney U on per-person mean rating.
  H2 (primary)   Hallucination warning lowers AI-agent efficiency ratings.
                 One-sided Mann-Whitney U. H1 and H2 are Holm-corrected together.
  H3 (check)     The AI agent is faster than ServiceNow (within person).
                 One-sided Wilcoxon signed-rank on log time; speed-up ratio with 95% CI.
  H4 (secondary) The warning makes people override the AI agent more.
                 One-sided Mann-Whitney U on per-person override rate.
  Exploratory    Platform x banner interaction (mixed model; two-way ANOVA + Tukey HSD),
                 logistic regression for choosing the AI next time, NPS / trust,
                 and the banner effects by job level.

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

from scripts.clean_data import WALKAWAY_SECONDS, read_excluded  # noqa: E402
from lab.design import AI, JOB_LEVELS, LEGACY, TESTS  # noqa: E402
from lab.plotting import AQUA, BLUE, INK, INK2, MUTED, ORANGE, plt, save  # noqa: E402

ALPHA = 0.05
N_BOOT = 5000
RESULTS, TABLES, FIGS = ROOT / "results", ROOT / "results" / "tables", ROOT / "results" / "figures"
rng = np.random.default_rng(0)
BANNER_COLORS = {"No banner": BLUE, "Banner": ORANGE}


# ---------------------------------------------------------------------------
# Effect sizes and two-group comparison
# ---------------------------------------------------------------------------

def rank_biserial(x, y):
    """P(X > Y) - P(X < Y): +1 means every x beats every y, 0 means no tendency."""
    return float(np.sign(np.subtract.outer(np.asarray(x, float), np.asarray(y, float))).mean())


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


def two_group(x, y, alternative):
    """Planned Mann-Whitney U plus Welch t as a sensitivity check, with effect sizes and CIs."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    mwu = stats.mannwhitneyu(x, y, alternative=alternative)
    welch = stats.ttest_ind(x, y, equal_var=False, alternative=alternative)
    ci = stats.ttest_ind(x, y, equal_var=False).confidence_interval(0.95)
    d, d_ci = cohens_d(x, y)
    sx, sy, lev = stats.shapiro(x), stats.shapiro(y), stats.levene(x, y)
    return dict(
        n_a=len(x), n_b=len(y), mean_a=float(x.mean()), mean_b=float(y.mean()), sd_a=float(x.std(ddof=1)), sd_b=float(y.std(ddof=1)),
        median_a=float(np.median(x)), median_b=float(np.median(y)),
        mean_diff=float(x.mean() - y.mean()), mean_diff_ci=[float(ci.low), float(ci.high)],
        mwu_U=float(mwu.statistic), mwu_p=float(mwu.pvalue), mwu_p_two_sided=float(stats.mannwhitneyu(x, y, alternative="two-sided").pvalue),
        rank_biserial=rank_biserial(x, y), rank_biserial_ci=boot_ci(rank_biserial, x, y),
        welch_t=float(welch.statistic), welch_df=float(welch.df), welch_p=float(welch.pvalue),
        cohens_d=d, cohens_d_ci=d_ci,
        assumptions=dict(shapiro_p_a=float(sx.pvalue), shapiro_p_b=float(sy.pvalue), levene_p=float(lev.pvalue)),
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
        "ticket": [TESTS[t]["short"] for t in g.groups], "platform": [TESTS[t]["workflow"] for t in g.groups],
        "n": g.size().values, "time_mean": g["completion_time"].mean().values, "time_median": g["completion_time"].median().values,
        "time_sd": g["completion_time"].std().values,
        "time_iqr": (g["completion_time"].quantile(0.75) - g["completion_time"].quantile(0.25)).values,
        "time_skew": g["completion_time"].apply(lambda s: stats.skew(s, bias=False)).values,
        "efficiency_mean": g["efficiency"].mean().values, "frustration_mean": g["frustration"].mean().values,
        "rage_quit_rate": g["rage_quit"].mean().values,
    })
    tab.round(3).to_csv(TABLES / "descriptives_by_ticket.csv", index=False)
    return tab


def randomisation_check(pp):
    out = {}
    for col, name in [("snow_primed", "servicenow_banner"), ("ai_primed", "ai_banner")]:
        yrs = pp.dropna(subset=["years_experience"])
        a, b = yrs.loc[yrs[col] == 1, "years_experience"], yrs.loc[yrs[col] == 0, "years_experience"]
        lvl = pd.crosstab(pp["job_level"], pp[col])
        order = pd.crosstab(pp["set_order"], pp[col])
        out[name] = dict(n_banner=int((pp[col] == 1).sum()), n_none=int((pp[col] == 0).sum()),
                         years_median_banner=float(a.median()), years_median_none=float(b.median()), years_p=float(stats.mannwhitneyu(a, b).pvalue),
                         job_level_p=float(stats.chi2_contingency(lvl).pvalue), job_level_min_expected=float(stats.chi2_contingency(lvl).expected_freq.min()),
                         set_order_p=float(stats.chi2_contingency(order).pvalue))
    out["cells"] = {f"servicenow_banner={s}, ai_banner={a}": int(((pp.snow_primed == s) & (pp.ai_primed == a)).sum()) for s in (0, 1) for a in (0, 1)}
    return out


def h3_paired(pp):
    d = np.log(pp["ai_time_gm"]) - np.log(pp["sn_time_gm"])
    w = stats.wilcoxon(d, alternative="less")
    ci = stats.ttest_1samp(d, 0).confidence_interval(0.95)
    ranks = stats.rankdata(np.abs(d))
    return dict(
        n_pairs=int(len(d)), sn_median=float(pp["sn_time_gm"].median()), ai_median=float(pp["ai_time_gm"].median()),
        share_faster_with_ai=float((d < 0).mean()), wilcoxon_W=float(w.statistic), wilcoxon_p=float(w.pvalue),
        speedup=float(np.exp(-d.mean())), speedup_ci=[float(np.exp(-ci.high)), float(np.exp(-ci.low))],
        dz=float(d.mean() / d.std(ddof=1)), matched_rank_biserial=float((ranks[d > 0].sum() - ranks[d < 0].sum()) / ranks.sum()),
        shapiro_p_log_diff=float(stats.shapiro(d).pvalue),
    )


def h4_overrides(df, pp):
    rated = pp[pp["ai_tickets_rated"] > 0]
    res = two_group(rated.loc[rated.ai_primed == 1, "override_rate"], rated.loc[rated.ai_primed == 0, "override_rate"], "greater")
    t = df[(df.workflow == AI) & df.ai_correct.notna()]
    chi = stats.chi2_contingency(pd.crosstab(t["ai_primed"], t["ai_correct"]), correction=False)
    res["ticket_level"] = dict(override_rate_warned=float(1 - t.loc[t.ai_primed == 1, "ai_correct"].mean()),
                               override_rate_unwarned=float(1 - t.loc[t.ai_primed == 0, "ai_correct"].mean()),
                               chi2=float(chi.statistic), chi2_p=float(chi.pvalue), note="tickets are not independent (3 per person); descriptive only")
    return res


def platform_ratings(pp, df):
    """Exploratory: paired AI-vs-ServiceNow ratings, and abandonment by platform."""
    out = {}
    for key, a, b in [("efficiency", "ai_eff", "sn_eff"), ("frustration", "ai_frust", "sn_frust")]:
        d = pp[a] - pp[b]
        ci = stats.ttest_1samp(d, 0).confidence_interval(0.95)
        out[key] = dict(n=int(len(d)), mean_diff=float(d.mean()), ci=[float(ci.low), float(ci.high)], dz=float(d.mean() / d.std(ddof=1)),
                        wilcoxon_p=float(stats.wilcoxon(d).pvalue))
    g = df.groupby("workflow")["rage_quit"]
    out["abandoned"] = {w: dict(n=int(g.get_group(w).sum()), of=int(len(g.get_group(w)))) for w in (LEGACY, AI)}
    return out


def dropout(raw):
    """Who left, and would keeping them change H1, H2 or H3? Cleaning keeps completers only."""
    raw = raw.copy()
    people = raw.groupby("participant_id").agg(order=("set_order", "first"), tickets=("test_num", "nunique"), longest=("completion_time", "max"))
    people["kept"] = (people.tickets == len(TESTS)) & (people.longest <= WALKAWAY_SECONDS)
    tab = pd.crosstab(people.order, people.kept).reindex(index=["ai_first", "legacy_first"], columns=[False, True], fill_value=0)
    stopped = people[(people.order == "ai_first") & ~people.kept & (people.tickets.between(3, 4))]
    out = dict(by_order={o: dict(started=int(tab.loc[o].sum()), excluded=int(tab.loc[o, False])) for o in tab.index},
               fisher_p=float(stats.fisher_exact(tab.values).pvalue), ai_first_left_at_switch=int(len(stopped)),
               order_balance_p=float(stats.binomtest(int(tab.loc["ai_first"].sum()), int(tab.values.sum()), 0.5).pvalue),
               started=int(len(people)))

    # Sensitivity: everyone with at least one ticket on the platform, except walk-aways.
    stay = raw[~raw.participant_id.isin(people[people.longest > WALKAWAY_SECONDS].index)]
    def per_person(wf, col):
        return stay[stay.workflow == wf].groupby("participant_id").agg(y=("efficiency", "mean"), arm=(col, "first"))
    sn, ai = per_person(LEGACY, "snow_primed"), per_person(AI, "ai_primed")
    sens = {}
    for name, d, alt in [("h1", sn, "greater"), ("h2", ai, "less")]:
        a, b = d.loc[d.arm == 1, "y"], d.loc[d.arm == 0, "y"]
        sens[name] = dict(n_a=int(len(a)), n_b=int(len(b)), mean_a=float(a.mean()), mean_b=float(b.mean()), p=float(stats.mannwhitneyu(a, b, alternative=alt).pvalue))
    rej, padj, _, _ = multipletests([sens["h1"]["p"], sens["h2"]["p"]], alpha=ALPHA, method="holm")
    sens["h1"]["p_holm"], sens["h2"]["p_holm"] = float(padj[0]), float(padj[1])
    t = stay.groupby(["participant_id", "workflow"])["completion_time"].apply(lambda s: np.exp(np.log(s).mean())).unstack().dropna()
    dl = np.log(t[AI]) - np.log(t[LEGACY])
    sens["h3"] = dict(n=int(len(dl)), speedup=float(np.exp(-dl.mean())), p=float(stats.wilcoxon(dl, alternative="less").pvalue))
    out["sensitivity"] = sens
    return out


def planted_error(df):
    d = df[df.ai_error_injected == 1]
    caught = d.dropna(subset=["ai_error_caught"])
    return dict(tickets=int(len(d)), caught=int(caught.ai_error_caught.sum()), rated=int(len(caught)),
                arms={str(k): int(v) for k, v in d.ai_primed.value_counts().items()})


def interaction(df):
    """Platform x banner on per-person platform means: a mixed model (formal) and a two-way ANOVA + Tukey."""
    long = df.groupby(["participant_id", "workflow"]).agg(efficiency=("efficiency", "mean"), primed=("primed", "first")).reset_index()
    long["banner"] = np.where(long.primed == 1, "Banner", "No banner")
    long["platform"] = long["workflow"]
    out = {}
    try:
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            m = smf.mixedlm("efficiency ~ C(platform) * C(banner)", long, groups=long["participant_id"]).fit(reml=True)
        term = [k for k in m.params.index if ":" in k][0]
        out["mixed"] = dict(formula="efficiency ~ platform * banner + (1 | participant)", interaction_coef=float(m.params[term]),
                            interaction_p=float(m.pvalues[term]), converged=bool(m.converged),
                            warnings=sorted({str(w.message).split(".")[0] for w in caught}))
        pd.DataFrame({"coef": m.params, "se": m.bse, "z": m.tvalues, "p": m.pvalues}).round(4).to_csv(TABLES / "interaction_mixed_model.csv")
    except Exception as exc:  # noqa: BLE001 - small real samples can break the mixed model
        out["mixed"] = dict(error=str(exc))
    aov = anova_lm(smf.ols("efficiency ~ C(platform) * C(banner)", long).fit(), typ=2)
    aov["partial_eta_sq"] = aov["sum_sq"] / (aov["sum_sq"] + aov.loc["Residual", "sum_sq"])
    aov.loc["Residual", "partial_eta_sq"] = np.nan
    aov.round(4).to_csv(TABLES / "interaction_anova.csv")

    def row(t):
        r = aov.loc[t]
        return dict(F=float(r["F"]), df=float(r["df"]), p=float(r["PR(>F)"]), partial_eta_sq=float(r["partial_eta_sq"]))
    out["anova"] = dict(platform=row("C(platform)"), banner=row("C(banner)"), interaction=row("C(platform):C(banner)"),
                        df_resid=float(aov.loc["Residual", "df"]), note="two rows per person; the mixed model is the formal test")
    tk = pairwise_tukeyhsd(long["efficiency"], long["platform"] + " · " + long["banner"], alpha=ALPHA)
    tab = pd.DataFrame(tk.summary().data[1:], columns=tk.summary().data[0])
    tab.to_csv(TABLES / "interaction_tukey_hsd.csv", index=False)
    out["tukey_significant"] = int(tab["reject"].astype(str).eq("True").sum())
    out["tukey_pairs"] = int(len(tab))
    out["cells"] = {f"{p} | {b}": dict(zip(["mean", "ci"], mean_ci(g["efficiency"])), n=int(len(g)))
                    for (p, b), g in long.groupby(["platform", "banner"])}
    return out, long


def preference_logit(pp):
    d = pp.dropna(subset=["prefer_ai"]).copy()
    if d["prefer_ai"].nunique() < 2 or len(d) < 10:
        return dict(error="not enough variation in the final-survey choice")
    d["speedup_log"] = np.log(d["sn_time_gm"] / d["ai_time_gm"])
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        m = smf.logit("prefer_ai ~ speedup_log + ai_primed + snow_primed", d).fit(disp=0, cov_type="HC1")
    if any("converge" in str(w.message) for w in caught) or m.params.abs().max() > 10:
        return dict(error="the model did not converge (likely separation: almost everyone chose the same option)",
                    n=int(len(d)), share_prefer_ai=float(d["prefer_ai"].mean()))
    ci = m.conf_int()
    pd.DataFrame({"coef": m.params, "se": m.bse, "z": m.tvalues, "p": m.pvalues, "odds_ratio": np.exp(m.params),
                  "or_ci_low": np.exp(ci[0]), "or_ci_high": np.exp(ci[1])}).round(4).to_csv(TABLES / "preference_logit.csv")
    return dict(n=int(m.nobs), share_prefer_ai=float(d["prefer_ai"].mean()), pseudo_r2=float(m.prsquared),
                terms={k: dict(odds_ratio=float(np.exp(m.params[k])), or_ci=[float(np.exp(ci.loc[k, 0])), float(np.exp(ci.loc[k, 1]))], p=float(m.pvalues[k]))
                       for k in m.params.index if k != "Intercept"})


def survey_outcomes(pp):
    def nps(s):
        return float(100 * ((s >= 9).mean() - (s <= 6).mean())) if len(s) else float("nan")
    out = {}
    d = pp.dropna(subset=["nps_servicenow"])
    if d.snow_primed.nunique() == 2:
        a, b = d.loc[d.snow_primed == 1, "nps_servicenow"], d.loc[d.snow_primed == 0, "nps_servicenow"]
        out["nps"] = dict(nps_banner=nps(a), nps_none=nps(b), mwu_p=float(stats.mannwhitneyu(a, b, alternative="greater").pvalue))
    d = pp.dropna(subset=["ai_trust"])
    if d.ai_primed.nunique() == 2:
        a, b = d.loc[d.ai_primed == 1, "ai_trust"], d.loc[d.ai_primed == 0, "ai_trust"]
        out["trust"] = dict(mean_warned=float(a.mean()), mean_unwarned=float(b.mean()), mwu_p=float(stats.mannwhitneyu(a, b, alternative="less").pvalue))
    return out


def manipulation_checks(fb):
    """Share of each group that correctly reports whether it saw each banner."""
    out = {}
    for col, mc in [("snow_primed", "mc_snow"), ("ai_primed", "mc_ai")]:
        if mc not in fb or fb[mc].isna().all():
            continue
        d = fb.dropna(subset=[mc])
        right = np.where(d[col] == 1, d[mc] == "yes", d[mc] == "no")
        out[mc] = dict(pass_rate=float(right.mean()), pass_banner=float(right[d[col] == 1].mean()) if (d[col] == 1).any() else None,
                       pass_none=float(right[d[col] == 0].mean()) if (d[col] == 0).any() else None, n=int(len(d)))
    return out


def by_level(pp):
    out = {}
    for lvl in JOB_LEVELS:
        s = pp[pp.job_level == lvl]
        if len(s) < 5:            # privacy: never report a group of fewer than 5 people
            out[lvl] = dict(suppressed=True, servicenow_banner_shift=None, ai_warning_shift=None)
            continue
        row = dict(n=int(len(s)))
        for col, eff, key in [("snow_primed", "sn_eff", "servicenow_banner_shift"), ("ai_primed", "ai_eff", "ai_warning_shift")]:
            a, b = s.loc[s[col] == 1, eff], s.loc[s[col] == 0, eff]
            # The same privacy rule applies to each side of a banner split.
            row[key] = float(a.mean() - b.mean()) if min(len(a), len(b)) >= 5 else None
        out[lvl] = row
    return out


# ---------------------------------------------------------------------------
# Figures
# ---------------------------------------------------------------------------

def p_eq(p):
    return "p < 0.001" if p < 0.001 else f"p = {p:.3f}"


def plain_log_axis(ax):
    from matplotlib.ticker import FuncFormatter, LogLocator
    ax.yaxis.set_major_locator(LogLocator(base=10, subs=(1, 2, 5)))
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:g}"))
    ax.yaxis.set_minor_formatter(FuncFormatter(lambda v, _: ""))


def strip_box(ax, groups, ylabel):
    for i, (label, vals) in enumerate(groups.items()):
        vals = np.asarray(vals, float)
        ax.boxplot(vals, positions=[i], widths=0.45, showfliers=False, patch_artist=True,
                   boxprops=dict(facecolor="none", edgecolor=INK2), medianprops=dict(color=INK, lw=2),
                   whiskerprops=dict(color=INK2), capprops=dict(color=INK2))
        ax.scatter(i + rng.uniform(-0.14, 0.14, len(vals)), vals, s=24, color=BANNER_COLORS[label], alpha=0.75,
                   edgecolor="white", linewidth=0.6, zorder=3)
        ax.annotate(f"mean {vals.mean():.2f}\nn = {len(vals)}", (i + 0.3, np.median(vals)), fontsize=8.5, color=INK2, va="center")
    ax.set_xticks(range(len(groups)), list(groups))
    ax.set_xlim(-0.6, len(groups) - 0.1)
    ax.set_ylim(0.5, 10.5)
    ax.set_ylabel(ylabel)


def figures(df, pp, desc, long, R):
    fig, axes_ = plt.subplots(1, 2, figsize=(11, 4.4), sharey=True)
    strip_box(axes_[0], {"No banner": pp.loc[pp.snow_primed == 0, "sn_eff"], "Banner": pp.loc[pp.snow_primed == 1, "sn_eff"]},
              "Mean efficiency rating (1–10)")
    axes_[0].set_title(f"H1 · ServiceNow + praise banner\nHolm {p_eq(R['h1']['p_holm'])}")
    strip_box(axes_[1], {"No banner": pp.loc[pp.ai_primed == 0, "ai_eff"], "Banner": pp.loc[pp.ai_primed == 1, "ai_eff"]}, "")
    axes_[1].set_title(f"H2 · AI agent, AI team vs other team\nHolm {p_eq(R['h2']['p_holm'])}")
    save(fig, FIGS / "fig1_h1_h2_ratings.png")

    fig, ax = plt.subplots(figsize=(8, 4.2))
    ax.boxplot([df.loc[df.test_num == t, "completion_time"].values for t in TESTS], positions=range(6), widths=0.5, patch_artist=True,
               boxprops=dict(facecolor="none", edgecolor=INK2), medianprops=dict(color=BLUE, lw=2.2), whiskerprops=dict(color=INK2),
               capprops=dict(color=INK2), flierprops=dict(marker="o", markersize=3.5, markerfacecolor=MUTED, markeredgecolor="none"))
    ax.scatter(range(6), desc["time_mean"], marker="D", s=40, color=ORANGE, zorder=4, label="Mean", edgecolor="white", linewidth=1)
    ax.plot([], [], color=BLUE, lw=2.2, label="Median")
    ax.set_yscale("log")
    plain_log_axis(ax)
    ax.set_xticks(range(6), desc["ticket"], fontsize=8.5)
    ax.set_ylabel("Completion time (s, log scale)")
    ax.set_title("Completion time by ticket")
    ax.legend(loc="upper right")
    save(fig, FIGS / "fig2_completion_times.png")

    fig, ax = plt.subplots(figsize=(5.2, 4.4))
    for _, r in pp.iterrows():
        ax.plot([0, 1], [r.sn_time_gm, r.ai_time_gm], color=MUTED, lw=0.8, alpha=0.6)
    ax.plot([0, 1], [pp.sn_time_gm.median(), pp.ai_time_gm.median()], color=ORANGE, lw=3, marker="o", markersize=8, label="Median participant")
    ax.set_yscale("log")
    plain_log_axis(ax)
    ax.set_xticks([0, 1], ["ServiceNow", "AI agent"])
    ax.set_xlim(-0.3, 1.3)
    ax.set_ylabel("Typical seconds per ticket (log)")
    ax.set_title(f"H3: AI agent {R['h3']['speedup']:.1f}× faster ({p_eq(R['h3']['wilcoxon_p'])})")
    ax.legend(loc="upper right")
    save(fig, FIGS / "fig3_h3_paired_times.png")

    fig, ax = plt.subplots(figsize=(6.5, 4.2))
    for k, banner in enumerate(["No banner", "Banner"]):
        cells = [mean_ci(long.loc[(long.platform == p) & (long.banner == banner), "efficiency"]) for p in (LEGACY, AI)]
        ax.errorbar(np.arange(2) + (k - 0.5) * 0.06, [m for m, _ in cells], yerr=[h for _, h in cells], color=BANNER_COLORS[banner],
                    lw=2.2, marker="o", markersize=7, capsize=3, label=banner)
    ax.set_xticks([0, 1], ["ServiceNow\n(banner = praise)", "AI agent\n(banner = AI team)"])
    ax.set_xlim(-0.4, 1.4)
    ax.set_ylim(1, 10)
    ax.set_ylabel("Mean efficiency rating (±95% CI)")
    ax.set_title("Mean efficiency by platform and banner")
    ax.legend(loc="upper left")
    save(fig, FIGS / "fig4_interaction.png")

    fig, ax = plt.subplots(figsize=(7, 4.4))
    for p, color in [(LEGACY, BLUE), (AI, AQUA)]:
        pts = [(df[(df.workflow == p) & (df.primed == b)].completion_time.median(), df[(df.workflow == p) & (df.primed == b)].efficiency.mean()) for b in (0, 1)]
        ax.annotate("", xy=pts[1], xytext=pts[0], arrowprops=dict(arrowstyle="-|>", color=ORANGE, lw=2))
        for (x_, y_), lab in zip(pts, ["no banner", "AI team" if p == AI else "praise"]):
            ax.scatter([x_], [y_], s=90, color=color, edgecolor="white", linewidth=1.5, zorder=3)
            ax.annotate(f"{p}: {lab}", (x_, y_), xytext=(0, -16), textcoords="offset points", fontsize=9, color=INK2, ha="center")
    ax.set_xscale("log")
    from matplotlib.ticker import FuncFormatter, LogLocator
    ax.xaxis.set_major_locator(LogLocator(base=10, subs=(1, 2, 3, 5, 7)))
    ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:g}s"))
    ax.xaxis.set_minor_formatter(FuncFormatter(lambda v, _: ""))
    ax.set_ylim(1, 10)
    ax.set_xlabel("Median seconds per ticket (log; faster ←)")
    ax.set_ylabel("Mean efficiency rating")
    ax.set_title("Perception vs performance, with and without each banner")
    save(fig, FIGS / "fig6_perception_performance.png")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def fmt_p(p):
    return "< 0.001" if p < 0.001 else f"{p:.3f}"


def main():
    TABLES.mkdir(parents=True, exist_ok=True)
    FIGS.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(ROOT / "data" / "clean" / "analysis_ready.csv")
    pp = pd.read_csv(ROOT / "data" / "clean" / "participants.csv")
    clog = json.loads((RESULTS / "cleaning_log.json").read_text())
    power = json.loads((RESULTS / "power_analysis.json").read_text())

    R = dict(data_source=clog["data_source"], n_participants=int(len(pp)), n_tickets=int(len(df)), n_feedback=int(clog.get("n_feedback", 0)),
             n_snow_banner=int(pp.snow_primed.sum()), n_ai_banner=int(pp.ai_primed.sum()),
             n_with_demographics=int(pp.job_level.notna().sum()), cleaning=clog["steps"], power=power)
    R["randomisation"] = randomisation_check(pp)
    desc = descriptives(df)
    R["descriptives"] = desc.round(4).to_dict(orient="records")

    R["h1"] = two_group(pp.loc[pp.snow_primed == 1, "sn_eff"], pp.loc[pp.snow_primed == 0, "sn_eff"], "greater")
    R["h2"] = two_group(pp.loc[pp.ai_primed == 1, "ai_eff"], pp.loc[pp.ai_primed == 0, "ai_eff"], "less")
    rej, padj, _, _ = multipletests([R["h1"]["mwu_p"], R["h2"]["mwu_p"]], alpha=ALPHA, method="holm")
    for k, i in (("h1", 0), ("h2", 1)):
        R[k]["p_holm"], R[k]["reject"] = float(padj[i]), bool(rej[i])
    R["h3"] = h3_paired(pp)
    R["h3"]["reject"] = bool(R["h3"]["wilcoxon_p"] < ALPHA)
    R["h4"] = h4_overrides(df, pp)
    R["h4"]["reject"] = bool(R["h4"]["mwu_p"] < ALPHA)
    R["interaction"], long = interaction(df)
    R["preference"] = preference_logit(pp)
    R["survey"] = survey_outcomes(pp)
    R["by_level"] = by_level(pp)
    fb = pd.read_csv(ROOT / "data" / "clean" / "feedback.csv")
    R["manipulation_checks"] = manipulation_checks(fb)
    R["platform_ratings"] = platform_ratings(pp, df)
    R["planted_error"] = planted_error(df)
    raw = pd.read_csv(ROOT / clog["raw_file"])
    gone = read_excluded(ROOT / "data" / "raw" / "excluded_ids.txt")
    wd = ROOT / "data" / "raw" / "live_withdrawals.csv"
    if wd.exists():
        gone |= set(pd.read_csv(wd)["participant_id"].dropna())
    R["raw_file"] = clog["raw_file"]
    R["dropout"] = dropout(raw[~raw.participant_id.isin(gone)].drop_duplicates(["participant_id", "test_num"]))

    pd.DataFrame([
        ["H1", "Praise banner ↑ ServiceNow rating", "Mann–Whitney U (one-sided), Holm", R["h1"]["mwu_p"], R["h1"]["p_holm"], R["h1"]["rank_biserial"]],
        ["H2", "Hallucination warning ↓ AI rating", "Mann–Whitney U (one-sided), Holm", R["h2"]["mwu_p"], R["h2"]["p_holm"], R["h2"]["rank_biserial"]],
        ["H3", "AI agent faster (paired)", "Wilcoxon signed-rank (one-sided)", R["h3"]["wilcoxon_p"], None, R["h3"]["matched_rank_biserial"]],
        ["H4", "Warning ↑ overrides", "Mann–Whitney U (one-sided)", R["h4"]["mwu_p"], None, R["h4"]["rank_biserial"]],
    ], columns=["hypothesis", "claim", "test", "p", "p_holm", "rank_biserial"]).round(4).to_csv(TABLES / "hypothesis_summary.csv", index=False)

    figures(df, pp, desc, long, R)
    (RESULTS / "results.json").write_text(json.dumps(R, indent=2, default=float))
    print(f"H1 p_holm = {fmt_p(R['h1']['p_holm'])} (r = {R['h1']['rank_biserial']:.2f}) · H2 p_holm = {fmt_p(R['h2']['p_holm'])} "
          f"(r = {R['h2']['rank_biserial']:.2f}) · H3 {R['h3']['speedup']:.1f}× faster · H4 p = {fmt_p(R['h4']['mwu_p'])}")


if __name__ == "__main__":
    main()
