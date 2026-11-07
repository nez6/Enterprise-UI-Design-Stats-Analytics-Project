"""Sanity checks for the effect-size helpers in scripts/analyze.py."""

import numpy as np

from analyze import cohens_d, rank_biserial


def test_rank_biserial_extremes():
    assert rank_biserial([5, 6, 7], [1, 2, 3]) == 1.0
    assert rank_biserial([1, 2, 3], [5, 6, 7]) == -1.0
    assert rank_biserial([1, 2, 3], [1, 2, 3]) == 0.0


def test_rank_biserial_matches_mann_whitney():
    from scipy import stats
    rng = np.random.default_rng(0)
    x, y = rng.normal(0.5, 1, 30), rng.normal(0, 1, 25)
    u = stats.mannwhitneyu(x, y).statistic
    assert np.isclose(rank_biserial(x, y), 2 * u / (len(x) * len(y)) - 1)


def test_cohens_d_known_value():
    d, (lo, hi) = cohens_d(np.array([2.0, 4.0, 6.0]), np.array([0.0, 2.0, 4.0]))
    assert np.isclose(d, 1.0) and lo < d < hi


def test_dropout_counts_exclusions_by_first_set():
    import pandas as pd
    from scripts.analyze import dropout

    def tickets(pid, nums, order, secs=60.0):
        return [dict(participant_id=pid, test_num=n, set_order=order, completion_time=secs, efficiency=5,
                     workflow="ServiceNow" if n <= 3 else "AI Agent", snow_primed=int(pid[-1]) % 2, ai_primed=int(pid[-1]) % 2) for n in nums]
    rows = []
    for i in range(4):
        rows += tickets(f"K{i}", range(1, 7), "legacy_first")
        rows += tickets(f"A{i}", range(1, 7), "ai_first")
    rows += tickets("S1", [4, 5, 6], "ai_first") + tickets("W1", range(1, 7), "ai_first", secs=4000.0)
    out = dropout(pd.DataFrame(rows))
    assert out["by_order"]["ai_first"] == dict(started=6, excluded=2)
    assert out["by_order"]["legacy_first"] == dict(started=4, excluded=0)
    assert out["ai_first_left_at_switch"] == 1
    assert out["sensitivity"]["h3"]["n"] == 8  # walk-aways out; S1 has only one platform
