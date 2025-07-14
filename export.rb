#!/usr/bin/env ruby

require 'net/http'
require 'json'
require 'csv'
require 'date'
require 'uri'

class EarlyExporter
  API_BASE_URL = 'https://api.early.app/api/v4'
  
  def initialize
    @api_key = ENV['EARLY_API_KEY']
    @api_secret = ENV['EARLY_API_SECRET']
    @output_file = ENV['OUTPUT_FILE'] || 'output.csv'
    
    if @api_key.nil? || @api_secret.nil?
      $stderr.puts "Error: EARLY_API_KEY and EARLY_API_SECRET environment variables are required"
      exit 1
    end
  end
  
  def run(date_arg)
    start_date, end_date = parse_date_range(date_arg)
    
    access_token = authenticate
    time_entries = fetch_time_entries(access_token, start_date, end_date)
    write_csv(time_entries)
    
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
    # Format dates with milliseconds as shown in the API example
    start_iso = start_date.strftime('%Y-%m-%dT00:00:00.000')
    end_iso = end_date.strftime('%Y-%m-%dT23:59:59.999')
    
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
  
  def parse_date_range(date_arg)
    case date_arg
    when '^'
      # This month
      now = Date.today
      start_date = Date.new(now.year, now.month, 1)
      end_date = Date.new(now.year, now.month, -1).next_day
    when '^^'
      # Last month
      now = Date.today
      last_month = now.prev_month
      start_date = Date.new(last_month.year, last_month.month, 1)
      end_date = Date.new(last_month.year, last_month.month, -1).next_day
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
      end_date = Date.new(year, month, -1).next_day
    end
    
    [start_date, end_date]
  end
  
  def format_duration(duration_seconds)
    hours = duration_seconds / 3600
    minutes = (duration_seconds % 3600) / 60
    seconds = duration_seconds % 60
    
    "%02d:%02d:%02d" % [hours, minutes, seconds]
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
if ARGV.length != 1
  $stderr.puts "Usage: #{$0} <date_range>"
  $stderr.puts "  ^     - this month"
  $stderr.puts "  ^^    - last month"
  $stderr.puts "  YYYY M - specific month (e.g., '2024 6' for June 2024)"
  exit 1
end

exporter = EarlyExporter.new
exporter.run(ARGV[0])
