"""Tests for the pre-registered cleaning rules in scripts/clean_data.py."""

import pandas as pd
import pytest

from clean_data import clean, participant_table
from lab.simulate import simulate_panel


@pytest.fixture
def raw():
    return simulate_panel(n=6, seed=1, id_prefix="T", source="simulated")


def test_clean_panel_passes_untouched(raw):
    df, log = clean(raw)
    assert df["participant_id"].nunique() == 6
    assert len(df) == 36
    assert log[-1]["participants_after"] == 6


def test_duplicates_keep_first(raw):
    dup = raw.iloc[[0]].assign(efficiency=10)
    df, _ = clean(pd.concat([raw, dup]))
    first = raw.iloc[0]
    kept = df[(df.participant_id == first.participant_id) & (df.test_num == first.test_num)]
    assert len(kept) == 1 and kept["efficiency"].item() == first["efficiency"]


def test_excluded_ids_removed(raw):
    df, _ = clean(raw, excluded_ids={"T-000"})
    assert "T-000" not in set(df["participant_id"])


def test_walkaway_participant_excluded(raw):
    raw.loc[(raw.participant_id == "T-001") & (raw.test_num == 6), "completion_time"] = 3600
    df, _ = clean(raw)
    assert "T-001" not in set(df["participant_id"])


def test_incomplete_participant_excluded(raw):
    df, _ = clean(raw[~((raw.participant_id == "T-002") & (raw.test_num == 6))])
    assert "T-002" not in set(df["participant_id"])


def test_impossible_rating_row_dropped_then_participant_incomplete(raw):
    raw.loc[(raw.participant_id == "T-003") & (raw.test_num == 1), "frustration"] = 11
    df, _ = clean(raw)
    assert "T-003" not in set(df["participant_id"])


def test_priming_exposure_rederived(raw):
    raw["priming_exposed"] = 1  # corrupt it
    df, _ = clean(raw)
    expected = df["primed_arm"] * df["workflow_chaos"]
    assert (df["priming_exposed"] == expected).all()


def test_bad_demographics_blanked_not_dropped(raw):
    raw.loc[raw.participant_id == "T-004", "job_level"] = "CEO of Everything"
    df, _ = clean(raw)
    rows = df[df.participant_id == "T-004"]
    assert len(rows) == 6 and rows["job_level"].isna().all()


def test_missing_column_raises(raw):
    with pytest.raises(ValueError):
        clean(raw.drop(columns=["efficiency"]))


def test_participant_table_one_row_each(raw):
    df, _ = clean(raw)
    pp = participant_table(df)
    assert len(pp) == 6
    assert set(pp["arm"]) <= {"Primed", "Control"}
    assert (pp["chaos_time_gm"] > 0).all() and (pp["baseline_time_gm"] > 0).all()
