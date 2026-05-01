# Changelog

## v0.5.1 - Carburetor Robustness & Mobile Optimization

### New Features

**Automated History Management:**
- Added automatic backfilling for missing historical months in `generate_summary.rb`.
- Improved Makefile to ensure summary generation has consistent API access.
- Excluded live JSON data files from Git tracking to maintain clean repository state.

**Mobile-First Dashboard Improvements:**
- Implemented fully responsive layout for the Time Carburetor.
- Fixed table "blowouts" and overflow issues on small viewports.
- Normalized global CSS for better scaling and interactive feedback.
- Added `dashboard-mobile-debugger` skill using Puppeteer for visual regression testing.

**Accuracy & Reliability:**
- Fixed timezone-related edge cases in month boundary calculation (the "rollover" bug).
- Enhanced frontend data fetching with HTML detection and robust fallback logic.
- Improved Gauge and TrendChart rendering for better clarity on various devices.

## v0.5.0 - The Time Carburetor (Jubilee Release)

### New Features

**Real-time Performance Dashboard:**
- Transitioned from CLI-only reporting to a rich, interactive React/Vite dashboard.
- **Monthly Billable Balance**: High-visibility gauge showing performance against the current month's target.
- **Rolling Comp Balance**: Historical context (YTD) to track accumulated surplus or deficit.
- **Fuel Mixture (Make Six)**: Visualization of Billable vs. Non-billable split over the past 6 days.
- **Cumulative Trend Chart**: All-time performance visualization with moving average overlay.

**Spin Architecture:**
- Re-architected backend as a Wasm-based service using the Fermyon Spin framework.
- Combined static file serving with a Python-based API for live data proxying.
- Consolidated development workflow around `spin watch` for near-instant feedback.

**Interactive History Room:**
- Added modal views for detailed drill-down into historical performance.
- Daily activity breakdowns for past months.
- Enhanced data visualization using stylized SVG components.

### Implementation Notes

- Maintained the Ruby-based export scripts for data archival and summary pre-processing.
- Leveraged Vanilla CSS for maximum flexibility and modern aesthetic.
- Preserved historical accounting logic to ensure consistency with previous reports.

## v0.4.1 - Test Suite & CI

### New Features

**Comprehensive Test Suite:**
- Added automated tests for date range calculation (7 tests, 22 assertions)
- Added automated tests for filtering logic (7 tests, 33 assertions)
- Tests run without requiring API credentials
- Sub-millisecond execution time for fast feedback

**Continuous Integration:**
- Added GitHub Actions workflow for automated testing
- Tests run on all PRs and main branch commits
- Ruby gem caching for efficient CI builds
- 9-second CI execution time

**Test-friendly Enhancements:**
- Added test mode for easier unit testing
- Made methods accessible for testing without changing public API
- Added constructor options for dependency injection

**Documentation:**
- Added comprehensive test documentation in test/README.md
- Added `make test` target to Makefile
- Updated README with testing instructions

### Implementation Notes

- Used Minitest (Ruby stdlib) for minimal external dependencies
- Strategic focus on testing the most complex and critical logic
- Complete coverage for all 6 date range formats and 3 filtering modes
- Edge case handling discovered and validated during test development
- CI-ready design supporting future serverless migration

## v0.4.0 - Conference Travel Reporting

### New Features

**New Date Range Options:**
- `w` or `weekly` - Reports on past 7 days including today
- `6` or `six` - Reports on past 6 days excluding today

**Enhanced Filtering System:**
- `ONLY_NONBILLABLE=true` - Include ONLY #nonbillable entries (for travel/conference reporting)
- Maintains existing `INCLUDE_NONBILLABLE=true` for including all entries
- Default behavior unchanged (excludes #nonbillable entries)

**New Makefile Targets:**
- `make weekly` - Runs 7-day report with nonbillable-only filtering
- `make six` - Runs 6-day report including all entries

### Use Cases

This enhancement supports conference travel reporting where:
1. Most work is tagged #nonbillable during travel
2. Need to generate trip reports showing actual work performed
3. Progress tracking still based on 40-hour work week baseline
4. Separate reporting for different audiences (managers vs trip reports)

### Implementation Notes

- All environment variables parsed at initialization for cleaner code
- Progress calculation unchanged - still targets 8 hours/day, 40 hours/week
- Filter status clearly indicated in progress output
- Backward compatibility maintained for existing usage patterns

### Future Direction

Designed to support transition to serverless/web service architecture for:
- Automated report generation
- MCP server integration  
- Decoupled report consumption via APIs
- Integration with ChatGSFC for bullet-point summaries