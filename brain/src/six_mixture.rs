use serde::{Deserialize, Serialize};
use chrono::{NaiveDate, Duration};
use std::collections::HashMap;
use crate::raw_entry::RawTimeEntry;

#[derive(Deserialize)]
pub struct SixMixtureInput {
    pub today: String,
    pub entries: Vec<RawTimeEntry>,
}

#[derive(Serialize)]
pub struct DailyMixture {
    pub date: String,
    pub billable: f64,
    pub nonbillable: f64,
}

#[derive(Serialize)]
pub struct SixMixtureOutput {
    pub entries: Vec<DailyMixture>, // Named "entries" to match UI data
    pub generated_at: String,
}

pub fn compute_six_mixture(input: SixMixtureInput) -> SixMixtureOutput {
    let today = NaiveDate::parse_from_str(&input.today, "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::Utc::now().naive_utc().date());
    
    // Yesterday back 6 days (excludes today)
    let yesterday = today - Duration::days(1);
    let start_date = yesterday - Duration::days(5);

    // Generate list of 6 dates
    let mut dates = Vec::new();
    let mut curr = start_date;
    while curr <= yesterday {
        dates.push(curr);
        match curr.succ_opt() {
            Some(next) => curr = next,
            None => break,
        }
    }

    // Accumulate durations per date
    let mut day_map: HashMap<String, (f64, f64)> = HashMap::new();
    for entry in &input.entries {
        if let Some(ref date_str) = entry.entry_date() {
            let entry_date = NaiveDate::parse_from_str(date_str, "%Y-%m-%d");
            if let Ok(ed) = entry_date {
                if ed >= start_date && ed <= yesterday {
                    let entry_key = ed.format("%Y-%m-%d").to_string();
                    let record = day_map.entry(entry_key).or_insert((0.0, 0.0));
                    let hours = entry.duration_hours();
                    if entry.is_nonbillable() {
                        record.1 += hours;
                    } else {
                        record.0 += hours;
                    }
                }
            }
        }
    }

    // Build the final output sorted by date
    let mut days_output = Vec::new();
    for d in dates {
        let date_str = d.format("%Y-%m-%d").to_string();
        let (billable, nonbillable) = day_map.get(&date_str).copied().unwrap_or((0.0, 0.0));
        days_output.push(DailyMixture {
            date: date_str,
            billable: (billable * 100.0).round() / 100.0,
            nonbillable: (nonbillable * 100.0).round() / 100.0,
        });
    }

    SixMixtureOutput {
        entries: days_output,
        generated_at: chrono::Utc::now().to_rfc3339(),
    }
}
