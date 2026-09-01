# Legacy Time Carburetor (Spin + Ruby CLI)

This document preserves the documentation and instructions for the legacy Spin-based web dashboard and Ruby CLI tools. The code has been moved to the [legacy/](legacy/) directory, but the targets are fully integrated into the root [Makefile](Makefile).

## Getting Started

### Prerequisites

- [Ruby](https://www.ruby-lang.org/) (for data archival scripts)
- [Spin CLI](https://developer.fermyon.com/spin/v2/install) (for running the dashboard)
- [Node.js & npm](https://nodejs.org/) (for frontend development)
- EARLY API credentials (API Key and Secret)

### Setup

1. Create a `.env.local` file with your credentials:
   ```bash
   EARLY_API_KEY=your_api_key_here
   EARLY_API_SECRET=your_api_secret_here
   ```

2. Install dependencies:
   ```bash
   cd web && npm install
   ```

3. Initialize your history (optional):
   ```bash
   mkdir -p history
   # Run archival for previous months if you have them
   # ruby legacy/export.rb 2024 11
   ```

### Running the Legacy Dashboard

```bash
# Start the dashboard in watch mode (auto-rebuilds on changes)
make spin-watch
```

This will:
1. Export current month data to `web/public/data.json`.
2. Generate a 6-day mixture summary.
3. Update the historical summary (auto-backfilling missing months).
4. Build the React frontend.
5. Start the Spin runtime at `http://localhost:3000`.

### Monthly Month-Close Archival Workflow

At the end of each month (or beginning of the next month, e.g., on September 1):

1. Ensure `.env.local` contains valid `EARLY_API_KEY` and `EARLY_API_SECRET`.
2. Run:
   ```bash
   make summary-json
   ```
3. This command will:
   - Identify newly completed months up to the previous month.
   - Fetch finalized time entries from Early API and write `history/YYYY_MM_history.csv`.
   - Calculate monthly target hours, surplus/deficit ($\Delta$), and 4-month moving averages.
   - Write updated `history_summary.json` to both `web/public/` and `android/app/src/main/assets/`.
4. Commit the new CSV in `history/` and updated `history_summary.json` files to Git.

### Legacy CLI Usage

The core Ruby export tool remains available for direct CLI usage:

- `make this`: Quick monthly progress report.
- `make weekly`: 7-day nonbillable report (for travel/conference reporting).
- `make six`: 6-day all-entry report.
- `make test`: Run the comprehensive test suite for date/filtering logic.

See the [export.rb](legacy/export.rb) script for full date range options (`@`, `w`, `6`, `^`, `^^`, etc.).
