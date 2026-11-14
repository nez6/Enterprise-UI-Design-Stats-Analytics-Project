"""Derived columns shared by the app and the analysis scripts."""

import numpy as np
import pandas as pd

from legacy_lab.design import TESTS


def enrich(df):
    """Add the human-readable labels and buckets the charts and models use."""
    df = df.copy()
    df["years_experience"] = pd.to_numeric(df["years_experience"], errors="coerce")
    df["priming"] = np.where(df["priming_exposed"] == 1, "Primed", "Unprimed")
    df["phase"] = np.where(df["workflow_chaos"] == 1, "Chaos (Tests 5–6)", "Baseline (Tests 1–4)")
    df["test_label"] = df["test_num"].map(lambda t: TESTS[t]["short"])
    df["completion_min"] = df["completion_time"] / 60
    df["exp_bucket"] = pd.cut(
        df["years_experience"], [-0.1, 3, 9, 15, 100],
        labels=["0–3 yrs", "4–9 yrs", "10–15 yrs", "16+ yrs"],
    )
    return df
