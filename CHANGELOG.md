# Changelog

## v0.4.1 - Test Suite

### New Features

**Comprehensive Test Suite:**
- Added automated tests for date range calculation
- Added automated tests for filtering logic
- Tests run without requiring API credentials

**Test-friendly Enhancements:**
- Added test mode for easier unit testing
- Made methods accessible for testing without changing public API
- Added constructor options for dependency injection

**Documentation:**
- Added test documentation in test/README.md
- Added `make test` target to Makefile

### Implementation Notes

- Used Minitest for minimal dependencies
- Focus on testing the most complex and critical logic
- Test coverage for all date range formats
- Test coverage for all filtering modes
- Fixed edge cases discovered during test development

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