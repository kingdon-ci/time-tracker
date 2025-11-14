# EARLY CSV Export Tool

A simple Ruby script to export time tracking data from the EARLY API (formerly Timeular) in CSV format.

## Features

- Export time entries with Activity, Duration, and Note fields
- Simple date range specification using Beeminder-style syntax
- Minimal configuration via environment variables
- Clean CSV output suitable for further processing
- Progress tracking for monthly work hours vs. 40-hour work week
- Progress output showing percentage and hours over/under target
- Smart current month handling - only counts started workdays
- Smart workday handling for '@' mode - shows previous workday and today (Friday on Monday)

## Requirements

- Ruby (tested with standard library only)
- EARLY API credentials (API Key and Secret)

## Setup

1. Create a `.env.local` file with your EARLY API credentials:
```bash
EARLY_API_KEY=your_api_key_here
EARLY_API_SECRET=your_api_secret_here
```

2. Make the script executable:
```bash
chmod +x export.rb
```

## Usage

The script accepts date range parameters in a simplified Beeminder format:

- `@` - Yesterday and today (or previous workday and today if run on Monday)
- `w` or `weekly` - Past 7 days including today
- `6` or `six` - Past 6 days excluding today
- `^` - Current month (partial data if run mid-month)
- `^^` - Previous month
- `YYYY M` - Specific month (e.g., `2024 6` for June 2024)

### Examples

```bash
# Export yesterday and today (or previous workday + today on Monday)
./export.rb '@'      # or 'make today'

# Export past 7 days (including today) - nonbillable only
./export.rb 'w'      # or 'make weekly'

# Export past 6 days (excluding today) - all entries
./export.rb '6'      # or 'make six'

# Export current month
./export.rb '^'      # or 'make'

# Export last month
./export.rb '^^'     # or 'make run'

# Export June 2024
./export.rb '2024 6' # see also './hack/since_the_start.sh' to export several months
```

### Using the provided scripts

```bash
# Run with default settings (last month)
make run

# Or directly
./hack/runme.sh

# Run now (this month's progress report)
make this

# Generate weekly report (nonbillable only, past 7 days)
make weekly

# Generate 6-day report (all entries, past 6 days excluding today)
make six

# Run the test suite
make test

# Clean up after
make clean
```

## Output

The script creates `output.csv` by default with three columns:
- **Activity**: The name of the tracked activity
- **Duration**: Time spent in HH:MM:SS format
- **Note**: Associated note text (empty if no note)

Example output:
```csv
Activity,Duration,Note
Email,08:00:00,Vacation - PTO
Flux / Community,00:32:41,Flux Dev Meeting
Recording,02:45:00,
```

The next run will overwrite the file. Historical records are meant to be kept
as copies of the CSV `output.csv`, in `history/YYYY_MM_history.csv` as needed.

## Configuration

Environment variables:
- `EARLY_API_KEY` - Your EARLY API key (required)
- `EARLY_API_SECRET` - Your EARLY API secret (required)
- `OUTPUT_FILE` - Custom output filename (default: `output.csv`)
- `INCLUDE_NONBILLABLE` - Include #nonbillable entries (default: false)
- `ONLY_NONBILLABLE` - Include ONLY #nonbillable entries (overrides INCLUDE_NONBILLABLE)
- `DEBUG` - Enable debug output (optional)

## Error Handling

The script will:
- Print success messages to stdout
- Print error messages to stderr
- Exit with status code 1 on failure
- Include HTTP status codes for API errors

## License

MIT License

## Filtering Options

The tool supports three filtering modes for #nonbillable entries:

1. **Default mode**: Excludes #nonbillable entries (standard work reporting)
2. **Include all**: Set `INCLUDE_NONBILLABLE=true` to include both billable and nonbillable
3. **Nonbillable only**: Set `ONLY_NONBILLABLE=true` to show only nonbillable entries (conference/travel reporting)

The `make weekly` command uses nonbillable-only mode by default, while `make six` includes all entries.

## Testing

The tool includes a comprehensive test suite with automated CI:

```bash
# Run the test suite locally
make test
```

**Test Coverage:**
- 14 test methods covering date range calculation and filtering logic
- 55 total assertions validating critical functionality
- Sub-millisecond execution time
- GitHub Actions CI running on all PRs

For more information about the tests, see [test/README.md](test/README.md).

## Version

* 0.4.1 - Add test suite for date range and filtering logic
* 0.4.0 - Add weekly/6-day reporting and nonbillable-only filtering for conference travel
* 0.3.1 - Fix weekend handling (bug) in today and yesterday code
* 0.3.0 - Support status reports that include today and yesterday
* 0.2.0 - Track simple progress against 8d/40w on a monthly basis
* 0.1.0 - Basic CSV export functionality
