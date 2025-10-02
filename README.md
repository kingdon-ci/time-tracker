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

- `^` - Current month (partial data if run mid-month)
- `^^` - Previous month
- `YYYY M` - Specific month (e.g., `2024 6` for June 2024)

### Examples

```bash
# Export today and yesterday
./export.rb '@'      # or 'make today'

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
- `DEBUG` - Enable debug output (optional)

## Error Handling

The script will:
- Print success messages to stdout
- Print error messages to stderr
- Exit with status code 1 on failure
- Include HTTP status codes for API errors

## License

MIT License

## Version

* 0.3.0 - Support status reports that include today and yesterday
* 0.2.0 - Track simple progress against 8d/40w on a monthly basis
* 0.1.0 - Basic CSV export functionality
