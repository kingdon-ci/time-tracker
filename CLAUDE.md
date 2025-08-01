# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Primary Commands
- `make run` - Export last month's data using the default script (`./hack/runme.sh`)
- `make this` - Generate current month progress report (`this_month.csv`)
- `make all` - Clean and run current month report
- `make clean` - Remove generated CSV files (`this_month.csv`, `output.csv`)

### Direct Script Usage
- `./export.rb '^'` - Export current month (partial data)
- `./export.rb '^^'` - Export previous month (complete data)
- `./export.rb 'YYYY M'` - Export specific month (e.g., `2024 6` for June 2024)

### Environment Setup
The application requires a `.env.local` file with EARLY API credentials:
```bash
EARLY_API_KEY=your_api_key_here
EARLY_API_SECRET=your_api_secret_here
```

Optional environment variables:
- `OUTPUT_FILE` - Custom output filename (default: `output.csv`)
- `DEBUG` - Enable debug output for API response inspection

## Architecture

### Core Components
- **`export.rb`** - Main Ruby script containing the `EarlyExporter` class
  - Handles EARLY API authentication and data fetching
- **`hack/`** - Utility scripts for common operations
  - `runme.sh` - Default export (previous month)
  - `this-month.sh` - Current month progress
  - `since_the_start.sh` - Batch historical exports
- **`history/`** - Historical CSV exports organized by month (`YYYY_MM_history.csv`)

### Data Flow
1. Script authenticates with EARLY API using developer credentials
2. Fetches time entries for specified date range via `/time-entries/{start}/{end}` endpoint
3. Processes entries to calculate work progress (8 hours/day, 40 hours/week baseline)
4. Outputs CSV with Activity, Duration (HH:MM:SS), and Note columns
5. Displays progress percentage and hours over/under target

### Date Range Parsing
- `^` - Current month (partial data if run mid-month)
- `^^` - Previous month (complete data)
- `YYYY M` - Specific month format

### Progress Calculation
- Uses 8-hour workday standard (Monday-Friday only)
- For current month: only counts weekdays up to today
- Shows percentage completion and hours over/under 40-hour work week target