#![allow(non_snake_case)]

use super::model::LyricLine;
use serde_wasm_bindgen::{from_value, to_value};
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

/// 词时长异常的绝对时间
const WORD_DURATION_ANOMALY_MIN_MS: i32 = 8_000;
/// 词时长超过同行其余词时长中位数的最大倍数
const WORD_DURATION_ANOMALY_FACTOR: i32 = 4;
/// 行起始时间允许早于第一个词的最大偏差。
const LINE_BOUND_TOLERANCE_MS: i32 = 5_000;

/// 修复TTML格式，存在某行首词跨度极长（背景和声）
#[wasm_bindgen]
pub fn normalizeLyricLines(raw: JsValue) -> JsValue {
    let mut lines = from_value::<Vec<LyricLine>>(raw).unwrap_or_default();
    repair_lyric_lines(&mut lines);
    to_value::<Vec<LyricLine>>(&lines).unwrap()
}

pub fn repair_lyric_lines(lines: &mut [LyricLine]) {
    for line in lines.iter_mut() {
        repair_line_timing(line);
    }
}

/// 修复单行的时间轴异常
fn repair_line_timing(line: &mut LyricLine) {
    if line.words.is_empty() {
        if line.endTime < line.startTime {
            line.endTime = line.startTime;
        }
        return;
    }
    // 修复第一个词跨度极大（TTML）
    repair_first_word(line);
    // 修复单个词 end 早于 start
    for word in line.words.iter_mut() {
        if word.endTime < word.startTime {
            word.endTime = word.startTime;
        }
    }
    // 行起始可以略早于第一个词（TTML）
    // 严重提前或晚于第一个词按词时间修正
    let first_start = line.words[0].startTime;
    if first_start - line.startTime > LINE_BOUND_TOLERANCE_MS || line.startTime > first_start {
        line.startTime = first_start;
    }
    // 把行时间约束到词结束，行结束不应该早于词
    // 在下一行开始起，time-manager.ts不会更新当前行
    let last_end = line
        .words
        .iter()
        .map(|w| w.endTime)
        .max()
        .unwrap_or(line.endTime);
    if line.endTime < last_end {
        line.endTime = last_end;
    }
}

/// 修复第一个词的异常起始时间
fn repair_first_word(line: &mut LyricLine) {
    if line.words.len() < 2 {
        return;
    }

    let mut rest_durations = line.words[1..]
        .iter()
        .map(|w| (w.endTime - w.startTime).max(0))
        .collect::<Vec<i32>>();
    rest_durations.sort();
    let mid = rest_durations[rest_durations.len() / 2];

    // 修复首词跨度极大（TTML某些背景和声）
    let first = &mut line.words[0];
    if first.endTime - first.startTime
        > WORD_DURATION_ANOMALY_MIN_MS.max(mid.saturating_mul(WORD_DURATION_ANOMALY_FACTOR))
    {
        first.startTime = (first.endTime - mid.max(1)).max(0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lyric::model::LyricWord;

    fn word(start: i32, end: i32, text: &str) -> LyricWord {
        LyricWord {
            startTime: start,
            endTime: end,
            word: text.into(),
            inlineNote: None,
            romanWord: None,
        }
    }

    fn line(start: i32, end: i32, words: Vec<LyricWord>) -> LyricLine {
        LyricLine {
            words,
            translatedLyric: "".into(),
            romanLyric: "".into(),
            startTime: start,
            endTime: end,
            isBlank: None,
            isBackChorus: None,
            isBG: None,
            isDuet: None,
        }
    }

    /// 数据来自 amll-ttml-db 27552690.ttml 中背景和声 begin="00:00.000"
    #[test]
    fn test_repair_bg_line_with_zero_start() {
        let mut lines = vec![line(
            0,
            70500,
            vec![
                word(0, 67532, "気"),
                word(67532, 68218, "づ"),
                word(68218, 68539, "い"),
                word(68539, 68906, "て"),
                word(68906, 69200, "ほ"),
                word(69200, 69494, "し"),
                word(69435, 70500, "い"),
            ],
        )];

        repair_lyric_lines(&mut lines);

        let repaired = &lines[0];
        // 第一个词的起始时间应回推到 endTime 附近，而不是 0
        assert!(repaired.words[0].startTime > 60_000);
        assert!(repaired.words[0].startTime < repaired.words[0].endTime);
        // 行起始时间应与修复后的第一个词一致
        assert_eq!(repaired.startTime, repaired.words[0].startTime);
        assert_eq!(repaired.endTime, 70500);
    }

    #[test]
    fn test_repair_keeps_normal_yrc_line() {
        let mut lines = vec![line(
            800,
            7500,
            vec![
                word(800, 1520, "今"),
                word(1520, 1820, "夜"),
                word(1820, 2390, "恋"),
            ],
        )];

        repair_lyric_lines(&mut lines);

        assert_eq!(lines[0].startTime, 800);
        assert_eq!(lines[0].endTime, 7500);
        assert_eq!(lines[0].words[0].startTime, 800);
    }

    #[test]
    fn test_repair_keeps_long_first_note() {
        let mut lines = vec![line(
            10_000,
            14_000,
            vec![
                word(10_000, 13_000, "あ"),
                word(13_000, 13_300, "い"),
                word(13_300, 13_600, "う"),
            ],
        )];

        repair_lyric_lines(&mut lines);

        assert_eq!(lines[0].words[0].startTime, 10_000);
    }

    #[test]
    fn test_repair_keeps_lrc_style_line() {
        // LRC 行只有一个词且 start == end，不应被改动。
        let mut lines = vec![line(3000, 3000, vec![word(3000, 3000, "整行歌词")])];

        repair_lyric_lines(&mut lines);

        assert_eq!(lines[0].startTime, 3000);
        assert_eq!(lines[0].endTime, 3000);
    }

    #[test]
    fn test_repair_allows_line_slightly_before_first_word() {
        // TTML 的行 begin 常略早于第一个词，应保留作者意图。
        let mut lines = vec![line(
            140_364,
            144_020,
            vec![word(140_943, 141_299, "い"), word(141_299, 141_649, "つ")],
        )];

        repair_lyric_lines(&mut lines);

        assert_eq!(lines[0].startTime, 140_364);
    }

    #[test]
    fn test_repair_clamps_inverted_word_times() {
        let mut lines = vec![line(
            1000,
            2000,
            vec![word(1000, 1500, "あ"), word(1600, 1400, "い")],
        )];

        repair_lyric_lines(&mut lines);

        assert_eq!(lines[0].words[1].endTime, 1600);
    }
}
