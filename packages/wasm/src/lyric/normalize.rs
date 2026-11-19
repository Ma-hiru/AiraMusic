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
/// 行末允许晚于末词的时间。正常行尾留白和对唱延音都远小于这个值，
/// 只有作者把 `<p end>` 写成几十秒之后才会超过
/// （抽样 400 个文件 / 21971 行，p99.9 约 4.3s，最大值 8.8s）。
const LINE_TAIL_TOLERANCE_MS: i32 = 5_000;
/// 尾巴里至少已经起唱这么多行，才认定行末是写坏的。
/// 一行对唱唱进来属于正常重叠，不能作为收敛依据。
const LINE_TAIL_MIN_FOLLOWING_LINES: usize = 2;
/// 背景和声与本行共用 `<p end>` 的判定容差。
const BG_END_TOLERANCE_MS: i32 = 100;

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
    clamp_broken_line_tail(lines);
}

/// 收敛被写坏的行末。
///
/// TTML 里 `<p begin/end>`（行）和 `<span begin/end>`（词）是两套独立时间轴。
/// 作者手误把 `end` 写到几十秒之后时，行末会远远晚于末词：
/// `time-manager.ts` 的 `findLineIndex` 用 `time <= line.endTime` 判定激活，
/// 而 `findWordIndex` 只比较 startTime，于是这句唱完后最后一个词一直常亮，
/// 播放却已经走到后面好几行（真实案例：amll-ttml-db 722013.ttml 的 L23，
/// `<p end="35.040">` 而 9 个 span 只到 18.090，末词固定高亮约 6.6 秒）。
///
/// 两条约束同时满足才收敛，只做「明显写坏」的基础修正：
/// 1. 行末比末词晚出 `LINE_TAIL_TOLERANCE_MS`（5s）以上；
/// 2. 这段尾巴里已经有 `LINE_TAIL_MIN_FOLLOWING_LINES`（2）行以上起唱。
///
/// 第 2 条不能简化成「行末越过下一行开始」：对唱、和声本来就是多行同时激活，
/// 下一行在自己的尾音里起唱是正常写法。要求「已经又跑了两行」才能区分
/// 正常重叠与写坏的行末；纯器乐间奏没有新行起唱，也不会被误伤。
///
/// 另外跳过「尾巴由自己的背景和声唱满」的行：一个 `<p>` 里主歌词先唱完、
/// `x-bg` 接着唱到 `p end` 是 Apple 的标准块结构（如 2139980314.ttml 的
/// `5:05.755-5:18.410`，末词 5:09.582，`x-bg` 唱到 5:18.410），
/// 此时行末是块的结束而不是笔误。
fn clamp_broken_line_tail(lines: &mut [LyricLine]) {
    if lines.len() < 2 {
        return;
    }

    let mut starts = lines.iter().map(|line| line.startTime).collect::<Vec<_>>();
    starts.sort_unstable();
    let mut bg_ends = lines
        .iter()
        .filter(|line| line.isBG == Some(true))
        .map(|line| line.endTime)
        .collect::<Vec<_>>();
    bg_ends.sort_unstable();

    for line in lines.iter_mut() {
        let Some(last_end) = line.words.iter().map(|word| word.endTime).max() else {
            continue;
        };
        if line.endTime - last_end <= LINE_TAIL_TOLERANCE_MS {
            continue;
        }
        // 尾巴由同一块里的背景和声撑到行末，行末是块的结束时间
        let bg_from = bg_ends.partition_point(|&end| end < line.endTime - BG_END_TOLERANCE_MS);
        if bg_ends
            .get(bg_from)
            .is_some_and(|&end| end <= line.endTime + BG_END_TOLERANCE_MS)
        {
            continue;
        }
        // 末词结束之后、行末之前起唱的行数（不含同一时刻起唱的对唱行）
        let from = starts.partition_point(|&start| start <= last_end);
        let to = starts.partition_point(|&start| start < line.endTime);
        if to - from < LINE_TAIL_MIN_FOLLOWING_LINES {
            continue;
        }
        line.endTime = last_end;
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

    fn bg_line(start: i32, end: i32, words: Vec<LyricWord>) -> LyricLine {
        LyricLine {
            isBG: Some(true),
            ..line(start, end, words)
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

    /// 真实数据：amll-ttml-db 722013.ttml 的 L23「振るう右手が甘くて」。
    /// `<p begin="16.770" end="35.040">`，9 个 span 只唱到 18.090，
    /// 尾巴里 L24/L25/L26 已经先后起唱。
    #[test]
    fn test_clamps_broken_line_tail() {
        let mut lines = vec![
            line(
                16_770,
                35_040,
                vec![
                    word(16_770, 16_950, "振"),
                    word(17_140, 17_390, "右"),
                    word(17_940, 18_090, "て"),
                ],
            ),
            line(18_360, 18_990, vec![word(18_360, 18_990, "甘")]),
            line(18_760, 19_350, vec![word(18_760, 19_350, "く")]),
            line(19_260, 20_470, vec![word(19_260, 20_470, "て")]),
        ];

        repair_lyric_lines(&mut lines);

        // 收敛到末词结束，末词常亮从 6.6s 变成 0
        assert_eq!(lines[0].endTime, 18_090);
        // 后续行不受影响
        assert_eq!(lines[1].endTime, 18_990);
        assert_eq!(lines[3].endTime, 20_470);
    }

    /// 真实数据：2139980314.ttml 的 `5:05.755-5:18.410`，主歌词唱到 5:09.582，
    /// 同块 `x-bg` 唱到 5:18.410，`<p end>` 等于块结束，不是笔误。
    #[test]
    fn test_keeps_tail_covered_by_background_vocal() {
        let mut lines = vec![
            line(305_755, 318_410, vec![word(305_755, 309_582, "Feel")]),
            bg_line(309_221, 318_410, vec![word(309_221, 318_410, "Baby")]),
            line(310_550, 313_960, vec![word(310_550, 313_960, "I've")]),
            line(317_800, 324_650, vec![word(317_800, 324_650, "I'm")]),
        ];

        repair_lyric_lines(&mut lines);

        // 尾巴由 x-bg 唱满，主行保持块结束时间
        assert_eq!(lines[0].endTime, 318_410);
        assert_eq!(lines[1].endTime, 318_410);
    }

    #[test]
    fn test_keeps_tail_with_only_one_following_line() {
        // 尾巴 10s，但只有一行对唱唱进来：正常重叠，不动
        let mut lines = vec![
            line(1000, 20_000, vec![word(1000, 10_000, "あ")]),
            line(11_000, 13_000, vec![word(11_000, 13_000, "い")]),
        ];

        repair_lyric_lines(&mut lines);

        assert_eq!(lines[0].endTime, 20_000);
    }

    #[test]
    fn test_keeps_tail_in_instrumental_gap() {
        // 尾巴 8s，但尾巴里没有新行起唱（器乐间奏），不动
        let mut lines = vec![
            line(1000, 9000, vec![word(1000, 2000, "あ")]),
            line(20_000, 21_000, vec![word(20_000, 21_000, "い")]),
        ];

        repair_lyric_lines(&mut lines);

        assert_eq!(lines[0].endTime, 9000);
    }

    #[test]
    fn test_keeps_short_line_tail() {
        // 尾巴 800ms，未超过 5s 容差：行尾留白，不动
        let mut lines = vec![
            line(
                1000,
                2900,
                vec![word(1000, 2000, "あ"), word(2000, 2100, "い")],
            ),
            line(2500, 5000, vec![word(2500, 5000, "う")]),
        ];

        repair_lyric_lines(&mut lines);

        assert_eq!(lines[0].endTime, 2900);
    }

    #[test]
    fn test_keeps_multi_line_activation() {
        // 对唱多行同时激活，每行末尾都留了 3s 延音：不足容差，全部保留
        let mut lines = vec![
            line(1000, 7000, vec![word(1000, 4000, "あ")]),
            line(3000, 9000, vec![word(3000, 6000, "い")]),
            line(5000, 11_000, vec![word(5000, 8000, "う")]),
        ];

        repair_lyric_lines(&mut lines);

        assert_eq!(lines[0].endTime, 7000);
        assert_eq!(lines[1].endTime, 9000);
        assert_eq!(lines[2].endTime, 11_000);
    }

    #[test]
    fn test_keeps_overlapping_duet_line() {
        // 词本身就唱到后续行之后（对唱重叠）：行末可以收敛，但不能压到末词之前
        let mut lines = vec![
            line(1000, 15_500, vec![word(1000, 10_000, "あ")]),
            line(3000, 5000, vec![word(3000, 5000, "い")]),
            line(11_000, 12_000, vec![word(11_000, 12_000, "う")]),
            line(12_500, 13_500, vec![word(12_500, 13_500, "え")]),
        ];

        repair_lyric_lines(&mut lines);

        assert_eq!(lines[0].endTime, 10_000);
        assert_eq!(lines[1].endTime, 5000);
    }

    #[test]
    fn test_keeps_last_line_tail() {
        // 最后一行后面没有行起唱，长尾不处理
        let mut lines = vec![
            line(1000, 2000, vec![word(1000, 2000, "あ")]),
            line(3000, 60_000, vec![word(3000, 4000, "い")]),
        ];

        repair_lyric_lines(&mut lines);

        assert_eq!(lines[1].endTime, 60_000);
    }

    #[test]
    fn test_clamps_tail_with_unsorted_lines() {
        // 数组按文档顺序给出，可能不等于按时间的顺序
        let mut lines = vec![
            line(10_000, 40_000, vec![word(10_000, 11_000, "あ")]),
            line(18_360, 18_990, vec![word(18_360, 18_990, "い")]),
            line(20_000, 21_000, vec![word(20_000, 21_000, "う")]),
        ];

        repair_lyric_lines(&mut lines);

        assert_eq!(lines[0].endTime, 11_000);
        assert_eq!(lines[1].endTime, 18_990);
    }
}
