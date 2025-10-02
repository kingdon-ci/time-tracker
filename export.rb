#!/usr/bin/env ruby

require 'net/http'
require 'json'
require 'csv'
require 'date'
require 'uri'
require 'time'

class EarlyExporter
  API_BASE_URL = 'https://api.early.app/api/v4'

  def initialize
    @api_key = ENV['EARLY_API_KEY']
    @api_secret = ENV['EARLY_API_SECRET']
    @output_file = ENV['OUTPUT_FILE'] || 'output.csv'
    @include_nonbillable = ENV['INCLUDE_NONBILLABLE'] == 'true'

    if @api_key.nil? || @api_secret.nil?
      $stderr.puts "Error: EARLY_API_KEY and EARLY_API_SECRET environment variables are required"
      exit 1
    end
  end

  def run(date_arg)
    start_date, end_date = parse_date_range(date_arg)

    access_token = authenticate
    time_entries = fetch_time_entries(access_token, start_date, end_date)

    # Filter entries before processing
    filtered_entries = filter_entries(time_entries)

    write_csv(filtered_entries)

    # Calculate and display progress using filtered entries
    progress_info = calculate_progress(filtered_entries, start_date, end_date)
    puts progress_info

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

    # Filter out nonbillable entries unless explicitly included
    unless @include_nonbillable
      entries = entries.reject { |entry| entry_is_nonbillable?(entry) }
    end

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

  def parse_date_range(date_arg)
    case date_arg
    when '@'
      # Today & Yesterday
      now = Date.today
      start_date = now - 1
      end_date = now
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
        raise "Invalid date format. Use '^' for this month, '^^' for last month, or 'YYYY M' for specific month"
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

  def count_weekdays(start_date, end_date)
    count = 0
    current_date = start_date

    while current_date < end_date
      # Monday = 1, Sunday = 7
      count += 1 if current_date.wday >= 1 && current_date.wday <= 5
      current_date = current_date.next_day
    end

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
      total_hours += parse_duration_to_hours(duration)
    end

    # For current month, only count weekdays up to and including today
    effective_end_date = end_date
    if Date.today >= start_date && Date.today < end_date
      effective_end_date = Date.today.next_day
    end

    weekdays = count_weekdays(start_date, effective_end_date)
    expected_hours = weekdays * 8.0

    if expected_hours > 0
      percentage = (total_hours / expected_hours) * 100
      hours_diff = total_hours - expected_hours

      if hours_diff >= 0
        format_progress_output(percentage, hours_diff, :over)
      else
        format_progress_output(percentage, hours_diff.abs, :under)
      end
    else
      "Progress: No workdays in range"
    end
  end

  def format_progress_output(percentage, hours_diff, status)
    status_text = status == :over ? "over target" : "under target"
    filter_status = @include_nonbillable ? "(including nonbillable)" : "(excluding nonbillable)"
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

  def write_csv(time_entries)
    # Debug: let's see what structure we're getting
    if ENV['DEBUG']
      puts "Debug: time_entries class: #{time_entries.class}"
      puts "Debug: time_entries structure: #{time_entries.inspect}" if time_entries.is_a?(Hash)
    end

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
        puts "Debug: processing entry: #{entry.inspect}" if ENV['DEBUG']

        activity = entry.dig('activity', 'name') || entry['activityName'] || ''
        duration = calculate_duration(entry['duration'])
        note_text = entry.dig('note', 'text')
        note = note_text.nil? || note_text.empty? ? '' : note_text

        csv << [activity, duration, note]
      end
    end
  end
end

# Main execution
if ARGV.length != 1 && ARGV.length != 2
  $stderr.puts "Usage: #{$0} <date_range>"
  $stderr.puts "  ^     - this month"
  $stderr.puts "  ^^    - last month"
  $stderr.puts "  YYYY M - specific month (e.g., '2024 6' for June 2024)"
  $stderr.puts ""
  $stderr.puts "Environment variables:"
  $stderr.puts "  INCLUDE_NONBILLABLE=true - include #nonbillable entries (default: false)"
  exit 1
end

exporter = EarlyExporter.new
exporter.run("#{ARGV[0]} #{ARGV&.[](1)}".strip)
