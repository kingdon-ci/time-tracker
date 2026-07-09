#!/usr/bin/env ruby

# Simple test runner that executes all test files
require 'minitest/autorun'

# Add the project root to the load path
$LOAD_PATH.unshift(File.expand_path('..', __dir__))

# Require all test files
test_files = Dir[File.join(__dir__, 'test_*.rb')]
test_files.each { |file| require file }

puts "\n=== Running EARLY Export Tool Tests ==="
puts "Found #{test_files.length} test files:"
test_files.each { |file| puts "  - #{File.basename(file)}" }
puts ""