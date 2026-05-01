# CLAUDE.md

This file provides guidance for AI assistants working in this repository.

## Development Commands

### Dashboard (Spin)
- `make spin-watch` - **Recommended Development Loop**. Runs exports, summary generation, builds frontend, and starts Spin with live reload.
- `make spin-up` - Build and start the production Spin app.
- `make spin-build` - Build the React frontend and Spin Wasm component.

### Data Archival (Ruby)
- `make this` - Generate current month progress report (`this_month.csv`).
- `make weekly` - Generate 7-day report (nonbillable only).
- `make six` - Generate 6-day mixture report.
- `make summary-json` - Update `web/public/history_summary.json` (includes auto-backfill).
- `make test` - Run the Ruby test suite for date/filtering logic.

### Environment Setup
Required `.env.local`:
```bash
EARLY_API_KEY=your_api_key_here
EARLY_API_SECRET=your_api_secret_here
```

## Architecture

### Components
- **`web/`** - React/Vite/TypeScript frontend.
- **`spin-app/`** - Python-based Wasm API (Spin framework).
- **`export.rb`** - Core Ruby logic for API interaction and CSV archival.
- **`generate_summary.rb`** - Pre-processes historical CSVs into JSON for the dashboard.
- **`history/`** - Source of truth for historical records (`YYYY_MM_history.csv`).

### Implementation Details
- **Timezone Handling**: Always use `America/New_York` for business day calculations.
- **Progress Calculation**: 8-hour workday standard (Mon-Fri).
- **Historical Consistency**: A legacy 8-hour discount exists for months before April 2026; do not modify historical logic to preserve past balances.
- **Live Data**: `web/public/*.json` are generated dynamically and excluded from Git.

## Testing Standards
- Ruby logic: Tested in `test/` using Minitest.
- Dashboard: Visual regression testing via `dashboard-mobile-debugger` skill (Puppeteer).
