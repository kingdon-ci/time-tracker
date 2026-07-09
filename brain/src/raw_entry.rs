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
                // Try RFC3339 first, fallback to basic ISO patterns
                let start_dt = chrono::DateTime::parse_from_rfc3339(start)
                    .or_else(|_| chrono::DateTime::parse_from_str(start, "%Y-%m-%dT%H:%M:%S%.fZ"))
                    .or_else(|_| chrono::DateTime::parse_from_str(start, "%Y-%m-%dT%H:%M:%S%.f"));
                let stop_dt = chrono::DateTime::parse_from_rfc3339(stop)
                    .or_else(|_| chrono::DateTime::parse_from_str(stop, "%Y-%m-%dT%H:%M:%S%.fZ"))
                    .or_else(|_| chrono::DateTime::parse_from_str(stop, "%Y-%m-%dT%H:%M:%S%.f"));
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
                    .or_else(|_| chrono::DateTime::parse_from_str(start, "%Y-%m-%dT%H:%M:%S%.fZ"))
                    .or_else(|_| chrono::DateTime::parse_from_str(start, "%Y-%m-%dT%H:%M:%S%.f"));
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
