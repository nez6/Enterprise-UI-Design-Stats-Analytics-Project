"""Render report/REPORT.md from report/report_template.md and results/results.json.

Prose lives in the template: edit that, not REPORT.md. Every number, and every
sentence whose wording depends on a result (reject / fail to reject, the abstract,
the interpretation), is filled in here, so rerunning the pipeline on new data
keeps the report consistent with the analysis.

Usage:  python scripts/build_report.py
"""

import json
import re
import sys
from datetime import date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

TEMPLATE = ROOT / "report" / "report_template.md"
OUT = ROOT / "report" / "REPORT.md"


def p_eq(p):
    return "p < 0.001" if p < 0.001 else f"p = {p:.3f}"


def p_num(p):
    return "< 0.001" if p < 0.001 else f"{p:.3f}"


def f2(x):
    return f"{x:.2f}"


def ci(pair, fmt=f2):
    return f"[{fmt(pair[0])}, {fmt(pair[1])}]"


def fig(name, caption):
    return f"![{caption}](../results/figures/{name})\n\n*{caption}*"


def md_table(df):
    head = "| " + " | ".join(df.columns) + " |"
    sep = "|" + "|".join("---" for _ in df.columns) + "|"
    rows = ["| " + " | ".join(str(v) for v in r) + " |" for r in df.itertuples(index=False)]
    return "\n".join([head, sep, *rows])


def two_group_values(prefix, h):
    a = h["assumptions"]
    return {
        f"{prefix}_n_a": h["n_a"], f"{prefix}_n_b": h["n_b"],
        f"{prefix}_mean_a": f2(h["mean_a"]), f"{prefix}_mean_b": f2(h["mean_b"]),
        f"{prefix}_sd_a": f2(h["sd_a"]), f"{prefix}_sd_b": f2(h["sd_b"]),
        f"{prefix}_med_a": f"{h['median_a']:g}", f"{prefix}_med_b": f"{h['median_b']:g}",
        f"{prefix}_U": f"{h['mwu_U']:.0f}", f"{prefix}_p_eq": p_eq(h["mwu_p"]),
        f"{prefix}_r": f2(h["rank_biserial"]), f"{prefix}_r_ci": ci(h["rank_biserial_ci"]),
        f"{prefix}_d": f2(h["cohens_d"]), f"{prefix}_d_ci": ci(h["cohens_d_ci"]),
        f"{prefix}_md": f"{h['mean_diff']:+.2f}", f"{prefix}_md_ci": ci(h["mean_diff_ci"]),
        f"{prefix}_medd": f"{h['median_diff']:+g}", f"{prefix}_medd_ci": ci(h["median_diff_ci"], lambda v: f"{v:+g}"),
        f"{prefix}_welch_t": f2(h["welch_t"]), f"{prefix}_welch_df": f"{h['welch_df']:.1f}",
        f"{prefix}_welch_p_eq": p_eq(h["welch_p"]),
        f"{prefix}_sh_a": p_num(a["shapiro_p_a"]), f"{prefix}_sh_b": p_num(a["shapiro_p_b"]),
        f"{prefix}_lev": p_num(a["levene_p"]),
    }


def build_values(R):
    h1, h2, h3, h4, P = R["h1"], R["h2"], R["h3"], R["h4"], R["power"]
    h5 = R.get("h5", {})
    simulated = R["data_source"] != "live"
    clean = pd.read_csv(ROOT / "data" / "clean" / "analysis_ready.csv")
    floor = (clean.loc[clean.test_num == 6, "efficiency"] <= 2).mean()

    v = {"report_date": date.today().strftime("%B %d, %Y")}
    v["data_banner"] = (
        "> ⚠️ **These results come from a SIMULATED pilot dataset** (`data/raw/simulated_pilot_raw.csv`), "
        "generated to build and test the analysis pipeline before real participants were run. They are not "
        "empirical findings. Rerun `python scripts/run_pipeline.py --raw data/raw/live_sessions.csv` after "
        "data collection to regenerate this report from real data."
        if simulated else
        "> Data: real participant sessions collected with the study app (`data/raw/live_sessions.csv`)."
    )
    v.update(n_participants=R["n_participants"], n_primed=R["n_primed"], n_control=R["n_control"],
             n_with_demo=R["n_with_demographics"])

    # Power
    v.update(
        p_d=P["h1"]["effect_size_d"], p_alpha=P["alpha"], p_power=P["target_power"],
        p_n_t=f"{P['h1']['n_per_group_ttest']:.1f}", p_n_mwu=P["h1"]["n_per_group"],
        p_analysable=P["h1"]["analysable_total"], p_recruit=P["h1"]["recruit_total"],
        p_attrition=f"{P['attrition']:.0%}", p_dz=P["h2"]["effect_size_dz"],
        p_h2_pairs=f"{P['h2']['n_pairs_ttest']:.1f}", p_mc_sims=P["h1"]["monte_carlo_sims"],
        p_mc_power=f"{P['h1']['monte_carlo_power']:.0%}", p_d_sim=f2(P["h1"]["simulation_model_d"]),
        p_n_sim=P["h1"]["n_per_group_for_simulation_d"],
    )
    v["sensitivity_table"] = md_table(pd.DataFrame(
        [[n, f2(d)] for n, d in P["sensitivity_min_d_by_n_per_group"].items()],
        columns=["Participants per group", "Minimum detectable d"]))
    v["fig_power"] = fig("fig5_power_curve.png", "Figure 1. Power for H1 as a function of group size.")

    # Cleaning and randomisation
    v["cleaning_table"] = md_table(pd.DataFrame(
        [[s["rule"], f"{s['rows_before']} → {s['rows_after']}", f"{s['participants_before']} → {s['participants_after']}",
          s["note"] or "–"] for s in R["cleaning"]],
        columns=["Step", "Rows", "Participants", "Note"]))
    rnd = R["randomisation"]
    v.update(rand_years_p=f"{rnd['years_median_primed']:g}", rand_years_c=f"{rnd['years_median_control']:g}",
             rand_years_p_eq=p_eq(rnd["years_mwu_p"]), rand_chi_p_eq=p_eq(rnd["job_level_chi2_p"]),
             rand_min_exp=f"{rnd['min_expected_count']:.1f}")
    balanced = rnd["years_mwu_p"] > 0.05 and rnd["job_level_chi2_p"] > 0.05
    v["rand_verdict"] = (
        ("Some expected cell counts are below 5 (minimum " f"{rnd['min_expected_count']:.1f}), so the χ² check is only "
         "approximate. " if rnd["min_expected_count"] < 5 else "")
        + ("Neither check suggests the arms differ at baseline." if balanced else
           "At least one check suggests the arms differ at baseline. Treat the arm comparisons with extra caution "
           "and consider adjusting for that variable.")
    )

    # Descriptives
    d = pd.DataFrame(R["descriptives"])
    v["desc_table"] = md_table(pd.DataFrame({
        "Test": d["test"], "Workflow": d["workflow"], "n": d["n"],
        "Mean (s)": d["time_mean"].round(1), "Median (s)": d["time_median"].round(1),
        "SD": d["time_sd"].round(1), "IQR": d["time_iqr"].round(1), "Skew": d["time_skew"].round(2),
        "Rage-quit": (d["rage_quit_rate"] * 100).round(0).astype(int).astype(str) + "%",
    }))
    chaos_rows = d[d.index >= 4]  # descriptives are ordered by test, so rows 4-5 are Tests 5-6
    gap = (chaos_rows["time_mean"] - chaos_rows["time_median"]).mean()
    v["desc_note"] = (
        f"On the chaos tests the mean sits on average {gap:.0f} s above the median, with skewness up to "
        f"{chaos_rows['time_skew'].max():.1f}. A few people fought Test 5 or Test 6 for many minutes, so medians and "
        "rank-based tests describe the typical participant better than means and t-tests."
        if gap > 0 and chaos_rows["time_skew"].min() > 0.5 else
        "The completion-time distributions are summarised above. Rank-based tests are used throughout because "
        "times are bounded below and ratings are ordinal."
    )
    v["fig_times"] = fig("fig2_completion_times.png", "Figure 2. Completion time by test (log scale). Diamonds are means; blue lines are medians.")

    # H1-H3
    v.update(two_group_values("h1", h1))
    v.update(two_group_values("h3", h3))
    v["h1_decision"] = (
        f"reject H₀ at α = 0.05. Primed participants rated Test 6 as more efficient (r = {f2(h1['rank_biserial'])})."
        if h1["reject"] else
        f"fail to reject H₀ at α = 0.05. The data are compatible with effects from r = {f2(h1['rank_biserial_ci'][0])} "
        f"to r = {f2(h1['rank_biserial_ci'][1])}, so this is an absence of evidence, not evidence of absence."
    )
    v["h3_decision"] = (
        f"reject H₀ after Holm correction. Primed participants reported lower frustration on the chaos tests."
        if h3["reject"] else "fail to reject H₀ after Holm correction."
    )
    v["h3_p_holm_eq"] = p_eq(h3["p_holm"])
    v["fig_h1"] = fig("fig1_h1_t6_efficiency.png", "Figure 3. Test 6 perceived efficiency by arm. Each dot is one participant.")
    v.update(
        h2_sh=p_num(h2["shapiro_p_log_diff"]), h2_base=f"{h2['baseline_gm_median']:.0f}",
        h2_chaos=f"{h2['chaos_gm_median']:.0f}", h2_share=f"{h2['share_slower_in_chaos']:.0%}",
        h2_W=f"{h2['wilcoxon_W']:.0f}", h2_p_eq=p_eq(h2["wilcoxon_p"]), h2_p_holm_eq=p_eq(h2["p_holm"]),
        h2_ratio=f"{h2['ratio']:.1f}", h2_ratio_ci=ci(h2["ratio_ci"]), h2_dz=f2(h2["dz"]),
        h2_rmp=f2(h2["matched_rank_biserial"]),
        h2_decision=("reject H₀. The manipulation worked: the chaos tests were much slower."
                     if h2["reject"] else "fail to reject H₀. The chaos tests were not reliably slower."),
    )
    v["fig_h2"] = fig("fig3_h2_paired_times.png", "Figure 4. Each line is one participant's baseline vs chaos time.")

    # H4
    def term(key, name):
        t = h4[key]
        if t is None:
            return {f"h4_{name}_{k}": "–" for k in ("F", "df", "p", "eta")}
        return {f"h4_{name}_F": f2(t["F"]), f"h4_{name}_df": f"{t['df']:.0f}", f"h4_{name}_p": p_num(t["p"]),
                f"h4_{name}_eta": f2(t["partial_eta_sq"])}
    v.update(term("arm", "arm"), **term("job_level", "lvl"), **term("interaction", "int"))
    v.update(h4_formula=h4["formula"], h4_n=h4["n"], h4_res_sh=p_num(h4["residual_shapiro_p"]),
             h4_lev=p_num(h4["levene_cells_p"]), h4_tukey_sig=h4["tukey_significant_pairs"],
             h4_tukey_n=h4["tukey_pairs"])
    v["h4_cells"] = "; ".join(f"{k.replace(' / Executive', '').replace(' / Manager', '').replace(' / Associate', '')}: {n}"
                              for k, n in h4["cell_counts"].items())
    v["h4_lift"] = "; ".join(f"{lvl.split(' /')[0]} {x['diff']:+.2f} (n = {x['n_primed']} vs {x['n_control']})"
                             for lvl, x in h4["priming_lift_by_level"].items() if x["diff"] is not None)
    h4b = R.get("h4b", {})
    v.update(h4b_formula=h4b.get("formula", "n/a"),
             h4b_coef=f"{h4b['interaction_coef']:+.2f}" if "interaction_coef" in h4b else "n/a",
             h4b_p_eq=p_eq(h4b["interaction_p"]) if "interaction_p" in h4b else "model did not fit")
    v["h4b_note"] = (
        "" if "interaction_p" not in h4b else
        "In other words, the banner's effect on frustration did not detectably differ between the AI-bot task and "
        "the legacy task." if h4b["interaction_p"] >= 0.05 else
        "The banner's effect on frustration appears to differ between the AI-bot task and the legacy task."
    )
    v["fig_h4"] = fig("fig4_h4_interaction.png", "Figure 5. Mean Test 6 efficiency by job level and arm (exploratory).")

    # H5
    if "terms" in h5:
        t = h5["terms"]
        v["h5_text"] = (
            f"No one abandoned a baseline test ({h5['baseline_quit_rate']:.0%}), against {h5['chaos_quit_rate']:.0%} of "
            "chaos-test attempts. Because no baseline quits means a chaos indicator would perfectly separate quitters "
            "(an infinite odds ratio), we model abandonment *within* the chaos tests: "
            f"`{h5['formula']}` ({h5['n_rows']} rows, {h5['n_rage_quits']} quits, McFadden pseudo-R² = {f2(h5['pseudo_r2'])}).\n\n"
            "| Predictor | Odds ratio | 95% CI | p |\n|---|---|---|---|\n"
            + "\n".join(f"| {k} | {f2(x['odds_ratio'])} | {ci(x['or_ci'])} | {p_num(x['p'])} |" for k, x in t.items())
            + "\n\nWith so few events, the confidence intervals are wide. We treat this model as descriptive."
            if h5["baseline_quit_rate"] == 0 else
            f"Baseline quit rate {h5['baseline_quit_rate']:.0%}, chaos {h5['chaos_quit_rate']:.0%}. Model `{h5['formula']}`:\n\n"
            "| Predictor | Odds ratio | 95% CI | p |\n|---|---|---|---|\n"
            + "\n".join(f"| {k} | {f2(x['odds_ratio'])} | {ci(x['or_ci'])} | {p_num(x['p'])} |" for k, x in t.items())
        )
    else:
        v["h5_text"] = f"The logistic model could not be fitted on this sample ({h5.get('error', 'unknown error')})."
    v["fig_rq"] = fig("fig6_rage_quit_rates.png", "Figure 6. Share of tickets abandoned on each test.")

    # Narrative pieces that depend on the results
    v["abstract_h1"] = (
        f"primed participants rated the task as more efficient (Mann–Whitney one-sided {p_eq(h1['mwu_p'])}, "
        f"rank-biserial r = {f2(h1['rank_biserial'])}, 95% CI {ci(h1['rank_biserial_ci'])})."
        if h1["reject"] else
        f"we found no evidence that the claim raised efficiency ratings (Mann–Whitney one-sided {p_eq(h1['mwu_p'])}; "
        f"rank-biserial r = {f2(h1['rank_biserial'])}, 95% CI {ci(h1['rank_biserial_ci'])}). Ratings were bunched at the "
        "bottom of the scale in both arms."
    )
    v["abstract_h3"] = (
        f"primed participants reported lower frustration on the chaos tasks (Holm-adjusted {p_eq(h3['p_holm'])}, "
        f"r = {f2(h3['rank_biserial'])})."
        if h3["reject"] else
        f"frustration did not differ detectably between arms (Holm-adjusted {p_eq(h3['p_holm'])})."
    )
    v["h1_floor"] = f"{floor:.0%}"

    if h1["reject"] and h3["reject"]:
        core = ("A single sentence of marketing copy shifted both how efficient people judged a broken task to be and "
                "how frustrated they reported feeling, even though their measured experience (time, errors) was the same.")
    elif h3["reject"]:
        core = ("The banner did not detectably change how *efficient* people judged the documentation hunt to be, but primed "
                "participants did report *less frustration* on the chaos tasks. One reading is that the claim softened the "
                "emotional reaction without overriding people's judgment of the system itself, which they rated at the floor "
                "either way. Another is that the floor effect hid an efficiency shift. The data can't separate these.")
    elif h1["reject"]:
        core = "The banner raised efficiency ratings, but we found no detectable change in reported frustration."
    else:
        core = "We found no detectable effect of the banner on efficiency ratings or on frustration."
    # Manipulation check, seniority and behaviour-vs-opinion sentences all depend on the data.
    quit_gap = h5.get("chaos_quit_rate", 0) > h5.get("baseline_quit_rate", 0)
    manip = (
        f"**The manipulation worked.** Chaos tasks took {f2(h2['ratio'])}× longer for the same people"
        + (", and abandonment was concentrated there." if quit_gap else ".")
        + " This confirms the scenario created a real gap between how the system performs and how it is advertised."
        if h2["reject"] else
        "**The manipulation check failed.** Chaos tasks were not reliably slower, which weakens every priming "
        "comparison: if the tasks weren't frustrating, there was no gap between experience and claim to bias."
    )
    lift = {k.split(" /")[0]: x["diff"] for k, x in h4["priming_lift_by_level"].items() if x["diff"] is not None}
    inter = h4.get("interaction")
    if inter and lift:
        top = max(lift, key=lift.get)
        seniority = (
            f"**Seniority (exploratory).** The priming lift was largest for {top} participants "
            f"({lift[top]:+.2f} points), and the arm × level interaction was {p_eq(inter['p'])}. "
            "The smaller job-level cells hold only a handful of people each, so this is a hypothesis for a larger "
            "follow-up, not a finding."
        )
    else:
        seniority = ("**Seniority (exploratory).** Too few participants reported a job level to estimate the "
                     "arm × level interaction.")
    v["interpretation"] = (
        f"{manip}\n\n**Priming.** {core}\n\n{seniority}\n\n"
        "**Practical significance.** Effect sizes and confidence intervals matter more than p-values here. "
        f"The chaos slowdown is {'large and precisely estimated' if h2['reject'] else 'not established'}; the priming "
        f"estimates (H1 r = {f2(h1['rank_biserial'])}, 95% CI {ci(h1['rank_biserial_ci'])}) should be read through "
        "their intervals."
    )
    floor_note = (f"self-reported efficiency was compressed near the floor ({floor:.0%} of Test 6 ratings were 1–2) "
                  "and noisy" if floor >= 0.5 else "self-reported efficiency was noisier")
    v["limitation_data"] = (
        "Every number in this version of the report comes from **simulated** participants generated by our own model "
        "(`lab/simulate.py`). They show that the pipeline works and what the analysis will report; they say nothing "
        "about real people. The final report must be regenerated from `data/raw/live_sessions.csv`."
        if simulated else
        "The data come from real participants, but from a small convenience sample."
    )
    v["conclusion"] = (
        f"{'In this simulated pilot' if simulated else 'In this experiment'}, broken workflows were "
        f"{'clearly slower' if h2['reject'] else 'not reliably slower'}"
        f"{' and more likely to be abandoned' if quit_gap else ''}, and {'the priming result is reported above with its uncertainty' if not h1['reject'] else 'a single efficiency claim measurably raised ratings of a broken task'}. "
        f"The broader lesson for anyone evaluating enterprise or AI tools is that **behavioural measures were "
        f"{'large and robust' if h2['reject'] else 'the clearer signal'}, while {floor_note}.** Decisions about "
        "workflow and AI tooling should not rest on post-launch satisfaction surveys alone."
    )
    return v


def render(template, values):
    missing = sorted(set(re.findall(r"{{(\w+)}}", template)) - set(values))
    if missing:
        raise KeyError(f"template placeholders without values: {missing}")
    return re.sub(r"{{(\w+)}}", lambda m: str(values[m.group(1)]), template)


def main():
    R = json.loads((ROOT / "results" / "results.json").read_text())
    text = render(TEMPLATE.read_text(), build_values(R))
    header = "<!-- GENERATED by scripts/build_report.py from report/report_template.md. Edit the template, not this file. -->\n\n"
    OUT.write_text(header + text)
    print(f"Wrote {OUT.relative_to(ROOT)} ({R['data_source']} data, n = {R['n_participants']})")


if __name__ == "__main__":
    main()
