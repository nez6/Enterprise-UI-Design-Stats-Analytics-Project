"""A-priori power analysis: how many participants do we need?

Software: statsmodels.stats.power (TTestIndPower, TTestPower) plus a Monte Carlo
check of the actual planned test (one-sided Mann-Whitney U) under the simulation
model in lab/simulate.py.

Assumptions (justified in the report, section 5):
* H1 (primary): primed vs control perceived efficiency on Test 6, between subjects.
  Smallest effect of interest d = 0.8 ("large", Cohen 1988), alpha = 0.05 one-sided,
  power = 0.80.
* H1 is tested with Mann-Whitney U (ratings are ordinal). Its asymptotic relative
  efficiency versus the t-test is never below 0.864 (Hodges & Lehmann 1956), so we
  divide the t-test n by 0.864 as a conservative correction.
* 10% attrition (dropouts, walk-aways, technical failures).
* H2 (secondary): chaos vs baseline completion time within subjects, paired
  d_z = 1.0, alpha = 0.05 one-sided, power = 0.80.

Outputs: results/power_analysis.json, results/figures/fig5_power_curve.png
Usage:   python scripts/power_analysis.py [--sims 400]
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

from lab.plotting import BLUE, INK2, MUTED, ORANGE, plt, save  # noqa: E402
from lab.simulate import simulate_panel  # noqa: E402

ALPHA, POWER = 0.05, 0.80
D_H1, DZ_H2 = 0.8, 1.0
ARE_MWU = 0.864
ATTRITION = 0.10


def monte_carlo_mwu(n_total, sims, seed=0):
    """Share of simulated studies of size n_total in which the planned H1 test rejects."""
    hits = 0
    for i in range(sims):
        t6 = simulate_panel(n=n_total, seed=seed + i, id_prefix="MC", source="mc").query("test_num == 6")
        primed, control = t6.loc[t6.primed_arm == 1, "efficiency"], t6.loc[t6.primed_arm == 0, "efficiency"]
        if len(primed) > 1 and len(control) > 1:
            hits += stats.mannwhitneyu(primed, control, alternative="greater").pvalue < ALPHA
    return hits / sims


def main(argv=None):
    ap = argparse.ArgumentParser(description="A-priori power analysis.")
    ap.add_argument("--sims", type=int, default=400, help="Monte Carlo replications")
    args = ap.parse_args(argv)

    ind = TTestIndPower()
    n_t = ind.solve_power(effect_size=D_H1, alpha=ALPHA, power=POWER, alternative="larger")
    n_mwu = math.ceil(n_t / ARE_MWU)
    analysable_total = 2 * n_mwu
    recruit_total = math.ceil(analysable_total / (1 - ATTRITION))
    recruit_total += recruit_total % 2  # even, so permuted blocks can balance the arms

    n_h2 = TTestPower().solve_power(effect_size=DZ_H2, alpha=ALPHA, power=POWER, alternative="larger")

    # Sensitivity: the smallest d detectable with 80% power at a range of group sizes.
    sens = {int(n): float(ind.solve_power(nobs1=n, alpha=ALPHA, power=POWER, alternative="larger"))
            for n in (10, 15, 20, 25, 30, 40, 50)}

    mc_power = monte_carlo_mwu(analysable_total, args.sims)

    # The Monte Carlo check is only as good as the simulation model, so we also report
    # the effect size that model implies (one very large simulated study) and the n it
    # would need. A gap between this and D_H1 is a warning, not something to tune away.
    big = simulate_panel(n=6000, seed=99, id_prefix="BIG", source="mc").query("test_num == 6")
    a, b = big.loc[big.primed_arm == 1, "efficiency"], big.loc[big.primed_arm == 0, "efficiency"]
    d_sim = float((a.mean() - b.mean()) / np.sqrt((a.var() + b.var()) / 2))
    n_sim = math.ceil(ind.solve_power(effect_size=d_sim, alpha=ALPHA, power=POWER, alternative="larger") / ARE_MWU)

    res = dict(
        alpha=ALPHA, target_power=POWER, attrition=ATTRITION,
        h1=dict(effect_size_d=D_H1, test="one-sided Mann-Whitney U", n_per_group_ttest=n_t,
                are_correction=ARE_MWU, n_per_group=n_mwu, analysable_total=analysable_total,
                recruit_total=recruit_total, monte_carlo_power=mc_power, monte_carlo_sims=args.sims,
                simulation_model_d=d_sim, n_per_group_for_simulation_d=n_sim),
        h2=dict(effect_size_dz=DZ_H2, test="one-sided Wilcoxon signed-rank", n_pairs_ttest=n_h2,
                n_pairs=math.ceil(n_h2 / ARE_MWU)),
        sensitivity_min_d_by_n_per_group=sens,
    )
    out = ROOT / "results"
    out.mkdir(exist_ok=True)
    (out / "power_analysis.json").write_text(json.dumps(res, indent=2))

    ns = np.arange(5, 61)
    fig, ax = plt.subplots(figsize=(7, 4))
    for d, color, lw, label in [(0.5, MUTED, 1.5, "d = 0.5 (medium)"),
                                (D_H1, BLUE, 2.5, f"d = {D_H1} (planning assumption)"),
                                (1.0, INK2, 1.5, "d = 1.0")]:
        ax.plot(ns, ind.power(d, ns, ALPHA, alternative="larger"), color=color, lw=lw, label=label,
                ls="-" if d == D_H1 else "--")
    ax.axhline(POWER, color=MUTED, lw=1, ls=":")
    ax.scatter([n_mwu], [ind.power(D_H1, n_mwu, ALPHA, alternative="larger")], s=60, color=ORANGE, zorder=5,
               edgecolor="white", linewidth=1.5, label=f"Planned: {n_mwu} per group")
    ax.set(xlabel="Participants per group", ylabel="Power (one-sided, α = 0.05)", ylim=(0, 1.02),
           title="H1 power curve (two-sample t approximation)")
    ax.legend(loc="lower right")
    save(fig, out / "figures" / "fig5_power_curve.png")

    print(f"H1: {n_t:.1f}/group for t-test -> {n_mwu}/group for MWU -> recruit {recruit_total} "
          f"(Monte Carlo power at {analysable_total}: {mc_power:.2f}; simulation-model d = {d_sim:.2f} "
          f"needs {n_sim}/group)")
    print(f"H2: {n_h2:.1f} pairs")


if __name__ == "__main__":
    main()
