# EARLY CSV Export Tool - Tests

This directory contains automated tests for the EARLY CSV export tool. These tests validate the core functionality of the application without requiring API credentials or making actual API calls.

## Test Structure

The tests are organized into two main files:

1. **`test_date_ranges.rb`** - Tests for date range parsing logic:
   - Coverage for all date range options (`@`, `w`/`weekly`, `6`/`six`, `^`, `^^`, and `YYYY M` formats)
   - Handling of month boundaries and leap years
   - Weekend/workday calculations
   - Testing with various current dates to ensure correct behavior

2. **`test_filtering.rb`** - Tests for the filtering logic:
   - Default filtering (excluding nonbillable entries)
   - Include-all filtering (`INCLUDE_NONBILLABLE=true`)
   - Nonbillable-only filtering (`ONLY_NONBILLABLE=true`)
   - Priority handling (ONLY_NONBILLABLE overriding INCLUDE_NONBILLABLE)
   - Various API response structures and edge cases

## Running the Tests

To run all tests:

```bash
cd test
ruby run_tests.rb
```

This will execute all test files and report the results.

## Test Design Philosophy

The tests focus on the most critical parts of the application:

1. **Date range calculations** - These are complex and critical to the application's functionality
2. **Filtering logic** - The core business logic that determines which entries are included
3. **Maintainability** - Tests that make future changes safer

The test suite intentionally avoids:
- Testing API interactions (which would require mocking)
- Testing CSV output formatting (which is straightforward)
- Testing progress calculations (which are complex but less likely to change)

## Implementation Notes

- Tests use Minitest, which is included in Ruby's standard library (no additional dependencies)
- Test mode allows accessing private methods for testing without changing the public API
- Stubs for `Date.today` ensure consistent test results regardless of when tests are run
- Mock data simulates the API response structure without requiring actual API access
- Tests cover edge cases such as case insensitivity in tags and leap year handling

## Maintenance

When making changes to the application, run the test suite to ensure you haven't broken existing functionality. If you add new features, consider adding tests for them, especially if they involve:

- New date range options
- Changes to the filtering logic
- Modifications to the API response handling

The test suite provides a safety net for future enhancements, especially when transitioning to a serverless architecture or expanding the functionality of the tool.