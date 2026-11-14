"""A-priori power analysis: how many participants do we need?

Software: statsmodels.stats.power (TTestIndPower, TTestPower) plus a Monte Carlo check
of the planned tests under the simulation model in lab/simulate.py.

Assumptions (justified in the report, section 5):
* H1 and H2 are the two primary hypotheses (positive banner -> ServiceNow ratings up;
  hallucination warning -> AI ratings down). Each is a between-subjects comparison of
  per-person mean ratings, tested one-sided with Mann-Whitney U and Holm-corrected as
  a family of two, so we plan for the worst case alpha = 0.025 per test.
* Smallest effect of interest d = 0.8 (Cohen's "large"), power = 0.80.
* Because the two banners are independent coin flips, EVERY participant counts in
  both comparisons; one sample size serves both.
* Mann-Whitney's asymptotic relative efficiency vs the t-test is >= 0.864
  (Hodges & Lehmann 1956): divide the t-test n by 0.864.
* 10% attrition.
* H3 (AI faster, paired): d_z = 1.0, alpha = 0.05 one-sided.

Outputs: results/power_analysis.json, results/figures/fig5_power_curve.png
Usage:   python scripts/power_analysis.py [--sims 300]
"""

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy import stats
from statsmodels.stats.power import TTestIndPower, TTestPower

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from lab.design import AI, LEGACY  # noqa: E402
from lab.plotting import BLUE, INK2, MUTED, ORANGE, plt, save  # noqa: E402
from lab.simulate import simulate_panel  # noqa: E402

ALPHA_FAMILY, POWER, D_PLAN, DZ_H3 = 0.05, 0.80, 0.8, 1.0
ALPHA_EACH = ALPHA_FAMILY / 2          # Holm's first step for two primaries
ARE_MWU, ATTRITION = 0.864, 0.10


def person_means(sub, workflow):
    d = sub[sub["workflow"] == workflow]
    return d.groupby("participant_id").agg(m=("efficiency", "mean"), p=("primed", "first"))


def monte_carlo(n_total, sims, seed=0):
    """Share of simulated studies in which BOTH primary tests reject after Holm."""
    h1 = h2 = both = 0
    for i in range(sims):
        sub, _ = simulate_panel(n=n_total, seed=seed + i, id_prefix="MC", source="mc")
        sn, ai = person_means(sub, LEGACY), person_means(sub, AI)
        p1 = stats.mannwhitneyu(sn.loc[sn.p == 1, "m"], sn.loc[sn.p == 0, "m"], alternative="greater").pvalue
        p2 = stats.mannwhitneyu(ai.loc[ai.p == 1, "m"], ai.loc[ai.p == 0, "m"], alternative="less").pvalue
        lo, hi = sorted([p1, p2])
        r1, r2 = (p1 < ALPHA_EACH or (hi == p1 and lo < ALPHA_EACH and p1 < ALPHA_FAMILY)), (p2 < ALPHA_EACH or (hi == p2 and lo < ALPHA_EACH and p2 < ALPHA_FAMILY))
        h1 += r1; h2 += r2; both += r1 and r2
    return h1 / sims, h2 / sims, both / sims


def simulation_d(workflow):
    sub, _ = simulate_panel(n=6000, seed=99, id_prefix="BIG", source="mc")
    m = person_means(sub, workflow)
    a, b = m.loc[m.p == 1, "m"], m.loc[m.p == 0, "m"]
    return float((a.mean() - b.mean()) / np.sqrt((a.var() + b.var()) / 2))


def main(argv=None):
    ap = argparse.ArgumentParser(description="A-priori power analysis.")
    ap.add_argument("--sims", type=int, default=300, help="Monte Carlo replications")
    args = ap.parse_args(argv)

    ind = TTestIndPower()
    n_t = ind.solve_power(effect_size=D_PLAN, alpha=ALPHA_EACH, power=POWER, alternative="larger")
    n_mwu = math.ceil(n_t / ARE_MWU)
    analysable = 2 * n_mwu
    recruit = math.ceil(analysable / (1 - ATTRITION))
    recruit += recruit % 2
    n_h3 = TTestPower().solve_power(effect_size=DZ_H3, alpha=0.05, power=POWER, alternative="larger")
    sens = {int(n): float(ind.solve_power(nobs1=n, alpha=ALPHA_EACH, power=POWER, alternative="larger")) for n in (10, 15, 20, 25, 30, 40, 50)}
    mc1, mc2, mc_both = monte_carlo(analysable, args.sims)
    d_sn, d_ai = simulation_d(LEGACY), abs(simulation_d(AI))

    res = dict(
        alpha_family=ALPHA_FAMILY, alpha_each=ALPHA_EACH, target_power=POWER, attrition=ATTRITION,
        h1_h2=dict(effect_size_d=D_PLAN, test="one-sided Mann-Whitney U, Holm across H1/H2", n_per_group_ttest=n_t,
                   are_correction=ARE_MWU, n_per_group=n_mwu, analysable_total=analysable, recruit_total=recruit,
                   monte_carlo_sims=args.sims, monte_carlo_power_h1=mc1, monte_carlo_power_h2=mc2, monte_carlo_power_both=mc_both,
                   simulation_model_d_h1=d_sn, simulation_model_d_h2=d_ai),
        h3=dict(effect_size_dz=DZ_H3, test="one-sided Wilcoxon signed-rank", n_pairs_ttest=n_h3, n_pairs=math.ceil(n_h3 / ARE_MWU)),
        sensitivity_min_d_by_n_per_group=sens,
    )
    out = ROOT / "results"
    out.mkdir(exist_ok=True)
    (out / "power_analysis.json").write_text(json.dumps(res, indent=2))

    ns = np.arange(5, 71)
    fig, ax = plt.subplots(figsize=(7, 4))
    for d, color, lw, label in [(0.5, MUTED, 1.5, "d = 0.5 (medium)"), (D_PLAN, BLUE, 2.5, f"d = {D_PLAN} (planning assumption)"), (1.0, INK2, 1.5, "d = 1.0")]:
        ax.plot(ns, ind.power(d, ns, ALPHA_EACH, alternative="larger"), color=color, lw=lw, label=label, ls="-" if d == D_PLAN else "--")
    ax.axhline(POWER, color=MUTED, lw=1, ls=":")
    ax.scatter([n_mwu], [ind.power(D_PLAN, n_mwu, ALPHA_EACH, alternative="larger")], s=60, color=ORANGE, zorder=5,
               edgecolor="white", linewidth=1.5, label=f"Planned: {n_mwu} per group")
    ax.set(xlabel="Participants per banner group", ylabel="Power (one-sided, α = 0.025)", ylim=(0, 1.02),
           title="Power for each primary hypothesis (t approximation)")
    ax.legend(loc="lower right")
    save(fig, out / "figures" / "fig5_power_curve.png")
    print(f"H1/H2: {n_t:.1f}/group (t) -> {n_mwu}/group (MWU) -> recruit {recruit}. "
          f"MC power H1 {mc1:.2f}, H2 {mc2:.2f}, both {mc_both:.2f}; simulation d: H1 {d_sn:.2f}, H2 {d_ai:.2f}")


if __name__ == "__main__":
    main()
