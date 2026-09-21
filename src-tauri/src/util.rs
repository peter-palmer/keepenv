//! Small self-contained helpers.
//!
//! These exist so Keepenv can avoid pulling in large dependencies (a date
//! library, a hex crate) for a handful of lines of well-understood code.

use std::time::{SystemTime, UNIX_EPOCH};

/// Lowercase hex encoding of a byte slice.
pub fn to_hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(DIGITS[(byte >> 4) as usize] as char);
        out.push(DIGITS[(byte & 0x0f) as usize] as char);
    }
    out
}

/// Milliseconds since the Unix epoch, or `None` if the clock is before 1970.
pub fn epoch_millis(time: SystemTime) -> Option<u64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .map(|d| d.as_millis() as u64)
}

/// Converts a count of days since 1970-01-01 into a civil `(year, month, day)`.
///
/// Howard Hinnant's `civil_from_days`, which is exact for the proleptic
/// Gregorian calendar.
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let day = (doy - (153 * mp + 2) / 5 + 1) as u32; // [1, 31]
    let month = if mp < 10 { mp + 3 } else { mp - 9 } as u32; // [1, 12]
    let year = yoe as i64 + era * 400 + i64::from(month <= 2);
    (year, month, day)
}

/// The current instant as an ISO-8601 UTC timestamp, e.g. `2026-09-19T11:04:02.881Z`.
pub fn iso8601_now() -> String {
    let millis = epoch_millis(SystemTime::now()).unwrap_or(0);
    iso8601_from_millis(millis)
}

fn iso8601_from_millis(millis: u64) -> String {
    let total_seconds = (millis / 1000) as i64;
    let sub_millis = millis % 1000;
    let days = total_seconds.div_euclid(86_400);
    let seconds_of_day = total_seconds.rem_euclid(86_400);

    let (year, month, day) = civil_from_days(days);
    let hours = seconds_of_day / 3600;
    let minutes = (seconds_of_day % 3600) / 60;
    let seconds = seconds_of_day % 60;

    format!("{year:04}-{month:02}-{day:02}T{hours:02}:{minutes:02}:{seconds:02}.{sub_millis:03}Z")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_encodes_bytes() {
        assert_eq!(to_hex(&[0x00, 0x0f, 0xff, 0xa5]), "000fffa5");
        assert_eq!(to_hex(&[]), "");
    }

    #[test]
    fn formats_known_timestamps() {
        assert_eq!(iso8601_from_millis(0), "1970-01-01T00:00:00.000Z");
        assert_eq!(iso8601_from_millis(1_000), "1970-01-01T00:00:01.000Z");
        // 2026-09-19T09:15:30.123Z
        assert_eq!(
            iso8601_from_millis(1_789_809_330_123),
            "2026-09-19T09:15:30.123Z"
        );
        // Leap day.
        assert_eq!(
            iso8601_from_millis(1_709_164_800_000),
            "2024-02-29T00:00:00.000Z"
        );
    }
}
