"""Seeded synthetic participants for the benchmark dataset and the simulated pilot.

The data-generating process is deliberately built to contain the effects the
course teaches (right-skewed chaos times, priming that hits executives hardest,
a logistic rage-quit process and a Simpson's paradox), so every analysis has
something real to find. It is NOT a substitute for collecting real participants.
"""

import numpy as np
import pandas as pd

from lab.design import COLUMNS, JOB_LEVELS, JOB_ROLES, LEGACY, TESTS


def simulate_panel(n=300, seed=42, id_prefix="BENCH", source="benchmark"):
    """Return n participants x 6 tests in the same raw schema the app writes."""
    np.random.seed(seed)

    # --- Participant-level attributes ------------------------------------
    # Seniority is a pyramid, and years of experience are drawn from a band that
    # overlaps neighbouring levels. That overlap is what lets the Simpson's
    # paradox appear: experience and seniority are correlated but not identical.
    levels = np.random.choice(JOB_LEVELS, n, p=[0.50, 0.32, 0.18])
    year_ranges = {JOB_LEVELS[0]: (0, 7), JOB_LEVELS[1]: (4, 15), JOB_LEVELS[2]: (10, 25)}
    years = np.array([np.random.randint(year_ranges[l][0], year_ranges[l][1] + 1) for l in levels])
    roles = np.random.choice(JOB_ROLES, n, p=[0.35, 0.35, 0.20, 0.10])
    primed_arm = np.random.binomial(1, 0.5, n)  # 50/50 randomisation, as in the live app
    speed = np.random.lognormal(0, 0.18, n)     # some people are just faster at every task

    # --- Effect-size knobs --------------------------------------------------
    # level_eff_offset: seniors rate the system higher overall (the between-group
    #   trend), while efficiency falls with years *within* a level (-0.12/yr below).
    #   Together they produce the Simpson's paradox shown in Tab 5.
    # prime_susceptibility: how far the banner moves frustration and efficiency.
    #   Executives are the most suggestible, which drives Tab 4's job-level plot.
    # base_time / time_sigma: chaos tests have a higher median and a much larger
    #   lognormal sigma, which creates the long right tail Tab 2 is about.
    level_mean_years = {JOB_LEVELS[0]: 3.5, JOB_LEVELS[1]: 9.5, JOB_LEVELS[2]: 17.5}
    level_eff_offset = {JOB_LEVELS[0]: -1.3, JOB_LEVELS[1]: 0.0, JOB_LEVELS[2]: 1.9}
    prime_susceptibility = {JOB_LEVELS[0]: 0.3, JOB_LEVELS[1]: 1.0, JOB_LEVELS[2]: 2.4}
    base_time = {1: 45, 2: 60, 3: 50, 4: 55, 5: 150, 6: 240}
    time_sigma = {1: 0.25, 2: 0.25, 3: 0.25, 4: 0.25, 5: 0.6, 6: 0.7}
    base_frust = {1: 3.0, 2: 3.2, 3: 2.6, 4: 2.7, 5: 6.8, 6: 7.2}
    base_eff = {1: 6.4, 2: 6.2, 3: 7.2, 4: 7.0, 5: 3.0, 6: 2.7}
    base_errors = {1: 0.2, 2: 0.3, 3: 0.15, 4: 0.15, 5: 2.5, 6: 3.0}

    rows = []
    for i in range(n):
        lvl, yrs = levels[i], years[i]
        for t, meta in TESTS.items():
            chaos = meta["chaos"]
            legacy = meta["workflow"] == LEGACY
            primed = int(primed_arm[i] and chaos)
            # The banner names the legacy system, so it lands harder on Test 6.
            prime_weight = 1.0 if legacy else 0.5

            ct = base_time[t] * speed[i] * np.random.lognormal(0, time_sigma[t])
            ct *= 1 - 0.008 * yrs if not chaos else 1.0
            if t == 6 and lvl == JOB_LEVELS[2]:
                ct *= 1.25  # executives are least practiced at hunting through KB articles

            # Rage-quit follows a true logistic model, so Tab 5's regression can
            # recover these coefficients: chaos raises the odds steeply, experience
            # lowers them, and priming lowers them slightly (people persist when
            # told the system is efficient). Baseline quit rate is about 1%.
            logit = -4.2 + 3.0 * chaos + 0.5 * (t == 6) - 0.06 * yrs - 0.5 * primed
            rage_quit = int(np.random.rand() < 1 / (1 + np.exp(-logit)))
            if rage_quit:
                ct *= np.random.uniform(0.4, 0.9)  # quitters stop the clock early

            # Survey ratings are latent continuous scores, rounded and clipped to 1-10
            # to match the slider scale participants actually use.

            errors = np.random.poisson(base_errors[t])
            frust = (
                base_frust[t]
                + 0.004 * (ct - base_time[t])
                + 1.5 * rage_quit
                + 0.25 * errors
                - primed * prime_susceptibility[lvl] * prime_weight
                + np.random.normal(0, 1.0)
            )
            eff = (
                base_eff[t]
                + level_eff_offset[lvl]
                - 0.12 * (yrs - level_mean_years[lvl])
                + primed * prime_susceptibility[lvl] * 1.2 * prime_weight
                - 1.0 * rage_quit
                + np.random.normal(0, 1.0)
            )
            rows.append(dict(
                participant_id=f"{id_prefix}-{i:03d}",
                source=source,
                submitted_at=None,
                years_experience=int(yrs),
                job_level=lvl,
                job_role=roles[i],
                primed_arm=int(primed_arm[i]),
                test_num=t,
                test_name=meta["name"],
                workflow=meta["workflow"],
                workflow_chaos=chaos,
                priming_exposed=primed,
                completion_time=round(float(ct), 1),
                error_count=int(errors),
                rage_quit=rage_quit,
                frustration=int(np.clip(round(frust), 1, 10)),
                efficiency=int(np.clip(round(eff), 1, 10)),
            ))
    return pd.DataFrame(rows, columns=COLUMNS)
