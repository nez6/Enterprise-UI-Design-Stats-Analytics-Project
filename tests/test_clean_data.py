"""Tests for the pre-registered cleaning rules in scripts/clean_data.py."""

import pandas as pd
import pytest

from clean_data import clean, clean_feedback, participant_table
from lab.simulate import simulate_panel


@pytest.fixture
def raw():
    sub, _ = simulate_panel(n=6, seed=1, id_prefix="T", source="simulated")
    return sub


def test_clean_panel_passes_untouched(raw):
    df, log = clean(raw)
    assert df["participant_id"].nunique() == 6 and len(df) == 36
    assert log[-1]["participants_after"] == 6


def test_duplicates_keep_first(raw):
    first = raw.iloc[0]
    df, _ = clean(pd.concat([raw, raw.iloc[[0]].assign(efficiency=10)]))
    kept = df[(df.participant_id == first.participant_id) & (df.test_num == first.test_num)]
    assert len(kept) == 1 and kept["efficiency"].item() == first["efficiency"]


def test_excluded_ids_removed(raw):
    df, _ = clean(raw, excluded_ids={"T-000"})
    assert "T-000" not in set(df["participant_id"])


def test_walkaway_participant_excluded(raw):
    raw.loc[(raw.participant_id == "T-001") & (raw.test_num == 3), "completion_time"] = 3600
    df, _ = clean(raw)
    assert "T-001" not in set(df["participant_id"])


def test_incomplete_participant_excluded(raw):
    df, _ = clean(raw[~((raw.participant_id == "T-002") & (raw.test_num == 6))])
    assert "T-002" not in set(df["participant_id"])


def test_impossible_rating_row_dropped_then_participant_incomplete(raw):
    raw.loc[(raw.participant_id == "T-003") & (raw.test_num == 1), "frustration"] = 11
    df, _ = clean(raw)
    assert "T-003" not in set(df["participant_id"])


def test_banner_exposure_rederived(raw):
    raw["primed"] = 1  # corrupt it
    df, _ = clean(raw)
    expected = df.apply(lambda r: r.ai_primed if r.workflow == "AI Agent" else r.snow_primed, axis=1)
    assert (df["primed"] == expected).all()


def test_inconsistent_banner_assignment_dropped(raw):
    idx = raw.index[(raw.participant_id == "T-004")][0]
    raw.loc[idx, "ai_primed"] = 1 - raw.loc[idx, "ai_primed"]
    df, _ = clean(raw)
    assert "T-004" not in set(df["participant_id"])


def test_bad_demographics_blanked_not_dropped(raw):
    raw.loc[raw.participant_id == "T-005", "job_level"] = "CEO of Everything"
    df, _ = clean(raw)
    rows = df[df.participant_id == "T-005"]
    assert len(rows) == 6 and rows["job_level"].isna().all()


def test_missing_column_raises(raw):
    with pytest.raises(ValueError):
        clean(raw.drop(columns=["efficiency"]))


def test_participant_table_and_feedback_merge():
    sub, fb = simulate_panel(n=8, seed=2, id_prefix="F", source="simulated")
    df, _ = clean(sub)
    fbc = clean_feedback(pd.concat([fb, fb.iloc[[0]]]), set(df.participant_id))
    pp = participant_table(df, fbc)
    assert len(pp) == 8 and len(fbc) == 8
    assert {"sn_eff", "ai_eff", "sn_time_gm", "ai_time_gm", "override_rate", "prefer_ai"} <= set(pp.columns)
    assert (pp["ai_time_gm"] > 0).all() and pp["set_order"].isin(["legacy_first", "ai_first"]).all()
