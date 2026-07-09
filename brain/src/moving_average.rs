use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Clone)]
pub struct HistoryMonth {
    pub year: i32,
    pub month: i32,
    pub total_hours: f64,
    pub expected_hours: f64,
    pub hours_diff: f64,
    pub percentage: f64,
    pub weekdays: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub moving_avg_4m: Option<f64>,
}

#[derive(Deserialize)]
pub struct HistoryInput {
    pub view_year: i32,
    pub view_month: i32,
    pub current_month_diff: f64,
    pub history: Vec<HistoryMonth>,
}

#[derive(Serialize)]
pub struct HistoryOutput {
    pub comp_time_balance: f64,
    pub lookback_count: i32,
    pub historical_diff: f64,
    pub months: Vec<HistoryMonth>,
}

pub fn compute_history_summary(input: HistoryInput) -> HistoryOutput {
    let mut all_months = input.history.clone();
    
    // Sort months chronologically
    all_months.sort_by(|a, b| {
        if a.year != b.year {
            a.year.cmp(&b.year)
        } else {
            a.month.cmp(&b.month)
        }
    });

    // Find the index of the view month
    let mut view_idx = None;
    for (idx, m) in all_months.iter().enumerate() {
        if m.year == input.view_year && m.month == input.view_month {
            view_idx = Some(idx);
            break;
        }
    }

    // If view month is not found, insert a temporary one
    let (target_diff, idx_for_comp) = match view_idx {
        Some(idx) => (all_months[idx].hours_diff, idx),
        None => {
            let temp_month = HistoryMonth {
                year: input.view_year,
                month: input.view_month,
                total_hours: 0.0,
                expected_hours: 0.0,
                hours_diff: input.current_month_diff,
                percentage: 0.0,
                weekdays: 0,
                moving_avg_4m: None,
            };
            all_months.push(temp_month);
            all_months.sort_by(|a, b| {
                if a.year != b.year {
                    a.year.cmp(&b.year)
                } else {
                    a.month.cmp(&b.month)
                }
            });
            let new_idx = all_months.iter().position(|m| m.year == input.view_year && m.month == input.view_month).unwrap();
            (input.current_month_diff, new_idx)
        }
    };

    // Calculate 4-month moving average for all months
    let n = all_months.len();
    for i in 0..n {
        if i >= 3 {
            let sum: f64 = all_months[i-3..=i].iter().map(|m| m.hours_diff).sum();
            let avg = sum / 4.0;
            all_months[i].moving_avg_4m = Some((avg * 100.0).round() / 100.0);
        } else {
            all_months[i].moving_avg_4m = None;
        }
    }

    // Calculate Rolling Comp (sum of up to 5 preceding months + target month's diff)
    let mut historical_diff = 0.0;
    let mut lookback_count = 1;
    
    let start_idx = if idx_for_comp >= 5 { idx_for_comp - 5 } else { 0 };
    for i in start_idx..idx_for_comp {
        historical_diff += all_months[i].hours_diff;
        lookback_count += 1;
    }

    let comp_time_balance = historical_diff + target_diff;

    HistoryOutput {
        comp_time_balance: (comp_time_balance * 100.0).round() / 100.0,
        lookback_count,
        historical_diff: (historical_diff * 100.0).round() / 100.0,
        months: all_months,
    }
}
