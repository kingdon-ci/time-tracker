use serde::{Deserialize, Serialize};
use chrono::{NaiveDate, Datelike};
use crate::raw_entry::RawTimeEntry;

#[derive(Deserialize)]
pub struct TargetInput {
    pub today: String,
    pub start_date: String,
    pub end_date: String,
    pub entries: Vec<RawTimeEntry>,
}

#[derive(Serialize)]
pub struct TargetProgress {
    pub total_hours: f64,
    pub billable_hours: f64, // Keep billable hours as well
    pub expected_hours: f64,
    pub percentage: f64,
    pub hours_diff: f64,
    pub status: String,
    pub weekdays: i32,
    pub start_date: String,
    pub end_date: String,
}

#[derive(Serialize, Clone)]
pub struct CleanEntry {
    pub activity: String,
    pub duration: String,
    pub duration_hours: f64,
    pub note: String,
    pub nonbillable: bool,
    pub date: Option<String>,
}

#[derive(Serialize)]
pub struct TargetResponse {
    pub progress: TargetProgress,
    pub entries: Vec<CleanEntry>,
    pub generated_at: String,
}

pub fn format_duration(hours: f64) -> String {
    let total_seconds = (hours * 3600.0).round() as i64;
    let h = total_seconds / 3600;
    let m = (total_seconds % 3600) / 60;
    let s = total_seconds % 60;
    format!("{:02}:{:02}:{:02}", h, m, s)
}

pub fn count_weekdays(start: NaiveDate, end: NaiveDate) -> i32 {
    use chrono::Weekday;
    let mut count = 0;
    let mut curr = start;
    while curr < end {
        let wd = curr.weekday();
        if wd != Weekday::Sat && wd != Weekday::Sun {
            count += 1;
        }
        match curr.succ_opt() {
            Some(next) => curr = next,
            None => break,
        }
    }
    count
}

pub fn compute_target(input: TargetInput) -> TargetResponse {
    let today = NaiveDate::parse_from_str(&input.today, "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::Utc::now().naive_utc().date());
    let start_date = NaiveDate::parse_from_str(&input.start_date, "%Y-%m-%d")
        .unwrap_or_else(|_| NaiveDate::from_ymd_opt(2026, 1, 1).unwrap());
    let end_date = NaiveDate::parse_from_str(&input.end_date, "%Y-%m-%d")
        .unwrap_or_else(|_| NaiveDate::from_ymd_opt(2026, 1, 31).unwrap());

    let is_current_month = today >= start_date && today <= end_date;
    
    let eff_end = if is_current_month {
        today.succ_opt().unwrap_or(today)
    } else {
        end_date.succ_opt().unwrap_or(end_date)
    };

    let weekdays = count_weekdays(start_date, eff_end);

    let expected_hours = weekdays as f64 * 8.0;

    let mut total_hours = 0.0;
    let mut billable_hours = 0.0;
    let mut clean_entries = Vec::new();

    for entry in &input.entries {
        let hours = entry.duration_hours();
        let nonbillable = entry.is_nonbillable();
        let date_str = entry.entry_date();
        
        total_hours += hours;
        if !nonbillable {
            billable_hours += hours;
        }

        let activity_name = entry.activity.as_ref()
            .and_then(|a| a.name.clone())
            .unwrap_or_else(|| "Unknown".to_string());
        
        let note_text = entry.note.as_ref()
            .and_then(|n| n.text.clone())
            .unwrap_or_default();

        clean_entries.push(CleanEntry {
            activity: activity_name,
            duration: format_duration(hours),
            duration_hours: (hours * 100.0).round() / 100.0,
            note: note_text,
            nonbillable,
            date: date_str,
        });
    }

    let hours_diff = billable_hours - expected_hours;
    let percentage = if expected_hours > 0.0 {
        (billable_hours / expected_hours) * 100.0
    } else {
        0.0
    };

    let progress = TargetProgress {
        total_hours: (total_hours * 100.0).round() / 100.0,
        billable_hours: (billable_hours * 100.0).round() / 100.0,
        expected_hours: (expected_hours * 100.0).round() / 100.0,
        percentage: (percentage * 10.0).round() / 10.0,
        hours_diff: (hours_diff * 100.0).round() / 100.0,
        status: if hours_diff >= 0.0 { "over".to_string() } else { "under".to_string() },
        weekdays,
        start_date: input.start_date,
        end_date: input.end_date,
    };

    TargetResponse {
        progress,
        entries: clean_entries,
        generated_at: chrono::Utc::now().to_rfc3339(),
    }
}
