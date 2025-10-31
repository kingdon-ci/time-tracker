# Time‑Tracking Statistics Plan

## Business Value
- **Visibility into productivity** – Quantifies how many hours are worked each week relative to the contractual 40‑hour target.
- **Data‑driven compensation** – Provides the numbers needed for the existing *comp‑time* package and for any future payroll reconciliation.
- **Trend analysis** – Moving‑average and month‑by‑month summaries highlight whether the team is consistently ahead, behind, or on‑track, enabling proactive workload adjustments.
- **Self‑service reporting** – With a single `make stats` command developers can generate a notebook with plots, reducing manual spreadsheet work and eliminating ad‑hoc analyses.

## Requirements
| ID | Requirement | Description |
|----|-------------|-------------|
| R1 | Historical data generation | Ability to (re)run `hack/since_the_start.sh` to produce `history/YYYY_MM_history.csv` files for every month.
| R2 | Data ingestion | Python script must read all CSVs, parse `Duration` (HH:MM:SS) into hours, and associate each row with the correct month.
| R3 | Weekly aggregation | Compute total hours per ISO week (Mon‑Fri) and calculate the deviation `hours – 40`.
| R4 | Monthly aggregation | Compute total hours per month and the mean ratio `X/40` where X is the weekly total for that month.
| R5 | Moving average | Provide a configurable window (default 4 weeks) of the weekly deviation.
| R6 | Visualization | Jupyter notebook that displays:
|   | • Line chart of weekly deviation with moving‑average overlay
|   | • Bar chart of monthly total hours and mean X/40 ratio
|   | • Scatter / cumulative chart of deviation over time
|   | • Optional heat‑map calendar view
| R7 | CLI integration | Add a `make stats` target that runs the analysis script, prints a short textual summary, and launches the notebook.
| R8 | Documentation | Update `README.md` (or a new `docs/STATISTICS.md`) with usage instructions, prerequisites, and interpretation of the results.
| R9 | Export summary CSV | Optional `summary.csv` containing per‑month totals, mean ratios, and moving‑average values for downstream tools.

## Deliverables
1. **`analysis/stats.py`** – Core Python module implementing data loading, weekly/monthly aggregation, deviation calculations, and moving‑average logic.
2. **`analysis/stats.ipynb`** – Jupyter notebook that imports `stats.py` and creates the required visualizations.
3. **Makefile entry** – `stats` target that runs the script and opens the notebook.
4. **Documentation** – Updated `README.md` (or `docs/STATISTICS.md`) with clear step‑by‑step instructions and explanation of the business insights.
5. **Optional `analysis/weekly_summary.csv` & `analysis/monthly_summary.csv`** – Machine‑readable summaries for other tooling.

## Implementation Steps
1. **Generate CSV history** – Run `hack/since_the_start.sh` to ensure the `history/` folder is populated.
2. **Create `analysis/` package** – Add `__init__.py`, `stats.py` (using the skeleton provided earlier), and a minimal test script.
3. **Add statistical functions** – Implement `parse_duration`, `load_history`, `add_week_info`, `weekly_stats`, `monthly_stats`, and `moving_average`.
4. **Write Jupyter notebook** – Populate cells for data loading, table display, and the four visualizations.
5. **Extend Makefile** – Add a `stats` target that runs the script and launches the notebook.
6. **Document the workflow** – Explain prerequisites (`python3`, `pandas`, `matplotlib`, `jupyter`), how to regenerate data, run analysis, and interpret the charts.
7. **(Optional) Export summary CSV** – Include a flag in `stats.py` to write `summary.csv` for downstream consumption.

---

*All tasks are reflected in the existing todo list. Once the plan file is committed, we can start implementing the code.*