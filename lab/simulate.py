"""Seeded synthetic participants in the site's schema (a Python port of
site/src/data/synthetic.js).

Built-in effects: AI tickets ~3x faster; the positive banner raises ServiceNow
ratings; the hallucination warning lowers AI ratings and makes people override the
agent more; seniors are the most suggestible; a Simpson's paradox between
experience and ratings. It is NOT a substitute for real participants.
"""

import numpy as np
import pandas as pd

from lab.design import AI, COLUMNS, FEEDBACK_COLUMNS, JOB_LEVELS, JOB_ROLES, LEGACY, TESTS


def simulate_panel(n=300, seed=42, id_prefix="BENCH", source="benchmark", session="benchmark"):
    """Return (submissions, feedback) dataframes for n simulated participants."""
    rng = np.random.default_rng(seed)
    L = JOB_LEVELS
    level_mean_years = {L[0]: 3.5, L[1]: 9.5, L[2]: 17.5}
    level_eff = {L[0]: -1.0, L[1]: 0.0, L[2]: 1.5}
    sus = {L[0]: 0.6, L[1]: 1.0, L[2]: 1.6}
    year_range = {L[0]: (0, 7), L[1]: (4, 15), L[2]: (10, 25)}
    base_time = {1: 105, 2: 115, 3: 120, 4: 28, 5: 32, 6: 36}
    time_sigma = {1: 0.45, 2: 0.45, 3: 0.45, 4: 0.3, 5: 0.3, 6: 0.3}
    base_frust = {1: 5.0, 2: 5.2, 3: 5.4, 4: 2.6, 5: 2.5, 6: 2.8}
    base_eff = {1: 4.1, 2: 3.9, 3: 3.8, 4: 7.4, 5: 7.6, 6: 7.2}
    base_err = {1: 1.0, 2: 1.1, 3: 1.2, 4: 0.1, 5: 0.1, 6: 0.1}

    rows, feedback = [], []
    for i in range(n):
        lvl = rng.choice(L, p=[0.5, 0.32, 0.18])
        yrs = int(rng.integers(year_range[lvl][0], year_range[lvl][1] + 1))
        role = rng.choice(JOB_ROLES, p=[0.35, 0.35, 0.2, 0.1])
        snow_p, ai_p = int(rng.random() < 0.5), int(rng.random() < 0.5)
        ai_first = rng.random() < 0.5
        order = [4, 5, 6, 1, 2, 3] if ai_first else [1, 2, 3, 4, 5, 6]
        speed = rng.lognormal(0, 0.18)
        pid = f"{id_prefix}-{i:03d}"
        eff_sum = {LEGACY: 0, AI: 0}
        ai_right = burned = 0
        for k, t in enumerate(order):
            meta = TESTS[t]
            is_ai = meta["workflow"] == AI
            primed = ai_p if is_ai else snow_p
            ct = base_time[t] * speed * (0.9 if k >= 3 else 1) * rng.lognormal(0, time_sigma[t]) * (1 - 0.006 * yrs)
            errors = int(rng.poisson(base_err[t]))
            ai_cat = ai_conf = ai_correct = injected = caught = None
            email = 0
            if is_ai:
                # The agent always fills in the right category; the AI team sometimes "corrects" it anyway.
                ai_cat = meta["category"]
                ai_conf = round(float(0.88 + rng.random() * 0.09), 2)
                ai_correct = int(not (ai_p and rng.random() < 0.12))
                if not ai_correct:
                    errors += 1
                    ct += 10 * rng.lognormal(0, 0.3)
                injected = int((not ai_p) and t == 6)
                if injected:
                    caught = int(rng.random() < 0.25)
                    if caught:
                        errors += 1
                        ct += 20 * rng.lognormal(0, 0.3)
                    else:
                        email = burned = 1
                ai_right += ai_correct
            logit = -4.6 + (-0.6 if is_ai else 0.6) - 0.05 * yrs
            quit_ = int(rng.random() < 1 / (1 + np.exp(-logit)))
            if quit_:
                ct *= 0.4 + 0.5 * rng.random()
            shift = primed * sus[lvl] * (-1.3 if is_ai else 1.0)
            frust = base_frust[t] + 0.003 * (ct - base_time[t]) + 1.5 * quit_ + 0.3 * errors - 0.5 * shift + 3 * email + rng.normal(0, 1)
            eff = (base_eff[t] + level_eff[lvl] - 0.1 * (yrs - level_mean_years[lvl]) + shift - quit_
                   - 2.5 * email + rng.normal(0, 1))
            eff_r = int(np.clip(round(eff), 1, 10))
            eff_sum[meta["workflow"]] += eff_r
            rows.append(dict(
                participant_id=pid, source=source, submitted_at=None, session_label=session,
                years_experience=yrs, job_level=lvl, job_role=role,
                snow_primed=snow_p, ai_primed=ai_p, set_order="ai_first" if ai_first else "legacy_first",
                test_num=t, position=k + 1, test_name=meta["name"], ticket_type=meta["type"], workflow=meta["workflow"], primed=primed,
                completion_time=round(float(ct), 1), error_count=errors, rage_quit=quit_,
                frustration=int(np.clip(round(frust), 1, 10)), efficiency=eff_r,
                ticket_text=None, chosen_category=None if quit_ else meta["category"],
                ai_category=ai_cat, ai_confidence=ai_conf, ai_correct=None if quit_ else ai_correct,
                ai_error_injected=injected, ai_error_caught=None if quit_ else caught,
            ))
        nps = int(np.clip(round(eff_sum[LEGACY] / 3 + snow_p * sus[lvl] * 0.8 + rng.normal(0, 1.8)), 0, 10))
        trust = int(np.clip(round(3 + 1.8 * ai_right - ai_p * sus[lvl] * 1.2 - 2.5 * burned + rng.normal(0, 1.2)), 1, 10))
        feedback.append(dict(participant_id=pid, session_label=session, snow_primed=snow_p, ai_primed=ai_p, job_level=lvl,
                             nps_servicenow=nps, ai_trust=trust, prefer_ai=int(0.35 * (eff_sum[AI] - eff_sum[LEGACY]) / 3 - 0.8 + rng.normal(0, 1) > 0), comment=None))
    return pd.DataFrame(rows, columns=COLUMNS), pd.DataFrame(feedback, columns=FEEDBACK_COLUMNS)
