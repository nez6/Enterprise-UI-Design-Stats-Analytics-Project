# Cleaning log

Raw file: `data/raw/simulated_pilot_raw.csv` · data source: **simulated** · final-survey responses kept: 65

| Rule | Rows before → after | Participants before → after | Note |
|---|---|---|---|
| Raw data loaded | 411 → 411 | 69 → 69 |  |
| Excluded ids removed (dry runs / withdrawals) | 411 → 405 | 69 → 68 |  |
| Double-submitted rows removed | 405 → 402 | 68 → 68 |  |
| Rows with impossible values removed | 402 → 402 | 68 → 68 |  |
| Demographics validated (blanked, not dropped) | 402 → 402 | 68 → 68 | 4 participant(s) have at least one missing/blank demographic |
| Participants with inconsistent banner assignment removed | 402 → 402 | 68 → 68 |  |
| Walk-aways removed (any ticket > 30 min) | 402 → 396 | 68 → 67 |  |
| Incomplete participants removed (< 6 tickets) | 396 → 390 | 67 → 65 |  |
