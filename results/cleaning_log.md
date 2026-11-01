# Cleaning log

Raw file: `data/raw/simulated_pilot_raw.csv` · data source: **simulated**

| Rule | Rows before → after | Participants before → after | Note |
|---|---|---|---|
| Raw data loaded | 329 → 329 | 55 → 55 |  |
| Excluded ids removed (dry runs / withdrawals) | 329 → 323 | 55 → 54 |  |
| Double-submitted rows removed | 323 → 320 | 54 → 54 |  |
| Rows with impossible values removed | 320 → 320 | 54 → 54 |  |
| Demographics validated (blanked, not dropped) | 320 → 320 | 54 → 54 | 4 participant(s) have at least one missing/blank demographic |
| Participants with inconsistent arm removed | 320 → 320 | 54 → 54 |  |
| Walk-aways removed (any test > 30 min) | 320 → 314 | 54 → 53 |  |
| Incomplete participants removed (< 6 tests) | 314 → 306 | 53 → 51 |  |
