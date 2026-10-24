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
