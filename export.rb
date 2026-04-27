#!/usr/bin/env ruby

require 'net/http'
require 'json'
require 'csv'
require 'date'
require 'uri'
require 'time'

class EarlyExporter
  API_BASE_URL = 'https://api.early.app/api/v4'

  def initialize(options = {})
    @api_key = options[:api_key] || ENV['EARLY_API_KEY']
    @api_secret = options[:api_secret] || ENV['EARLY_API_SECRET']
    @output_file = options[:output_file] || ENV['OUTPUT_FILE'] || 'output.csv'
    @include_nonbillable = options[:include_nonbillable].nil? ? (ENV['INCLUDE_NONBILLABLE'] == 'true') : options[:include_nonbillable]
    @only_nonbillable = options[:only_nonbillable].nil? ? (ENV['ONLY_NONBILLABLE'] == 'true') : options[:only_nonbillable]
    @test_mode = options[:test_mode] || false

    # Skip API key check in test mode
    if !@test_mode && (@api_key.nil? || @api_secret.nil?)
      $stderr.puts "Error: EARLY_API_KEY and EARLY_API_SECRET environment variables are required"
      exit 1
    end
    
    # Make private methods public in test mode for testing
    if @test_mode
      self.class.class_eval do
        public :parse_date_range, :filter_entries, :entry_is_nonbillable?, :find_previous_workday, :parse_duration_to_hours, :count_weekdays
      end
    end
  end

  def run(date_arg)
    start_date, end_date = parse_date_range(date_arg)

    access_token = authenticate
    time_entries = fetch_time_entries(access_token, start_date, end_date)

    # Filter entries before processing
    filtered_entries = filter_entries(time_entries)

    if @output_file.end_with?('.json')
      write_json(filtered_entries, start_date, end_date)
    else
      write_csv(filtered_entries)
      # Calculate and display progress using filtered entries
      progress = calculate_progress(filtered_entries, start_date, end_date)
      puts format_progress_output(progress)
    end

    puts "wrote to #{@output_file}"
  rescue => e
    $stderr.puts "Error: #{e.message}"
    exit 1
  end

  private

  def authenticate
    uri = URI("#{API_BASE_URL}/developer/sign-in")

    request = Net::HTTP::Post.new(uri)
    request['Content-Type'] = 'application/json'
    request.body = {
      apiKey: @api_key,
      apiSecret: @api_secret
    }.to_json

    response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
      http.request(request)
    end

    unless response.is_a?(Net::HTTPSuccess)
      $stderr.puts "Authentication failed with HTTP status #{response.code} (#{response.message})"
      exit 1
    end

    data = JSON.parse(response.body)
    data['token']
  end

  def fetch_time_entries(access_token, start_date, end_date)
    # Convert Eastern Time dates to UTC for API call
    # Use the target date's DST status, not the current date's

    # Create Eastern Time objects for the start and end dates
    start_et = Time.new(start_date.year, start_date.month, start_date.day, 0, 0, 0, "-05:00")
    start_et = start_et.getlocal("-04:00") if start_et.dst?  # Adjust to EDT if in DST period

    end_et = Time.new(end_date.year, end_date.month, end_date.day, 23, 59, 59, "-05:00")
    end_et = end_et.getlocal("-04:00") if end_et.dst?  # Adjust to EDT if in DST period

    # Convert to UTC
    start_utc = start_et.utc
    end_utc = end_et.utc

    start_iso = start_utc.strftime('%Y-%m-%dT%H:%M:%S.000')
    end_iso = end_utc.strftime('%Y-%m-%dT%H:%M:%S.999')

    uri = URI("#{API_BASE_URL}/time-entries/#{start_iso}/#{end_iso}")

    request = Net::HTTP::Get.new(uri)
    request['Authorization'] = "Bearer #{access_token}"

    response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
      http.request(request)
    end

    unless response.is_a?(Net::HTTPSuccess)
      $stderr.puts "Failed to fetch time entries with HTTP status #{response.code} (#{response.message})"
      exit 1
    end

    JSON.parse(response.body)
  end

  def filter_entries(time_entries)
    # Handle different possible API response structures
    entries = case time_entries
    when Array
      time_entries
    when Hash
      time_entries['timeEntries'] || time_entries['data'] || time_entries['entries'] || []
    else
      []
    end

    # Apply filtering based on instance variables
    if @only_nonbillable
      # Include ONLY nonbillable entries
      entries = entries.select { |entry| entry_is_nonbillable?(entry) }
    elsif !@include_nonbillable
      # Default: exclude nonbillable entries
      entries = entries.reject { |entry| entry_is_nonbillable?(entry) }
    end
    # else: include all entries (when @include_nonbillable=true and @only_nonbillable=false)

    # Return in the same structure as received
    case time_entries
    when Array
      entries
    when Hash
      time_entries.merge(
        'timeEntries' => entries,
        'data' => entries,
        'entries' => entries
      )
    else
      entries
    end
  end

  def entry_is_nonbillable?(entry)
    tags = entry.dig('note', 'tags')
    return false if tags.nil? || !tags.is_a?(Array)

    # Check if any tag has the label "nonbillable"
    tags.any? { |tag| tag['label']&.downcase == 'nonbillable' }
  end

  # Find the previous workday (Monday-Friday) before the given date
  def find_previous_workday(date)
    current_date = date - 1
    while current_date.wday == 0 || current_date.wday == 6  # Sunday = 0, Saturday = 6
      current_date = current_date - 1
    end
    current_date
  end

  def parse_date_range(date_arg)
    case date_arg
    when '@'
      # Today & Yesterday
      now = Date.today
      start_date = find_previous_workday(now)
      end_date = now
    when 'w', 'weekly'
      # Weekly: 7 days back from today (includes today)
      now = Date.today
      start_date = now - 6  # 6 days ago plus today = 7 total days
      end_date = now
    when '6', 'six'
      # Six days: yesterday back 6 days (excludes today)
      yesterday = Date.today - 1
      start_date = yesterday - 5  # 5 days before yesterday = 6 total days
      end_date = yesterday
    when '^'
      # This month
      now = Date.today
      start_date = Date.new(now.year, now.month, 1)
      end_date = Date.new(now.year, now.month, -1)
    when '^^'
      # Last month
      now = Date.today
      last_month = now.prev_month
      start_date = Date.new(last_month.year, last_month.month, 1)
      end_date = Date.new(last_month.year, last_month.month, -1)
    else
      # Format: "2024 6" for June 2024
      parts = date_arg.split
      if parts.length != 2
        raise "Invalid date format. Use '^' for this month, '^^' for last month, 'w'/'weekly' for 7 days, '6'/'six' for 6 days, or 'YYYY M' for specific month"
      end

      year = parts[0].to_i
      month = parts[1].to_i

      if year < 1900 || year > 2100 || month < 1 || month > 12
        raise "Invalid year or month in date specification"
      end

      start_date = Date.new(year, month, 1)
      end_date = Date.new(year, month, -1)
    end

    [start_date, end_date]
  end

  def format_duration(duration_seconds)
    hours = duration_seconds / 3600
    minutes = (duration_seconds % 3600) / 60
    seconds = duration_seconds % 60

    "%02d:%02d:%02d" % [hours, minutes, seconds]
  end

  def parse_duration_to_hours(duration_str)
    return 0.0 if duration_str.nil? || duration_str.empty?

    parts = duration_str.split(':').map(&:to_i)
    return 0.0 if parts.length != 3

    hours, minutes, seconds = parts
    hours + (minutes / 60.0) + (seconds / 3600.0)
  end

  # Counts weekdays between start_date (inclusive) and end_date (exclusive).
  # The method treats end_date as the day *after* the last day to include, matching the logic used elsewhere.
  def count_weekdays(start_date, end_date)
    puts "Debug count_weekdays: start_date=#{start_date}, end_date=#{end_date}" if ENV['DEBUG']
    count = 0
    current_date = start_date

    while current_date < end_date
      # Monday = 1, Sunday = 7
      is_weekday = current_date.wday >= 1 && current_date.wday <= 5
      puts "Debug count_weekdays: #{current_date} (wday=#{current_date.wday}) is_weekday=#{is_weekday}" if ENV['DEBUG']

      if is_weekday
        count += 1
        puts "Debug count_weekdays: incremented count to #{count}" if ENV['DEBUG']
      end

      current_date = current_date.next_day
    end

    puts "Debug count_weekdays: final count=#{count}" if ENV['DEBUG']
    count
  end

  def calculate_progress(time_entries, start_date, end_date)
    # Handle different possible API response structures
    entries = case time_entries
    when Array
      time_entries
    when Hash
      time_entries['timeEntries'] || time_entries['data'] || time_entries['entries'] || []
    else
      []
    end

    # Calculate total hours worked
    total_hours = 0.0
    entries.each do |entry|
      duration = calculate_duration(entry['duration'])
      hours = parse_duration_to_hours(duration)
      total_hours += hours
    end

    # Determine effective end date for progress calculation
    effective_end_date = case ARGV[0]
    when '@'
      end_date.to_date.next_day
    else
      # Preserve the "buggy" 8-hour discount for months before April 2026
      # so we don't destroy historical comp time balances.
      if start_date.year < 2026 || (start_date.year == 2026 && start_date.month < 4)
        eff_end = end_date
      else
        eff_end = end_date.next_day
      end

      # For current month, only count weekdays up to and including today
      if Date.today >= start_date && Date.today <= end_date
        eff_end = Date.today.next_day
      end
      eff_end
    end

    # Count weekdays up to and including effective_end_date (end_date is exclusive in count_weekdays)
    weekdays = count_weekdays(start_date, effective_end_date)
    expected_hours = weekdays * 8.0

    percentage = expected_hours > 0 ? (total_hours / expected_hours) * 100 : 0
    hours_diff = total_hours - expected_hours

    {
      total_hours: total_hours,
      expected_hours: expected_hours,
      percentage: percentage,
      hours_diff: hours_diff,
      status: hours_diff >= 0 ? :over : :under,
      weekdays: weekdays,
      start_date: start_date,
      end_date: end_date,
      effective_end_date: effective_end_date
    }
  end

  def format_progress_output(progress)
    return "Progress: No workdays in range" if progress.is_a?(String)
    percentage = progress[:percentage]
    hours_diff = progress[:hours_diff].abs
    status_text = progress[:status] == :over ? "over target" : "under target"
    filter_status = if @only_nonbillable
      "(nonbillable only)"
    elsif @include_nonbillable
      "(including nonbillable)"
    else
      "(excluding nonbillable)"
    end
    "Progress: #{percentage.round(1)}% (#{hours_diff.round(1)} hours #{status_text}) #{filter_status}"
  end

  def calculate_duration(duration_obj)
    return "00:00:00" unless duration_obj.is_a?(Hash)

    started_at = duration_obj['startedAt']
    stopped_at = duration_obj['stoppedAt']

    return "00:00:00" unless started_at && stopped_at

    start_time = Time.parse(started_at)
    stop_time = Time.parse(stopped_at)

    duration_seconds = (stop_time - start_time).to_i
    format_duration(duration_seconds)
  end

  def write_json(time_entries, start_date, end_date)
    progress = calculate_progress(time_entries, start_date, end_date)
    
    entries = case time_entries
    when Array
      time_entries
    when Hash
      time_entries['timeEntries'] || time_entries['data'] || time_entries['entries'] || []
    else
      []
    end

    processed_entries = entries.map do |entry|
      duration_str = calculate_duration(entry['duration'])
      {
        activity: entry.dig('activity', 'name') || entry['activityName'] || '',
        duration: duration_str,
        duration_hours: parse_duration_to_hours(duration_str),
        note: entry.dig('note', 'text') || '',
        nonbillable: entry_is_nonbillable?(entry)
      }
    end

    data = {
      progress: progress,
      entries: processed_entries,
      generated_at: Time.now.iso8601
    }

    File.write(@output_file, JSON.pretty_generate(data))
  end

  def write_csv(time_entries)
    # Debug: let's see what structure we're getting
    # if ENV['DEBUG']
    #   puts "Debug: time_entries class: #{time_entries.class}"
    #   puts "Debug: time_entries structure: #{time_entries.inspect}" if time_entries.is_a?(Hash)
    # end

    # Handle different possible API response structures
    entries = case time_entries
    when Array
      time_entries
    when Hash
      time_entries['timeEntries'] || time_entries['data'] || time_entries['entries'] || []
    else
      []
    end

    CSV.open(@output_file, 'w') do |csv|
      csv << ['Activity', 'Duration', 'Note']

      entries.each do |entry|
        # puts "Debug: processing entry: #{entry.inspect}" if ENV['DEBUG']

        activity = entry.dig('activity', 'name') || entry['activityName'] || ''
        duration = calculate_duration(entry['duration'])
        note_text = entry.dig('note', 'text')
        note = note_text.nil? || note_text.empty? ? '' : note_text

        csv << [activity, duration, note]
      end
    end
  end
end

# Main execution - only run if called directly (not when required for testing)
if __FILE__ == $0
  if ARGV.length != 1 && ARGV.length != 2
    $stderr.puts "Usage: #{$0} <date_range>"
    $stderr.puts "Date range options:"
    $stderr.puts "  @        - today & yesterday"
    $stderr.puts "  w/weekly - past 7 days (including today)"
    $stderr.puts "  6/six    - past 6 days (excluding today)"
    $stderr.puts "  ^        - this month"
    $stderr.puts "  ^^       - last month"
    $stderr.puts "  YYYY M   - specific month (e.g., '2024 6' for June 2024)"
    $stderr.puts ""
    $stderr.puts "Environment variables:"
    $stderr.puts "  INCLUDE_NONBILLABLE=true - include #nonbillable entries (default: false)"
    $stderr.puts "  ONLY_NONBILLABLE=true    - include ONLY #nonbillable entries"
    exit 1
  end

  exporter = EarlyExporter.new
  exporter.run("#{ARGV[0]} #{ARGV&.[](1)}".strip)
end
