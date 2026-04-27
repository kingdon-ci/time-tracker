require_relative 'export'
require 'json'
require 'date'
require 'csv'

class SummaryGenerator
  def initialize(history_dir = 'history')
    @history_dir = history_dir
    @exporter = EarlyExporter.new(test_mode: true) # Use test mode to access private methods
  end

  def generate(output_file = 'web/public/history_summary.json')
    files = Dir.glob(File.join(@history_dir, '*_history.csv')).sort
    
    monthly_data = files.map do |file|
      filename = File.basename(file)
      if filename =~ /^(\d{4})_(\d{2})_history\.csv$/
        year = $1.to_i
        month = $2.to_i
        
        process_file(file, year, month)
      end
    end.compact

    # Calculate moving averages (4-month window)
    monthly_data.each_with_index do |data, i|
      if i >= 3
        window = monthly_data[(i-3)..i]
        avg_delta = window.map { |d| d[:hours_diff] }.sum / 4.0
        data[:moving_avg_4m] = avg_delta
      else
        data[:moving_avg_4m] = nil
      end
    end

    result = {
      months: monthly_data,
      generated_at: Time.now.iso8601
    }

    File.write(output_file, JSON.pretty_generate(result))
    puts "Wrote summary to #{output_file}"
  end

  private

  def process_file(file, year, month)
    start_date = Date.new(year, month, 1)
    end_date = Date.new(year, month, -1)
    
    # We need to know how many weekdays are in the full month
    # But wait, if it's the CURRENT month, we might want to only count up to today
    # For historical files, they are usually full months.
    
    total_hours = 0.0
    CSV.foreach(file, headers: true) do |row|
      duration = row['Duration']
      total_hours += @exporter.parse_duration_to_hours(duration)
    end

    # Use the logic from EarlyExporter to be consistent
    # Preserve the "buggy" 8-hour discount for months before April 2026
    # so we don't destroy historical comp time balances.
    if year < 2026 || (year == 2026 && month < 4)
      eff_end = end_date
    else
      eff_end = end_date.next_day
    end

    if Date.today.year == year && Date.today.month == month
      eff_end = Date.today.next_day if Date.today <= end_date
    end

    weekdays = @exporter.count_weekdays(start_date, eff_end)
    expected_hours = weekdays * 8.0
    hours_diff = total_hours - expected_hours
    
    {
      year: year,
      month: month,
      total_hours: total_hours.round(2),
      expected_hours: expected_hours.round(2),
      hours_diff: hours_diff.round(2),
      percentage: expected_hours > 0 ? (total_hours / expected_hours * 100).round(1) : 0,
      weekdays: weekdays
    }
  end
end

if __FILE__ == $0
  generator = SummaryGenerator.new
  generator.generate
end
