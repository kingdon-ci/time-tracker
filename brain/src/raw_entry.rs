use serde::Deserialize;
use chrono::{NaiveDate, Datelike, Weekday};

#[derive(Deserialize, Debug, Clone)]
pub struct RawTimeEntry {
    pub activity: Option<RawActivity>,
    pub duration: Option<RawDuration>,
    pub note: Option<RawNote>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct RawActivity {
    pub name: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct RawDuration {
    #[serde(rename = "startedAt")]
    pub started_at: Option<String>,
    #[serde(rename = "stoppedAt")]
    pub stopped_at: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct RawNote {
    pub text: Option<String>,
    pub tags: Option<Vec<RawTag>>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct RawTag {
    pub label: Option<String>,
}

impl RawTimeEntry {
    pub fn duration_hours(&self) -> f64 {
        if let Some(ref dur) = self.duration {
            if let (Some(ref start), Some(ref stop)) = (&dur.started_at, &dur.stopped_at) {
                // Try RFC3339 first, fallback to basic ISO patterns (assume UTC if no timezone)
                let start_dt = chrono::DateTime::parse_from_rfc3339(start)
                    .map(|dt| dt.with_timezone(&chrono::Utc))
                    .or_else(|_| chrono::NaiveDateTime::parse_from_str(start, "%Y-%m-%dT%H:%M:%S%.f").map(|dt| dt.and_utc()))
                    .or_else(|_| chrono::NaiveDateTime::parse_from_str(start, "%Y-%m-%dT%H:%M:%S%f").map(|dt| dt.and_utc()));
                let stop_dt = chrono::DateTime::parse_from_rfc3339(stop)
                    .map(|dt| dt.with_timezone(&chrono::Utc))
                    .or_else(|_| chrono::NaiveDateTime::parse_from_str(stop, "%Y-%m-%dT%H:%M:%S%.f").map(|dt| dt.and_utc()))
                    .or_else(|_| chrono::NaiveDateTime::parse_from_str(stop, "%Y-%m-%dT%H:%M:%S%f").map(|dt| dt.and_utc()));
                if let (Ok(t1), Ok(t2)) = (start_dt, stop_dt) {
                    let diff = t2.signed_duration_since(t1);
                    return diff.num_seconds() as f64 / 3600.0;
                }
            }
        }
        0.0
    }

    pub fn is_nonbillable(&self) -> bool {
        if let Some(ref note) = self.note {
            if let Some(ref tags) = note.tags {
                return tags.iter().any(|t| {
                    t.label.as_ref().map(|l| l.to_lowercase() == "nonbillable").unwrap_or(false)
                });
            }
        }
        false
    }

    // Convert UTC start time to America/New_York date
    pub fn entry_date(&self) -> Option<String> {
        if let Some(ref dur) = self.duration {
            if let Some(ref start) = dur.started_at {
                let dt = chrono::DateTime::parse_from_rfc3339(start)
                    .map(|dt| dt.with_timezone(&chrono::Utc))
                    .or_else(|_| chrono::NaiveDateTime::parse_from_str(start, "%Y-%m-%dT%H:%M:%S%.f").map(|dt| dt.and_utc()))
                    .or_else(|_| chrono::NaiveDateTime::parse_from_str(start, "%Y-%m-%dT%H:%M:%S%f").map(|dt| dt.and_utc()));
                if let Ok(utc_dt) = dt {
                    let utc_naive = utc_dt.naive_utc();
                    let offset_hours = if is_dst(utc_naive.date()) { -4 } else { -5 };
                    let et_dt = utc_naive + chrono::Duration::hours(offset_hours);
                    return Some(et_dt.date().format("%Y-%m-%d").to_string());
                }
            }
        }
        None
    }
}

// Simple US DST calculation (starts 2nd Sunday in March, ends 1st Sunday in November)
fn is_dst(date: NaiveDate) -> bool {
    let year = date.year();
    
    // 2nd Sunday in March
    let march_1 = NaiveDate::from_ymd_opt(year, 3, 1).unwrap();
    let march_1_wday = march_1.weekday().num_days_from_sunday();
    let dst_start_day = 14 - (march_1_wday + 6) % 7;
    let dst_start = NaiveDate::from_ymd_opt(year, 3, dst_start_day).unwrap();

    // 1st Sunday in November
    let nov_1 = NaiveDate::from_ymd_opt(year, 11, 1).unwrap();
    let nov_1_wday = nov_1.weekday().num_days_from_sunday();
    let dst_end_day = 7 - (nov_1_wday + 6) % 7;
    let dst_end = NaiveDate::from_ymd_opt(year, 11, dst_end_day).unwrap();

    date >= dst_start && date < dst_end
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_duration_hours_early_api_format_no_tz() {
        // Early API returns dates like "2026-07-01T12:00:00.000" (no timezone)
        let entry = RawTimeEntry {
            activity: None,
            duration: Some(RawDuration {
                started_at: Some("2026-07-01T12:00:00.000".to_string()),
                stopped_at: Some("2026-07-01T13:30:00.000".to_string()),
            }),
            note: None,
        };
        // 1.5 hours
        assert!((entry.duration_hours() - 1.5).abs() < 0.001);
    }

    #[test]
    fn test_duration_hours_early_api_format_no_tz_no_millis() {
        // Also handle format without milliseconds
        let entry = RawTimeEntry {
            activity: None,
            duration: Some(RawDuration {
                started_at: Some("2026-07-01T12:00:00".to_string()),
                stopped_at: Some("2026-07-01T14:00:00".to_string()),
            }),
            note: None,
        };
        // 2 hours
        assert!((entry.duration_hours() - 2.0).abs() < 0.001);
    }

    #[test]
    fn test_duration_hours_rfc3339_still_works() {
        // Backward compatibility: RFC3339 with Z suffix
        let entry = RawTimeEntry {
            activity: None,
            duration: Some(RawDuration {
                started_at: Some("2026-07-01T12:00:00Z".to_string()),
                stopped_at: Some("2026-07-01T14:00:00Z".to_string()),
            }),
            note: None,
        };
        assert!((entry.duration_hours() - 2.0).abs() < 0.001);
    }

    #[test]
    fn test_duration_hours_rfc3339_with_offset() {
        // RFC3339 with explicit offset
        let entry = RawTimeEntry {
            activity: None,
            duration: Some(RawDuration {
                started_at: Some("2026-07-01T08:00:00-04:00".to_string()),
                stopped_at: Some("2026-07-01T10:00:00-04:00".to_string()),
            }),
            note: None,
        };
        assert!((entry.duration_hours() - 2.0).abs() < 0.001);
    }

    #[test]
    fn test_entry_date_july_dst() {
        // July is in DST (UTC-4)
        let entry = RawTimeEntry {
            activity: None,
            duration: Some(RawDuration {
                started_at: Some("2026-07-01T12:00:00.000".to_string()),
                stopped_at: Some("2026-07-01T13:00:00.000".to_string()),
            }),
            note: None,
        };
        // 12:00 UTC = 08:00 EDT (same day)
        assert_eq!(entry.entry_date(), Some("2026-07-01".to_string()));
    }

    #[test]
    fn test_entry_date_january_no_dst() {
        // January is not in DST (UTC-5)
        let entry = RawTimeEntry {
            activity: None,
            duration: Some(RawDuration {
                started_at: Some("2026-01-15T12:00:00.000".to_string()),
                stopped_at: Some("2026-01-15T13:00:00.000".to_string()),
            }),
            note: None,
        };
        // 12:00 UTC = 07:00 EST (same day)
        assert_eq!(entry.entry_date(), Some("2026-01-15".to_string()));
    }

    #[test]
    fn test_entry_date_crosses_midnight_dst() {
        // Late evening UTC on July 1 = still July 1 in EDT
        let entry = RawTimeEntry {
            activity: None,
            duration: Some(RawDuration {
                started_at: Some("2026-07-01T22:00:00.000".to_string()),
                stopped_at: Some("2026-07-01T23:00:00.000".to_string()),
            }),
            note: None,
        };
        // 22:00 UTC = 18:00 EDT (same day)
        assert_eq!(entry.entry_date(), Some("2026-07-01".to_string()));
    }

    #[test]
    fn test_entry_date_crosses_midnight_no_dst() {
        // Late evening UTC on Jan 15 = Jan 14 in EST
        let entry = RawTimeEntry {
            activity: None,
            duration: Some(RawDuration {
                started_at: Some("2026-01-15T02:00:00.000".to_string()),
                stopped_at: Some("2026-01-15T03:00:00.000".to_string()),
            }),
            note: None,
        };
        // 02:00 UTC = 21:00 EST previous day (Jan 14)
        assert_eq!(entry.entry_date(), Some("2026-01-14".to_string()));
    }

    #[test]
    fn test_is_nonbillable_with_tag() {
        let entry = RawTimeEntry {
            activity: None,
            duration: None,
            note: Some(RawNote {
                text: Some("lunch".to_string()),
                tags: Some(vec![RawTag { label: Some("nonbillable".to_string()) }]),
            }),
        };
        assert!(entry.is_nonbillable());
    }

    #[test]
    fn test_is_nonbillable_case_insensitive() {
        let entry = RawTimeEntry {
            activity: None,
            duration: None,
            note: Some(RawNote {
                text: Some("lunch".to_string()),
                tags: Some(vec![RawTag { label: Some("NonBillable".to_string()) }]),
            }),
        };
        assert!(entry.is_nonbillable());
    }

    #[test]
    fn test_is_nonbillable_without_tag() {
        let entry = RawTimeEntry {
            activity: None,
            duration: None,
            note: Some(RawNote {
                text: Some("work".to_string()),
                tags: Some(vec![RawTag { label: Some("billable".to_string()) }]),
            }),
        };
        assert!(!entry.is_nonbillable());
    }

    #[test]
    fn test_is_nonbillable_no_note() {
        let entry = RawTimeEntry {
            activity: None,
            duration: None,
            note: None,
        };
        assert!(!entry.is_nonbillable());
    }
}
