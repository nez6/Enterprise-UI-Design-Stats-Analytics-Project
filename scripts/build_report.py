"""Render report/REPORT.md from report/report_template.md and results/results.json.

Prose lives in the template: edit that, not REPORT.md. Every number, and every sentence
whose wording depends on a result (reject / fail to reject, the abstract, the
interpretation), is filled in here, so rerunning the pipeline on new data keeps the
report consistent with the analysis.

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


def pct(x):
    return f"{x:.0%}"


def ci(pair, fmt=f2):
    return f"[{fmt(pair[0])}, {fmt(pair[1])}]"


def fig(name, caption):
    return f"![{caption}](../results/figures/{name})\n\n*{caption}*"


def md_table(df):
    head = "| " + " | ".join(df.columns) + " |"
    sep = "|" + "|".join("---" for _ in df.columns) + "|"
    return "\n".join([head, sep, *["| " + " | ".join(str(v) for v in r) + " |" for r in df.itertuples(index=False)]])


def group_values(prefix, h):
    a = h["assumptions"]
    return {
        f"{prefix}_n_a": h["n_a"], f"{prefix}_n_b": h["n_b"], f"{prefix}_mean_a": f2(h["mean_a"]), f"{prefix}_mean_b": f2(h["mean_b"]),
        f"{prefix}_sd_a": f2(h["sd_a"]), f"{prefix}_sd_b": f2(h["sd_b"]), f"{prefix}_med_a": f"{h['median_a']:.2f}", f"{prefix}_med_b": f"{h['median_b']:.2f}",
        f"{prefix}_U": f"{h['mwu_U']:.0f}", f"{prefix}_p_eq": p_eq(h["mwu_p"]), f"{prefix}_r": f2(h["rank_biserial"]), f"{prefix}_r_ci": ci(h["rank_biserial_ci"]),
        f"{prefix}_d": f2(h["cohens_d"]), f"{prefix}_d_ci": ci(h["cohens_d_ci"]), f"{prefix}_md": f"{h['mean_diff']:+.2f}", f"{prefix}_md_ci": ci(h["mean_diff_ci"]),
        f"{prefix}_welch_t": f2(h["welch_t"]), f"{prefix}_welch_df": f"{h['welch_df']:.1f}", f"{prefix}_welch_p_eq": p_eq(h["welch_p"]),
        f"{prefix}_sh_a": p_num(a["shapiro_p_a"]), f"{prefix}_sh_b": p_num(a["shapiro_p_b"]), f"{prefix}_lev": p_num(a["levene_p"]),
    }


def build_values(R):
    h1, h2, h3, h4, P = R["h1"], R["h2"], R["h3"], R["h4"], R["power"]
    I, pref, survey = R["interaction"], R["preference"], R["survey"]
    simulated = R["data_source"] != "live"
    v = {"report_date": date.today().strftime("%B %d, %Y")}
    v["data_banner"] = (
        "> ⚠️ **These results come from a SIMULATED pilot dataset** (`data/raw/simulated_pilot_raw.csv`), generated to build and test the "
        "analysis pipeline before real participants were run. They are not empirical findings. After the live session, run "
        "`python scripts/export_supabase.py` and `python scripts/run_pipeline.py --raw data/raw/live_sessions.csv` to regenerate this report."
        if simulated else "> Data: real participant sessions collected with the study site (`data/raw/live_sessions.csv`).")
    v.update(n_participants=R["n_participants"], n_snow_banner=R["n_snow_banner"], n_ai_banner=R["n_ai_banner"],
             n_with_demo=R["n_with_demographics"], n_feedback=R["n_feedback"])

    # Power
    H = P["h1_h2"]
    v.update(p_d=H["effect_size_d"], p_alpha_each=P["alpha_each"], p_power=P["target_power"], p_n_t=f"{H['n_per_group_ttest']:.1f}",
             p_n_mwu=H["n_per_group"], p_analysable=H["analysable_total"], p_recruit=H["recruit_total"], p_attrition=pct(P["attrition"]),
             p_dz=P["h3"]["effect_size_dz"], p_h3=f"{P['h3']['n_pairs_ttest']:.1f}", p_mc_sims=H["monte_carlo_sims"],
             p_mc1=pct(H["monte_carlo_power_h1"]), p_mc2=pct(H["monte_carlo_power_h2"]), p_mc_both=pct(H["monte_carlo_power_both"]),
             p_dsim1=f2(H["simulation_model_d_h1"]), p_dsim2=f2(H["simulation_model_d_h2"]))
    v["sensitivity_table"] = md_table(pd.DataFrame([[n, f2(d)] for n, d in P["sensitivity_min_d_by_n_per_group"].items()],
                                                   columns=["Participants per banner group", "Minimum detectable d"]))
    v["fig_power"] = fig("fig5_power_curve.png", "Figure 1. Power for each primary hypothesis by group size.")

    # Cleaning and randomisation
    v["cleaning_table"] = md_table(pd.DataFrame([[s["rule"], f"{s['rows_before']} → {s['rows_after']}", f"{s['participants_before']} → {s['participants_after']}",
                                                  s["note"] or "–"] for s in R["cleaning"]], columns=["Step", "Rows", "Participants", "Note"]))
    rc = R["randomisation"]
    v["cells"] = "; ".join(f"{k.replace('servicenow_banner', 'praise').replace('ai_banner', 'warning')}: {n}" for k, n in rc["cells"].items())
    parts, flags = [], []
    for key, name in [("servicenow_banner", "praise banner"), ("ai_banner", "warning banner")]:
        r = rc[key]
        parts.append(f"For the {name}, median years of experience were {r['years_median_banner']:g} vs {r['years_median_none']:g} "
                     f"(Mann–Whitney {p_eq(r['years_p'])}), job level {p_eq(r['job_level_p'])} (χ²), set order {p_eq(r['set_order_p'])} (χ²).")
        flags += [r["years_p"], r["job_level_p"], r["set_order_p"]]
    min_exp = min(rc["servicenow_banner"]["job_level_min_expected"], rc["ai_banner"]["job_level_min_expected"])
    v["rand_text"] = " ".join(parts) + (f" Some expected counts are below 5 (minimum {min_exp:.1f}), so the χ² checks are approximate." if min_exp < 5 else "") + (
        " No check suggests the groups differ at baseline." if min(flags) > 0.05 else " At least one check suggests an imbalance; treat that comparison with extra caution.")

    # Descriptives
    d = pd.DataFrame(R["descriptives"])
    v["desc_table"] = md_table(pd.DataFrame({"Ticket": d["ticket"], "n": d["n"], "Mean (s)": d["time_mean"].round(1), "Median (s)": d["time_median"].round(1),
                                             "SD": d["time_sd"].round(1), "IQR": d["time_iqr"].round(1), "Skew": d["time_skew"].round(2),
                                             "Efficiency": d["efficiency_mean"].round(2), "Abandoned": (d["rage_quit_rate"] * 100).round(0).astype(int).astype(str) + "%"}))
    worst = d.loc[d["time_skew"].idxmax()]
    v["desc_note"] = (f"Every ticket's completion time is right-skewed. The most extreme is **{worst['ticket']}** (skew {worst['time_skew']:.1f}, mean {worst['time_mean']:.0f} s vs "
                      f"median {worst['time_median']:.0f} s), so medians, geometric means and rank-based tests describe the typical participant better than arithmetic means.")
    v["fig_times"] = fig("fig2_completion_times.png", "Figure 2. Completion time by ticket (log scale). Diamonds are means; blue lines are medians.")

    # H1-H4
    v.update(group_values("h1", h1))
    v.update(group_values("h2", h2))
    v["h1_p_holm"], v["h2_p_holm"] = p_num(h1["p_holm"]), p_num(h2["p_holm"])
    v["h1_decision"] = (f"reject H₀. Participants who saw the praise banner rated ServiceNow higher (r = {f2(h1['rank_biserial'])}, mean difference {h1['mean_diff']:+.2f} points)."
                        if h1["reject"] else f"fail to reject H₀ after Holm correction. The data are compatible with effects from r = {f2(h1['rank_biserial_ci'][0])} to {f2(h1['rank_biserial_ci'][1])}.")
    v["h2_decision"] = (f"reject H₀. Participants who saw the hallucination warning rated the AI agent lower (r = {f2(h2['rank_biserial'])}, mean difference {h2['mean_diff']:+.2f} points)."
                        if h2["reject"] else f"fail to reject H₀ after Holm correction. The data are compatible with effects from r = {f2(h2['rank_biserial_ci'][0])} to {f2(h2['rank_biserial_ci'][1])}.")
    v["fig_h1h2"] = fig("fig1_h1_h2_ratings.png", "Figure 3. Per-person mean efficiency ratings by banner. Each dot is one participant.")
    v.update(h3_sh=p_num(h3["shapiro_p_log_diff"]), h3_sn=f"{h3['sn_median']:.0f}", h3_ai=f"{h3['ai_median']:.0f}", h3_share=pct(h3["share_faster_with_ai"]),
             h3_W=f"{h3['wilcoxon_W']:.0f}", h3_p_eq=p_eq(h3["wilcoxon_p"]), h3_speedup=f"{h3['speedup']:.1f}",
             h3_speedup_ci=f"{h3['speedup_ci'][0]:.1f}–{h3['speedup_ci'][1]:.1f}×", h3_dz=f2(h3["dz"]), h3_rmp=f2(h3["matched_rank_biserial"]),
             h3_decision="reject H₀. The AI agent was genuinely faster." if h3["reject"] else "fail to reject H₀. The AI agent was not reliably faster.")
    v["fig_h3"] = fig("fig3_h3_paired_times.png", "Figure 4. Each line is one participant's typical ServiceNow vs AI-agent time.")
    tl = h4["ticket_level"]
    v.update(h4_mean_a=pct(h4["mean_a"]), h4_mean_b=pct(h4["mean_b"]), h4_n_a=h4["n_a"], h4_n_b=h4["n_b"], h4_U=f"{h4['mwu_U']:.0f}",
             h4_p_eq=p_eq(h4["mwu_p"]), h4_r=f2(h4["rank_biserial"]), h4_r_ci=ci(h4["rank_biserial_ci"]),
             h4_t_warned=pct(tl["override_rate_warned"]), h4_t_unwarned=pct(tl["override_rate_unwarned"]), h4_chi=f2(tl["chi2"]), h4_chi_p=p_eq(tl["chi2_p"]),
             h4_decision="reject H₀. Warned participants overrode the AI more often." if h4["reject"] else
             "fail to reject H₀. The difference in override rates could be chance at this sample size.")

    # Interaction
    mx, an = I.get("mixed", {}), I["anova"]
    v.update(int_formula=mx.get("formula", "n/a"), int_coef=f"{mx['interaction_coef']:+.2f}" if "interaction_coef" in mx else "n/a",
             int_p=p_eq(mx["interaction_p"]) if "interaction_p" in mx else "model did not fit", tukey_sig=I["tukey_significant"], tukey_n=I["tukey_pairs"])
    for key, tag in [("platform", "pl"), ("banner", "bn"), ("interaction", "in")]:
        r = an[key]
        v.update({f"a_{tag}_F": f2(r["F"]), f"a_{tag}_df": f"{r['df']:.0f}", f"a_{tag}_p": p_num(r["p"]), f"a_{tag}_eta": f2(r["partial_eta_sq"])})
    v["fig_int"] = fig("fig4_interaction.png", "Figure 5. Mean efficiency by platform and banner (per-person means, ±95% CI).")

    # Exploratory text
    lines = []
    if "terms" in pref:
        t = pref["terms"]
        lines.append(f"**Choosing the AI next time.** {pct(pref['share_prefer_ai'])} would rather use the AI agent. Logistic regression "
                     f"`prefer_ai ~ speed-up + warned + praised` (n = {pref['n']}, McFadden pseudo-R² = {f2(pref['pseudo_r2'])}):\n\n"
                     "| Predictor | Odds ratio | 95% CI | p |\n|---|---|---|---|\n" +
                     "\n".join(f"| {k} | {f2(x['odds_ratio'])} | {ci(x['or_ci'])} | {p_num(x['p'])} |" for k, x in t.items()))
    else:
        lines.append(f"**Choosing the AI next time.** The logistic model could not be fitted reliably ({pref.get('error')}).")
    if "nps" in survey:
        s = survey["nps"]
        lines.append(f"**ServiceNow NPS.** {s['nps_banner']:.0f} with the praise banner vs {s['nps_none']:.0f} without (Mann–Whitney on the 0–10 scores, one-sided {p_eq(s['mwu_p'])}).")
    if "trust" in survey:
        s = survey["trust"]
        lines.append(f"**Trust in the AI agent.** Mean {s['mean_warned']:.2f} when warned vs {s['mean_unwarned']:.2f} unwarned (one-sided {p_eq(s['mwu_p'])}).")
    lvl = [f"{k.split(' /')[0]}: praise {x['servicenow_banner_shift']:+.2f}, warning {x['ai_warning_shift']:+.2f} (n = {x['n']})"
           for k, x in R["by_level"].items() if x["servicenow_banner_shift"] is not None and x["ai_warning_shift"] is not None]
    if lvl:
        lines.append("**By job level** (banner minus no-banner mean rating): " + "; ".join(lvl) + ". Cells are small, so treat these as hypotheses for a follow-up.")
    v["explore_text"] = "\n\n".join(lines)
    v["fig_pp"] = fig("fig6_perception_performance.png", "Figure 6. Perception vs performance: each arrow is what a banner did to the same system.")

    # Narrative
    def eff_sentence(h, which):
        return (f"{which} shifted ratings by {h['mean_diff']:+.2f} points (Holm {p_eq(h['p_holm'])}, r = {f2(h['rank_biserial'])})."
                if h["reject"] else f"{which} did not detectably shift ratings (Holm {p_eq(h['p_holm'])}).")
    v["abstract_h1"] = eff_sentence(h1, "the praise banner")
    v["abstract_h2"] = eff_sentence(h2, "The hallucination warning")
    v["abstract_h1"] = v["abstract_h1"][0].lower() + v["abstract_h1"][1:]
    both = h1["reject"] and h2["reject"]
    v["abstract_close"] = ("Framing pushed perception against performance in both directions: a slower incumbent was rated up and a faster AI was rated down. "
                           "We discuss implications for how organisations evaluate and roll out AI." if both else
                           "We discuss what the pattern means for how organisations evaluate legacy platforms and AI tools.")
    v["h3_speedup"], v["h3_speedup_ci"] = f"{h3['speedup']:.1f}", f"{h3['speedup_ci'][0]:.1f}–{h3['speedup_ci'][1]:.1f}×"
    v["interpretation"] = "\n\n".join([
        f"**Performance.** {'The AI agent was clearly faster' if h3['reject'] else 'The AI agent was not reliably faster'} "
        f"({h3['speedup']:.1f}× per ticket, {pct(h3['share_faster_with_ai'])} of people faster with it). Whatever the ratings say, the stopwatch favours the AI.",
        f"**Perception.** {eff_sentence(h1, 'The praise banner')} {eff_sentence(h2, 'The hallucination warning')} "
        + ("The banners moved ratings in opposite directions while measured performance was identical across banner groups, which is the core of the perception–performance gap."
           if both else "Where an effect was not detected, the confidence interval shows how large an effect remains plausible."),
        f"**Behaviour.** {'Warned participants also overrode the AI more often, so framing changed what people did, not just what they said.' if h4['reject'] else 'Override rates did not differ reliably, so the warning changed ratings more clearly than it changed behaviour at this sample size.'}",
        f"**Practical significance.** Mean shifts of {abs(h1['mean_diff']):.1f} (praise) and {abs(h2['mean_diff']):.1f} (warning) points on a ten-point scale, "
        "from a single sentence each, are the size of difference that can flip a vendor comparison or a pilot go/no-go decision.",
    ])
    v["limitation_data"] = ("Every number in this version comes from **simulated** participants generated by our own model (`lab/simulate.py`). It shows the pipeline works and "
                            "what the report will say; it says nothing about real people. Regenerate the report from the live session export." if simulated else
                            "The data come from real participants in one teaching session: a small convenience sample.")
    v["t3_floor"] = pct(R["t3_floor_share"])
    v["conclusion"] = (f"{'In this simulated pilot' if simulated else 'In this experiment'}, the AI agent was {h3['speedup']:.1f}× faster, yet one sentence of framing "
                       f"{'raised ratings of the slower incumbent and lowered ratings of the faster AI' if both else 'was enough to move at least some ratings'}. "
                       "For anyone leading AI adoption, the lesson is that **user perception is an outcome you have to measure and manage, not a neutral readout of quality.** "
                       "Pair every survey with behavioural metrics, run rollouts as randomised experiments, and communicate AI risks with evidence rather than slogans.")
    return v


def render(template, values):
    missing = sorted(set(re.findall(r"{{(\w+)}}", template)) - set(values))
    if missing:
        raise KeyError(f"template placeholders without values: {missing}")
    return re.sub(r"{{(\w+)}}", lambda m: str(values[m.group(1)]), template)


def main():
    R = json.loads((ROOT / "results" / "results.json").read_text())
    text = render(TEMPLATE.read_text(), build_values(R))
    OUT.write_text("<!-- GENERATED by scripts/build_report.py from report/report_template.md. Edit the template, not this file. -->\n\n" + text)
    print(f"Wrote {OUT.relative_to(ROOT)} ({R['data_source']} data, n = {R['n_participants']})")


if __name__ == "__main__":
    main()
