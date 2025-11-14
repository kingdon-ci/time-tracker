#!/usr/bin/env ruby

require 'minitest/autorun'
require 'date'
require_relative '../export'

class TestDateRanges < Minitest::Test
  def setup
    # Create a testable instance with test mode enabled
    @exporter = EarlyExporter.new(
      test_mode: true,
      api_key: 'test_key',
      api_secret: 'test_secret',
      include_nonbillable: false,
      only_nonbillable: false
    )
  end

  # Helper method to stub Date.today for consistent testing
  def with_fixed_date(fixed_date)
    Date.stub :today, fixed_date do
      yield
    end
  end

  # Test @ (today and previous workday)
  def test_at_symbol_date_range
    # Thursday Nov 14, 2024
    thursday = Date.new(2024, 11, 14)
    
    with_fixed_date(thursday) do
      start_date, end_date = @exporter.parse_date_range('@')
      assert_equal Date.new(2024, 11, 13), start_date # Wednesday
      assert_equal Date.new(2024, 11, 14), end_date   # Thursday
    end
    
    # Monday Nov 11, 2024
    monday = Date.new(2024, 11, 11)
    
    with_fixed_date(monday) do
      start_date, end_date = @exporter.parse_date_range('@')
      assert_equal Date.new(2024, 11, 8), start_date  # Previous Friday
      assert_equal Date.new(2024, 11, 11), end_date   # Monday
    end
  end
  
  # Test w/weekly (7 days including today)
  def test_weekly_date_range
    # Thursday Nov 14, 2024
    thursday = Date.new(2024, 11, 14)
    
    with_fixed_date(thursday) do
      start_date, end_date = @exporter.parse_date_range('w')
      assert_equal Date.new(2024, 11, 8), start_date  # Previous Friday
      assert_equal Date.new(2024, 11, 14), end_date   # Today (Thursday)
      
      # Test 'weekly' alias
      start_date, end_date = @exporter.parse_date_range('weekly')
      assert_equal Date.new(2024, 11, 8), start_date
      assert_equal Date.new(2024, 11, 14), end_date
    end
  end
  
  # Test 6/six (6 days excluding today)
  def test_six_date_range
    # Thursday Nov 14, 2024
    thursday = Date.new(2024, 11, 14)
    
    with_fixed_date(thursday) do
      start_date, end_date = @exporter.parse_date_range('6')
      assert_equal Date.new(2024, 11, 8), start_date  # Previous Friday
      assert_equal Date.new(2024, 11, 13), end_date   # Yesterday (Wednesday)
      
      # Test 'six' alias
      start_date, end_date = @exporter.parse_date_range('six')
      assert_equal Date.new(2024, 11, 8), start_date
      assert_equal Date.new(2024, 11, 13), end_date
    end
  end
  
  # Test ^ (current month)
  def test_current_month_date_range
    # Middle of month - Nov 14, 2024
    mid_month = Date.new(2024, 11, 14)
    
    with_fixed_date(mid_month) do
      start_date, end_date = @exporter.parse_date_range('^')
      assert_equal Date.new(2024, 11, 1), start_date
      assert_equal Date.new(2024, 11, 30), end_date
    end
    
    # First day of month - Dec 1, 2024
    first_day = Date.new(2024, 12, 1)
    
    with_fixed_date(first_day) do
      start_date, end_date = @exporter.parse_date_range('^')
      assert_equal Date.new(2024, 12, 1), start_date
      assert_equal Date.new(2024, 12, 31), end_date
    end
  end
  
  # Test ^^ (previous month)
  def test_previous_month_date_range
    # Middle of month - Nov 14, 2024
    mid_month = Date.new(2024, 11, 14)
    
    with_fixed_date(mid_month) do
      start_date, end_date = @exporter.parse_date_range('^^')
      assert_equal Date.new(2024, 10, 1), start_date
      assert_equal Date.new(2024, 10, 31), end_date
    end
    
    # Test year boundary - Jan 15, 2025
    jan = Date.new(2025, 1, 15)
    
    with_fixed_date(jan) do
      start_date, end_date = @exporter.parse_date_range('^^')
      assert_equal Date.new(2024, 12, 1), start_date
      assert_equal Date.new(2024, 12, 31), end_date
    end
  end
  
  # Test explicit YYYY M format
  def test_explicit_month_date_range
    start_date, end_date = @exporter.parse_date_range('2024 2')
    assert_equal Date.new(2024, 2, 1), start_date
    assert_equal Date.new(2024, 2, 29), end_date # 2024 is leap year
    
    start_date, end_date = @exporter.parse_date_range('2023 2')
    assert_equal Date.new(2023, 2, 1), start_date
    assert_equal Date.new(2023, 2, 28), end_date # 2023 is not leap year
  end
  
  # Test find_previous_workday
  def test_find_previous_workday
    # Friday -> Thursday
    assert_equal Date.new(2024, 11, 14), @exporter.find_previous_workday(Date.new(2024, 11, 15))
    
    # Monday -> Friday (skips weekend)
    assert_equal Date.new(2024, 11, 15), @exporter.find_previous_workday(Date.new(2024, 11, 18))
    
    # Wednesday -> Tuesday
    assert_equal Date.new(2024, 11, 12), @exporter.find_previous_workday(Date.new(2024, 11, 13))
  end
end