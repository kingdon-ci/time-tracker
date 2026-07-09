# Legacy Time Carburetor (Spin + Ruby CLI)

This document preserves the documentation and instructions for the legacy Spin-based web dashboard and Ruby CLI tools. The code has been moved to the `legacy/` directory.

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

### Legacy CLI Usage

The core Ruby export tool remains available for direct CLI usage:

- `make this`: Quick monthly progress report.
- `make weekly`: 7-day nonbillable report (for travel/conference reporting).
- `make six`: 6-day all-entry report.
- `make test`: Run the comprehensive test suite for date/filtering logic.

See the `export.rb` script for full date range options (`@`, `w`, `6`, `^`, `^^`, etc.).
