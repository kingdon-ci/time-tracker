# Time Carburetor

A real-time performance dashboard and historical accounting tool for the EARLY API (formerly Timeular).

The Time Carburetor provides high-visibility into billable performance, tracking monthly targets and long-term comp-time balances through an interactive, mobile-optimized dashboard.

## Key Features

- **Real-time Performance Monitoring**: Instant feedback on your current month's billable balance.
- **Cumulative Trend Analysis**: All-time surplus/deficit visualization with 4-month moving averages.
- **Rolling Comp Balance**: Track your Year-To-Date (YTD) historical context at a glance.
- **"Make Six" Mixture**: Specialized gauge for monitoring the Billable vs. Non-billable split over a 6-day window.
- **Automated Archiving**: Ruby-based export tools for maintaining monthly CSV records.
- **Mobile Optimized**: Responsive design for monitoring performance on the go.

## Architecture

The project is built on the **Fermyon Spin** framework:
- **Frontend**: React (TypeScript) with Vite, utilizing stylized SVG components and Vanilla CSS.
- **Backend**: Python-based API (Wasm) providing live data proxying and historical summary serving.
- **Data Layer**: Hybrid approach using live API data and local pre-processed JSON/CSV summaries.

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
   # ./export.rb 2024 11
   ```

### Running the Dashboard

The easiest way to develop and run the dashboard is using `make`:

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

## Legacy CLI Usage

The core Ruby export tool remains available for direct CLI usage:

- `make this`: Quick monthly progress report.
- `make weekly`: 7-day nonbillable report (for travel/conference reporting).
- `make six`: 6-day all-entry report.
- `make test`: Run the comprehensive test suite for date/filtering logic.

See the `export.rb` script for full date range options (`@`, `w`, `6`, `^`, `^^`, etc.).

## Project Philosophy

The Time Carburetor is designed for "accuracy where it counts." It maintains a consistent historical record while providing the real-time feedback loop necessary for professional self-management. It prioritizes simplicity, fast execution, and zero-maintenance reliability.

## License

MIT License
