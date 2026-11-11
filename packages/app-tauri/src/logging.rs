//! 宿主日志：按天落盘 + 导出 tar.gz（对应 Electron `lib/log` 的文件输出与 `exportLogFiles`）。
//!
//! 代码里统一用 `crate::host_log!` / `crate::host_err!`，它们同时写终端与
//! `<data>/logs/aira-YYYY-MM-DD.log`，`invoke_log_export` 再把文件打包导出。

use std::fmt;
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

static DIR: OnceLock<PathBuf> = OnceLock::new();

/// 当前打开的文件（按天切换）
static SINK: Mutex<Option<(String, File)>> = Mutex::new(None);

pub fn init(dir: PathBuf) {
    let _ = std::fs::create_dir_all(&dir);
    let _ = DIR.set(dir);
}

/// 从 Unix 天数换算出 (年, 月, 日)（Howard Hinnant 的 civil_from_days）
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

fn now_parts() -> (String, String) {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs() as i64;
    let days = secs.div_euclid(86_400);
    let rest = secs.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    let date = format!("{year:04}-{month:02}-{day:02}");
    let time = format!(
        "{:02}:{:02}:{:02}.{:03}",
        rest / 3600,
        (rest % 3600) / 60,
        rest % 60,
        now.subsec_millis()
    );
    (date, time)
}

/// 写一行日志：终端 + 文件。`level` 用 info/warn/error/debug。
pub fn write(level: &str, args: fmt::Arguments<'_>) {
    let (date, time) = now_parts();
    let message = format!("{args}");
    eprintln!("[{level}] {message}");
    let Some(dir) = DIR.get() else { return };
    let mut guard = match SINK.lock() {
        Ok(guard) => guard,
        Err(_) => return,
    };
    let needs_open = guard
        .as_ref()
        .map(|(current, _)| current != &date)
        .unwrap_or(true);
    if needs_open {
        let path = dir.join(format!("aira-{date}.log"));
        match OpenOptions::new().create(true).append(true).open(&path) {
            Ok(file) => *guard = Some((date.clone(), file)),
            Err(_) => return,
        }
    }
    if let Some((_, file)) = guard.as_mut() {
        let _ = writeln!(file, "{date}T{time} {level} {message}");
    }
}

/// 日志文件列表：`recent` 只取最新一天，`all` 全部
pub fn files(scope: &str) -> Vec<PathBuf> {
    let Some(dir) = DIR.get() else {
        return Vec::new();
    };
    let mut list: Vec<PathBuf> = std::fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .map(|entry| entry.path())
                .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("log"))
                .collect()
        })
        .unwrap_or_default();
    list.sort();
    if scope == "recent" {
        list.into_iter().rev().take(1).collect()
    } else {
        list
    }
}

/// 打包成 tar.gz
pub fn export(paths: &[PathBuf], dest: &Path) -> std::io::Result<()> {
    let file = File::create(dest)?;
    let encoder = flate2::write::GzEncoder::new(file, flate2::Compression::default());
    let mut builder = tar::Builder::new(encoder);
    for path in paths {
        let name = path
            .file_name()
            .map(|name| name.to_owned())
            .unwrap_or_else(|| "aira.log".into());
        builder.append_path_with_name(path, name)?;
    }
    let encoder = builder.into_inner()?;
    encoder.finish()?;
    Ok(())
}

#[macro_export]
macro_rules! host_log {
    ($($arg:tt)*) => {
        $crate::logging::write("info", format_args!($($arg)*))
    };
}

#[macro_export]
macro_rules! host_err {
    ($($arg:tt)*) => {
        $crate::logging::write("error", format_args!($($arg)*))
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn civil_dates_are_correct() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(19_723), (2024, 1, 1));
        assert_eq!(civil_from_days(20_000), (2024, 10, 4));
    }

    #[test]
    fn files_and_export_work() {
        // `init` 是进程级 OnceLock，两个测试必须串行且共用一个目录
        static LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
        let _guard = LOCK.lock().unwrap_or_else(|error| error.into_inner());

        let dir = std::env::temp_dir().join(format!("aira-log-test-{}", uuid::Uuid::new_v4()));
        init(dir.clone());
        write("info", format_args!("hello"));
        write("error", format_args!("world"));

        let all = files("all");
        assert_eq!(all.len(), 1, "同一天只应有一个文件");
        assert_eq!(files("recent").len(), 1);
        let content = std::fs::read_to_string(&all[0]).unwrap();
        assert!(content.contains("hello") && content.contains("error"));

        let dest = dir.join("out.tar.gz");
        export(&all, &dest).unwrap();
        let bytes = std::fs::read(&dest).unwrap();
        assert!(bytes.len() > 16);
        assert_eq!(&bytes[..2], &[0x1f, 0x8b], "应是 gzip 头");
    }
}
