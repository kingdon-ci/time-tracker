mod targets;
mod six_mixture;
mod moving_average;
mod raw_entry;

use targets::{TargetInput, compute_target};
use six_mixture::{SixMixtureInput, compute_six_mixture as run_six_mixture};
use moving_average::{HistoryInput, compute_history_summary as run_history_summary};

// 1MB buffers for input and output JSON communication
static mut INPUT_BUFFER: [u8; 1048576] = [0; 1048576];
static mut RESULT_BUFFER: [u8; 1048576] = [0; 1048576];

#[no_mangle]
pub extern "C" fn get_input_buffer_ptr() -> *mut u8 {
    unsafe { INPUT_BUFFER.as_mut_ptr() }
}

#[no_mangle]
pub extern "C" fn get_result_buffer_ptr() -> *const u8 {
    unsafe { RESULT_BUFFER.as_ptr() }
}

// Safely copy a string to the RESULT_BUFFER with null termination
// Safely copy a string to the RESULT_BUFFER with null termination
unsafe fn write_result_str(s: &str) -> *const u8 {
    let bytes = s.as_bytes();
    if bytes.len() >= 1048575 {
        let err_msg = r#"{"error":"WASM output buffer overflow: Result size exceeds 1MB"}"#.as_bytes();
        RESULT_BUFFER[..err_msg.len()].copy_from_slice(err_msg);
        RESULT_BUFFER[err_msg.len()] = 0;
        return RESULT_BUFFER.as_ptr();
    }
    let len = bytes.len();
    RESULT_BUFFER[..len].copy_from_slice(&bytes[..len]);
    RESULT_BUFFER[len] = 0; // Null terminator
    RESULT_BUFFER.as_ptr()
}

#[no_mangle]
pub extern "C" fn compute_monthly_target(len: i32) -> *const u8 {
    if len < 0 || len >= 1048576 {
        return unsafe { write_result_str(r#"{"error":"Input size exceeds buffer limit of 1MB"}"#) };
    }
    let input_bytes = unsafe { &INPUT_BUFFER[..len as usize] };
    let input_str = match std::str::from_utf8(input_bytes) {
        Ok(s) => s,
        Err(_) => return unsafe { write_result_str(r#"{"error":"Invalid UTF-8 in input"}"#) },
    };

    let input: TargetInput = match serde_json::from_str(input_str) {
        Ok(val) => val,
        Err(e) => return unsafe { write_result_str(&format!(r#"{{"error":"Failed to parse input JSON: {}"}}"#, e)) },
    };

    let output = compute_target(input);
    let output_str = match serde_json::to_string(&output) {
        Ok(s) => s,
        Err(_) => return unsafe { write_result_str(r#"{"error":"Failed to serialize output"}"#) },
    };

    unsafe { write_result_str(&output_str) }
}

#[no_mangle]
pub extern "C" fn compute_six_mixture(len: i32) -> *const u8 {
    if len < 0 || len >= 1048576 {
        return unsafe { write_result_str(r#"{"error":"Input size exceeds buffer limit of 1MB"}"#) };
    }
    let input_bytes = unsafe { &INPUT_BUFFER[..len as usize] };
    let input_str = match std::str::from_utf8(input_bytes) {
        Ok(s) => s,
        Err(_) => return unsafe { write_result_str(r#"{"error":"Invalid UTF-8 in input"}"#) },
    };

    let input: SixMixtureInput = match serde_json::from_str(input_str) {
        Ok(val) => val,
        Err(e) => return unsafe { write_result_str(&format!(r#"{{"error":"Failed to parse input JSON: {}"}}"#, e)) },
    };

    let output = run_six_mixture(input);
    let output_str = match serde_json::to_string(&output) {
        Ok(s) => s,
        Err(_) => return unsafe { write_result_str(r#"{"error":"Failed to serialize output"}"#) },
    };

    unsafe { write_result_str(&output_str) }
}

#[no_mangle]
pub extern "C" fn compute_moving_average(len: i32) -> *const u8 {
    if len < 0 || len >= 1048576 {
        return unsafe { write_result_str(r#"{"error":"Input size exceeds buffer limit of 1MB"}"#) };
    }
    let input_bytes = unsafe { &INPUT_BUFFER[..len as usize] };
    let input_str = match std::str::from_utf8(input_bytes) {
        Ok(s) => s,
        Err(_) => return unsafe { write_result_str(r#"{"error":"Invalid UTF-8 in input"}"#) },
    };

    let input: HistoryInput = match serde_json::from_str(input_str) {
        Ok(val) => val,
        Err(e) => return unsafe { write_result_str(&format!(r#"{{"error":"Failed to parse input JSON: {}"}}"#, e)) },
    };

    let output = run_history_summary(input);
    let output_str = match serde_json::to_string(&output) {
        Ok(s) => s,
        Err(_) => return unsafe { write_result_str(r#"{"error":"Failed to serialize output"}"#) },
    };

    unsafe { write_result_str(&output_str) }
}

#[cfg(test)]
mod tests {
    use super::*;
    use raw_entry::RawTimeEntry;

    #[test]
    fn test_monthly_target_computation() {
        let entries_json = r#"[
            {"activity": {"name": "Work"}, "duration": {"startedAt": "2026-07-08T08:00:00Z", "stoppedAt": "2026-07-08T14:00:00Z"}, "note": {"text": "coding", "tags": []}},
            {"activity": {"name": "Break"}, "duration": {"startedAt": "2026-07-08T14:00:00Z", "stoppedAt": "2026-07-08T15:30:00Z"}, "note": {"text": "lunch", "tags": [{"label": "nonbillable"}]}},
            {"activity": {"name": "Work"}, "duration": {"startedAt": "2026-07-08T15:30:00Z", "stoppedAt": "2026-07-08T20:00:00Z"}, "note": {"text": "testing", "tags": []}}
        ]"#;
        let entries: Vec<RawTimeEntry> = serde_json::from_str(entries_json).unwrap();
        let input = TargetInput {
            today: "2026-07-08".to_string(),
            start_date: "2026-07-01".to_string(),
            end_date: "2026-07-31".to_string(),
            entries
        };

        let output = compute_target(input);

        assert_eq!(output.progress.total_hours, 12.0);
        assert_eq!(output.progress.billable_hours, 10.5);
        assert_eq!(output.progress.weekdays, 6); // Jul 1, 2, 3, 6, 7, 8 (6 weekdays)
        assert_eq!(output.progress.expected_hours, 48.0); // 6 * 8.0 = 48.0
        assert_eq!(output.progress.hours_diff, -37.5); // 10.5 - 48.0
        assert_eq!(output.entries.len(), 3);
        assert_eq!(output.entries[1].activity, "Break");
        assert_eq!(output.entries[1].nonbillable, true);
    }

    #[test]
    fn test_six_mixture_computation() {
        let entries_json = r#"[
            {"activity": {"name": "Work"}, "duration": {"startedAt": "2026-07-07T08:00:00Z", "stoppedAt": "2026-07-07T13:00:00Z"}, "note": {"text": "coding", "tags": []}},
            {"activity": {"name": "Admin"}, "duration": {"startedAt": "2026-07-07T14:00:00Z", "stoppedAt": "2026-07-07T16:00:00Z"}, "note": {"text": "admin", "tags": [{"label": "nonbillable"}]}},
            {"activity": {"name": "Work"}, "duration": {"startedAt": "2026-07-06T08:00:00Z", "stoppedAt": "2026-07-06T16:00:00Z"}, "note": {"text": "testing", "tags": []}}
        ]"#;
        let entries: Vec<RawTimeEntry> = serde_json::from_str(entries_json).unwrap();
        let input = SixMixtureInput {
            today: "2026-07-08".to_string(),
            entries
        };

        let output = run_six_mixture(input);

        assert_eq!(output.entries.len(), 6);
        // Find July 7th
        let jul7 = output.entries.iter().find(|d| d.date == "2026-07-07").unwrap();
        assert_eq!(jul7.billable, 5.0);
        assert_eq!(jul7.nonbillable, 2.0);

        // Find July 6th
        let jul6 = output.entries.iter().find(|d| d.date == "2026-07-06").unwrap();
        assert_eq!(jul6.billable, 8.0);
        assert_eq!(jul6.nonbillable, 0.0);
    }
}
