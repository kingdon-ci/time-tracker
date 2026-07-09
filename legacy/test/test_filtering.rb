#!/usr/bin/env ruby

require 'minitest/autorun'
require_relative '../export'

class TestFiltering < Minitest::Test
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

  # Create a mock time entries structure with both billable and nonbillable entries
  def sample_time_entries
    [
      {
        'activity' => { 'name' => 'Development' },
        'duration' => { 'startedAt' => '2024-11-14T09:00:00Z', 'stoppedAt' => '2024-11-14T17:00:00Z' },
        'note' => { 'text' => 'Regular work', 'tags' => [] }
      },
      {
        'activity' => { 'name' => 'Conference' },
        'duration' => { 'startedAt' => '2024-11-13T09:00:00Z', 'stoppedAt' => '2024-11-13T17:00:00Z' },
        'note' => { 'text' => 'Travel day', 'tags' => [{ 'label' => 'nonbillable' }] }
      },
      {
        'activity' => { 'name' => 'Meeting' },
        'duration' => { 'startedAt' => '2024-11-12T10:00:00Z', 'stoppedAt' => '2024-11-12T11:00:00Z' },
        'note' => { 'text' => 'Team standup', 'tags' => [{ 'label' => 'important' }] }
      },
      {
        'activity' => { 'name' => 'Workshop' },
        'duration' => { 'startedAt' => '2024-11-11T09:00:00Z', 'stoppedAt' => '2024-11-11T17:00:00Z' },
        'note' => { 'text' => 'Learning session', 'tags' => [{ 'label' => 'Nonbillable' }] } # Test case insensitive
      }
    ]
  end

  def test_default_filtering_excludes_nonbillable
    # Default setup already has include_nonbillable=false, only_nonbillable=false
    filtered = @exporter.filter_entries(sample_time_entries)
    
    assert_equal 2, filtered.length
    assert_equal 'Development', filtered[0]['activity']['name']
    assert_equal 'Meeting', filtered[1]['activity']['name']
  end

  def test_include_nonbillable_includes_all_entries
    exporter = EarlyExporter.new(
      test_mode: true,
      api_key: 'test_key',
      api_secret: 'test_secret',
      include_nonbillable: true,
      only_nonbillable: false
    )
    
    filtered = exporter.filter_entries(sample_time_entries)
    
    assert_equal 4, filtered.length
    activity_names = filtered.map { |entry| entry['activity']['name'] }
    assert_includes activity_names, 'Development'
    assert_includes activity_names, 'Conference'
    assert_includes activity_names, 'Meeting'
    assert_includes activity_names, 'Workshop'
  end

  def test_only_nonbillable_includes_only_nonbillable
    exporter = EarlyExporter.new(
      test_mode: true,
      api_key: 'test_key',
      api_secret: 'test_secret',
      include_nonbillable: false,
      only_nonbillable: true
    )
    
    filtered = exporter.filter_entries(sample_time_entries)
    
    assert_equal 2, filtered.length
    assert_equal 'Conference', filtered[0]['activity']['name']
    assert_equal 'Workshop', filtered[1]['activity']['name']
  end

  def test_only_nonbillable_overrides_include_nonbillable
    exporter = EarlyExporter.new(
      test_mode: true,
      api_key: 'test_key',
      api_secret: 'test_secret',
      include_nonbillable: true,
      only_nonbillable: true
    )
    
    filtered = exporter.filter_entries(sample_time_entries)
    
    # Should still only include nonbillable entries
    assert_equal 2, filtered.length
    assert_equal 'Conference', filtered[0]['activity']['name']
    assert_equal 'Workshop', filtered[1]['activity']['name']
  end

  def test_filtering_with_hash_structure
    # Test with API response wrapped in a hash
    hash_entries = { 'timeEntries' => sample_time_entries }
    
    exporter = EarlyExporter.new(
      test_mode: true,
      api_key: 'test_key',
      api_secret: 'test_secret',
      include_nonbillable: false,
      only_nonbillable: true
    )
    
    filtered = exporter.filter_entries(hash_entries)
    
    assert_kind_of Hash, filtered
    assert_equal 2, filtered['timeEntries'].length
    assert_equal 'Conference', filtered['timeEntries'][0]['activity']['name']
  end

  def test_entry_is_nonbillable_detection
    billable_entry = {
      'note' => { 'text' => 'Regular work', 'tags' => [] }
    }
    
    nonbillable_entry = {
      'note' => { 'text' => 'Travel', 'tags' => [{ 'label' => 'nonbillable' }] }
    }
    
    mixed_tags_entry = {
      'note' => { 'text' => 'Meeting', 'tags' => [{ 'label' => 'important' }, { 'label' => 'nonbillable' }] }
    }
    
    case_insensitive_entry = {
      'note' => { 'text' => 'Workshop', 'tags' => [{ 'label' => 'NONBILLABLE' }] }
    }
    
    refute @exporter.entry_is_nonbillable?(billable_entry)
    assert @exporter.entry_is_nonbillable?(nonbillable_entry)
    assert @exporter.entry_is_nonbillable?(mixed_tags_entry)
    assert @exporter.entry_is_nonbillable?(case_insensitive_entry)
  end

  def test_entry_is_nonbillable_with_missing_data
    no_note_entry = {}
    no_tags_entry = { 'note' => { 'text' => 'Work' } }
    empty_tags_entry = { 'note' => { 'text' => 'Work', 'tags' => [] } }
    
    refute @exporter.entry_is_nonbillable?(no_note_entry)
    refute @exporter.entry_is_nonbillable?(no_tags_entry)
    refute @exporter.entry_is_nonbillable?(empty_tags_entry)
  end
end
