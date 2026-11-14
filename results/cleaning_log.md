# Cleaning log

Raw file: `data/raw/live_sessions_deidentified.csv` · data source: **live** · final-survey responses kept: 29

| Rule | Rows before → after | Participants before → after | Note |
|---|---|---|---|
| Raw data loaded | 223 → 223 | 46 → 46 |  |
| Excluded ids removed (dry runs / withdrawals) | 223 → 223 | 46 → 46 |  |
| Double-submitted rows removed | 223 → 223 | 46 → 46 |  |
| Rows with impossible values removed | 223 → 223 | 46 → 46 |  |
| Demographics validated (blanked, not dropped) | 223 → 223 | 46 → 46 | 13 participant(s) have at least one missing/blank demographic |
| Participants with inconsistent banner assignment removed | 223 → 223 | 46 → 46 |  |
| Walk-aways removed (any ticket > 30 min) | 223 → 213 | 46 → 44 |  |
| Incomplete participants removed (< 6 tickets) | 213 → 180 | 44 → 30 |  |
