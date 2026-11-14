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

from lab.design import AI, LEGACY  # noqa: E402

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
    sessions = pd.read_csv(ROOT / R["raw_file"])["session_label"].dropna().unique() if "session_label" in pd.read_csv(ROOT / R["raw_file"], nrows=0) else []
    v["session_label"] = ", ".join(map(str, sessions)) or "n/a"
    v["data_banner"] = (
        "> ⚠️ **These results come from a SIMULATED pilot dataset** (`data/raw/simulated_pilot_raw.csv`), generated to build and test the "
        "analysis pipeline before real participants were run. They are not empirical findings. After the live session, run "
        "`python scripts/export_supabase.py` and `python scripts/run_pipeline.py --raw data/raw/live_sessions.csv` to regenerate this report."
        if simulated else f"> Data: real participants from one live session, collected with the study site (`{R['raw_file']}`).")
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
             h3_decision="reject H₀. AI-agent tickets were faster, though each platform had different scenarios (section 9)." if h3["reject"] else "fail to reject H₀. The AI agent was not reliably faster.")
    v["fig_h3"] = fig("fig3_h3_paired_times.png", "Figure 4. Each line is one participant's typical ServiceNow vs AI-agent time.")
    tl = h4["ticket_level"]
    v.update(h4_mean_a=pct(h4["mean_a"]), h4_mean_b=pct(h4["mean_b"]), h4_n_a=h4["n_a"], h4_n_b=h4["n_b"], h4_U=f"{h4['mwu_U']:.0f}",
             h4_p_eq=p_eq(h4["mwu_p"]), h4_r=f2(h4["rank_biserial"]), h4_r_ci=ci(h4["rank_biserial_ci"]),
             h4_t_warned=pct(tl["override_rate_warned"]), h4_t_unwarned=pct(tl["override_rate_unwarned"]), h4_chi=f2(tl["chi2"]), h4_chi_p=p_eq(tl["chi2_p"]),
             h4_decision=(f"reject H₀. The AI team overrode the agent more often, even though its agent was always right. This rests on few overrides (ticket-level rates {pct(tl['override_rate_warned'])} vs {pct(tl['override_rate_unwarned'])}), the test is uncorrected and secondary, and the teams differ in more than the warning, so treat it as a lead for follow-up.") if h4["reject"] else
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
    lvl = [f"{k.split(' /')[0]}: praise {x['servicenow_banner_shift']:+.2f}, AI team {x['ai_warning_shift']:+.2f} (n = {x['n']})"
           for k, x in R["by_level"].items() if x["servicenow_banner_shift"] is not None and x["ai_warning_shift"] is not None]
    if lvl:
        lines.append("**By job level** (banner minus no-banner mean rating): " + "; ".join(lvl) + ". Levels with fewer than 5 people on either side of a split are not reported. Treat these as hypotheses for a follow-up.")
    v["explore_text"] = "\n\n".join(lines)
    v["fig_pp"] = fig("fig6_perception_performance.png", "Figure 6. Perception vs performance: each arrow runs from the no-banner group to the banner group on the same platform.")

    # Dropout, sensitivity, manipulation checks, planted error, platform ratings
    D = R["dropout"]
    ai_o, leg_o = D["by_order"]["ai_first"], D["by_order"]["legacy_first"]
    S = D["sensitivity"]
    share = lambda o: pct(o["excluded"] / o["started"]) if o["started"] else "n/a"
    v["dropout_text"] = (f"**Who left.** {D['started']} people started and {R['n_participants']} were analysable. {ai_o['excluded']} of {ai_o['started']} ({share(ai_o)}) who began with the AI set "
                         f"were excluded, against {leg_o['excluded']} of {leg_o['started']} ({share(leg_o)}) who began with ServiceNow (Fisher's exact {p_eq(D['fisher_p'])}). "
                         f"{D['ai_first_left_at_switch']} of the AI-first exclusions stopped right after the AI set or after one ServiceNow ticket. Set order itself split {ai_o['started']} to {leg_o['started']} among starters (binomial {p_eq(D['order_balance_p'])}), against an expected 50/50. These checks were added after seeing the data. "
                         "Because the plan keeps completers only, people who left over the ServiceNow experience may be missing from the comparison.")
    v["sensitivity_text"] = (f"**Sensitivity to dropout** (post hoc). Keeping everyone with at least one ticket on the platform, apart from walk-aways: H1 {f2(S['h1']['mean_a'])} (n = {S['h1']['n_a']}) vs {f2(S['h1']['mean_b'])} (n = {S['h1']['n_b']}), "
                             f"Holm {p_eq(S['h1']['p_holm'])}; H2 {f2(S['h2']['mean_a'])} (n = {S['h2']['n_a']}) vs {f2(S['h2']['mean_b'])} (n = {S['h2']['n_b']}), Holm {p_eq(S['h2']['p_holm'])}; "
                             f"H3 {S['h3']['speedup']:.1f}× faster across {S['h3']['n']} people with both platforms ({p_eq(S['h3']['p'])}).")
    mc = R["manipulation_checks"]
    v["mc_text"] = ("**Did people notice?** " + " ".join(
        f"For the {name}, {pct(mc[k]['pass_banner'])} of those shown it said they had seen it, and {pct(mc[k]['pass_none'])} of those not shown it correctly said they had not (n = {mc[k]['n']})."
        for k, name in [("mc_snow", "praise banner"), ("mc_ai", "AI warning")] if k in mc) +
        " All analyses keep participants as randomised, so a banner that went unnoticed weakens the test of its effect.") if mc else ""
    pe, PR = R["planted_error"], R["platform_ratings"]
    v["planted_text"] = (f"**The planted AI error.** {pe['caught']} of the {pe['rated']} participants whose agent filled in the wrong room and cart code caught it before submitting. "
                         "It appeared only for the other team, so this rate has no comparison group.") if pe["rated"] else ""
    eff_, fr_, ab_ = PR["efficiency"], PR["frustration"], PR["abandoned"]
    v["platform_text"] = (f"**Ratings by platform.** Within people, the AI agent was rated {eff_['mean_diff']:+.2f} points on efficiency (95% CI {ci(eff_['ci'])}, d_z = {f2(eff_['dz'])}, Wilcoxon {p_eq(eff_['wilcoxon_p'])}) "
                          f"and {fr_['mean_diff']:+.2f} on frustration (95% CI {ci(fr_['ci'])}, d_z = {f2(fr_['dz'])}, {p_eq(fr_['wilcoxon_p'])}). "
                          f"{ab_[LEGACY]['n']} of {ab_[LEGACY]['of']} ServiceNow tickets were abandoned, against {ab_[AI]['n']} of {ab_[AI]['of']} AI tickets. "
                          "Each platform always had the same scenarios, so these gaps cannot be separated from differences between the scenarios.")
    target = H["recruit_total"]
    v["achieved_power"] = (f"**Achieved sample.** {R['n_participants']} participants were analysable, against a target of {H['analysable_total']}" + (
        ", so the primary tests can reliably detect only effects larger than the planned d. The banner groups were also unequal. Results are treated as a pilot, and non-significant results are not evidence of no effect."
        if R["n_participants"] < H["analysable_total"] else ", which meets the plan.") + f" (Recruitment target: {target}.)")

    # Narrative
    def eff_sentence(h, which):
        return (f"{which} shifted ratings by {h['mean_diff']:+.2f} points (Holm {p_eq(h['p_holm'])}, r = {f2(h['rank_biserial'])})."
                if h["reject"] else f"{which} did not detectably shift ratings in the predicted direction (mean difference {h['mean_diff']:+.2f} points, Holm {p_eq(h['p_holm'])}).")
    h2_reversed = h2["mean_diff"] > 0
    any_banner = h1["reject"] or h2["reject"]
    reversal = (f" The AI team's ratings were higher, the opposite of the prediction (two-sided, unadjusted and post hoc: {p_eq(h2['mwu_p_two_sided'])}). "
                "That team also had an always-correct agent while the other team's agent made a planted error, so this gap cannot be credited to the warning, and the accuracy difference is a likely explanation."
                if h2_reversed else "")
    v["h2_decision"] += reversal
    v["abstract_h1"] = eff_sentence(h1, "the praise banner")
    v["abstract_h2"] = eff_sentence(h2, "The AI-team package (warning, displayed confidence, always-correct agent)")
    v["abstract_h1"] = v["abstract_h1"][0].lower() + v["abstract_h1"][1:]
    both = h1["reject"] and h2["reject"]
    v["abstract_close"] = ("Framing pushed perception against performance in both directions: a slower incumbent was rated up and a faster AI was rated down. "
                           "We discuss implications for how organisations evaluate and roll out AI." if both else
                           f"Participants also rated the AI agent {R['platform_ratings']['efficiency']['mean_diff']:+.2f} points on efficiency, but scenarios differed between platforms, and exclusions were uneven by which set came first. With fewer participants than planned, we treat this as a pilot.")
    v["h3_speedup"], v["h3_speedup_ci"] = f"{h3['speedup']:.1f}", f"{h3['speedup_ci'][0]:.1f}–{h3['speedup_ci'][1]:.1f}×"
    D_ = R["dropout"]["by_order"]
    D_sentence = (f"{D_['ai_first']['excluded']} of {D_['ai_first']['started']} AI-first starters were excluded, against {D_['legacy_first']['excluded']} of {D_['legacy_first']['started']} ServiceNow-first starters. "
                  "If people tended to leave when they reached ServiceNow, the platform gap above is more likely understated than overstated.")
    v["interpretation"] = "\n\n".join([
        f"**Performance.** {'The AI agent was clearly faster' if h3['reject'] else 'The AI agent was not reliably faster'} "
        f"({h3['speedup']:.1f}× per ticket, {pct(h3['share_faster_with_ai'])} of people faster with it). Participants also rated it more efficient and less frustrating, but the scenarios differ between platforms, so neither gap is purely about the tool.",
        f"**Perception.** {eff_sentence(h1, 'The praise banner')} {eff_sentence(h2, 'The AI-team package')}{reversal} "
        + ("The banners moved ratings in opposite directions while measured performance was identical across banner groups, which is the core of the perception–performance gap."
           if both else "A non-significant result in a sample this size does not show the absence of an effect."),
        f"**Behaviour.** {'The AI team overrode the agent more often, which is a lead for follow-up rather than a firm finding, because overrides were few and the teams differ in more than the warning.' if h4['reject'] else 'Override rates did not differ reliably between the teams.'}",
        f"**Selection.** {D_sentence}",
        f"**Practical significance.** The confidence intervals on the mean differences are {ci(h1['mean_diff_ci'])} (praise) and {ci(h2['mean_diff_ci'])} (AI team) points on a ten-point scale. "
        + ("Shifts of this size could matter to a vendor comparison or a pilot decision." if any_banner else
           "These are wide: this sample can neither confirm nor rule out a banner effect large enough to matter in a vendor comparison or pilot decision."),
    ])
    v["limitation_data"] = ("Every number in this version comes from **simulated** participants generated by our own model (`lab/simulate.py`). It shows the pipeline works and "
                            "what the report will say; it says nothing about real people. Regenerate the report from the live session export." if simulated else
                            "The data come from real participants in one teaching session: a small convenience sample.")
    v["conclusion"] = (f"{'In this simulated pilot' if simulated else 'In this experiment'}, the AI agent was {h3['speedup']:.1f}× faster, and "
                       + ("one sentence of framing raised ratings of the slower incumbent and lowered ratings of the faster AI. **User perception is an outcome you have to measure and manage, not a neutral readout of quality.**"
                          if both else ("framing moved at least one rating." if any_banner else
                          "this pilot did not show that one sentence of framing changes ratings, though it was too small to rule that out. **The main evidence here is about the tools, not the framing:** the AI-assisted flow was faster, rated better and rarely abandoned, subject to the scenario confound and uneven dropout."))
                       + " A properly powered follow-up should separate the warning, the displayed confidence and the agent's accuracy, and counterbalance scenarios across platforms (`docs/IRB_REVIEW.md`, section 6).")
    v["rec_framing"] = ("**Manage the narrative deliberately.** Messaging moved ratings here, so keep evaluation surveys free of marketing and pair honest risk communication with evidence of performance."
                        if any_banner else "**Test messaging rather than assuming its effect.** This pilot could not confirm or rule out framing effects, so keep evaluation surveys free of marketing and check messaging with a randomised comparison before relying on it.")
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
